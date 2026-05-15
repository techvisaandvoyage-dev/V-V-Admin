import { motion } from "framer-motion";
import { cn } from "../../utils/cn";

/**
 * @param {boolean} glass    — Use glassmorphism style
 * @param {boolean} hoverable — Enable lift + border glow on hover
 * @param {boolean} bordered  — Show cyan border glow
 * @param {"sm"|"md"|"lg"|"none"} padding
 */
const Card = ({
  children,
  glass = false,
  hoverable = false,
  bordered = false,
  padding = "md",
  className = "",
  onClick,
  ...props
}) => {
  const paddings = {
    none: "",
    sm:   "p-4",
    md:   "p-6",
    lg:   "p-8",
  };

  const baseStyles = glass
    ? "glass rounded-2xl"
    : "bg-surface rounded-2xl border border-border";

  const hoverStyles = hoverable
    ? "cursor-pointer transition-all duration-300 hover:border-cyan/30 hover:shadow-cyan-glow"
    : "";

  const borderedStyle = bordered ? "border-glow-cyan" : "";

  return (
    <motion.div
      onClick={onClick}
      whileHover={hoverable ? { y: -4 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={cn(
        baseStyles,
        paddings[padding],
        hoverStyles,
        borderedStyle,
        "shadow-card",
        className
      )}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;
