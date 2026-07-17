import React, { useState, useRef } from "react";
import { User, PRESET_AVATARS } from "../types.ts";
import { KeyRound, Mail, User as UserIcon, MessageSquare, ArrowRight, Upload, Sparkles, Check, X, Eye, EyeOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [isForgot, setIsForgot] = useState<boolean>(false);
  
  // Login fields
  const [emailOrUsername, setEmailOrUsername] = useState<string>("");
  const [loginPassword, setLoginPassword] = useState<string>("");
  const [showLoginPassword, setShowLoginPassword] = useState<boolean>(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState<boolean>(false);

  // Register fields
  const [name, setName] = useState<string>("");
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [statusMsg, setStatusMsg] = useState<string>("Halo! Saya menggunakan LINE Dashboard.");
  const [selectedAvatar, setSelectedAvatar] = useState<string>(PRESET_AVATARS[0]);
  const [customAvatar, setCustomAvatar] = useState<string>("");
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // Forgot password fields
  const [forgotEmail, setForgotEmail] = useState<string>("");
  const [forgotSuccess, setForgotSuccess] = useState<string>("");

  // Error/Success state
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // QR Login simulation state
  const [qrToken, setQrToken] = useState<string>("");
  const [qrTimer, setQrTimer] = useState<number>(60);
  const [showQR, setShowQR] = useState<boolean>(false);
  const [qrScanned, setQrScanned] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle local File Upload
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
          setCustomAvatar(data.fileUrl);
          setSelectedAvatar(data.fileUrl);
        } else {
          setError(data.error || "Gagal mengunggah foto.");
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

  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ emailOrUsername, password: loginPassword })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess("Login berhasil! Memuat dashboard...");
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 800);
      } else {
        setError(data.error || "Login gagal. Periksa kembali detail Anda.");
      }
    } catch (err) {
      console.error(err);
      setError("Gagal terhubung ke server.");
    }
  };

  // Quick select login helper
  const handleQuickLogin = async (id: string) => {
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/auth/qr-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ targetUserId: id })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess(`Login cepat berhasil sebagai ${data.user.name}!`);
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 800);
      }
    } catch (err) {
      setError("Gagal melakukan login cepat.");
    }
  };

  // Register handler
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !email || !password) {
      setError("Silakan isi semua bidang wajib.");
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: username, // Use username as display name during registration
          username,
          email,
          password,
          avatar: PRESET_AVATARS[0],
          statusMessage: "Halo! Saya menggunakan LINE Dashboard."
        })
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess("Pendaftaran berhasil! Mengalihkan ke login...");
        setTimeout(() => {
          setIsRegister(false);
          setEmailOrUsername(username);
          setSuccess("");
        }, 1500);
      } else {
        setError(data.error || "Gagal melakukan pendaftaran.");
      }
    } catch (err) {
      console.error(err);
      setError("Gagal mendaftarkan pengguna.");
    }
  };

  // Forgot Password handler
  const handleForgot = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotSuccess("");
    if (!forgotEmail) return;

    // Simulate sending email
    setForgotSuccess("Instruksi pemulihan kata sandi telah dikirim ke email " + forgotEmail + "!");
    setForgotEmail("");
  };

  // Generate QR Token simulation
  const startQRLogin = async () => {
    try {
      const res = await fetch("/api/auth/qr-code");
      const data = await res.json();
      if (data.success) {
        setQrToken(data.qrToken);
        setShowQR(true);
        setQrTimer(60);
        setQrScanned(false);
      }
    } catch (err) {
      setError("Gagal memuat QR Code.");
    }
  };

  // Simulate scanning the QR Code
  const simulateQRScan = async () => {
    setQrScanned(true);
    setTimeout(async () => {
      try {
        const response = await fetch("/api/auth/qr-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ qrToken, targetUserId: "faisal" })
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setSuccess("Pemindaian QR sukses! Berhasil masuk...");
          setTimeout(() => {
            onLoginSuccess(data.user);
          }, 800);
        }
      } catch (err) {
        setError("QR Code Kedaluwarsa.");
      }
    }, 1500);
  };

  return (
    <div id="login-container" className="min-h-screen bg-transparent flex flex-col justify-center items-center p-4 selection:bg-indigo-500 selection:text-white">
      
      {/* Container Card */}
      <div className="w-full max-w-md bg-white/10 glass rounded-2xl shadow-2xl border border-white/15 overflow-hidden backdrop-blur-md">
        
        {/* Top Header LINE Brand */}
        <div className="bg-white/5 border-b border-white/10 p-8 text-center text-white relative">
          <h1 className="text-2xl font-black tracking-tight text-white font-display uppercase">WB TEAM CHAT</h1>
        </div>

        {/* Form Body */}
        <div className="p-8">
          
          {/* Notifications */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-3 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg text-sm font-semibold"
              >
                ⚠️ {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 p-3 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-lg text-sm font-semibold flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-indigo-400 shrink-0" /> {success}
              </motion.div>
            )}
          </AnimatePresence>

          {/* FORGOT PASSWORD VIEW */}
          {isForgot ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <h2 className="text-lg font-bold text-white mb-1">Lupa Kata Sandi</h2>
              <p className="text-white/70 text-xs leading-relaxed font-medium">
                Masukkan email Anda di bawah. Kami akan mengirimkan petunjuk untuk menyetel ulang kata sandi Anda.
              </p>

              {forgotSuccess && (
                <div className="p-3 bg-indigo-500/25 text-indigo-300 rounded-lg text-xs font-semibold border border-indigo-500/30">
                  {forgotSuccess}
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-4 h-4 text-white/50" />
                <input
                  type="email"
                  required
                  placeholder="name@email.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition-all"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => { setIsForgot(false); setForgotSuccess(""); }}
                  className="w-1/2 border border-white/10 text-white rounded-xl py-3 text-sm font-bold hover:bg-white/10 transition-all cursor-pointer"
                >
                  Kembali
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  Kirim Tautan <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          ) : isRegister ? (
            
            /* REGISTRATION VIEW */
            <form onSubmit={handleRegister} className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
              <h2 className="text-lg font-bold text-white">Daftar Akun Baru</h2>
              
              <div className="space-y-3">
                
                <div className="space-y-1">
                  <label className="text-xs text-white/60 font-semibold">Username</label>
                  <div className="relative">
                    <MessageSquare className="absolute left-3 top-3 w-4 h-4 text-white/50" />
                    <input
                      type="text"
                      required
                      placeholder="faisalsabaryanto"
                      value={username}
                      onChange={(e) => setUsername(e.target.value.toLowerCase().trim().replace(/\s/g, ''))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-white/40 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-white/60 font-semibold">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-4 h-4 text-white/50 z-10" />
                    <input
                      type="email"
                      required
                      placeholder="faisal@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-xs text-white placeholder-white/40 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs text-white/60 font-semibold">Password</label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3 w-4 h-4 text-white/50 z-10" />
                    <input
                      type={showRegisterPassword ? "text" : "password"}
                      required
                      placeholder="Min 6 karakter"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-9 pr-10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                      className="absolute right-3 top-2.5 text-white/50 hover:text-white/80 p-1 rounded transition-colors z-10 cursor-pointer"
                    >
                      {showRegisterPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1 animate-pulse"
                >
                  Daftar Sekarang <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              <p className="text-center text-xs text-white/60">
                Sudah punya akun?{" "}
                <button
                  type="button"
                  onClick={() => setIsRegister(false)}
                  className="text-indigo-400 font-bold hover:underline"
                >
                  Masuk di sini
                </button>
              </p>
            </form>
          ) : showQR ? (
            
            /* QR CODE LOGIN SIMULATION VIEW */
            <div className="text-center space-y-4">
              <h2 className="text-lg font-bold text-white">Login dengan QR Code</h2>
              <p className="text-white/75 text-xs leading-relaxed max-w-xs mx-auto font-medium">
                Buka aplikasi LINE di ponsel Anda, lalu pindai kode QR ini untuk langsung masuk.
              </p>

              {/* QR Code Graphic box */}
              <div className="relative mx-auto w-48 h-48 bg-white/5 rounded-2xl border-2 border-indigo-500/30 p-4 flex items-center justify-center shadow-inner group">
                <div className="absolute inset-0 border-4 border-indigo-500/20 m-2 rounded-xl animate-pulse"></div>
                
                {/* Mock QR Layout using block aesthetics */}
                <div className="grid grid-cols-5 gap-1.5 w-36 h-36 relative z-10">
                  {/* Top-left locator block */}
                  <div className="bg-slate-900 rounded col-span-2 row-span-2 border-4 border-slate-900 flex items-center justify-center">
                    <div className="w-4 h-4 bg-indigo-500 rounded-sm"></div>
                  </div>
                  <div className="bg-slate-900 rounded"></div>
                  {/* Top-right locator block */}
                  <div className="bg-slate-900 rounded col-span-2 row-span-2 border-4 border-slate-900 flex items-center justify-center">
                    <div className="w-4 h-4 bg-indigo-500 rounded-sm"></div>
                  </div>
                  <div className="bg-slate-900 rounded col-start-3 row-start-3"></div>
                  <div className="bg-indigo-500 rounded col-start-1 row-start-4"></div>
                  <div className="bg-slate-900 rounded col-start-2 row-start-4"></div>
                  <div className="bg-slate-900 rounded col-start-3 row-start-4"></div>
                  <div className="bg-slate-900 rounded col-start-4 row-start-3"></div>
                  <div className="bg-indigo-500 rounded col-start-5 row-start-3"></div>
                  {/* Bottom-left locator block */}
                  <div className="bg-slate-900 rounded col-span-2 row-span-2 border-4 border-slate-900 flex items-center justify-center">
                    <div className="w-4 h-4 bg-indigo-500 rounded-sm"></div>
                  </div>
                  <div className="bg-indigo-500 rounded col-start-3 row-start-5"></div>
                  <div className="bg-slate-900 rounded col-start-4 row-start-4"></div>
                  <div className="bg-indigo-500 rounded col-start-5 row-start-4"></div>
                  <div className="bg-slate-900 rounded col-start-4 row-start-5"></div>
                  <div className="bg-slate-900 rounded col-start-5 row-start-5"></div>
                </div>

                {qrScanned && (
                  <div className="absolute inset-0 bg-indigo-600/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center text-white">
                    <span className="w-10 h-10 rounded-full border-3 border-white border-t-transparent animate-spin mb-2"></span>
                    <span className="text-xs font-bold">Mengautentikasi...</span>
                  </div>
                )}
              </div>

              {!qrScanned ? (
                <button
                  type="button"
                  onClick={simulateQRScan}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Pindai dengan Ponsel (Simulasi)
                </button>
              ) : (
                <p className="text-indigo-400 text-xs font-bold animate-pulse">
                  Berhasil dipindai! Menghubungkan...
                </p>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowQR(false)}
                  className="w-full border border-white/10 text-white rounded-xl py-3.5 text-sm font-bold hover:bg-white/10 transition-all cursor-pointer"
                >
                  Kembali ke Login Sandi
                </button>
              </div>
            </div>
          ) : (
            
            /* TRADITIONAL LOGIN VIEW */
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-4">
                
                {/* Email or Username input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wider">
                    Email atau Username
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3.5 w-4 h-4 text-white/50 z-10" />
                    <input
                      type="text"
                      required
                      placeholder="name@email.com atau username"
                      value={emailOrUsername}
                      onChange={(e) => setEmailOrUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-10 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition-all"
                    />
                  </div>
                </div>

                {/* Password input */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-white/60 uppercase tracking-wider">
                      Kata Sandi
                    </label>
                    <button
                      type="button"
                      onClick={() => { setIsForgot(true); setError(""); }}
                      className="text-xs text-indigo-400 font-bold hover:underline cursor-pointer"
                    >
                      Lupa?
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-3.5 w-4 h-4 text-white/50 z-10" />
                    <input
                      type={showLoginPassword ? "text" : "password"}
                      required
                      placeholder="Sandi Anda"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-10 pr-12 text-sm text-white placeholder-white/40 focus:outline-none focus:border-indigo-400 focus:bg-white/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3.5 top-3 text-white/50 hover:text-white/85 p-1 rounded transition-colors z-10 cursor-pointer flex items-center justify-center"
                    >
                      {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit login */}
              <div>
                <button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3.5 text-sm font-bold shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-98"
                >
                  Masuk Ke Dashboard <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Footer Register Link */}
              <p className="text-center text-xs text-white/60">
                Belum punya akun?{" "}
                <button
                  type="button"
                  onClick={() => { setIsRegister(true); setError(""); }}
                  className="text-indigo-400 font-bold hover:underline"
                >
                  Daftar di sini
                </button>
              </p>
            </form>
          )}

        </div>
      </div>

    </div>
  );
}
