import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

/**
 * @param {"primary"|"secondary"|"ghost"|"danger"|"gold"} variant
 * @param {"sm"|"md"|"lg"} size
 * @param {boolean} loading
 * @param {ReactNode} leftIcon
 * @param {ReactNode} rightIcon
 * @param {boolean} fullWidth
 */
const Button = ({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className = "",
  onClick,
  type = "button",
  ...props
}) => {
  const variants = {
    primary:
      "bg-cyan text-background font-semibold hover:bg-cyan-dim shadow-cyan-glow hover:shadow-cyan-glow-lg",
    secondary:
      "bg-transparent border border-cyan text-cyan hover:bg-cyan/10",
    ghost:
      "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-3",
    danger:
      "bg-red-500/10 border border-red-500/40 text-red-400 hover:bg-red-500/20",
    gold:
      "bg-gold text-background font-semibold hover:bg-gold-dim shadow-gold-glow",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-5 py-2.5 text-sm gap-2",
    lg: "px-7 py-3.5 text-base gap-2.5",
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      whileHover={!isDisabled ? { scale: 1.02 } : {}}
      whileTap={!isDisabled ? { scale: 0.97 } : {}}
      className={cn(
        "inline-flex items-center justify-center rounded-xl font-medium transition-all duration-200 cursor-pointer",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
        className
      )}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : leftIcon ? (
        <span className="flex-shrink-0">{leftIcon}</span>
      ) : null}

      <span>{children}</span>

      {!loading && rightIcon && (
        <span className="flex-shrink-0">{rightIcon}</span>
      )}
    </motion.button>
  );
};

export default Button;
