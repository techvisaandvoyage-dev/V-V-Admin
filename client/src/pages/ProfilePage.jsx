import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, Mail, Camera, Shield, KeyRound, 
  Save, X, Edit3, ArrowLeft, Loader2, Phone
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import Navbar from "../components/layout/Navbar";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Input, { Select } from "../components/ui/Input";
import { useNavigate } from "react-router-dom";

const ProfilePage = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate("/dashboard");
  };
  
  const { 
    user, updateProfile, uploadProfileImage, 
    changeUserPassword, isLoading, sessionAuthMethod 
  } = useAuthStore();
  const { showToast } = useUIStore();
  
  const fileInputRef = useRef(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "",
    email: "", // Read-only
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordErrors, setPasswordErrors] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const validatePasswordChange = ({ currentPassword, newPassword, confirmPassword }) => {
    const errors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };

    if (!currentPassword.trim()) {
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

  // Populate form data on mount or user change
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        age: user.age || "",
        gender: user.gender || "Other",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  }, [user]);

  // Handle Form Change
  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Handle Save Profile
  const handleSave = async () => {
    // Only pass editable fields
    const updates = {
      name: formData.name,
      age: formData.age ? Number(formData.age) : undefined,
      gender: formData.gender,
      phone: formData.phone.trim(),
    };

    const { success } = await updateProfile(updates);
    if (success) {
      setIsEditing(false);
      showToast("Profile updated successfully!");
    } else {
      showToast("Failed to update profile", "error");
    }
  };

  // Handle Cancel Edit
  const handleCancel = () => {
    setIsEditing(false);
    // Revert form data
    if (user) {
      setFormData({
        name: user.name || "",
        age: user.age || "",
        gender: user.gender || "Other",
        email: user.email || "",
        phone: user.phone || "",
      });
    }
  };

  // Handle Image Upload
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
      return showToast(firstError, "error");
    }

    setPasswordErrors({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setIsChangingPassword(true);
    const { success, message } = await changeUserPassword(passwordForm.currentPassword, passwordForm.newPassword);
    setIsChangingPassword(false);

    if (success) {
      showToast("Password updated successfully!", "success");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } else {
      showToast(message || "Failed to update password", "error");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <button
          type="button"
          onClick={handleBack}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        {/* Header & Avatar Section */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
          {/* Avatar Container */}
          <div className="relative group cursor-pointer" onClick={handleImageClick}>
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden border-4 border-surface shadow-xl bg-surface-2 flex items-center justify-center relative">
              {isUploading ? (
                <Loader2 className="animate-spin text-cyan" size={32} />
              ) : user.profileImage ? (
                <img src={user.profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-text-muted" />
              )}
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera size={24} className="text-white" />
              </div>
            </div>
            
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef}
              className="hidden" 
              accept="image/png, image/jpeg, image/jpg"
              onChange={handleFileChange}
            />
          </div>

          {/* Title Info */}
          <div className="text-center sm:text-left pt-2 sm:pt-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-1">
              {user.name}
            </h1>
            <p className="text-text-secondary flex items-center justify-center sm:justify-start gap-2">
              <Mail size={14} /> {user.email}
            </p>
            {(user.phone || formData.phone) && (
              <p className="text-text-secondary flex items-center justify-center sm:justify-start gap-2 mt-1 text-sm">
                <Phone size={14} className="shrink-0" />
                <span>
                  {String(user.phone || formData.phone).replace(/\D/g, "").length === 10
                    ? `+91 ${String(user.phone || formData.phone).replace(/\D/g, "").slice(0, 5)} ${String(user.phone || formData.phone).replace(/\D/g, "").slice(5)}`
                    : user.phone || formData.phone}
                </span>
              </p>
            )}
          </div>

          {/* Global Edit Action */}
          <div className="sm:ml-auto pt-2 sm:pt-4">
            {!isEditing && (
              <Button 
                variant="primary" 
                leftIcon={<Edit3 size={16} />}
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Information Grid */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4 mb-6 flex items-center gap-2">
                <User size={18} className="text-cyan" />
                Personal Information
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                  label="Full Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={!isEditing ? "opacity-70 bg-surface-2 cursor-default" : ""}
                />
                
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={true} // Always disabled
                  className="opacity-50 bg-surface-3 cursor-not-allowed"
                  helper="Email cannot be changed"
                />

                <Input
                  label="Mobile number"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={!isEditing ? "opacity-70 bg-surface-2 cursor-default" : ""}
                  helper={
                    isEditing
                      ? "Indian mobile — 10 digits. Saved when you use OTP login too."
                      : "Add or edit in Edit Profile. Filled automatically after phone OTP log-in."
                  }
                />

                <Input
                  label="Age"
                  name="age"
                  type="number"
                  min="0"
                  value={formData.age}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={!isEditing ? "opacity-70 bg-surface-2 cursor-default" : ""}
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
                    { value: "Other", label: "Other" }
                  ]}
                  className={!isEditing ? "opacity-70 bg-surface-2 cursor-default" : ""}
                />

              </div>

              {/* Action Buttons */}
              <AnimatePresence>
                {isEditing && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex justify-end gap-3 mt-6 pt-6 border-t border-border overflow-hidden"
                  >
                    <Button 
                      variant="ghost" 
                      leftIcon={<X size={16} />}
                      onClick={handleCancel}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="primary" 
                      leftIcon={<Save size={16} />}
                      onClick={handleSave}
                      loading={isLoading}
                    >
                      Save Changes
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </div>

          {/* Security Section Sidebar */}
          {sessionAuthMethod !== "google" && (
            <div className="space-y-6">
              <Card>
                <h3 className="font-semibold text-text-primary mb-4 border-b border-border pb-3 flex items-center gap-2">
                  <Shield size={18} className="text-amber-400" />
                  Security
                </h3>
                
                <div className="space-y-4">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    To update your password, please provide your current password and choose a strong new one.
                  </p>

                  <Input 
                    label="Current Password" 
                    type="password" 
                    name="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
                    placeholder="••••••••"
                    error={passwordErrors.currentPassword}
                  />

                  <Input 
                    label="New Password" 
                    type="password" 
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
                    placeholder="••••••••"
                    helper="Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char"
                    error={passwordErrors.newPassword}
                  />

                  <Input 
                    label="Confirm New Password" 
                    type="password" 
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
                    placeholder="••••••••"
                    error={passwordErrors.confirmPassword}
                  />

                  <Button 
                    variant="primary" 
                    fullWidth 
                    leftIcon={<KeyRound size={16} />}
                    onClick={handleChangePassword}
                    loading={isChangingPassword}
                  >
                    Update Password
                  </Button>

                </div>
              </Card>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
