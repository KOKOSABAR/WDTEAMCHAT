import React, { useState, useEffect, useRef } from "react";
import { User, Chat, Message, PRESET_AVATARS } from "./types.ts";
import LoginView from "./components/LoginView.tsx";
import ChatListSidebar from "./components/ChatListSidebar.tsx";
import ChatArea from "./components/ChatArea.tsx";
import InfoPanel from "./components/InfoPanel.tsx";
import GroupModal from "./components/GroupModal.tsx";
import CallModal from "./components/CallModal.tsx";
import AdminPanelModal from "./components/AdminPanelModal.tsx";
import { motion, AnimatePresence } from "motion/react";
import { X, RefreshCw, Volume2, UserCheck, Check, MessageCircle, Info, LogOut } from "lucide-react";
import { useToast } from "./components/Toast.tsx";

export default function App() {
  const toast = useToast();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Modal and Panel toggles
  const [showGroupModal, setShowGroupModal] = useState<boolean>(false);
  const [showInfoPanel, setShowInfoPanel] = useState<boolean>(false);
  const [showProfileEditModal, setShowProfileEditModal] = useState<boolean>(false);
  
  // Call State
  const [activeCall, setActiveCall] = useState<{ isVideo: boolean; partner: User | { name: string; avatar: string; id: string } } | null>(null);

  // Active Typing indicators: { [userId]: boolean }
  const [typingStatuses, setTypingStatuses] = useState<{ [userId: string]: boolean }>({});

  // Mobile layout responsiveness (sidebar vs active chat view)
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar');

  // Interactive Live Banner Notifications
  const [notification, setNotification] = useState<{ title: string; body: string; avatar?: string } | null>(null);

  // Profile Edit fields
  const [editProfileName, setEditProfileName] = useState<string>("");
  const [editProfileStatus, setEditProfileStatus] = useState<string>("");
  const [editProfileAvatar, setEditProfileAvatar] = useState<string>("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const [editProfilePassword, setEditProfilePassword] = useState<string>("");
  const [editProfileConfirmPassword, setEditProfileConfirmPassword] = useState<string>("");
  const [editProfilePasswordError, setEditProfilePasswordError] = useState<string>("");

  // Admin Panel modal
  const [showAdminPanelModal, setShowAdminPanelModal] = useState<boolean>(false);

  // Logout confirmation modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState<boolean>(false);

  // Handler for uploading custom profile photo
  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileData: base64String
          })
        });

        const data = await response.json();
        if (response.ok && data.success && data.fileUrl) {
          setEditProfileAvatar(data.fileUrl);
          toast.success("Foto profil berhasil diunggah!");
        } else {
          toast.error(data.error || "Gagal mengunggah foto profil.");
        }
      } catch (err) {
        console.error("Gagal mengunggah foto profil:", err);
        toast.error("Terjadi kesalahan jaringan.");
      } finally {
        setIsUploadingAvatar(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const sseSourceRef = useRef<EventSource | null>(null);
  const chimeAudioCtxRef = useRef<AudioContext | null>(null);

  // 1. Initial Auth Check from LocalStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("line_user");
    if (saved) {
      try {
        const u = JSON.parse(saved);
        setCurrentUser(u);
      } catch {
        localStorage.removeItem("line_user");
      }
    }
  }, []);

  // 2. Load Core Data (Users, Chats, Messages) when currentUser exists
  const fetchAllData = async () => {
    if (!currentUser) return;
    try {
      const [usersRes, chatsRes] = await Promise.all([
        fetch("/api/users"),
        fetch(`/api/chats?userId=${currentUser.id}`)
      ]);

      if (usersRes.ok && chatsRes.ok) {
        const uData = await usersRes.json();
        const cData = await chatsRes.json();
        
        setAllUsers(uData);
        setChats(cData);

        // Sync all messages across active chats to calculate unread counts correctly and keep sorting/previews stable
        const allMsgsPromise = cData.map((c: Chat) => 
          fetch(`/api/chats/${c.id}/messages?userId=${currentUser.id}`).then(r => r.json())
        );
        const results = await Promise.all(allMsgsPromise);
        const flatMsgs = results.flat();
        setMessages(flatMsgs);
      }
    } catch (err) {
      console.error("Gagal melakukan sinkronisasi data:", err);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [currentUser, selectedChatId]);

  // Synthesize digital notification sound when a message arrives in another chat
  const playNotificationChime = () => {
    try {
      if (!chimeAudioCtxRef.current) {
        chimeAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = chimeAudioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch A5
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08); // Chord glide

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (err) {
      console.warn("Audio Context blocked:", err);
    }
  };

  // 3. Setup real-time Server-Sent Events (SSE) stream
  useEffect(() => {
    if (!currentUser) {
      // Clean up on log out
      if (sseSourceRef.current) {
        sseSourceRef.current.close();
        sseSourceRef.current = null;
      }
      return;
    }

    // Connect SSE
    const source = new EventSource(`/api/realtime?userId=${currentUser.id}`);
    sseSourceRef.current = source;

    source.onopen = () => {
      console.log("Koneksi real-time LINE aktif!");
    };

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const { type, payload } = data;

        switch (type) {
          case "user_status": {
            // Update single user online/offline status in list
            setAllUsers(prev => prev.map(u => 
              u.id === payload.userId 
                ? { ...u, isOnline: payload.isOnline, lastSeen: payload.lastSeen } 
                : u
            ));
            break;
          }
          
          case "user_profile_updated": {
            // Update specific user details
            setAllUsers(prev => prev.map(u => u.id === payload.id ? payload : u));
            if (payload.id === currentUser.id) {
              setCurrentUser(payload);
              localStorage.setItem("line_user", JSON.stringify(payload));
            }
            break;
          }

          case "chat_new": {
            // Add new chat to room lists
            setChats(prev => {
              if (prev.some(c => c.id === payload.id)) return prev;
              return [...prev, payload];
            });
            break;
          }

          case "chat_updated": {
            // Update chat metadata
            setChats(prev => prev.map(c => c.id === payload.id ? payload : c));
            break;
          }

          case "chat_deleted": {
            // Remove chat
            setChats(prev => prev.filter(c => c.id !== payload.chatId));
            if (selectedChatId === payload.chatId) {
              setSelectedChatId(null);
              setMessages([]);
              setShowInfoPanel(false);
              setMobileView('sidebar');
            }
            break;
          }

          case "chat_removed": {
            // I was removed from group
            if (payload.userId === currentUser.id) {
              setChats(prev => prev.filter(c => c.id !== payload.chatId));
              if (selectedChatId === payload.chatId) {
                setSelectedChatId(null);
                setMessages([]);
                setShowInfoPanel(false);
                setMobileView('sidebar');
              }
              // Trigger kick notification
              triggerBannerNotification("Info Grup", "Anda dikeluarkan dari grup chat.", "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?w=150&auto=format&fit=crop&q=80");
            }
            break;
          }

          case "message_new": {
            const newMsg = payload as Message;
            // Append message if not already present
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });

            // Trigger notification alerts and sound if not currently in this chat
            const isTargetForMe = chats.some(c => c.id === newMsg.chatId && c.members.includes(currentUser.id));
            if (isTargetForMe && newMsg.senderId !== currentUser.id) {
              const relatedChat = chats.find(c => c.id === newMsg.chatId);
              const senderUser = allUsers.find(u => u.id === newMsg.senderId);
              
              const notifTitle = relatedChat?.isGroup ? `${relatedChat.name} • ${newMsg.senderName}` : newMsg.senderName;
              const notifBody = 
                newMsg.type === "sticker" ? "🎨 Mengirim stiker" : 
                newMsg.type === "image" ? "📷 Mengirim foto" : 
                newMsg.type === "file" ? "📁 Mengirim berkas" : 
                newMsg.type === "voice" ? "🎙️ Mengirim pesan suara" :
                newMsg.text;

              if (newMsg.chatId !== selectedChatId) {
                playNotificationChime();
                triggerBannerNotification(notifTitle, notifBody, senderUser?.avatar);
              }

              // Trigger Chrome PC pop-up notification if on a different chat or if the browser tab is backgrounded
              if (newMsg.chatId !== selectedChatId || document.hidden) {
                showBrowserNotification(notifTitle, notifBody, senderUser?.avatar);
              }
            }
            break;
          }

          case "message_deleted": {
            // Handle soft deletes or global unsends
            setMessages(prev => prev.map(m => 
              m.id === payload.messageId 
                ? { ...m, deletedFor: payload.deletedFor, deletedForEveryone: payload.deletedForEveryone, text: payload.deletedForEveryone ? "Pesan ini telah dihapus" : m.text } 
                : m
            ).filter(m => !m.deletedFor.includes(currentUser.id)));
            break;
          }

          case "message_reaction": {
            setMessages(prev => prev.map(m => 
              m.id === payload.messageId 
                ? { ...m, reactions: payload.reactions } 
                : m
            ));
            break;
          }

          case "typing": {
            // Display live typing indicators
            if (payload.chatId === selectedChatId) {
              setTypingStatuses(prev => ({
                ...prev,
                [payload.userId]: payload.isTyping
              }));
            }
            break;
          }

          case "chat_read": {
            // Update checkmarks when partner views the chat
            setMessages(prev => prev.map(m => {
              if (m.chatId === payload.chatId && !m.readBy.includes(payload.userId)) {
                return { ...m, readBy: [...m.readBy, payload.userId] };
              }
              return m;
            }));
            break;
          }
        }
      } catch (err) {
        console.error("Kesalahan parsing SSE event:", err);
      }
    };

    source.onerror = (err) => {
      console.warn("SSE stream disconnected. Reconnecting dynamically...");
    };

    return () => {
      source.close();
    };

  }, [currentUser, selectedChatId, chats]);

  // Fallback Polling every 5 seconds to ensure absolute state syncing if SSE drops
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      fetchAllData();
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser, selectedChatId]);

  // Handle showing floating banner toast notifications
  const triggerBannerNotification = (title: string, body: string, avatar?: string) => {
    setNotification({ title, body, avatar });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  // Login callback
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("line_user", JSON.stringify(user));
  };

  // Logout callback
  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    setShowLogoutConfirm(false);
    if (sseSourceRef.current) {
      sseSourceRef.current.close();
    }
    setCurrentUser(null);
    setChats([]);
    setMessages([]);
    setSelectedChatId(null);
    localStorage.removeItem("line_user");
  };

  // Select Chat Room
  const handleSelectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setTypingStatuses({}); // clear typing indicator
    setMobileView('chat');
  };

  // Send message API trigger
  const handleSendMessage = async (
    text: string,
    type: 'text' | 'sticker' | 'image' | 'file' | 'voice',
    mediaUrl?: string,
    fileName?: string,
    fileSize?: string,
    replyTo?: any
  ) => {
    if (!currentUser || !selectedChatId) return;

    try {
      const response = await fetch(`/api/chats/${selectedChatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          senderId: currentUser.id,
          text,
          type,
          mediaUrl,
          fileName,
          fileSize,
          replyTo
        })
      });

      if (response.ok) {
        const newMsg = await response.json();
        setMessages(prev => [...prev, newMsg]);
      }
    } catch (err) {
      console.error("Gagal mengirim pesan:", err);
    }
  };

  // Mark message as read API trigger
  const handleMarkRead = async () => {
    if (!currentUser || !selectedChatId) return;
    try {
      await fetch(`/api/chats/${selectedChatId}/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId: currentUser.id })
      });
    } catch (err) {
      console.error("Gagal menandai dibaca:", err);
    }
  };

  // Delete message API trigger
  const handleDeleteMessage = async (messageId: string, deleteForEveryone: boolean) => {
    if (!currentUser || !selectedChatId) return;
    try {
      const response = await fetch(`/api/chats/${selectedChatId}/delete-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messageId,
          userId: currentUser.id,
          deleteForEveryone
        })
      });

      if (response.ok) {
        const data = await response.json();
        const updatedMsg = data.message;
        setMessages(prev => prev.map(m => m.id === messageId ? updatedMsg : m).filter(m => !m.deletedFor.includes(currentUser.id)));
      }
    } catch (err) {
      console.error("Gagal menghapus pesan:", err);
    }
  };

  // React to message API trigger
  const handleReactToMessage = async (messageId: string, emoji: string) => {
    if (!currentUser || !selectedChatId) return;
    try {
      const response = await fetch(`/api/chats/${selectedChatId}/messages/${messageId}/react`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: currentUser.id,
          emoji
        })
      });

      if (response.ok) {
        const data = await response.json();
        const updatedMsg = data.message;
        setMessages(prev => prev.map(m => m.id === messageId ? updatedMsg : m));
      }
    } catch (err) {
      console.error("Gagal mengirim emosi:", err);
    }
  };

  // HTML5 Browser Notification trigger helper
  const showBrowserNotification = (title: string, body: string, iconUrl?: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const options: NotificationOptions = {
          body,
          icon: iconUrl || "/favicon.ico",
          tag: "line-chat-new-msg",
          silent: true, // We already play a custom chime sound
        };
        new Notification(title, options);
      } catch (err) {
        console.error("Gagal mengirim notifikasi browser:", err);
      }
    }
  };

  // Request browser Notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Update browser tab title with total unread counts
  useEffect(() => {
    if (!currentUser) {
      document.title = "WB TEAM CHAT";
      return;
    }
    const isGroupOnly = currentUser.role === "CS LC" || currentUser.role === "KASIR";
    const totalUnread = chats.reduce((sum, chat) => {
      if (isGroupOnly && !chat.isGroup) return sum;
      const unreadCount = messages.filter(
        (m) => m.chatId === chat.id && !m.readBy.includes(currentUser.id) && !m.deletedFor.includes(currentUser.id)
      ).length;
      return sum + unreadCount;
    }, 0);

    if (totalUnread > 0) {
      document.title = `(${totalUnread}) WB TEAM CHAT`;
    } else {
      document.title = "WB TEAM CHAT";
    }
  }, [chats, messages, currentUser]);

  // Typing indicator API trigger
  const handleSendTypingStatus = async (isTyping: boolean) => {
    if (!currentUser || !selectedChatId) return;
    try {
      await fetch(`/api/chats/${selectedChatId}/typing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: currentUser.id,
          isTyping
        })
      });
    } catch (err) {
      console.error("Gagal menyiarkan status mengetik:", err);
    }
  };

  // Open Call modal handler
  const handleOpenCall = (isVideo: boolean) => {
    if (!selectedChatId || !currentUser) return;
    const activeChat = chats.find(c => c.id === selectedChatId);
    if (!activeChat || activeChat.isGroup) return;

    const otherMemberId = activeChat.members.find(id => id !== currentUser.id) || currentUser.id;
    const partnerUser = allUsers.find(u => u.id === otherMemberId);

    if (partnerUser) {
      setActiveCall({ isVideo, partner: partnerUser });
    }
  };

  // Group Management callbacks (InfoPanel relays)
  const handleUpdateGroup = async (name: string, avatar: string, description: string) => {
    if (!selectedChatId || !currentUser) return;
    try {
      const response = await fetch(`/api/chats/${selectedChatId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name,
          avatar,
          description,
          userId: currentUser.id
        })
      });

      if (response.ok) {
        const updatedChat = await response.json();
        setChats(prev => prev.map(c => c.id === selectedChatId ? updatedChat : c));
        toast.success("Info grup berhasil diperbarui!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Gagal mengubah info grup.");
      }
    } catch (err) {
      console.error("Gagal merubah info grup:", err);
    }
  };

  const handleAddMembers = async (memberIds: string[]) => {
    if (!selectedChatId || !currentUser) return;
    try {
      const response = await fetch(`/api/chats/${selectedChatId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          memberIds,
          userId: currentUser.id
        })
      });

      if (response.ok) {
        const updatedChat = await response.json();
        setChats(prev => prev.map(c => c.id === selectedChatId ? updatedChat : c));
      }
    } catch (err) {
      console.error("Gagal mengundang anggota:", err);
    }
  };

  const handleRemoveMember = async (targetMemberId: string) => {
    if (!selectedChatId || !currentUser) return;
    try {
      const response = await fetch(`/api/chats/${selectedChatId}/members`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetMemberId,
          userId: currentUser.id
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (targetMemberId === currentUser.id) {
          // I left the group, clear chat selection
          setSelectedChatId(null);
          setMessages([]);
          setShowInfoPanel(false);
          setMobileView('sidebar');
          setChats(prev => prev.filter(c => c.id !== selectedChatId));
        } else {
          setChats(prev => prev.map(c => c.id === selectedChatId ? data.chat : c));
        }
      }
    } catch (err) {
      console.error("Gagal mengeluarkan anggota:", err);
    }
  };

  const handlePromoteAdmin = async (targetMemberId: string) => {
    if (!selectedChatId || !currentUser) return;
    try {
      const response = await fetch(`/api/chats/${selectedChatId}/admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          targetMemberId,
          userId: currentUser.id
        })
      });

      if (response.ok) {
        const updatedChat = await response.json();
        setChats(prev => prev.map(c => c.id === selectedChatId ? updatedChat : c));
      }
    } catch (err) {
      console.error("Gagal menyetel admin:", err);
    }
  };

  const handleDeleteGroup = async () => {
    if (!selectedChatId || !currentUser) return;
    try {
      const response = await fetch(`/api/chats/${selectedChatId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          userId: currentUser.id
        })
      });

      if (response.ok) {
        setSelectedChatId(null);
        setMessages([]);
        setShowInfoPanel(false);
        setMobileView('sidebar');
        setChats(prev => prev.filter(c => c.id !== selectedChatId));
      }
    } catch (err) {
      console.error("Gagal membubarkan grup:", err);
    }
  };

  const handleToggleArchive = async () => {
    if (!selectedChatId || !currentUser) return;
    try {
      const res = await fetch(`/api/chats/${selectedChatId}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (res.ok) {
        const data = await res.json();
        setChats(prev => prev.map(c => c.id === selectedChatId ? data.chat : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleMute = async () => {
    if (!selectedChatId || !currentUser) return;
    try {
      const res = await fetch(`/api/chats/${selectedChatId}/mute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (res.ok) {
        const data = await res.json();
        setChats(prev => prev.map(c => c.id === selectedChatId ? data.chat : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Open profile editing modal
  const handleOpenProfileEdit = () => {
    if (!currentUser) return;
    setEditProfileName(currentUser.name);
    setEditProfileStatus(currentUser.statusMessage || "");
    setEditProfileAvatar(currentUser.avatar);
    setEditProfilePassword("");
    setEditProfileConfirmPassword("");
    setEditProfilePasswordError("");
    setShowProfileEditModal(true);
  };

  // Save profile edits to backend
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !editProfileName.trim()) return;

    if (editProfilePassword) {
      if (editProfilePassword !== editProfileConfirmPassword) {
        setEditProfilePasswordError("Konfirmasi kata sandi tidak cocok.");
        return;
      }
      if (editProfilePassword.length < 4) {
        setEditProfilePasswordError("Kata sandi minimal harus 4 karakter.");
        return;
      }
    }

    try {
      const response = await fetch(`/api/users/${currentUser.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: editProfileName.trim(),
          avatar: editProfileAvatar,
          statusMessage: editProfileStatus.trim(),
          password: editProfilePassword || undefined
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCurrentUser(data.user);
        localStorage.setItem("line_user", JSON.stringify(data.user));
        setShowProfileEditModal(false);
        toast.success("Profil Anda berhasil diperbarui!");
        fetchAllData();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Gagal memperbarui profil.");
      }
    } catch (err) {
      console.error("Gagal memperbarui profil:", err);
      toast.error("Terjadi kesalahan jaringan.");
    }
  };

  // Rendering check
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Find currently opened chat
  const activeChat = chats.find(c => c.id === selectedChatId) || null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-transparent text-white font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* 3-Column Main Dashboard Structure */}
      <div className="flex w-full h-full relative">
        
        {/* COLUMN 1: LEFT SIDEBAR (Hide on mobile if active chat is open) */}
        <div className={`h-full shrink-0 z-10 ${mobileView === 'chat' ? 'hidden md:flex' : 'w-full md:w-auto'}`}>
          <ChatListSidebar
            currentUser={currentUser}
            allUsers={allUsers}
            chats={chats}
            messages={messages}
            selectedChatId={selectedChatId}
            onSelectChat={handleSelectChat}
            onOpenCreateGroup={() => setShowGroupModal(true)}
            onLogout={handleLogout}
            onEditProfile={handleOpenProfileEdit}
            onTriggerRefresh={fetchAllData}
            onOpenAdminPanel={() => setShowAdminPanelModal(true)}
          />
        </div>

        {/* COLUMN 2: CENTER CHAT AREA (Hide on mobile if viewing sidebar) */}
        <div className={`h-full flex-1 z-10 ${mobileView === 'sidebar' ? 'hidden md:flex' : 'w-full'}`}>
          <ChatArea
            currentUser={currentUser}
            chat={activeChat}
            messages={messages.filter(m => m.chatId === selectedChatId)}
            allUsers={allUsers}
            typingStatuses={typingStatuses}
            onSendMessage={handleSendMessage}
            onMarkRead={handleMarkRead}
            onDeleteMessage={handleDeleteMessage}
            onReactToMessage={handleReactToMessage}
            onSendTypingStatus={handleSendTypingStatus}
            onOpenCall={handleOpenCall}
            onToggleInfoPanel={() => setShowInfoPanel(!showInfoPanel)}
            onBackToSidebar={() => setMobileView('sidebar')}
          />
        </div>

        {/* COLUMN 3: RIGHT SLIDE-IN INFO PANEL (Sidebar drawer style) */}
        <AnimatePresence>
          {showInfoPanel && activeChat && (
            <motion.div
              initial={{ opacity: 0, x: 280 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 280 }}
              transition={{ type: "tween", duration: 0.25 }}
              className="absolute md:static right-0 top-0 bottom-0 z-20 h-full shadow-2xl md:shadow-none"
            >
              <InfoPanel
                currentUser={currentUser}
                chat={activeChat}
                allUsers={allUsers}
                onClose={() => setShowInfoPanel(false)}
                onUpdateGroup={handleUpdateGroup}
                onAddMembers={handleAddMembers}
                onRemoveMember={handleRemoveMember}
                onPromoteAdmin={handlePromoteAdmin}
                onDeleteGroup={handleDeleteGroup}
                onToggleArchive={handleToggleArchive}
                onToggleMute={handleToggleMute}
              />
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* --- FLOATING MODALS AND OVERLAYS --- */}

      {/* Group Creation Modal */}
      <AnimatePresence>
        {showGroupModal && (
          <GroupModal
            currentUser={currentUser}
            onClose={() => setShowGroupModal(false)}
            onGroupCreated={(newGroupId) => {
              fetchAllData();
              handleSelectChat(newGroupId);
            }}
          />
        )}
      </AnimatePresence>

      {/* Profile Edit Modal */}
      <AnimatePresence>
        {showProfileEditModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/15 max-w-sm w-full overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="bg-white/5 border-b border-white/10 p-5 text-white flex justify-between items-center shrink-0">
                <h3 className="font-bold text-sm">Edit Profil Saya</h3>
                <button onClick={() => setShowProfileEditModal(false)} className="text-white/80 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <form onSubmit={handleSaveProfile} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                {/* Avatar select preview */}
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-indigo-500 mx-auto shadow bg-white/5">
                    <img src={editProfileAvatar} alt="" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">Foto Profil Aktif</p>
                </div>

                {/* Custom File Upload Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-white/60 block">Atau Unggah Foto Profil Sendiri</label>
                  <label className="w-full flex items-center justify-center gap-2 border border-white/10 border-dashed rounded-xl py-2 px-3 text-xs bg-white/5 hover:bg-white/10 text-white/80 hover:text-white cursor-pointer transition-all">
                    <RefreshCw className={`w-4 h-4 text-indigo-400 ${isUploadingAvatar ? 'animate-spin' : ''}`} />
                    <span>{isUploadingAvatar ? "Sedang Mengunggah..." : "Pilih & Unggah Berkas Foto"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadAvatar}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="space-y-3 pt-2">
                  {/* Tampilkan Email dan Username */}
                  <div className="grid grid-cols-2 gap-2 text-left">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">ID Pengguna (Username)</label>
                      <div className="w-full border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white/50 bg-white/2 select-all font-mono truncate">
                        @{currentUser.username}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block">Alamat Surel (Email)</label>
                      <div className="w-full border border-white/5 rounded-xl px-2.5 py-1.5 text-xs text-white/50 bg-white/2 select-all truncate font-medium" title={currentUser.email}>
                        {currentUser.email}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-white/60">Nama Tampilan</label>
                    <input
                      type="text"
                      required
                      value={editProfileName}
                      onChange={(e) => setEditProfileName(e.target.value)}
                      className="w-full border border-white/10 rounded-xl px-3 py-2 text-xs text-white bg-white/5 focus:outline-none focus:border-indigo-400 focus:bg-white/10"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-white/60">Pesan Status</label>
                    <input
                      type="text"
                      value={editProfileStatus}
                      onChange={(e) => setEditProfileStatus(e.target.value)}
                      placeholder="Apa kesibukan Anda hari ini?"
                      className="w-full border border-white/10 rounded-xl px-3 py-2 text-xs text-white bg-white/5 focus:outline-none focus:border-indigo-400 focus:bg-white/10"
                    />
                  </div>

                  {/* Bagian Ubah Kata Sandi */}
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <h4 className="text-xs font-bold text-indigo-400">Ubah Kata Sandi (Opsional)</h4>
                    
                    {editProfilePasswordError && (
                      <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] font-medium text-red-400">
                        {editProfilePasswordError}
                      </div>
                    )}
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-white/60">Kata Sandi Baru</label>
                      <input
                        type="password"
                        placeholder="Masukkan kata sandi baru"
                        value={editProfilePassword}
                        onChange={(e) => {
                          setEditProfilePassword(e.target.value);
                          setEditProfilePasswordError("");
                        }}
                        className="w-full border border-white/10 rounded-xl px-3 py-2 text-xs text-white bg-white/5 focus:outline-none focus:border-indigo-400 focus:bg-white/10"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-white/60">Konfirmasi Kata Sandi Baru</label>
                      <input
                        type="password"
                        placeholder="Ulangi kata sandi baru"
                        value={editProfileConfirmPassword}
                        onChange={(e) => {
                          setEditProfileConfirmPassword(e.target.value);
                          setEditProfilePasswordError("");
                        }}
                        className="w-full border border-white/10 rounded-xl px-3 py-2 text-xs text-white bg-white/5 focus:outline-none focus:border-indigo-400 focus:bg-white/10"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowProfileEditModal(false)}
                    className="w-1/2 border border-white/10 text-white/80 rounded-xl py-2 text-xs font-bold hover:bg-white/10 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 bg-indigo-600 text-white rounded-xl py-2 text-xs font-bold hover:bg-indigo-500 cursor-pointer shadow flex items-center justify-center gap-1"
                  >
                    <Check className="w-4 h-4" /> Simpan Profil
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Panel Modal */}
      <AnimatePresence>
        {showAdminPanelModal && (
          <AdminPanelModal
            currentUser={currentUser}
            allUsers={allUsers}
            onClose={() => setShowAdminPanelModal(false)}
            onRefreshUsers={fetchAllData}
          />
        )}
      </AnimatePresence>

      {/* Call Simulation Ringing/Active Screen Overlay */}
      <AnimatePresence>
        {activeCall && (
          <CallModal
            partner={activeCall.partner}
            isVideo={activeCall.isVideo}
            onClose={() => setActiveCall(null)}
          />
        )}
      </AnimatePresence>

      {/* Floating Global Banner Notification for Incoming Messages */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -80, scale: 0.9 }}
            animate={{ opacity: 1, y: 16, scale: 1 }}
            exit={{ opacity: 0, y: -80, scale: 0.9 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
          >
            <div className="bg-slate-950/90 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-3 shadow-indigo-500/5 hover:brightness-105 transition-all">
              {notification.avatar ? (
                <img src={notification.avatar} className="w-10 h-10 rounded-xl object-cover border border-white/10 bg-white/5" />
              ) : (
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><MessageCircle className="w-5 h-5" /></div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black tracking-tight text-indigo-400 uppercase truncate">Pesan Baru</p>
                <p className="text-xs font-extrabold truncate mt-0.5">{notification.title}</p>
                <p className="text-[10px] text-white/70 truncate font-medium mt-0.5 opacity-90">"{notification.body}"</p>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer transition-all self-start"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[60] bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/15 max-w-sm w-full overflow-hidden p-6 text-center"
            >
              <div className="w-12 h-12 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                <LogOut className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-sm text-white mb-2">Konfirmasi Keluar</h3>
              <p className="text-xs text-white/60 mb-6 leading-relaxed">
                Apakah Anda yakin ingin keluar dari akun ini? Anda perlu masuk kembali untuk menerima pesan.
              </p>
              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="w-1/2 border border-white/10 text-white/80 hover:text-white hover:bg-white/5 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLogout}
                  className="w-1/2 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-red-500/10"
                >
                  Keluar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
