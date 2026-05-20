  import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Camera,
  Shield,
  KeyRound,
  Save,
  X,
  Edit3,
  ArrowLeft,
  Loader2,
  Phone,
  Search,
  ChevronDown,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import Navbar from "../components/layout/Navbar";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input, { Select } from "../components/ui/Input";
import { useNavigate } from "react-router-dom";

const PHONE_COUNTRY_OPTIONS = [
  { value: "+91", label: "India (+91)" },
  { value: "+1", label: "United States (+1)" },
  { value: "+44", label: "United Kingdom (+44)" },
  { value: "+61", label: "Australia (+61)" },
  { value: "+971", label: "UAE (+971)" },
  { value: "+966", label: "Saudi Arabia (+966)" },
  { value: "+65", label: "Singapore (+65)" },
  { value: "+60", label: "Malaysia (+60)" },
];

const DEFAULT_PHONE_COUNTRY_CODE = "+91";

const parseProfilePhone = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  return {
    countryCode: DEFAULT_PHONE_COUNTRY_CODE,
    phone: digits.slice(-10),
  };
};

const formatMemberSince = (value) => {
  if (!value) return "Recently joined";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Recently joined";
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const StatusPill = ({ children, tone = "green" }) => {
  const tones = {
    green: "bg-emerald-500/12 text-emerald-700 border border-emerald-200/70",
    blue: "bg-blue-500/12 text-blue-700 border border-blue-200/70",
    amber: "bg-amber-500/12 text-amber-700 border border-amber-200/70",
    zinc: "bg-slate-500/12 text-slate-700 border border-slate-200/80",
  };

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
};

const OverviewRow = ({ icon: Icon, label, value, valueTone = "green" }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div className="flex items-center gap-3 text-sm text-slate-600">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <Icon size={16} />
      </span>
      <span>{label}</span>
    </div>
    {typeof value === "string" && ["green", "blue", "amber", "zinc"].includes(valueTone) ? (
      <StatusPill tone={valueTone}>{value}</StatusPill>
    ) : (
      <span className="text-sm font-semibold text-slate-900">{value}</span>
    )}
  </div>
);

const SectionShell = ({ icon: Icon, title, children, className = "" }) => (
  <Card
    className={`overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-[0_24px_80px_rgba(15,23,42,0.08)] backdrop-blur-xl ${className}`}
  >
    <div className="flex items-center gap-3 border-b border-slate-100 px-7 py-6">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#EEF4FF_0%,#F5F9FF_100%)] text-[#235BFF] shadow-[0_10px_28px_rgba(37,99,235,0.12)]">
        <Icon size={19} />
      </span>
      <h2 className="text-[1.35rem] font-bold tracking-tight text-slate-900">{title}</h2>
    </div>
    <div className="px-7 py-7">{children}</div>
  </Card>
);

const ProfilePage = () => {
  const navigate = useNavigate();
  const {
    user,
    updateProfile,
    uploadProfileImage,
    changeUserPassword,
    isLoading,
    sessionAuthMethod,
  } = useAuthStore();
  const { showToast } = useUIStore();

  const fileInputRef = useRef(null);
  const countryCodeDropdownRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [countryCodeOpen, setCountryCodeOpen] = useState(false);
  const [countryCodeSearch, setCountryCodeSearch] = useState("");
  const [showSecurityForm, setShowSecurityForm] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    email: "",
    phone: "",
    phoneCountryCode: DEFAULT_PHONE_COUNTRY_CODE,
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordErrors, setPasswordErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const isGooglePasswordSetup = sessionAuthMethod === "google" && !user?.hasPassword;

  const validatePasswordChange = ({ currentPassword, newPassword, confirmPassword }) => {
    const errors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };

    if (!isGooglePasswordSetup && !currentPassword.trim()) {
      errors.currentPassword = "Current password is required.";
    }

    if (!newPassword) {
      errors.newPassword = "New password is required.";
    } else if (newPassword.length < 8) {
      errors.newPassword = "New password must be at least 8 characters.";
    } else if (!/[A-Z]/.test(newPassword)) {
      errors.newPassword = "Password must include at least one uppercase letter.";
    } else if (!/[a-z]/.test(newPassword)) {
      errors.newPassword = "Password must include at least one lowercase letter.";
    } else if (!/[0-9]/.test(newPassword)) {
      errors.newPassword = "Password must include at least one digit.";
    } else if (!/[^A-Za-z0-9]/.test(newPassword)) {
      errors.newPassword = "Password must include at least one special character.";
    }

    if (!confirmPassword) {
      errors.confirmPassword = "Please confirm your new password.";
    } else if (newPassword !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match.";
    }

    return errors;
  };

  useEffect(() => {
    if (user) {
      const parsedPhone = parseProfilePhone(user.phone);
      setFormData({
        name: user.name || "",
        age: user.age || "",
        gender: user.gender || "Other",
        email: user.email || "",
        phone: parsedPhone.phone,
        phoneCountryCode: parsedPhone.countryCode,
      });
    }
  }, [user]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!countryCodeDropdownRef.current?.contains(event.target)) {
        setCountryCodeOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleBack = () => {
    navigate("/dashboard", { replace: true });
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    const updates = {
      name: formData.name,
      age: formData.age ? Number(formData.age) : undefined,
      gender: formData.gender,
      phone: String(formData.phone || "").replace(/\D/g, "").slice(0, 10),
    };

    const { success } = await updateProfile(updates);
    if (success) {
      setIsEditing(false);
      showToast("Profile updated successfully!");
    } else {
      showToast("Failed to update profile", "error");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (user) {
      const parsedPhone = parseProfilePhone(user.phone);
      setFormData({
        name: user.name || "",
        age: user.age || "",
        gender: user.gender || "Other",
        email: user.email || "",
        phone: parsedPhone.phone,
        phoneCountryCode: parsedPhone.countryCode,
      });
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
      showToast("Only JPG and PNG images are allowed", "error");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast("Image size must be less than 2MB", "error");
      return;
    }

    setIsUploading(true);
    const { success } = await uploadProfileImage(file);
    setIsUploading(false);

    if (success) {
      showToast("Profile image updated!");
    } else {
      showToast("Failed to upload image", "error");
    }
  };

  const handleChangePassword = async () => {
    const errors = validatePasswordChange(passwordForm);
    if (errors.currentPassword || errors.newPassword || errors.confirmPassword) {
      setPasswordErrors(errors);
      const firstError = errors.currentPassword || errors.newPassword || errors.confirmPassword;
      showToast(firstError, "error");
      return;
    }

    setPasswordErrors({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setIsChangingPassword(true);
    const currentPasswordValue = isGooglePasswordSetup ? "" : passwordForm.currentPassword;
    const { success, message } = await changeUserPassword(currentPasswordValue, passwordForm.newPassword);
    setIsChangingPassword(false);

    if (success) {
      showToast(isGooglePasswordSetup ? "Password created successfully!" : "Password updated successfully!", "success");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowSecurityForm(false);
    } else {
      showToast(message || "Failed to update password", "error");
    }
  };

  if (!user) return null;

  const displayPhoneDigits = String(user.phone || formData.phone || "").replace(/\D/g, "");
  const displayPhone =
    displayPhoneDigits.length === 10
      ? `+91 ${displayPhoneDigits.slice(0, 5)} ${displayPhoneDigits.slice(5)}`
      : (user.phone || formData.phone || "Not added");

  const filteredCountryOptions = PHONE_COUNTRY_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(countryCodeSearch.trim().toLowerCase())
  );
  const selectedCountryOption =
    PHONE_COUNTRY_OPTIONS.find((option) => option.value === formData.phoneCountryCode) ||
    PHONE_COUNTRY_OPTIONS[0];

  const memberSince = formatMemberSince(user.createdAt);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#EAF3FF_0%,#F6F9FF_26%,#FBFCFF_52%,#F7F9FD_100%)] pb-16">
      <Navbar />

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-7 px-4 py-7 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-[#235BFF] transition-colors hover:text-[#1746D8]"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </button>
        </div>

        <Card className="relative overflow-hidden rounded-[2.4rem] border border-white/70 bg-white/85 p-0 shadow-[0_28px_80px_rgba(15,23,42,0.1)] backdrop-blur-xl">
          <div className="absolute inset-y-0 right-0 w-[48%] bg-[radial-gradient(circle_at_top_right,rgba(83,125,255,0.18),transparent_40%),linear-gradient(140deg,rgba(244,247,255,0)_0%,rgba(224,234,255,0.52)_45%,rgba(213,226,255,0.8)_100%)]" />
          <div className="absolute -right-12 top-0 h-[110%] w-[42%] rounded-l-[8rem] bg-white/25 blur-[1px]" />
          <div className="absolute right-[12%] top-0 h-full w-px bg-white/35" />

          <div className="relative z-10 flex flex-col gap-8 px-8 py-8 sm:px-10 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative">
                <button
                  type="button"
                  onClick={handleImageClick}
                  className="group relative flex h-40 w-40 items-center justify-center overflow-hidden rounded-full border-[7px] border-white bg-slate-100 shadow-[0_22px_50px_rgba(15,23,42,0.14)]"
                >
                  {isUploading ? (
                    <Loader2 className="animate-spin text-[#235BFF]" size={34} />
                  ) : user.profileImage ? (
                    <img src={user.profileImage} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <User size={62} className="text-slate-400" />
                  )}
                  <span className="absolute inset-0 bg-slate-900/0 transition-colors group-hover:bg-slate-900/20" />
                </button>

                <button
                  type="button"
                  onClick={handleImageClick}
                  className="absolute bottom-3 right-1 flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-white text-[#235BFF] shadow-[0_16px_40px_rgba(15,23,42,0.12)] transition-transform hover:scale-105"
                >
                  <Camera size={22} />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/png, image/jpeg, image/jpg"
                  onChange={handleFileChange}
                />
              </div>

              <div className="space-y-4 text-left">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-4xl font-bold tracking-tight text-slate-950">{user.name}</h1>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#235BFF] text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)]">
                    <BadgeCheck size={18} />
                  </span>
                </div>

                <StatusPill tone="green">{user.isVerified ? "Verified Account" : "Profile Active"}</StatusPill>

                <div className="space-y-3 text-[1.02rem] text-slate-600">
                  <div className="flex items-center gap-3">
                    <Mail size={18} className="text-slate-500" />
                    <span>{user.email || "No email added"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Phone size={18} className="text-slate-500" />
                    <span>{displayPhone}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 lg:self-start">
              {!isEditing ? (
                <Button
                  variant="primary"
                  size="lg"
                  leftIcon={<Edit3 size={18} />}
                  onClick={() => setIsEditing(true)}
                  className="rounded-2xl bg-[linear-gradient(135deg,#235BFF_0%,#2F6BFF_100%)] px-7 py-4 text-white shadow-[0_20px_45px_rgba(37,99,235,0.26)] hover:bg-[linear-gradient(135deg,#235BFF_0%,#2F6BFF_100%)]"
                >
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="lg"
                    leftIcon={<X size={18} />}
                    onClick={handleCancel}
                    className="rounded-2xl border border-slate-200 bg-white/85 px-6 py-4 text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    leftIcon={<Save size={18} />}
                    onClick={handleSave}
                    loading={isLoading}
                    className="rounded-2xl bg-[linear-gradient(135deg,#235BFF_0%,#2F6BFF_100%)] px-7 py-4 text-white shadow-[0_20px_45px_rgba(37,99,235,0.26)] hover:bg-[linear-gradient(135deg,#235BFF_0%,#2F6BFF_100%)]"
                  >
                    Save Changes
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-7 xl:grid-cols-[minmax(0,1.85fr)_360px]">
          <SectionShell icon={User} title="Personal Information">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Input
                label="Full Name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={!isEditing}
                className={`rounded-2xl border-slate-200 bg-white px-5 py-4 text-base shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ${!isEditing ? "cursor-default bg-slate-50 text-slate-700 opacity-80" : ""}`}
              />

              <Input
                label="Email Address"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled
                helper="Email cannot be changed"
                className="rounded-2xl border-slate-200 bg-slate-100 px-5 py-4 text-base opacity-80"
              />

              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label className="text-sm font-medium text-text-secondary">Mobile Number</label>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[230px_minmax(0,1fr)]">
                  <div ref={countryCodeDropdownRef} className="relative">
                    <button
                      type="button"
                      disabled={!isEditing}
                      onClick={() => {
                        if (!isEditing) return;
                        setCountryCodeOpen((prev) => !prev);
                        setCountryCodeSearch("");
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-900 shadow-sm transition-all ${
                        !isEditing ? "cursor-default bg-slate-50 opacity-80" : "hover:border-[#235BFF]/40 focus:outline-none focus:ring-2 focus:ring-[#235BFF]/20"
                      }`}
                    >
                      <span className="truncate text-left">{selectedCountryOption.label}</span>
                      <ChevronDown size={18} className={`shrink-0 transition-transform ${countryCodeOpen ? "rotate-180" : ""}`} />
                    </button>

                    {countryCodeOpen && isEditing && (
                      <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.14)]">
                        <div className="relative border-b border-slate-100 p-3">
                          <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            value={countryCodeSearch}
                            onChange={(e) => setCountryCodeSearch(e.target.value)}
                            placeholder="Search country"
                            autoFocus
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#235BFF] focus:outline-none focus:ring-2 focus:ring-[#235BFF]/15"
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto py-2">
                          {filteredCountryOptions.length ? (
                            filteredCountryOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  setFormData((prev) => ({ ...prev, phoneCountryCode: option.value }));
                                  setCountryCodeOpen(false);
                                  setCountryCodeSearch("");
                                }}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-colors ${
                                  formData.phoneCountryCode === option.value
                                    ? "bg-[#235BFF]/8 text-[#235BFF]"
                                    : "text-slate-800 hover:bg-slate-50"
                                }`}
                              >
                                {option.label}
                              </button>
                            ))
                          ) : (
                            <p className="px-4 py-3 text-sm text-slate-500">No countries found.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <Input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChange={(e) => {
                      const digitsOnly = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setFormData((prev) => ({ ...prev, phone: digitsOnly }));
                    }}
                    disabled={!isEditing}
                    className={`rounded-2xl border-slate-200 bg-white px-5 py-4 text-base ${!isEditing ? "cursor-default bg-slate-50 opacity-80" : ""}`}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {isEditing
                    ? "Choose a country code and enter a 10-digit mobile number."
                    : "Add or edit in Edit Profile. Filled automatically after phone OTP log-in."}
                </p>
              </div>

              <Input
                label="Age"
                name="age"
                type="number"
                min="0"
                placeholder="Enter your age"
                value={formData.age}
                onChange={handleChange}
                disabled={!isEditing}
                className={`rounded-2xl border-slate-200 bg-white px-5 py-4 text-base ${!isEditing ? "cursor-default bg-slate-50 opacity-80" : ""}`}
              />

              <Select
                label="Gender"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                disabled={!isEditing}
                options={[
                  { value: "Male", label: "Male" },
                  { value: "Female", label: "Female" },
                  { value: "Other", label: "Other" },
                ]}
                className={`rounded-2xl border-slate-200 bg-white px-5 py-4 text-base ${!isEditing ? "cursor-default bg-slate-50 opacity-80" : ""}`}
              />
            </div>
          </SectionShell>

          <div className="space-y-7">
            <SectionShell icon={BadgeCheck} title="Account Overview" className="px-0 py-0">
              <div className="divide-y divide-slate-100">
                <OverviewRow icon={CalendarDays} label="Member Since" value={memberSince} valueTone="zinc" />
                <OverviewRow icon={Mail} label="Verified Email" value={user.isVerified ? "Verified" : "Pending"} valueTone={user.isVerified ? "green" : "amber"} />
                <OverviewRow icon={Phone} label="Phone Number" value={displayPhoneDigits ? "Verified" : "Add phone"} valueTone={displayPhoneDigits ? "green" : "amber"} />
                <OverviewRow icon={Shield} label="Account Status" value="Active" valueTone="green" />
              </div>
            </SectionShell>

            <SectionShell icon={Shield} title="Security" className="px-0 py-0">
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    {isGooglePasswordSetup
                      ? "Create a password so this Google account can also sign in with email and password."
                      : "Keep your account secure with a strong password."}
                  </p>
                </div>

                {!showSecurityForm ? (
                  <button
                    type="button"
                    onClick={() => setShowSecurityForm(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#235BFF]/20 bg-[#235BFF]/5 px-5 py-4 text-sm font-semibold text-[#235BFF] transition-colors hover:bg-[#235BFF]/10"
                  >
                    <KeyRound size={16} />
                    {isGooglePasswordSetup ? "Create Password" : "Change Password"}
                  </button>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {!isGooglePasswordSetup && (
                      <Input
                        label="Current Password"
                        type="password"
                        name="currentPassword"
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                        placeholder="........"
                        error={passwordErrors.currentPassword}
                        className="rounded-2xl border-slate-200 bg-white px-5 py-4"
                      />
                    )}

                    <Input
                      label={isGooglePasswordSetup ? "Create Password" : "New Password"}
                      type="password"
                      name="newPassword"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                      placeholder="........"
                      helper="Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char"
                      error={passwordErrors.newPassword}
                      className="rounded-2xl border-slate-200 bg-white px-5 py-4"
                    />

                    <Input
                      label={isGooglePasswordSetup ? "Re-enter Password" : "Confirm New Password"}
                      type="password"
                      name="confirmPassword"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                      placeholder="........"
                      error={passwordErrors.confirmPassword}
                      className="rounded-2xl border-slate-200 bg-white px-5 py-4"
                    />

                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        fullWidth
                        onClick={() => {
                          setShowSecurityForm(false);
                          setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                          setPasswordErrors({ currentPassword: "", newPassword: "", confirmPassword: "" });
                        }}
                        className="rounded-2xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="primary"
                        fullWidth
                        leftIcon={<KeyRound size={16} />}
                        onClick={handleChangePassword}
                        loading={isChangingPassword}
                        className="rounded-2xl bg-[linear-gradient(135deg,#235BFF_0%,#2F6BFF_100%)] text-white hover:bg-[linear-gradient(135deg,#235BFF_0%,#2F6BFF_100%)]"
                      >
                        {isGooglePasswordSetup ? "Create Password" : "Update Password"}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </div>
            </SectionShell>

            <Card className="rounded-[2rem] border border-white/70 bg-white/90 p-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#EEF4FF_0%,#F5F9FF_100%)] text-[#235BFF] shadow-[0_10px_28px_rgba(37,99,235,0.12)]">
                    <Settings2 size={19} />
                  </span>
                  <div>
                    <h3 className="text-[1.35rem] font-bold tracking-tight text-slate-900">Preferences</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      Manage your notification and communication preferences.
                    </p>
                  </div>
                </div>
                <ChevronRight size={22} className="mt-1 text-slate-400" />
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
