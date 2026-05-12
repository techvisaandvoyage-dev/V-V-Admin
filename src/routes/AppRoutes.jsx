import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { Loader2 } from "lucide-react";

// ── Lazy loaded Pages ───────────────────────────────────────────
const Login = lazy(() => import("../pages/Login"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const Details = lazy(() => import("../pages/Details"));

// ── Fallback Loader ────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-cyan animate-spin" />
  </div>
);

const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/application/:id"
          element={
            <ProtectedRoute requiredRole="admin">
              <Details />
            </ProtectedRoute>
          }
        />

        <Route
          path="/:activeTab?"
          element={
            <ProtectedRoute requiredRole="admin">
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Fallback to Dashboard */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
