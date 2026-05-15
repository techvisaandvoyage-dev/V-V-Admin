import { useEffect } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../utils/cn";

/**
 * @param {boolean}  isOpen      — Controls visibility
 * @param {function} onClose     — Called when backdrop/X is clicked
 * @param {string}   title       — Modal header title
 * @param {"sm"|"md"|"lg"|"xl"|"full"} size
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  hideCloseButton = false,
  footer,
  className = "",
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
    full: "max-w-none",
  };

  const isFullScreen = size === "full";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            "fixed inset-0 z-50 flex bg-black/70",
            isFullScreen ? "items-stretch justify-stretch p-0" : "items-center justify-center p-4"
          )}
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-label={title}
        >
          <motion.div
            key="modal-panel"
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className={cn(
              "w-full bg-surface border border-border shadow-modal flex flex-col overflow-hidden",
              sizes[size],
              isFullScreen ? "h-screen rounded-none border-0" : "max-h-[90vh] rounded-2xl",
              className
            )}
            onClick={(e) => e.stopPropagation()}
          >
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

            <div className={cn("flex-1 overflow-y-auto px-6 py-5")}>
              {children}
            </div>

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
