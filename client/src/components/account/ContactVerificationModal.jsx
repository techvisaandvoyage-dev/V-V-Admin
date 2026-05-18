import { useEffect, useRef, useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { isValidEmail } from "../../utils/authIdentifier";
import { normalizePhoneInputTo10 } from "../../utils/contactVerificationGate";

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

/**
 * Inline phone or email capture (saved via profile API). No redirect.
 * @param {"phone"|"email"} mode
 */
const ContactVerificationModal = ({ isOpen, mode, onClose, onCompleted, allowSkip = false, onSkip }) => {
  const { user, updateProfile, refreshUserFromServer, isLoading } = useAuthStore();
  const { showToast } = useUIStore();
  const countryCodeDropdownRef = useRef(null);
  const [value, setValue] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState(DEFAULT_PHONE_COUNTRY_CODE);
  const [countryCodeOpen, setCountryCodeOpen] = useState(false);
  const [countryCodeSearch, setCountryCodeSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "phone") {
      setValue(String(user?.phone || "").replace(/\D/g, "").slice(-10) || "");
      setPhoneCountryCode(DEFAULT_PHONE_COUNTRY_CODE);
      setCountryCodeOpen(false);
      setCountryCodeSearch("");
    } else {
      setValue(String(user?.email || "").trim());
    }
  }, [isOpen, mode, user?.phone, user?.email]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!countryCodeDropdownRef.current?.contains(event.target)) {
        setCountryCodeOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const handleSave = async () => {
    if (mode === "phone") {
      const key = normalizePhoneInputTo10(value);
      if (!key) {
        showToast("Enter a valid 10-digit mobile number.", "error");
        return;
      }
      const { success, message } = await updateProfile({ phone: key });
      if (!success) {
        showToast(message || "Could not save phone.", "error");
        return;
      }
    } else {
      const em = String(value || "").trim().toLowerCase();
      if (!isValidEmail(em)) {
        showToast("Enter a valid email address.", "error");
        return;
      }
      const { success, message } = await updateProfile({ email: em });
      if (!success) {
        showToast(message || "Could not save email.", "error");
        return;
      }
    }
    await refreshUserFromServer();
    showToast(mode === "phone" ? "Phone number saved." : "Email saved.", "success");
    onCompleted?.();
    onClose?.();
  };

  const title = mode === "phone" ? "Add your mobile number" : "Add your email address";
  const subtitle =
    mode === "phone"
      ? "We use this for SMS updates and to reach you about your visa application. You can change it later in Profile."
      : "We use this for receipts and important updates about your application. You can change it later in Profile.";
  const filteredCountryOptions = PHONE_COUNTRY_OPTIONS.filter((option) =>
    option.label.toLowerCase().includes(countryCodeSearch.trim().toLowerCase())
  );
  const selectedCountryOption =
    PHONE_COUNTRY_OPTIONS.find((option) => option.value === phoneCountryCode) ||
    PHONE_COUNTRY_OPTIONS[0];

  return (
    <Modal
      isOpen={isOpen}
      onClose={allowSkip ? onClose : () => {}}
      title={title}
      size="md"
      hideCloseButton={!allowSkip}
      closeOnBackdropClick={allowSkip}
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          {allowSkip && (
            <Button type="button" variant="ghost" className="sm:min-w-[120px]" onClick={onSkip}>
              Remind me later
            </Button>
          )}
          <Button type="button" variant="primary" className="sm:min-w-[140px]" loading={isLoading} onClick={handleSave}>
            Save &amp; continue
          </Button>
        </div>
      }
    >
      <p className="text-sm text-text-secondary mb-4">{subtitle}</p>
      {mode === "phone" ? (
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Country code
            </label>
            <div ref={countryCodeDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setCountryCodeOpen((prev) => !prev);
                  setCountryCodeSearch("");
                }}
                className="w-full flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm text-text-primary transition-all duration-200 hover:border-cyan/40 focus:outline-none focus:ring-2 focus:ring-cyan/20"
              >
                <span className="truncate text-left">{selectedCountryOption.label}</span>
                <ChevronDown size={16} className={`shrink-0 transition-transform ${countryCodeOpen ? "rotate-180" : ""}`} />
              </button>

              {countryCodeOpen && (
                <div className="absolute z-20 mt-2 w-full rounded-2xl border border-border bg-surface shadow-xl overflow-hidden">
                  <div className="relative border-b border-border p-3">
                    <Search size={14} className="absolute left-6 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                      type="text"
                      value={countryCodeSearch}
                      onChange={(e) => setCountryCodeSearch(e.target.value)}
                      placeholder="Search country"
                      autoFocus
                      className="w-full rounded-xl border border-border bg-surface-2 py-2 pl-9 pr-3 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto py-2">
                    {filteredCountryOptions.length ? (
                      filteredCountryOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setPhoneCountryCode(option.value);
                            setCountryCodeOpen(false);
                            setCountryCodeSearch("");
                          }}
                          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                            phoneCountryCode === option.value
                              ? "bg-cyan/10 text-cyan"
                              : "text-text-primary hover:bg-surface-2"
                          }`}
                        >
                          {option.label}
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-sm text-text-muted">No countries found.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          <Input
            label="Mobile number"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="Enter phone number"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 10))}
          />
        </div>
      ) : (
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      )}
    </Modal>
  );
};

export default ContactVerificationModal;
