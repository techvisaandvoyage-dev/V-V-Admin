import { useState, useEffect, useMemo } from "react";
import { COUNTRIES, TRENDING_COUNTRIES, getCountryById } from "../data/countries";
import { api, SERVER_URL } from "../store/authStore";
import { getCountryFlagEmoji } from "../utils/countrySearch";
import { getCountryRegionLabel } from "../utils/continentDisplay";
import { getLocatedInLabel } from "../utils/countryRegionLookup";
import { getCountryRouteId } from "../utils/countryRouting";

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

/**
 * Bump when cached country shape changes (e.g. howItWorks) so clients refetch.
 * Persisted in `localStorage` so first paint on subsequent visits / shared links
 * is instant — without it, mobile users open a link and see blank cards until the
 * Render API responds (cold start can take 30–60s on the free tier).
 */
const COUNTRIES_CACHE_KEY = "vb_countries_api_v17";
const COUNTRIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_DISPLAY = Object.freeze({
  showVisaType: true,
  showValidity: true,
  showLengthOfStay: true,
  showEntryType: true,
  showProcessingDays: true,
  showRequiredDocuments: true,
});

const DEFAULT_VISA_INFORMATION_ITEMS = Object.freeze([
  {
    id: "lengthOfStay",
    enabled: true,
    label: "Length of Stay",
    value: "On request",
    description: "You can stay up to the approved duration in the country.",
    icon: "calendar",
    color: "blue",
  },
  {
    id: "validity",
    enabled: true,
    label: "Validity",
    value: "On request",
    description: "Your visa remains valid for the approved duration after issue.",
    icon: "clock3",
    color: "green",
  },
  {
    id: "entry",
    enabled: true,
    label: "Entry",
    value: "Single",
    description: "This visa determines how many times you can enter the country.",
    icon: "door-open",
    color: "purple",
  },
]);

function normalizeVisaInformation(raw, country = {}) {
  const data = raw && typeof raw === "object" ? raw : {};
  const defaultsById = new Map(
    DEFAULT_VISA_INFORMATION_ITEMS.map((item) => [
      item.id,
      {
        ...item,
        value:
          item.id === "lengthOfStay"
            ? country.lengthOfStay || country.validity || item.value
            : item.id === "validity"
              ? country.validity || item.value
              : country.entryType || item.value,
      },
    ])
  );
  const itemsById = new Map(
    (Array.isArray(data.items) ? data.items : [])
      .map((item) => ({
        id: String(item?.id ?? "").trim(),
        enabled: item?.enabled !== false,
        label: String(item?.label ?? "").trim(),
        value: String(item?.value ?? "").trim(),
        description: String(item?.description ?? "").trim(),
        icon: String(item?.icon ?? "").trim(),
        color: String(item?.color ?? "").trim(),
      }))
      .filter((item) => item.id)
      .map((item) => [item.id, item])
  );

  return {
    enabled: data.enabled !== false,
    badgeText: String(data.badgeText ?? "").trim() || "100% Online Process",
    title: String(data.title ?? "").trim() || "Visa Information",
    subtitle:
      String(data.subtitle ?? "").trim() ||
      "A 100% online visa application process that is simple, secure and hassle-free.",
    note:
      String(data.note ?? "").trim() ||
      "Visa rules and conditions may change. Please check the latest requirements before applying.",
    items: DEFAULT_VISA_INFORMATION_ITEMS.map((item) => {
      const fallback = defaultsById.get(item.id);
      const next = itemsById.get(item.id);
      return {
        ...fallback,
        enabled: next?.enabled !== false,
        label: next?.label || fallback.label,
        value: next?.value || fallback.value,
        description: next?.description || fallback.description,
        icon: next?.icon || fallback.icon,
        color: next?.color || fallback.color,
      };
    }),
  };
}

/**
 * Normalise the display flags blob returned from /api/countries so a missing or
 * malformed value falls back to "show everything".
 */
function normalizeDisplay(raw) {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_DISPLAY };
  return {
    showVisaType: raw.showVisaType !== false,
    showValidity: raw.showValidity !== false,
    showLengthOfStay: raw.showLengthOfStay !== false,
    showEntryType: raw.showEntryType !== false,
    showProcessingDays: raw.showProcessingDays !== false,
    showRequiredDocuments: raw.showRequiredDocuments !== false,
  };
}

/**
 * Normalise the document catalog (built-in + custom doc types). Falls back to
 * an empty array — `CountryDetails` ships with a built-in label map so labels
 * still render even when the API hasn't responded yet.
 */
function normalizeDocumentCatalog(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((d) => ({
      key: String(d?.key ?? "").trim(),
      label: String(d?.label ?? "").trim(),
      description: String(d?.description ?? "").trim(),
      icon: String(d?.icon ?? "").trim(),
      builtIn: d?.builtIn !== false,
    }))
    .filter((d) => d.key && d.label);
}

function loadCountriesCache() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(COUNTRIES_CACHE_KEY);
    if (!raw) {
      const legacy = window.sessionStorage?.getItem(COUNTRIES_CACHE_KEY);
      if (!legacy) return null;
      const legacyPayload = JSON.parse(legacy);
      if (!Array.isArray(legacyPayload?.countries) || legacyPayload.countries.length === 0) return null;
      return {
        countries: legacyPayload.countries,
        display: normalizeDisplay(legacyPayload.display),
        documentCatalog: normalizeDocumentCatalog(legacyPayload.documentCatalog),
      };
    }
    const payload = JSON.parse(raw);
    if (!Array.isArray(payload?.countries) || payload.countries.length === 0) return null;
    if (payload.savedAt && Date.now() - payload.savedAt > COUNTRIES_CACHE_TTL_MS) return null;
    return {
      countries: payload.countries,
      display: normalizeDisplay(payload.display),
      documentCatalog: normalizeDocumentCatalog(payload.documentCatalog),
    };
  } catch {
    return null;
  }
}

function saveCountriesCache(countries, display, documentCatalog) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      COUNTRIES_CACHE_KEY,
      JSON.stringify({
        countries,
        display: normalizeDisplay(display),
        documentCatalog: normalizeDocumentCatalog(documentCatalog),
        savedAt: Date.now(),
      })
    );
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
  const slug = getCountryRouteId(c);
  const continent = c.continent || "Global";
  const locatedIn =
    getLocatedInLabel(c.name) ||
    getCountryRegionLabel({ name: c.name, id: slug, continent });
  const normalized = {
    id: slug,
    _id: c._id,
    name: c.name,
    flagEmoji: getCountryFlagEmoji(c.name, c.flagEmoji),
    basePrice: c.basePrice,
    useGlobalBasePrice: c.useGlobalBasePrice === true,
    basePriceOverride: Number.isFinite(Number(c.basePriceOverride)) ? Number(c.basePriceOverride) : c.basePrice,
    processingDays: c.processingDays || "5-10",
    difficulty: c.difficulty || "moderate",
    /**
     * `visaType` and `validity` arrive pre-resolved from the server (global default
     * when the per-country flag is true, otherwise the per-country override). The
     * `*Override` + `useGlobal*` fields are passed through so admin tooling can show
     * "Using global" vs "Custom override" hints.
     */
    visaType: c.visaType || "Tourist Visa",
    validity: typeof c.validity === "string" ? c.validity.trim() : "",
    lengthOfStay: typeof c.lengthOfStay === "string" ? c.lengthOfStay.trim() : "",
    entryType: typeof c.entryType === "string" ? c.entryType.trim() : "",
    useGlobalVisaType: c.useGlobalVisaType !== false,
    useGlobalValidity: c.useGlobalValidity !== false,
    useGlobalLengthOfStay: c.useGlobalLengthOfStay !== false,
    useGlobalEntryType: c.useGlobalEntryType !== false,
    visaTypeOverride: typeof c.visaTypeOverride === "string" ? c.visaTypeOverride.trim() : "",
    validityOverride: typeof c.validityOverride === "string" ? c.validityOverride.trim() : "",
    lengthOfStayOverride: typeof c.lengthOfStayOverride === "string" ? c.lengthOfStayOverride.trim() : "",
    entryTypeOverride: typeof c.entryTypeOverride === "string" ? c.entryTypeOverride.trim() : "",
    continent,
    locatedIn,
    regionLabel: locatedIn,
    imageUrl: resolveImageUrl(c.imageUrl),
    description: c.description || "",
    requirements: Array.isArray(c.requirements) ? c.requirements : [],
    requiredDocuments: Array.isArray(c.requiredDocuments) ? c.requiredDocuments : ["passport"],
    useGlobalRequiredDocuments: c.useGlobalRequiredDocuments !== false,
    useGlobalGst: c.useGlobalGst !== false,
    gstEnabled: c.gstEnabled !== false,
    gstRate: Number.isFinite(Number(c.gstRate)) ? Number(c.gstRate) : 18,
    requiredDocumentsOverride: Array.isArray(c.requiredDocumentsOverride)
      ? c.requiredDocumentsOverride.map((k) => String(k ?? "").trim()).filter(Boolean)
      : [],
    trending: Boolean(c.trending),
    successRate: c.successRate || 80,
    whyBookNow: Array.isArray(c.whyBookNow)
      ? c.whyBookNow.map((s) => String(s ?? "").trim()).filter(Boolean)
      : [],
    includedItems: Array.isArray(c.includedItems)
      ? c.includedItems.map((x) => {
          if (typeof x === "string") return x.trim();
          return {
            title: String(x?.title ?? "").trim(),
            description: String(x?.description ?? "").trim(),
            icon: String(x?.icon ?? "").trim(),
            color: String(x?.color ?? "blue").trim(),
          };
        }).filter(Boolean)
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
    excludeDestinationVisaRequirements: Array.isArray(c.excludeDestinationVisaRequirements)
      ? c.excludeDestinationVisaRequirements.map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean)
      : [],
  };
  return {
    ...normalized,
    visaInformation: normalizeVisaInformation(c.visaInformation, normalized),
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
    const withResolved = cached.countries.map((c) =>
      withRegionLabel({
        ...c,
        imageUrl: resolveImageUrl(c.imageUrl),
      })
    );
    return {
      countries: withResolved,
      trendingCountries: withResolved.filter((c) => c.trending),
      display: cached.display,
      documentCatalog: cached.documentCatalog,
    };
  }
  return {
    countries: COUNTRIES.map((c) => withRegionLabel(withBlankImageUrl(c))),
    trendingCountries: TRENDING_COUNTRIES.map((c) => withRegionLabel(withBlankImageUrl(c))),
    display: { ...DEFAULT_DISPLAY },
    documentCatalog: [],
  };
}

export function useCountries() {
  const initial = buildInitialCountriesState();
  const [countries, setCountries] = useState(() => initial.countries);
  const [trendingCountries, setTrendingCountries] = useState(() => initial.trendingCountries);
  const [display, setDisplay] = useState(() => initial.display);
  const [documentCatalog, setDocumentCatalog] = useState(() => initial.documentCatalog);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchFromDB = async () => {
      try {
        const { data } = await api.get("/countries");

        if (!cancelled && data.success && data.countries?.length > 0) {
          const normalised = data.countries.map((c) => normalizeCountryFromApi(c));
          const nextDisplay = normalizeDisplay(data.display);
          const nextCatalog = normalizeDocumentCatalog(data.documentCatalog);

          saveCountriesCache(normalised, nextDisplay, nextCatalog);
          setCountries(normalised);
          setTrendingCountries(normalised.filter((c) => c.trending));
          setDisplay(nextDisplay);
          setDocumentCatalog(nextCatalog);
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

  return { countries, trendingCountries, display, documentCatalog, loading };
}
