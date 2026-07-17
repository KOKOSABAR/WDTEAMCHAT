import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X, Bell, HelpCircle } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info" | "message";

export interface Toast {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
  duration?: number;
  avatar?: string;
}

interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  okText: string;
  cancelText: string;
  type: "danger" | "warning" | "info";
  resolve: (value: boolean) => void;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, title?: string, duration?: number, avatar?: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  removeToast: (id: string) => void;
  confirm: (
    message: string,
    title?: string,
    type?: "danger" | "warning" | "info",
    okText?: string,
    cancelText?: string
  ) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmConfig | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "info", title?: string, duration = 4000, avatar?: string) => {
      const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Default titles if not provided
      let defaultTitle = title;
      if (!defaultTitle) {
        switch (type) {
          case "success":
            defaultTitle = "Berhasil";
            break;
          case "error":
            defaultTitle = "Kesalahan";
            break;
          case "warning":
            defaultTitle = "Peringatan";
            break;
          case "info":
            defaultTitle = "Informasi";
            break;
          case "message":
            defaultTitle = "Pesan Baru";
            break;
        }
      }

      setToasts((prev) => [...prev, { id, message, title: defaultTitle, type, duration, avatar }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((message: string, title?: string) => toast(message, "success", title), [toast]);
  const error = useCallback((message: string, title?: string) => toast(message, "error", title), [toast]);
  const warning = useCallback((message: string, title?: string) => toast(message, "warning", title), [toast]);
  const info = useCallback((message: string, title?: string) => toast(message, "info", title), [toast]);

  const confirm = useCallback(
    (
      message: string,
      title = "Konfirmasi Tindakan",
      type: "danger" | "warning" | "info" = "info",
      okText = "Ya, Lanjutkan",
      cancelText = "Batal"
    ): Promise<boolean> => {
      return new Promise((resolve) => {
        setConfirmConfig({
          isOpen: true,
          title,
          message,
          okText,
          cancelText,
          type,
          resolve
        });
      });
    },
    []
  );

  const handleConfirmSelect = (value: boolean) => {
    if (confirmConfig) {
      confirmConfig.resolve(value);
      setConfirmConfig(null);
    }
  };

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, removeToast, confirm }}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-3 w-full max-w-sm pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      </div>

      {/* Luxury Custom Confirmation Dialog Modal */}
      <AnimatePresence>
        {confirmConfig && confirmConfig.isOpen && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop Blur Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleConfirmSelect(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md cursor-pointer"
            />

            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 350, damping: 26 }}
              className="relative overflow-hidden bg-slate-900/95 border border-white/10 rounded-2xl max-w-sm w-full p-6 text-white shadow-2xl z-10 flex flex-col items-center text-center"
            >
              {/* Background Glow Ring */}
              <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full blur-[48px] pointer-events-none opacity-20 ${
                confirmConfig.type === "danger" ? "bg-rose-500" : confirmConfig.type === "warning" ? "bg-amber-500" : "bg-indigo-500"
              }`} />

              {/* Icon Header */}
              <div className={`w-14 h-14 rounded-full flex items-center justify-center border mb-4 shadow-inner ${
                confirmConfig.type === "danger" 
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-400" 
                  : confirmConfig.type === "warning" 
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                  : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
              }`}>
                {confirmConfig.type === "danger" ? (
                  <XCircle className="w-7 h-7 animate-pulse" />
                ) : confirmConfig.type === "warning" ? (
                  <AlertTriangle className="w-7 h-7 animate-pulse" />
                ) : (
                  <HelpCircle className="w-7 h-7" />
                )}
              </div>

              {/* Title & Description */}
              <h3 className="font-extrabold text-base tracking-wide text-white mb-2 leading-tight">
                {confirmConfig.title}
              </h3>
              <p className="text-xs text-slate-300 font-medium leading-relaxed mb-6 whitespace-pre-line">
                {confirmConfig.message}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => handleConfirmSelect(false)}
                  className="w-1/2 border border-white/10 hover:border-white/20 text-slate-300 hover:text-white hover:bg-white/5 rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer"
                >
                  {confirmConfig.cancelText}
                </button>
                <button
                  onClick={() => handleConfirmSelect(true)}
                  className={`w-1/2 rounded-xl py-2.5 text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-lg flex items-center justify-center gap-1.5 ${
                    confirmConfig.type === "danger"
                      ? "bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-600/15"
                      : confirmConfig.type === "warning"
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-amber-500/15"
                      : "bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-indigo-600/15"
                  }`}
                >
                  {confirmConfig.okText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const getColorsAndIcon = () => {
    switch (toast.type) {
      case "success":
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-bounce" />,
          accent: "from-emerald-500/20 to-emerald-500/5",
          border: "border-emerald-500/30 hover:border-emerald-500/50",
          glow: "shadow-emerald-500/10",
          barColor: "bg-gradient-to-r from-emerald-400 to-teal-400"
        };
      case "error":
        return {
          icon: <XCircle className="w-5 h-5 text-rose-400 animate-pulse" />,
          accent: "from-rose-500/20 to-rose-500/5",
          border: "border-rose-500/30 hover:border-rose-500/50",
          glow: "shadow-rose-500/10",
          barColor: "bg-gradient-to-r from-rose-400 to-pink-500"
        };
      case "warning":
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
          accent: "from-amber-500/20 to-amber-500/5",
          border: "border-amber-500/30 hover:border-amber-500/50",
          glow: "shadow-amber-500/10",
          barColor: "bg-gradient-to-r from-amber-400 to-orange-400"
        };
      case "message":
        return {
          icon: toast.avatar ? (
            <img src={toast.avatar} alt="avatar" className="w-10 h-10 rounded-full object-cover border-2 border-green-500/40 shadow-sm" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-400 border border-green-500/30 font-semibold">
              <Bell className="w-5 h-5 text-green-400" />
            </div>
          ),
          accent: "from-green-500/20 to-green-500/5",
          border: "border-green-500/30 hover:border-green-500/50",
          glow: "shadow-green-500/10",
          barColor: "bg-gradient-to-r from-green-400 to-emerald-500"
        };
      case "info":
      default:
        return {
          icon: <Info className="w-5 h-5 text-sky-400" />,
          accent: "from-sky-500/20 to-sky-500/5",
          border: "border-sky-500/30 hover:border-sky-500/50",
          glow: "shadow-sky-500/10",
          barColor: "bg-gradient-to-r from-sky-400 to-indigo-400"
        };
    }
  };

  const config = getColorsAndIcon();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
      className={`relative overflow-hidden flex flex-col bg-slate-900/95 backdrop-blur-md rounded-2xl ${config.border} border shadow-xl ${config.glow} transition-colors duration-300 pointer-events-auto group max-w-sm w-full`}
    >
      {/* Background radial accent glow */}
      <div className={`absolute top-0 left-0 w-full h-full bg-gradient-to-br ${config.accent} opacity-40 pointer-events-none`} />

      <div className="relative p-4 flex gap-3 items-start">
        {/* Left Icon / Avatar wrapper */}
        <div className="flex-shrink-0 mt-0.5">
          {config.icon}
        </div>

        {/* Content */}
        <div className="flex-grow min-w-0 pr-4">
          {toast.title && (
            <h4 className="text-sm font-semibold text-white tracking-wide mb-0.5">
              {toast.title}
            </h4>
          )}
          <p className="text-xs text-slate-300 leading-relaxed break-words font-medium">
            {toast.message}
          </p>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          className="flex-shrink-0 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Modern Visual Countdown Timer Bar */}
      {toast.duration && toast.duration > 0 && (
        <div className="w-full h-1 bg-slate-800/60 overflow-hidden">
          <motion.div
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: toast.duration / 1000, ease: "linear" }}
            className={`h-full ${config.barColor}`}
          />
        </div>
      )}
    </motion.div>
  );
};
