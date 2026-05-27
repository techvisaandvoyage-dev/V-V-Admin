import { Loader2 } from "lucide-react";
import { cn } from "../../utils/cn";

const Loader = ({ className = "", size = 24, label = "" }) => {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12", className)}>
      <Loader2 
        size={size} 
        className="text-cyan animate-spin" 
      />
      {label && (
        <p className="text-sm font-medium text-text-muted animate-pulse">
          {label}
        </p>
      )}
    </div>
  );
};

export const FullPageLoader = () => (
  <div className="fixed inset-0 z-[9999] bg-background/80 backdrop-blur-sm flex items-center justify-center">
    <Loader size={40} label="Loading VisaAndVoyage..." />
  </div>
);

export default Loader;
