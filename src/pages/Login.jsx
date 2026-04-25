// ============================================================
//  Admin Login Page
//  Dedicated login route for administrators
// ============================================================
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";

const Login = () => {
  const navigate = useNavigate();
  const { loginAdmin, isLoading, error, clearError } = useAuthStore();

  // ── Form state ────────────────────────────────────────────
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPass, setShowPass]   = useState(false);

  // ── Submit handler ────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const { success } = await loginAdmin(email, password);
    if (success) {
      navigate("/");
    }
  };

  // ── Quick-fill demo credentials ───────────────────────────


  return (
    <div className="min-h-screen bg-background hero-gradient flex items-center justify-center px-4">
      {/* Background dot pattern */}
      <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* ── Card ── */}
        <div className="bg-surface border border-gold/30 rounded-3xl p-8 shadow-modal shadow-gold/5">
          <div className="text-center mb-8 relative">
            <div className="inline-flex items-center gap-2 mb-6">
              <div className="w-9 h-9 rounded-xl bg-gold flex items-center justify-center shadow-lg shadow-gold/20">
                <ShieldCheck size={18} className="text-background" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-xl text-gold">
                Admin Portal
              </span>
            </div>
            <h1 className="text-2xl font-bold text-text-primary mb-1">Authorized Access</h1>
            <p className="text-sm text-text-secondary">Please sign in to the dashboard</p>
          </div>



          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                role="alert"
              >
                {error}
              </motion.div>
            )}

            {/* Email */}
            <Input
              label="Admin Email"
              type="email"
              placeholder="admin@visa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={16} />}
              required
              id="admin-login-email"
              autoComplete="email"
            />

            {/* Password */}
            <Input
              label="Password"
              type={showPass ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={16} />}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="hover:text-text-primary transition-colors"
                  aria-label={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
              required
              id="admin-login-password"
              autoComplete="current-password"
            />

            {/* Submit */}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={isLoading}
              rightIcon={<ArrowRight size={18} />}
              className="bg-gold hover:bg-gold/90 text-background shadow-gold/20 shadow-lg border-none"
            >
              Access Dashboard
            </Button>
          </form>
        </div>

        {/* Security note */}
        <p className="text-center text-xs text-text-muted mt-4 flex items-center justify-center gap-1.5">
          <span>🔒</span>
          Restricted to Visa & Voyage administrative personnel.
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
