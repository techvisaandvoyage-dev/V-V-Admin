import { useEffect, useState } from "react";
import { PencilLine, Plus, Trash2 } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input from "../ui/Input";
import { api } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";

const DEFAULT_FOOTER_SECTIONS = [
  { value: "company", label: "Company" },
  { value: "services", label: "Services" },
  { value: "support", label: "Support" },
  { value: "legal", label: "Legal" },
];

function FooterSectionsManager() {
  const { showToast } = useUIStore();
  const [footerSections, setFooterSections] = useState([]);
  const [footerSectionsLoading, setFooterSectionsLoading] = useState(false);
  const [footerSectionsSaving, setFooterSectionsSaving] = useState(false);
  const [footerSectionInputs, setFooterSectionInputs] = useState([
    { key: "", label: "" },
  ]);

  const loadFooterSections = async () => {
    setFooterSectionsLoading(true);
    try {
      const { data } = await api.get("/admin/footer-sections");
      if (data.success && data.data?.length > 0) {
        setFooterSections(
          data.data.map((s) => ({ value: s.key, label: s.label }))
        );
        setFooterSectionInputs(
          data.data.map((s) => ({ key: s.key, label: s.label }))
        );
      } else {
        setFooterSections(DEFAULT_FOOTER_SECTIONS);
        setFooterSectionInputs([
          { key: "", label: "" },
        ]);
      }
    } catch {
      setFooterSections(DEFAULT_FOOTER_SECTIONS);
      setFooterSectionInputs([{ key: "", label: "" }]);
    } finally {
      setFooterSectionsLoading(false);
    }
  };

  const saveFooterSections = async () => {
    const valid = footerSectionInputs.filter(
      (s) => s.key.trim() && s.label.trim()
    );
    if (valid.length < 1) {
      showToast("At least one section with a key and label is required.", "error");
      return;
    }
    setFooterSectionsSaving(true);
    try {
      const payload = valid.map((s) => ({ key: s.key.trim(), label: s.label.trim() }));
      const { data } = await api.put("/admin/footer-sections", {
        sections: payload,
      });
      if (data.success) {
        showToast("Footer sections saved.", "success");
        setFooterSections(
          data.data.map((s) => ({ value: s.key, label: s.label }))
        );
        setFooterSectionInputs(
          data.data.map((s) => ({ key: s.key, label: s.label }))
        );
      } else {
        showToast(data.message || "Failed to save.", "error");
      }
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Failed to save footer sections.",
        "error"
      );
    } finally {
      setFooterSectionsSaving(false);
    }
  };

  useEffect(() => {
    loadFooterSections();
  }, []);

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Footer Sections</h3>
          <p className="text-xs text-text-muted mt-1">
            Define the sections (columns) shown in the footer. Each section groups static pages together.
          </p>
        </div>
      </div>

      {footerSectionsLoading ? (
        <div className="rounded-2xl border border-border bg-surface-2/40 px-4 py-10 text-center text-sm text-text-muted">
          Loading footer sections...
        </div>
      ) : (
        <div className="space-y-3">
          {footerSectionInputs.map((section, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[140px]">
                <Input
                  label="Key"
                  value={section.key}
                  onChange={(e) => {
                    const next = [...footerSectionInputs];
                    next[idx] = { ...next[idx], key: e.target.value };
                    setFooterSectionInputs(next);
                  }}
                  placeholder="e.g. company"
                />
              </div>
              <div className="flex-1 min-w-[140px]">
                <Input
                  label="Label"
                  value={section.label}
                  onChange={(e) => {
                    const next = [...footerSectionInputs];
                    next[idx] = { ...next[idx], label: e.target.value };
                    setFooterSectionInputs(next);
                  }}
                  placeholder="e.g. Company"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<Trash2 size={14} />}
                onClick={() => {
                  if (footerSectionInputs.length <= 1) return;
                  setFooterSectionInputs((prev) => prev.filter((_, i) => i !== idx));
                }}
                disabled={footerSectionInputs.length <= 1}
                className="mb-0.5"
              />
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus size={15} />}
            onClick={() => setFooterSectionInputs((prev) => [...prev, { key: "", label: "" }])}
          >
            Add Section
          </Button>
          <div className="mt-4">
            <Button
              variant="primary"
              size="sm"
              loading={footerSectionsSaving}
              onClick={saveFooterSections}
            >
              Save Footer Sections
            </Button>
          </div>
        </div>
      )}

      <hr className="my-8 border-border" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-4">
          Saved Sections
        </p>
        {footerSections.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface-2/20 px-4 py-8 text-center">
            <p className="text-sm text-text-muted">No saved sections yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {footerSections.map((section) => (
              <div
                key={section.value}
                className="flex items-center justify-between rounded-xl border border-border bg-surface-2/40 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-mono text-text-muted bg-surface-3 px-2 py-0.5 rounded">
                    {section.value}
                  </span>
                  <span className="text-sm font-medium text-text-primary truncate">
                    {section.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setFooterSectionInputs([{ key: section.value, label: section.label }]);
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-secondary transition-colors hover:border-cyan/40 hover:text-text-primary"
                    title="Edit section"
                  >
                    <PencilLine size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const remaining = footerSections.filter((s) => s.value !== section.value);
                      if (remaining.length < 1) {
                        showToast("At least one section is required.", "error");
                        return;
                      }
                      setFooterSectionsSaving(true);
                      try {
                        const payload = remaining.map((s) => ({ key: s.value, label: s.label }));
                        const { data } = await api.put("/admin/footer-sections", { sections: payload });
                        if (data.success) {
                          showToast("Section deleted.", "success");
                          setFooterSections(data.data.map((s) => ({ value: s.key, label: s.label })));
                          setFooterSectionInputs(data.data.map((s) => ({ key: s.key, label: s.label })));
                        } else {
                          showToast(data.message || "Failed to delete.", "error");
                        }
                      } catch (err) {
                        showToast(err?.response?.data?.message || "Failed to delete section.", "error");
                      } finally {
                        setFooterSectionsSaving(false);
                      }
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20"
                    title="Delete section"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export default FooterSectionsManager;
