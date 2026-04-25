// ============================================================
//  Input Component
//  Dark-themed input with left icon, right icon, label,
//  error/helper text, and focus ring animation.
// ============================================================

/**
 * @param {string}    label       — Field label shown above input
 * @param {string}    error       — Error message (red)
 * @param {string}    helper      — Helper text (muted)
 * @param {ReactNode} leftIcon    — Icon displayed on left side
 * @param {ReactNode} rightIcon   — Icon displayed on right side (e.g., toggle)
 * @param {boolean}   fullWidth
 */
const Input = ({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  fullWidth = true,
  id,
  className = "",
  type = "text",
  ...props
}) => {
  // Generate a unique id if not provided (for label association)
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={`flex flex-col gap-1.5 ${fullWidth ? "w-full" : ""}`}>
      {/* ── Label ── */}
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      )}

      {/* ── Input wrapper ── */}
      <div className="relative flex items-center">
        {/* Left icon */}
        {leftIcon && (
          <span className="absolute left-3 text-text-muted pointer-events-none z-10">
            {leftIcon}
          </span>
        )}

        {/* The input itself */}
        <input
          id={inputId}
          type={type}
          className={`
            w-full bg-surface-2 text-text-primary placeholder-text-muted
            border rounded-xl transition-all duration-200 [color-scheme:dark]
            ${error ? "border-red-500/50" : "border-border"}
            ${leftIcon ? "pl-10" : "pl-4"}
            ${rightIcon ? "pr-10" : "pr-4"}
            py-2.5 text-sm
            focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan
            ${className}
          `}
          {...props}
        />

        {/* Right icon */}
        {rightIcon && (
          <span className="absolute right-3 text-text-muted z-10">
            {rightIcon}
          </span>
        )}
      </div>

      {/* ── Error or helper text ── */}
      {error && (
        <p className="text-xs text-red-400 mt-0.5">{error}</p>
      )}
      {!error && helper && (
        <p className="text-xs text-text-muted mt-0.5">{helper}</p>
      )}
    </div>
  );
};

// ── Textarea variant ───────────────────────────────────────
export const Textarea = ({
  label, error, helper, id, rows = 4, className = "", ...props
}) => {
  const inputId = id || `textarea-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        rows={rows}
        className={`
          w-full bg-surface-2 text-text-primary placeholder-text-muted
          border rounded-xl transition-all duration-200 resize-none [color-scheme:dark]
          ${error ? "border-red-500/50" : "border-border"}
          px-4 py-2.5 text-sm
          focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!error && helper && <p className="text-xs text-text-muted">{helper}</p>}
    </div>
  );
};

// ── Select variant ─────────────────────────────────────────
export const Select = ({
  label, error, helper, id, options = [], placeholder, className = "", ...props
}) => {
  const inputId = id || `select-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <select
        id={inputId}
        className={`
          w-full bg-surface-2 text-text-primary
          border rounded-xl transition-all duration-200 [color-scheme:dark]
          ${error ? "border-red-500/50" : "border-border"}
          px-4 py-2.5 text-sm cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan
          ${className}
        `}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
};

export default Input;
