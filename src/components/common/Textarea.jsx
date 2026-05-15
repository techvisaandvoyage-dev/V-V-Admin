import { cn } from "../../utils/cn";

/**
 * @param {string}    label       — Field label
 * @param {string}    error       — Error message
 * @param {string}    helper      — Helper text
 * @param {number}    rows        — Number of rows
 */
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
        className={cn(
          "w-full bg-surface-2 text-text-primary placeholder-text-muted",
          "border rounded-xl transition-all duration-200 resize-none [color-scheme:dark]",
          "px-4 py-2.5 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan",
          error ? "border-red-500/50" : "border-border",
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
      {!error && helper && <p className="text-xs text-text-muted">{helper}</p>}
    </div>
  );
};

export default Textarea;
