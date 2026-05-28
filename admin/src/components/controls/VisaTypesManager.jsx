import { useState, useEffect } from "react";
import { api } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import Card from "../ui/Card";
import CountryVisibilitySelector from "./CountryVisibilitySelector";

const DEFAULT_VISIBILITY = {
  applyToAllActiveCountries: true,
  selectedCountries: [],
};

const hasCountrySelection = (item) =>
  item?.applyToAllActiveCountries !== false ||
  (Array.isArray(item?.selectedCountries) && item.selectedCountries.length > 0);

const VisaTypesManager = ({ activeCountries = [] }) => {
  const { showToast } = useUIStore();
  const [visaTypes, setVisaTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [toggling, setToggling] = useState({});
  const [deleting, setDeleting] = useState({});
  const [savingVisibility, setSavingVisibility] = useState({});
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeVisibility, setNewTypeVisibility] = useState(DEFAULT_VISIBILITY);

  const fetchVisaTypes = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/visa-types");
      if (data?.success) {
        setVisaTypes(data.visaTypes);
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load visa types", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisaTypes();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    const trimmed = newTypeName.trim();
    if (!trimmed) {
      showToast("Visa type name cannot be empty", "error");
      return;
    }
    if (!hasCountrySelection(newTypeVisibility)) {
      showToast("Please select at least one country.", "error");
      return;
    }
    try {
      setAdding(true);
      const { data } = await api.post("/visa-types", {
        name: trimmed,
        active: true,
        applyToAllActiveCountries: newTypeVisibility.applyToAllActiveCountries !== false,
        selectedCountries: newTypeVisibility.selectedCountries,
      });
      if (data?.success) {
        setVisaTypes((prev) => {
          const existingIndex = prev.findIndex(
            (vt) => String(vt?.name ?? "").trim().toLowerCase() === trimmed.toLowerCase()
          );
          if (existingIndex >= 0) {
            const next = [...prev];
            next[existingIndex] = data.visaType;
            return next;
          }
          return [data.visaType, ...prev];
        });
        setNewTypeName("");
        setNewTypeVisibility(DEFAULT_VISIBILITY);
        showToast(data.message || `"${trimmed}" saved successfully`, "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to add visa type", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    setToggling((prev) => ({ ...prev, [id]: true }));
    setVisaTypes((prev) =>
      prev.map((vt) => (vt._id === id ? { ...vt, active: !currentActive } : vt))
    );
    try {
      const { data } = await api.patch(`/visa-types/${id}`, { active: !currentActive });
      if (data?.success) {
        showToast(
          !currentActive
            ? "Visa type enabled and visible in the user dropdown"
            : "Visa type disabled and hidden from the user dropdown",
          "success"
        );
      }
    } catch (err) {
      setVisaTypes((prev) =>
        prev.map((vt) => (vt._id === id ? { ...vt, active: currentActive } : vt))
      );
      showToast(err?.response?.data?.message || "Failed to update status", "error");
    } finally {
      setToggling((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleVisibilityChange = async (id, currentVisaType, nextVisibility) => {
    if (!hasCountrySelection(nextVisibility)) {
      showToast("Please select at least one country.", "error");
      return;
    }
    setSavingVisibility((prev) => ({ ...prev, [id]: true }));
    setVisaTypes((prev) =>
      prev.map((vt) => (vt._id === id ? { ...vt, ...nextVisibility } : vt))
    );
    try {
      const { data } = await api.patch(`/visa-types/${id}`, nextVisibility);
      if (data?.success) {
        showToast(`"${currentVisaType.name}" updated for selected countries`, "success");
      }
    } catch (err) {
      setVisaTypes((prev) =>
        prev.map((vt) =>
          vt._id === id
            ? {
                ...vt,
                applyToAllActiveCountries: currentVisaType.applyToAllActiveCountries !== false,
                selectedCountries: currentVisaType.selectedCountries || [],
              }
            : vt
        )
      );
      showToast(err?.response?.data?.message || "Failed to update selected countries", "error");
    } finally {
      setSavingVisibility((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting((prev) => ({ ...prev, [id]: true }));
    try {
      const { data } = await api.delete(`/visa-types/${id}`);
      if (data?.success) {
        setVisaTypes((prev) => prev.filter((vt) => vt._id !== id));
        showToast(`"${name}" deleted`, "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete visa type", "error");
    } finally {
      setDeleting((prev) => ({ ...prev, [id]: false }));
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center p-10">
          <Loader2 className="w-8 h-8 text-cyan animate-spin" />
        </div>
      </Card>
    );
  }

  const activeCount = visaTypes.filter((vt) => vt.active).length;

  return (
    <Card>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-text-primary">Manage Visa Types</h2>
        <p className="text-sm text-text-secondary mt-1">
          Add visa types and check/uncheck to control which appear in the user's Travel Details dropdown.
          {visaTypes.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-cyan">
              {activeCount} of {visaTypes.length} active
            </span>
          )}
        </p>
      </div>

      <form onSubmit={handleAdd} className="mb-6 space-y-4">
        <div className="flex gap-3">
          <Input
            placeholder="Enter new visa type"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            className="flex-1"
            autoComplete="off"
          />
          <Button type="submit" disabled={adding || !newTypeName.trim()}>
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Visa Type
          </Button>
        </div>
        <CountryVisibilitySelector
          item={newTypeVisibility}
          activeCountries={activeCountries}
          itemLabel="this visa type"
          mode="applied"
          allKey="applyToAllActiveCountries"
          selectedKey="selectedCountries"
          onChange={setNewTypeVisibility}
        />
      </form>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {visaTypes.length === 0 ? (
          <div className="p-10 text-center text-text-muted">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="font-medium">No visa types yet</p>
            <p className="text-xs mt-1">Add your first visa type above to get started.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:grid grid-cols-[auto_minmax(180px,220px)_minmax(260px,1fr)_auto] items-center gap-4 px-4 py-2 bg-surface-2 border-b border-border text-xs font-semibold text-text-muted uppercase tracking-wider">
              <span>Show</span>
              <span>Visa Type Name</span>
              <span>Countries</span>
              <span>Action</span>
            </div>

            <div className="divide-y divide-border">
              {visaTypes.map((vt) => (
                <div
                  key={vt._id}
                  className={`grid gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2 lg:grid-cols-[auto_minmax(180px,220px)_minmax(260px,1fr)_auto] lg:items-center ${
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
                      disabled={toggling[vt._id]}
                      onChange={() => handleToggleActive(vt._id, vt.active)}
                      className="sr-only"
                    />
                    <span
                      className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
                        vt.active ? "bg-cyan border-cyan" : "bg-transparent border-border"
                      } ${toggling[vt._id] ? "opacity-50" : ""}`}
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
                      {vt.active ? "Visible in user dropdown" : "Hidden from dropdown"}
                    </p>
                  </div>

                  <div className={savingVisibility[vt._id] ? "pointer-events-none opacity-70" : ""}>
                    <CountryVisibilitySelector
                      item={{
                        applyToAllActiveCountries: vt.applyToAllActiveCountries !== false,
                        selectedCountries: vt.selectedCountries || [],
                      }}
                      activeCountries={activeCountries}
                      itemLabel={vt.name}
                      mode="applied"
                      allKey="applyToAllActiveCountries"
                      selectedKey="selectedCountries"
                      onChange={(next) => handleVisibilityChange(vt._id, vt, next)}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(vt._id, vt.name)}
                    disabled={deleting[vt._id]}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    title={`Delete ${vt.name}`}
                  >
                    {deleting[vt._id] ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {visaTypes.length > 0 && (
        <p className="text-xs text-text-muted mt-3">
          Checked visa types appear in the user's Travel Details dropdown, and each type can be limited to selected active countries.
        </p>
      )}
    </Card>
  );
};

export default VisaTypesManager;
