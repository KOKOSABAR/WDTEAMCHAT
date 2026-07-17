import React, { useState } from "react";
import { User } from "../types.ts";
import { X, Shield, Check, RefreshCw, UserCheck, Key, Lock, Eye, EyeOff } from "lucide-react";
import { motion } from "motion/react";
import { useToast } from "./Toast.tsx";

interface AdminPanelModalProps {
  currentUser: User;
  allUsers: User[];
  onClose: () => void;
  onRefreshUsers: () => void;
}

export default function AdminPanelModal({
  currentUser,
  allUsers,
  onClose,
  onRefreshUsers
}: AdminPanelModalProps) {
  const toast = useToast();
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "wdbos88") {
      setIsAuthenticated(true);
      setErrorMsg("");
      toast.success("Verifikasi berhasil! Selamat datang di Panel Admin.");
    } else {
      setErrorMsg("Kata sandi salah. Silakan coba lagi.");
      setPassword("");
      toast.error("Akses ditolak! Kata sandi salah.");
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'CS LINE' | 'CS LC' | 'KAPTEN KASIR' | 'KASIR') => {
    setUpdatingUserId(userId);
    const targetUser = allUsers.find(u => u.id === userId);
    const userName = targetUser ? targetUser.name : "Pengguna";
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          role: newRole
        })
      });

      if (response.ok) {
        onRefreshUsers();
        toast.success(`Role ${userName} berhasil diubah menjadi ${newRole}!`);
      } else {
        toast.error("Gagal memperbarui role pengguna.");
      }
    } catch (err) {
      console.error("Gagal mengubah role:", err);
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const rolesList: ('CS LINE' | 'CS LC' | 'KAPTEN KASIR' | 'KASIR')[] = [
    'CS LINE',
    'CS LC',
    'KAPTEN KASIR',
    'KASIR'
  ];

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/15 max-w-sm w-full overflow-hidden flex flex-col p-6"
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Verifikasi Keamanan</h3>
                <p className="text-[10px] text-white/50 font-medium">Akses Panel Administrasi</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-white/60 uppercase tracking-wider">Kata Sandi Admin</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoFocus
                  required
                  placeholder="Masukkan kata sandi..."
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg("");
                  }}
                  className={`w-full border rounded-xl pl-3 pr-10 py-2.5 text-xs text-white bg-white/5 focus:outline-none focus:ring-2 transition-all ${
                    errorMsg 
                      ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20 bg-red-500/5" 
                      : "border-white/10 focus:border-indigo-400 focus:ring-indigo-500/20 focus:bg-white/10"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errorMsg && (
                <p className="text-[10px] text-red-400 font-bold">{errorMsg}</p>
              )}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 border border-white/15 text-white/80 hover:text-white hover:bg-white/5 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="w-1/2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1"
              >
                Verifikasi
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-white/15 max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="bg-white/5 border-b border-white/10 p-5 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">Panel Administrasi Role</h3>
              <p className="text-[10px] text-white/50 font-medium">Atur hak akses & kapabilitas akun CS dan Kasir</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/60 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Box about role capabilities */}
        <div className="bg-indigo-500/10 border-b border-indigo-500/20 p-4 shrink-0 text-xs text-indigo-300 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="font-extrabold text-[11px] text-white uppercase tracking-wider">🔵 Akses Penuh (CS LINE & KAPTEN KASIR):</p>
            <p className="text-[10px] opacity-90">Bisa chat grup, chat personal, membuat grup baru, dan mengundang/menambah anggota baru.</p>
          </div>
          <div className="space-y-1">
            <p className="font-extrabold text-[11px] text-white uppercase tracking-wider">🟡 Khusus Grup (CS LC & KASIR):</p>
            <p className="text-[10px] opacity-90">Hanya diizinkan chat dalam grup. Chat personal, pembuatan grup baru, dan tambah anggota dinonaktifkan.</p>
          </div>
        </div>

        {/* Users List Body */}
        <div className="flex-1 overflow-y-auto p-6 divide-y divide-white/5 custom-scrollbar">
          {allUsers.map((user) => {
            const isMe = user.id === currentUser.id;
            const activeRole = user.role || "CS LINE";

            return (
              <div key={user.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 first:pt-0 last:pb-0">
                {/* User Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative shrink-0">
                    <img src={user.avatar} alt={user.name} className="w-11 h-11 rounded-xl object-cover border border-white/10 bg-white/5" />
                    {user.isOnline && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-indigo-500 border-2 border-[#0d111a] rounded-full"></span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h5 className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                      {user.name}
                      {isMe && <span className="text-[8px] bg-white/10 text-white/60 px-1.5 py-0.5 rounded-md">Anda</span>}
                    </h5>
                    <p className="text-[10px] text-white/50 font-semibold">@{user.username}</p>
                    <div className="mt-1">
                      <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider">
                        Role: {activeRole}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Role Selector Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {rolesList.map((r) => {
                    const isSelected = activeRole === r;
                    return (
                      <button
                        key={r}
                        disabled={updatingUserId === user.id}
                        onClick={() => handleRoleChange(user.id, r)}
                        className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-400 text-white shadow-md shadow-indigo-600/15"
                            : "bg-white/5 hover:bg-white/10 border-white/5 text-white/70 hover:text-white"
                        } disabled:opacity-50`}
                      >
                        {updatingUserId === user.id && isSelected ? (
                          <RefreshCw className="w-3 h-3 animate-spin inline mr-1" />
                        ) : null}
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="bg-white/5 border-t border-white/10 p-4 text-center shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
          >
            Selesai & Tutup
          </button>
        </div>
      </motion.div>
    </div>
  );
}
