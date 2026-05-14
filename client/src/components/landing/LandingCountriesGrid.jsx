import { memo } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
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

/**
 * Isolated grid so typing / geocode updates in the hero do not re-render these heavy cards.
 */
const LandingCountriesGrid = memo(function LandingCountriesGrid({
  filteredCountries,
  countryCardRefs,
  display,
  onNavigateDestination,
  onNavigateAll,
}) {
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
        {filteredCountries.map((country, i) => (
          <motion.div
            ref={(el) => {
              countryCardRefs.current[getCountryRouteId(country)] = el;
            }}
            key={getCountryRouteId(country)}
            id={`country-card-${getCountryRouteId(country)}`}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-30px" }}
            transition={{ delay: Math.min(i * 0.04, 0.6), duration: 0.4 }}
            whileHover="hover"
            variants={{ hover: { y: -6, scale: 1.03, transition: { duration: 0.18, ease: "easeOut" } } }}
            style={{ willChange: "transform" }}
            className="group cursor-pointer h-full"
            onClick={() => onNavigateDestination(country)}
          >
            <div className="bg-surface border border-border rounded-3xl overflow-hidden hover:border-cyan/30 hover:shadow-cyan-glow transition-shadow duration-200 h-full min-h-[500px]">
              <ImageWithShimmer
                src={country.imageUrl}
                alt={country.name}
                className="h-full min-h-[500px]"
                priority={i < 4}
                width={500}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/30 to-black/95" />

                  <div className="absolute top-3 left-3 text-[10px] font-semibold text-white drop-shadow-md bg-black/50 px-2 py-1 rounded-md">
                    {getCountryCardCodeBadge(country)}
                  </div>

                {!country.imageUrl ? (
                  <div
                    className="absolute top-[40%] left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white/92 border border-white/70 shadow-xl flex items-center justify-center text-3xl select-none"
                    role="img"
                    aria-label={country.name}
                  >
                    {getCountryFlagEmoji(country.name, country.flagEmoji)}
                  </div>
                ) : null}

                <div
                  className={`absolute left-0 w-full px-3 text-center ${
                    country.imageUrl ? "top-1/2 -translate-y-1/2" : "top-[52%]"
                  }`}
                >
                  <h3 className="font-semibold text-white text-2xl tracking-wide drop-shadow-md uppercase leading-tight">
                    {country.name}
                  </h3>
                </div>

                <div className="absolute bottom-0 left-0 w-full p-6">
                  {(() => {
                    const tiles = buildCountryTiles(country, display);
                    const cols = GRID_COLS_BY_COUNT[tiles.length] || "grid-cols-3";
                    return (
                      <div className={`grid ${cols} pb-2 gap-2 text-center`}>
                        {tiles.map((tile) => (
                          <div key={tile.key} className="min-w-0">
                            <p className="text-[11px] sm:text-[12px] tracking-widest text-white/65 mb-0.5">{tile.label}</p>
                            <p
                              className="text-[12px] sm:text-[13px] font-semibold text-white truncate"
                              title={tile.value}
                            >
                              {tile.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </ImageWithShimmer>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}, (prev, next) => prev.countryIdsKey === next.countryIdsKey);

export default LandingCountriesGrid;
