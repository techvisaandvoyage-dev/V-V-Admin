import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowLeft, Clock, ShieldCheck, CheckCircle, Search, AlertCircle, Minus, Plus, Calendar, Home, Globe } from "lucide-react";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Button from "../components/ui/Button";
import { useDataStore } from "../store/dataStore";

const ease = [0.16, 1, 0.3, 1];
const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.6, ease } }
};

// Date Helpers
const getFutureDate = (daysInFuture) => {
  const d = new Date();
  d.setDate(d.getDate() + daysInFuture);
  return d;
};
const formatDate = (date) => {
  const day = date.getDate();
  const suffix = ["th", "st", "nd", "rd"][(day % 10 > 3 ? 0 : (day % 100 - day % 10 != 10) * day % 10)];
  return `${day}${suffix} ${date.toLocaleDateString("en-US", { month: "short", year: "2-digit" })}`;
};

const CountryDetails = () => {
  const { countryId } = useParams();
  const navigate = useNavigate();
  const { getCountryById } = useDataStore();
  const country = getCountryById(countryId);

  // State for checkout card
  const [travellers, setTravellers] = useState(1);
  const [paidGovtFee, setPaidGovtFee] = useState("no");
  const [activeTab, setActiveTab] = useState("info"); // dummy sub-nav state

  if (!country) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-text-primary">Destination not found</h1>
        <Button onClick={() => navigate("/")} className="mt-4">Return Home</Button>
      </div>
    );
  }

  // Parse processing days string (e.g. "3-5" or "5") into a number
  const parsedProcessingDays = parseInt(String(country.processingDays).split("-").pop() || "5", 10);

  // Calculated Dates
  const fastDateObj = getFutureDate(parsedProcessingDays);
  const govtDateObj = getFutureDate(parsedProcessingDays * 4); // Fake govt lag
  const todayFormatted = "Today";
  const fastFormatted = formatDate(fastDateObj);
  const govtFormatted  = formatDate(govtDateObj);

  // Calculated Prices
  const serviceFeePerPerson = 3000;
  const govtFeePerPerson   = Number(country.basePrice) || 0;
  
  const totalGovt = govtFeePerPerson * travellers;
  const totalService = serviceFeePerPerson * travellers;
  // If they clicked YES to already paid, zero out govt fee from total
  const finalPayNow = paidGovtFee === "yes" ? totalService : totalGovt + totalService;

  const SUB_NAV = [
    { id: "info", label: "Visa Info" },
    { id: "why", label: "Why book now?" },
    { id: "included", label: "What's Included" },
    { id: "reviews", label: "Reviews" },
    { id: "faq", label: "FAQs" }
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <Navbar />
      
      {/* ── Sub Navigation Bar ── */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur-md border-b border-border/50 shadow-sm hidden sm:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <ul className="flex items-center gap-8 overflow-x-auto no-scrollbar">
            {SUB_NAV.map((tab) => (
              <li key={tab.id}>
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                    ${activeTab === tab.id 
                      ? "border-cyan text-cyan" 
                      : "border-transparent text-text-secondary hover:text-text-primary"
                    }
                  `}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 w-full">
        
        <button
          onClick={() => navigate("/")}
          className="group flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-cyan transition-colors mb-10 w-fit"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          
          {/* ══════════════════════════════════════
              LEFT CONTENT (7 cols)
              ══════════════════════════════════════ */}
          <div className="lg:col-span-7 space-y-12">
            
            {/* ── Massive Typography Header ── */}
            <motion.div initial="initial" animate="animate" variants={fadeUp}>
              <h1 className="text-4xl sm:text-5xl font-bold text-text-primary leading-tight tracking-tight">
                Secure your {country.name} Visa before{" "}
                <span className="text-cyan block sm:inline mt-2">{fastFormatted}</span>
                <span className="text-cyan/70 font-light"> in {country.processingDays} days</span>
              </h1>
            </motion.div>

            {/* ── Timeline Track ── */}
            <motion.div 
              className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.1, duration: 0.6, ease } }}
            >
              {/* Header inside track */}
              <div className="bg-surface-2 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium text-cyan border-b border-border">
                <Globe size={16} /> Fastest processing in {country.continent}
              </div>
              
              {/* Actual timeline graph */}
              <div className="p-8 pb-12 relative overflow-hidden">
                <div className="relative h-20 w-full flex items-center justify-between before:content-[''] before:absolute before:left-4 before:right-4 before:h-0.5 before:bg-border before:z-0">
                  
                  {/* Point 1: Today */}
                  <div className="relative z-10 flex flex-col items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-text-muted ring-4 ring-background"></div>
                    <span className="absolute top-6 text-xs text-text-secondary whitespace-nowrap">Today</span>
                  </div>

                  {/* Point 2: Visa & Voyage */}
                  <div className="relative z-10 flex flex-col items-center gap-3 w-1/3">
                    <div className="absolute -top-10 px-3 py-1 rounded-full bg-cyan text-background text-xs font-bold shadow-md">
                      Visa & Voyage
                    </div>
                    <div className="w-4 h-4 rounded-full bg-cyan ring-4 ring-cyan/20"></div>
                    <span className="absolute top-6 text-xs font-semibold text-cyan whitespace-nowrap">{fastFormatted}</span>
                  </div>

                  {/* Point 3: Dummy middle */}
                  <div className="relative z-10 flex flex-col items-center gap-3 hidden sm:flex">
                    <div className="w-3 h-3 rounded-full bg-surface-3 ring-4 ring-background"></div>
                  </div>

                  {/* Point 4: Govt standard */}
                  <div className="relative z-10 flex flex-col items-center gap-3 w-1/4">
                    <div className="absolute -top-10 px-3 py-1 rounded-full bg-surface-3 text-text-secondary text-xs font-bold border border-border">
                      Govt Standard
                    </div>
                    <div className="w-4 h-4 rounded-full bg-surface-3 ring-4 ring-background"></div>
                    <span className="absolute top-6 text-xs text-text-secondary whitespace-nowrap">{govtFormatted}</span>
                  </div>

                </div>
              </div>
              
              {/* Timeline Features */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-6 pt-0">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Search size={18} className="text-text-primary" />
                    <h4 className="font-semibold text-text-primary text-sm">24/7 Application Monitoring</h4>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Our real-time tracker monitors your application status and embassy slots round the clock.
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={18} className="text-text-primary" />
                    <h4 className="font-semibold text-text-primary text-sm">Instant Processing</h4>
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Our system auto-secures an appointment or processes e-Visa requests the moment they open.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* ── Extra Content blocks (Requirements, etc.) ── */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.2, duration: 0.6, ease } }}
              className="space-y-6"
            >
              <h2 className="text-2xl font-bold text-text-primary tracking-tight">
                Mandatory Requirements
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {country.requirements?.map((req, i) => (
                  <div key={i} className="flex gap-3 p-4 rounded-xl border border-border/50 bg-surface/30">
                    <CheckCircle size={18} className="text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-text-secondary text-sm leading-relaxed">{req}</span>
                  </div>
                ))}
              </div>
            </motion.div>

          </div>

          {/* ══════════════════════════════════════
              RIGHT SIDEBAR (5 cols) - Checkout Card
              ══════════════════════════════════════ */}
          <div className="lg:col-span-5 relative">
            <motion.div
              className="sticky top-24"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, transition: { delay: 0.15, duration: 0.6, ease } }}
            >
              <div className="bg-surface border border-border rounded-3xl shadow-xl overflow-hidden flex flex-col">
                
                {/* Header Banner */}
                <div className="bg-surface-2/80 px-4 py-3 border-b border-border flex items-center gap-2 text-sm font-medium text-cyan">
                  <ShieldCheck size={18} />
                  Visa Guaranteed by {fastFormatted}
                </div>

                {/* Form Elements */}
                <div className="p-6 sm:p-8 space-y-6">
                  
                  {/* Selectors */}
                  <div className="flex items-center gap-4 border-b border-border pb-6">
                    <div className="flex-1">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-1 block">Embassy</label>
                      <select className="w-full bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-sm font-semibold text-text-primary outline-none cursor-pointer [color-scheme:dark] focus:border-cyan/50 transition-colors">
                        <option value="global">Global Online</option>
                        <option value="local">Local Consulate</option>
                      </select>
                    </div>
                    <div className="w-[1px] h-10 bg-border self-end mb-1"></div>
                    <div className="flex-1 pl-4">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-1 block">Visa Type</label>
                      <select className="w-full bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-sm font-semibold text-text-primary outline-none cursor-pointer [color-scheme:dark] focus:border-cyan/50 transition-colors">
                        <option>{country.visaType}</option>
                        <option>Business</option>
                      </select>
                    </div>
                  </div>

                  {/* Travellers Counter */}
                  <div className="flex items-center justify-between border-b border-border pb-6">
                    <div className="flex items-center gap-2 text-text-primary font-semibold text-sm">
                      <Home size={18} /> Travellers
                    </div>
                    <div className="flex items-center gap-4">
                      <button 
                        onClick={() => setTravellers(Math.max(1, travellers - 1))}
                        className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-muted hover:bg-surface-2 transition-colors disabled:opacity-50"
                        disabled={travellers <= 1}
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-4 text-center font-bold text-text-primary">{travellers}</span>
                      <button 
                        onClick={() => setTravellers(travellers + 1)}
                        className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-text-muted hover:bg-surface-2 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Giant Price */}
                  <div className="text-center py-4">
                    <h2 className="text-5xl font-extrabold text-text-primary mb-1 tracking-tight">
                      ₹{finalPayNow}
                    </h2>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      To be paid now
                    </p>
                  </div>

                  {/* Fee Toggle */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface-2 border border-border">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-primary">
                      <AlertCircle size={14} className="text-text-muted" />
                      Have you paid Govt fees yet?
                    </div>
                    <div className="flex bg-background rounded-lg p-1">
                      <button
                        onClick={() => setPaidGovtFee("yes")}
                        className={`px-4 py-1 text-xs rounded-md font-semibold transition-all ${paidGovtFee === "yes" ? "bg-cyan text-background shadow-sm" : "text-text-muted hover:text-text-primary"}`}
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setPaidGovtFee("no")}
                        className={`px-4 py-1 text-xs rounded-md font-semibold transition-all ${paidGovtFee === "no" ? "bg-cyan text-background shadow-sm" : "text-text-muted hover:text-text-primary"}`}
                      >
                        No
                      </button>
                    </div>
                  </div>

                  {/* Receipt Breakdown */}
                  <div className="bg-surface/50 rounded-xl p-5 border border-border/50 text-sm space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-text-primary flex items-center gap-2">
                          <Calendar size={14} /> Pay Now
                        </p>
                        <p className="text-xs text-text-muted mt-0.5 underline decoration-dashed underline-offset-4 cursor-help">
                          {paidGovtFee === "no" ? "Government Fees + Service" : "Processing Fee Only"}
                        </p>
                      </div>
                      <p className="font-bold text-text-primary">₹{finalPayNow}</p>
                    </div>
                    
                    {paidGovtFee === "yes" && (
                      <div className="flex items-start justify-between opacity-50">
                        <div>
                          <p className="font-semibold text-text-primary flex items-center gap-2">
                            <CheckCircle size={14} /> Already Paid
                          </p>
                          <p className="text-xs text-text-muted mt-0.5">Government Fees</p>
                        </div>
                        <p className="font-medium text-text-primary line-through">₹{totalGovt}</p>
                      </div>
                    )}
                    
                    <div className="border-t border-border pt-4 flex items-center justify-between">
                      <p className="font-bold text-text-primary">Total Secure Amount</p>
                      <p className="font-extrabold text-lg text-text-primary">₹{finalPayNow}</p>
                    </div>
                  </div>

                  {/* CTA */}
                  <Button 
                    variant="primary" 
                    fullWidth 
                    size="lg"
                    className="h-14 font-semibold text-sm rounded-xl tracking-wide shadow-cyan-glow"
                    onClick={() => navigate(`/apply/${country.id}`)}
                  >
                    Reserve Appointment Now
                  </Button>

                </div>
              </div>
            </motion.div>
          </div>

        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CountryDetails;
