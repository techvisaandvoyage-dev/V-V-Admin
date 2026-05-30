import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Input from "../ui/Input";

const normalizeIds = (values) =>
  Array.isArray(values)
    ? Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)))
    : [];

const resolveCountryId = (country) =>
  String(country?._id || country?.slug || country?.id || "").trim();

const FeeScopeConfigSection = ({
  title,
  description,
  mode = "all",
  countries = [],
  amount,
  onAmountChange,
  countryId = "",
  onCountryIdChange,
  countryIds = [],
  onCountryIdsChange,
}) => {
  const [search, setSearch] = useState("");

  const filteredCountries = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return countries;
    return countries.filter((country) => {
      const name = String(country?.name ?? "").toLowerCase();
      const slug = String(country?.slug ?? country?.id ?? "").toLowerCase();
      return name.includes(term) || slug.includes(term);
    });
  }, [countries, search]);

  const normalizedCountryIds = normalizeIds(countryIds);
  const selectedCountries = useMemo(() => {
    if (mode === "single") {
      return countries.filter((country) => resolveCountryId(country) === countryId);
    }
    if (mode === "some") {
      return countries.filter((country) => normalizedCountryIds.includes(resolveCountryId(country)));
    }
    return [];
  }, [countries, countryId, mode, normalizedCountryIds]);

  const selectedPreview =
    mode === "all"
      ? `Applies to all active countries (${countries.length})`
      : selectedCountries.length > 0
        ? `Selected: ${selectedCountries.map((country) => country.name).join(", ")}`
        : "Selected: None";

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">{description}</p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {mode !== "all" && (
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={mode === "single" ? "Search and choose one country" : "Search and choose countries"}
                className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-cyan focus:outline-none focus:ring-2 focus:ring-cyan/20"
              />
            </div>

            <div className="max-h-52 overflow-y-auto rounded-xl border border-border bg-background p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                {filteredCountries.map((country) => {
                  const nextId = resolveCountryId(country);
                  const checked =
                    mode === "single" ? countryId === nextId : normalizedCountryIds.includes(nextId);
                  return (
                    <label
                      key={nextId}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-text-primary hover:bg-surface"
                    >
                      <input
                        type={mode === "single" ? "radio" : "checkbox"}
                        name={mode === "single" ? `${title}-single-country` : undefined}
                        className="h-4 w-4 accent-cyan"
                        checked={checked}
                        onChange={() => {
                          if (mode === "single") {
                            onCountryIdChange?.(nextId);
                            return;
                          }
                          const nextIds = checked
                            ? normalizedCountryIds.filter((id) => id !== nextId)
                            : [...normalizedCountryIds, nextId];
                          onCountryIdsChange?.(nextIds);
                        }}
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

            <div className="rounded-xl border border-border bg-background px-3 py-2.5 text-xs text-text-muted">
              {selectedPreview}
            </div>
          </div>
        )}

        <Input
          label="Amount (INR)"
          type="number"
          value={amount}
          onChange={(e) => onAmountChange?.(e.target.value)}
          placeholder="Enter amount"
        />
      </div>
    </div>
  );
};

export default FeeScopeConfigSection;
