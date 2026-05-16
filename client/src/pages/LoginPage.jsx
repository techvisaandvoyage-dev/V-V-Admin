import { useState, useEffect, useCallback } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  KeyRound,
  RefreshCw,
  Smartphone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import OtpInput from "../components/ui/OtpInput";
import {
  signInWithGooglePopup,
  signInWithFacebookPopup,
  prefetchFirebaseAuth,
} from "../utils/firebaseAuth";
import { isValidEmail, parseAuthContactInput } from "../utils/authIdentifier";

const useResendTimer = (seconds = 30) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const start = useCallback(() => setTimeLeft(seconds), [seconds]);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setTimeout(() => setTimeLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft]);

  return { timeLeft, start, canResend: timeLeft === 0 };
};

const slideIn = {
  initial: { opacity: 0, y: 18, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -12, scale: 0.985 },
  transition: { duration: 0.22, ease: "easeOut" },
};

const safeRedirectPath = (raw) => {
  if (!raw || typeof raw !== "string") return "/";
  const path = raw.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "/";
  return path.split("#")[0] || "/";
};

const GoogleMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

const FacebookMark = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#1877F2"
      d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"
    />
  </svg>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const postLoginPath = safeRedirectPath(searchParams.get("redirect"));

  const {
    login,
    sendLoginOtp,
    verifyLoginOtp,
    loginWithFirebaseGoogle,
    loginWithFirebaseFacebook,
    loginWithFirebaseEmailPassword,
    forgotPasswordRequestOtp,
    forgotPasswordReset,
    isLoading,
    error,
    clearError,
  } = useAuthStore();
  const { showToast } = useUIStore();

  const [loginMethod, setLoginMethod] = useState("password");
  const [otpStep, setOtpStep] = useState(1);
  const [identifier, setIdentifier] = useState("");
  const [otpIdentifier, setOtpIdentifier] = useState("");
  const [otpSentValue, setOtpSentValue] = useState("");
  const [otpSentKind, setOtpSentKind] = useState(null);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [loginTestOtp, setLoginTestOtp] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotApiIdentifier, setForgotApiIdentifier] = useState("");
  const [forgotChannel, setForgotChannel] = useState(null);
  const [forgotDevOtp, setForgotDevOtp] = useState("");
  const [forgotOtpDigits, setForgotOtpDigits] = useState(["", "", "", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [forgotStep, setForgotStep] = useState(1);
  const [firebaseEmail, setFirebaseEmail] = useState("");
  const [firebasePassword, setFirebasePassword] = useState("");
  const [firebaseShowPass, setFirebaseShowPass] = useState(false);

  const { timeLeft, start: startTimer, canResend } = useResendTimer(30);
  const {
    timeLeft: forgotTimeLeft,
    start: startForgotTimer,
    canResend: canResendForgot,
  } = useResendTimer(30);

  useEffect(() => {
    prefetchFirebaseAuth();
  }, []);

  const otpLoginIsEmail = otpSentKind === "email";
  const otpStep2Display =
    otpSentKind === "phone" && otpSentValue
      ? `******${otpSentValue.slice(-4)}`
      : otpSentValue || "";

  const otpContactPreview = parseAuthContactInput(otpIdentifier);
  const forgotContactPreview = parseAuthContactInput(forgotEmail);

  const resetForgotFlow = () => {
    setForgotMode(false);
    setForgotStep(1);
    setForgotEmail("");
    setForgotOtpDigits(["", "", "", "", "", ""]);
    setNewPassword("");
    setForgotApiIdentifier("");
    setForgotChannel(null);
    setForgotDevOtp("");
  };

  const switchToPhoneOtpLogin = () => {
    setForgotMode(false);
    setLoginMethod("otp");
    clearError();
  };

  const switchToFirebaseEmailLogin = () => {
    setForgotMode(false);
    setLoginMethod("firebase_email");
    clearError();
  };

  const handleGoogleLogin = async () => {
    clearError();
    try {
      const idToken = await signInWithGooglePopup();
      const { success } = await loginWithFirebaseGoogle(idToken);
      if (success) {
        showToast("Logged in with Google.");
        navigate(postLoginPath, { replace: true });
      }
    } catch (err) {
      showToast(err.message || "Google login failed", "error");
    }
  };

  const handleFacebookLogin = async () => {
    clearError();
    try {
      const idToken = await signInWithFacebookPopup();
      const { success } = await loginWithFirebaseFacebook(idToken);
      if (success) {
        showToast("Logged in with Facebook.");
        navigate(postLoginPath, { replace: true });
      }
    } catch (err) {
      showToast(err.message || "Facebook login failed", "error");
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    clearError();
    const { success } = await login(identifier, password);
    if (success) {
      showToast("Welcome back! You're now logged in.");
      navigate(postLoginPath, { replace: true });
    }
  };

  const handleFirebaseEmailSubmit = async (e) => {
    e.preventDefault();
    clearError();
    if (!isValidEmail(firebaseEmail)) {
      showToast("Enter a valid email address.", "error");
      return;
    }
    if (!firebasePassword) {
      showToast("Enter your password.", "error");
      return;
    }
    const { success, message } = await loginWithFirebaseEmailPassword(
      firebaseEmail.trim(),
      firebasePassword
    );
    if (success) {
      showToast("Logged in.");
      navigate(postLoginPath, { replace: true });
    } else if (message) {
      showToast(message, "error");
    }
  };

  const handleRequestOtp = async (e) => {
    e?.preventDefault();
    clearError();

    let contact;
    let kind;

    if (otpStep === 2) {
      contact = otpSentValue;
      kind = otpSentKind;
      if (!contact || !kind) return;
    } else {
      const parsed = parseAuthContactInput(otpIdentifier);
      if (!parsed) {
        showToast("Enter a valid email address or a 10-digit mobile number.", "error");
        return;
      }
      contact = parsed.value;
      kind = parsed.type;
    }

    const { success, devOtp, message: otpSendMessage } = await sendLoginOtp(contact);
    if (success) {
      setOtpSentValue(contact);
      setOtpSentKind(kind);
      if (otpStep === 1) setOtpIdentifier(contact);
      setLoginTestOtp(devOtp ? String(devOtp) : "");
      startTimer();
      setOtpStep(2);
    } else if (otpSendMessage) {
      showToast(otpSendMessage, "error");
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    clearError();
    const otp = otpDigits.join("");
    const { success } = await verifyLoginOtp(otpSentValue, otp);
    if (success) {
      showToast("Logged in via OTP! Welcome back.");
      navigate(postLoginPath, { replace: true });
    }
  };

  const handleForgotRequestOtp = async (e) => {
    e?.preventDefault();
    clearError();
    const parsed = parseAuthContactInput(String(forgotEmail || "").trim());
    if (!parsed) {
      showToast("Enter a valid email or 10-digit mobile number.", "error");
      return;
    }
    const { success, message, devOtp } = await forgotPasswordRequestOtp(parsed.value);
    if (success) {
      setForgotApiIdentifier(parsed.value);
      setForgotChannel(parsed.type);
      setForgotDevOtp(devOtp && String(devOtp).length >= 4 ? String(devOtp) : "");
      showToast(
        message ||
          (parsed.type === "phone" ? "OTP sent to your phone" : "OTP sent to your email"),
        "success"
      );
      startForgotTimer();
      setForgotStep(2);
    } else if (message) {
      showToast(message, "error");
    }
  };

  const handleForgotResendOtp = async () => {
    clearError();
    if (!canResendForgot || !forgotApiIdentifier) return;
    const { success, message, devOtp } = await forgotPasswordRequestOtp(forgotApiIdentifier);
    if (success) {
      if (devOtp && String(devOtp).length >= 4) setForgotDevOtp(String(devOtp));
      showToast(message || "OTP resent", "success");
      startForgotTimer();
    } else if (message) {
      showToast(message, "error");
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
    if (!forgotApiIdentifier) {
      showToast("Request a new OTP from the previous step.", "error");
      return;
    }
    const { success, message } = await forgotPasswordReset(forgotApiIdentifier, otp, newPassword);
    if (success) {
      const id = forgotApiIdentifier;
      showToast(message || "Password reset successful. Please login.", "success");
      resetForgotFlow();
      setLoginMethod("password");
      setIdentifier(id);
    } else if (message) {
      showToast(message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-background hero-gradient flex flex-col items-center justify-center px-4 py-10 font-sans relative overflow-hidden">
      <div className="absolute inset-0 dot-pattern opacity-40 pointer-events-none" aria-hidden="true" />
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[120px] pointer-events-none"
        style={{ background: "radial-gradient(circle, #0284c7 0%, transparent 70%)" }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-[400px]">
        <AnimatePresence mode="wait">
          {otpStep === 1 && (
            <motion.div key="login-step-1" {...slideIn}>
              <div className="mb-8 text-center relative">
                <Link
                  to="/"
                  className="absolute -left-2 top-0 p-2 text-text-muted hover:text-text-primary transition-colors"
                >
                  <ArrowLeft size={20} />
                </Link>

                <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-[32px] mt-2 mb-2">
                  Welcome back
                </h1>
              </div>

              {!forgotMode && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full rounded-full border border-border bg-surface px-4 py-3.5 text-[15px] font-medium text-text-primary transition-colors hover:bg-surface-2 disabled:opacity-60 flex items-center justify-center gap-3"
                  >
                    <GoogleMark />
                    Continue with Google
                  </button>

                  <button
                    type="button"
                    onClick={handleFacebookLogin}
                    disabled={isLoading}
                    className="w-full rounded-full border border-border bg-surface px-4 py-3.5 text-[15px] font-medium text-text-primary transition-colors hover:bg-surface-2 disabled:opacity-60 flex items-center justify-center gap-3"
                  >
                    <FacebookMark />
                    Continue with Facebook
                  </button>

                  <button
                    type="button"
                    onClick={switchToPhoneOtpLogin}
                    className="w-full rounded-full border border-border bg-surface px-4 py-3.5 text-[15px] font-medium text-text-primary transition-colors hover:bg-surface-2 flex items-center justify-center gap-3"
                  >
                    <Smartphone size={18} className="text-text-primary" />
                    Log in with phone/Email OTP
                  </button>

                  <button
                    type="button"
                    onClick={switchToFirebaseEmailLogin}
                    className="w-full rounded-full border border-border bg-surface px-4 py-3.5 text-[15px] font-medium text-text-primary transition-colors hover:bg-surface-2 flex items-center justify-center gap-3"
                  >
                    <KeyRound size={18} className="text-text-primary" />
                    Continue with Email
                  </button>
                </div>
              )}

              {!forgotMode && (
                <>
                  <div className="my-6 flex items-center gap-4">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">OR</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  {loginMethod === "password" && (
                    <p className="text-center text-[12px] text-text-muted -mt-2 mb-2 px-1">
                      Use the email or 10-digit mobile number you registered with.
                    </p>
                  )}
                  {loginMethod === "firebase_email" && (
                    <p className="text-center text-[12px] text-text-muted -mt-2 mb-2 px-1">
                      Use the email and password on your account.
                    </p>
                  )}
                  {loginMethod === "otp" && (
                    <p className="text-center text-[12px] text-text-muted -mt-2 mb-2 px-1">
                      Enter the email or mobile on your account. We&apos;ll email or text a code.
                    </p>
                  )}
                </>
              )}

              <form
                onSubmit={
                  forgotMode
                    ? (forgotStep === 1 ? handleForgotRequestOtp : handleForgotReset)
                    : loginMethod === "password"
                      ? handlePasswordSubmit
                      : loginMethod === "firebase_email"
                        ? handleFirebaseEmailSubmit
                        : handleRequestOtp
                }
                className="space-y-4"
                noValidate
              >
                <AnimatePresence>
                  {error && (
                    <motion.div
                      key="login-error"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {!forgotMode && loginMethod === "password" && (
                  <>
                    <Input
                      label=""
                      type="text"
                      placeholder="Email or mobile number"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                      className="h-[52px] rounded-full border-border bg-surface px-5 text-[15px] placeholder:text-text-muted focus:ring-1 focus:ring-text-primary focus:border-text-primary"
                      required
                    />
                    <Input
                      label=""
                      type={showPass ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      className="h-[52px] rounded-full border-border bg-surface px-5 pr-12 text-[15px] placeholder:text-text-muted focus:ring-1 focus:ring-text-primary focus:border-text-primary"
                      rightIcon={
                        <button
                          type="button"
                          onClick={() => setShowPass((value) => !value)}
                          className="hover:text-text-primary text-text-muted transition-colors mr-2 mt-0.5"
                        >
                          {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                      required
                    />
                    <div className="flex justify-end -mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setForgotMode(true);
                          const parsed = parseAuthContactInput(identifier.trim());
                          setForgotEmail(parsed ? parsed.value : identifier.trim());
                          clearError();
                        }}
                        className="text-[13px] text-text-muted transition-colors hover:text-text-primary font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                  </>
                )}

                {!forgotMode && loginMethod === "firebase_email" && (
                  <>
                    <Input
                      label=""
                      type="email"
                      autoComplete="email"
                      placeholder="Email address"
                      value={firebaseEmail}
                      onChange={(e) => setFirebaseEmail(e.target.value)}
                      className="h-[52px] rounded-full border-border bg-surface px-5 text-[15px] placeholder:text-text-muted focus:ring-1 focus:ring-text-primary focus:border-text-primary"
                      required
                    />
                    <Input
                      label=""
                      type={firebaseShowPass ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Password"
                      value={firebasePassword}
                      onChange={(e) => setFirebasePassword(e.target.value)}
                      className="h-[52px] rounded-full border-border bg-surface px-5 pr-12 text-[15px] placeholder:text-text-muted focus:ring-1 focus:ring-text-primary focus:border-text-primary"
                      rightIcon={
                        <button
                          type="button"
                          onClick={() => setFirebaseShowPass((value) => !value)}
                          className="hover:text-text-primary text-text-muted transition-colors mr-2 mt-0.5"
                        >
                          {firebaseShowPass ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      }
                      required
                    />
                    <div className="flex justify-center -mt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginMethod("password");
                          clearError();
                        }}
                        className="text-[13px] text-text-muted transition-colors hover:text-text-primary font-medium"
                      >
                        Use app password instead
                      </button>
                    </div>
                  </>
                )}

                {!forgotMode && loginMethod === "otp" && (
                  <div className="space-y-1">
                    <Input
                      label=""
                      type="text"
                      inputMode="text"
                      autoComplete="username"
                      placeholder="Email or mobile number"
                      value={otpIdentifier}
                      onChange={(e) => setOtpIdentifier(e.target.value)}
                      className="h-[52px] rounded-full border-border bg-surface px-5 text-[15px] placeholder:text-text-muted focus:ring-1 focus:ring-text-primary focus:border-text-primary"
                      required
                    />
                    {otpIdentifier.trim() && (
                      <p
                        className={`px-4 text-[12px] leading-snug ${
                          otpContactPreview
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {otpContactPreview
                          ? otpContactPreview.type === "phone"
                            ? `We'll text a code — mobile …${otpContactPreview.value.slice(-4)}`
                            : "We'll email a code to this address"
                          : otpIdentifier.includes("@")
                            ? "Enter a valid email address"
                            : "Enter a valid mobile (10 digits, country code optional)"}
                      </p>
                    )}
                  </div>
                )}

                {forgotMode && (
                  <div className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[15px] font-medium text-text-primary">Forgot Password</p>
                      <button
                        type="button"
                        onClick={resetForgotFlow}
                        className="text-[13px] text-text-muted hover:text-text-primary font-medium"
                      >
                        Cancel
                      </button>
                    </div>

                    {forgotStep === 1 ? (
                      <>
                        <Input
                          label=""
                          type="text"
                          inputMode="text"
                          autoComplete="username"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          placeholder="Registered email or mobile"
                          className="h-[52px] rounded-full border-border bg-surface px-5 text-[15px] placeholder:text-text-muted focus:ring-1 focus:ring-text-primary focus:border-text-primary"
                          required
                        />
                        {forgotEmail.trim() && (
                          <p
                            className={`px-1 text-[12px] leading-snug ${
                              forgotContactPreview
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {forgotContactPreview
                              ? forgotContactPreview.type === "phone"
                                ? `We'll text a code — mobile …${forgotContactPreview.value.slice(-4)}`
                                : "We'll email a reset code to this address"
                              : forgotEmail.includes("@")
                                ? "Enter a valid email address"
                                : "Enter a valid mobile (10 digits, country code optional)"}
                          </p>
                        )}
                        <Button
                          type="submit"
                          variant="primary"
                          fullWidth
                          loading={isLoading}
                          className="h-[52px] rounded-full bg-cyan text-white hover:bg-cyan-dim text-[15px] font-medium shadow-none border-none mt-2"
                        >
                          Send Reset OTP
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-center text-[13px] text-text-secondary px-1">
                          {forgotChannel === "phone" ? (
                            <>
                              Code sent to{" "}
                              <span className="font-semibold text-text-primary">
                                ******{forgotApiIdentifier.slice(-4)}
                              </span>
                            </>
                          ) : (
                            <>
                              Code sent to{" "}
                              <span className="font-semibold text-text-primary">{forgotApiIdentifier}</span>
                            </>
                          )}
                        </p>
                        <label className="block text-center text-[13px] font-medium text-text-secondary">
                          Enter reset OTP
                        </label>
                        {forgotDevOtp.length >= 4 && (
                          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-700">
                            <p className="mb-1 font-medium">Testing mode</p>
                            <p>
                              Reset OTP:{" "}
                              <span className="font-mono font-bold tracking-widest">{forgotDevOtp}</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => setForgotOtpDigits(forgotDevOtp.split("").slice(0, 6))}
                              className="mt-2 font-medium text-amber-700 underline-offset-2 hover:underline"
                            >
                              Fill OTP boxes
                            </button>
                          </div>
                        )}
                        <OtpInput value={forgotOtpDigits} onChange={setForgotOtpDigits} disabled={isLoading} />
                        <div className="text-center">
                          {canResendForgot ? (
                            <button
                              type="button"
                              onClick={handleForgotResendOtp}
                              disabled={isLoading}
                              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-cyan transition-colors hover:text-cyan-dim disabled:opacity-50"
                            >
                              <RefreshCw size={14} />
                              Resend reset OTP
                            </button>
                          ) : (
                            <p className="text-[13px] text-text-muted">
                              Resend available in{" "}
                              <span className="font-mono font-semibold text-text-primary">
                                0:{String(forgotTimeLeft).padStart(2, "0")}
                              </span>
                            </p>
                          )}
                        </div>
                        <Input
                          label=""
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                          className="h-[52px] rounded-full border-border bg-surface px-5 text-[15px] placeholder:text-text-muted focus:ring-1 focus:ring-text-primary focus:border-text-primary"
                          required
                        />
                        <div className="flex gap-2 pt-2">
                          <Button type="button" variant="ghost" fullWidth onClick={() => setForgotStep(1)} className="h-[48px] rounded-full text-[15px]">
                            Back
                          </Button>
                          <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            loading={isLoading}
                            className="h-[48px] rounded-full bg-cyan text-white hover:bg-cyan-dim text-[15px] shadow-none"
                          >
                            Reset
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {!forgotMode && loginMethod === "otp" && (
                  <p className="px-1 text-[13px] text-text-muted text-center">
                    Use the same email or mobile you signed up with. The code expires in about 10 minutes.
                  </p>
                )}

                {!forgotMode && (
                  <Button
                    type="submit"
                    variant="primary"
                    fullWidth
                    loading={isLoading}
                    className="h-[52px] rounded-full bg-cyan text-white hover:bg-cyan-dim text-[15px] font-medium mt-2 shadow-none border-none"
                  >
                    {loginMethod === "password"
                      ? "Continue"
                      : loginMethod === "firebase_email"
                        ? "Continue with Email"
                        : "Send OTP"}
                  </Button>
                )}
              </form>

              <div className="mt-8 text-center text-[14px]">
                <p className="text-text-primary font-medium">
                  Don't have an account?{" "}
                  <Link to="/register" className="text-[#3b82f6] hover:text-[#2563eb] transition-colors">
                    Sign up
                  </Link>
                </p>
              </div>
            </motion.div>
          )}

          {otpStep === 2 && (
            <motion.div key="login-step-2" {...slideIn}>
              <div className="mb-8 text-center relative">
                <button
                  type="button"
                  onClick={() => {
                    setOtpStep(1);
                    clearError();
                    setOtpDigits(["", "", "", "", "", ""]);
                    setLoginTestOtp("");
                    setOtpSentValue("");
                    setOtpSentKind(null);
                  }}
                  className="absolute -left-2 top-0 p-2 text-text-muted hover:text-text-primary transition-colors"
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface border border-border text-text-primary shadow-sm">
                  <KeyRound size={22} />
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-[32px] mb-2">
                  {otpLoginIsEmail ? "Check your inbox" : "Check your phone"}
                </h1>
                <p className="text-[15px] text-text-secondary">
                  {otpLoginIsEmail ? (
                    <>
                      We emailed a 6-digit code to <br />
                      <span className="font-semibold text-text-primary">{otpStep2Display}</span>
                    </>
                  ) : (
                    <>
                      We texted a 6-digit code to <br />
                      <span className="font-semibold text-text-primary">{otpStep2Display}</span>
                    </>
                  )}
                </p>
              </div>

              <form onSubmit={handleVerifyOtp} className="space-y-6">
                <AnimatePresence>
                  {error && (
                    <motion.div
                      key="otp-error"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-[14px] text-red-500"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-3">
                  <label className="block text-center text-[13px] font-medium text-text-secondary">
                    Enter verification code
                  </label>
                  <OtpInput value={otpDigits} onChange={setOtpDigits} disabled={isLoading} />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  fullWidth
                  loading={isLoading}
                  disabled={otpDigits.join("").length !== 6 || !otpSentValue}
                  className="h-[52px] rounded-full bg-cyan text-white hover:bg-cyan-dim text-[15px] font-medium shadow-none border-none"
                >
                  Verify &amp; Log In
                </Button>
              </form>

              <div className="mt-6 text-center">
                {canResend ? (
                  <button
                    onClick={handleRequestOtp}
                    disabled={isLoading}
                    className="inline-flex items-center gap-1.5 text-[14px] font-medium text-cyan transition-colors hover:text-cyan-dim disabled:opacity-50"
                  >
                    <RefreshCw size={14} />
                    Resend code
                  </button>
                ) : (
                  <p className="text-[13px] text-text-muted">
                    Resend available in{" "}
                    <span className="font-mono font-semibold text-text-primary">
                      0:{String(timeLeft).padStart(2, "0")}
                    </span>
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute z-10 bottom-6 w-full text-center text-[12px] text-text-muted flex justify-center gap-3">
        <a href="#" className="hover:text-text-primary transition-colors">
          Terms of Use
        </a>
        <span>|</span>
        <a href="#" className="hover:text-text-primary transition-colors">
          Privacy Policy
        </a>
      </div>
    </div>
  );
};

export default LoginPage;
