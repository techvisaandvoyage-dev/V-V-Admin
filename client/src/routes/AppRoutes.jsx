import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { Loader2 } from "lucide-react";
import { getAdminAppUrl } from "../utils/adminAppUrl";

// ── Lazy loaded Pages ───────────────────────────────────────────
const LandingPage         = lazy(() => import("../pages/LandingPage"));
const LoginPage           = lazy(() => import("../pages/LoginPage"));
const RegisterPage        = lazy(() => import("../pages/RegisterPage"));
const UserDashboard       = lazy(() => import("../pages/UserDashboard"));
const ProfilePage         = lazy(() => import("../pages/ProfilePage"));
const ApplicationDetails  = lazy(() => import("../pages/ApplicationDetails"));
const ApplicationForm     = lazy(() => import("../pages/ApplicationForm"));
const CountryDetails      = lazy(() => import("../pages/CountryDetails"));
const AllDestinationsPage = lazy(() => import("../pages/AllDestinationsPage"));

// ── Fallback Loader ────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 text-cyan animate-spin" />
  </div>
);

const AdminAppRedirect = () => {
  const location = useLocation();

  useEffect(() => {
    const adminPath = location.pathname.replace(/^\/admin/, "") || "/";
    const fullPath = `${adminPath}${location.search}${location.hash}`;
    window.location.replace(getAdminAppUrl(fullPath));
  }, [location]);

  return <PageLoader />;
};


// ── 404 Not Found ──────────────────────────────────────────
const NotFound = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center text-center px-4">
    <div className="text-8xl mb-6">🛂</div>
    <h1 className="text-4xl font-bold text-text-primary mb-3">404 — Page Not Found</h1>
    <p className="text-text-secondary mb-8 max-w-md">
      The page you're looking for doesn't exist or has been moved.
    </p>
    <a
      href="/"
      className="px-6 py-3 bg-cyan text-background font-semibold rounded-xl hover:bg-cyan-dim transition-colors"
    >
      Return Home
    </a>
  </div>
);

// ── Routes Map ──────────────────────────────────────────────
const AppRoutes = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ── Public routes ── */}
        <Route path="/" element={<LandingPage />} />
      <Route path="/destinations" element={<AllDestinationsPage />} />
      <Route path="/destination/:countryId" element={<CountryDetails />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* ── User-protected routes ── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredRole="user">
            <UserDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/profile"
        element={
          <ProtectedRoute requiredRole="user">
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/application/:id"
        element={
          <ProtectedRoute requiredRole="user">
            <ApplicationDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard/*"
        element={
          <ProtectedRoute requiredRole="user">
            <UserDashboard />
          </ProtectedRoute>
        }
      />

      {/* Application form — accessible by any authenticated user */}
      <Route
        path="/apply"
        element={
          <ProtectedRoute>
            <ApplicationForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apply/:countryId"
        element={
          <ProtectedRoute>
            <ApplicationForm />
          </ProtectedRoute>
        }
      />



      {/* ── 404 fallback ── */}
      {/* Redirect old client-side admin URLs to the dedicated admin app */}
      <Route path="/admin/*" element={<AdminAppRedirect />} />

      <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;

