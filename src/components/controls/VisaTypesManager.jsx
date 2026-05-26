import { useState, useEffect } from "react";
import { api } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { Loader2, Plus, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import Card from "../ui/Card";

const VisaTypesManager = () => {
  const { showToast } = useUIStore();
  const [visaTypes, setVisaTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

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

    if (visaTypes.some(vt => vt.name.toLowerCase() === trimmed.toLowerCase())) {
      showToast("Visa type already exists", "error");
      return;
    }

    try {
      setAdding(true);
      const { data } = await api.post("/visa-types", { name: trimmed, active: true });
      if (data?.success) {
        setVisaTypes([data.visaType, ...visaTypes]);
        setNewTypeName("");
        showToast("Visa type added", "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to add visa type", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      // Optimistic update
      setVisaTypes(prev => prev.map(vt => vt._id === id ? { ...vt, active: !currentActive } : vt));
      const { data } = await api.patch(`/visa-types/${id}`, { active: !currentActive });
      if (data?.success) {
        showToast(`Visa type ${!currentActive ? "enabled" : "disabled"}`, "success");
      }
    } catch (err) {
      // Revert optimistic update
      setVisaTypes(prev => prev.map(vt => vt._id === id ? { ...vt, active: currentActive } : vt));
      showToast(err?.response?.data?.message || "Failed to update status", "error");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this visa type?")) return;
    try {
      const { data } = await api.delete(`/visa-types/${id}`);
      if (data?.success) {
        setVisaTypes(prev => prev.filter(vt => vt._id !== id));
        showToast("Visa type deleted", "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to delete visa type", "error");
    }
  };

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-8 h-8 text-cyan animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Global Visa Types</h2>
          <p className="text-sm text-text-secondary mt-1">
            Manage the list of visa types available for users to select during application.
          </p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="flex gap-3 mb-8">
        <Input
          placeholder="New Visa Type (e.g. e-Visa, Sticker Visa)"
          value={newTypeName}
          onChange={(e) => setNewTypeName(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={adding || !newTypeName.trim()}>
          {adding ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
          Add Type
        </Button>
      </form>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {visaTypes.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No visa types defined yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {visaTypes.map((vt) => (
              <div key={vt._id} className="flex items-center justify-between p-4 hover:bg-surface-2 transition-colors">
                <div>
                  <h3 className="font-semibold text-text-primary">{vt.name}</h3>
                  <p className="text-xs text-text-muted">Created: {new Date(vt.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${vt.active ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={vt.active}
                        onChange={() => handleToggleActive(vt._id, vt.active)}
                      />
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${vt.active ? 'translate-x-4.5' : 'translate-x-1'}`}
                      />
                    </div>
                    <span className={`text-sm font-medium ${vt.active ? 'text-emerald-500' : 'text-text-muted'}`}>
                      {vt.active ? 'Active' : 'Inactive'}
                    </span>
                  </label>
                  <button
                    onClick={() => handleDelete(vt._id)}
                    className="p-2 text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};

export default VisaTypesManager;
