// ============================================================
//  Card Component
//  Glassmorphism card with optional hover lift effect.
//  Used as the base container throughout the app.
// ============================================================
import { motion } from "framer-motion";

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
  // ── Padding sizes ────────────────────────────────────────
  const paddings = {
    none: "",
    sm:   "p-4",
    md:   "p-6",
    lg:   "p-8",
  };

  // ── Base styles ───────────────────────────────────────────
  const baseStyles = glass
    ? "glass rounded-2xl"
    : "bg-surface rounded-2xl border border-border";

  // ── Hover styles ──────────────────────────────────────────
  const hoverStyles = hoverable
    ? "cursor-pointer transition-all duration-300 hover:border-cyan/30 hover:shadow-cyan-glow"
    : "";

  // ── Bordered style ────────────────────────────────────────
  const borderedStyle = bordered ? "border-glow-cyan" : "";

  return (
    <motion.div
      onClick={onClick}
      whileHover={hoverable ? { y: -4 } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`
        ${baseStyles}
        ${paddings[padding]}
        ${hoverStyles}
        ${borderedStyle}
        shadow-card
        ${className}
      `}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export default Card;
