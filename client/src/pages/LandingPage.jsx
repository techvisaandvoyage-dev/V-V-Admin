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
  ArrowRight, ShieldCheck, FileText, Lock, Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Button from "../components/ui/Button";
import LandingCountriesGrid from "../components/landing/LandingCountriesGrid";
import { useCountries } from "../hooks/useCountries";
import { api } from "../store/authStore";
import { getCountryFlagEmoji, getCountrySearchHint, matchesCountrySearch } from "../utils/countrySearch";
import { getCountryRouteId } from "../utils/countryRouting";
import heroImage from "../assets/hero.png";

  const GEOCODE_DEBOUNCE_MS = 680;
  const GEOCODE_MIN_CHARS = 3;

const DEFAULT_HERO_HIGHLIGHTS = [
  {
    icon: Zap,
    title: "Fast Processing",
    body: "Quick application flow and updates",
  },
  {
    icon: ShieldCheck,
    title: "Trusted Guidance",
    body: "Accurate help for every step",
  },
  {
    icon: FileText,
    title: "All-in-One Platform",
    body: "Search, apply, track, and upload",
  },
  {
    icon: Lock,
    title: "Secure & Private",
    body: "Your documents stay protected",
  },
];

// ── Animation variants ─────────────────────────────────────
const LandingPage = () => {
  const navigate = useNavigate();
  const countryCardRefs = useRef({});
  const searchInputRef = useRef(null);
  const geocodeAbortRef = useRef(null);
  const geocodeReqSeq = useRef(0);
  const homeExitGuardRef = useRef(false);
  const { countries: allCountries, trendingCountries, display: countryDisplay, documentCatalog } = useCountries();

  // Global requirements for merging logic on cards
  const [globalRequirements, setGlobalRequirements] = useState([]);
  const [showVisaRequirements, setShowVisaRequirements] = useState(true);
  const [heroHighlights, setHeroHighlights] = useState(DEFAULT_HERO_HIGHLIGHTS);

  useEffect(() => {
    if (homeExitGuardRef.current) return undefined;
    homeExitGuardRef.current = true;

    const pushHomeGuardState = () => {
      window.history.pushState(
        { vbHomeExitGuard: true, time: Date.now() },
        "",
        window.location.href
      );
    };

    const handleHomeBackAttempt = () => {
      const shouldLeave = window.confirm("Do you want to close VISAANDVOYAGE?");

      if (!shouldLeave) {
        pushHomeGuardState();
        return;
      }

      window.removeEventListener("popstate", handleHomeBackAttempt);
      window.close();
    };

    pushHomeGuardState();
    window.addEventListener("popstate", handleHomeBackAttempt);

    return () => {
      window.removeEventListener("popstate", handleHomeBackAttempt);
      homeExitGuardRef.current = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get("/config/destination-content");
        if (alive && data?.success) {
          if (data.config?.visaRequirements) setGlobalRequirements(data.config.visaRequirements);
          if (data.config?.showVisaRequirements !== undefined) setShowVisaRequirements(data.config.showVisaRequirements);
          if (Array.isArray(data.config?.landingHeroHighlights) && data.config.landingHeroHighlights.length) {
            setHeroHighlights(
              DEFAULT_HERO_HIGHLIGHTS.map((fallback, index) => ({
                ...fallback,
                title: String(data.config.landingHeroHighlights[index]?.title ?? "").trim() || fallback.title,
                body: String(data.config.landingHeroHighlights[index]?.body ?? "").trim() || fallback.body,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to fetch global requirements:", err);
      }
    })();
    return () => { alive = false; };
  }, []);

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
    const byId = new Map(local.map((c) => [getCountryRouteId(c), c]));
    for (const p of geocodePlaces) {
      const country = allCountries.find(
        (c) => c.id === p.countrySlug || c.name === p.countryName
      );
      const routeId = getCountryRouteId(country);
      if (country && !byId.has(routeId)) byId.set(routeId, country);
    }
    return Array.from(byId.values());
  }, [searchDestination, trendingCountries, allCountries, geocodePlaces]);

  /** Stable key so the memoized grid skips re-rendering when unrelated parent state ticks. */
  const countryIdsKey = useMemo(
    () => filteredCountries.map((c) => getCountryRouteId(c)).join("|"),
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
      merged.set(getCountryRouteId(c), c);
    }
    for (const p of geocodePlaces) {
      const c = allCountries.find(
        (x) => x.id === p.countrySlug || x.name === p.countryName
      );
      if (c) merged.set(getCountryRouteId(c), c);
    }
    const list = Array.from(merged.values());
    if (list.length !== 1) return;

    const id = getCountryRouteId(list[0]);
    const timer = setTimeout(() => scrollToCountry(id), 240);
    return () => clearTimeout(timer);
  }, [searchDestination, allCountries, scrollToCountry, geocodePlaces]);

  const handleSuggestionRowClick = (row) => {
    if (row.kind === "country") {
      setSearchDestination(row.country.name);
      setTimeout(() => scrollToCountry(getCountryRouteId(row.country)), 150);
      return;
    }
    setSearchDestination(row.primaryLabel);
    setTimeout(() => scrollToCountry(getCountryRouteId(row.country)), 150);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const term = searchDestination.trim();
    if (!term) {
      return;
    }

    const localMatches = allCountries.filter((country) => matchesCountrySearch(country, term));
    if (localMatches.length >= 1) {
      setTimeout(() => scrollToCountry(getCountryRouteId(localMatches[0])), 150);
      return;
    }
    const p = geocodePlaces[0];
    if (p) {
      const c = allCountries.find(
        (x) => x.id === p.countrySlug || x.name === p.countryName
      );
      if (c) setTimeout(() => scrollToCountry(getCountryRouteId(c)), 150);
    }
  };

  const handleNavigateDestination = useCallback(
    (country) => navigate(`/destination/${encodeURIComponent(getCountryRouteId(country))}`),
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
        className="relative overflow-hidden pt-20"
      >
        <div className="absolute inset-0 hero-gradient" aria-hidden="true" />
        <div
          className="absolute inset-0 bg-cover bg-[78%_top] sm:bg-[75%_18%] lg:bg-[72%_center] bg-no-repeat opacity-95"
          style={{ backgroundImage: `url(${heroImage})` }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 hidden sm:block"
          style={{
            background:
              "linear-gradient(90deg, rgba(248,251,255,0.98) 0%, rgba(248,251,255,0.94) 28%, rgba(248,251,255,0.72) 52%, rgba(248,251,255,0.18) 72%, rgba(248,251,255,0.04) 100%)",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-0 sm:hidden"
          style={{
            background:
              "linear-gradient(180deg, rgba(248,251,255,0.78) 0%, rgba(248,251,255,0.60) 26%, rgba(248,251,255,0.28) 52%, rgba(248,251,255,0.78) 100%)",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 dot-pattern opacity-25" aria-hidden="true" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-background via-background/85 to-transparent" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex min-h-[88vh] sm:min-h-[84vh] w-full max-w-7xl items-center px-4 pb-16 sm:px-6 lg:px-8">
          <div className="w-full">
            <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)]">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="max-w-3xl"
              >
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan/20 bg-white/70 px-4 py-2 text-xs font-semibold tracking-[0.01em] text-cyan shadow-[0_12px_30px_rgba(15,23,42,0.05)] backdrop-blur-md sm:text-sm">
                  <ShieldCheck size={14} />
                  Fast. Reliable. Visa Guidance.
                </span>

                <h1 className="mt-6 max-w-3xl text-5xl font-bold leading-[0.96] tracking-[-0.04em] text-[#102a5c] sm:text-6xl lg:text-7xl">
                  Your Visa Journey,
                  <span className="mt-1 block bg-gradient-to-r from-[#2e8cf8] via-cyan to-[#0f63d8] bg-clip-text text-transparent">
                    Made Simple
                  </span>
                </h1>

                <p className="mt-6 max-w-xl text-base leading-8 text-[#5f7598] sm:text-lg">
                  Compare destinations, understand requirements, and start your application in minutes.
                  From documentation to approval updates, everything stays in one place.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-4">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => navigate("/destinations")}
                    rightIcon={<ArrowRight size={18} />}
                    className="rounded-2xl px-7 shadow-[0_18px_40px_rgba(14,116,217,0.28)]"
                    id="hero-explore-destinations-btn"
                  >
                    Explore Destinations
                  </Button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.65, delay: 0.18 }}
                className="hidden min-h-[460px] lg:block"
              />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 34 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.24 }}
              className="relative z-20 mt-12 mx-auto w-full max-w-6xl"
            >
              <div className="overflow-visible rounded-[2rem] border border-white/75 bg-white/88 p-4 shadow-[0_32px_90px_rgba(17,34,68,0.14)] backdrop-blur-xl sm:p-6">
                <form
                  onSubmit={handleSearch}
                  autoComplete="off"
                  className="relative rounded-[1.6rem] border border-sky-100 bg-white px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] sm:px-6"
                  role="search"
                  aria-label="Search visa destinations"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-cyan sm:h-14 sm:w-14">
                      <Search strokeWidth={2.2} className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                    </div>
                    <input
                      ref={searchInputRef}
                      type="text"
                      autoComplete="off"
                      placeholder="Search country, city, or state..."
                      value={searchDestination}
                      onChange={(e) => setSearchDestination(e.target.value)}
                      className="flex-1 min-w-0 bg-transparent text-lg text-text-primary placeholder:text-[#8ea0bb] focus:outline-none sm:text-2xl"
                      aria-label="Destination search"
                      id="hero-destination-input"
                      autoFocus
                    />
                    <button
                      type="submit"
                      className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan text-white shadow-[0_16px_36px_rgba(14,116,217,0.28)] transition-all hover:scale-[1.03] hover:bg-cyan-dim sm:h-14 sm:w-14"
                      aria-label="Search destinations"
                    >
                      <Search className="h-5 w-5" />
                    </button>
                  </div>

                  {searchTerm && (
                    <div className="absolute left-0 right-0 top-[calc(100%+16px)] z-30 text-left">
                      <div className="max-h-[min(70vh,520px)] overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
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
                </form>

                <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 xl:grid-cols-4">
                  {heroHighlights.map(({ icon: Icon, title, body }) => (
                    <div key={title} className="flex items-start gap-3 px-1">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-sky-50 text-cyan">
                        <Icon size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#16325f]">{title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#7388a8]">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-slate-100 pt-5 text-center sm:gap-3">
                  <span className="mr-1 text-xs font-medium text-[#8092ad]">Popular:</span>
                  {["USA", "UK", "EU Schengen", "Dubai", "Japan"].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSearchDestination(tag);
                      }}
                      className="rounded-full border border-sky-100 bg-sky-50 px-3.5 py-1.5 text-xs font-medium text-[#146fd8] transition-colors hover:border-cyan/40 hover:bg-cyan/10 hover:text-cyan"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <LandingCountriesGrid
        countryIdsKey={countryIdsKey}
        filteredCountries={filteredCountries}
        countryCardRefs={countryCardRefs}
        display={countryDisplay}
        documentCatalog={documentCatalog}
        globalRequirements={globalRequirements}
        showVisaRequirements={showVisaRequirements}
        onNavigateDestination={handleNavigateDestination}
        onNavigateAll={handleNavigateAll}
      />

      <Footer />
    </div>
  );
};

export default LandingPage;
