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
      icon: <CheckCircle size={18} />,
      class: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10",
    },
    error: {
      icon: <XCircle size={18} />,
      class: "border-red-500/40 text-red-400 bg-red-500/10",
    },
    info: {
      icon: <Info size={18} />,
      class: "border-cyan/40 text-cyan bg-cyan/10",
    },
  };

  const cfg = config[toast?.type] || config.info;

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key="toast"
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`
            fixed top-6 right-6 z-[100]
            flex items-center gap-3 px-4 py-3
            rounded-xl border backdrop-blur-md shadow-modal
            ${cfg.class}
          `}
          role="alert"
          aria-live="polite"
        >
          <span className="flex-shrink-0">{cfg.icon}</span>
          <span className="text-sm font-medium">{toast.message}</span>
          <button
            onClick={clearToast}
            className="ml-2 flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Toast;
