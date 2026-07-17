import React, { useState, useEffect } from "react";
import { User, PRESET_GROUP_COVERS } from "../types.ts";
import { X, Search, Upload, Check, Users } from "lucide-react";
import { motion } from "motion/react";

interface GroupModalProps {
  currentUser: User;
  onClose: () => void;
  onGroupCreated: (newGroupId: string) => void;
}

export default function GroupModal({ currentUser, onClose, onGroupCreated }: GroupModalProps) {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [selectedCover, setSelectedCover] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  // Fetch all users on mount
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users");
        if (response.ok) {
          const data = await response.json();
          // Filter out current user from selection list
          setAllUsers(data.filter((u: User) => u.id !== currentUser.id));
        }
      } catch (err) {
        console.error("Gagal memuat pengguna:", err);
      }
    };
    fetchUsers();
  }, [currentUser]);

  // Handle local File Upload for Group Cover
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError("");

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const fileData = reader.result as string;
        
        const response = await fetch("/api/upload", {
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

        const data = await response.json();
        if (response.ok && data.success) {
          setSelectedCover(data.fileUrl);
        } else {
          setError(data.error || "Gagal mengunggah foto grup.");
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      setError("Kesalahan koneksi saat mengunggah foto.");
      setIsUploading(false);
    }
  };

  // Toggle user selection
  const handleToggleUser = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  // Create Group
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Nama grup wajib diisi.");
      return;
    }

    try {
      // Members list includes selected user IDs and the current user
      const members = [...selectedUserIds, currentUser.id];

      const response = await fetch("/api/chats", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim(),
          isGroup: true,
          avatar: selectedCover,
          description: description.trim(),
          members,
          createdBy: currentUser.id
        })
      });

      if (response.ok) {
        const newGroup = await response.json();
        onGroupCreated(newGroup.id);
        onClose();
      } else {
        const errData = await response.json();
        setError(errData.error || "Gagal membuat grup chat.");
      }
    } catch (err) {
      console.error(err);
      setError("Kesalahan koneksi saat membuat grup.");
    }
  };

  // Filter users based on search
  const filteredUsers = allUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/15 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] text-white"
      >
        {/* Header */}
        <div className="bg-white/5 border-b border-white/10 p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-lg">Buat Grup Chat</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleCreateGroup} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/25 text-red-300 rounded-lg text-xs font-semibold border border-red-500/30">
              ⚠️ {error}
            </div>
          )}

          {/* Group Photo Cover Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-white/60 uppercase tracking-wider block">Foto Sampul Grup</label>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-sm shrink-0 bg-white/5 flex items-center justify-center">
                {selectedCover ? (
                  <img src={selectedCover} alt="Group Cover" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8 text-white/40" />
                )}
                {isUploading && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-lg border border-white/10 cursor-pointer inline-flex items-center gap-1.5 transition-all">
                  <Upload className="w-3.5 h-3.5 text-white/70" /> Unggah Foto
                  <input
                    type="file"
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Group Inputs */}
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-white/60 uppercase tracking-wider block">Nama Grup</label>
              <input
                type="text"
                required
                maxLength={40}
                placeholder="Masukkan nama grup..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white placeholder-white/40 bg-white/5 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-white/60 uppercase tracking-wider block">Deskripsi Grup (Opsional)</label>
              <textarea
                placeholder="Tulis deskripsi grup atau peraturan singkat di sini..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white placeholder-white/40 bg-white/5 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition-all resize-none"
              />
            </div>
          </div>

          {/* Contact Checkbox List */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-white/60 uppercase tracking-wider block">
                Undang Anggota ({selectedUserIds.length} Terpilih)
              </label>
              <span className="text-[10px] text-white/50 font-medium">Bisa ditambahkan lagi nanti</span>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-white/50" />
              <input
                type="text"
                placeholder="Cari kontak teman..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-white/40 bg-white/5 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition-all"
              />
            </div>

            {/* Scrollable list */}
            <div className="border border-white/10 rounded-xl overflow-hidden divide-y divide-white/5 max-h-48 overflow-y-auto bg-white/5 p-1">
              {filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-white/50 text-xs">
                  Tidak ada kontak ditemukan.
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const isChecked = selectedUserIds.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => handleToggleUser(user.id)}
                      className="w-full p-2.5 flex items-center justify-between hover:bg-white/10 text-left transition-all cursor-pointer rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative h-9 w-9 rounded-full overflow-hidden border border-white/10 bg-white/5">
                          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">{user.name}</p>
                          <p className="text-[10px] text-white/50">@{user.username}</p>
                        </div>
                      </div>

                      {/* Checkbox badge */}
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-white/20 bg-white/5'}`}>
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Action buttons footer */}
          <div className="flex gap-2 pt-2 border-t border-white/10 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 border border-white/10 text-white rounded-xl py-3 text-sm font-bold hover:bg-white/10 transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              Buat Grup Chat
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
