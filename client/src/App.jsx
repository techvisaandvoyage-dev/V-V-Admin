// ============================================================
//  App.jsx — Root Entry
//  Sets up React Router and Providers
// ============================================================
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Toast from "./components/ui/Toast";
import AppRoutes from "./routes/AppRoutes";

// ── React Query client (for future API calls) ──────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes
      retry: 1,
    },
  },
});

import { useEffect } from "react";

// ── Project Integrity & Licensing ─────────────────────────────
// This code protects the project from unauthorized resale.
const useIntegrity = () => {
  useEffect(() => {
    // 1. Console Watermark (Proof of Ownership)
    console.log(
      "%c Visa & Voyage %c AUTHORIZED BUILD %c © 2026 Yash Raj Singh ",
      "background: #00d4ff; color: #0a0a0a; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;",
      "background: #171717; color: #f5f5f5; font-weight: bold; padding: 4px 8px;",
      "background: #f5a623; color: #0a0a0a; font-weight: bold; padding: 4px 8px; border-radius: 0 4px 4px 0;"
    );
    console.log("%c Unique ID: VG-9921-XQ77-YASH-2026 | Verified Owner: yashrajsingh28359@gmail.com", "color: #71717a; font-style: italic;");
    
    // 2. Hidden "Kill Switch" indicator
    window.__VG_LICENSE__ = {
      owner: "Yash Raj Singh",
      contact: "yashrajsingh28359@gmail.com",
      serial: "VG-9921-XQ77-YASH-2026",
      verified: true,
      timestamp: new Date().toISOString()
    };
  }, []);
};

function App() {
  useIntegrity(); // Initializing integrity check
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* Global toast notification */}
        <Toast />
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;


