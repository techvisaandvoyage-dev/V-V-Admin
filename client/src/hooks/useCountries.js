import { useState, useEffect, useMemo } from "react";
import { COUNTRIES, TRENDING_COUNTRIES, getCountryById } from "../data/countries";
import { api, SERVER_URL } from "../store/authStore";
import { getCountryFlagEmoji } from "../utils/countrySearch";
import { getCountryRegionLabel } from "../utils/continentDisplay";
import { getLocatedInLabel } from "../utils/countryRegionLookup";

const stripFallbackImage = (country) => ({
  ...country,
  imageUrl: country.imageUrl?.includes("/images/visa-card-fallback.svg") ? "" : country.imageUrl,
});

const prepareCountry = (country) => stripFallbackImage(country);

/** Avoid showing static `countries.js` image URLs before the API runs (prevents img A → img B flash on reload). */
const withBlankImageUrl = (country) => ({
  ...prepareCountry(country),
  imageUrl: "",
});

/** Bump when cached country shape changes (e.g. howItWorks) so clients refetch. */
const COUNTRIES_CACHE_KEY = "vb_countries_api_v6";

function loadCountriesCache() {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(COUNTRIES_CACHE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload?.countries) || payload.countries.length === 0) return null;
    return payload.countries;
  } catch {
    return null;
  }
}

function saveCountriesCache(countries) {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(COUNTRIES_CACHE_KEY, JSON.stringify({ countries }));
  } catch {
    /* ignore quota / private mode */
  }
}

function withRegionLabel(country) {
  if (!country) return country;
  const locatedIn =
    country.locatedIn ??
    getLocatedInLabel(country.name) ??
    getCountryRegionLabel(country);
  return {
    ...country,
    locatedIn,
    regionLabel: country.regionLabel ?? locatedIn,
  };
}

/** Resolve relative /uploads paths to a full server URL */
const resolveImageUrl = (url) => {
  if (!url) return "";
  if (url.includes("/images/visa-card-fallback.svg")) return "";
  // Already an absolute URL (http, https)
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Ensure SERVER_URL is defined, fallback to window location origin
  const base = SERVER_URL || `${window.location.origin}`;
  // Relative upload path – prepend base URL, ensuring no double slash
  if (url.startsWith('/')) return `${base.replace(/\/*$/, '')}${url}`;
  return `${base.replace(/\/*$/, '')}/${url}`;
};

/** Normalise one country document from GET `/countries` or GET `/countries/:slug`. */
export function normalizeCountryFromApi(c) {
  if (!c) return null;
  const slug = c.slug || c.id;
  const continent = c.continent || "Global";
  const locatedIn =
    getLocatedInLabel(c.name) ||
    getCountryRegionLabel({ name: c.name, id: slug, continent });
  return {
    id: slug,
    _id: c._id,
    name: c.name,
    flagEmoji: getCountryFlagEmoji(c.name, c.flagEmoji),
    basePrice: c.basePrice,
    processingDays: c.processingDays || "5-10",
    difficulty: c.difficulty || "moderate",
    visaType: c.visaType || "Tourist Visa",
    continent,
    locatedIn,
    regionLabel: locatedIn,
    imageUrl: resolveImageUrl(c.imageUrl),
    description: c.description || "",
    requirements: Array.isArray(c.requirements) ? c.requirements : [],
    requiredDocuments: Array.isArray(c.requiredDocuments) ? c.requiredDocuments : ["passport"],
    trending: Boolean(c.trending),
    successRate: c.successRate || 80,
    whyBookNow: Array.isArray(c.whyBookNow)
      ? c.whyBookNow.map((s) => String(s ?? "").trim()).filter(Boolean)
      : [],
    includedItems: Array.isArray(c.includedItems)
      ? c.includedItems.map((s) => String(s ?? "").trim()).filter(Boolean)
      : [],
    faqs: Array.isArray(c.faqs)
      ? c.faqs
          .map((f) => ({
            question: String(f?.question ?? "").trim(),
            answer: String(f?.answer ?? "").trim(),
          }))
          .filter((f) => f.question && f.answer)
      : [],
    howItWorks: Array.isArray(c.howItWorks)
      ? c.howItWorks
          .map((s) => ({
            title: String(s?.title ?? "").trim(),
            description: String(s?.description ?? "").trim(),
          }))
          .filter((s) => s.title && s.description)
      : [],
    excludeDestinationHowItWorksTitles: Array.isArray(c.excludeDestinationHowItWorksTitles)
      ? c.excludeDestinationHowItWorksTitles.map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean)
      : [],
    excludeDestinationWhyBookNow: Array.isArray(c.excludeDestinationWhyBookNow)
      ? c.excludeDestinationWhyBookNow.map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean)
      : [],
    excludeDestinationIncludedItems: Array.isArray(c.excludeDestinationIncludedItems)
      ? c.excludeDestinationIncludedItems.map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean)
      : [],
    excludeDestinationFaqQuestions: Array.isArray(c.excludeDestinationFaqQuestions)
      ? c.excludeDestinationFaqQuestions.map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean)
      : [],
  };
}

/**
 * Merge list/cached country with a fresh GET `/countries/:slug` so admin edits
 * (required documents, requirements, copy) show immediately without stale sessionStorage.
 */
export function useMergedCountry(countryId, listCountry) {
  const [fresh, setFresh] = useState(null);

  useEffect(() => {
    setFresh(null);
    if (!countryId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/countries/${encodeURIComponent(countryId)}`);
        if (cancelled || !data?.success || !data.country) return;
        setFresh(normalizeCountryFromApi(data.country));
      } catch {
        /* list / static fallback still used */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [countryId]);

  return useMemo(() => {
    const fallback = getCountryById(countryId);
    const base = withRegionLabel(listCountry || fallback);
    if (fresh) {
      return withRegionLabel({
        ...(base || { id: countryId, name: fresh.name || "" }),
        ...fresh,
        id: fresh.id || countryId,
      });
    }
    return base || null;
  }, [countryId, listCountry, fresh]);
}

/**
 * Fetches countries from the backend (DB = source of truth).
 * Admin edits in the dashboard are reflected here immediately on next mount.
 *
 * Trending/featured rows use the same `imageUrl` as the API (including Unsplash) — do not strip by trend.
 *
 * Falls back to the static file ONLY if the server is unreachable.
 */
function buildInitialCountriesState() {
  const cached = loadCountriesCache();
  if (cached) {
    const withResolved = cached.map((c) =>
      withRegionLabel({
        ...c,
        imageUrl: resolveImageUrl(c.imageUrl),
      })
    );
    return {
      countries: withResolved,
      trendingCountries: withResolved.filter((c) => c.trending),
    };
  }
  return {
    countries: COUNTRIES.map((c) => withRegionLabel(withBlankImageUrl(c))),
    trendingCountries: TRENDING_COUNTRIES.map((c) => withRegionLabel(withBlankImageUrl(c))),
  };
}

export function useCountries() {
  const initial = buildInitialCountriesState();
  const [countries, setCountries] = useState(() => initial.countries);
  const [trendingCountries, setTrendingCountries] = useState(() => initial.trendingCountries);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchFromDB = async () => {
      try {
        const { data } = await api.get("/countries");

        if (!cancelled && data.success && data.countries?.length > 0) {
          const normalised = data.countries.map((c) => normalizeCountryFromApi(c));

          saveCountriesCache(normalised);
          setCountries(normalised);
          setTrendingCountries(normalised.filter((c) => c.trending));
        } else if (!cancelled) {
          setCountries(COUNTRIES.map((c) => withRegionLabel(prepareCountry(c))));
          setTrendingCountries(TRENDING_COUNTRIES.map((c) => withRegionLabel(prepareCountry(c))));
        }
        // If DB returns empty (very first boot before seed finishes) keep static
      } catch {
        if (!cancelled) {
          setCountries(COUNTRIES.map((c) => withRegionLabel(prepareCountry(c))));
          setTrendingCountries(TRENDING_COUNTRIES.map((c) => withRegionLabel(prepareCountry(c))));
        }
        // Server unreachable — keep static data as fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchFromDB();
    return () => { cancelled = true; };
  }, []);

  return { countries, trendingCountries, loading };
}
