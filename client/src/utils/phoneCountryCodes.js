export const DEFAULT_PHONE_COUNTRY_CODE = "+91";

const FALLBACK_PHONE_COUNTRY_OPTIONS = [
  { value: "+91", label: "India (+91)", searchText: "india delhi mumbai bangalore hyderabad chennai pune kolkata maharashtra karnataka tamil nadu" },
  { value: "+1", label: "United States (+1)", searchText: "united states usa america washington new york california texas florida los angeles chicago" },
  { value: "+44", label: "United Kingdom (+44)", searchText: "united kingdom uk britain england london manchester birmingham scotland wales" },
  { value: "+61", label: "Australia (+61)", searchText: "australia sydney melbourne brisbane perth canberra victoria queensland" },
  { value: "+971", label: "United Arab Emirates (+971)", searchText: "united arab emirates uae dubai abu dhabi sharjah ajman" },
];

const REST_COUNTRY_ALPHA_CODES = [
  "AF", "AL", "DZ", "AD", "AO", "AG", "AR", "AM", "AU", "AT",
  "AZ", "BS", "BH", "BD", "BB", "BY", "BE", "BZ", "BJ", "BT",
  "BO", "BA", "BW", "BR", "BN", "BG", "BF", "BI", "CV", "KH",
  "CM", "CA", "CF", "TD", "CL", "CN", "CO", "KM", "CG", "CR",
  "CI", "HR", "CU", "CY", "CZ", "CD", "DK", "DJ", "DM", "DO",
  "EC", "EG", "SV", "GQ", "ER", "EE", "SZ", "ET", "FJ", "FI",
  "FR", "GA", "GM", "GE", "DE", "GH", "GR", "GD", "GT", "GN",
  "GW", "GY", "HT", "HN", "HU", "IS", "IN", "ID", "IR", "IQ",
  "IE", "IL", "IT", "JM", "JP", "JO", "KZ", "KE", "KI", "KP",
  "KR", "KW", "KG", "LA", "LV", "LB", "LS", "LR", "LY", "LI",
  "LT", "LU", "MG", "MW", "MY", "MV", "ML", "MT", "MH", "MR",
  "MU", "MX", "FM", "MD", "MC", "MN", "ME", "MA", "MZ", "MM",
  "NA", "NR", "NP", "NL", "NZ", "NI", "NE", "NG", "MK", "NO",
  "OM", "PK", "PW", "PS", "PA", "PG", "PY", "PE", "PH", "PL",
  "PT", "QA", "RO", "RU", "RW", "KN", "LC", "VC", "WS", "SM",
  "ST", "SA", "SN", "RS", "SC", "SL", "SG", "SK", "SI", "SB",
  "SO", "ZA", "SS", "ES", "LK", "SD", "SR", "SE", "CH", "SY",
  "TJ", "TZ", "TH", "TL", "TG", "TO", "TT", "TN", "TR", "TM",
  "TV", "UG", "UA", "AE", "GB", "US", "UY", "UZ", "VU", "VA",
  "VE", "VN", "YE", "ZM", "ZW",
];

let cachedPhoneCountryOptions = [...FALLBACK_PHONE_COUNTRY_OPTIONS];
let phoneCountryOptionsPromise = null;

const COUNTRY_LOCATION_KEYWORDS = {
  AR: ["buenos aires", "cordoba", "rosario", "mendoza"],
  AE: ["dubai", "abu dhabi", "sharjah", "ajman", "ras al khaimah"],
  AT: ["vienna", "salzburg", "innsbruck", "graz"],
  AU: ["sydney", "melbourne", "brisbane", "perth", "adelaide", "canberra", "queensland", "victoria"],
  BD: ["dhaka", "chittagong", "sylhet", "khulna"],
  BE: ["brussels", "antwerp", "ghent", "bruges"],
  BR: ["sao paulo", "rio de janeiro", "brasilia", "salvador", "curitiba"],
  CA: ["toronto", "ontario", "vancouver", "montreal", "alberta", "british columbia", "quebec"],
  CN: ["beijing", "shanghai", "guangzhou", "shenzhen", "chengdu"],
  CH: ["zurich", "geneva", "bern", "basel", "lausanne"],
  CZ: ["prague", "brno", "ostrava"],
  DE: ["berlin", "munich", "hamburg", "frankfurt", "bavaria"],
  EG: ["cairo", "alexandria", "giza", "sharm el sheikh"],
  ES: ["madrid", "barcelona", "valencia", "seville"],
  FI: ["helsinki", "espoo", "tampere"],
  FR: ["paris", "lyon", "marseille", "nice"],
  GR: ["athens", "thessaloniki", "crete", "santorini", "mykonos"],
  GB: ["london", "manchester", "birmingham", "liverpool", "england", "scotland", "wales"],
  HK: ["hong kong", "kowloon", "new territories"],
  ID: ["jakarta", "bali", "surabaya", "bandung", "yogyakarta"],
  IN: ["delhi", "mumbai", "bangalore", "bengaluru", "hyderabad", "chennai", "kolkata", "pune", "maharashtra", "karnataka", "tamil nadu", "gujarat"],
  IE: ["dublin", "cork", "galway", "limerick"],
  IL: ["tel aviv", "jerusalem", "haifa", "eilat"],
  IQ: ["baghdad", "basra", "erbil", "mosul"],
  KE: ["nairobi", "mombasa", "kisumu"],
  IT: ["rome", "milan", "florence", "venice", "naples"],
  JP: ["tokyo", "osaka", "kyoto", "hokkaido", "yokohama"],
  KR: ["seoul", "busan", "incheon", "jeju"],
  LK: ["colombo", "kandy", "galle"],
  MX: ["mexico city", "guadalajara", "monterrey", "cancun"],
  MY: ["kuala lumpur", "selangor", "penang", "johor"],
  NL: ["amsterdam", "rotterdam", "the hague", "utrecht", "eindhoven"],
  NZ: ["auckland", "wellington", "christchurch"],
  NP: ["kathmandu", "pokhara", "lalitpur"],
  OM: ["muscat", "salalah"],
  PK: ["karachi", "lahore", "islamabad", "rawalpindi", "peshawar"],
  PL: ["warsaw", "krakow", "gdansk", "wroclaw"],
  PH: ["manila", "cebu", "davao"],
  PT: ["lisbon", "porto", "faro", "madeira"],
  QA: ["doha"],
  RU: ["moscow", "saint petersburg", "sochi", "kazan"],
  SA: ["riyadh", "jeddah", "mecca", "makkah", "medina"],
  SG: ["singapore"],
  SE: ["stockholm", "gothenburg", "malmo"],
  TR: ["istanbul", "ankara", "izmir", "antalya", "bodrum", "cappadocia"],
  TZ: ["dar es salaam", "zanzibar", "arusha"],
  TH: ["bangkok", "phuket", "chiang mai", "pattaya"],
  UA: ["kyiv", "kiev", "lviv", "odessa", "odesa"],
  US: ["usa", "america", "new york", "california", "texas", "florida", "washington", "los angeles", "chicago", "houston"],
  VN: ["hanoi", "ho chi minh", "saigon", "da nang", "nha trang"],
  ZA: ["johannesburg", "cape town", "durban", "pretoria"],
};

const chunkAlphaCodes = (codes, chunkSize = 40) => {
  const chunks = [];
  for (let index = 0; index < codes.length; index += chunkSize) {
    chunks.push(codes.slice(index, index + chunkSize));
  }
  return chunks;
};

const normalizeRestCountryOption = (country) => {
  const alpha2 = String(country?.cca2 || "").trim().toUpperCase();
  const name = String(country?.name?.common || country?.name?.official || "").trim();
  const officialName = String(country?.name?.official || "").trim();
  const root = String(country?.idd?.root || "").trim();
  const suffix = Array.isArray(country?.idd?.suffixes) && country.idd.suffixes.length
    ? String(country.idd.suffixes[0] || "").trim()
    : "";

  if (!name || !root || !suffix) return null;

  const value = `${root}${suffix}`;
  const keywordParts = [
    name,
    officialName,
    alpha2,
    String(country?.cca3 || "").trim(),
    ...(Array.isArray(country?.capital) ? country.capital : []),
    ...(Array.isArray(country?.altSpellings) ? country.altSpellings : []),
    String(country?.region || "").trim(),
    String(country?.subregion || "").trim(),
    ...(COUNTRY_LOCATION_KEYWORDS[alpha2] || []),
  ].filter(Boolean);

  return {
    value,
    label: `${name} (${value})`,
    searchText: keywordParts.join(" ").toLowerCase(),
  };
};

const fetchRestCountryChunk = async (codes) => {
  const endpoint = `https://restcountries.com/v3.1/alpha?codes=${codes.join(",")}`;
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error(`Could not load country codes (${response.status})`);
  }

  const payload = await response.json();
  return Array.isArray(payload) ? payload : [];
};

const sortAndDeduplicateOptions = (options) => {
  const seen = new Set();

  return options
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label, "en"))
    .filter((option) => {
      const key = `${option.label}::${option.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const getPhoneCountryOptions = () => cachedPhoneCountryOptions;

export const loadPhoneCountryOptions = async () => {
  if (cachedPhoneCountryOptions.length > FALLBACK_PHONE_COUNTRY_OPTIONS.length) {
    return cachedPhoneCountryOptions;
  }

  if (phoneCountryOptionsPromise) {
    return phoneCountryOptionsPromise;
  }

  phoneCountryOptionsPromise = (async () => {
    try {
      const chunks = chunkAlphaCodes(REST_COUNTRY_ALPHA_CODES);
      const responses = await Promise.all(chunks.map(fetchRestCountryChunk));
      const options = sortAndDeduplicateOptions(
        responses.flat().map(normalizeRestCountryOption)
      );

      if (options.length) {
        cachedPhoneCountryOptions = options;
      }
    } catch {
      cachedPhoneCountryOptions = [...FALLBACK_PHONE_COUNTRY_OPTIONS];
    } finally {
      phoneCountryOptionsPromise = null;
    }

    return cachedPhoneCountryOptions;
  })();

  return phoneCountryOptionsPromise;
};

export const findPhoneCountryOption = (value, options = cachedPhoneCountryOptions) =>
  options.find((option) => option.value === value) || options[0] || null;

export const filterPhoneCountryOptions = (query, options = cachedPhoneCountryOptions) => {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return options;

  return options.filter((option) =>
    option.label.toLowerCase().includes(normalized) ||
    option.value.toLowerCase().includes(normalized) ||
    String(option.searchText || "").includes(normalized)
  );
};

export const parsePhoneWithCountryCode = (value, options = cachedPhoneCountryOptions) => {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");

  if (!digits) {
    return {
      countryCode: DEFAULT_PHONE_COUNTRY_CODE,
      phone: "",
    };
  }

  const byLongestCode = [...options]
    .sort((a, b) => b.value.length - a.value.length)
    .find((option) => digits.startsWith(option.value.replace(/\D/g, "")));

  if (byLongestCode) {
    const codeDigits = byLongestCode.value.replace(/\D/g, "");
    const localDigits = digits.slice(codeDigits.length);
    return {
      countryCode: byLongestCode.value,
      phone: localDigits.slice(-10),
    };
  }

  return {
    countryCode: DEFAULT_PHONE_COUNTRY_CODE,
    phone: digits.slice(-10),
  };
};
