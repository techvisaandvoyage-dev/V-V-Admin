import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Download, CheckCircle, Clock, MapPin, User, Mail, Calendar, Plane, Eye, CreditCard } from "lucide-react";
import { useUIStore } from "../store/uiStore";
import { useDataStore } from "../store/dataStore";
import Navbar from "../components/layout/Navbar";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { StatusBadge } from "../components/ui/Badge";
import { useAuthStore, api, SERVER_URL } from "../store/authStore";

const Details = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const bookings = useDataStore((state) => state.bookings);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApplication = async () => {
      // Fallback for mock data
      if (id.startsWith("bk-")) {
        const mockBooking = bookings.find(b => (b.id === id || b._id === id));
        if (mockBooking) {
          setApplication({
            ...mockBooking,
            _id: mockBooking.id,
            firstName: mockBooking.userName.split(" ")[0],
            lastName: mockBooking.userName.split(" ").slice(1).join(" "),
            email: mockBooking.userEmail,
            passportNo: mockBooking.passportNo || "MOCK-0000",
            nationality: mockBooking.nationality || "Unknown",
            dob: mockBooking.dob || "1990-01-01T00:00:00.000Z",
          });
        }
        setLoading(false);
        return;
      }

      try {
        const { data } = await api.get(`/admin/applications/${id}`);
        if (data.success) {
          setApplication(data.application);
        }
      } catch (error) {
        console.error("Failed to fetch application:", error);
        showToast("Failed to load applicant data", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchApplication();
  }, [id, showToast]);

  const handleDownload = async (docUrl) => {
    try {
      const fullUrl = `${SERVER_URL}${docUrl}`;
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = docUrl.split("/").pop(); // Extract filename
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading file:", error);
      showToast("Failed to download file", "error");
    }
  };

  const handleUpdateStatus = async (newStatus) => {
    try {
      if (id.startsWith("bk-")) {
        // Fallback for mock data
        useDataStore.getState().updateBookingStatus(id, newStatus);
        setApplication(prev => ({ ...prev, status: newStatus }));
        showToast(`Application updated to ${newStatus}`, "success");
        return;
      }

      const { data } = await api.put(`/admin/applications/${id}/status`, 
        { status: newStatus }
      );
      
      if (data.success) {
        setApplication(data.application);
        showToast(`Application updated to ${newStatus}`, "success");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      showToast("Failed to update status", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan"></div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h2 className="text-2xl font-bold text-text-primary mb-4">Applicant Not Found</h2>
          <Button variant="primary" onClick={() => navigate("/")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-30 ">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-4"
            >
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-text-primary flex items-center gap-3">
              Application Details
              <StatusBadge status={application.status} />
            </h1>
            <p className="text-text-secondary text-sm mt-1">
              Application ID: {application._id} • Submitted on {new Date(application.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols gap-6">
          {/* Left Column: Applicant Data */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4 mb-6 flex items-center gap-2">
                <User size={18} className="text-cyan" />
                Personal Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <p className="text-sm text-text-muted mb-1">Full Name</p>
                  <p className="font-medium text-text-primary">{application.firstName} {application.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Email Address</p>
                  <p className="font-medium text-text-primary flex items-center gap-2">
                    {application.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Passport Number</p>
                  <p className="font-medium text-text-primary font-mono">{application.passportNo}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Nationality</p>
                  <p className="font-medium text-text-primary uppercase">{application.nationality}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Date of Birth</p>
                  <p className="font-medium text-text-primary">{new Date(application.dob).toLocaleDateString()}</p>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4 mb-6 flex items-center gap-2">
                <Plane size={18} className="text-cyan" />
                Travel Information
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <p className="text-sm text-text-muted mb-1">Destination</p>
                  <p className="font-medium text-text-primary text-lg flex items-center gap-2">
                    {application.flagEmoji} {application.countryName}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Visa Type</p>
                  <p className="font-medium text-text-primary">{application.visaType}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Intended Arrival</p>
                  <p className="font-medium text-text-primary">{new Date(application.travelDate).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-sm text-text-muted mb-1">Intended Return</p>
                  <p className="font-medium text-text-primary">
                    {application.returnDate ? new Date(application.returnDate).toLocaleDateString() : "Not Specified"}
                  </p>
                </div>
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-semibold text-text-primary border-b border-border pb-4 mb-4 flex items-center gap-2">
                <FileText size={18} className="text-emerald-400" />
                Uploaded Documents
              </h2>
              
              {application.documents && application.documents.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {application.documents.map((doc, idx) => {
                    const fileName = doc.split('/').pop();
                    const fullUrl = `${SERVER_URL}${doc}`;

                    return (
                      <div key={idx} className="p-4 bg-surface-2 rounded-xl border border-border flex flex-col gap-4">
                        <div className="flex items-center gap-3 w-full">
                          <div className="w-10 h-10 rounded-lg bg-surface-3 border border-border flex items-center justify-center flex-shrink-0">
                            <FileText size={20} className="text-cyan" />
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-center">
                            <p className="text-sm font-medium text-text-primary truncate" title={fileName}>
                              {fileName}
                            </p>
                            <p className="text-xs text-text-muted">Document</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/50">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1 h-9 text-xs"
                            onClick={() => window.open(fullUrl, '_blank')}
                          >
                            <Eye size={14} className="mr-1.5" />
                            Preview
                          </Button>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            className="flex-1 h-9 text-xs"
                            onClick={() => handleDownload(doc)}
                          >
                            <Download size={14} className="mr-1.5" />
                            Download
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-text-muted text-center py-6">No documents were uploaded.</p>
              )}
            </Card>
          </div>

          {/* Right Column: Financial & Actions */}
          <div className="space-y-6">
            <Card>
              <h3 className="font-semibold text-text-primary mb-4 border-b border-border pb-3">Financial Overview</h3>
              <ul className="space-y-3 text-sm mb-6">
                <li className="flex justify-between">
                  <span className="text-text-secondary">Fee Paid</span>
                  <span className="font-medium text-text-primary">₹{application.fee}.00</span>
                </li>
                <li className="flex justify-between items-center">
                  <span className="text-text-secondary">Transaction ID</span>
                  <span className="font-mono text-xs bg-surface-3 px-2 py-1 rounded text-text-primary">
                    {application.transactionId || application.paymentIntentId || "N/A"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-text-secondary">Payment Method</span>
                  <span className="font-medium text-text-primary flex items-center gap-1.5">
                    <CreditCard size={14} className="text-cyan" />
                    {application.paymentMethod || "Card (Default)"}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-text-secondary">Status</span>
                  <span className="font-medium text-emerald-400 flex items-center gap-1">
                    <CheckCircle size={14} /> {application.paymentStatus === 'completed' ? 'Verified' : 'Verified'}
                  </span>
                </li>
              </ul>

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Update Status</p>
                <Button 
                  variant="primary" 
                  className="w-full bg-emerald-500 hover:bg-emerald-600 h-10"
                  onClick={() => handleUpdateStatus('approved')}
                >
                  Approve Visa
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="ghost" 
                    className="text-amber-400 hover:bg-amber-400/10 h-9 text-xs"
                    onClick={() => handleUpdateStatus('review')}
                  >
                    Mark Review
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="text-red-400 hover:bg-red-400/10 h-9 text-xs"
                    onClick={() => handleUpdateStatus('rejected')}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Details;
