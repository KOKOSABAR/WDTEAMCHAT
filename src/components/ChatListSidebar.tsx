import React, { useState, useEffect } from "react";
import { User, Chat, Message } from "../types.ts";
import { Search, Plus, MessageSquarePlus, Users, Archive, LogOut, Settings, User as UserIcon, Bell, BellOff, MoreVertical, CheckCheck, RefreshCw, Pin, Database, Cloud } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface ChatListSidebarProps {
  currentUser: User;
  allUsers: User[];
  chats: Chat[];
  messages: Message[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onOpenCreateGroup: () => void;
  onLogout: () => void;
  onEditProfile: () => void;
  onTriggerRefresh: () => void;
  onOpenAdminPanel: () => void;
}

export default function ChatListSidebar({
  currentUser,
  allUsers,
  chats,
  messages,
  selectedChatId,
  onSelectChat,
  onOpenCreateGroup,
  onLogout,
  onEditProfile,
  onTriggerRefresh,
  onOpenAdminPanel
}: ChatListSidebarProps) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [showNewChatDropdown, setShowNewChatDropdown] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'all' | 'archived'>('all');
  const [chatFilter, setChatFilter] = useState<'all' | 'friends' | 'groups'>('all');
  const [supabaseStatus, setSupabaseStatus] = useState<{ isConnected: boolean; supabaseUrl: string; usingFallback: boolean } | null>(null);

  const fetchSupabaseStatus = async () => {
    try {
      const res = await fetch("/api/supabase/status");
      if (res.ok) {
        const data = await res.json();
        setSupabaseStatus(data);
      }
    } catch (err) {
      console.error("Gagal memuat status Supabase:", err);
    }
  };

  useEffect(() => {
    fetchSupabaseStatus();
  }, [chats]);

  const isGroupOnly = currentUser.role === "CS LC" || currentUser.role === "KASIR";

  // Calculate unread messages count for each chat
  const getUnreadCount = (chatId: string) => {
    return messages.filter(
      (m) => m.chatId === chatId && !m.readBy.includes(currentUser.id) && !m.deletedFor.includes(currentUser.id)
    ).length;
  };

  // Get unread count for filter categories
  const getFilterUnreadCount = (filter: 'all' | 'friends' | 'groups') => {
    return chats
      .filter((chat) => {
        if (isGroupOnly && !chat.isGroup) return false;
        const isArchived = chat.archivedBy.includes(currentUser.id);
        const matchesTab = activeTab === 'all' ? !isArchived : isArchived;
        
        const matchesFilter = 
          filter === 'all' ? true :
          filter === 'friends' ? !chat.isGroup :
          chat.isGroup;
        
        return matchesTab && matchesFilter;
      })
      .reduce((sum, chat) => sum + getUnreadCount(chat.id), 0);
  };

  // Get total unread count for tabs
  const totalAllUnread = chats
    .filter(chat => {
      if (isGroupOnly && !chat.isGroup) return false;
      return !chat.archivedBy.includes(currentUser.id);
    })
    .reduce((sum, chat) => sum + getUnreadCount(chat.id), 0);

  const totalArchivedUnread = chats
    .filter(chat => {
      if (isGroupOnly && !chat.isGroup) return false;
      return chat.archivedBy.includes(currentUser.id);
    })
    .reduce((sum, chat) => sum + getUnreadCount(chat.id), 0);

  // Get last message details for each chat
  const getLastMessage = (chatId: string) => {
    const chatMsgs = messages.filter((m) => m.chatId === chatId && !m.deletedFor.includes(currentUser.id));
    if (chatMsgs.length === 0) return null;
    return chatMsgs[chatMsgs.length - 1];
  };

  // Format delivery time elegantly (LINE style)
  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
      }
      return date.toLocaleDateString("id-ID", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  // Start direct personal chat with a selected user
  const handleStartPersonalChat = async (targetUser: User) => {
    setShowNewChatDropdown(false);
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isGroup: false,
          members: [currentUser.id, targetUser.id],
          createdBy: currentUser.id
        })
      });

      if (response.ok) {
        const newChat = await response.json();
        onTriggerRefresh();
        onSelectChat(newChat.id);
      }
    } catch (err) {
      console.error("Gagal memulai chat personal:", err);
    }
  };

  const handleTogglePin = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/chats/${chatId}/pin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ userId: currentUser.id })
      });
      if (response.ok) {
        onTriggerRefresh();
      }
    } catch (err) {
      console.error("Gagal pin chat:", err);
    }
  };

  // Determine chat name, avatar, and partner's online status
  const getChatMetadata = (chat: Chat) => {
    if (chat.isGroup) {
      return {
        name: chat.name,
        avatar: chat.avatar,
        isOnline: false
      };
    } else {
      const otherMemberId = chat.members.find((id) => id !== currentUser.id) || currentUser.id;
      const partner = allUsers.find((u) => u.id === otherMemberId);
      return {
        name: partner ? partner.name : chat.name,
        avatar: partner ? partner.avatar : chat.avatar,
        isOnline: partner ? partner.isOnline : false
      };
    }
  };

  // Filter chats based on tab (all vs archived) and search query
  const filteredChats = chats
    .filter((chat) => {
      if (isGroupOnly && !chat.isGroup) return false;

      const isArchived = chat.archivedBy.includes(currentUser.id);
      const matchesTab = activeTab === 'all' ? !isArchived : isArchived;
      
      const meta = getChatMetadata(chat);
      const matchesSearch = meta.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilter = 
        chatFilter === 'all' ? true :
        chatFilter === 'friends' ? !chat.isGroup :
        chat.isGroup;
      
      return matchesTab && matchesSearch && matchesFilter;
    })
    // Sort chats by pin status first, then by last message timestamp (most recent first)
    .sort((a, b) => {
      const isPinnedA = a.pinnedBy?.includes(currentUser.id) ? 1 : 0;
      const isPinnedB = b.pinnedBy?.includes(currentUser.id) ? 1 : 0;
      if (isPinnedA !== isPinnedB) {
        return isPinnedB - isPinnedA;
      }
      const lastA = getLastMessage(a.id);
      const lastB = getLastMessage(b.id);
      const timeA = lastA ? new Date(lastA.createdAt).getTime() : 0;
      const timeB = lastB ? new Date(lastB.createdAt).getTime() : 0;
      return timeB - timeA;
    });

  return (
    <div className="w-full md:w-80 border-r border-white/10 flex flex-col bg-white/5 h-full relative shrink-0 backdrop-blur-md">
      
      {/* Sidebar Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/10 shrink-0">
        <div className="flex items-center gap-3">
          {/* User profile picture with click menu */}
          <div className="relative group cursor-pointer" onClick={() => setShowDropdown(!showDropdown)}>
            <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-indigo-500 shadow-sm bg-white/5 transition-all hover:brightness-110">
              <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
            </div>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-indigo-500 border-2 border-[#0d111a] rounded-full"></span>
          </div>
          <div className="max-w-[140px]">
            <h4 className="text-sm font-bold text-white truncate">{currentUser.name}</h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[8px] px-1.5 py-0.5 rounded-md font-extrabold uppercase tracking-wider">
                {currentUser.role || "CS LINE"}
              </span>
            </div>
          </div>
        </div>

        {/* Dropdown triggers */}
        <div className="flex items-center gap-1">
          {/* Force manual refresh */}
          <button
            onClick={onTriggerRefresh}
            title="Sinkronisasi Data"
            className="p-1.5 text-white/60 hover:text-indigo-400 rounded-lg hover:bg-white/10 cursor-pointer transition-all active:rotate-180 duration-500"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer transition-all"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Main dropdown */}
            <AnimatePresence>
              {showDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)}></div>
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-white/5"
                  >
                    <div className="px-4 py-2 bg-black/20">
                      <p className="text-[10px] text-white/50 uppercase font-semibold">Akun Saya</p>
                      <p className="text-xs font-bold text-white truncate mt-0.5">@{currentUser.username}</p>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={() => { setShowDropdown(false); onOpenAdminPanel(); }}
                        className="w-full text-left px-4 py-2.5 text-xs text-white/80 hover:bg-white/10 transition-all cursor-pointer flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4 text-indigo-400" /> Panel Admin
                      </button>
                      <button
                        onClick={() => { setShowDropdown(false); onEditProfile(); }}
                        className="w-full text-left px-4 py-2.5 text-xs text-white/80 hover:bg-white/10 transition-all cursor-pointer flex items-center gap-2"
                      >
                        <UserIcon className="w-4 h-4 text-indigo-400" /> Edit Profil
                      </button>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={onLogout}
                        className="w-full text-left px-4 py-2.5 text-xs text-red-400 hover:bg-red-500/10 transition-all cursor-pointer flex items-center gap-2 font-semibold"
                      >
                        <LogOut className="w-4 h-4" /> Keluar Akun
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Tabs list (Semua Chat vs Arsip Chat) */}
      <div className="px-4 pt-3 flex border-b border-white/10 bg-white/5 gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex-1 text-center pb-2 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center justify-center gap-1.5 ${activeTab === 'all' ? 'border-indigo-400 text-indigo-400 font-extrabold' : 'border-transparent text-white/50 hover:text-white'}`}
        >
          <span>Semua Chat</span>
          {totalAllUnread > 0 && (
            <span className="bg-indigo-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[16px] text-center shadow-sm">
              {totalAllUnread}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('archived')}
          className={`flex-1 text-center pb-2 text-xs font-bold border-b-2 cursor-pointer transition-all flex items-center justify-center gap-1.5 ${activeTab === 'archived' ? 'border-indigo-400 text-indigo-400 font-extrabold' : 'border-transparent text-white/50 hover:text-white'}`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Arsip Chat</span>
          {totalArchivedUnread > 0 && (
            <span className="bg-slate-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[16px] text-center shadow-sm">
              {totalArchivedUnread}
            </span>
          )}
        </button>
      </div>

      {/* Search and Action Row */}
      <div className="p-3 bg-transparent space-y-2 shrink-0 border-b border-white/5">
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/40" />
            <input
              type="text"
              placeholder="Cari chat atau teman..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/10 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-white/40 focus:outline-none focus:border-indigo-400 focus:bg-white/20 transition-all"
            />
          </div>

          {/* New Chat Triggers */}
          {!isGroupOnly ? (
            <div className="relative">
              <button
                onClick={() => setShowNewChatDropdown(!showNewChatDropdown)}
                title="Mulai Chat / Grup Baru"
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md cursor-pointer transition-all flex items-center justify-center"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
              </button>

              {/* New Chat Dropdown Popover */}
              <AnimatePresence>
                {showNewChatDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowNewChatDropdown(false)}></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-56 bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl z-20 overflow-hidden divide-y divide-white/5"
                    >
                      <div className="p-2.5 bg-black/20">
                        <p className="text-[10px] text-white/50 uppercase font-semibold">Chat Baru</p>
                      </div>
                      {/* Action: Create Group */}
                      <div className="p-1">
                        <button
                          onClick={() => { setShowNewChatDropdown(false); onOpenCreateGroup(); }}
                          className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/10 rounded-lg transition-all cursor-pointer flex items-center gap-2 font-medium"
                        >
                          <Users className="w-4 h-4 text-indigo-400" /> Buat Grup Chat
                        </button>
                      </div>
                      {/* Contacts select for Personal Chat */}
                      <div className="p-1 max-h-48 overflow-y-auto custom-scrollbar">
                        <p className="px-3 py-1.5 text-[9px] text-white/40 font-semibold tracking-wider uppercase">Pilih Kontak Teman</p>
                        {allUsers
                          .filter(u => u.id !== currentUser.id)
                          .map(user => (
                            <button
                              key={user.id}
                              onClick={() => handleStartPersonalChat(user)}
                              className="w-full text-left px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 rounded-lg transition-all cursor-pointer flex items-center gap-2.5"
                            >
                              <div className="relative w-6 h-6 rounded-full overflow-hidden border border-white/10 bg-white/5 shrink-0">
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                              </div>
                              <div className="truncate">
                                <p className="font-semibold truncate text-[11px] text-white">{user.name}</p>
                                <span className="text-[9px] text-white/40 block">@{user.username}</span>
                              </div>
                            </button>
                          ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="text-[10px] text-indigo-400 font-extrabold bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/20 shadow-sm uppercase tracking-wider">
              Khusus Grup
            </div>
          )}
        </div>
      </div>

      {/* Category Sub-Tabs (All, Friends, Groups) */}
      <div className="px-5 py-2.5 flex items-center gap-6 border-b border-white/5 shrink-0 select-none">
        {[
          { id: "all", label: "All" },
          { id: "friends", label: "Friends" },
          { id: "groups", label: "Groups" }
        ].map((tab) => {
          const isActive = chatFilter === tab.id;
          const unreadCount = getFilterUnreadCount(tab.id as any);
          return (
            <button
              key={tab.id}
              onClick={() => setChatFilter(tab.id as any)}
              className="relative pb-1 text-[13px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span className={isActive ? "text-white" : "text-white/40 hover:text-white"}>
                {tab.label}
              </span>
              {unreadCount > 0 && (
                <span className="bg-indigo-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full min-w-[16px] text-center shadow-sm">
                  {unreadCount}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="activeSubTabLine"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Chat List Scroll Container */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5 px-1.5 pb-3 custom-scrollbar">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-xs">
            {searchQuery ? "Tidak ada obrolan ditemukan." : activeTab === 'archived' ? "Tidak ada chat yang diarsipkan." : "Mulai obrolan baru dengan mengklik tanda plus!"}
          </div>
        ) : (
          filteredChats.map((chat) => {
            const meta = getChatMetadata(chat);
            const lastMsg = getLastMessage(chat.id);
            const unreadCount = getUnreadCount(chat.id);
            const isMuted = chat.mutedBy.includes(currentUser.id);
            const isSelected = selectedChatId === chat.id;
            const isPinned = chat.pinnedBy?.includes(currentUser.id);

            // Prepare last message preview text
            let msgPreview = "Belum ada pesan.";
            if (lastMsg) {
              if (lastMsg.deletedForEveryone) {
                msgPreview = "Pesan telah dihapus";
              } else if (lastMsg.type === "sticker") {
                msgPreview = "🎨 Kirim Stiker";
              } else if (lastMsg.type === "image") {
                msgPreview = "📷 Kirim Foto";
              } else if (lastMsg.type === "file") {
                msgPreview = `📁 File: ${lastMsg.fileName || 'Lampiran'}`;
              } else if (lastMsg.type === "voice") {
                msgPreview = "🎙️ Pesan Suara";
              } else {
                msgPreview = lastMsg.text;
              }
            }

            return (
              <div
                key={chat.id}
                onClick={() => onSelectChat(chat.id)}
                className={`w-full p-3 flex items-center gap-3 transition-all text-left cursor-pointer rounded-xl mb-1 group ${isSelected ? 'active-chat' : 'hover:bg-white/5 border-l-4 border-transparent'}`}
              >
                {/* Profile Photo Icon with Online status */}
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 bg-white/5 shadow-sm flex items-center justify-center">
                    {meta.avatar ? (
                      <img src={meta.avatar} alt={meta.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-xs uppercase">
                        {chat.isGroup ? <Users className="w-5 h-5 text-white/90" /> : meta.name.slice(0, 2)}
                      </div>
                    )}
                  </div>
                  {meta.isOnline && !chat.isGroup && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-indigo-500 border-2 border-[#0d111a] rounded-full"></span>
                  )}
                </div>

                {/* Text description */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h5 className="text-xs font-extrabold text-white truncate flex items-center gap-1.5">
                      {chat.isGroup && <span className="bg-indigo-500/20 text-indigo-300 text-[8px] px-1 rounded font-black shrink-0 uppercase tracking-wider">Group</span>}
                      {meta.name}
                    </h5>
                    <span className="text-[9px] text-white/50 font-medium shrink-0">
                      {lastMsg ? formatTime(lastMsg.createdAt) : ""}
                    </span>
                  </div>

                  {/* Last message and read receipts / mute status */}
                  <div className="flex justify-between items-center gap-2">
                    <p className={`text-[11px] truncate flex-1 ${unreadCount > 0 ? 'text-indigo-300 font-extrabold' : 'text-white/70 font-medium'}`}>
                      {msgPreview}
                    </p>
                    
                    {/* Icons and Badges */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleTogglePin(e, chat.id)}
                        className={`p-1 rounded hover:bg-white/10 transition-all ${isPinned ? 'text-indigo-400' : 'text-white/30 hover:text-white opacity-0 group-hover:opacity-100'}`}
                        title={isPinned ? "Lepas Pin Obrolan" : "Sematkan Obrolan"}
                      >
                        <Pin className={`w-3.5 h-3.5 ${isPinned ? 'fill-indigo-400/20 rotate-45 text-indigo-400' : ''}`} />
                      </button>
                      {isMuted && <BellOff className="w-3 h-3 text-white/40" />}
                      {unreadCount > 0 ? (
                        <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-black min-w-[18px] text-center shadow-sm">
                          {unreadCount}
                        </span>
                      ) : lastMsg && lastMsg.senderId === currentUser.id && !lastMsg.deletedForEveryone && (
                        // Checkmarks if self last message was read
                        <CheckCheck className={`w-3.5 h-3.5 ${lastMsg.readBy.length > 1 ? 'text-indigo-400' : 'text-white/30'}`} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
