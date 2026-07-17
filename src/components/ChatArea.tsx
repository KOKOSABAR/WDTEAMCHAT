import React, { useState, useEffect, useRef } from "react";
import { User, Chat, Message, Sticker } from "../types.ts";
import { Sidebar, Paperclip, Smile, Send, X, ArrowLeft, Trash2, Reply, Play, Pause, Mic, Square, Download, FileText, CheckCircle, Users } from "lucide-react";
import StickerPicker from "./StickerPicker.tsx";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "./Toast.tsx";

interface ChatAreaProps {
  currentUser: User;
  chat: Chat | null;
  messages: Message[];
  allUsers: User[];
  typingStatuses: { [userId: string]: boolean };
  onSendMessage: (text: string, type: 'text' | 'sticker' | 'image' | 'file' | 'voice', mediaUrl?: string, fileName?: string, fileSize?: string, replyTo?: any) => void;
  onMarkRead: () => void;
  onDeleteMessage: (messageId: string, deleteForEveryone: boolean) => void;
  onReactToMessage: (messageId: string, emoji: string) => void;
  onSendTypingStatus: (isTyping: boolean) => void;
  onOpenCall: (isVideo: boolean) => void;
  onToggleInfoPanel: () => void;
  onBackToSidebar: () => void; // for mobile layout
}

export default function ChatArea({
  currentUser,
  chat,
  messages,
  allUsers,
  typingStatuses,
  onSendMessage,
  onMarkRead,
  onDeleteMessage,
  onReactToMessage,
  onSendTypingStatus,
  onOpenCall,
  onToggleInfoPanel,
  onBackToSidebar
}: ChatAreaProps) {
  const toast = useToast();
  const [inputText, setInputText] = useState<string>("");
  const [showStickerPicker, setShowStickerPicker] = useState<boolean>(false);
  const [repliedMsg, setRepliedMsg] = useState<Message | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [activeReactionMenuId, setActiveReactionMenuId] = useState<string | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  
  // Voice note states
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const recordingTimerRef = useRef<any>(null);

  // File Upload state
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Audio player state for voice notes
  const [playingVoiceMsgId, setPlayingVoiceMsgId] = useState<string | null>(null);
  const [voicePlaybackSeconds, setVoicePlaybackSeconds] = useState<number>(0);
  const playbackTimerRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  // Mark chat as read and scroll down whenever room or messages change
  useEffect(() => {
    if (chat) {
      onMarkRead();
      scrollToBottom();
    }
  }, [chat, messages.length]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  // Click away to close reaction menu
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveReactionMenuId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  // Handle typing status broadcast with debouncing
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    
    onSendTypingStatus(true);
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      onSendTypingStatus(false);
    }, 2500);
  };

  // Send message handler
  const handleSendText = () => {
    if (!inputText.trim()) return;

    let replyPayload = undefined;
    if (repliedMsg) {
      replyPayload = {
        id: repliedMsg.id,
        senderName: repliedMsg.senderName,
        text: repliedMsg.text,
        type: repliedMsg.type
      };
    }

    onSendMessage(inputText.trim(), 'text', undefined, undefined, undefined, replyPayload);
    setInputText("");
    setRepliedMsg(null);
    onSendTypingStatus(false);
    
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Send Sticker
  const handleSelectSticker = (sticker: Sticker) => {
    onSendMessage(sticker.emoji, 'sticker');
    setShowStickerPicker(false);
  };

  // Add emoji to cursor position
  const handleSelectEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
  };

  // Attachments Upload (Image/File)
  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const fileData = reader.result as string;
        
        // Call upload endpoint
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileData
          })
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.success && uploadData.fileUrl) {
          const isImage = file.type.startsWith("image/");
          
          // Calculate readable file size
          const sizeKb = (file.size / 1024).toFixed(1);
          const sizeStr = parseFloat(sizeKb) > 1000 ? `${(parseFloat(sizeKb)/1024).toFixed(1)} MB` : `${sizeKb} KB`;

          onSendMessage(
            isImage ? "📷 Mengirim foto" : `📁 File: ${file.name}`,
            isImage ? 'image' : 'file',
            uploadData.fileUrl,
            file.name,
            sizeStr
          );
          toast.success("Berkas berhasil diunggah!");
        } else {
          toast.error(uploadData.error || "Gagal mengunggah berkas.");
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Gagal melampirkan file:", err);
      setIsUploading(false);
    }
  };

  // Voice Note Simulation
  const handleToggleVoiceRecord = () => {
    if (isRecording) {
      // Stop recording and send
      clearInterval(recordingTimerRef.current);
      setIsRecording(false);
      
      const minutes = Math.floor(recordingSeconds / 60);
      const secs = recordingSeconds % 60;
      const durationStr = `${minutes}:${secs.toString().padStart(2, '0')}`;
      
      // Send simulated voice note URL (representing empty pitch buffer)
      onSendMessage(`🎙️ Pesan Suara (${durationStr})`, 'voice', "simulated_audio_url", `VoiceNote_${Date.now()}.mp3`, durationStr);
      setRecordingSeconds(0);
    } else {
      // Start recording timer
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    }
  };

  // Play/Pause simulated voice notes
  const handlePlayVoice = (msgId: string, durationStr: string) => {
    if (playingVoiceMsgId === msgId) {
      // Pause
      clearInterval(playbackTimerRef.current);
      setPlayingVoiceMsgId(null);
      setVoicePlaybackSeconds(0);
    } else {
      // Parse duration to seconds
      const parts = durationStr.split(":");
      const totalSecs = parts.length === 2 ? parseInt(parts[0]) * 60 + parseInt(parts[1]) : 5;

      setPlayingVoiceMsgId(msgId);
      setVoicePlaybackSeconds(0);

      playbackTimerRef.current = setInterval(() => {
        setVoicePlaybackSeconds(prev => {
          if (prev >= totalSecs) {
            clearInterval(playbackTimerRef.current);
            setPlayingVoiceMsgId(null);
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    }
  };

  if (!chat) {
    return (
      <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 bg-white/5 backdrop-blur-md">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-20 h-20 rounded-full bg-white/10 text-indigo-400 flex items-center justify-center mx-auto shadow-inner border border-white/20">
            <Send className="w-10 h-10 rotate-45 stroke-[1.5] -translate-x-0.5" />
          </div>
          <h2 className="text-xl font-bold text-white">Mulai Obrolan Real-time</h2>
          <p className="text-sm text-white/60 leading-relaxed">
            Pilih chat di daftar kiri atau buat grup baru untuk berkirim pesan teks, stiker imut, foto, dan berkas secara instan!
          </p>
        </div>
      </div>
    );
  }

  // Format header info
  const isGroup = chat.isGroup;
  let chatTitle = chat.name;
  let chatAvatar = chat.avatar;
  let headerSubtitle = "";

  if (isGroup) {
    headerSubtitle = `${chat.members.length} Anggota`;
  } else {
    const otherMemberId = chat.members.find((id) => id !== currentUser.id) || currentUser.id;
    const partner = allUsers.find((u) => u.id === otherMemberId);
    chatTitle = partner ? partner.name : chat.name;
    chatAvatar = partner ? partner.avatar : chat.avatar;
    headerSubtitle = partner ? (partner.isOnline ? "• Online" : "• Offline") : "Offline";
  }

  // Prepare typing indicators lists
  const typingList = Object.keys(typingStatuses)
    .filter(uId => typingStatuses[uId] && uId !== currentUser.id)
    .map(uId => allUsers.find(u => u.id === uId)?.name || uId);

  return (
    <div className="flex-1 flex flex-col bg-transparent h-full relative animate-fade-in" id="chat-stage">
      
      {/* Header Chat */}
      <div className="p-4 bg-white/10 border-b border-white/10 flex items-center justify-between shadow-sm z-10 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back button on mobile */}
          <button
            onClick={onBackToSidebar}
            className="md:hidden p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-lg mr-1 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shadow-sm bg-white/5 flex items-center justify-center">
              {chatAvatar ? (
                <img src={chatAvatar} alt={chatTitle} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-xs uppercase">
                  {isGroup ? <Users className="w-4.5 h-4.5 text-white/90" /> : chatTitle.slice(0, 2)}
                </div>
              )}
            </div>
            {!isGroup && headerSubtitle.includes("Online") && (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-indigo-500 border-2 border-[#0d111a] rounded-full"></span>
            )}
          </div>

          <div className="min-w-0">
            <h4 className="text-sm font-black text-white truncate flex items-center gap-1">
              {chatTitle}
            </h4>
            <p className={`text-[10px] truncate ${headerSubtitle.includes("Online") ? "text-indigo-400 font-bold" : "text-white/60 font-semibold"}`}>
              {headerSubtitle}
            </p>
          </div>
        </div>

        {/* Action icons (Right Panel) */}
        <div className="flex items-center gap-1">
          <button
            onClick={onToggleInfoPanel}
            title="Info Profil / Grup"
            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-white/10"
          >
            <Sidebar className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Panel */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 custom-scrollbar bg-black/5">
        
        {messages.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            Belum ada pesan obrolan. Kirim sapaan hangat pertama Anda di bawah! 👋
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelf = msg.senderId === currentUser.id;
            const isSystem = msg.senderId === "system";

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="bg-slate-200/80 text-slate-600 px-3 py-1 rounded-full text-[10px] font-bold tracking-wide shadow-sm border border-slate-300/30">
                    {msg.text}
                  </span>
                </div>
              );
            }

            // Calculation of Read Receipt for self messages
            // Count how many people read the message (excluding the sender)
            const readCount = msg.readBy.filter(id => id !== msg.senderId).length;
            const totalOtherMembers = chat.members.filter(id => id !== msg.senderId).length;
            
            let readReceiptText = "";
            if (isSelf) {
              if (readCount > 0) {
                if (chat.isGroup) {
                  readReceiptText = `Dibaca ${readCount}`;
                } else {
                  readReceiptText = "Dibaca";
                }
              }
            }

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 max-w-[85%] md:max-w-[70%] group relative ${isSelf ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                {/* Other User Avatar */}
                {!isSelf && (
                  <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 shadow-sm shrink-0 mt-0.5 bg-white/10">
                    <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                  </div>
                )}

                {/* Message Body Block */}
                <div className="flex flex-col space-y-1 min-w-0">
                  {/* Sender Name (Other side only) */}
                  {!isSelf && (
                    <span className="text-[10px] font-extrabold text-white/60 ml-1">
                      {msg.senderName}
                    </span>
                  )}

                  {/* Bubble Row */}
                  <div className={`flex items-end gap-1.5 ${isSelf ? 'flex-row-reverse' : ''}`}>
                    
                    {/* Main bubble */}
                    <div
                      onClick={() => {
                        if (!msg.deletedForEveryone) {
                          setActiveMessageId(activeMessageId === msg.id ? null : msg.id);
                        }
                      }}
                      className={`relative px-3.5 py-2.5 rounded-2xl shadow-sm text-xs break-words min-w-[50px] leading-relaxed transition-all cursor-pointer ${
                        isSelf
                          ? 'message-self rounded-tr-none font-medium'
                          : 'message-other rounded-tl-none font-medium'
                      } ${msg.deletedForEveryone ? 'italic text-white/50 bg-white/5 border border-white/10 shadow-none' : ''}`}
                    >
                      {/* Replied / Quoted Message Block inside bubble */}
                      {msg.replyTo && !msg.deletedForEveryone && (
                        <div className={`p-2 rounded-xl border mb-2 text-[10px] leading-normal font-semibold truncate ${isSelf ? 'bg-black/20 border-white/10 text-white/90' : 'bg-white/10 border-black/10 text-slate-700'}`}>
                          <p className="font-extrabold text-[9px] mb-0.5">Balas @{msg.replyTo.senderName}</p>
                          <p className="truncate">
                            {msg.replyTo.type === "sticker" ? "🎨 Stiker" : 
                             msg.replyTo.type === "image" ? "📷 Foto" : 
                             msg.replyTo.type === "file" ? "📁 Lampiran" : 
                             msg.replyTo.type === "voice" ? "🎙️ Pesan Suara" : 
                             msg.replyTo.text}
                          </p>
                        </div>
                      )}

                      {/* Content representation */}
                      {msg.deletedForEveryone ? (
                        <span>Pesan ini telah dibatalkan / dihapus</span>
                      ) : msg.type === "sticker" ? (
                        <span className="text-6xl block select-none p-1">{msg.text}</span>
                      ) : msg.type === "image" ? (
                        <div className="space-y-1 bg-black/5 p-1 rounded-xl overflow-hidden border border-white/10">
                          <img
                            src={msg.mediaUrl}
                            alt="Media Upload"
                            className="max-h-60 rounded-lg max-w-full object-cover shadow cursor-pointer hover:brightness-95 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewImageUrl(msg.mediaUrl || null);
                            }}
                          />
                        </div>
                      ) : msg.type === "file" ? (
                        <div className={`p-3 rounded-xl flex items-center gap-3 border ${isSelf ? 'bg-black/20 border-white/10 text-white' : 'bg-white/20 border-black/5 text-slate-800'}`}>
                          <FileText className="w-8 h-8 shrink-0 text-indigo-400" />
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-xs truncate">{msg.fileName || "File Lampiran"}</p>
                            <span className="text-[9px] block opacity-75">{msg.fileSize || "Unduh"}</span>
                          </div>
                          <a
                            href={msg.mediaUrl}
                            download={msg.fileName}
                            className={`p-1.5 rounded-lg border hover:bg-white/10 shrink-0 transition-all cursor-pointer ${isSelf ? 'border-white/20 text-white' : 'border-black/10 bg-white/40 text-slate-800'}`}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      ) : msg.type === "voice" ? (
                        /* Simulated playable Voice Note */
                        <div className="flex items-center gap-2 py-1 select-none">
                          <button
                            onClick={() => handlePlayVoice(msg.id, msg.fileSize || "0:05")}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${isSelf ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-black/10 hover:bg-black/20 text-slate-700'}`}
                          >
                            {playingVoiceMsgId === msg.id ? (
                              <Pause className="w-3.5 h-3.5 fill-current" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                            )}
                          </button>
                          <div className="min-w-[100px]">
                            <div className="h-1.5 bg-black/10 rounded-full w-full relative overflow-hidden">
                              <div
                                className={`absolute top-0 left-0 h-full transition-all duration-1000 ${isSelf ? 'bg-white' : 'bg-indigo-500'}`}
                                style={{
                                  width: playingVoiceMsgId === msg.id
                                    ? `${(voicePlaybackSeconds / (msg.fileSize ? parseInt(msg.fileSize.split(":")[1]) : 5)) * 100}%`
                                    : '0%'
                                }}
                              ></div>
                            </div>
                            <span className="text-[8px] font-mono block mt-1 opacity-75">
                              {playingVoiceMsgId === msg.id ? `Memutar ${voicePlaybackSeconds}s` : `Pesan Suara • ${msg.fileSize}`}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span>{msg.text}</span>
                      )}

                      {/* Message Reactions display badge */}
                      {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                        <div className={`absolute bottom-[-10px] ${isSelf ? 'right-2' : 'left-2'} flex items-center gap-1 bg-slate-800/90 backdrop-blur border border-white/10 rounded-full px-1.5 py-0.5 shadow-md z-10 select-none`}>
                          {Object.entries(msg.reactions).map(([uId, emoji]) => {
                            const u = allUsers.find(user => user.id === uId);
                            return (
                              <span 
                                key={uId} 
                                className="text-[11px] cursor-help hover:scale-110 transition-transform" 
                                title={u ? `${u.name} memberi ${emoji}` : `Memberi ${emoji}`}
                              >
                                {emoji}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Date/Receipt Indicators on Side */}
                    <div className={`flex flex-col text-[8px] text-white/50 font-bold justify-end pb-0.5 min-w-[32px] shrink-0 ${isSelf ? 'text-right items-end' : 'text-left items-start'}`}>
                      {/* Checkmarks receipt status */}
                      {isSelf && readReceiptText && (
                        <span className="text-[9px] font-black text-indigo-400 leading-none mb-0.5">
                          {readReceiptText}
                        </span>
                      )}
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                  </div>

                  {/* Message Action menu (Reply and Delete / Reactions) displays below bubble */}
                  {!msg.deletedForEveryone && (
                    <div className={`flex items-center gap-2 text-[10px] text-white/40 mt-1 px-1 relative ${isSelf ? 'justify-end' : 'justify-start'}`}>
                      {/* For other users' chat messages: show Balas + Emosi */}
                      {!isSelf ? (
                        <>
                          <button
                            onClick={() => {
                              setRepliedMsg(msg);
                            }}
                            className="hover:text-indigo-400 text-white/50 transition-colors flex items-center gap-1 cursor-pointer bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-lg border border-white/5"
                          >
                            <Reply className="w-3 h-3 text-indigo-400/80" />
                            <span>Balas</span>
                          </button>

                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveReactionMenuId(activeReactionMenuId === msg.id ? null : msg.id);
                              }}
                              className={`hover:text-amber-400 transition-colors flex items-center gap-1 cursor-pointer bg-white/5 px-2 py-0.5 rounded-lg border border-white/5 ${activeReactionMenuId === msg.id ? 'text-amber-400 bg-white/15 border-amber-500/30' : 'text-white/50 hover:bg-white/10'}`}
                            >
                              <Smile className="w-3 h-3 text-amber-400/80" />
                              <span>Emosi</span>
                            </button>

                            {/* Floating Emoji Popover */}
                            <AnimatePresence>
                              {activeReactionMenuId === msg.id && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                  animate={{ opacity: 1, scale: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                  className="absolute bottom-full left-0 mb-1.5 bg-slate-950 border border-white/10 rounded-full px-2.5 py-1 flex items-center gap-2 shadow-2xl z-30"
                                >
                                  {["❤️", "👍", "😂", "😮", "😢", "🙏"].map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => {
                                        onReactToMessage(msg.id, emoji);
                                        setActiveReactionMenuId(null);
                                      }}
                                      className="text-base hover:scale-125 transition-transform cursor-pointer p-0.5"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                  {/* Clear reaction button if user already reacted */}
                                  {msg.reactions && msg.reactions[currentUser.id] && (
                                    <button
                                      onClick={() => {
                                        onReactToMessage(msg.id, ""); // clear reaction
                                        setActiveReactionMenuId(null);
                                      }}
                                      className="text-[10px] text-red-400 hover:text-red-300 ml-1 px-1.5 py-0.5 rounded-full bg-red-950/20 hover:bg-red-950/40 cursor-pointer font-bold shrink-0"
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </>
                      ) : (
                        /* For self messages: ONLY show Hapus button, NO Balas button */
                        <button
                          onClick={async () => {
                            const confirmDelete = await toast.confirm(
                              "Apakah Anda yakin ingin menghapus pesan ini?",
                              "Hapus Pesan",
                              "danger",
                              "Hapus",
                              "Batal"
                            );
                            if (confirmDelete) {
                              const forEveryone = await toast.confirm(
                                "Ingin menghapus pesan ini untuk semua orang (Unsend), atau hanya untuk Anda?",
                                "Konfirmasi Penghapusan",
                                "warning",
                                "Unsend (Semua)",
                                "Hanya untuk Saya"
                              );
                              onDeleteMessage(msg.id, forEveryone);
                            }
                          }}
                          className="hover:text-red-400 text-white/50 transition-colors flex items-center gap-1 cursor-pointer bg-white/5 hover:bg-red-950/20 px-2 py-0.5 rounded-lg border border-white/5"
                        >
                          <Trash2 className="w-3 h-3 text-red-400/80" />
                          <span>Hapus</span>
                        </button>
                      )}
                    </div>
                  )}

                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator inside scrolling space */}
        {typingList.length > 0 && (
          <div className="flex items-start gap-2.5 mr-auto max-w-[70%]">
            <div className="w-8 h-8 rounded-lg bg-white/10 text-indigo-400 flex items-center justify-center font-bold text-xs shadow-sm border border-white/10 shrink-0">
              ...
            </div>
            <div className="bg-white/90 border border-white/20 rounded-2xl rounded-tl-none px-3.5 py-2 flex items-center gap-2 shadow-sm animate-pulse">
              <span className="text-[10px] text-slate-700 font-bold leading-none shrink-0">{typingList.join(", ")} sedang mengetik</span>
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0s' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.15s' }}></span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-bounce" style={{ animationDelay: '0.3s' }}></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Section */}
      <div className="p-3 bg-white/10 border-t border-white/10 shrink-0 z-10 backdrop-blur-md">
        
        {/* Reply Preview Header if replying */}
        {repliedMsg && (
          <div className="mb-2 p-2 bg-black/20 border border-white/10 rounded-xl flex justify-between items-center text-[10px] text-white/80 font-semibold shadow-inner animate-fade-in shrink-0">
            <div className="flex items-center gap-1.5 truncate">
              <span className="font-extrabold text-indigo-400 uppercase text-[9px] shrink-0">Membalas @{repliedMsg.senderName}:</span>
              <p className="truncate opacity-80 italic">
                "{repliedMsg.type === "sticker" ? "Stiker" : repliedMsg.text}"
              </p>
            </div>
            <button
              onClick={() => setRepliedMsg(null)}
              className="p-1 text-white/60 hover:text-white hover:bg-white/10 rounded-full cursor-pointer shrink-0 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Input Controls row */}
        <div className="flex items-end gap-2 relative">
          
          {/* Paperclip upload trigger */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Lampirkan Gambar atau Berkas"
            className="p-2.5 text-white/60 hover:text-white hover:bg-white/10 rounded-xl cursor-pointer transition-all disabled:opacity-50 inline-flex"
          >
            <Paperclip className="w-4.5 h-4.5" />
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAttachFile}
            className="hidden"
          />

          {/* Sticker & Emoji selector toggle */}
          <button
            onClick={() => setShowStickerPicker(!showStickerPicker)}
            title="Pilih Stiker & Emoji"
            className={`p-2.5 rounded-xl cursor-pointer transition-all inline-flex ${showStickerPicker ? 'text-indigo-400 bg-white/10' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
          >
            <Smile className="w-4.5 h-4.5" />
          </button>

          {/* Text input Area */}
          <div className="flex-1 min-w-0 bg-white/10 rounded-2xl border border-white/10 p-1 flex items-end">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={handleTextareaChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendText();
                }
              }}
              placeholder={isRecording ? "Merekam suara..." : "Tulis pesan di sini... (Enter untuk kirim)"}
              disabled={isRecording}
              className="flex-1 bg-transparent border-0 resize-none max-h-32 min-h-[36px] py-2 px-3 text-xs text-white placeholder-white/40 focus:outline-none scrollbar-thin leading-relaxed"
            />
          </div>

          {/* Simulated Voice Recorder Mic button */}
          {inputText.trim() === "" ? (
            <button
              onClick={handleToggleVoiceRecord}
              className={`p-2.5 rounded-xl cursor-pointer transition-all inline-flex ${isRecording ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
              title={isRecording ? "Hentikan dan Kirim Voice Note" : "Kirim Pesan Suara"}
            >
              {isRecording ? <Square className="w-4.5 h-4.5 fill-current" /> : <Mic className="w-4.5 h-4.5" />}
            </button>
          ) : (
            /* Send icon if text present */
            <button
              onClick={handleSendText}
              className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-md cursor-pointer transition-all hover:scale-105 active:scale-95 inline-flex"
            >
              <Send className="w-4.5 h-4.5 fill-current rotate-45 -translate-x-0.5 text-indigo-100" />
            </button>
          )}

          {/* Floating Sticker Picker Overlay */}
          <AnimatePresence>
            {showStickerPicker && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowStickerPicker(false)}></div>
                <motion.div
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 15, scale: 0.95 }}
                  className="absolute bottom-14 left-0 z-30"
                >
                  <StickerPicker
                    onSelectSticker={handleSelectSticker}
                    onSelectEmoji={handleSelectEmoji}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Voice Recording Timer Display Overlay */}
          {isRecording && (
            <div className="absolute left-14 right-14 top-1 bottom-1 bg-slate-900/90 backdrop-blur-md rounded-2xl flex items-center justify-between px-4 text-white animate-fade-in border border-red-500/20 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                <span className="text-xs font-semibold">Merekam Pesan Suara...</span>
              </div>
              <span className="text-xs font-bold font-mono tracking-wider bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                {Math.floor(recordingSeconds / 60)}:{ (recordingSeconds % 60).toString().padStart(2, '0') }
              </span>
            </div>
          )}

          {/* File Upload Loader Overlay */}
          {isUploading && (
            <div className="absolute inset-y-1 left-12 right-12 bg-slate-900/90 backdrop-blur-md rounded-2xl flex items-center justify-center text-indigo-400 z-10 border border-white/10">
              <span className="w-4 h-4 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin mr-2"></span>
              <span className="text-xs font-semibold">Mengunggah lampiran...</span>
            </div>
          )}

        </div>
      </div>

      {/* Pop-up Image Preview Modal */}
      <AnimatePresence>
        {previewImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
            onClick={() => setPreviewImageUrl(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="relative max-w-full max-h-[90vh] bg-slate-950/40 border border-white/15 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => setPreviewImageUrl(null)}
                  className="p-1.5 bg-black/60 hover:bg-black/90 text-white/80 hover:text-white rounded-full transition-all cursor-pointer shadow border border-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Image Box */}
              <div className="overflow-auto p-2 flex items-center justify-center max-w-full max-h-[85vh]">
                <img
                  src={previewImageUrl}
                  alt="Pratinjau Foto"
                  className="max-w-full max-h-[80vh] object-contain rounded-xl select-none"
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
