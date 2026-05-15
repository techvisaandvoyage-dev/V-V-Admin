import { cn } from "../../utils/cn";

/**
 * @param {string}    label       — Field label
 * @param {string}    error       — Error message
 * @param {string}    helper      — Helper text
 * @param {Array}     options     — Array of {value, label}
 * @param {string}    placeholder — Empty option label
 */
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
        className={cn(
          "w-full bg-surface-2 text-text-primary",
          "border rounded-xl transition-all duration-200 [color-scheme:dark]",
          "px-4 py-2.5 text-sm cursor-pointer",
          "focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan",
          error ? "border-red-500/50" : "border-border",
          className
        )}
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
      {!error && helper && <p className="text-xs text-text-muted">{helper}</p>}
    </div>
  );
};

export default Select;
