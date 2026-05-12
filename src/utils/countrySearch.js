const COUNTRY_ALIASES = {
  "United Arab Emirates": ["uae", "dubai", "abu dhabi", "sharjah"],
  India: ["mumbai", "delhi", "new delhi", "bangalore", "bengaluru", "goa", "bharat"],
  "United States": ["usa", "us", "america", "new york", "los angeles", "california"],
  "United Kingdom": ["uk", "england", "britain", "great britain", "london"],
  France: ["paris", "schengen", "eu schengen"],
  Italy: ["rome", "venice", "milan", "schengen"],
  Germany: ["berlin", "munich", "schengen"],
  Spain: ["madrid", "barcelona", "schengen"],
  Netherlands: ["amsterdam", "holland", "schengen"],
  Switzerland: ["zurich", "geneva", "schengen"],
  Japan: ["tokyo", "osaka", "kyoto"],
  Thailand: ["bangkok", "phuket", "pattaya"],
  Singapore: ["singapura"],
  Turkey: ["istanbul"],
  "Saudi Arabia": ["riyadh", "jeddah", "makkah", "mecca", "madinah", "medina"],
  "South Korea": ["korea", "seoul"],
};

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const matchesCountrySearch = (country, rawTerm) => {
  const term = normalize(rawTerm);
  if (!term) return true;

  const values = [
    country.name,
    country.slug,
    country.id,
    country.continent,
    country.visaType,
    country.difficulty,
  ].map(normalize);

  if (term.length >= 2) {
    values.push(...(COUNTRY_ALIASES[country.name] || []).map(normalize));
  }

  return values.some((value) => value.includes(term));
};

export const getCountrySearchHint = (country, rawTerm) => {
  const term = normalize(rawTerm);
  if (!term) return "";

  const alias = (COUNTRY_ALIASES[country.name] || []).find((value) =>
    normalize(value).includes(term)
  );

  return alias ? `Matches ${alias}` : "";
};
