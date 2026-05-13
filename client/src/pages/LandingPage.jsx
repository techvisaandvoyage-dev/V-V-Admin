// ============================================================
//  Landing Page
//  Sections:
//  1. Hero — search bar + animated background
//  2. Countries Grid — trending countries display
// ============================================================
import {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  startTransition,
} from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, MapPin,
} from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Button from "../components/ui/Button";
import LandingCountriesGrid from "../components/landing/LandingCountriesGrid";
import { useCountries } from "../hooks/useCountries";
import { api } from "../store/authStore";
import { getCountryFlagEmoji, getCountrySearchHint, matchesCountrySearch } from "../utils/countrySearch";

const GEOCODE_DEBOUNCE_MS = 680;
const GEOCODE_MIN_CHARS = 3;

// ── Animation variants ─────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const countryCardRefs = useRef({});
  const searchInputRef = useRef(null);
  const geocodeAbortRef = useRef(null);
  const geocodeReqSeq = useRef(0);
  const { countries: allCountries, trendingCountries, display: countryDisplay } = useCountries();

  // Search bar state
  const [searchDestination, setSearchDestination] = useState("");
  /** Full place list from Nominatim — updated in startTransition to keep typing smooth. */
  const [geocodePlaces, setGeocodePlaces] = useState([]);

  const searchTerm = searchDestination.trim().toLowerCase();

  useEffect(() => {
    const q = searchDestination.trim();
    if (q.length < GEOCODE_MIN_CHARS) {
      geocodeAbortRef.current?.abort();
      startTransition(() => setGeocodePlaces([]));
      return undefined;
    }

    geocodeAbortRef.current?.abort();
    const controller = new AbortController();
    geocodeAbortRef.current = controller;

    const seq = ++geocodeReqSeq.current;
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get("/geocode/places", {
          params: { q, limit: 24 },
          signal: controller.signal,
        });
        if (seq !== geocodeReqSeq.current) return;
        if (!data?.success) {
          startTransition(() => setGeocodePlaces([]));
          return;
        }
        const nextPlaces =
          Array.isArray(data.places) && data.places.length > 0
            ? data.places
            : Array.isArray(data.matches) && data.matches.length > 0
              ? data.matches.map((m) => ({
                  placeKey: `country-${m.id}`,
                  primaryLabel: m.name,
                  detailLabel: m.hint?.replace(/^Includes /, "") || m.name,
                  countrySlug: m.id,
                  countryName: m.name,
                }))
              : [];

        startTransition(() => setGeocodePlaces(nextPlaces));
      } catch (err) {
        if (controller.signal.aborted || err?.code === "ERR_CANCELED") return;
        if (seq === geocodeReqSeq.current) startTransition(() => setGeocodePlaces([]));
      }
    }, GEOCODE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchDestination]);

  const suggestionRows = useMemo(() => {
    if (!searchTerm) return [];
    const localList = allCountries
      .filter((country) => matchesCountrySearch(country, searchTerm))
      .slice(0, 10);
    const rows = [];
    const seenPlace = new Set();
    for (const c of localList) {
      rows.push({
        kind: "country",
        key: `local-${c.id}`,
        country: c,
        hint: getCountrySearchHint(c, searchTerm),
      });
    }
    for (const p of geocodePlaces) {
      const pk = p.placeKey || `${p.countrySlug}-${p.primaryLabel}`;
      if (seenPlace.has(pk)) continue;
      seenPlace.add(pk);
      const country = allCountries.find(
        (c) => c.id === p.countrySlug || c.name === p.countryName
      );
      if (!country) continue;
      rows.push({
        kind: "place",
        key: `place-${pk}`,
        country,
        primaryLabel: p.primaryLabel,
        detailLabel: p.detailLabel || p.countryName,
      });
    }
    return rows.slice(0, 42);
  }, [searchTerm, allCountries, geocodePlaces]);

  const filteredCountries = useMemo(() => {
    const term = searchDestination.trim();
    if (!term) return trendingCountries;
    const local = allCountries.filter((country) => matchesCountrySearch(country, term));
    const byId = new Map(local.map((c) => [c.id, c]));
    for (const p of geocodePlaces) {
      const country = allCountries.find(
        (c) => c.id === p.countrySlug || c.name === p.countryName
      );
      if (country && !byId.has(country.id)) byId.set(country.id, country);
    }
    return Array.from(byId.values());
  }, [searchDestination, trendingCountries, allCountries, geocodePlaces]);

  /** Stable key so the memoized grid skips re-rendering when unrelated parent state ticks. */
  const countryIdsKey = useMemo(
    () => filteredCountries.map((c) => c.id).join("|"),
    [filteredCountries]
  );

  const scrollToCountry = useCallback((countryId) => {
    const card = countryCardRefs.current[countryId];
    if (card?.scrollIntoView) {
      card.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }, []);

  useEffect(() => {
    const term = searchDestination.trim();
    if (!term || allCountries.length === 0) return;

    const merged = new Map();
    for (const c of allCountries.filter((country) => matchesCountrySearch(country, term))) {
      merged.set(c.id, c);
    }
    for (const p of geocodePlaces) {
      const c = allCountries.find(
        (x) => x.id === p.countrySlug || x.name === p.countryName
      );
      if (c) merged.set(c.id, c);
    }
    const list = Array.from(merged.values());
    if (list.length !== 1) return;

    const id = list[0].id;
    const timer = setTimeout(() => scrollToCountry(id), 240);
    return () => clearTimeout(timer);
  }, [searchDestination, allCountries, scrollToCountry, geocodePlaces]);

  const handleSuggestionRowClick = (row) => {
    if (row.kind === "country") {
      setSearchDestination(row.country.name);
      setTimeout(() => scrollToCountry(row.country.id), 150);
      return;
    }
    setSearchDestination(row.primaryLabel);
    setTimeout(() => scrollToCountry(row.country.id), 150);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const term = searchDestination.trim();
    if (!term) {
      return;
    }

    const localMatches = allCountries.filter((country) => matchesCountrySearch(country, term));
    if (localMatches.length >= 1) {
      setTimeout(() => scrollToCountry(localMatches[0].id), 150);
      return;
    }
    const p = geocodePlaces[0];
    if (p) {
      const c = allCountries.find(
        (x) => x.id === p.countrySlug || x.name === p.countryName
      );
      if (c) setTimeout(() => scrollToCountry(c.id), 150);
    }
  };

  const handleNavigateDestination = useCallback(
    (countryId) => navigate(`/destination/${countryId}`),
    [navigate]
  );

  const handleNavigateAll = useCallback(() => navigate("/destinations"), [navigate]);

  useEffect(() => {
    const handleGlobalTyping = (event) => {
      const input = searchInputRef.current;
      if (!input) return;

      const activeElement = document.activeElement;
      const tagName = activeElement?.tagName?.toLowerCase();
      const isTypingInFormField = (
        activeElement?.isContentEditable ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select"
      );
      if (isTypingInFormField) return;

      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key.length !== 1 && event.key !== "Backspace") return;

      event.preventDefault();
      input.focus();

      if (event.key === "Backspace") {
        setSearchDestination((prev) => prev.slice(0, -1));
        return;
      }

      setSearchDestination((prev) => `${prev}${event.key}`);
    };

    window.addEventListener("keydown", handleGlobalTyping);
    return () => window.removeEventListener("keydown", handleGlobalTyping);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <section
        id="hero"
        className="relative min-h-[78vh] flex items-center justify-center overflow-hidden hero-gradient pt-20"
      >
        <div className="absolute inset-0 dot-pattern opacity-40" aria-hidden="true" />

        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-[120px]"
          style={{ background: "radial-gradient(circle, #0284c7 0%, transparent 70%)" }}
          aria-hidden="true"
        />

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan/20 bg-cyan/10 text-cyan text-xs sm:text-sm font-medium">
              Fast, Reliable, Visa Guidance
            </span>

            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-text-primary">
              Your Visa Journey,
              <span className="block text-gradient-cyan">Made Simple</span>
            </h1>

            <p className="mt-4 max-w-2xl mx-auto text-sm sm:text-base text-text-secondary">
              Compare destinations, understand requirements, and start your application in minutes.
              From documentation to approval updates, everything stays in one place.
            </p>

            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate("/destinations")}
                id="hero-explore-destinations-btn"
              >
                Explore Destinations
              </Button>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="w-full mb-8"
          >
            <form
              onSubmit={handleSearch}
              autoComplete="off"
              className="glass rounded-2xl sm:rounded-[2rem] p-3 sm:p-4 md:p-5 border border-cyan/30"
              role="search"
              aria-label="Search visa destinations"
            >
              <div className="flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 w-full min-w-0">
                <Search
                  strokeWidth={2.2}
                  className="text-cyan flex-shrink-0 w-[18px] h-[18px] sm:w-[22px] sm:h-[22px]"
                  aria-hidden
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  autoComplete="off"
                  placeholder="Search country, city, or state..."
                  value={searchDestination}
                  onChange={(e) => setSearchDestination(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-text-primary placeholder:text-[#6e8cab] text-base sm:text-lg md:text-xl lg:text-2xl focus:outline-none"
                  aria-label="Destination search"
                  id="hero-destination-input"
                  autoFocus
                />
              </div>
            </form>

            {searchTerm && (
              <div className="max-w-4xl mx-auto mt-4 text-left">
                <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col max-h-[min(70vh,520px)]">
                  {suggestionRows.length > 0 ? (
                    <div className="overflow-y-auto overscroll-contain divide-y divide-border">
                      {suggestionRows.map((row) => (
                        <button
                          type="button"
                          key={row.key}
                          onClick={() => handleSuggestionRowClick(row)}
                          className="w-full flex items-start justify-between gap-3 px-4 py-3 text-sm text-text-primary hover:bg-surface-2 transition-colors text-left"
                        >
                          <span className="flex flex-col gap-0.5 min-w-0 flex-1">
                            {row.kind === "country" ? (
                              <>
                                <span className="font-medium truncate">{row.country.name}</span>
                                {row.hint ? (
                                  <span className="text-xs text-text-muted">{row.hint}</span>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <span className="flex items-center gap-2 font-medium text-text-primary min-w-0">
                                  <MapPin size={14} className="text-cyan flex-shrink-0 mt-0.5" />
                                  <span className="truncate">{row.primaryLabel}</span>
                                </span>
                                <span className="text-xs text-text-muted pl-6 truncate">
                                  {row.detailLabel}
                                </span>
                              </>
                            )}
                          </span>
                          <span className="w-9 h-9 rounded-full bg-background border border-border flex items-center justify-center text-lg shadow-sm flex-shrink-0">
                            {getCountryFlagEmoji(row.country.name, row.country.flagEmoji)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-sm text-text-muted">
                      No matching destinations found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-wrap justify-center gap-3 mt-6 px-4"
          >
            <span className="text-xs text-text-muted">Popular:</span>
            {["USA", "UK", "EU Schengen", "Dubai", "Japan"].map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setSearchDestination(tag);
                }}
                className="text-xs text-text-secondary hover:text-cyan px-3 py-1.5 rounded-md hover:bg-cyan/10 transition-colors border border-transparent hover:border-cyan/30"
              >
                {tag}
              </button>
            ))}
          </motion.div>
        </div>
      </section>

      <LandingCountriesGrid
        countryIdsKey={countryIdsKey}
        filteredCountries={filteredCountries}
        countryCardRefs={countryCardRefs}
        display={countryDisplay}
        onNavigateDestination={handleNavigateDestination}
        onNavigateAll={handleNavigateAll}
      />

      <Footer />
    </div>
  );
};

export default LandingPage;
