import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import { getAdminAppUrl } from "../utils/adminAppUrl";

/**
 * @param {string} requiredRole — "user" | "admin" | undefined (any auth)
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  // Not logged in OR session corrupted (token present but user null) → redirect to login
  if (!isAuthenticated || !user) {
    if (requiredRole === "admin") {
      window.location.replace(getAdminAppUrl("/login"));
      return null;
    }
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role mismatch → redirect appropriately
  // Normalize: if backend didn't return a role, assume "user"
  const effectiveRole = user.role || "user";

  if (requiredRole && effectiveRole !== requiredRole) {
    // Admin can view user pages (superuser behaviour)
    if (effectiveRole === "admin" && requiredRole === "user") {
      return children;
    }
    // Regular user trying to access admin → back to their dashboard
    if (effectiveRole === "admin") {
      window.location.replace(getAdminAppUrl("/"));
      return null;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default ProtectedRoute;
