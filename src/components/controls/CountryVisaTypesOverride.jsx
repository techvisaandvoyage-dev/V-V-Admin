import React, { useState, useEffect } from "react";
import { api } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import Button from "../ui/Button";
import Input from "../ui/Input";
import Select from "../ui/Select";
import { Loader2, Plus, Trash2, AlertCircle, Save } from "lucide-react";

const CountryVisaTypesOverride = ({ countries = [], refreshCountries }) => {
  const { showToast } = useUIStore();
  const [selectedCountryId, setSelectedCountryId] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [customVisaTypes, setCustomVisaTypes] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const selectedCountry = countries.find(c => c.value === selectedCountryId);

  useEffect(() => {
    if (!selectedCountryId) {
      setUseCustom(false);
      setCustomVisaTypes([]);
      return;
    }
    
    // Fetch country details to get current customVisaTypes
    const fetchCountry = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/countries/${selectedCountryId}`);
        if (data?.success && data?.country) {
          setUseCustom(data.country.useCustomVisaTypes || false);
          setCustomVisaTypes(data.country.customVisaTypes || []);
        }
      } catch (err) {
        showToast("Failed to fetch country visa types", "error");
      } finally {
        setLoading(false);
      }
    };
    
    fetchCountry();
  }, [selectedCountryId]);

  const handleAdd = (e) => {
    e.preventDefault();
    const trimmed = newTypeName.trim();
    if (!trimmed) {
      showToast("Visa type name cannot be empty", "error");
      return;
    }
    
    const existingIndex = customVisaTypes.findIndex(
      (vt) => String(vt?.name ?? "").trim().toLowerCase() === trimmed.toLowerCase()
    );
    
    if (existingIndex >= 0) {
      showToast("Visa type already exists for this country", "error");
      return;
    }

    setCustomVisaTypes(prev => [
      { id: Date.now().toString(), name: trimmed, active: true },
      ...prev
    ]);
    setNewTypeName("");
  };

  const handleToggleActive = (id, currentActive) => {
    setCustomVisaTypes((prev) =>
      prev.map((vt) => (vt.id === id ? { ...vt, active: !currentActive } : vt))
    );
  };

  const handleDelete = (id, name) => {
    if (!window.confirm(`Delete "${name}" from this country?`)) return;
    setCustomVisaTypes((prev) => prev.filter((vt) => vt.id !== id));
  };

  const handleSave = async () => {
    if (!selectedCountryId) return;
    try {
      setSaving(true);
      const { data } = await api.put(`/admin/countries/${selectedCountryId}`, {
        useCustomVisaTypes: useCustom,
        customVisaTypes: customVisaTypes,
      });
      if (data?.success) {
        showToast(`Visa types updated for ${selectedCountry?.label || 'country'}`, "success");
        if (refreshCountries) refreshCountries();
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update country visa types", "error");
    } finally {
      setSaving(false);
    }
  };

  const activeCount = customVisaTypes.filter((vt) => vt.active).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-text-primary">Country-Specific Visa Type Dropdown</h3>
          <p className="text-xs text-text-muted mt-1.5 max-w-2xl leading-relaxed">
            Override the global dropdown options for a specific country. If enabled, only the visa types defined here will be shown in the Travel Details form when this country is selected.
          </p>
        </div>
      </div>

      <div className="max-w-md">
        <Select
          label="Select Country"
          value={selectedCountryId}
          onChange={(e) => setSelectedCountryId(e.target.value)}
          options={countries}
          placeholder="— Choose a country to manage its dropdown options —"
          id="country-visa-type-override-picker"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-6 bg-surface-2/30 rounded-xl border border-border mt-4">
          <Loader2 className="w-6 h-6 text-cyan animate-spin" />
        </div>
      ) : selectedCountryId ? (
        <div className="mt-4 p-5 rounded-xl border border-border bg-surface-2/30">
          <div className="flex items-center justify-between mb-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useCustom}
                onChange={(e) => setUseCustom(e.target.checked)}
                className="w-4 h-4 rounded border-border text-cyan focus:ring-cyan/20 bg-background"
              />
              <span className="text-sm font-medium text-text-primary">
                Use custom dropdown options for {selectedCountry?.label}
              </span>
            </label>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save size={15} />}
              loading={saving}
              onClick={handleSave}
            >
              Save Changes
            </Button>
          </div>

          {useCustom && (
            <div className="mt-6 pt-6 border-t border-border">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-text-primary">Custom Visa Types</h4>
                <p className="text-xs text-text-secondary mt-1">
                  Add options and check/uncheck to control visibility.
                  {customVisaTypes.length > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 font-medium text-cyan">
                      {activeCount} of {customVisaTypes.length} active
                    </span>
                  )}
                </p>
              </div>

              <form onSubmit={handleAdd} className="mb-4 flex gap-3">
                <Input
                  placeholder="Enter new visa type (e.g. 30 Days E-Visa)"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="flex-1"
                  autoComplete="off"
                />
                <Button type="submit" disabled={!newTypeName.trim()}>
                  <Plus className="w-4 h-4" />
                  Add
                </Button>
              </form>

              <div className="bg-background border border-border rounded-xl overflow-hidden">
                {customVisaTypes.length === 0 ? (
                  <div className="p-8 text-center text-text-muted">
                    <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p className="text-sm font-medium">No custom visa types</p>
                    <p className="text-xs mt-1">Add your first option above.</p>
                  </div>
                ) : (
                  <>
                    <div className="hidden sm:grid grid-cols-[auto_minmax(180px,1fr)_auto] items-center gap-4 px-4 py-2 bg-surface-3 border-b border-border text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                      <span>Show</span>
                      <span>Visa Type Name</span>
                      <span>Action</span>
                    </div>

                    <div className="divide-y divide-border">
                      {customVisaTypes.map((vt) => (
                        <div
                          key={vt.id}
                          className={`grid gap-4 px-4 py-3 transition-colors hover:bg-surface-3 sm:grid-cols-[auto_minmax(180px,1fr)_auto] sm:items-center ${
                            !vt.active ? "opacity-60" : ""
                          }`}
                        >
                          <label
                            className="flex items-center cursor-pointer flex-shrink-0"
                            title={vt.active ? "Disable (hide from dropdown)" : "Enable (show in dropdown)"}
                          >
                            <input
                              type="checkbox"
                              checked={vt.active}
                              onChange={() => handleToggleActive(vt.id, vt.active)}
                              className="sr-only"
                            />
                            <span
                              className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                                vt.active ? "bg-cyan border-cyan" : "bg-transparent border-border"
                              }`}
                            >
                              {vt.active && (
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                                  <path
                                    d="M2 6l3 3 5-5"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </span>
                          </label>

                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-text-primary truncate">{vt.name}</p>
                            <p className={`text-xs ${vt.active ? "text-emerald-500" : "text-text-muted"}`}>
                              {vt.active ? "Visible" : "Hidden"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDelete(vt.id, vt.name)}
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors"
                            title={`Delete ${vt.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};

export default CountryVisaTypesOverride;
