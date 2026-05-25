import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import ImageWithShimmer from "../ui/ImageWithShimmer";
import { getCountryFlagEmoji, getCountryCardCodeBadge } from "../../utils/countrySearch";

function getCardVisaTypeLabel(visaTypeValue) {
  const value = String(visaTypeValue || "").trim();
  return value || "Tourist Visa";
}

function getProcessingDaysLabel(value) {
  const v = String(value ?? "").trim();
  if (!v) return "-";
  return /^\d+(\s*-\s*\d+)?$/.test(v) ? `${v} days` : v;
}

function getGovernmentFeeValue(country) {
  const candidates = [
    country?.governmentFee,
    country?.governmentFeeOverride,
    country?.governmentFees,
    country?.govtFee,
    country?.govFee,
    country?.embassyFee,
    country?.visaFee,
  ];
  const match = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) >= 0);
  return Number.isFinite(Number(match)) ? Number(match) : 0;
}

function buildCountryTiles(country, display) {
  const tiles = [];
  if (display?.showVisaType !== false) {
    tiles.push({ key: "visaType", label: "VISA TYPE", value: getCardVisaTypeLabel(country.visaType) });
  }
  if (display?.showValidity !== false) {
    tiles.push({ key: "validity", label: "VALIDITY", value: country.validity || "-" });
  }
  if (display?.showProcessingDays !== false && tiles.length + 1 < 3) {
    tiles.push({
      key: "processingDays",
      label: "PROCESSING",
      value: getProcessingDaysLabel(country.processingDays),
    });
  }
  tiles.push({ key: "fees", label: "GOVT FEE", value: `₹${getGovernmentFeeValue(country)}` });
  return tiles;
}

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

function getCountryDocuments(country) {
  const docs =
    country?.documentRequirements ||
    country?.documentsRequired ||
    country?.requiredDocuments ||
    country?.documentChecklist ||
    country?.visaRequirements ||
    [];

  if (Array.isArray(docs)) {
    return docs.map((d) => (typeof d === "string" ? d : d.label || d.key || "")).filter(Boolean);
  }

  if (typeof docs === "string") {
    return docs
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function getDocumentLabel(key, documentCatalog) {
  if (!key) return "";
  if (key.length > 20 || key.includes(" ")) return key;

  const fromCatalog = documentCatalog?.find?.((d) => d.key === key)?.label;
  if (fromCatalog) return fromCatalog;
  if (DOCUMENT_LABELS[key]) return DOCUMENT_LABELS[key];

  return key
    .replace(/^custom_/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .trim();
}

const DestinationCard = ({
  country,
  index = 0,
  display,
  documentCatalog = [],
  showVisaRequirements = true,
  onClick,
  cardRef,
  id,
}) => {
  const allDocs = getCountryDocuments(country).slice(0, 4);
  const panelHeight = 110 + Math.ceil(allDocs.length / 2) * 32;

  return (
    <motion.div
      ref={cardRef}
      id={id}
      initial="hidden"
      whileInView="visible"
      whileHover="hover"
      viewport={{ once: true, margin: "-20px" }}
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
        hover: { y: 0 },
      }}
      transition={{ delay: Math.min(index * 0.04, 0.4), duration: 0.5, ease: "easeOut" }}
      className="group relative h-full cursor-pointer"
      onClick={onClick}
      style={{ willChange: "transform" }}
    >
      <div className="relative isolate h-full min-h-[500px] overflow-hidden rounded-3xl border border-border bg-surface transition-all duration-300 hover:border-cyan/30 hover:shadow-cyan-glow">
        <ImageWithShimmer
          src={country.imageUrl}
          alt={country.name}
          className="h-full min-h-[500px]"
          priority={index < 4}
          width={500}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60 transition-opacity duration-500" />

          <div className="absolute left-3 top-3 z-30 rounded-md bg-black/50 px-2 py-1 text-[10px] font-semibold text-white drop-shadow-md">
            {getCountryCardCodeBadge(country)}
          </div>

          {!country.imageUrl ? (
            <div
              className="absolute left-1/2 top-[40%] flex h-16 w-16 -translate-x-1/2 items-center justify-center rounded-full border border-white/70 bg-white/92 text-3xl shadow-xl"
              role="img"
              aria-label={country.name}
            >
              {getCountryFlagEmoji(country.name, country.flagEmoji)}
            </div>
          ) : null}

          <motion.div
            variants={{
              visible: { y: 0 },
              hover: { y: showVisaRequirements ? -panelHeight : 0 },
            }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="pointer-events-none absolute inset-0 z-30 flex flex-col justify-end p-6"
            style={{ willChange: "transform", backfaceVisibility: "hidden" }}
          >
            <div className={`mb-6 text-center ${country.imageUrl ? "" : "translate-y-[-20%]"}`}>
              <motion.h3
                variants={{
                  visible: { scale: 1 },
                  hover: { scale: 1.02 },
                }}
                className="text-3xl font-bold uppercase leading-tight tracking-wide text-white drop-shadow-2xl"
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
                      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-white/80 drop-shadow-md">
                        {tile.label}
                      </p>
                      <p className="truncate text-[12px] font-bold text-white drop-shadow-xl" title={tile.value}>
                        {tile.value}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </motion.div>

          {showVisaRequirements && (
            <motion.div
              variants={{
                visible: { y: panelHeight },
                hover: { y: 0 },
              }}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="absolute bottom-0 left-0 right-0 z-20 flex flex-col p-6 backdrop-blur-2xl"
              style={{
                height: panelHeight,
                willChange: "transform",
                background: "linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.5) 100%)",
                maskImage: "linear-gradient(to top, black 80%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(to top, black 80%, transparent 100%)",
              }}
            >
              <p className="mb-4 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/50 drop-shadow-md">
                Documents Required
              </p>

              <div className="flex-1">
                {allDocs.length > 0 ? (
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-3.5">
                    {allDocs.map((key, idx) => (
                      <li
                        key={idx}
                        className="flex items-start gap-1.5 text-[11px] font-semibold leading-tight text-white/95 drop-shadow-lg"
                      >
                        <Check size={11} className="mt-0.5 shrink-0 text-cyan" strokeWidth={3} />
                        <span className="line-clamp-2" title={getDocumentLabel(key, documentCatalog)}>
                          {getDocumentLabel(key, documentCatalog)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 px-1 text-[11px] italic text-white/60">Documents will be shown on details page</p>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Instant Application</span>
                <div className="flex items-center gap-1.5 text-cyan">
                  <span className="text-[10px] font-black uppercase">Apply Now</span>
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </motion.div>
          )}
        </ImageWithShimmer>
      </div>
    </motion.div>
  );
};

export default DestinationCard;
