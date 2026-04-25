// ============================================================
//  Application Form Page (Multi-Step)
//  Step 1: Personal Information
//  Step 2: Document Upload (drag-drop UI)
//  Step 3: Payment Summary (Stripe placeholder)
//
//  Uses React Hook Form + Zustand uiStore for step tracking.
//  URL param :countryId pre-selects the destination.
// ============================================================
import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { 
  ArrowRight, ArrowLeft, CheckCircle, 
  UploadCloud, Upload, User, Mail, Calendar, Plane, CreditCard, ShieldCheck, X, FileText, AlertCircle
} from "lucide-react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import Navbar from "../components/layout/Navbar";
import StepIndicator from "../components/ui/StepIndicator";
import Button from "../components/ui/Button";
import Input, { Select } from "../components/ui/Input";
import Card from "../components/ui/Card";
import { useUIStore } from "../store/uiStore";
import { useAuthStore } from "../store/authStore";
import { getCountryById, COUNTRIES } from "../data/countries";
import { useUIStore as useUI } from "../store/uiStore";
import { useDataStore } from "../store/dataStore";

// Helper to load Razorpay script dynamically
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// ── Step labels ────────────────────────────────────────────
const STEPS = ["Personal Info", "Documents", "Payment"];

const normalizeProcessingDays = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const matches = String(value || "").match(/\d+/g);
  if (!matches?.length) return 0;
  return Number(matches[matches.length - 1]);
};

// ── Nationality options ────────────────────────────────────
const NATIONALITIES = [
  { value: "us", label: "🇺🇸 United States" },
  { value: "in", label: "🇮🇳 India" },
  { value: "gb", label: "🇬🇧 United Kingdom" },
  { value: "ca", label: "🇨🇦 Canada" },
  { value: "au", label: "🇦🇺 Australia" },
  { value: "ae", label: "🇦🇪 UAE" },
  { value: "de", label: "🇩🇪 Germany" },
  { value: "fr", label: "🇫🇷 France" },
  { value: "jp", label: "🇯🇵 Japan" },
  { value: "sg", label: "🇸🇬 Singapore" },
  { value: "other", label: "🌍 Other" },
];

// ── Mock uploaded files ────────────────────────────────────
// In production, these would be uploaded to Cloudinary
const MOCK_DOCS = [
  { key: "passport", label: "Passport Copy", required: true, accept: ".pdf,.jpg,.png", icon: "🛂" },
  { key: "photo",    label: "Passport Photo", required: true, accept: ".jpg,.png",     icon: "📷" },
  { key: "bank",     label: "Bank Statement", required: false, accept: ".pdf",          icon: "🏦" },
  { key: "itinerary",label: "Travel Itinerary", required: false, accept: ".pdf",        icon: "✈️" },
];

// ─────────────────────────────────────────────────────────────
//  COMPONENT
// ─────────────────────────────────────────────────────────────
const ApplicationForm = () => {
  const { countryId } = useParams();
  const navigate       = useNavigate();
  const { user }       = useAuthStore();
  const { showToast }  = useUI();
  const { addBooking, applicationDraft, setApplicationDraft, clearApplicationDraft } = useDataStore();

  // Zustand step state
  const { currentStep, nextStep, prevStep, resetSteps } = useUIStore();

  // Get country data (or default to first country if none specified)
  const country = getCountryById(countryId) || COUNTRIES[0];
  

  // ── React Hook Form ────────────────────────────────────────
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    trigger,
    getValues,
  } = useForm({
    defaultValues: applicationDraft || {
      firstName:    user?.name?.split(" ")[0] || "",
      lastName:     user?.name?.split(" ")[1] || "",
      email:        user?.email || "",
      nationality:  "",
      passportNo:   "",
      dob:          "",
      travelDate:   "",
      returnDate:   "",
      purpose:      "tourism",
    },
  });

  // ── Document upload state ──────────────────────────────────
  const [uploadedFiles, setUploadedFiles] = useState({});
  const [dragging, setDragging]           = useState(null); // key of doc being dragged over
  const [submitted, setSubmitted]         = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);

  // ── Country selector (override via dropdown) ──────────────
  const [selectedCountryId, setSelectedCountryId] = useState(country.id);
  const selectedCountry = getCountryById(selectedCountryId) || country;

  // ── Handle file drop / select ─────────────────────────────
  const handleFileDrop = useCallback((key, file) => {
    if (!file) return;
    setUploadedFiles((prev) => ({ ...prev, [key]: file }));
  }, []);

  const removeFile = (key) => {
    setUploadedFiles((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  // ── Next step with validation trigger ─────────────────────
  const handleNext = async () => {
    // Step 1: validate personal info fields
    if (currentStep === 0) {
      const valid = await trigger(["firstName", "lastName", "email", "nationality", "passportNo", "dob", "travelDate"]);
      if (!valid) return;
    }
    // Step 2: check required docs
    if (currentStep === 1) {
      const missingRequired = MOCK_DOCS.filter((d) => d.required && !uploadedFiles[d.key]);
      if (missingRequired.length > 0) {
        showToast(`Please upload: ${missingRequired.map((d) => d.label).join(", ")}`, "error");
        return;
      }
    }

    // Save current form values to draft before moving next
    setApplicationDraft(getValues());

    nextStep();
  };

  const handlePayment = async ({ token, applicationId, applicantName, applicantEmail }) => {
    // A. Load Razorpay SDK
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded) {
      showToast("Razorpay SDK load nahi hua.", "error");
      return { success: false };
    }

    // Fetch public Razorpay key configured by Admin
    let razorpayKeyId = "";
    try {
      const configRes = await axios.get("http://localhost:5000/api/config/razorpay");
      if (configRes.data.success) {
        razorpayKeyId = configRes.data.keyId;
      }
    } catch (error) {
      showToast("Razorpay not configured. Please contact admin.", "error");
      return { success: false };
    }

    if (!razorpayKeyId) {
      showToast("Razorpay key missing in admin settings.", "error");
      return { success: false };
    }

    // B. Backend se Order ID mangwayein
    const orderRes = await axios.post(
      "http://localhost:5000/api/users/payments/create-order",
      {
        amount: selectedCountry.basePrice + 3000,
        applicationId,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!orderRes.data?.success || !orderRes.data?.order) {
      showToast("Payment order create nahi hua.", "error");
      return { success: false };
    }

    const order = orderRes.data.order;
    const amount = selectedCountry.basePrice + 3000;

    // C. Razorpay Popup Window
    return new Promise((resolve) => {
      const options = {
        key: razorpayKeyId,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Visa & Voyage",
        description: "Visa Fee Payment",
        order_id: order.id,
        handler: async function (response) {
          try {
            const freshToken = localStorage.getItem("token");
            const verifyRes = await axios.post(
              "http://localhost:5000/api/users/payments/verify",
              {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                applicationId,
                amount,
              },
              {
                headers: { Authorization: `Bearer ${freshToken}` },
              }
            );

            if (verifyRes.data?.success) {
              alert("Payment Verified! Application Submitted Successfully.");
              addBooking(verifyRes.data.application || { _id: applicationId });
              window.location.href = "/dashboard/profile";
              return resolve({ success: true });
            }

            showToast("Payment verification failed.", "error");
            return resolve({ success: false });
          } catch (error) {
            console.error("Verification Error:", error);
            alert("Payment ho gayi par verify nahi hui. Support se contact karein.");
            return resolve({ success: false });
          }
        },
        prefill: {
          name: applicantName,
          email: applicantEmail,
        },
        theme: { color: "#00d4ff" },
        modal: {
          ondismiss: async function () {
            console.log("Razorpay modal closed by user");
            try {
              const freshToken = localStorage.getItem("token");
              await axios.post(
                "http://localhost:5000/api/users/payments/cancel",
                {
                  applicationId,
                  reason: "User closed the payment window",
                },
                {
                  headers: { Authorization: `Bearer ${freshToken}` },
                }
              );
              showToast("Payment cancelled. You can complete it later from your dashboard.", "info");
              // Redirect to dashboard so they can see the cancelled status
              window.location.href = "/dashboard/profile";
            } catch (err) {
              console.error("Error recording cancellation:", err);
            }
            resolve({ success: false });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function () {
        showToast("Payment failed to start.", "error");
        resolve({ success: false });
      });
      rzp.open();
    });
  };

  // ── Final submit ──────────────────────────────────────────
  const onSubmit = async (data) => {
    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem("token"); // Fallback if authStore doesn't expose it
      
      const formData = new FormData();
      // Append text fields
      formData.append("firstName", data.firstName);
      formData.append("lastName", data.lastName);
      formData.append("email", data.email);
      formData.append("nationality", data.nationality);
      formData.append("passportNo", data.passportNo);
      formData.append("dob", data.dob);
      formData.append("travelDate", data.travelDate);
      if (data.returnDate) formData.append("returnDate", data.returnDate);
      
      formData.append("countryId", selectedCountry.id);
      formData.append("countryName", selectedCountry.name);
      formData.append("flagEmoji", selectedCountry.flagEmoji);
      formData.append("visaType", selectedCountry.visaType);
      formData.append("fee", selectedCountry.basePrice + 3000);
      formData.append("processingDays", normalizeProcessingDays(selectedCountry.processingDays));
      
      formData.append("paymentStatus", "pending_payment");

      // Append files
      Object.keys(uploadedFiles).forEach((key) => {
        // uploadedFiles[key] contains the actual File object
        formData.append("documents", uploadedFiles[key]);
      });

      // Submit to backend
      const response = await axios.post(
        "http://localhost:5000/api/users/application",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        const applicationId = response.data.application._id;
        const paymentResult = await handlePayment({
          token,
          applicationId,
          applicantName: `${data.firstName} ${data.lastName}`,
          applicantEmail: data.email,
        });

        if (paymentResult.success) {
          setSubmitted(true);
          resetSteps();
          clearApplicationDraft();
          showToast("Payment successful! Application submitted.", "success");
        }
      }
      setIsSubmitting(false);
    } catch (error) {
      console.error("Submission failed:", error);
      setIsSubmitting(false);
      showToast(error.response?.data?.message || "Application submission failed", "error");
    }
  };

  // ── Success screen ────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-24 h-24 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle size={48} className="text-emerald-400" />
            </motion.div>
            <h2 className="text-3xl font-bold text-text-primary mb-3">Application Submitted!</h2>
            <p className="text-text-secondary mb-8">
              Your {selectedCountry.name} visa application has been submitted.
              We'll notify you via email with updates.
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="primary" onClick={() => navigate("/dashboard")} id="go-to-dashboard-btn">
                View Dashboard
              </Button>
              <Button variant="secondary" onClick={() => { setSubmitted(false); resetSteps(); }} id="new-app-after-submit-btn">
                New Application
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {/* ── Page header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
            id="back-btn"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-primary mb-1">
            {selectedCountry.flagEmoji} {selectedCountry.name} Visa Application
          </h1>
          <p className="text-text-secondary text-sm">
            {selectedCountry.visaType} · Processing: {selectedCountry.processingDays} days
          </p>
        </motion.div>

        {/* ── Step indicator ── */}
        <div className="mb-8">
          <StepIndicator steps={STEPS} currentStep={currentStep} />
        </div>

        {/* ── Step panels ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >

            {/* ══════════════════════════════════════
                STEP 1: PERSONAL INFORMATION
                ══════════════════════════════════════ */}
            {currentStep === 0 && (
              <Card>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-cyan/10 flex items-center justify-center">
                    <User size={20} className="text-cyan" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-text-primary">Personal Information</h2>
                    <p className="text-xs text-text-muted">Exactly as shown on your passport</p>
                  </div>
                </div>

                <form className="space-y-5">
                  {/* Name row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="First Name"
                      placeholder="John"
                      leftIcon={<User size={15} />}
                      error={errors.firstName?.message}
                      id="form-first-name"
                      {...register("firstName", { required: "First name is required" })}
                    />
                    <Input
                      label="Last Name"
                      placeholder="Doe"
                      error={errors.lastName?.message}
                      id="form-last-name"
                      {...register("lastName", { required: "Last name is required" })}
                    />
                  </div>

                  {/* Email */}
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="john@example.com"
                    leftIcon={<Mail size={15} />}
                    error={errors.email?.message}
                    id="form-email"
                    {...register("email", {
                      required: "Email is required",
                      pattern: { value: /^[^@]+@[^@]+\.[^@]+$/, message: "Invalid email" },
                    })}
                  />

                  {/* Nationality + DOB */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Select
                      label="Nationality"
                      options={NATIONALITIES}
                      placeholder="Select nationality..."
                      error={errors.nationality?.message}
                      id="form-nationality"
                      {...register("nationality", { required: "Nationality is required" })}
                    />
                    <Input
                      label="Date of Birth"
                      type="date"
                      leftIcon={<Calendar size={15} />}
                      error={errors.dob?.message}
                      id="form-dob"
                      className="[color-scheme:dark]"
                      {...register("dob", { required: "Date of birth is required" })}
                    />
                  </div>

                  {/* Passport number */}
                  <Input
                    label="Passport Number"
                    placeholder="e.g. A12345678"
                    error={errors.passportNo?.message}
                    id="form-passport"
                    helper="Enter the number exactly as shown on your passport"
                    {...register("passportNo", {
                      required: "Passport number is required",
                      minLength: { value: 6, message: "Invalid passport number" },
                    })}
                  />

                  {/* Travel dates */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Intended Arrival Date"
                      type="date"
                      leftIcon={<Plane size={15} />}
                      error={errors.travelDate?.message}
                      id="form-travel-date"
                      className="[color-scheme:dark]"
                      {...register("travelDate", { required: "Travel date is required" })}
                    />
                    <Input
                      label="Intended Return Date"
                      type="date"
                      id="form-return-date"
                      className="[color-scheme:dark]"
                      {...register("returnDate")}
                    />
                  </div>

                  {/* Destination override */}
                  <div>
                    <label className="text-sm font-medium text-text-secondary mb-1.5 block">
                      Destination Country
                    </label>
                    <select
                      id="form-country"
                      value={selectedCountryId}
                      onChange={(e) => setSelectedCountryId(e.target.value)}
                      className="w-full bg-surface-2 text-text-primary border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan [color-scheme:dark]"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.flagEmoji} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </form>
              </Card>
            )}

            {/* ══════════════════════════════════════
                STEP 2: DOCUMENT UPLOAD
                ══════════════════════════════════════ */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <Card>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
                      <FileText size={20} className="text-gold" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-text-primary">Upload Documents</h2>
                      <p className="text-xs text-text-muted">Accepted: PDF, JPG, PNG. Max 10MB each.</p>
                    </div>
                  </div>
                </Card>

                {/* Required documents checklist */}
                <Card>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">
                    {selectedCountry.name} Requirements
                  </h3>
                  <ul className="space-y-2">
                    {selectedCountry.requirements.map((req) => (
                      <li key={req} className="flex items-center gap-2 text-sm text-text-secondary">
                        <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                        {req}
                      </li>
                    ))}
                  </ul>
                </Card>

                {/* Upload zones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {MOCK_DOCS.map((doc) => {
                    const file = uploadedFiles[doc.key];
                    return (
                      <div key={doc.key}>
                        {/* Drop zone */}
                        <div
                          id={`upload-${doc.key}`}
                          onDragOver={(e) => { e.preventDefault(); setDragging(doc.key); }}
                          onDragLeave={() => setDragging(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragging(null);
                            const f = e.dataTransfer.files[0];
                            if (f) handleFileDrop(doc.key, f);
                          }}
                          className={`
                            relative rounded-xl border-2 border-dashed p-5 text-center transition-all duration-200 cursor-pointer
                            ${dragging === doc.key
                              ? "border-cyan bg-cyan/10"
                              : file
                              ? "border-emerald-500/40 bg-emerald-500/5"
                              : "border-border hover:border-cyan/30 hover:bg-surface-3"
                            }
                          `}
                        >
                          {file ? (
                            /* Uploaded state */
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                                <CheckCircle size={18} className="text-emerald-400" />
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                                <p className="text-xs text-text-muted">
                                  {(file.size / 1024).toFixed(0)} KB
                                </p>
                              </div>
                              <button
                                onClick={() => removeFile(doc.key)}
                                className="p-1 rounded-lg hover:bg-red-500/10 text-text-muted hover:text-red-400 transition-colors"
                                aria-label={`Remove ${doc.label}`}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            /* Empty upload state */
                            <>
                              <div className="text-3xl mb-2">{doc.icon}</div>
                              <p className="text-sm font-medium text-text-primary">
                                {doc.label}
                                {doc.required && <span className="text-red-400 ml-1">*</span>}
                              </p>
                              <p className="text-xs text-text-muted mt-1 mb-3">
                                Drag & drop or click to browse
                              </p>
                              <label
                                htmlFor={`file-input-${doc.key}`}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-3 text-xs text-text-secondary hover:text-text-primary cursor-pointer transition-colors"
                              >
                                <Upload size={12} /> Browse
                              </label>
                              <input
                                id={`file-input-${doc.key}`}
                                type="file"
                                accept={doc.accept}
                                className="hidden"
                                onChange={(e) => handleFileDrop(doc.key, e.target.files[0])}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Security note */}
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-cyan/5 border border-cyan/15">
                  <ShieldCheck size={16} className="text-cyan flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-text-secondary">
                    All documents are encrypted with 256-bit SSL. We never share your data without consent.
                    Files are automatically deleted after visa decision.
                  </p>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════
                STEP 3: PAYMENT SUMMARY
                ══════════════════════════════════════ */}
            {currentStep === 2 && (
              <div className="space-y-5">
                {/* Order summary */}
                <Card>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <CheckCircle size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-text-primary">Payment Summary</h2>
                      <p className="text-xs text-text-muted">Review your order before payment</p>
                    </div>
                  </div>

                  {/* Fee breakdown */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">{selectedCountry.name} {selectedCountry.visaType}</span>
                      <span className="text-text-primary font-medium">₹{selectedCountry.basePrice}.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Processing Fee</span>
                      <span className="text-text-primary font-medium">₹2000.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-text-secondary">Service Fee</span>
                      <span className="text-text-primary font-medium">₹1000.00</span>
                    </div>
                    <div className="border-t border-border pt-3 flex justify-between">
                      <span className="font-semibold text-text-primary">Total Due</span>
                      <span className="font-bold text-xl text-cyan">
                        ₹{selectedCountry.basePrice + 3000}.00
                      </span>
                    </div>
                  </div>

                  {/* Processing time */}
                  <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-2 border border-border">
                    <AlertCircle size={16} className="text-amber-400 flex-shrink-0" />
                    <p className="text-xs text-text-secondary">
                      Expected processing time: <strong className="text-text-primary">{selectedCountry.processingDays} business days</strong>.
                      You'll receive email updates at every stage.
                    </p>
                  </div>
                </Card>

                {/* Razorpay CTA Card */}
                <Card>
                  <div className="flex items-center gap-3 mb-5">
                    <CreditCard size={20} className="text-cyan" />
                    <h3 className="font-semibold text-text-primary">Secure Payment via Razorpay</h3>
                  </div>

                  <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                    Clicking <strong className="text-text-primary">"Pay &amp; Submit Application"</strong> below will open a
                    secure Razorpay checkout. You can pay using Credit/Debit Card, UPI, Net Banking, or Wallets.
                  </p>

                  {/* Security badges */}
                  <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-emerald-400" />
                      <span className="text-xs text-text-muted">256-bit SSL Encrypted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={14} className="text-cyan" />
                      <span className="text-xs text-text-muted">PCI DSS Compliant</span>
                    </div>
                    <div className="ml-auto flex gap-2">
                      {["UPI", "Cards", "Net Banking"].map((m) => (
                        <span key={m} className="text-xs px-2 py-0.5 rounded bg-surface-3 text-text-muted">{m}</span>
                      ))}
                    </div>
                  </div>
                </Card>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* ── Navigation buttons ── */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="ghost"
            leftIcon={<ArrowLeft size={16} />}
            onClick={() => {
              if (currentStep === 0) {
                navigate(-1);
              } else {
                setApplicationDraft(getValues());
                prevStep();
              }
            }}
            id="form-prev-btn"
          >
            {currentStep === 0 ? "Cancel" : "Back"}
          </Button>

          {currentStep < STEPS.length - 1 ? (
            <Button
              variant="primary"
              rightIcon={<ArrowRight size={16} />}
              onClick={handleNext}
              id="form-next-btn"
            >
              Continue
            </Button>
          ) : (
            <Button
              variant="primary"
              leftIcon={<ShieldCheck size={16} />}
              loading={isSubmitting}
              onClick={handleSubmit(onSubmit)}
              id="form-submit-btn"
            >
              Pay & Submit Application
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApplicationForm;
