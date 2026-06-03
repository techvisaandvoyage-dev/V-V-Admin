import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import Input, { Select } from "../ui/Input";

const normalizeIds = (values) =>
  Array.isArray(values)
    ? Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)))
    : [];

const resolveCountryId = (country) =>
  String(country?._id || country?.slug || country?.id || "").trim();

const VisaTypeScopeConfigSection = ({
  title,
  description,
  mode = "all",
  countries = [],
  suggestions = [],
  visaTypePicker = "",
  onVisaTypePickerChange,
  visaTypeCustom = "",
  onVisaTypeCustomChange,
  countryId = "",
  onCountryIdChange,
  countryIds = [],
  onCountryIdsChange,
  pickerLabel = "Pick a Visa Type",
  customLabel = "Or type a custom value",
  customPlaceholder = "e.g. Sticker Visa, Diplomatic Visa",
  customHelper = "Custom value overrides the dropdown above.",
  children,
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
                  const handleSelect = () => {
                    if (mode === "single") {
                      onCountryIdChange?.(nextId);
                      return;
                    }
                    const nextIds = checked
                      ? normalizedCountryIds.filter((id) => id !== nextId)
                      : [...normalizedCountryIds, nextId];
                    onCountryIdsChange?.(nextIds);
                  };
                  return (
                    <button
                      type="button"
                      key={nextId}
                      role={mode === "single" ? "radio" : "checkbox"}
                      aria-checked={checked}
                      className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-text-primary hover:bg-surface"
                      onClick={handleSelect}
                    >
                      <span
                        className={`flex h-4 w-4 flex-none shrink-0 items-center justify-center border transition-colors ${
                          mode === "single" ? "rounded-full" : "rounded"
                        } ${checked ? "border-cyan bg-cyan" : "border-border bg-background"}`}
                      >
                        {checked && (
                          mode === "single" ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                          ) : (
                            <svg className="h-3 w-3 shrink-0 text-white" fill="none" viewBox="0 0 12 12">
                              <path
                                d="M2 6l3 3 5-5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )
                        )}
                      </span>
                      <span className="min-w-0">{country?.name}</span>
                    </button>
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

        <Select
          label={pickerLabel}
          value={visaTypePicker}
          onChange={(e) => onVisaTypePickerChange?.(e.target.value)}
          options={suggestions.map((value) => ({ value, label: value }))}
          placeholder="-- choose one --"
        />
        <Input
          label={customLabel}
          value={visaTypeCustom}
          onChange={(e) => onVisaTypeCustomChange?.(e.target.value)}
          placeholder={customPlaceholder}
          helper={customHelper}
        />

        {children}
      </div>
    </div>
  );
};

export default VisaTypeScopeConfigSection;
