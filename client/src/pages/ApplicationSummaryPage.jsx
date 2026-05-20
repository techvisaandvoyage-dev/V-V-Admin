import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle, CreditCard, Loader2, ShieldCheck, Info } from "lucide-react";
import Navbar from "../components/layout/Navbar";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { api, useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";
import { openRazorpayForApplication, validateRazorpayCheckoutReadiness } from "../utils/razorpayCheckout";
import { slugifyCountryRoute } from "../utils/countryRouting";
import { getLocalDateYmd } from "../utils/dateInput";
import { useCountries, useMergedCountry } from "../hooks/useCountries";

const normalizeProcessingDays = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const matches = String(value || "").match(/\d+/g);
  if (!matches?.length) return 0;
  return Number(matches[matches.length - 1]);
};

/** Same slug as `/terms` and the CMS seed — public GET `/api/pages/:slug`. */
const TERMS_CMS_SLUG = "terms-and-conditions";

const formatTravelerDateForInput = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
};

const ApplicationSummaryPage = () => {
  const { id: paramId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const id = paramId 
    || location.state?.summaryData?.applicationId 
    || (() => {
         try {
           const raw = sessionStorage.getItem("paymentSummarySource");
           return raw ? JSON.parse(raw).applicationDraftId : null;
         } catch { return null; }
       })();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const docsSkipped = Boolean(location.state?.docsSkipped);
  const summaryData = location.state?.summaryData || null;

  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsModalOpen, setTermsModalOpen] = useState(false);
  const [termsPage, setTermsPage] = useState(null);
  const [termsPageLoading, setTermsPageLoading] = useState(false);
  const [termsPageError, setTermsPageError] = useState("");
  const [paying, setPaying] = useState(false);
  const [razorpayReady, setRazorpayReady] = useState(false);
  const [razorpayMessage, setRazorpayMessage] = useState("");
  const countryIdForPricing = summaryData?.countryId || application?.countryId || "";
  const { countries: allCountries } = useCountries();
  const listCountry = allCountries.find((c) => c.id === countryIdForPricing);
  const country = useMergedCountry(countryIdForPricing, listCountry);

  useEffect(() => {
    if (!id) {
      if (summaryData) {
        setApplication({
          _id: null,
          countryName: summaryData.countryName || "Visa",
          flagEmoji: summaryData.flagEmoji || "🛂",
          visaType: summaryData.visaType || "e-Visa",
          travellerCount: summaryData.travellerCount || 1,
          travelerNames: summaryData.travelerNames || [],
          fee: Number(summaryData.fee || 0),
          travellerDocuments: summaryData.docsUploaded ? [{}] : [],
        });
      }
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/users/applications/${id}`);
        if (data?.success) setApplication(data.application);
        else showToast(data?.message || "Could not load application.", "error");
      } catch (err) {
        showToast(err.response?.data?.message || "Could not load application summary.", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, summaryData]);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const result = await validateRazorpayCheckoutReadiness();
      if (!mounted) return;
      setRazorpayReady(!!result.ok);
      setRazorpayMessage(result.ok ? "" : result.message || "Razorpay unavailable.");
    };
    check();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!termsModalOpen) return;
    if (termsPage) return;
    let cancelled = false;
    const loadTerms = async () => {
      setTermsPageLoading(true);
      setTermsPageError("");
      try {
        const { data } = await api.get(`/pages/${TERMS_CMS_SLUG}`);
        if (cancelled) return;
        if (data?.page) setTermsPage(data.page);
        else setTermsPageError(data?.message || "Terms page is not available.");
      } catch (err) {
        if (!cancelled) {
          setTermsPageError(err.response?.data?.message || "Could not load terms and conditions.");
        }
      } finally {
        if (!cancelled) setTermsPageLoading(false);
      }
    };
    loadTerms();
    return () => { cancelled = true; };
  }, [termsModalOpen, termsPage]);

  const travelerCount = Math.max(1, Number(application?.travellerCount || 1));

  const travelerNames = useMemo(() => {
    const names = Array.isArray(application?.travelerNames) ? application.travelerNames : [];
    return Array.from({ length: travelerCount }).map((_, i) => names[i] || `Traveler ${i + 1}`);
  }, [application?.travelerNames, travelerCount]);

  const effectiveGstEnabled =
    typeof summaryData?.gstEnabled === "boolean"
      ? summaryData.gstEnabled
      : country?.gstEnabled !== false;
  const effectiveGstRate = Number.isFinite(Number(summaryData?.gstRate))
    ? Number(summaryData.gstRate)
    : Number.isFinite(Number(country?.gstRate))
      ? Number(country.gstRate)
      : 18;

  const { serviceFee, taxes, totalAmount } = useMemo(() => {
    const service = Number.isFinite(Number(summaryData?.baseFee))
      ? Number(summaryData.baseFee)
      : Number.isFinite(Number(country?.basePrice))
        ? Number(country.basePrice) * travelerCount
        : 0;
    const gst = Number.isFinite(Number(summaryData?.gstAmount))
      ? Number(summaryData.gstAmount)
      : effectiveGstEnabled
        ? Math.round(service * (effectiveGstRate / 100))
        : 0;
    const fromServer = Number(application?.fee);
    const fromState = Number(summaryData?.fee);
    return {
      serviceFee: service,
      taxes: gst,
      totalAmount:
        Number.isFinite(fromServer) && fromServer > 0
          ? fromServer
          : Number.isFinite(fromState) && fromState > 0
            ? fromState
            : service + gst,
    };
  }, [application?.fee, summaryData?.fee, summaryData?.baseFee, summaryData?.gstAmount, country?.basePrice, travelerCount, effectiveGstEnabled, effectiveGstRate]);

  /**
   * Compute the "documents uploaded" status for the status tile + step pill.
   *
   * IMPORTANT: `application.travellerDocuments` is created with one entry per
   * traveler by the upload flow even when the user uploads no files (the form
   * still calls `PUT /users/applications/:id` to save the traveler name /
   * gdriveLink). So `travellerDocuments.length >= travelerCount` is NOT a
   * reliable signal — we have to look at whether each entry actually contains
   * a non-empty `documents` map (or any `otherDocuments` / `gdriveLink`).
   *
   * Priority:
   *   1. If the caller explicitly told us via `location.state.docsSkipped`
   *      that the user chose to skip the upload step → docsUploaded = false.
   *   2. If `summaryData.docsUploaded` is an explicit boolean → trust it.
   *   3. Otherwise inspect each traveler entry on the server record.
   */
  const docsUploaded = useMemo(() => {
    if (docsSkipped) return false;
    if (summaryData && typeof summaryData.docsUploaded === "boolean") {
      return summaryData.docsUploaded;
    }
    const entries = Array.isArray(application?.travellerDocuments)
      ? application.travellerDocuments
      : [];
    if (entries.length < travelerCount) return false;
    const entryHasUpload = (entry) => {
      if (!entry || typeof entry !== "object") return false;
      const docs = entry.documents;
      if (docs) {
        if (docs instanceof Map && docs.size > 0) return true;
        if (typeof docs === "object" && Object.keys(docs).length > 0) return true;
      }
      if (Array.isArray(entry.otherDocuments) && entry.otherDocuments.length > 0) return true;
      return false;
    };
    return entries.slice(0, travelerCount).every(entryHasUpload);
  }, [docsSkipped, summaryData, application?.travellerDocuments, travelerCount]);

  const handleGoToUploadForm = () => {
    const previousFlowPath = location.state?.applicationPrev?.path;
    const previousFlowState = location.state?.applicationPrev?.state;
    if (previousFlowPath) {
      navigate(previousFlowPath, {
        state: previousFlowState || undefined,
        replace: true,
      });
      return;
    }

    if (countryIdForPricing) {
      navigate(`/apply/${encodeURIComponent(countryIdForPricing)}`, {
        state: {
          travelDateFrom: summaryData?.travelDateFrom ?? null,
          travelDateTo: summaryData?.travelDateTo ?? null,
          visaOption: summaryData?.visaType || application?.visaType || "e-Visa",
          travelers: Array.isArray(summaryData?.travelers) ? summaryData.travelers : [],
        },
      });
      return;
    }

    showToast("Upload page is not available for this application yet.", "error");
  };

  const handleBack = () => {
    const formatDateToYmd = (val) => {
      if (!val) return null;
      const str = String(val);
      if (str.includes("T")) return str.slice(0, 10);
      return str;
    };

    const restoreTravelDetails = {
      travelDateFrom: formatDateToYmd(summaryData?.travelDateFrom ?? application?.travelDate),
      travelDateTo: formatDateToYmd(summaryData?.travelDateTo ?? application?.returnDate),
      visaOption: summaryData?.visaType || application?.visaType,
      travelers: Array.isArray(summaryData?.travelers) && summaryData.travelers.length
        ? summaryData.travelers.map((traveler) => ({
            ...traveler,
            name: traveler?.name ?? traveler?.fullName ?? "",
          }))
        : (Array.isArray(application?.travelerSelections) && application.travelerSelections.length
            ? application.travelerSelections.map((entry, index) => ({
                travelerProfileId: entry?.travelerProfileId || entry?.travelerSnapshot?.travelerProfileId || "",
                fullName: entry?.travelerSnapshot?.fullName || application?.travelerNames?.[index] || "",
                name: entry?.travelerSnapshot?.fullName || application?.travelerNames?.[index] || "",
                dateOfBirth: formatTravelerDateForInput(entry?.travelerSnapshot?.dateOfBirth),
                gender: entry?.travelerSnapshot?.gender || "",
                passportNumber: entry?.travelerSnapshot?.passportNumber || "",
                passportExpiryDate: formatTravelerDateForInput(entry?.travelerSnapshot?.passportExpiryDate),
                nationality: entry?.travelerSnapshot?.nationality || "",
                mobileNumber: entry?.travelerSnapshot?.mobileNumber || "",
                email: entry?.travelerSnapshot?.email || "",
                relationship: entry?.travelerSnapshot?.relationship || "Self",
              }))
            : (summaryData?.travelerNames || application?.travelerNames || []).map((name) => ({
                name: String(name || ""),
                fullName: String(name || ""),
              }))),
    };

    const savedCountryId = localStorage.getItem("lastActiveCountryId");
    const savedCountryName = localStorage.getItem("lastActiveCountryName");

    let exactBackPath = location.state?.backTo || location.state?.applicationPrev?.path;
    if (!exactBackPath) {
      try {
        const rawSource = sessionStorage.getItem("paymentSummarySource");
        if (rawSource) {
          const source = JSON.parse(rawSource);
          if (source?.backTo) exactBackPath = source.backTo;
        }
      } catch (e) {
        /* ignore */
      }
    }

    const countryRoute = slugifyCountryRoute(
      summaryData?.countryName ||
      application?.countryName ||
      savedCountryName ||
      ""
    );

    if (exactBackPath || countryRoute) {
      const draftCountryKey = exactBackPath ? exactBackPath.split('/').pop() : countryRoute;
      try {
        const draftKey = `travelDraft_${draftCountryKey}`;
        const existingRaw = localStorage.getItem(draftKey);
        const existingDraft = existingRaw ? JSON.parse(existingRaw) : null;

        const hasNewData =
          restoreTravelDetails.travelers &&
          restoreTravelDetails.travelers.length > 0 &&
          restoreTravelDetails.travelers.some((t) => String(t.name || "").trim().length > 0);

        if (hasNewData || !existingDraft) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              travelDateFrom: restoreTravelDetails.travelDateFrom,
              travelDateTo: restoreTravelDetails.travelDateTo,
              visaOption: restoreTravelDetails.visaOption,
              travelers: restoreTravelDetails.travelers,
              showTravelDetails: true,
            })
          );
        } else if (existingDraft) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              ...existingDraft,
              showTravelDetails: true,
            })
          );
        }
      } catch (err) {
        console.error("Failed to write fallback travel draft", err);
      }

      navigate(exactBackPath || `/destination/${encodeURIComponent(countryRoute)}`, {
        state: { restoreTravelDetails },
        replace: true,
      });
      return;
    }

    const countryId =
      summaryData?.countryId ||
      application?.countryId ||
      savedCountryId;

    if (countryId) {
      try {
        const draftKey = `travelDraft_${countryId}`;
        const existingRaw = localStorage.getItem(draftKey);
        const existingDraft = existingRaw ? JSON.parse(existingRaw) : null;

        const hasNewData =
          restoreTravelDetails.travelers &&
          restoreTravelDetails.travelers.length > 0 &&
          restoreTravelDetails.travelers.some((t) => String(t.name || "").trim().length > 0);

        if (hasNewData || !existingDraft) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              travelDateFrom: restoreTravelDetails.travelDateFrom,
              travelDateTo: restoreTravelDetails.travelDateTo,
              visaOption: restoreTravelDetails.visaOption,
              travelers: restoreTravelDetails.travelers,
              showTravelDetails: true,
            })
          );
        } else if (existingDraft) {
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              ...existingDraft,
              showTravelDetails: true,
            })
          );
        }
      } catch (err) {
        console.error("Failed to write fallback travel draft", err);
      }

      navigate(`/destination/${encodeURIComponent(countryId)}`, {
        state: { restoreTravelDetails },
        replace: true,
      });
      return;
    }

    // Default ultimate fallback - home page instead of dashboard
    navigate("/", { replace: true });
  };

  const resolvePayAmountRupees = (appDoc) => {
    const fromServer = Number(appDoc?.fee);
    if (Number.isFinite(fromServer) && fromServer > 0) return fromServer;
    const fromState = Number(summaryData?.fee);
    if (Number.isFinite(fromState) && fromState > 0) return fromState;
    return totalAmount;
  };

  const handlePay = async () => {
    if (!termsAccepted) {
      showToast("Please accept the terms and conditions.", "error");
      return;
    }
    if (!razorpayReady) {
      showToast(razorpayMessage || "Payment is not available right now.", "error");
      return;
    }

    let app = application;
    let appId = app?._id;

    setPaying(true);
    try {
      if (!appId && summaryData?.countryId) {
        const { data } = await api.post("/users/application/checkout-draft", {
          countryId: summaryData.countryId,
          countryName: summaryData.countryName,
          flagEmoji: summaryData.flagEmoji || "🛂",
          visaType: summaryData.visaType || "e-Visa",
          travelDateFrom: summaryData.travelDateFrom ?? null,
          travelDateTo: summaryData.travelDateTo ?? null,
          travellerCount: summaryData.travellerCount || 1,
          travelerNames: Array.isArray(summaryData.travelerNames) ? summaryData.travelerNames : [],
          travelers: Array.isArray(summaryData.travelers) ? summaryData.travelers : [],
          processingDays: normalizeProcessingDays(summaryData.processingDays),
        });
        if (!data?.success || !data.application?._id) {
          showToast(data?.message || "Could not start application for payment.", "error");
          return;
        }
        app = data.application;
        appId = data.application._id;
        setApplication(data.application);
      }

      if (!appId) {
        showToast("Application not found. Go back and continue from the document step.", "error");
        return;
      }

      const amountRupees = resolvePayAmountRupees(app);

      await openRazorpayForApplication({
        applicationId: appId,
        amountRupees,
        description: `${app.countryName || "Visa"} — service fee`,
        applicantName: user?.name || "Applicant",
        applicantEmail: user?.email || "",
        onSuccess: () => {
          try {
            localStorage.removeItem("exitIntentPendingContext");
          } catch {}
          showToast("Payment successful!", "success");
          navigate(`/dashboard/application/${encodeURIComponent(appId)}`, { replace: true });
        },
        onDismiss: () => {
          showToast("Payment was not completed. You can continue from this summary page anytime.", "info");
        },
        onFailure: (m) => {
          showToast(m || "Payment could not be started.", "error");
          navigate(`/dashboard?payment=failed&applicationId=${encodeURIComponent(appId)}`, { replace: true });
        },
      });
    } catch (err) {
      showToast(err.response?.data?.message || "Could not start payment.", "error");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan animate-spin" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p className="text-text-primary font-semibold">Application not found.</p>
          <Button variant="secondary" onClick={handleBack}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">
      <Navbar />
      <main className="flex-1 px-4 sm:px-6 py-8">

        {/* Back */}
        <button
          type="button"
          onClick={handleBack}
          className="group flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-cyan transition-colors mb-6 w-fit"
        >
          <ArrowLeft size={16} className="pointer-events-none group-hover:-translate-x-1 transition-transform" />
          Back
        </button>

        <div className="max-w-lg w-full mx-auto space-y-6">
        {/* Header */}
        <div>
          <p className="text-xs uppercase tracking-wider text-cyan font-semibold mb-1">
            {application.flagEmoji} {application.countryName}
          </p>
          <h1 className="text-2xl font-bold text-text-primary">Payment Summary</h1>
          <p className="text-sm text-text-secondary mt-1">{application.visaType}</p>
          <p className="text-xs font-mono text-text-muted mt-2">
            Application ID: {application.applicationId || application._id || "Will be assigned on application creation"}
          </p>
        </div>

        {/* Travelers */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-2">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Traveler Details</h3>
          {travelerNames.map((name, idx) => (
            <div key={idx} className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Traveler {idx + 1}</span>
              <span className="font-medium text-text-primary">{name}</span>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={handleGoToUploadForm}
          >
            Upload your documents now
          </Button>
        </div>

        {(!docsUploaded || docsSkipped) && (
          <div className="rounded-2xl border border-cyan/30 bg-cyan/5 p-4">
            <div className="flex items-start gap-3">
              <Info size={18} className="text-cyan mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-text-primary">
                  Documents can be uploaded after payment
                </p>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Complete payment now, then upload required traveler documents from your dashboard application section.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Billing */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-3">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Billing</h3>

          <div className="flex justify-between text-sm">
            <span className="text-text-secondary">
              Service Fee {travelerCount > 1 ? `(${travelerCount} x ₹${Number(country?.basePrice || 0).toLocaleString("en-IN")})` : ""}
            </span>
            <span className="text-text-primary">₹{serviceFee.toLocaleString("en-IN")}</span>
          </div>
          {effectiveGstEnabled && (
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">GST ({effectiveGstRate}%)</span>
              <span className="text-text-primary">₹{taxes.toLocaleString("en-IN")}</span>
            </div>
          )}
          <div className="border-t border-border pt-3 flex justify-between text-base font-semibold">
            <span className="text-text-primary">Total</span>
            <span className="text-cyan">₹{totalAmount.toLocaleString("en-IN")}</span>
          </div>
          <p className="text-xs text-text-muted">
            Government / embassy fees (if any) are shown separately at payment.
          </p>
        </div>

        {/* T&C + Pay */}
        <div className="rounded-2xl border border-border bg-surface p-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-border text-cyan accent-cyan"
            />
            <span className="text-sm text-text-secondary leading-snug">
              I agree to the{" "}
              <button
                type="button"
                className="text-cyan hover:underline font-medium bg-transparent border-0 p-0 cursor-pointer inline align-baseline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTermsModalOpen(true);
                }}
              >
                terms and conditions
              </button>{" "}
              and understand that the amount above covers service charges only.
            </span>
          </label>

          {!razorpayReady && (
            <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 rounded-xl px-3 py-2">
              <ShieldCheck size={14} className="mt-0.5 shrink-0" />
              {razorpayMessage || "Payment gateway is not configured. Contact support."}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            leftIcon={<CreditCard size={18} />}
            loading={paying}
            disabled={!termsAccepted || !razorpayReady || paying}
            onClick={handlePay}
          >
            Proceed to Payment
          </Button>

          <p className="text-xs text-text-muted text-center">
            Secured by Razorpay · Your payment info is never stored
          </p>
        </div>
        </div>

      </main>

      <Modal
        isOpen={termsModalOpen}
        onClose={() => setTermsModalOpen(false)}
        title={termsPage?.title || "Terms and Conditions"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="md" onClick={() => setTermsModalOpen(false)}>
              Deny
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setTermsAccepted(true);
                setTermsModalOpen(false);
              }}
            >
              Accept
            </Button>
          </div>
        }
      >
        <div className="max-h-[min(52vh,400px)] overflow-y-auto overscroll-contain pr-0.5 -mr-0.5">
          {termsPageLoading && (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan animate-spin" />
            </div>
          )}
          {!termsPageLoading && termsPageError && (
            <p className="text-sm text-amber-400 text-center py-6">{termsPageError}</p>
          )}
          {!termsPageLoading && !termsPageError && termsPage?.content && (
            <article
              className="prose prose-sm prose-neutral max-w-none text-text-primary prose-headings:text-text-primary prose-p:text-text-secondary prose-li:text-text-secondary prose-strong:text-text-primary prose-a:text-cyan [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:p-2 [&_ul]:pl-4"
              dangerouslySetInnerHTML={{ __html: termsPage.content }}
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ApplicationSummaryPage;
