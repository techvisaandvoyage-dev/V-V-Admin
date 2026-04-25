import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Edit3, Save, Lock, User, Calendar, Plane, CheckCircle } from "lucide-react";
import { useDataStore } from "../store/dataStore";
import { useUIStore } from "../store/uiStore";
import { StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Input, { Select } from "../components/ui/Input";
import Card from "../components/ui/Card";
import Navbar from "../components/layout/Navbar";

const NATIONALITIES = [
  { value: "us", label: "🇺🇸 United States" },
  { value: "in", label: "🇮🇳 India" },
  { value: "gb", label: "🇬🇧 United Kingdom" },
  { value: "ca", label: "🇨🇦 Canada" },
  { value: "au", label: "🇦🇺 Australia" },
  { value: "other", label: "🌍 Other" },
];

const ApplicationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bookings, updateBookingDetails } = useDataStore();
  const { showToast } = useUIStore();

  // Find the exact booking requested via the URL
  // Find the exact booking requested via the URL (checks both _id from MongoDB and id from mock)
  const booking = bookings.find((b) => (b._id || b.id) === id);

  // Editable flag: Only true if status is pending or submitted
  // This satisfies the requirement: "when its pending... its updatable... when its under review... only its readable"
  const isEditable = booking?.status === "pending" || booking?.status === "submitted";

  // Form State
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    passportNo: "",
    nationality: "",
    dob: "",
    travelDate: "",
    returnDate: "",
  });

  // Local loading state for save simulation
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form data when booking loads
  useEffect(() => {
    if (booking) {
      setFormData({
        firstName: booking.firstName || booking.userName.split(" ")[0] || "",
        lastName: booking.lastName || booking.userName.split(" ")[1] || "",
        email: booking.userEmail || "",
        passportNo: booking.passportNo || "",
        nationality: booking.nationality || "",
        dob: booking.dob || "",
        travelDate: booking.travelDate || "",
        returnDate: booking.returnDate || "",
      });
    }
  }, [booking]);

  // Handle Missing Booking
  if (!booking) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <h2 className="text-2xl font-bold text-text-primary mb-2">Application Not Found</h2>
          <p className="text-text-secondary mb-6">We couldn't find the requested application.</p>
          <Button variant="primary" onClick={() => navigate("/dashboard")}>Return to Dashboard</Button>
        </div>
      </div>
    );
  }

  // Handle Form Change
  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  // Handle Save
  const handleSave = async () => {
    if (!isEditable) return;
    
    setIsSaving(true);
    // Simulate network delay
    await new Promise(res => setTimeout(res, 800));
    
    // Update the central data store
    updateBookingDetails(id, {
      ...formData,
      userName: `${formData.firstName} ${formData.lastName}`.trim()
    });
    
    setIsSaving(false);
    showToast("Application details updated successfully!", "success");
  };

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary flex items-center gap-3">
              Application Details
              <StatusBadge status={booking.status} />
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              ID: {booking.id} • Submitted on {new Date(booking.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Status Notification Banner */}
        {!isEditable ? (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 mb-8 rounded-xl bg-amber-500/10 border border-amber-500/20"
          >
            <Lock className="text-amber-400 mt-0.5 flex-shrink-0" size={18} />
            <div>
              <h3 className="text-amber-400 font-semibold text-sm">Application Locked</h3>
              <p className="text-text-secondary text-xs mt-1">
                This application is currently marked as <strong>{booking.status}</strong>. 
                Your details are under review and can no longer be edited.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-4 mb-8 rounded-xl bg-cyan/10 border border-cyan/20"
          >
            <Edit3 className="text-cyan mt-0.5 flex-shrink-0" size={18} />
            <div>
              <h3 className="text-cyan font-semibold text-sm">Editable Mode Active</h3>
              <p className="text-text-secondary text-xs mt-1">
                Your application is currently <strong>{booking.status}</strong>. You can update your details below before the review process begins.
              </p>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Form Area */}
          <div className="md:col-span-2 space-y-6">
            <Card>
              <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4 mb-6 flex items-center gap-2">
                <User size={18} className="text-cyan" />
                Personal Information
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  disabled={!isEditable}
                  className={!isEditable ? "opacity-60 cursor-not-allowed" : ""}
                />
                <Input
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  disabled={!isEditable}
                  className={!isEditable ? "opacity-60 cursor-not-allowed" : ""}
                />
                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={!isEditable}
                  className={!isEditable ? "opacity-60 cursor-not-allowed" : ""}
                />
                <Select
                  label="Nationality"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  options={NATIONALITIES}
                  disabled={!isEditable}
                  className={!isEditable ? "opacity-60 cursor-not-allowed" : ""}
                />
                <Input
                  label="Passport Number"
                  name="passportNo"
                  value={formData.passportNo}
                  onChange={handleChange}
                  disabled={!isEditable}
                  className={!isEditable ? "opacity-60 cursor-not-allowed" : ""}
                />
                <Input
                  label="Date of Birth"
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  disabled={!isEditable}
                  className={`[color-scheme:dark] ${!isEditable ? "opacity-60 cursor-not-allowed" : ""}`}
                />
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4 mb-6 flex items-center gap-2">
                <Plane size={18} className="text-cyan" />
                Travel Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input
                  label="Intended Arrival Date"
                  type="date"
                  name="travelDate"
                  value={formData.travelDate}
                  onChange={handleChange}
                  disabled={!isEditable}
                  className={`[color-scheme:dark] ${!isEditable ? "opacity-60 cursor-not-allowed" : ""}`}
                />
                <Input
                  label="Intended Return Date"
                  type="date"
                  name="returnDate"
                  value={formData.returnDate}
                  onChange={handleChange}
                  disabled={!isEditable}
                  className={`[color-scheme:dark] ${!isEditable ? "opacity-60 cursor-not-allowed" : ""}`}
                />
              </div>
            </Card>

            {isEditable && (
              <div className="flex justify-end pt-4">
                <Button 
                  variant="primary" 
                  onClick={handleSave} 
                  loading={isSaving}
                  leftIcon={<Save size={18} />}
                  size="lg"
                >
                  Save Changes
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar / Overview */}
          <div className="space-y-6">
            <Card>
              <h3 className="font-semibold text-text-primary mb-4 border-b border-border pb-3">Destination</h3>
              <div className="flex items-center gap-4">
                <span className="text-4xl">{booking.flagEmoji}</span>
                <div>
                  <p className="font-bold text-text-primary">{booking.countryName}</p>
                  <p className="text-xs text-text-secondary">{booking.visaType}</p>
                </div>
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold text-text-primary mb-4 border-b border-border pb-3">Summary</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between">
                  <span className="text-text-secondary">Fee Paid</span>
                  <span className="font-medium text-text-primary">${booking.fee}.00</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-text-secondary">Est. Processing</span>
                  <span className="font-medium text-text-primary">{booking.processingDays || "N/A"} days</span>
                </li>
                <li className="flex flex-col border-t border-border pt-3 mt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-text-secondary">Documents</span>
                    <span className="font-medium text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={14} /> Uploaded
                    </span>
                  </div>
                  {booking.documents && booking.documents.length > 0 ? (
                    <ul className="text-xs text-text-muted pl-1 space-y-1 mt-1">
                      {booking.documents.map((doc, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-cyan" />
                          {doc}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-text-muted mt-1">No documents attached.</p>
                  )}
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ApplicationDetails;
