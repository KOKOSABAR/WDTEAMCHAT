import React, { useState } from "react";
import { User, Chat, PRESET_GROUP_COVERS } from "../types.ts";
import { X, ShieldAlert, Bell, BellOff, UserPlus, UserMinus, ShieldAlert as ShieldIcon, Trash2, Edit2, Check, ArrowRight, UserCheck, AlertTriangle, RefreshCw, Users } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useToast } from "./Toast.tsx";

interface InfoPanelProps {
  currentUser: User;
  chat: Chat | null;
  allUsers: User[];
  onClose: () => void;
  onUpdateGroup: (name: string, avatar: string, description: string) => void;
  onAddMembers: (memberIds: string[]) => void;
  onRemoveMember: (targetMemberId: string) => void;
  onPromoteAdmin: (targetMemberId: string) => void;
  onDeleteGroup: () => void;
  onToggleArchive: () => void;
  onToggleMute: () => void;
}

export default function InfoPanel({
  currentUser,
  chat,
  allUsers,
  onClose,
  onUpdateGroup,
  onAddMembers,
  onRemoveMember,
  onPromoteAdmin,
  onDeleteGroup,
  onToggleArchive,
  onToggleMute
}: InfoPanelProps) {
  const toast = useToast();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>("");
  const [editDesc, setEditDesc] = useState<string>("");
  const [editCover, setEditCover] = useState<string>("");
  const [isUploadingCover, setIsUploadingCover] = useState<boolean>(false);

  const [showInviteSection, setShowInviteSection] = useState<boolean>(false);
  const [inviteSearch, setInviteSearch] = useState<string>("");

  // Blocked / Reported mock state
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(chat?.mutedBy.includes(currentUser.id) || false);
  const [isArchived, setIsArchived] = useState<boolean>(chat?.archivedBy.includes(currentUser.id) || false);

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCover(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const fileData = reader.result as string;
        const res = await fetch("/api/upload", {
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
        const data = await res.json();
        if (res.ok && data.success && data.fileUrl) {
          setEditCover(data.fileUrl);
          toast.success("Gambar sampul grup berhasil diunggah!");
        } else {
          toast.error(data.error || "Gagal mengunggah gambar sampul grup.");
        }
        setIsUploadingCover(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Gagal mengunggah gambar grup:", err);
      setIsUploadingCover(false);
    }
  };

  if (!chat) return null;

  const isGroup = chat.isGroup;
  const isAdmin = chat.admins.includes(currentUser.id);
  const canEditGroup = currentUser.role === "CS LINE" || currentUser.role === "KAPTEN KASIR";

  // Get recipient metadata for personal chat
  const getPersonalRecipient = () => {
    const otherId = chat.members.find(id => id !== currentUser.id) || currentUser.id;
    return allUsers.find(u => u.id === otherId);
  };

  const recipient = isGroup ? null : getPersonalRecipient();

  // Handle opening group edit form
  const handleStartEdit = () => {
    setEditName(chat.name);
    setEditDesc(chat.description || "");
    setEditCover(chat.avatar);
    setIsEditing(true);
  };

  // Submit group edit updates
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editName.trim()) return;
    onUpdateGroup(editName.trim(), editCover, editDesc.trim());
    setIsEditing(false);
  };

  // Filter contacts to invite (users not already in group)
  const getInvitableContacts = () => {
    return allUsers.filter(u => 
      !chat.members.includes(u.id) && 
      (u.name.toLowerCase().includes(inviteSearch.toLowerCase()) || 
       u.username.toLowerCase().includes(inviteSearch.toLowerCase()))
    );
  };

  const invitableContacts = getInvitableContacts();

  // Invite single contact
  const handleInviteUser = (userId: string) => {
    onAddMembers([userId]);
    setInviteSearch("");
    setShowInviteSection(false);
  };

  // Handle mute toggling locally
  const handleMuteClick = () => {
    setIsMuted(!isMuted);
    onToggleMute();
  };

  // Handle archive toggling locally
  const handleArchiveClick = () => {
    setIsArchived(!isArchived);
    onToggleArchive();
  };

  return (
    <div className="w-full md:w-80 border-l border-white/10 bg-white/10 h-full flex flex-col z-20 shrink-0 shadow-lg backdrop-blur-md">
      
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
        <h4 className="text-xs font-black text-white uppercase tracking-wider">Informasi Obrolan</h4>
        <button
          onClick={onClose}
          className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer transition-all"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Panel Scrollable Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        
        {/* SECTION 1: PROFILE MAIN DETAILS */}
        {!isGroup && recipient ? (
          /* PERSONAL CHAT INFO */
          <div className="text-center space-y-3">
            <div className="relative inline-block">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white/10 mx-auto shadow bg-white/5 flex items-center justify-center">
                {recipient.avatar ? (
                  <img src={recipient.avatar} alt={recipient.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold text-lg uppercase">
                    {recipient.name.slice(0, 2)}
                  </div>
                )}
              </div>
              {recipient.isOnline && (
                <span className="absolute bottom-1 right-1 w-4 h-4 bg-indigo-500 border-2 border-[#0d111a] rounded-full"></span>
              )}
            </div>
            <div>
              <h5 className="font-extrabold text-white text-base">{recipient.name}</h5>
              <p className="text-[10px] text-white/50 font-bold mt-0.5">@{recipient.username}</p>
            </div>
            {recipient.statusMessage && (
              <div className="bg-white/10 border border-white/10 rounded-xl p-3 text-xs text-white/80 italic max-w-[220px] mx-auto leading-relaxed shadow-sm">
                "{recipient.statusMessage}"
              </div>
            )}
          </div>
        ) : isGroup ? (
          /* GROUP CHAT INFO */
          <div className="space-y-4">
            {isEditing ? (
              /* GROUP CHAT EDIT FORM */
              <form onSubmit={handleSaveEdit} className="space-y-3 p-3 bg-black/20 border border-white/10 rounded-xl">
                <h5 className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Edit Info Grup</h5>
                
                <div className="space-y-1">
                  <label className="text-[10px] text-white/60 font-bold">Nama Grup</label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full border border-white/10 rounded-lg p-2 text-xs text-white bg-white/10 focus:outline-none focus:border-indigo-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-white/60 font-bold">Deskripsi</label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full border border-white/10 rounded-lg p-2 text-xs text-white bg-white/10 focus:outline-none focus:border-indigo-400 resize-none"
                  />
                </div>

                 {/* Custom File Upload Selector for Group */}
                <div className="space-y-1">
                  <label className="text-[10px] text-white/60 font-bold block">Unggah Foto Grup</label>
                  <label className="w-full flex items-center justify-center gap-1.5 border border-white/10 border-dashed rounded-lg py-1.5 px-2 text-[10px] bg-white/5 hover:bg-white/10 text-white/80 hover:text-white cursor-pointer transition-all">
                    <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isUploadingCover ? 'animate-spin' : ''}`} />
                    <span>{isUploadingCover ? "Mengunggah..." : "Pilih & Unggah Berkas Foto"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleUploadCover}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex gap-1.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-white/10 border border-white/10 text-white rounded-lg py-1.5 text-[10px] font-bold hover:bg-white/20 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-indigo-600 text-white rounded-lg py-1.5 text-[10px] font-bold hover:bg-indigo-500 cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Simpan
                  </button>
                </div>
              </form>
            ) : (
              /* GROUP DETAILS DISPLAY */
              <div className="text-center space-y-3">
                <div className="relative inline-block w-20 h-20 rounded-2xl overflow-hidden border border-white/10 shadow bg-white/5 flex items-center justify-center">
                  {chat.avatar ? (
                    <img src={chat.avatar} alt={chat.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white font-bold">
                      <Users className="w-8 h-8 text-white/90" />
                    </div>
                  )}
                </div>
                <div>
                  <h5 className="font-extrabold text-white text-base flex justify-center items-center gap-1.5">
                    {chat.name}
                    {canEditGroup && (
                      <button
                        onClick={handleStartEdit}
                        title="Edit Info Grup"
                        className="p-1 text-white/60 hover:text-indigo-400 rounded-md hover:bg-white/10 cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </h5>
                  <p className="text-[10px] text-white/50 font-bold mt-0.5">Dibuat oleh {allUsers.find(u => u.id === chat.createdBy)?.name || chat.createdBy}</p>
                </div>
                {chat.description && (
                  <p className="text-xs text-white/85 font-medium max-w-xs leading-relaxed text-center px-2 bg-white/10 py-2 rounded-xl border border-white/5">
                    {chat.description}
                  </p>
                )}
              </div>
            )}
          </div>
        ) : null}

        {/* SECTION 2: COMMON TOGGLES (Mute / Archive) */}
        <div className="divide-y divide-white/5 border-y border-white/10 py-1">
          {/* Mute toggle */}
          <button
            onClick={handleMuteClick}
            className="w-full py-2.5 flex items-center justify-between text-left text-xs font-semibold text-white hover:text-indigo-400 transition-all cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              {isMuted ? <BellOff className="w-4 h-4 text-red-400 shrink-0" /> : <Bell className="w-4 h-4 text-indigo-400 shrink-0" />}
              Senyapkan Notifikasi
            </span>
            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${isMuted ? 'bg-red-500' : 'bg-white/20'}`}>
              <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${isMuted ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>

          {/* Archive Toggle */}
          <button
            onClick={handleArchiveClick}
            className="w-full py-2.5 flex items-center justify-between text-left text-xs font-semibold text-white hover:text-indigo-400 transition-all cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              <ShieldIcon className="w-4 h-4 text-white/60 shrink-0" />
              Arsipkan Obrolan Ini
            </span>
            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer ${isArchived ? 'bg-indigo-600' : 'bg-white/20'}`}>
              <div className={`w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${isArchived ? 'translate-x-4' : 'translate-x-0'}`} />
            </div>
          </button>
        </div>

        {/* SECTION 3: GROUP MEMBERS LIST */}
        {isGroup && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h6 className="text-[10px] font-black text-white/60 uppercase tracking-wider">
                Anggota ({chat.members.length})
              </h6>
              
              {/* Trigger Invite toggle */}
              {!(currentUser.role === "CS LC" || currentUser.role === "KASIR") && (
                <button
                  onClick={() => setShowInviteSection(!showInviteSection)}
                  className="text-[10px] font-extrabold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer bg-white/10 hover:bg-white/20 px-2 py-1 rounded border border-white/10"
                >
                  <UserPlus className="w-3.5 h-3.5" /> Tambah
                </button>
              )}
            </div>

            {/* Slide-out invite contacts select inside Panel */}
            <AnimatePresence>
              {showInviteSection && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-black/20 p-2 rounded-xl border border-white/10 space-y-2 overflow-hidden"
                >
                  <p className="text-[9px] text-white/60 font-bold uppercase tracking-wide px-1">Pilih Kontak Untuk Diundang</p>
                  <input
                    type="text"
                    placeholder="Cari kontak..."
                    value={inviteSearch}
                    onChange={(e) => setInviteSearch(e.target.value)}
                    className="w-full border border-white/10 bg-white/10 rounded-lg px-2 py-1 text-[11px] focus:outline-none focus:border-indigo-400 text-white"
                  />
                  <div className="max-h-28 overflow-y-auto divide-y divide-white/5">
                    {invitableContacts.length === 0 ? (
                      <p className="text-[10px] text-white/50 text-center py-2">Semua teman sudah ditambahkan.</p>
                    ) : (
                      invitableContacts.map(user => (
                        <button
                           key={user.id}
                           type="button"
                           onClick={() => handleInviteUser(user.id)}
                           className="w-full text-left py-1.5 px-2 hover:bg-white/10 rounded transition-all cursor-pointer flex items-center justify-between text-xs font-semibold text-white"
                        >
                          <div className="flex items-center gap-2 truncate">
                             <img src={user.avatar} className="w-5 h-5 rounded-full object-cover" />
                             <span className="truncate">{user.name}</span>
                          </div>
                          <span className="text-[9px] bg-indigo-400/20 text-indigo-300 px-1.5 py-0.5 rounded font-black uppercase">Undang</span>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* List of members in group */}
            <div className="divide-y divide-white/5 border border-white/10 rounded-xl overflow-hidden p-1 max-h-56 overflow-y-auto bg-white/5">
              {chat.members.map(memberId => {
                const user = allUsers.find(u => u.id === memberId);
                if (!user) return null;

                const isMemberAdmin = chat.admins.includes(user.id);
                const isMe = user.id === currentUser.id;

                return (
                  <div key={user.id} className="p-2 flex items-center justify-between group/item hover:bg-white/10 rounded-lg text-left">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full object-cover border border-white/10 bg-white/5" />
                        {user.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-indigo-500 border border-[#0d111a] rounded-full"></span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-white truncate leading-none">
                          {user.name} {isMe && "(Anda)"}
                        </p>
                        <span className="text-[8px] text-white/50 font-bold block mt-0.5">@{user.username}</span>
                      </div>
                    </div>

                    {/* Role pill and Admin controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isMemberAdmin ? (
                        <span className="bg-indigo-400/20 text-indigo-300 text-[8px] px-1.5 py-0.5 rounded font-extrabold tracking-wide shrink-0">Admin</span>
                      ) : (
                        <span className="bg-white/10 text-white/60 text-[8px] px-1.5 py-0.5 rounded font-bold shrink-0">Anggota</span>
                      )}

                      {/* Admin Quick Options overlay on hover */}
                      {isAdmin && !isMe && (
                        <div className="hidden group-hover/item:flex items-center gap-1 bg-slate-900/90 border border-white/10 rounded p-0.5 shadow-md">
                          {/* Promote Admin role */}
                          {!isMemberAdmin && (
                            <button
                              onClick={() => onPromoteAdmin(user.id)}
                              title="Jadikan Admin"
                              className="p-1 hover:bg-indigo-950/30 rounded text-indigo-400 transition-all cursor-pointer scale-90"
                            >
                              <UserCheck className="w-3 h-3" />
                            </button>
                          )}
                          {/* Kick from group */}
                          <button
                            onClick={async () => {
                              const confirmKick = await toast.confirm(
                                `Apakah Anda yakin ingin mengeluarkan ${user.name} dari grup ini?`,
                                "Keluarkan Anggota",
                                "warning",
                                "Keluarkan",
                                "Batal"
                              );
                              if (confirmKick) onRemoveMember(user.id);
                            }}
                            title="Keluarkan dari grup"
                            className="p-1 hover:bg-red-950/30 rounded text-red-400 transition-all cursor-pointer scale-90"
                          >
                            <UserMinus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 4: ACTIONS FOOTER */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          {!isGroup && recipient ? (
            /* PERSONAL CHAT ACTIONS */
            <>
              {/* Block/Unblock toggle */}
              <button
                onClick={() => {
                  const nextBlocked = !isBlocked;
                  setIsBlocked(nextBlocked);
                  if (nextBlocked) {
                    toast.warning(`${recipient.name} berhasil diblokir.`, "Kontak Diblokir");
                  } else {
                    toast.success(`Blokir dibuka untuk ${recipient.name}.`, "Blokir Dibuka");
                  }
                }}
                className={`w-full py-2.5 rounded-xl border font-bold text-xs cursor-pointer transition-all ${isBlocked ? 'bg-red-950/20 border-red-900/40 text-red-400' : 'bg-white/10 border-white/10 text-white hover:bg-white/20'}`}
              >
                {isBlocked ? "Buka Blokir Pengguna" : "Blokir Kontak"}
              </button>

              {/* Report button */}
              <button
                onClick={() => {
                  toast.success("Terima kasih telah berkontribusi menjaga keamanan komunitas kami.", "Laporan Terkirim");
                }}
                className="w-full py-2.5 bg-red-950/30 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold hover:bg-red-900/40 cursor-pointer transition-all flex items-center justify-center gap-1"
              >
                <AlertTriangle className="w-3.5 h-3.5" /> Laporkan Kontak Ini
              </button>
            </>
          ) : isGroup ? (
            /* GROUP CHAT ACTIONS */
            <>
              {/* Leave group */}
              <button
                onClick={async () => {
                  const confirmLeave = await toast.confirm(
                    "Apakah Anda yakin ingin keluar dari grup chat ini?",
                    "Keluar Grup",
                    "danger",
                    "Keluar",
                    "Batal"
                  );
                  if (confirmLeave) onRemoveMember(currentUser.id);
                }}
                className="w-full py-2.5 bg-white/10 border border-white/10 rounded-xl text-white hover:bg-red-950/30 hover:text-red-400 hover:border-red-500/30 text-xs font-bold cursor-pointer transition-all"
              >
                Keluar Dari Grup
              </button>

              {/* Delete group (admin only) */}
              {isAdmin && (
                <button
                  onClick={async () => {
                    const confirmDel = await toast.confirm(
                      "PERINGATAN!\n\nApakah Anda yakin ingin membubarkan dan menghapus grup ini untuk semua orang? Semua data pesan akan hilang secara permanen.",
                      "Bubarkan Grup",
                      "danger",
                      "Bubarkan",
                      "Batal"
                    );
                    if (confirmDel) onDeleteGroup();
                  }}
                  className="w-full py-2.5 bg-red-950/30 border border-red-500/20 rounded-xl text-red-400 hover:bg-red-900/40 text-xs font-black cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Trash2 className="w-4 h-4" /> Bubarkan Grup
                </button>
              )}
            </>
          ) : null}
        </div>

      </div>

    </div>
  );
}
