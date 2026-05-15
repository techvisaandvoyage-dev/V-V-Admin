import { Search, X } from "lucide-react";
import { cn } from "../../utils/cn";

const SearchBar = ({ 
  value, 
  onChange, 
  placeholder = "Search...", 
  className = "",
  id = "search-bar"
}) => {
  return (
    <div className={cn("relative flex items-center group", className)}>
      <Search 
        size={16} 
        className="absolute left-3 text-text-muted group-focus-within:text-cyan transition-colors" 
      />
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full bg-surface-2 border border-border text-text-primary text-sm rounded-xl pl-9 pr-9 py-2.5",
          "focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan",
          "placeholder-text-muted transition-all"
        )}
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 p-0.5 rounded-md hover:bg-surface-3 text-text-muted hover:text-text-primary transition-colors"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default SearchBar;
