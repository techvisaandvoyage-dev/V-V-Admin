import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";

/**
 * @param {string} requiredRole — "user" | "admin" | undefined (any auth)
 */
const ProtectedRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();

  // Not logged in OR session corrupted (token present but user null) → redirect to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role mismatch → redirect appropriately
  // Normalize: if backend didn't return a role, assume "user"
  const effectiveRole = user.role || "user";

  if (requiredRole && effectiveRole !== requiredRole) {
    // Keep admin app self-contained: wrong-role users should authenticate here.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;


