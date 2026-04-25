// ============================================================
//  Register Page
//  - New user signs up → OTP sent → verify OTP → logged in
//  - OTP uses /verify-otp (signup verification, marks isVerified)
// ============================================================
import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Mail, Lock, Eye, EyeOff, User, ArrowRight,
  ArrowLeft, KeyRound, CheckCircle, Plane, RefreshCw
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import OtpInput from "../components/ui/OtpInput";

// ── Resend timer ──────────────────────────────────────────────
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

// ── Animation variants ────────────────────────────────────────
const slideIn = {
  initial: { opacity: 0, x: 40, scale: 0.97 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit:    { opacity: 0, x: -40, scale: 0.97 },
  transition: { duration: 0.28, ease: "easeInOut" },
};

// ─────────────────────────────────────────────────────────────
const RegisterPage = () => {
  const navigate = useNavigate();
  const { register, verifyOtp, isLoading, error, clearError } = useAuthStore();
  const { showToast } = useUIStore();

  const [step, setStep]         = useState(1); // 1: Signup form, 2: OTP
  const [name, setName]         = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [strength, setStrength] = useState(0); // 0–4

  const { timeLeft, start: startTimer, canResend } = useResendTimer(30);

  // ── Password strength checker ─────────────────────────────
  useEffect(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    setStrength(score);
  }, [password]);

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "bg-red-500", "bg-amber-500", "bg-yellow-400", "bg-emerald-500"][strength];

  // ── Signup submit ────────────────────────────────────────
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    clearError();
    if (!identifier.includes("@")) {
      showToast("Please enter a valid email address", "error");
      return;
    }
    const { success } = await register(name, identifier, password);
    if (success) {
      startTimer();
      setStep(2);
    }
  };

  // ── Resend OTP (re-register same user — server resends OTP) ─
  const handleResend = async () => {
    clearError();
    const { success } = await register(name, identifier, password);
    if (success) {
      startTimer();
      showToast("A new code was sent to " + identifier);
    }
  };

  // ── OTP verification ─────────────────────────────────────
  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const otp = otpDigits.join("");
    const { success } = await verifyOtp(identifier, otp);
    if (success) {
      showToast("Account created! Welcome to Visa & Voyage 🎉");
      navigate("/");
    }
  };

  const goBack = () => {
    setStep(1);
    clearError();
    setOtpDigits(["", "", "", "", "", ""]);
  };
  return (
    <div className="min-h-screen bg-background hero-gradient flex items-center justify-center px-4 overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-30 pointer-events-none" />

      {/* Ambient glow */}
      <div className="absolute top-1/4 right-1/3 w-80 h-80 bg-cyan/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-60 h-60 bg-cyan/4 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <AnimatePresence mode="wait">

          {/* ══ STEP 1: Registration Form ══ */}
          {step === 1 && (
            <motion.div
              key="reg-step1"
              initial={{ opacity: 0, x: -40, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -40, scale: 0.97 }}
              transition={{ duration: 0.28, ease: "easeInOut" }}
              className="bg-surface border border-border rounded-3xl p-8 shadow-modal"
            >
              {/* Header */}
              <div className="text-center mb-7 relative">
                <Link
                  to="/login"
                  className="absolute left-0 top-0 p-2 text-text-muted hover:text-cyan hover:bg-cyan/10 rounded-lg transition-colors flex items-center justify-center"
                >
                  <ArrowLeft size={20} />
                </Link>

                <div className="inline-flex items-center gap-2 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-cyan flex items-center justify-center shadow-[0_0_16px_rgba(6,182,212,0.4)]">
                    <Plane size={18} className="text-background" strokeWidth={2.5} />
                  </div>
                  <span className="font-bold text-xl">
                    Visa<span className="text-gradient-cyan">Go</span>
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-text-primary mb-1">Create account</h1>
                <p className="text-sm text-text-secondary">Start your visa journey today</p>
              </div>

              {/* Form */}
              <form onSubmit={handleSignupSubmit} className="space-y-5" noValidate>
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
                  label="Full Name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  leftIcon={<User size={16} />}
                  required
                />

                <Input
                  label="Email Address"
                  type="text"
                  placeholder="name@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  leftIcon={<Mail size={16} />}
                  required
                />

                <div className="space-y-2">
                  <Input
                    label="Password"
                    type={showPass ? "text" : "password"}
                    placeholder="Create a strong password"
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

                  {/* Password strength bar */}
                  {password && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-1.5 px-0.5"
                    >
                      <div className="flex gap-1">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                              i < strength ? strengthColor : "bg-border"
                            }`}
                          />
                        ))}
                      </div>
                      {strengthLabel && (
                        <p className={`text-xs font-medium ${
                          strength <= 1 ? "text-red-400" :
                          strength === 2 ? "text-amber-400" :
                          strength === 3 ? "text-yellow-400" : "text-emerald-400"
                        }`}>
                          {strengthLabel} password
                        </p>
                      )}
                    </motion.div>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  fullWidth
                  loading={isLoading}
                  rightIcon={<ArrowRight size={18} />}
                >
                  Continue
                </Button>
              </form>

              <p className="text-center text-sm text-text-muted mt-6">
                Already have an account?{" "}
                <Link to="/login" className="text-cyan hover:text-cyan-dim font-medium transition-colors">
                  Sign in
                </Link>
              </p>
            </motion.div>
          )}

          {/* ══ STEP 2: OTP Verification ══ */}
          {step === 2 && (
            <motion.div
              key="reg-step2"
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
                <h1 className="text-2xl font-bold text-text-primary mb-1">Verify your account</h1>
                <p className="text-sm text-text-secondary">
                  We sent a 6-digit code to <br />
                  <span className="font-semibold text-text-primary">{identifier}</span>
                </p>
              </div>

              <form onSubmit={handleOtpSubmit} className="space-y-6">
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
                  Verify &amp; Create Account
                </Button>
              </form>

              {/* Resend */}
              <div className="text-center mt-5">
                {canResend ? (
                  <button
                    onClick={handleResend}
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

export default RegisterPage;
