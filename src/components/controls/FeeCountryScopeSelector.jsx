import { useMemo, useState } from "react";
import { Search } from "lucide-react";

const normalizeIds = (values) =>
  Array.isArray(values)
    ? Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)))
    : [];

const FeeCountryScopeSelector = ({
  label = "Apply Fee To",
  countries = [],
  value,
  onChange,
}) => {
  const [search, setSearch] = useState("");

  const normalizedCountryIds = useMemo(
    () => countries.map((country) => String(country?._id || country?.slug || country?.id || "").trim()).filter(Boolean),
    [countries]
  );

  const normalizedSelection = normalizeIds(value?.countryIds);
  const selectedIds = value?.scope === "all" ? [] : normalizedSelection;

  const filteredCountries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return countries;
    return countries.filter((country) => {
      const name = String(country?.name ?? "").toLowerCase();
      const slug = String(country?.slug ?? country?.id ?? "").toLowerCase();
      return name.includes(term) || slug.includes(term);
    });
  }, [countries, search]);

  const selectedCountries = useMemo(
    () =>
      countries.filter((country) =>
        selectedIds.includes(String(country?._id || country?.slug || country?.id || "").trim())
      ),
    [countries, selectedIds]
  );

  const setScope = (scope) => {
    if (scope === "all") {
      onChange({ scope: "all", countryIds: [] });
      return;
    }
    if (scope === "single") {
      onChange({ scope: "single", countryIds: selectedIds.slice(0, 1) });
      return;
    }
    onChange({ scope: "some", countryIds: selectedIds });
  };

  const toggleCountry = (countryId) => {
    if (value?.scope === "single") {
      onChange({ scope: "single", countryIds: [countryId] });
      return;
    }
    const next = selectedIds.includes(countryId)
      ? selectedIds.filter((id) => id !== countryId)
      : [...selectedIds, countryId];
    onChange({ scope: "some", countryIds: next });
  };

  const selectedPreview =
    value?.scope === "all"
      ? `Selected: All Countries (${normalizedCountryIds.length})`
      : selectedCountries.length > 0
        ? `Selected: ${selectedCountries.map((country) => country.name).join(", ")}`
        : "Selected: None";

  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-4 space-y-4">
      <div>
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        <p className="mt-1 text-xs text-text-muted">
          Choose whether this fee should apply to every country, one country, or a selected list.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { key: "all", title: "All Countries", description: "Apply this fee everywhere." },
          { key: "single", title: "Single Country", description: "Update one country only." },
          { key: "some", title: "Some Countries", description: "Update a selected list." },
        ].map((option) => (
          <label
            key={option.key}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
              value?.scope === option.key
                ? "border-cyan/40 bg-cyan/10"
                : "border-border bg-background hover:border-cyan/30"
            }`}
          >
            <input
              type="radio"
              className="mt-0.5 h-4 w-4 accent-cyan"
              checked={value?.scope === option.key}
              onChange={() => setScope(option.key)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-text-primary">{option.title}</span>
              <span className="mt-1 block text-xs text-text-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </div>

      {value?.scope !== "all" && (
        <div className="space-y-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={value?.scope === "single" ? "Search and choose one country" : "Search and choose countries"}
              className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cyan/20 focus:border-cyan"
            />
          </div>

          <div className="max-h-52 overflow-y-auto rounded-xl border border-border bg-background p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredCountries.map((country) => {
                const countryId = String(country?._id || country?.slug || country?.id || "").trim();
                const checked = selectedIds.includes(countryId);
                return (
                  <label key={countryId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-primary hover:bg-surface">
                    <input
                      type={value?.scope === "single" ? "radio" : "checkbox"}
                      name={value?.scope === "single" ? "fee-country-single" : undefined}
                      className="h-4 w-4 accent-cyan"
                      checked={checked}
                      onChange={() => toggleCountry(countryId)}
                    />
                    <span>{country?.name}</span>
                  </label>
                );
              })}
            </div>
            {filteredCountries.length === 0 && (
              <p className="text-xs text-text-muted">No countries match your search.</p>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-text-muted">
        {selectedPreview}
      </div>
    </div>
  );
};

export default FeeCountryScopeSelector;
