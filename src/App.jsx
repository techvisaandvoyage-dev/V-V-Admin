import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes/AppRoutes";
import { useUIStore } from "./store/uiStore";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function App() {
  const { toast, hideToast } = useUIStore();
  const configuredBase = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const routerBase = configuredBase && configuredBase !== "/" ? configuredBase : undefined;

  return (
    <BrowserRouter
      basename={routerBase}
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <div className="min-h-screen bg-background text-text-primary selection:bg-cyan/30">
        <AppRoutes />

        {/* Global Toast Notification */}
        <AnimatePresence>
          {toast?.show && (
            <motion.div
              initial={{ opacity: 0, y: 50, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 20, x: "-50%" }}
              className="fixed bottom-8 left-1/2 z-[9999] min-w-[320px]"
            >
              <div className="bg-surface-2 border border-border/50 backdrop-blur-xl p-4 rounded-2xl shadow-2xl flex items-center gap-4">
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                  ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 
                    toast.type === 'error' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}
                `}>
                  {toast.type === 'success' ? <CheckCircle size={20} /> : 
                   toast.type === 'error' ? <AlertCircle size={20} /> : <Info size={20} />}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{toast.message}</p>
                </div>
                <button 
                  onClick={hideToast}
                  className="p-1 hover:bg-white/5 rounded-lg transition-colors text-text-muted"
                >
                  <X size={16} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </BrowserRouter>
  );
}

export default App;
