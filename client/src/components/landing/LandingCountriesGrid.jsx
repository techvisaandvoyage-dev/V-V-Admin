import { memo } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Button from "../ui/Button";
import ImageWithShimmer from "../ui/ImageWithShimmer";
import { getCountryFlagEmoji, getCountryCardCodeBadge } from "../../utils/countrySearch";
import { getCountryRouteId } from "../../utils/countryRouting";

/** Show the actual visa type set in admin (no longer collapsed to 3 buckets). */
function getCardVisaTypeLabel(visaTypeValue) {
  const value = String(visaTypeValue || "").trim();
  return value || "Tourist Visa";
}

/** Same trick used on the details page — show "5-10 days" when only digits, else verbatim. */
function getProcessingDaysLabel(value) {
  const v = String(value ?? "").trim();
  if (!v) return "—";
  return /^\d+(\s*-\s*\d+)?$/.test(v) ? `${v} days` : v;
}

/**
 * Build the ordered tile list shown at the bottom of each country card. We always
 * cap the card at THREE tiles to keep the layout uniform. Priority order is:
 *
 *   1. Visa Type (if `showVisaType` is on)
 *   2. Validity  (if `showValidity` is on)
 *   3. Fee — always shown, never togglable
 *
 * Processing Days is a **fill-in tile**: it slides in only when one of Visa Type
 * or Validity is hidden, taking that freed slot. If all three core tiles are on
 * we never display Processing Days on the card (it still shows on the details
 * page). Toggling Processing Days off simply prevents it from ever filling.
 */
function buildCountryTiles(country, display) {
  const tiles = [];
  if (display?.showVisaType !== false) {
    tiles.push({
      key: "visaType",
      label: "VISA TYPE",
      value: getCardVisaTypeLabel(country.visaType),
    });
  }
  if (display?.showValidity !== false) {
    tiles.push({
      key: "validity",
      label: "VALIDITY",
      value: country.validity || "—",
    });
  }
  // Only slot Processing Days in when there's free space before Fee (i.e. Type
  // and/or Validity were toggled off). +1 reserves the Fee slot.
  if (display?.showProcessingDays !== false && tiles.length + 1 < 3) {
    tiles.push({
      key: "processingDays",
      label: "PROCESSING",
      value: getProcessingDaysLabel(country.processingDays),
    });
  }
  tiles.push({ key: "fees", label: "FEES", value: `₹${country.basePrice}` });
  return tiles;
}

/** Tailwind cannot generate `grid-cols-N` from a runtime variable. */
const GRID_COLS_BY_COUNT = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

const DOCUMENT_LABELS = {
  passport: "Passport",
  oldPassport: "Old Passport",
  photo: "Passport Photo",
  idCard: "Aadhaar / ID Card",
  panCard: "PAN Card",
  drivingLicense: "Driving License",
  birthCertificate: "Birth Certificate",
  dobCertificate: "DOB Certificate",
  marriageCertificate: "Marriage Certificate",
  educationCertificate: "Academic Records",
  employmentLetter: "Employment Letter",
  offerLetter: "Offer Letter",
  salarySlip: "Salary Slip",
  form16: "Form 16",
  taxReturn: "ITR / Tax Return",
  bankStatement: "Bank Statement",
  bankCertificate: "Bank Certificate",
  propertyDocuments: "Property Documents",
  travelInsurance: "Travel Insurance",
  healthInsurance: "Health Insurance",
  flightTicket: "Flight Ticket",
  hotelBooking: "Hotel Booking",
  itinerary: "Travel Itinerary",
  coverLetter: "Cover Letter",
  invitationLetter: "Invitation Letter",
  sponsorLetter: "Sponsor Letter",
  policeClearance: "Police Clearance",
  noObjectionCertificate: "NOC",
  yellowFever: "Yellow Fever",
  covidVaccination: "COVID Proof",
  visaApplicationForm: "Visa Form",
  businessLicense: "Business License",
  companyRegistration: "Company Registration",
};

/**
 * Normalise document fields from backend/admin to a clean string array.
 * Checks all possible fields and handles both array and newline-string formats.
 */
function getCountryDocuments(country) {
  const docs =
    country?.documentRequirements ||
    country?.documentsRequired ||
    country?.requiredDocuments ||
    country?.documentChecklist ||
    country?.visaRequirements ||
    [];

  if (Array.isArray(docs)) {
    // If it's an array of objects (like {key, label}), extract the labels or keys
    return docs.map(d => (typeof d === 'string' ? d : d.label || d.key || '')).filter(Boolean);
  }

  if (typeof docs === "string") {
    return docs
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

/** 
 * Resolves a document key (like 'passport') to a human label. 
 * Prioritizes the live documentCatalog from admin.
 */
const getDocumentLabel = (key, documentCatalog) => {
  if (!key) return "";
  // If the key is already a descriptive string (from getCountryDocuments split), use it
  if (key.length > 20 || key.includes(" ")) return key;

  const fromCatalog = documentCatalog?.find?.((d) => d.key === key)?.label;
  if (fromCatalog) return fromCatalog;
  if (DOCUMENT_LABELS[key]) return DOCUMENT_LABELS[key];
  
  // Clean up camelCase or snake_case if no label found
  return key
    .replace(/^custom_/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();
};

/**
 * Isolated grid so typing / geocode updates in the hero do not re-render these heavy cards.
 */
const LandingCountriesGrid = memo(function LandingCountriesGrid({
  filteredCountries,
  countryCardRefs,
  display,
  documentCatalog,
  globalRequirements = [],
  showVisaRequirements = true,
  onNavigateDestination,
  onNavigateAll,
}) {
  // Helper to normalize strings for comparison in exclusion logic
  const normKey = (str) => String(str ?? "").toLowerCase().trim();

  // Helper to merge lists while avoiding duplicates
  const mergeStringLists = (globalList, countryList) => {
    const seen = new Set();
    const out = [];
    const pushUnique = (line) => {
      const s = String(line ?? "").trim();
      if (!s) return;
      const key = normKey(s);
      if (seen.has(key)) return;
      seen.add(key);
      out.push(s);
    };
    (Array.isArray(globalList) ? globalList : []).forEach(pushUnique);
    (Array.isArray(countryList) ? countryList : []).forEach(pushUnique);
    return out;
  };
  return (
    <section id="destinations" className="pt-8 pb-16 px-4 sm:px-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-3xl sm:text-4xl font-bold">Countries</h2>
        <Button
          variant="secondary"
          rightIcon={<ArrowRight size={16} />}
          onClick={onNavigateAll}
          id="view-all-destinations-btn"
        >
          View All Countries
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredCountries.map((country, i) => {
          // Strictly use the official upload documents defined in the admin, limited to 4.
          const allDocs = getCountryDocuments(country).slice(0, 4);

          // Fixed height for 4 docs (2 rows) to ensure a premium, non-variable look.
          // Base (110px header/footer) + (2 rows * 32px)
          const panelHeight = 110 + (Math.ceil(allDocs.length / 2) * 32);
          
          return (
            <motion.div
              ref={(el) => {
                countryCardRefs.current[getCountryRouteId(country)] = el;
              }}
              key={getCountryRouteId(country)}
              id={`country-card-${getCountryRouteId(country)}`}
              initial="hidden"
              whileInView="visible"
              whileHover="hover"
              viewport={{ once: true, margin: "-20px" }}
              variants={{
                hidden: { opacity: 0, y: 20 },
                visible: { opacity: 1, y: 0 },
                hover: { y: 0 }
              }}
              transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.5, ease: "easeOut" }}
              className="group cursor-pointer h-full relative"
              onClick={() => onNavigateDestination(country)}
              style={{ willChange: "transform" }}
            >
              <div className="bg-surface border border-border rounded-3xl overflow-hidden hover:border-cyan/30 hover:shadow-cyan-glow transition-all duration-300 h-full min-h-[500px] relative isolate">
                <ImageWithShimmer
                  src={country.imageUrl}
                  alt={country.name}
                  className="h-full min-h-[500px]"
                  priority={i < 4}
                  width={500}
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 transition-opacity duration-500" />

                  {/* Top Badge */}
                  <div className="absolute top-3 left-3 z-30 text-[10px] font-semibold text-white drop-shadow-md bg-black/50 px-2 py-1 rounded-md">
                    {getCountryCardCodeBadge(country)}
                  </div>

                  {/* Flag Fallback */}
                  {!country.imageUrl ? (
                    <div
                      className="absolute top-[40%] left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white/92 border border-white/70 shadow-xl flex items-center justify-center text-3xl select-none"
                      role="img"
                      aria-label={country.name}
                    >
                      {getCountryFlagEmoji(country.name, country.flagEmoji)}
                    </div>
                  ) : null}

                  {/* Main Content Wrapper - Pushes UP dynamically based on panel height */}
                  <motion.div 
                    variants={{
                      visible: { y: 0 },
                      hover: { y: showVisaRequirements ? -panelHeight : 0 }
                    }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute inset-0 flex flex-col justify-end p-6 z-30 pointer-events-none"
                    style={{ willChange: "transform", backfaceVisibility: "hidden" }}
                  >
                    <div
                      className={`text-center mb-6 ${
                        country.imageUrl ? "" : "translate-y-[-20%]"
                      }`}
                    >
                      <motion.h3 
                        variants={{
                          visible: { scale: 1 },
                          hover: { scale: 1.02 }
                        }}
                        className="font-bold text-white text-3xl tracking-wide drop-shadow-2xl uppercase leading-tight"
                      >
                        {country.name}
                      </motion.h3>
                    </div>

                    {(() => {
                      const tiles = buildCountryTiles(country, display);
                      const cols = GRID_COLS_BY_COUNT[tiles.length] || "grid-cols-3";
                      return (
                        <div className={`grid ${cols} gap-2 text-center`}>
                          {tiles.map((tile) => (
                            <div key={tile.key} className="min-w-0">
                              <p className="text-[10px] tracking-widest text-white/80 mb-0.5 uppercase font-bold drop-shadow-md">
                                {tile.label}
                              </p>
                              <p
                                className="text-[12px] font-bold text-white truncate drop-shadow-xl"
                                title={tile.value}
                              >
                                {tile.value}
                              </p>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </motion.div>

                  {/* Documents Section - Extra Height without scrollbar */}
                  {showVisaRequirements && (
                    <motion.div 
                      variants={{
                        visible: { y: panelHeight },
                        hover: { y: 0 }
                      }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute bottom-0 left-0 right-0 p-6 backdrop-blur-2xl z-20 flex flex-col"
                    style={{ 
                      height: panelHeight, 
                      willChange: "transform",
                      background: "linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.5) 100%)",
                      maskImage: "linear-gradient(to top, black 80%, transparent 100%)",
                      WebkitMaskImage: "linear-gradient(to top, black 80%, transparent 100%)",
                    }}
                  >
                    <p className="text-[10px] font-black text-white/50 tracking-[0.2em] uppercase mb-4 px-1 drop-shadow-md">
                      Documents Required
                    </p>
                    
                    <div className="flex-1">
                      {allDocs.length > 0 ? (
                        <ul className="grid grid-cols-2 gap-x-3 gap-y-3.5">
                          {allDocs.map((key, idx) => (
                            <li key={idx} className="flex items-start gap-1.5 text-[11px] text-white/95 font-semibold leading-tight drop-shadow-lg">
                              <Check size={11} className="text-cyan shrink-0 mt-0.5" strokeWidth={3} />
                              <span className="line-clamp-2" title={getDocumentLabel(key, documentCatalog)}>
                                {getDocumentLabel(key, documentCatalog)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[11px] text-white/60 italic mt-2 px-1">
                          Documents will be shown on details page
                        </p>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                      <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Instant Application</span>
                      <div className="flex items-center gap-1.5 text-cyan">
                        <span className="text-[10px] font-black uppercase">Apply Now</span>
                        <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                )}
                </ImageWithShimmer>
              </div>
            </motion.div>
          );
        })}
        </div>
      </section>
    );
  },
  (prev, next) => prev.countryIdsKey === next.countryIdsKey
);

export default LandingCountriesGrid;
