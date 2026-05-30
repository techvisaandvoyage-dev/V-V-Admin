// ============================================================
//  Badge Component
//  Displays status labels with color-coded styles.
//  Variants map to BOOKING_STATUS values.
// ============================================================

/**
 * @param {"pending"|"approved"|"review"|"rejected"|"submitted"|"easy"|"moderate"|"hard"} variant
 * @param {boolean} dot  — show animated status dot
 * @param {"sm"|"md"} size
 */
const Badge = ({ children, variant = "pending", dot = false, size = "md", className = "" }) => {
  // ── Variant color map ────────────────────────────────────
  const variants = {
    // Booking statuses
    pending:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
    approved:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    review:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
    rejected:  "bg-red-500/15 text-red-400 border-red-500/30",
    submitted: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
    pending_payment: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    doc_pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",

    // Difficulty levels
    easy:      "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    moderate:  "bg-amber-500/15 text-amber-400 border-amber-500/30",
    hard:      "bg-red-500/15 text-red-400 border-red-500/30",

    // Neutral / general
    default:   "bg-surface-3 text-text-secondary border-border",
    cyan:      "bg-cyan/10 text-cyan border-cyan/30",
    gold:      "bg-gold/10 text-gold border-gold/30",
  };

  // Dot color matches badge color
  const dotColors = {
    pending:   "bg-amber-400",
    approved:  "bg-emerald-400",
    review:    "bg-blue-400",
    rejected:  "bg-red-400",
    submitted: "bg-purple-400",
    cancelled: "bg-zinc-400",
    pending_payment: "bg-orange-400",
    doc_pending: "bg-amber-400",
    easy:      "bg-emerald-400",
    moderate:  "bg-amber-400",
    hard:      "bg-red-400",
    default:   "bg-text-muted",
    cyan:      "bg-cyan",
    gold:      "bg-gold",
  };

  const sizes = {
    sm: "px-2 py-0.5 text-2xs",
    md: "px-2.5 py-1 text-xs",
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium border
        ${variants[variant] || variants.default}
        ${sizes[size]}
        ${className}
      `}
    >
      {/* Optional animated dot */}
      {dot && (
        <span
          className={`
            w-1.5 h-1.5 rounded-full flex-shrink-0 status-dot-pulse
            ${dotColors[variant] || "bg-text-muted"}
          `}
        />
      )}
      {children}
    </span>
  );
};

// ── Convenience exports for specific statuses ──────────────
export const StatusBadge = ({ status, ...props }) => {
  if (status === "dash") {
    return <span className="text-text-muted px-2 py-1">-</span>;
  }

  const labels = {
    pending:   "Pending Payment",
    approved:  "Approved",
    review:    "Under Review",
    rejected:  "Rejected",
    submitted: "Submitted",
    cancelled: "Cancelled",
    pending_payment: "Pending Payment",
    doc_pending: "Missing Documents",
  };
  return (
    <Badge variant={status} dot {...props}>
      {labels[status] || status}
    </Badge>
  );
};

export default Badge;
