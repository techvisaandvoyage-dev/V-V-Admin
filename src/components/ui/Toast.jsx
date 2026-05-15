// ============================================================
//  Toast Notification Component
//  Shows success/error/info messages. Auto-dismisses after 3s.
//  Reads from & clears the uiStore toast state.
// ============================================================
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Info, X } from "lucide-react";
import { useUIStore } from "../../store/uiStore";

const Toast = () => {
  const { toast, clearToast } = useUIStore();

  // ── Auto-dismiss after 3 seconds ─────────────────────────
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, 3500);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  // ── Icon and color per type ───────────────────────────────
  const config = {
    success: {
      icon: <CheckCircle size={20} className="text-emerald-400" />,
      class: "border-emerald-500/50 text-white bg-slate-900/95 shadow-emerald-500/10",
    },
    error: {
      icon: <XCircle size={20} className="text-red-400" />,
      class: "border-red-500/50 text-white bg-slate-900/95 shadow-red-500/10",
    },
    info: {
      icon: <Info size={20} className="text-cyan" />,
      class: "border-cyan/50 text-white bg-slate-900/95 shadow-cyan/10",
    },
  };

  const cfg = config[toast?.type] || config.info;

  return (
    <AnimatePresence>
      {toast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm pointer-events-none flex justify-center">
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={`
              pointer-events-auto
              w-full flex items-center gap-3 px-5 py-4
              rounded-2xl border backdrop-blur-xl shadow-2xl
              ${cfg.class}
            `}
            role="alert"
            aria-live="polite"
          >
            <span className="flex-shrink-0">{cfg.icon}</span>
            <span className="text-sm font-medium flex-1">{toast.message}</span>
            <button
              onClick={clearToast}
              className="ml-2 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity p-1"
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
