import { cn } from "../../utils/cn";

/**
 * @param {string}    label       — Field label shown above input
 * @param {string}    error       — Error message (red)
 * @param {string}    helper      — Helper text (muted)
 * @param {ReactNode} leftIcon    — Icon displayed on left side
 * @param {ReactNode} rightIcon   — Icon displayed on right side
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
  const inputId = id || `input-${label?.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className={cn("flex flex-col gap-1.5", fullWidth ? "w-full" : "")}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-text-secondary"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <span className="absolute left-3 text-text-muted pointer-events-none z-10">
            {leftIcon}
          </span>
        )}

        <input
          id={inputId}
          type={type}
          className={cn(
            "w-full bg-surface-2 text-text-primary placeholder-text-muted",
            "border rounded-xl transition-all duration-200 [color-scheme:dark]",
            "py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan",
            error ? "border-red-500/50" : "border-border",
            leftIcon ? "pl-10" : "pl-4",
            rightIcon ? "pr-10" : "pr-4",
            className
          )}
          {...props}
        />

        {rightIcon && (
          <span className="absolute right-3 text-text-muted z-10">
            {rightIcon}
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-400 mt-0.5">{error}</p>
      )}
      {!error && helper && (
        <p className="text-xs text-text-muted mt-0.5">{helper}</p>
      )}
    </div>
  );
};

export default Input;
