import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  FilePlus2,
  Globe,
  PencilLine,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Monitor,
  Smartphone,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input, { Select, Textarea } from "../ui/Input";
import Modal from "../ui/Modal";
import RichTextEditor from "./RichTextEditor";
import { api, SERVER_URL } from "../../store/authStore";
import { useDataStore } from "../../store/dataStore";
import { useUIStore } from "../../store/uiStore";
import { fmtDate } from "../../utils/formatDate";

const PAGE_TYPE_OPTIONS = [
  { value: "general", label: "General" },
  { value: "blog", label: "Blog" },
  { value: "faq", label: "FAQ" },
  { value: "legal", label: "Legal" },
  { value: "visa-info", label: "Visa Information" },
];

const DEFAULT_FOOTER_SECTIONS = [
  { value: 'Company', label: 'Company' },
  { value: 'Services', label: 'Services' },
  { value: 'Support', label: 'Support' },
  { value: 'Legal', label: 'Legal' },
];

const getOptionLabel = (options, value, fallback = "N/A") =>
  options.find((option) => option.value === value)?.label || fallback;

const createEmptyPage = () => ({
  title: "",
  slug: "",
  summary: "",
  content: "<h2>Page title</h2><p>Start writing your page content here.</p>",
  template: "general",
  footerSection: "Company",
  status: "draft",
  featuredImage: "",
  seo: {
    metaTitle: "",
    metaDescription: "",
    keywords: "",
    canonicalUrl: "",
    openGraphImage: "",
  },
});

const slugify = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);

const formatDate = (value) => {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return fmtDate(date);
};

const statusBadgeClass = {
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  draft: "bg-amber-500/10 text-amber-300 border-amber-500/20",
};

const StaticPagesManager = () => {
  const { pages, pagesPagination, fetchPages, createPage, updatePage, deletePage, togglePageStatus } = useDataStore();
  const { showToast } = useUIStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [previewViewport, setPreviewViewport] = useState("desktop");
  const [previewTheme, setPreviewTheme] = useState("light");
  const [editorMode, setEditorMode] = useState("create");
  const [slugTouched, setSlugTouched] = useState(false);
  const [pageForm, setPageForm] = useState(createEmptyPage());
  const [footerSections, setFooterSections] = useState(DEFAULT_FOOTER_SECTIONS);

  const footerSectionOptions = useMemo(
    () => footerSections.map((s) => ({ value: s.value, label: s.label })),
    [footerSections]
  );

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get("/admin/footer-sections");
        if (data?.success && Array.isArray(data.data)) {
          setFooterSections(data.data.map((s) => ({ value: s.key, label: s.label })));
        }
      } catch {
        // keep defaults
      }
    };
    load();
  }, []);

  const loadPages = async (
    page = currentPage,
    search = searchQuery,
    status = statusFilter,
    template = templateFilter,
    footerSection = sectionFilter
  ) => {
    setLoading(true);
    await fetchPages({
      page,
      limit: 8,
      search: search || undefined,
      status: status !== "all" ? status : undefined,
      template: template !== "all" ? template : undefined,
      footerSection: footerSection !== "all" ? footerSection : undefined,
    });
    setLoading(false);
  };

  useEffect(() => {
    loadPages(currentPage, searchQuery, statusFilter, templateFilter, sectionFilter);
  }, [currentPage, statusFilter, templateFilter, sectionFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentPage(1);
      loadPages(1, searchQuery, statusFilter, templateFilter, sectionFilter);
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchQuery]);

  const openCreateModal = () => {
    setPageForm(createEmptyPage());
    setEditorMode("create");
    setSlugTouched(false);
    setPreviewViewport("desktop");
    setPreviewTheme("light");
    setEditorOpen(true);
  };

  const openEditModal = (page) => {
    setPageForm({
      title: page.title || "",
      slug: page.slug || "",
      summary: page.summary || "",
      content: page.content || "",
      template: page.template || "general",
      footerSection: page.footerSection || "company",
      status: page.status || "draft",
      featuredImage: page.featuredImage || "",
      seo: {
        metaTitle: page.seo?.metaTitle || "",
        metaDescription: page.seo?.metaDescription || "",
        keywords: Array.isArray(page.seo?.keywords) ? page.seo.keywords.join(", ") : "",
        canonicalUrl: page.seo?.canonicalUrl || "",
        openGraphImage: page.seo?.openGraphImage || "",
      },
      _id: page._id,
    });
    setEditorMode("edit");
    setSlugTouched(true);
    setPreviewViewport("desktop");
    setPreviewTheme("light");
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setPageForm(createEmptyPage());
    setSlugTouched(false);
  };

  const handleFieldChange = (key, value) => {
    setPageForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "title" && !slugTouched) {
        next.slug = slugify(value);
      }
      return next;
    });
  };

  const handleSeoChange = (key, value) => {
    setPageForm((prev) => ({
      ...prev,
      seo: { ...prev.seo, [key]: value },
    }));
  };

  const handleUploadImage = async (file) => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const { data } = await api.post("/admin/pages/upload-image", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data.success) {
        return `${SERVER_URL}${data.url}`;
      }
      showToast("Could not upload image.", "error");
      return "";
    } catch (error) {
      showToast(error.response?.data?.message || "Could not upload image.", "error");
      return "";
    }
  };

  const handleSave = async () => {
    if (!pageForm.title.trim() || !pageForm.slug.trim() || !pageForm.content.trim()) {
      showToast("Title, slug, and content are required.", "error");
      return;
    }

    setSaving(true);
    const payload = {
      ...pageForm,
      slug: slugify(pageForm.slug),
      seo: {
        ...pageForm.seo,
        keywords: pageForm.seo.keywords,
      },
    };

    const result = editorMode === "create"
      ? await createPage(payload)
      : await updatePage(pageForm._id, payload);

    setSaving(false);

    if (!result?.success) {
      showToast(result?.message || "Could not save page.", "error");
      return;
    }

    showToast(editorMode === "create" ? "Page created." : "Page updated.", "success");
    closeEditor();
    loadPages(currentPage, searchQuery, statusFilter, templateFilter, sectionFilter);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const result = await deletePage(deleteTarget._id);
    if (!result?.success) {
      showToast(result?.message || "Could not delete page.", "error");
      return;
    }
    showToast("Page deleted.", "success");
    setDeleteTarget(null);
    loadPages(currentPage, searchQuery, statusFilter, templateFilter, sectionFilter);
  };

  const handleToggleStatus = async (page) => {
    const result = await togglePageStatus(page._id);
    if (!result?.success) {
      showToast(result?.message || "Could not update page status.", "error");
      return;
    }
    showToast(result.page.status === "published" ? "Page published." : "Page moved to draft.", "success");
  };

  const previewDocument = useMemo(() => {
    const title = pageForm.seo.metaTitle || pageForm.title || "Untitled Page";
    const description = pageForm.seo.metaDescription || pageForm.summary || "Static page preview";

    return `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>${title}</title>
          <style>
            body { margin:0; font-family: ui-sans-serif, system-ui; background:${previewTheme === "dark" ? "#08121b" : "#f7faf9"}; color:${previewTheme === "dark" ? "#f5f8f6" : "#12212a"}; }
            main { max-width: 860px; margin: 0 auto; padding: 48px 24px 80px; }
            .eyebrow { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color:${previewTheme === "dark" ? "#73d8c8" : "#0f766e"}; margin-bottom: 12px; }
            h1 { font-size: clamp(2rem, 5vw, 3.75rem); margin: 0 0 12px; line-height: 1.05; }
            .summary { color:${previewTheme === "dark" ? "#9fb2b7" : "#52626b"}; font-size: 1rem; line-height:1.7; margin-bottom: 32px; }
            article { background:${previewTheme === "dark" ? "rgba(10, 25, 34, .8)" : "rgba(255,255,255,.86)"}; border:1px solid ${previewTheme === "dark" ? "rgba(115,216,200,.16)" : "rgba(15,118,110,.12)"}; border-radius: 24px; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,.08); }
            article h2 { font-size: 2rem; margin: 28px 0 10px; }
            article h3 { font-size: 1.35rem; margin: 24px 0 8px; }
            article p, article li, article td, article th { font-size: 1rem; line-height: 1.8; color:${previewTheme === "dark" ? "#dce7e5" : "#243740"}; }
            article a { color:${previewTheme === "dark" ? "#73d8c8" : "#0f766e"}; }
            article img { max-width:100%; height:auto; border-radius:18px; }
            article table { width:100%; border-collapse:collapse; margin:18px 0; }
            article th, article td { border:1px solid ${previewTheme === "dark" ? "rgba(115,216,200,.18)" : "#d5dfe3"}; padding:10px; text-align:left; }
            .seo { display:grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap:12px; margin-bottom:24px; }
            .seo-card { padding:14px 16px; border-radius:16px; background:${previewTheme === "dark" ? "rgba(115,216,200,.08)" : "rgba(15,118,110,.05)"}; border:1px solid ${previewTheme === "dark" ? "rgba(115,216,200,.16)" : "rgba(15,118,110,.12)"}; }
            .seo-card span { display:block; font-size:12px; text-transform:uppercase; letter-spacing:.08em; color:${previewTheme === "dark" ? "#73d8c8" : "#0f766e"}; margin-bottom:6px; }
            @media (max-width: 720px) { .seo { grid-template-columns: 1fr; } main { padding: 28px 16px 48px; } article { padding: 20px; } }
          </style>
        </head>
        <body>
          <main>
            <div class="eyebrow">${getOptionLabel(footerSectionOptions, pageForm.footerSection, "")}</div>
            <article>${pageForm.content || "<p>Start writing content.</p>"}</article>
          </main>
        </body>
      </html>`;
  }, [pageForm, previewTheme]);

  const [showAddSection, setShowAddSection] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingSectionValue, setEditingSectionValue] = useState(null);

  const addFooterSection = async () => {
    const label = newLabel.trim();
    if (!label) { showToast("Label required.", "error"); return; }
    const key = label;
    setAdding(true);
    try {
      const current = footerSections.map((s) => ({ key: s.value, label: s.label }));
      if (editingSectionValue) {
        const updated = current.map((s) =>
          s.key === editingSectionValue ? { key, label } : s
        );
        const { data } = await api.put("/admin/footer-sections", { sections: updated });
        if (data.success) {
          showToast("Section updated.", "success");
        } else { showToast(data.message || "Failed.", "error"); setAdding(false); return; }
      } else {
        const { data } = await api.put("/admin/footer-sections", { sections: [...current, { key, label }] });
        if (data.success) {
          showToast("Section added.", "success");
        } else { showToast(data.message || "Failed.", "error"); setAdding(false); return; }
      }
      setShowAddSection(false);
      setNewLabel("");
      setEditingSectionValue(null);
      const { data: refreshed } = await api.get("/admin/footer-sections");
      if (refreshed?.success && Array.isArray(refreshed.data)) {
        setFooterSections(refreshed.data.map((s) => ({ value: s.key, label: s.label })));
      }
      handleFieldChange("footerSection", key);
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed.", "error");
    } finally {
      setAdding(false);
    }
  };

  const deleteFooterSection = async (value) => {
    const remaining = footerSections.filter((s) => s.value !== value);
    try {
      const payload = remaining.map((s) => ({ key: s.value, label: s.label }));
      const { data } = await api.put("/admin/footer-sections", { sections: payload });
      if (data.success) {
        showToast("Section deleted.", "success");
        const { data: refreshed } = await api.get("/admin/footer-sections");
        if (refreshed?.success && Array.isArray(refreshed.data)) {
          setFooterSections(refreshed.data.map((s) => ({ value: s.key, label: s.label })));
        }
        if (pageForm.footerSection === value) handleFieldChange("footerSection", remaining[0]?.value || "");
      } else showToast(data.message || "Failed.", "error");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed.", "error");
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <Card className="overflow-hidden">
          <div className="mt-5 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">Content CMS</p>
              <h2 className="mt-2 text-2xl font-bold text-text-primary">Static Pages</h2>
              <p className="mt-2 max-w-2xl text-sm text-text-secondary">
                Create, preview, publish, and place pages under the frontend footer headings.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" size="sm" leftIcon={<FilePlus2 size={15} />} onClick={() => openCreateModal()}>
                Create Page
              </Button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[1.4fr,0.75fr,0.75fr,0.75fr]">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-4 py-3">
              <Search size={16} className="text-text-muted" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search pages by title, slug, or summary"
                className="w-full bg-transparent text-sm text-text-primary outline-none placeholder:text-text-muted"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              options={[
                { value: "all", label: "All statuses" },
                { value: "published", label: "Published" },
                { value: "draft", label: "Draft" },
              ]}
            />

            <Select
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              options={[
                  { value: "all", label: "All sections" },
                  ...footerSectionOptions,
                ]}
            />
          </div>
        </Card>

        <Card>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-text-primary">Pages Library</h3>
                <p className="text-xs text-text-muted mt-1">Published and draft content with live website slugs.</p>
              </div>
              <div className="text-xs text-text-muted">
                {pagesPagination.total} total pages
              </div>
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="animate-pulse rounded-2xl border border-border bg-surface-2 p-4">
                    <div className="h-4 w-1/3 rounded bg-surface-3" />
                    <div className="mt-3 h-3 w-2/3 rounded bg-surface-3" />
                    <div className="mt-4 h-10 rounded bg-surface-3" />
                  </div>
                ))}
              </div>
            ) : pages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-surface-2 px-6 py-12 text-center">
                <Globe size={28} className="mx-auto text-text-muted" />
                <p className="mt-3 text-lg font-semibold text-text-primary">No static pages found</p>
                <p className="mt-2 text-sm text-text-muted">Create a page and choose the footer heading where it should appear.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-left">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-[0.14em] text-text-muted">
                      <th className="pb-3 font-medium">Page</th>
                      <th className="pb-3 font-medium">Footer</th>

                      <th className="pb-3 font-medium">Status</th>
                      <th className="pb-3 font-medium">SEO</th>
                      <th className="pb-3 font-medium">Updated</th>
                      <th className="pb-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {pages.map((page) => (
                      <tr key={page._id} className="align-top">
                        <td className="py-4 pr-4">
                          <p className="font-semibold text-text-primary">{page.title}</p>
                          <p className="mt-1 text-xs text-cyan">/page/{page.slug}</p>
                          <p className="mt-2 max-w-md text-sm text-text-secondary line-clamp-2">
                            {page.summary || "No summary yet."}
                          </p>
                        </td>
                        <td className="py-4 pr-4 text-sm text-text-secondary">
                          {getOptionLabel(footerSectionOptions, page.footerSection, "")}
                        </td>

                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass[page.status] || statusBadgeClass.draft}`}>
                              {page.status === "published" ? "Published" : "Draft"}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(page)}
                              className={`relative h-7 w-12 rounded-full transition-colors ${page.status === "published" ? "bg-emerald-500/70" : "bg-zinc-600/40"}`}
                              aria-label={`Toggle ${page.title} status`}
                            >
                              <span
                                className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${page.status === "published" ? "left-6" : "left-1"}`}
                              />
                            </button>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-sm text-text-secondary">
                          <p>{page.seo?.metaTitle ? "Meta ready" : "Needs SEO"}</p>
                          <p className="mt-1 text-xs text-text-muted">
                            {page.seo?.keywords?.length || 0} keywords
                          </p>
                        </td>
                        <td className="py-4 pr-4 text-sm text-text-secondary">
                          <p>{formatDate(page.updatedAt)}</p>
                          <p className="mt-1 text-xs text-text-muted">Created {formatDate(page.createdAt)}</p>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openEditModal(page)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-secondary transition-colors hover:border-cyan/40 hover:text-text-primary"
                              title="Edit page"
                            >
                              <PencilLine size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(page)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20"
                              title="Delete page"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-border pt-5">
              <p className="text-xs text-text-muted">
                Page {pagesPagination.page} of {pagesPagination.totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ChevronLeft size={14} />}
                  disabled={pagesPagination.page <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  Prev
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  rightIcon={<ChevronRight size={14} />}
                  disabled={pagesPagination.page >= pagesPagination.totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(pagesPagination.totalPages, prev + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </Card>

      </motion.div>

      <Modal
        isOpen={editorOpen}
        onClose={closeEditor}
        title={editorMode === "create" ? "Create Static Page" : "Edit Static Page"}
        size="full"
        footer={
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-text-muted">
              Live preview updates as you edit.
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={closeEditor}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : editorMode === "create" ? "Create Page" : "Save Changes"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid h-full min-h-[calc(100vh-10.5rem)] gap-6 xl:grid-cols-2">
          <div className="min-h-0 space-y-5 overflow-y-auto pr-2">
            <div className="flex flex-wrap items-start gap-3">
              <div className="w-full max-w-xs space-y-2">
                <Select
                  label="Footer Section"
                  value={pageForm.footerSection}
                  onChange={(e) => {
                    if (e.target.value === "__add__") { setShowAddSection(true); return; }
                    handleFieldChange("footerSection", e.target.value);
                  }}
                  options={[...footerSectionOptions, { value: "__add__", label: "+ Add custom section" }]}
                />
                {showAddSection && (
                  <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2/40 p-3">
                    <Input label="Label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Resources" />
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="primary" size="sm" loading={adding} onClick={addFooterSection}>{editingSectionValue ? "Save" : "Add"}</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => { setShowAddSection(false); setNewLabel(""); setEditingSectionValue(null); }}>Cancel</Button>
                    </div>
                  </div>
                )}
                {footerSections.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {footerSections.map((s) => (
                      <div key={s.value} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface-2/60 px-2 py-1 text-xs">
                        <span className="text-text-primary font-medium">{s.label}</span>
                        <button type="button" onClick={() => { setShowAddSection(true); setNewLabel(s.label); setEditingSectionValue(s.value); }} className="text-text-muted hover:text-cyan transition-colors" title="Edit"><PencilLine size={12} /></button>
                        <button type="button" onClick={() => deleteFooterSection(s.value)} className="text-text-muted hover:text-red-400 transition-colors" title="Delete"><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input
                label="Page Title"
                value={pageForm.title}
                onChange={(event) => handleFieldChange("title", event.target.value)}
                placeholder="About Us"
              />
              <Input
                label="Page Name"
                value={pageForm.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  handleFieldChange("slug", slugify(event.target.value));
                }}
                placeholder="about-us"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Select
                label="Status"
                value={pageForm.status}
                onChange={(event) => handleFieldChange("status", event.target.value)}
                options={[
                  { value: "draft", label: "Draft" },
                  { value: "published", label: "Published" },
                ]}
              />
              <Input
                label="Public URL"
                value={`/page/${pageForm.slug || "page-slug"}`}
                disabled
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-text-secondary">Page Content</label>
                <p className="text-xs text-text-muted">Tables, links, headings, and images are supported.</p>
              </div>
              <RichTextEditor
                value={pageForm.content}
                onChange={(content) => handleFieldChange("content", content)}
                onUploadImage={handleUploadImage}
              />
            </div>

            <Card className="space-y-4 bg-surface-2">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-cyan" />
                <h3 className="font-semibold text-text-primary">Page SEO</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Meta Title"
                  value={pageForm.seo.metaTitle}
                  onChange={(event) => handleSeoChange("metaTitle", event.target.value)}
                  placeholder="About Us | Visa & Voyage"
                />
                <Input
                  label="Canonical URL"
                  value={pageForm.seo.canonicalUrl}
                  onChange={(event) => handleSeoChange("canonicalUrl", event.target.value)}
                  placeholder="https://example.com/page/about-us"
                />
              </div>
              <Textarea
                label="Meta Description"
                rows={3}
                value={pageForm.seo.metaDescription}
                onChange={(event) => handleSeoChange("metaDescription", event.target.value)}
                placeholder="Short SEO summary for search engines and social shares."
              />
              <Input
                label="Keywords"
                value={pageForm.seo.keywords}
                onChange={(event) => handleSeoChange("keywords", event.target.value)}
                placeholder="visa, travel, about us"
              />
            </Card>
          </div>

          <div className="min-h-0 overflow-y-auto pl-2">
            <Card className="flex h-full min-h-[42rem] flex-col overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <h3 className="font-semibold text-text-primary">Live Preview</h3>
                  <p className="mt-1 text-xs text-text-muted">Preview how the page reads on desktop and mobile.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewViewport("desktop")}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${previewViewport === "desktop" ? "border-cyan bg-cyan/10 text-cyan" : "border-border bg-surface-2 text-text-secondary"}`}
                  >
                    <Monitor size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewViewport("mobile")}
                    className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border ${previewViewport === "mobile" ? "border-cyan bg-cyan/10 text-cyan" : "border-border bg-surface-2 text-text-secondary"}`}
                  >
                    <Smartphone size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTheme((prev) => (prev === "light" ? "dark" : "light"))}
                    className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-text-secondary transition-colors hover:border-cyan/40 hover:text-text-primary"
                  >
                    {previewTheme === "light" ? "Dark preview" : "Light preview"}
                  </button>
                </div>
              </div>

              <div className="mt-5 flex flex-1 justify-center overflow-auto rounded-2xl bg-surface-2 p-4 min-h-0">
                <div className={`${previewViewport === "mobile" ? "w-[360px] h-[640px] shrink-0" : "w-full h-full"} flex flex-col overflow-hidden rounded-[28px] border border-border bg-white shadow-xl`}>
                  <iframe
                    title="Static page preview"
                    srcDoc={previewDocument}
                    className="w-full flex-1 border-0"
                  />
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete Static Page"
        size="md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Delete Page</Button>
          </div>
        }
      >
        <p className="text-sm text-text-secondary">
          Delete <span className="font-semibold text-text-primary">{deleteTarget?.title}</span>? This action cannot be undone.
        </p>
      </Modal>
    </>
  );
};

export default StaticPagesManager;
