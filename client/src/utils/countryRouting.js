export const slugifyCountryRoute = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");

export const getCountryRouteId = (country) => {
  if (!country) return "";
  return (
    String(country.slug || "").trim() ||
    String(country.id || "").trim() ||
    slugifyCountryRoute(country.name)
  );
};

export const matchesCountryRouteId = (country, routeId) => {
  const target = String(routeId || "").trim().toLowerCase();
  if (!country || !target) return false;

  const candidates = [
    country.slug,
    country.id,
    country._id,
    slugifyCountryRoute(country.name),
  ];

  return candidates.some((candidate) => String(candidate || "").trim().toLowerCase() === target);
};
