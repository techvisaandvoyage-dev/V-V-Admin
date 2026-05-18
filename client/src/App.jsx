// ============================================================
//  App.jsx — Root Entry
//  Sets up React Router and Providers
// ============================================================
import { useEffect } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Toast from "./components/ui/Toast";
import ClientErrorBoundary from "./components/ClientErrorBoundary";
import FirebaseGoogleRedirectHandler from "./components/auth/FirebaseGoogleRedirectHandler";
import ExitIntentBanner from "./components/common/ExitIntentBanner";
import AppRoutes from "./routes/AppRoutes";

/** Outside Suspense so lazy routes still reset scroll on SPA navigation. */
const ScrollToTop = () => {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname, location.key]);
  return null;
};

// ── React Query client (for future API calls) ──────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,  // 5 minutes
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <FirebaseGoogleRedirectHandler />
        <ExitIntentBanner />
        {/* Global toast notification */}
        <Toast />
        <ClientErrorBoundary>
          <AppRoutes />
        </ClientErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

