import { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "../../store/authStore";
import { useDataStore } from "../../store/dataStore";
import { useUIStore } from "../../store/uiStore";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Modal from "../ui/Modal";
import { Loader2, Save, Search, Edit3, ChevronDown, X, Check, Globe, Plus } from "lucide-react";
import {
  VISA_TYPE_SUGGESTIONS,
  ENTRY_TYPE_SUGGESTIONS,
  VALIDITY_SUGGESTIONS,
  PROCESSING_DAYS_SUGGESTIONS,
  LENGTH_OF_STAY_SUGGESTIONS,
} from "../../constants/suggestions";
import { getDocumentIcon, REMIX_ICON_SUGGESTIONS } from "../../constants/documentIcons";

const FIELD_SUGGESTIONS = {
  visaType: VISA_TYPE_SUGGESTIONS,
  entryType: ENTRY_TYPE_SUGGESTIONS,
  validity: VALIDITY_SUGGESTIONS,
  processingDays: PROCESSING_DAYS_SUGGESTIONS,
  lengthOfStay: LENGTH_OF_STAY_SUGGESTIONS,
};

const FIELD_LABELS = {
  visaType: "Default Visa Type",
  entryType: "Entry",
  validity: "Validity",
  processingDays: "Processing Days",
  lengthOfStay: "Length of Stay",
  requiredDocuments: "Required Documents",
  optionalDocuments: "Optional Documents",
};

const resolveEffectiveValue = (country, field, globalDefaults) => {
  const useGlobalKey = `useGlobal${field.charAt(0).toUpperCase() + field.slice(1)}`;
  if (country[useGlobalKey] !== false) {
    const globalKey = `global${field.charAt(0).toUpperCase() + field.slice(1)}`;
    return globalDefaults[globalKey] || country[field] || "";
  }
  return country[field] || "";
};

const isUsingGlobal = (country, field) => {
  const useGlobalKey = `useGlobal${field.charAt(0).toUpperCase() + field.slice(1)}`;
  return country[useGlobalKey] !== false;
};

const findCountry = (allCountries, id) =>
  allCountries.find((c) => String(c._id) === String(id) || String(c.slug) === String(id) || String(c.id) === String(id));

const DocMultiSelect = ({ selectedKeys = [], catalog = [], onChange, placeholder = "Select documents", onAddDocument, onEditDocument, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const toggle = (key) => {
    if (disabled) return;
    const next = selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key];
    onChange(next);
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        className={`w-full flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-left min-h-[32px] ${disabled ? "opacity-60 cursor-not-allowed" : "hover:border-cyan/40 transition-colors"}`}
      >
        <span className="flex-1 truncate">
          {selectedKeys.length === 0 ? placeholder : `${selectedKeys.length} selected`}
        </span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-72 rounded-xl border border-border bg-white shadow-xl p-2 max-h-64 overflow-y-auto">
            {catalog.length === 0 ? (
              <p className="text-xs text-text-muted p-2">No documents in catalog</p>
            ) : (
              catalog.map((doc) => {
                const key = doc.key || doc;
                const label = doc.label || doc;
                const checked = selectedKeys.includes(key);
                return (
                  <div key={key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-text-primary hover:bg-surface-2 cursor-pointer group">
                    <label className="flex items-center gap-2 flex-1 min-w-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(key)}
                        className="h-3.5 w-3.5 rounded border-border accent-cyan shrink-0"
                      />
                      <span className="truncate">{label}</span>
                    </label>
                    {onEditDocument && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEditDocument(doc); setOpen(false); }}
                        className="shrink-0 p-1 rounded text-text-muted opacity-0 group-hover:opacity-100 hover:text-cyan hover:bg-cyan/10 transition-all"
                        title={`Edit ${label}`}
                      >
                        <Edit3 size={12} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
            {onAddDocument && (
              <>
                <div className="border-t border-border mt-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { onAddDocument(); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-cyan font-medium hover:bg-cyan/5 transition-colors"
                  >
                    <Plus size={12} />
                    Add new document
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const DocumentEditModal = ({ isOpen, onClose, editDoc, onDocumentAdded }) => {
  const { showToast } = useUIStore();
  const isEditing = !!editDoc;
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editDoc) {
      setLabel(editDoc.label || "");
      setDescription(editDoc.description || "");
      setIcon(editDoc.icon || "");
    } else {
      setLabel("");
      setDescription("");
      setIcon("");
    }
  }, [editDoc]);

  const handleSave = async () => {
    const trimmed = label.trim();
    if (!trimmed) { showToast("Document name is required.", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        action: isEditing ? "save" : "add",
        label: trimmed,
        description: description.trim(),
        icon: icon.trim(),
      };
      if (isEditing) payload.key = editDoc.key;
      const { data } = await api.post("/admin/control/custom-documents", payload);
      if (data?.success) {
        showToast(isEditing ? `"${trimmed}" updated` : `"${trimmed}" added to catalog`, "success");
        onDocumentAdded?.(data.documentCatalog || []);
        onClose();
      } else {
        showToast(data?.message || "Operation failed.", "error");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Operation failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Edit Document" : "Add New Document"} size="md">
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">Document Name *</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Vaccination Certificate"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/20"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">Icon</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="ri-file-list-3-line"
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/20"
            />
            {icon && (
              <span className="flex items-center justify-center w-10 h-10 rounded-xl border border-border bg-surface text-lg">
                <i className={icon} />
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {REMIX_ICON_SUGGESTIONS.map((remix) => (
              <button
                key={remix}
                type="button"
                onClick={() => setIcon(remix)}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors ${icon === remix ? "border-cyan bg-cyan/10 text-cyan" : "border-border text-text-muted hover:border-cyan/40"}`}
              >
                <i className={remix} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this document..."
            rows={3}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/20 resize-none"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} loading={saving} disabled={saving || !label.trim()}>
          {isEditing ? "Save Changes" : "Add to Catalog"}
        </Button>
      </div>
    </Modal>
  );
};

const InlineSelect = ({ value, suggestions, onChange, allowCustom = false, onAddToCatalog, editable = true }) => {
  const [editing, setEditing] = useState(false);
  const [customVal, setCustomVal] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const inSuggestions = suggestions.includes(value);

  if (!editing) {
    if (!editable) {
      return (
        <span className="w-full flex items-center gap-1 px-2 py-1.5 text-xs text-left min-h-[32px]">
          <span className={`flex-1 truncate ${!value ? "text-text-muted italic" : inSuggestions ? "text-text-primary" : "text-cyan font-medium"}`}>
            {value || "Not set"}
          </span>
          {!inSuggestions && value && (
            <span className="text-[10px] text-cyan font-medium shrink-0">custom</span>
          )}
        </span>
      );
    }
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full flex items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs text-left min-h-[32px] hover:border-cyan/40 hover:bg-surface-2/50 transition-colors group"
      >
        <span className={`flex-1 truncate ${!value ? "text-text-muted italic" : inSuggestions ? "text-text-primary" : "text-cyan font-medium"}`}>
          {value || "Not set"}
        </span>
        {!inSuggestions && value && (
          <span className="text-[10px] text-cyan font-medium shrink-0">custom</span>
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <select
        value={showCustomInput ? "__custom__" : (inSuggestions ? value : "")}
        onChange={(e) => {
          if (e.target.value === "__custom__") {
            setShowCustomInput(true);
            setCustomVal("");
          } else {
            onChange(e.target.value);
            setEditing(false);
            setShowCustomInput(false);
          }
        }}
        onBlur={() => { if (!showCustomInput) setEditing(false); }}
        autoFocus
        className="w-full rounded-lg border border-cyan/40 bg-background px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-cyan/20"
      >
        <option value="">{allowCustom ? "Select..." : "Select..."}</option>
        {suggestions.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
        {allowCustom && (
          <option value="__custom__">+ Add custom value</option>
        )}
      </select>
      {showCustomInput && allowCustom && (
        <div className="flex gap-1">
          <input
            type="text"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && customVal.trim()) { onAddToCatalog?.(customVal.trim()); onChange(customVal.trim()); setEditing(false); setShowCustomInput(false); setCustomVal(""); } }}
            placeholder="Type custom value..."
            className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan/20"
            autoFocus
          />
          <button
            type="button"
            onClick={() => { if (customVal.trim()) { onAddToCatalog?.(customVal.trim()); onChange(customVal.trim()); setEditing(false); setShowCustomInput(false); setCustomVal(""); } }}
            className="shrink-0 p-1 rounded bg-cyan text-white hover:bg-cyan/90"
          >
            <Check size={12} />
          </button>
        </div>
      )}
    </div>
  );
};

const modalSuggestions = (field, existing) => {
  const base = FIELD_SUGGESTIONS[field] || [];
  const fromData = (existing[field] || []);
  return [...new Set([...base, ...fromData])];
};

const CountryEditModal = ({ country, catalog, globalDefaults, visaTypes = [], allCountryValues = {}, onClose, onSave, onAddVisaType }) => {
  const [form, setForm] = useState({ ...country });

  const selectedVisaTypeNames = useMemo(() => {
    if (Array.isArray(form.customVisaTypes)) {
      return form.customVisaTypes.filter((vt) => vt.active !== false).map((vt) => vt.name);
    }
    return [];
  }, [form.customVisaTypes]);

  const setField = (field, value) => {
    const useGlobalKey = `useGlobal${field.charAt(0).toUpperCase() + field.slice(1)}`;
    const globalKey = `global${field.charAt(0).toUpperCase() + field.slice(1)}`;
    const globalVal = globalDefaults[globalKey];
    setForm((prev) => ({
      ...prev,
      [field]: value,
      [useGlobalKey]: value === globalVal,
    }));
  };

  const setSelectedVisaTypes = (names) => {
    setForm((prev) => ({
      ...prev,
      customVisaTypes: names.map((name) => ({ id: name, name, active: true })),
      useCustomVisaTypes: names.length > 0,
    }));
  };

  const handleSave = () => {
    onSave(form);
    onClose();
  };

  if (!country) return null;

  const fields = ["visaType", "entryType", "validity", "processingDays", "lengthOfStay"];

  return (
    <Modal isOpen onClose={onClose} title={`Edit Visa Details — ${country.name || country.slug}`} size="lg">
      <div className="space-y-4">
        {fields.map((f) => {
          const suggestions = f === "visaType"
            ? [...new Set([...(visaTypes || []).filter((vt) => vt.active).map((vt) => vt.name), ...modalSuggestions(f, allCountryValues)])]
            : modalSuggestions(f, allCountryValues);
          return (
            <div key={f}>
              <label className="block text-xs font-semibold text-text-primary mb-1">{FIELD_LABELS[f]}</label>
              <div className="flex gap-2">
                <select
                  value={suggestions.includes(form[f]) ? form[f] : ""}
                  onChange={(e) => setField(f, e.target.value)}
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/20"
                >
                  <option value="">Select...</option>
                {suggestions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                </select>
                <input
                  type="text"
                  value={FIELD_SUGGESTIONS[f].includes(form[f]) ? "" : form[f] || ""}
                  onChange={(e) => setField(f, e.target.value)}
                  placeholder="Custom value"
                  className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan/20"
                />
              </div>
              {form[`useGlobal${f.charAt(0).toUpperCase() + f.slice(1)}`] !== false && (
                <p className="text-[10px] text-text-muted mt-1">
                  Currently using global default: <span className="text-cyan">{globalDefaults[`global${f.charAt(0).toUpperCase() + f.slice(1)}`] || "Not set"}</span>
                </p>
              )}
            </div>
          );
        })}

        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">Available Visa Types</label>
          <VisaTypeMultiSelect
            country={form}
            visaTypes={visaTypes}
            dirtyRows={{}}
            onSelect={setSelectedVisaTypes}
            onAddVisaType={onAddVisaType}
          />
          {form.useCustomVisaTypes === false && selectedVisaTypeNames.length === 0 && (
            <p className="text-[10px] text-text-muted mt-1">Uses global visa type list. Select types above to override.</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">Required Documents</label>
          <DocMultiSelect
            selectedKeys={form.requiredDocuments || []}
            catalog={catalog}
            onChange={(keys) => setForm((prev) => ({ ...prev, requiredDocuments: keys, useGlobalRequiredDocuments: false }))}
            placeholder="Select required documents"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave}>Save Country</Button>
      </div>
    </Modal>
  );
};

const VisaTypeMultiSelect = ({ country, visaTypes = [], dirtyRows = {}, onSelect, onAddVisaType, disabled = false }) => {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const id = String(country._id || country.slug || country.id);

  const selectedNames = useMemo(() => {
    if (id in dirtyRows && "customVisaTypes" in dirtyRows[id]) {
      return dirtyRows[id].customVisaTypes || [];
    }
    if (Array.isArray(country.customVisaTypes)) {
      return country.customVisaTypes.filter((vt) => vt.active !== false).map((vt) => vt.name);
    }
    return [];
  }, [country, dirtyRows, id]);

  const toggle = (name) => {
    if (disabled) return;
    const next = selectedNames.includes(name)
      ? selectedNames.filter((n) => n !== name)
      : [...selectedNames, name];
    onSelect(next);
  };

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAdding(true);
    await onAddVisaType(trimmed, () => {
      toggle(trimmed);
      setNewName("");
    });
    setAdding(false);
  };

  const activeVisaTypes = visaTypes.filter((vt) => vt.active);

  return (
    <div className="relative min-w-[140px]">
      <button
        type="button"
        onClick={() => { if (!disabled) setOpen(!open); }}
        className={`w-full flex items-center gap-1.5 rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-left min-h-[32px] ${disabled ? "opacity-60 cursor-not-allowed" : "hover:border-cyan/40 transition-colors"}`}
      >
        <span className="flex-1 truncate">
          {selectedNames.length === 0 ? "Select types" : `${selectedNames.length} selected`}
        </span>
        <ChevronDown size={12} className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-20 w-72 rounded-xl border border-border bg-white shadow-xl p-2 max-h-64 overflow-y-auto">
            {activeVisaTypes.length === 0 ? (
              <p className="text-xs text-text-muted p-2">No visa types available.</p>
            ) : (
              activeVisaTypes.map((vt) => {
                const checked = selectedNames.includes(vt.name);
                return (
                  <label key={vt._id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-text-primary hover:bg-surface-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(vt.name)}
                      className="h-3.5 w-3.5 rounded border-border accent-cyan"
                    />
                    <span className="truncate">{vt.name}</span>
                  </label>
                );
              })
            )}
            <div className="border-t border-border mt-2 pt-2">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                  placeholder="Add visa type..."
                  className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan/20"
                />
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={adding || !newName.trim()}
                  className="shrink-0 px-2 py-1.5 rounded-lg bg-cyan text-white text-xs font-medium hover:bg-cyan/90 disabled:opacity-50 transition-colors"
                >
                  {adding ? <Loader2 size={12} className="animate-spin" /> : "Add"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const VisaDetailsTable = () => {
  const { showToast } = useUIStore();
  const { countries, fetchCountries } = useDataStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [globalDefaults, setGlobalDefaults] = useState({});
  const [visaTypes, setVisaTypes] = useState([]);
  const [documentCatalog, setDocumentCatalog] = useState([]);
  const [dirtyRows, setDirtyRows] = useState({});
  const [editingCountry, setEditingCountry] = useState(null);
  const [bulkValues, setBulkValues] = useState({});
  const [dynamicSuggestions, setDynamicSuggestions] = useState({});
  const [bulkCustomInputs, setBulkCustomInputs] = useState({});
  const [showAddDocumentModal, setShowAddDocumentModal] = useState(false);
  const [editingDoc, setEditingDoc] = useState(null);
  const [batchActivating, setBatchActivating] = useState(false);
  const [columnFilters, setColumnFilters] = useState({
    visaType: "",
    customVisaTypes: "",
    validity: "",
    processingDays: "",
    lengthOfStay: "",
    entryType: "",
    requiredDocuments: "",
    optionalDocuments: ""
  });

  const activeCountries = useMemo(
    () => (Array.isArray(countries) ? countries : []).filter((c) => c?.isActive !== false),
    [countries]
  );
  const displayCountries = useMemo(() => {
    let list = showActiveOnly ? activeCountries : (Array.isArray(countries) ? countries : []);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((c) => String(c.name || "").toLowerCase().includes(q) || String(c.slug || "").toLowerCase().includes(q));
    }
    
    Object.entries(columnFilters).forEach(([col, filterValue]) => {
      if (!filterValue) return;
      const q = filterValue.toLowerCase();
      list = list.filter((c) => {
        const id = String(c._id || c.slug || c.id);
        const draft = dirtyRows[id] || {};
        
        if (col === "customVisaTypes") {
          const names = "customVisaTypes" in draft 
            ? (draft.customVisaTypes || []) 
            : (Array.isArray(c.customVisaTypes) ? c.customVisaTypes.filter(vt => vt.active !== false).map(vt => vt.name) : []);
          return names.some(n => String(n).toLowerCase().includes(q));
        }
        
        if (col === "requiredDocuments" || col === "optionalDocuments") {
          const docs = col in draft ? draft[col] : (c[col] || []);
          return docs.some(d => String(d).toLowerCase().includes(q));
        }
        
        const effective = (col in draft) ? draft[col] : resolveEffectiveValue(c, col, globalDefaults);
        return String(effective || "").toLowerCase().includes(q);
      });
    });

    return list;
  }, [countries, activeCountries, showActiveOnly, searchQuery, columnFilters, dirtyRows, globalDefaults]);

  const allIds = useMemo(() => displayCountries.map((c) => String(c._id || c.slug || c.id)), [displayCountries]);
  const allSelected = selectedIds.length === displayCountries.length && displayCountries.length > 0;
  const hasDirty = Object.keys(dirtyRows).length > 0;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      await fetchCountries();
      const [defaultsRes, visaTypesRes] = await Promise.all([
        api.get("/admin/control/country-defaults"),
        api.get("/visa-types"),
      ]);
      if (defaultsRes.data?.success) {
        setGlobalDefaults(defaultsRes.data.defaults || {});
        if (defaultsRes.data.documentCatalog) {
          setDocumentCatalog(defaultsRes.data.documentCatalog);
        }
      }
      if (visaTypesRes.data?.success) {
        setVisaTypes(visaTypesRes.data.visaTypes || []);
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to load visa details data", "error");
    } finally {
      setLoading(false);
    }
  }, [fetchCountries, showToast]);

  useEffect(() => { loadData(); }, [loadData]);

  const catalogOptions = useMemo(() => {
    return documentCatalog.length > 0
      ? documentCatalog.map((d) => ({ key: d.key, label: d.label || d.key, description: d.description || "", icon: d.icon || "" }))
      : [];
  }, [documentCatalog]);

  const getCountryDraft = useCallback((country) => {
    const id = String(country._id || country.slug || country.id);
    return dirtyRows[id] || {};
  }, [dirtyRows]);

  const setCellValue = useCallback((country, field, value) => {
    const id = String(country._id || country.slug || country.id);
    const useGlobalKey = `useGlobal${field.charAt(0).toUpperCase() + field.slice(1)}`;
    const globalKey = `global${field.charAt(0).toUpperCase() + field.slice(1)}`;
    const globalVal = globalDefaults[globalKey];
    const useGlobal = value === globalVal;

    setDirtyRows((prev) => {
      const row = { ...(prev[id] || {}) };
      row[field] = value;
      row[useGlobalKey] = useGlobal;
      if (useGlobal) {
        row[`_original_${field}`] = undefined;
      } else {
        row[`_original_${field}`] = country[field];
      }
      return { ...prev, [id]: row };
    });

    setSelectedIds((prev) => {
      if (!prev.includes(id)) return [...prev, id];
      return prev;
    });
  }, [globalDefaults]);

  const handleBulkApply = useCallback(() => {
    const fieldsWithValues = Object.entries(bulkValues).filter(([, v]) => v !== "" && v !== undefined && v !== null);
    if (fieldsWithValues.length === 0) {
      showToast("Set at least one field value before applying.", "error");
      return;
    }
    setDirtyRows((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        const country = findCountry(displayCountries, id);
        if (!country) return;
        const row = { ...(next[id] || {}) };
        fieldsWithValues.forEach(([field, value]) => {
          if (field === "customVisaTypes") {
            row.customVisaTypes = value;
            row.useCustomVisaTypes = Array.isArray(value) && value.length > 0;
            row._original_customVisaTypes = country.customVisaTypes;
          } else if (field === "optionalDocuments") {
            row.optionalDocuments = value;
            row._original_optionalDocuments = country.optionalDocuments;
          } else {
            const useGlobalKey = `useGlobal${field.charAt(0).toUpperCase() + field.slice(1)}`;
            const globalKey = `global${field.charAt(0).toUpperCase() + field.slice(1)}`;
            const globalVal = globalDefaults[globalKey];
            row[field] = value;
            row[useGlobalKey] = value === globalVal;
            row[`_original_${field}`] = country[field];
          }
        });
        next[id] = row;
      });
      return next;
    });
    setBulkValues({});
    showToast(`Applied to ${selectedIds.length} countries`, "success");
  }, [bulkValues, selectedIds, displayCountries, globalDefaults, showToast]);

  const handleSave = useCallback(async () => {
    const dirtyIds = Object.keys(dirtyRows);
    if (dirtyIds.length === 0) {
      showToast("No changes to save.", "info");
      return;
    }
    setSaving(true);
    let successCount = 0;
    let failCount = 0;
    const knownVisaTypeNames = new Set((visaTypes || []).map((vt) => vt.name.toLowerCase().trim()));

    for (const id of dirtyIds) {
      const country = findCountry(countries, id);
      if (!country) { failCount++; continue; }
      const changes = dirtyRows[id];
      const payload = {};

      for (const [key, value] of Object.entries(changes)) {
        if (key.startsWith("_original_")) continue;
        if (key === "customVisaTypes") {
          payload.customVisaTypes = (value || []).map((name) => ({ id: name, name, active: true }));
          payload.useCustomVisaTypes = value.length > 0;
          continue;
        }
        payload[key] = value;
      }

      if (payload.visaType && !knownVisaTypeNames.has(payload.visaType.toLowerCase().trim())) {
        try {
          await api.post("/visa-types", {
            name: payload.visaType,
            active: true,
            applyToAllActiveCountries: true,
            selectedCountries: [],
          });
        } catch { /* visa type may already exist */ }
      }

      try {
        const { data } = await api.put(`/admin/countries/${id}`, payload);
        if (data?.success) successCount++;
        else failCount++;
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      await fetchCountries();
      await loadData();
      setDirtyRows({});
      showToast(`${successCount} countr${successCount === 1 ? "y" : "ies"} updated.${failCount > 0 ? ` ${failCount} failed.` : ""}`, failCount > 0 ? "warning" : "success");
    } else {
      showToast("Failed to save changes.", "error");
    }
    setSaving(false);
  }, [dirtyRows, countries, fetchCountries, loadData, showToast, visaTypes]);

  const handleAddVisaType = useCallback(async (name, onAdded) => {
    try {
      const { data } = await api.post("/visa-types", {
        name,
        active: true,
        applyToAllActiveCountries: true,
        selectedCountries: [],
      });
      if (data?.success) {
        setVisaTypes((prev) => {
          const exists = prev.findIndex((vt) => String(vt?.name ?? "").trim().toLowerCase() === name.toLowerCase());
          if (exists >= 0) {
            const next = [...prev];
            next[exists] = data.visaType;
            return next;
          }
          return [data.visaType, ...prev];
        });
        onAdded();
        showToast(`"${name}" added to visa types`, "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to add visa type", "error");
    }
  }, [showToast]);

  const addToCatalog = useCallback((field, value) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed) return;
    setDynamicSuggestions((prev) => {
      const existing = prev[field] || [];
      if (existing.includes(trimmed)) return prev;
      return { ...prev, [field]: [...existing, trimmed] };
    });
  }, []);

  const handleDocumentAdded = useCallback((newCatalog) => {
    if (newCatalog) {
      setDocumentCatalog(newCatalog);
    } else {
      loadData();
    }
  }, [loadData]);

  const handleBatchActivate = useCallback(async (active) => {
    const list = Array.isArray(countries) ? countries : [];
    if (list.length === 0) {
      showToast("No countries to update.", "info");
      return;
    }
    setBatchActivating(true);
    let success = 0;
    let fail = 0;
    try {
      const results = await Promise.all(
        list.map(async (c) => {
          const id = String(c._id || c.slug || c.id);
          try {
            const { data } = await api.put(`/admin/countries/${id}`, { isActive: active });
            return data?.success ? true : false;
          } catch { return false; }
        })
      );
      success = results.filter(Boolean).length;
      fail = results.length - success;
      await fetchCountries();
      showToast(
        `${success} countr${success === 1 ? "y" : "ies"} ${active ? "activated" : "deactivated"}.${fail > 0 ? ` ${fail} failed.` : ""}`,
        fail > 0 ? "warning" : "success"
      );
    } catch {
      showToast("Batch update failed.", "error");
    } finally {
      setBatchActivating(false);
    }
  }, [countries, fetchCountries, showToast]);

  const handleRowSelect = useCallback((id) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
  }, []);

  const handleToggleActive = useCallback(async (country) => {
    const id = String(country._id || country.slug || country.id);
    const newActive = country.isActive === false;
    try {
      const { data } = await api.put(`/admin/countries/${id}`, { isActive: newActive });
      if (data?.success) {
        await fetchCountries();
      }
    } catch {
      showToast("Failed to update active status", "error");
    }
  }, [fetchCountries, showToast]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(allSelected ? [] : [...allIds]);
  }, [allSelected, allIds]);

  const handleCountryEditSave = useCallback(async (updated) => {
    const id = String(updated._id || updated.slug || updated.id);
    const country = findCountry(countries, id);
    if (!country) return;
    const changes = {};
    for (const key of Object.keys(updated)) {
      if (updated[key] !== country[key]) {
        changes[key] = updated[key];
      }
    }
    if (Object.keys(changes).length === 0) {
      showToast("No changes made.", "info");
      return;
    }
    try {
      if (changes.visaType) {
        const knownVisaTypeNames = new Set((visaTypes || []).map((vt) => vt.name.toLowerCase().trim()));
        if (!knownVisaTypeNames.has(changes.visaType.toLowerCase().trim())) {
          await api.post("/visa-types", {
            name: changes.visaType,
            active: true,
            applyToAllActiveCountries: true,
            selectedCountries: [],
          });
        }
      }
      const { data } = await api.put(`/admin/countries/${id}`, changes);
      if (data?.success) {
        await fetchCountries();
        await loadData();
        showToast(`${country.name || id} updated.`, "success");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to update country.", "error");
    }
    setEditingCountry(null);
  }, [countries, fetchCountries, loadData, showToast, visaTypes]);

  const allCountryValues = useMemo(() => {
    const vals = {};
    const fields = ["visaType", "entryType", "validity", "processingDays", "lengthOfStay"];
    for (const f of fields) {
      const set = new Set();
      if (Array.isArray(countries)) {
        for (const c of countries) {
          const useGlobalKey = `useGlobal${f.charAt(0).toUpperCase() + f.slice(1)}`;
          if (c[useGlobalKey] === false && c[f]) set.add(c[f]);
        }
      }
      for (const id of Object.keys(dirtyRows)) {
        if (dirtyRows[id][f]) set.add(dirtyRows[id][f]);
      }
      vals[f] = set;
    }
    return vals;
  }, [countries, dirtyRows]);

  const getFieldSuggestions = useCallback((field) => {
    const predefined = FIELD_SUGGESTIONS[field] || [];
    const fromCountries = allCountryValues[field] || new Set();
    const fromVisaTypes = field === "visaType" ? (visaTypes || []).filter((vt) => vt.active).map((vt) => vt.name) : [];
    const fromDynamic = dynamicSuggestions[field] || [];
    return [...new Set([...fromVisaTypes, ...predefined, ...fromCountries, ...fromDynamic])];
  }, [allCountryValues, visaTypes, dynamicSuggestions]);

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center p-10">
          <Loader2 className="w-8 h-8 text-cyan animate-spin" />
        </div>
      </Card>
    );
  }

  const renderCell = (country, field, editable = true) => {
    const id = String(country._id || country.slug || country.id);
    const draft = dirtyRows[id] || {};
    const draftVal = draft[field];
    const hasDraftVal = field in draft;
    const effective = hasDraftVal ? draftVal : resolveEffectiveValue(country, field, globalDefaults);
    const usingGlobal = hasDraftVal ? (draft[`useGlobal${field.charAt(0).toUpperCase() + field.slice(1)}`] !== false) : isUsingGlobal(country, field);
    const suggestions = getFieldSuggestions(field);

    return (
      <div className={`group relative ${hasDraftVal ? "ring-1 ring-cyan/40 rounded-lg" : ""}`}>
        {hasDraftVal && <span className="absolute -top-1.5 -right-1.5 w-2 h-2 rounded-full bg-cyan z-10" />}
        <InlineSelect
          value={effective}
          suggestions={suggestions}
          onChange={(val) => setCellValue(country, field, val)}
          allowCustom={true}
          onAddToCatalog={(val) => addToCatalog(field, val)}
          editable={editable}
        />
        {usingGlobal && (
          <div className="flex items-center gap-1 mt-0.5">
            <Globe size={8} className="text-text-muted" />
            <span className="text-[9px] text-text-muted truncate">global</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search countries..."
                className="w-full rounded-xl border border-border bg-background pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-cyan/20"
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={() => setShowActiveOnly(!showActiveOnly)}
                className="h-3.5 w-3.5 rounded border-border accent-cyan"
              />
              Active only
            </label>
            <button
              type="button"
              onClick={() => handleBatchActivate(true)}
              disabled={batchActivating}
              className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-2 py-1 rounded-md transition-colors disabled:opacity-50 shrink-0"
            >
              {batchActivating ? "..." : "Activate All"}
            </button>
            <button
              type="button"
              onClick={() => handleBatchActivate(false)}
              disabled={batchActivating}
              className="text-[10px] font-medium text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md transition-colors disabled:opacity-50 shrink-0"
            >
              {batchActivating ? "..." : "Deactivate All"}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleSelectAll}>
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasDirty || saving}
              loading={saving}
              leftIcon={<Save size={14} />}
            >
              Save Changes{hasDirty ? ` (${Object.keys(dirtyRows).length})` : ""}
            </Button>
          </div>
        </div>
      </Card>

      {/* Bulk Edit Panel */}
      {selectedIds.length > 0 && (
        <Card>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-text-primary">
                Selected Countries: <span className="text-cyan">{selectedIds.length}</span>
              </p>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-xs text-text-muted hover:text-red-400 transition-colors"
              >
                Clear selection
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              {["visaType", "entryType", "validity", "processingDays", "lengthOfStay"].map((field) => {
                const isCustomSelected = bulkCustomInputs[field];
                const suggestions = getFieldSuggestions(field);
                return (
                  <div key={field} className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">{FIELD_LABELS[field]}</span>
                    {isCustomSelected ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={bulkValues[field] || ""}
                          onChange={(e) => setBulkValues((prev) => ({ ...prev, [field]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && (bulkValues[field] || "").trim()) {
                              const val = bulkValues[field].trim();
                              addToCatalog(field, val);
                              setBulkCustomInputs((prev) => ({ ...prev, [field]: false }));
                            }
                          }}
                          placeholder="Type custom value..."
                          className="w-40 rounded-lg border border-cyan/60 bg-background px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-cyan/20"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const val = (bulkValues[field] || "").trim();
                            if (val) { addToCatalog(field, val); }
                            setBulkCustomInputs((prev) => ({ ...prev, [field]: false }));
                          }}
                          className="shrink-0 px-2 py-1.5 rounded-lg bg-cyan text-white text-xs font-medium hover:bg-cyan/90 transition-colors"
                        >
                          <Check size={12} />
                        </button>
                      </div>
                    ) : (
                      <select
                        value={bulkValues[field] || ""}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setBulkCustomInputs((prev) => ({ ...prev, [field]: true }));
                            setBulkValues((prev) => ({ ...prev, [field]: "" }));
                          } else {
                            setBulkValues((prev) => ({ ...prev, [field]: e.target.value }));
                          }
                        }}
                        className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-cyan/20"
                      >
                        <option value="">No change</option>
                        {suggestions.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                        <option value="__custom__">+ Add custom value</option>
                      </select>
                    )}
                  </div>
                );
              })}
              {/* Available Visa Types */}
              <div className="flex flex-col gap-1 min-w-[180px]">
                <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Available Visa Types</span>
                <VisaTypeMultiSelect
                  country={{}}
                  visaTypes={visaTypes}
                  dirtyRows={{}}
                  onSelect={(names) => setBulkValues((prev) => ({ ...prev, customVisaTypes: names }))}
                  onAddVisaType={handleAddVisaType}
                />
                {Array.isArray(bulkValues.customVisaTypes) && bulkValues.customVisaTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {bulkValues.customVisaTypes.map((name) => (
                      <span key={name} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple/10 text-[9px] font-medium text-purple truncate max-w-full">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              {/* Required Documents */}
              <div className="flex flex-col gap-1 min-w-[180px]">
                <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Required Documents</span>
                <DocMultiSelect
                  selectedKeys={bulkValues.requiredDocuments || []}
                  catalog={catalogOptions}
                  onChange={(keys) => setBulkValues((prev) => ({ ...prev, requiredDocuments: keys }))}
                  placeholder="Select docs"
                  onAddDocument={() => setShowAddDocumentModal(true)}
                  onEditDocument={(doc) => setEditingDoc(doc)}
                />
                {(bulkValues.requiredDocuments || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(bulkValues.requiredDocuments || []).map((key) => {
                      const doc = catalogOptions.find((d) => d.key === key);
                      return (
                        <span key={key} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-cyan/10 text-[9px] font-medium text-cyan truncate max-w-full">
                          {doc?.label || key}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Optional Documents */}
              <div className="flex flex-col gap-1 min-w-[180px]">
                <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Optional Documents</span>
                <DocMultiSelect
                  selectedKeys={bulkValues.optionalDocuments || []}
                  catalog={catalogOptions}
                  onChange={(keys) => setBulkValues((prev) => ({ ...prev, optionalDocuments: keys }))}
                  placeholder="Select docs"
                  onAddDocument={() => setShowAddDocumentModal(true)}
                  onEditDocument={(doc) => setEditingDoc(doc)}
                />
                {(bulkValues.optionalDocuments || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(bulkValues.optionalDocuments || []).map((key) => {
                      const doc = catalogOptions.find((d) => d.key === key);
                      return (
                        <span key={key} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber/10 text-[9px] font-medium text-amber truncate max-w-full">
                          {doc?.label || key}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <Button variant="primary" size="sm" onClick={handleBulkApply}>
                Apply to Selected
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-white shadow-sm">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-surface-2 border-b border-border">
              <th className="py-3 px-3 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="h-4 w-4 rounded border-border accent-cyan"
                />
              </th>
              <th className="py-3 px-2 w-14 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Edit</th>
              <th className="py-3 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Country</th>
              <th className="py-3 px-2 w-16 text-[10px] font-semibold text-text-muted uppercase tracking-wider text-center">Active</th>
              <th className="py-3 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Default Visa Type</th>
              <th className="py-3 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Available Visa Types</th>
              <th className="py-3 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Validity</th>
              <th className="py-3 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Processing Days</th>
              <th className="py-3 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Length of Stay</th>
              <th className="py-3 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Entry</th>
              <th className="py-3 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Required Docs</th>
              <th className="py-3 px-3 text-[10px] font-semibold text-text-muted uppercase tracking-wider">Optional Docs</th>
            </tr>
            <tr className="bg-surface-3 border-b border-border">
              <th className="py-2 px-3"></th>
              <th className="py-2 px-2"></th>
              <th className="py-2 px-3"></th>
              <th className="py-2 px-2"></th>
              <th className="py-2 px-3"><input type="text" placeholder="Filter..." value={columnFilters.visaType} onChange={e => setColumnFilters(p => ({...p, visaType: e.target.value}))} className="w-full text-xs rounded border border-border bg-white px-2 py-1 focus:outline-none focus:border-cyan/50" /></th>
              <th className="py-2 px-3"><input type="text" placeholder="Filter..." value={columnFilters.customVisaTypes} onChange={e => setColumnFilters(p => ({...p, customVisaTypes: e.target.value}))} className="w-full text-xs rounded border border-border bg-white px-2 py-1 focus:outline-none focus:border-cyan/50" /></th>
              <th className="py-2 px-3"><input type="text" placeholder="Filter..." value={columnFilters.validity} onChange={e => setColumnFilters(p => ({...p, validity: e.target.value}))} className="w-full text-xs rounded border border-border bg-white px-2 py-1 focus:outline-none focus:border-cyan/50" /></th>
              <th className="py-2 px-3"><input type="text" placeholder="Filter..." value={columnFilters.processingDays} onChange={e => setColumnFilters(p => ({...p, processingDays: e.target.value}))} className="w-full text-xs rounded border border-border bg-white px-2 py-1 focus:outline-none focus:border-cyan/50" /></th>
              <th className="py-2 px-3"><input type="text" placeholder="Filter..." value={columnFilters.lengthOfStay} onChange={e => setColumnFilters(p => ({...p, lengthOfStay: e.target.value}))} className="w-full text-xs rounded border border-border bg-white px-2 py-1 focus:outline-none focus:border-cyan/50" /></th>
              <th className="py-2 px-3"><input type="text" placeholder="Filter..." value={columnFilters.entryType} onChange={e => setColumnFilters(p => ({...p, entryType: e.target.value}))} className="w-full text-xs rounded border border-border bg-white px-2 py-1 focus:outline-none focus:border-cyan/50" /></th>
              <th className="py-2 px-3"><input type="text" placeholder="Filter..." value={columnFilters.requiredDocuments} onChange={e => setColumnFilters(p => ({...p, requiredDocuments: e.target.value}))} className="w-full text-xs rounded border border-border bg-white px-2 py-1 focus:outline-none focus:border-cyan/50" /></th>
              <th className="py-2 px-3"><input type="text" placeholder="Filter..." value={columnFilters.optionalDocuments} onChange={e => setColumnFilters(p => ({...p, optionalDocuments: e.target.value}))} className="w-full text-xs rounded border border-border bg-white px-2 py-1 focus:outline-none focus:border-cyan/50" /></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {displayCountries.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-10 text-center text-text-muted text-sm">
                  {searchQuery ? "No countries match your search." : "No countries found."}
                </td>
              </tr>
            ) : (
              displayCountries.map((country) => {
                const id = String(country._id || country.slug || country.id);
                const checked = selectedIds.includes(id);
                const hasChanges = id in dirtyRows;

                return (
                  <tr key={id} className={`hover:bg-surface-2/50 transition-colors ${hasChanges ? "bg-cyan/5" : ""}`}>
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleRowSelect(id)}
                        className="h-4 w-4 rounded border-border accent-cyan"
                      />
                    </td>
                    <td className="py-2.5 px-2">
                      {checked && (
                        <button
                          type="button"
                          onClick={() => setEditingCountry(country)}
                          className="p-1.5 rounded-lg text-cyan hover:bg-cyan/10 transition-colors"
                          title={`Edit ${country.name || id}`}
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{country.name || country.slug}</p>
                        <p className="text-[10px] text-text-muted">{country.slug || id}</p>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={country.isActive !== false}
                          onChange={() => handleToggleActive(country)}
                          className="sr-only"
                        />
                        <span
                          className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors duration-200 ${
                            country.isActive !== false ? "bg-emerald-500" : "bg-border"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                              country.isActive !== false ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </span>
                      </label>
                    </td>
                    <td className="py-2.5 px-3">{renderCell(country, "visaType", checked)}</td>
                    <td className="py-2.5 px-3">
                      <div className="min-w-[180px]">
                        <VisaTypeMultiSelect
                          country={country}
                          visaTypes={visaTypes}
                          dirtyRows={dirtyRows}
                          onSelect={(selectedNames) => setCellValue(country, "customVisaTypes", selectedNames)}
                          onAddVisaType={handleAddVisaType}
                          disabled={!checked}
                        />
                        {(() => {
                          const draft = dirtyRows[id] || {};
                          let selectedVisaNames;
                          if ("customVisaTypes" in draft) {
                            selectedVisaNames = draft.customVisaTypes || [];
                          } else if (Array.isArray(country.customVisaTypes)) {
                            selectedVisaNames = country.customVisaTypes.filter((vt) => vt.active !== false).map((vt) => vt.name);
                          } else {
                            selectedVisaNames = [];
                          }
                          return selectedVisaNames.length > 0 ? (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {selectedVisaNames.map((name) => (
                                <span key={name} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-purple/10 text-[9px] font-medium text-purple truncate max-w-full">
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : null;
                        })()}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">{renderCell(country, "validity", checked)}</td>
                    <td className="py-2.5 px-3">{renderCell(country, "processingDays", checked)}</td>
                    <td className="py-2.5 px-3">{renderCell(country, "lengthOfStay", checked)}</td>
                    <td className="py-2.5 px-3">{renderCell(country, "entryType", checked)}</td>
                    <td className="py-2.5 px-3">
                      <div className="min-w-[140px]">
                        {(() => {
                          const draft = dirtyRows[id] || {};
                          const reqDocs = "requiredDocuments" in draft ? draft.requiredDocuments : (country.requiredDocuments || []);
                          return (
                            <>
                              <DocMultiSelect
                                selectedKeys={reqDocs}
                                catalog={catalogOptions}
                                onChange={(keys) => setCellValue(country, "requiredDocuments", keys)}
                                placeholder="Select docs"
                                onAddDocument={() => setShowAddDocumentModal(true)}
                                onEditDocument={(doc) => setEditingDoc(doc)}
                                disabled={!checked}
                              />
                              {reqDocs.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {reqDocs.map((key) => {
                                    const doc = catalogOptions.find((d) => d.key === key);
                                    return (
                                      <span key={key} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-cyan/10 text-[9px] font-medium text-cyan truncate max-w-full">
                                        {doc?.label || key}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                              {isUsingGlobal(country, "requiredDocuments") && !("requiredDocuments" in draft) && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Globe size={8} className="text-text-muted" />
                                  <span className="text-[9px] text-text-muted">global</span>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="min-w-[140px]">
                        {(() => {
                          const draft = dirtyRows[id] || {};
                          const optDocs = "optionalDocuments" in draft ? draft.optionalDocuments : (country.optionalDocuments || []);
                          return (
                            <>
                              <DocMultiSelect
                                selectedKeys={optDocs}
                                catalog={catalogOptions}
                                onChange={(keys) => setCellValue(country, "optionalDocuments", keys)}
                                placeholder="Select docs"
                                onAddDocument={() => setShowAddDocumentModal(true)}
                                onEditDocument={(doc) => setEditingDoc(doc)}
                                disabled={!checked}
                              />
                              {optDocs.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {optDocs.map((key) => {
                                    const doc = catalogOptions.find((d) => d.key === key);
                                    return (
                                      <span key={key} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber/10 text-[9px] font-medium text-amber truncate max-w-full">
                                        {doc?.label || key}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-text-muted text-center">
        {displayCountries.length} countr{displayCountries.length === 1 ? "y" : "ies"} shown
        {hasDirty && ` · ${Object.keys(dirtyRows).length} countr${Object.keys(dirtyRows).length === 1 ? "y" : "ies"} with unsaved changes`}
      </p>

      {/* Single Country Edit Modal */}
      {editingCountry && (
        <CountryEditModal
          country={editingCountry}
          catalog={catalogOptions}
          globalDefaults={globalDefaults}
          visaTypes={visaTypes}
          allCountryValues={allCountryValues}
          onClose={() => setEditingCountry(null)}
          onSave={handleCountryEditSave}
          onAddVisaType={handleAddVisaType}
        />
      )}

      {/* Add / Edit Document Modal */}
      <DocumentEditModal
        isOpen={showAddDocumentModal || !!editingDoc}
        onClose={() => { setShowAddDocumentModal(false); setEditingDoc(null); }}
        editDoc={editingDoc}
        onDocumentAdded={handleDocumentAdded}
      />
    </div>
  );
};

export default VisaDetailsTable;
