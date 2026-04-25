// ============================================================
//  Login Page
//  - Password login for existing users
//  - OTP login (existing users only) — sends to /send-login-otp
//    then verifies via /verify-login-otp (separate from signup OTP)
// ============================================================
import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Lock, Eye, EyeOff, Plane, ArrowRight, ArrowLeft,
  KeyRound, CheckCircle, RefreshCw, Mail
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import OtpInput from "../components/ui/OtpInput";

// ── Resend timer hook ─────────────────────────────────────────
const useResendTimer = (seconds = 30) => {
  const [timeLeft, setTimeLeft] = useState(0);

  const start = useCallback(() => setTimeLeft(seconds), [seconds]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  return { timeLeft, start, canResend: timeLeft === 0 };
};

// ── Card animation variants ───────────────────────────────────
const slideIn = {
  initial: { opacity: 0, x: 40, scale: 0.97 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit:    { opacity: 0, x: -40, scale: 0.97 },
  transition: { duration: 0.28, ease: "easeInOut" },
};
const slideInBack = {
  initial: { opacity: 0, x: -40, scale: 0.97 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit:    { opacity: 0, x: 40, scale: 0.97 },
  transition: { duration: 0.28, ease: "easeInOut" },
};

// ─────────────────────────────────────────────────────────────
const LoginPage = () => {
  const navigate = useNavigate();
  const {
    login,
    sendLoginOtp,
    verifyLoginOtp,
    forgotPasswordRequestOtp,
    forgotPasswordReset,
    isLoading,
    error,
    clearError
  } = useAuthStore();
  const { showToast } = useUIStore();

  const [loginMethod, setLoginMethod] = useState("password"); // "password" | "otp"
  const [otpStep, setOtpStep]         = useState(1);          // 1: identifier/password, 2: OTP
  const [direction, setDirection]     = useState(1);           // 1 forward, -1 back (for animation choice)

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword]     = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [otpDigits, setOtpDigits]   = useState(["", "", "", "", "", ""]);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtpDigits, setForgotOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [forgotStep, setForgotStep] = useState(1); // 1: request OTP, 2: verify and reset

  const { timeLeft, start: startTimer, canResend } = useResendTimer(30);
  const { timeLeft: forgotTimeLeft, start: startForgotTimer, canResend: canResendForgot } = useResendTimer(30);

  const goForward = () => { setDirection(1); setOtpStep(2); };
  const goBack    = () => {
    setDirection(-1);
    setOtpStep(1);
    clearError();
    setOtpDigits(["", "", "", "", "", ""]);
  };

  const resetForgotFlow = () => {
    setForgotMode(false);
    setForgotStep(1);
    setForgotOtpDigits(["", "", "", "", "", ""]);
    setNewPassword("");
  };

  // ── Password Login ──────────────────────────────────────────
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const { success, role } = await login(identifier, password);
    if (success) {
      if (role !== "admin") showToast("Welcome back! You're now signed in.");
      navigate(role === "admin" ? "/admin" : "/");
    }
  };

  // ── Request OTP (send to email/phone) ──────────────────────
  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    clearError();
    if (!identifier.includes("@")) {
      showToast("Please enter a valid email for OTP login", "error");
      return;
    }
    const { success } = await sendLoginOtp(identifier);
    if (success) {
      startTimer();
      goForward();
    }
  };

  // ── Verify Login OTP ────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearError();
    const otp = otpDigits.join("");
    const { success, role } = await verifyLoginOtp(identifier, otp);
    if (success) {
      showToast("Logged in via OTP! Welcome back.");
      navigate(role === "admin" ? "/admin" : "/");
    }
  };

  const handleForgotRequestOtp = async (e) => {
    e?.preventDefault();
    clearError();
    if (!forgotEmail.includes("@")) {
      showToast("Please enter a valid email address", "error");
      return;
    }
    const { success, message } = await forgotPasswordRequestOtp(forgotEmail);
    if (success) {
      showToast(message || "OTP sent to your email", "success");
      startForgotTimer();
      setForgotStep(2);
    }
  };

  const handleForgotResendOtp = async () => {
    clearError();
    if (!canResendForgot || !forgotEmail.includes("@")) return;
    const { success, message } = await forgotPasswordRequestOtp(forgotEmail);
    if (success) {
      showToast(message || "OTP resent to your email", "success");
      startForgotTimer();
    }
  };

  const handleForgotReset = async (e) => {
    e?.preventDefault();
    clearError();
    const otp = forgotOtpDigits.join("");
    if (otp.length !== 6) {
      showToast("Please enter 6-digit OTP", "error");
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      showToast("New password must be at least 8 characters", "error");
      return;
    }
    const { success, message } = await forgotPasswordReset(forgotEmail, otp, newPassword);
    if (success) {
      showToast(message || "Password reset successful. Please login.", "success");
      resetForgotFlow();
      setLoginMethod("password");
      setIdentifier(forgotEmail);
    }
  };

  return (
    <div className="min-h-screen bg-background hero-gradient flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-cyan/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-56 h-56 bg-cyan/4 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <AnimatePresence mode="wait">

          {/* ══ STEP 1: Main Login Form ══ */}
          {otpStep === 1 && (
            <motion.div
              key="login-step1"
              {...(direction === 1 ? slideInBack : slideIn)}
              className="bg-surface border border-border rounded-3xl p-8 shadow-modal"
            >
              {/* Header */}
              <div className="text-center mb-7 relative">
                <Link
                  to="/"
                  className="absolute left-0 top-0 p-2 text-text-muted hover:text-cyan hover:bg-cyan/10 rounded-lg transition-colors flex items-center justify-center"
                >
                  <ArrowLeft size={20} />
                </Link>

                <div className="inline-flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-cyan flex items-center justify-center shadow-[0_0_16px_rgba(6,182,212,0.4)]">
                    <Plane size={18} className="text-background" strokeWidth={2.5} />
                  </div>
                  <span className="font-bold text-xl">
                    Visa & <span className="text-gradient-cyan">Voyage</span>
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-text-primary mb-1">Welcome back</h1>
                <p className="text-sm text-text-secondary">Sign in to continue your journey</p>
              </div>

              {/* Method Tabs */}
              <div className="flex p-1 bg-background/60 border border-border rounded-xl mb-6 gap-1">
                {["password", "otp"].map((method) => (
                  <button
                    key={method}
                    onClick={() => { setLoginMethod(method); clearError(); }}
                    className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                      loginMethod === method
                        ? "bg-surface shadow-sm text-text-primary ring-1 ring-border"
                        : "text-text-muted hover:text-text-primary"
                    }`}
                  >
                    {method === "password" ? "🔑  Password" : "📱  One-Time Code"}
                  </button>
                ))}
              </div>

              {/* Forms */}
              <form
                onSubmit={
                  forgotMode
                    ? (forgotStep === 1 ? handleForgotRequestOtp : handleForgotReset)
                    : (loginMethod === "password" ? handlePasswordSubmit : handleRequestOtp)
                }
                className="space-y-5"
                noValidate
              >
                <AnimatePresence>
                  {error && (
                    <motion.div
                      key="err"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Input
                  label="Email Address"
                  type="text"
                  placeholder="name@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  leftIcon={<Mail size={16} />}
                  required
                />

                <AnimatePresence mode="wait">
                  {forgotMode ? (
                    <motion.div
                      key="forgot-mode"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden rounded-xl border border-border bg-surface-2/40 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-text-primary">Forgot Password (Email OTP)</p>
                        <button
                          type="button"
                          onClick={resetForgotFlow}
                          className="text-xs text-text-muted hover:text-text-primary"
                        >
                          Cancel
                        </button>
                      </div>

                      {forgotStep === 1 ? (
                        <div className="space-y-3">
                          <Input
                            label="Registered Email"
                            type="email"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            leftIcon={<Mail size={16} />}
                            placeholder="name@example.com"
                            required
                          />
                          <Button type="submit" variant="primary" fullWidth loading={isLoading}>
                            Send Reset OTP
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-text-secondary text-center">
                            Enter reset OTP
                          </label>
                          <OtpInput value={forgotOtpDigits} onChange={setForgotOtpDigits} disabled={isLoading} />
                          <div className="text-center">
                            {canResendForgot ? (
                              <button
                                type="button"
                                onClick={handleForgotResendOtp}
                                disabled={isLoading}
                                className="inline-flex items-center gap-1.5 text-sm text-cyan hover:text-cyan-dim font-medium transition-colors disabled:opacity-50"
                              >
                                <RefreshCw size={14} />
                                Resend reset OTP
                              </button>
                            ) : (
                              <p className="text-xs text-text-muted">
                                Resend available in{" "}
                                <span className="text-cyan font-mono font-semibold">
                                  0:{String(forgotTimeLeft).padStart(2, "0")}
                                </span>
                              </p>
                            )}
                          </div>
                          <Input
                            label="New Password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            leftIcon={<Lock size={16} />}
                            placeholder="Enter new password"
                            required
                          />
                          <div className="flex gap-2">
                            <Button type="button" variant="ghost" fullWidth onClick={() => setForgotStep(1)}>
                              Back
                            </Button>
                            <Button type="submit" variant="primary" fullWidth loading={isLoading}>
                              Reset Password
                            </Button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ) : null}

                  {!forgotMode && loginMethod === "password" && (
                    <motion.div
                      key="pass-block"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3 overflow-hidden"
                    >
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
                          >
                            {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        }
                        required
                      />
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setForgotMode(true);
                            setForgotEmail(identifier);
                            clearError();
                          }}
                          className="text-xs text-text-muted hover:text-cyan transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {!forgotMode && loginMethod === "otp" && (
                    <motion.p
                      key="otp-hint"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-xs text-text-muted px-1"
                    >
                      We'll send a 6-digit code to your email address.
                      <br />
                      <span className="text-amber-400/80">Note: OTP login is for existing accounts only.</span>
                    </motion.p>
                  )}
                </AnimatePresence>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isLoading}
                  rightIcon={<ArrowRight size={18} />}
                >
                  {forgotMode
                    ? (forgotStep === 1 ? "Send Reset OTP" : "Reset Password")
                    : (loginMethod === "password" ? "Sign In" : "Send OTP")}
                </Button>
              </form>

              <div className="text-center text-sm text-text-muted mt-6 space-y-2">
                <p>
                  Don&apos;t have an account?{" "}
                  <Link to="/register" className="text-cyan hover:text-cyan-dim font-medium transition-colors">
                    Create one free
                  </Link>
                </p>
                <p className="pt-2 border-t border-border/50">
                  Are you an employee?{" "}
                  <Link to="/admin-login" className="text-gold hover:text-gold/80 font-medium transition-colors">
                    Admin Portal
                  </Link>
                </p>
              </div>
            </motion.div>
          )}

          {/* ══ STEP 2: OTP Verification ══ */}
          {otpStep === 2 && (
            <motion.div
              key="login-step2"
              {...slideIn}
              className="bg-surface border border-cyan/25 rounded-3xl p-8 shadow-modal shadow-cyan/5"
            >
              {/* Header */}
              <div className="text-center mb-8 relative">
                <button
                  onClick={goBack}
                  className="absolute left-0 top-0 p-2 text-text-muted hover:text-cyan hover:bg-cyan/10 rounded-lg transition-colors flex items-center justify-center"
                >
                  <ArrowLeft size={20} />
                </button>

                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 20 }}
                  className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-cyan/10 text-cyan mb-4 shadow-[0_0_24px_rgba(6,182,212,0.2)]"
                >
                  <KeyRound size={26} />
                </motion.div>
                <h1 className="text-2xl font-bold text-text-primary mb-1">Check your inbox</h1>
                <p className="text-sm text-text-secondary">
                  We sent a 6-digit code to <br />
                  <span className="font-semibold text-text-primary">{identifier}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      key="err2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-text-secondary text-center">
                    Enter verification code
                  </label>
                  <OtpInput value={otpDigits} onChange={setOtpDigits} disabled={isLoading} />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isLoading}
                  disabled={otpDigits.join("").length !== 6}
                  rightIcon={<CheckCircle size={18} />}
                >
                  Verify &amp; Sign In
                </Button>
              </form>

              {/* Resend */}
              <div className="text-center mt-5">
                {canResend ? (
                  <button
                    onClick={handleRequestOtp}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 text-sm text-cyan hover:text-cyan-dim font-medium transition-colors disabled:opacity-50"
                  >
                    <RefreshCw size={14} />
                    Resend code
                  </button>
                ) : (
                  <p className="text-xs text-text-muted">
                    Resend available in{" "}
                    <span className="text-cyan font-mono font-semibold">
                      0:{String(timeLeft).padStart(2, "0")}
                    </span>
                  </p>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default LoginPage;
