// ============================================================
//  Modal Component
//  Overlay portal modal with slide-up animation.
//  Used for Country Manager, confirmations, and login forms.
// ============================================================
import { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * @param {boolean}  isOpen      — Controls visibility
 * @param {function} onClose     — Called when backdrop/X is clicked
 * @param {string}   title       — Modal header title
 * @param {"sm"|"md"|"lg"|"xl"} size
 * @param {boolean} closeOnBackdropClick — when false, clicking the backdrop does not call onClose
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  hideCloseButton = false,
  closeOnBackdropClick = true,
  footer,
}) => {
  // ── Lock body scroll when modal is open ──────────────────
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  // ── Close on Escape key (only when backdrop close is allowed) ──
  useEffect(() => {
    if (!isOpen || !closeOnBackdropClick) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, closeOnBackdropClick]);

  // ── Width sizes ───────────────────────────────────────────
  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        // Backdrop
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
          onClick={closeOnBackdropClick ? onClose : undefined}
          aria-modal="true"
          role="dialog"
          aria-label={title}
        >
          {/* Modal panel */}
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={`
              w-full ${sizes[size]}
              bg-surface border border-border rounded-2xl shadow-modal
              flex flex-col max-h-[90vh] overflow-hidden
            `}
            onClick={(e) => e.stopPropagation()} // Prevent close when clicking inside
          >
            {/* ── Header ── */}
            {(title || !hideCloseButton) && (
              <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                {title && (
                  <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
                )}
                {!hideCloseButton && (
                  <button
                    id="modal-close-btn"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 transition-colors"
                    aria-label="Close modal"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            {/* ── Body ── */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
              {children}
            </div>

            {/* ── Footer (optional) ── */}
            {footer && (
              <div className="px-6 py-4 border-t border-border bg-surface-2">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default Modal;
