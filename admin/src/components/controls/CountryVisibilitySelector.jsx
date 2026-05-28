import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import Button from "../ui/Button";

const normalizeIds = (values) =>
  Array.isArray(values)
    ? Array.from(new Set(values.map((value) => String(value ?? "").trim()).filter(Boolean)))
    : [];

const CountryVisibilitySelector = ({
  item,
  activeCountries = [],
  itemLabel = "item",
  onChange,
  allKey = "showInAllActiveCountries",
  selectedKey = "selectedCountries",
  mode = "showing",
}) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const activeCountryIds = useMemo(
    () =>
      activeCountries
        .map((country) => String(country?._id || country?.slug || country?.id || "").trim())
        .filter(Boolean),
    [activeCountries]
  );

  const normalizedSelected = normalizeIds(item?.[selectedKey]);
  const hasExplicitSubset =
    normalizedSelected.length > 0 && normalizedSelected.length < activeCountryIds.length;
  const allSelected = hasExplicitSubset ? false : item?.[allKey] !== false;
  const selected = allSelected ? activeCountryIds : normalizedSelected;

  const filteredCountries = activeCountries.filter((country) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    const name = String(country?.name ?? "").toLowerCase();
    const slug = String(country?.slug ?? country?.id ?? "").toLowerCase();
    return name.includes(term) || slug.includes(term);
  });

  const setSelection = (nextIds) =>
    onChange({
      ...item,
      [allKey]: nextIds.length === activeCountryIds.length,
      [selectedKey]: nextIds,
    });

  const summaryLabel =
    selected.length === activeCountryIds.length
      ? `All active countries (${activeCountryIds.length})`
      : `${selected.length} countr${selected.length === 1 ? "y" : "ies"} selected`;

  const actionText = mode === "applied" ? "Applied to" : "Showing";

  return (
    <div className="rounded-xl border border-border bg-surface-2/50 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-text-primary">Choose Countries</p>
          <p className="mt-1 text-[11px] text-text-muted">
            {allSelected
              ? `${actionText} ${itemLabel} in all ${activeCountryIds.length} active countries`
              : `${actionText} ${itemLabel} in ${selected.length} countr${selected.length === 1 ? "y" : "ies"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:border-cyan/40 hover:bg-surface"
        >
          <span>{summaryLabel}</span>
          <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      {open && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              className="min-w-[220px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cyan/20"
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => setSelection([...activeCountryIds])}>
              Select All
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => setSelection([])}>
              Clear All
            </Button>
          </div>
          <div className="max-h-48 overflow-y-auto rounded-xl border border-border bg-background p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredCountries.map((country) => {
                const id = String(country?._id || country?.slug || country?.id || "").trim();
                const checked = selected.includes(id);
                return (
                  <label key={id} className="inline-flex items-center gap-2 text-sm text-text-primary">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border bg-surface-2 accent-cyan"
                      checked={checked}
                      onChange={(e) =>
                        setSelection(
                          e.target.checked
                            ? [...selected, id]
                            : selected.filter((value) => value !== id)
                        )
                      }
                    />
                    <span>{country?.name}</span>
                  </label>
                );
              })}
            </div>
            {filteredCountries.length === 0 && (
              <p className="text-xs text-text-muted">No active countries match your search.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default CountryVisibilitySelector;
