import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Eye,
  ExternalLink,
  Heart,
  Loader2,
  MessageCircle,
  PencilLine,
  Plus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Input, { Select, Textarea } from "../ui/Input";
import Modal from "../ui/Modal";
import RichTextEditor from "../cms/RichTextEditor";
import { api, SERVER_URL } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";
import { fmtDate } from "../../utils/formatDate";

/** Convert relative `/uploads/...` URLs into absolute API URLs so admin
 *  previews load identically to the public client. */
const resolveAssetUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${SERVER_URL}${url}`;
  return `${SERVER_URL}/${url}`;
};

const FALLBACK_THUMB =
  "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=70";

/** Public client origin — used for “Open live page” from preview. */
const PUBLIC_CLIENT_URL = String(import.meta.env.VITE_PUBLIC_CLIENT_URL || "http://localhost:5173").replace(
  /\/+$/,
  ""
);

/** Escape plain text and wrap in paragraphs for legacy posts that only had `text`. */
const plainTextToEditorHtml = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/<[a-z][\s\S]*>/i.test(s)) return s;
  const escaped = s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const parts = escaped.split(/\n{2,}/).map((block) => block.replace(/\n/g, "<br/>"));
  return parts.map((p) => `<p>${p}</p>`).join("");
};

const stripHtmlToText = (html) =>
  String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const formatDayBadge = (iso) => {
  if (!iso) return { day: "", month: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "", month: "" };
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
  };
};

const formatDateLabel = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return fmtDate(d);
};

/**
 * Visual preview card. Mirrors the public `BlogListingPage` card so admins
 * see the same layout users will get, with status overlay + quick actions.
 */
const AdminBlogCard = ({ post, onEdit, onDelete, onToggleFeature }) => {
  const dateBits = formatDayBadge(post.publishedAt || post.createdAt);
  const thumb = resolveAssetUrl(post.thumbnail) || FALLBACK_THUMB;
  const isPublished = post.status === "published";
  return (
    <div className="group bg-surface rounded-3xl overflow-hidden border border-border shadow-card hover:shadow-modal transition-shadow flex flex-col">
      <div className="relative">
        <img
          src={thumb}
          alt={post.title}
          loading="lazy"
          className="w-full aspect-[4/3] object-cover"
        />
        {dateBits.day ? (
          <div className="absolute top-3 left-3 bg-gold text-white rounded-xl shadow w-12 h-14 flex flex-col items-center justify-center leading-none">
            <span className="text-lg font-bold">{dateBits.day}</span>
            <span className="text-[10px] font-semibold tracking-wider">{dateBits.month}</span>
          </div>
        ) : null}
        <span
          className={`absolute top-3 right-3 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
            isPublished
              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
              : "bg-amber-500/15 text-amber-300 border-amber-500/30"
          }`}
        >
          {post.status}
        </span>
        {post.featured ? (
          <span className="absolute bottom-3 left-3 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gold/90 text-white inline-flex items-center gap-1">
            <Star size={12} className="fill-white" /> Featured
          </span>
        ) : null}
        {post.category?.name ? (
          <span className="absolute bottom-3 right-3 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-cyan/90 text-white">
            {post.category.name}
          </span>
        ) : null}
      </div>

      <div className="flex-1 flex flex-col p-4">
        <h4 className="text-sm font-bold text-text-primary line-clamp-2">{post.title}</h4>
        <p className="text-xs text-text-muted mt-1 line-clamp-2">{post.shortDescription || ""}</p>

        <div className="mt-3 flex items-center gap-3 text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Heart size={12} /> {post.likesCount || 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={12} /> {post.commentsCount || 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <Eye size={12} /> {post.viewsCount || 0}
          </span>
          <span className="ml-auto">{formatDateLabel(post.publishedAt || post.createdAt)}</span>
        </div>

        <p className="mt-2 font-mono text-[10px] text-text-muted truncate" title={post.slug}>
          /{post.slug}
        </p>

        <div className="mt-4 pt-3 border-t border-border-light flex items-center justify-between">
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-semibold text-cyan hover:text-cyan-dim inline-flex items-center gap-1"
            id={`blog-card-edit-${post._id}`}
          >
            <PencilLine size={14} /> Edit
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleFeature}
              className={`p-1.5 rounded-lg ${
                post.featured
                  ? "text-gold bg-gold/10"
                  : "text-text-muted hover:text-gold hover:bg-gold/10"
              }`}
              title={post.featured ? "Unfeature" : "Feature"}
              id={`blog-card-feature-${post._id}`}
            >
              <Star size={14} className={post.featured ? "fill-gold" : ""} />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg text-text-muted hover:text-red-400 hover:bg-red-500/10"
              title="Delete"
              id={`blog-card-delete-${post._id}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "published", label: "Published" },
  { id: "draft", label: "Drafts" },
];

const emptyForm = () => ({
  title: "",
  shortDescription: "",
  thumbnail: "",
  bannerImage: "",
  category: "",
  tags: "",
  status: "draft",
  featured: false,
  seoTitle: "",
  seoDescription: "",
  mainContent: "",
});

const BlogAdminPanel = () => {
  const { showToast } = useUIStore();
  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  /** When set, next save runs PUT /api/blog/:id */
  const [editingId, setEditingId] = useState(null);
  /** When editing, slug is used for “View on site” from preview. */
  const [editingSlug, setEditingSlug] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  /** Server-side pagination + status filter for the blog list */
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [statusFilter, setStatusFilter] = useState("all");

  const [newCatName, setNewCatName] = useState("");
  const [creatingCat, setCreatingCat] = useState(false);

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    const name = newCatName.trim();
    if (!name) {
      showToast("Enter a category name.", "error");
      return;
    }
    setCreatingCat(true);
    try {
      const { data } = await api.post("/blog/categories", { name });
      if (data.success) {
        showToast("Category created.", "success");
        setNewCatName("");
        await loadCategories();
      } else showToast(data.message || "Failed.", "error");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed to create category.", "error");
    } finally {
      setCreatingCat(false);
    }
  };

  const loadCategories = useCallback(async () => {
    const { data } = await api.get("/admin/blog-categories");
    if (data.success && Array.isArray(data.data)) {
      setCategories(data.data);
      setForm((f) => {
        if (f.category) return f;
        const first = data.data[0]?._id;
        return first ? { ...f, category: String(first) } : f;
      });
    }
  }, []);

  const loadPosts = useCallback(
    async (targetPage = page, currentStatus = statusFilter) => {
      const params = { page: targetPage, limit: 12 };
      if (currentStatus && currentStatus !== "all") params.status = currentStatus;
      const { data } = await api.get("/admin/blogs", { params });
      if (data.success && Array.isArray(data.data)) {
        setPosts(data.data);
        setPagination(
          data.pagination || { page: targetPage, pages: 1, total: data.data.length }
        );
      }
    },
    [page, statusFilter]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadCategories(), loadPosts()]);
    } catch (e) {
      console.error(e);
      showToast(e?.response?.data?.message || "Failed to load blog data.", "error");
    } finally {
      setLoading(false);
    }
  }, [loadCategories, loadPosts, showToast]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Compact pagination strip (max 7 buttons with ellipsis handled by clamping). */
  const pageNumbers = useMemo(() => {
    const total = Math.max(1, pagination.pages || 1);
    const current = Math.min(Math.max(1, page), total);
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    const start = Math.max(1, current - 3);
    const end = Math.min(total, start + 6);
    const adjustedStart = Math.max(1, end - 6);
    return Array.from({ length: end - adjustedStart + 1 }, (_, i) => adjustedStart + i);
  }, [page, pagination.pages]);

  const setField = (key, value) => setForm((p) => ({ ...p, [key]: value }));

  const resetForm = () => {
    setForm(() => {
      const first = categories[0]?._id;
      return { ...emptyForm(), category: first ? String(first) : "" };
    });
    setEditingId(null);
    setEditingSlug(null);
    setPreviewOpen(false);
  };

  const startEdit = (post) => {
    setEditingId(String(post._id));
    setEditingSlug(post.slug || null);
    const tags = Array.isArray(post.tags) ? post.tags.join(", ") : "";
    const para = (post.sections || []).find((s) => s.type === "paragraph");
    const raw = para?.payload?.html || para?.payload?.text || "";
    const mainContent = plainTextToEditorHtml(raw);
    setForm({
      title: post.title || "",
      shortDescription: post.shortDescription || "",
      thumbnail: post.thumbnail || "",
      bannerImage: post.bannerImage || "",
      category: String(post.category?._id || post.category || ""),
      tags,
      status: post.status === "published" ? "published" : "draft",
      featured: !!post.featured,
      seoTitle: post.seoTitle || "",
      seoDescription: post.seoDescription || "",
      mainContent,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const buildSections = () => {
    const html = String(form.mainContent || "").trim();
    if (!html || !stripHtmlToText(html)) return [];
    return [{ type: "paragraph", order: 0, payload: { html } }];
  };

  const handleBlogImageUpload = async (file) => {
    try {
      const fd = new FormData();
      fd.append("image", file);
      const { data } = await api.post("/admin/pages/upload-image", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (data.success && data.url) {
        const u = String(data.url);
        if (/^https?:\/\//i.test(u)) return u;
        if (u.startsWith("/")) return `${SERVER_URL}${u}`;
        return `${SERVER_URL}/${u}`;
      }
      showToast(data.message || "Upload failed.", "error");
    } catch (err) {
      showToast(err?.response?.data?.message || "Could not upload image.", "error");
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast("Title is required.", "error");
      return;
    }
    if (!form.category) {
      showToast("Choose a category (create one under API or add navbar categories first).", "error");
      return;
    }

    if (!stripHtmlToText(form.mainContent)) {
      showToast("Add article body content in the editor.", "error");
      return;
    }

    const tags = form.tags
      .split(",")
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const body = {
      title: form.title.trim(),
      shortDescription: form.shortDescription.trim(),
      thumbnail: form.thumbnail.trim(),
      bannerImage: form.bannerImage.trim(),
      category: form.category,
      tags,
      sections: buildSections(),
      status: form.status,
      featured: form.featured,
      seoTitle: form.seoTitle.trim() || form.title.trim(),
      seoDescription: form.seoDescription.trim() || form.shortDescription.trim(),
    };
    if (editingId) body.keepSlug = true;

    setSaving(true);
    try {
      if (editingId) {
        const { data } = await api.put(`/blog/${editingId}`, body);
        if (data.success) {
          showToast("Blog updated.", "success");
          resetForm();
          await loadPosts();
        } else showToast(data.message || "Update failed.", "error");
      } else {
        const { data } = await api.post("/blog", body);
        if (data.success) {
          showToast("Blog created.", "success");
          resetForm();
          await loadPosts();
        } else showToast(data.message || "Create failed.", "error");
      }
    } catch (err) {
      showToast(err?.response?.data?.message || "Request failed.", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this blog post? It will be hidden from the site.")) return;
    try {
      const { data } = await api.delete(`/blog/${id}`);
      if (data.success) {
        showToast("Blog deleted.", "success");
        if (editingId === String(id)) resetForm();
        await loadPosts();
      } else showToast(data.message || "Delete failed.", "error");
    } catch (err) {
      showToast(err?.response?.data?.message || "Delete failed.", "error");
    }
  };

  const handleToggleFeature = async (id, current) => {
    try {
      const { data } = await api.patch(`/admin/blog/${id}/feature`, { featured: !current });
      if (data.success) {
        showToast(!current ? "Marked featured." : "Unfeatured.", "success");
        await loadPosts();
      } else showToast(data.message || "Failed.", "error");
    } catch (err) {
      showToast(err?.response?.data?.message || "Failed.", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-text-muted gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-cyan" />
        Loading blog tools…
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-cyan" />
            Visa blog
          </h2>
          <p className="text-sm text-text-muted mt-1 max-w-xl">
            Create and manage posts shown on the visa blog. Categories power the public navbar — add at least one
            category before publishing (use the quick form below if the list is empty).
          </p>
        </div>
        <Button variant="secondary" size="sm" leftIcon={<RefreshCw size={16} />} onClick={refresh} id="blog-refresh">
          Refresh
        </Button>
      </div>

      {categories.length === 0 ? (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <h3 className="text-sm font-semibold text-amber-200 mb-2">No blog categories yet</h3>
          <p className="text-xs text-text-muted mb-4">
            Navbar groups (Visa News, Country Guides, etc.) come from categories. Create one to attach posts.
          </p>
          <form onSubmit={handleCreateCategory} className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <Input
                label="New category name"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. Visa News"
                id="blog-new-category-name"
              />
            </div>
            <Button type="submit" variant="primary" size="sm" loading={creatingCat} id="blog-create-category">
              Add category
            </Button>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h3 className="font-semibold text-text-primary">
            {editingId ? "Edit blog post" : "Create blog post"}
          </h3>
          {editingId ? (
            <Button type="button" variant="ghost" size="sm" onClick={resetForm} id="blog-cancel-edit">
              Cancel edit
            </Button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Title"
              required
              value={form.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="e.g. Canada student visa update"
              id="blog-title"
            />
            <Select
              label="Category (navbar)"
              value={form.category}
              onChange={(e) => setField("category", e.target.value)}
              options={[
                { value: "", label: categories.length ? "Select category…" : "No categories — create one via API" },
                ...categories.map((c) => ({ value: String(c._id), label: `${c.name} (${c.slug})` })),
              ]}
              id="blog-category"
            />
          </div>

          <Textarea
            label="Short description"
            value={form.shortDescription}
            onChange={(e) => setField("shortDescription", e.target.value)}
            rows={3}
            placeholder="Card excerpt for listings"
            id="blog-short"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Thumbnail URL"
              value={form.thumbnail}
              onChange={(e) => setField("thumbnail", e.target.value)}
              placeholder="https://… or /uploads/…"
              id="blog-thumb"
            />
            <Input
              label="Banner image URL"
              value={form.bannerImage}
              onChange={(e) => setField("bannerImage", e.target.value)}
              placeholder="https://…"
              id="blog-banner"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Tags (comma-separated)"
              value={form.tags}
              onChange={(e) => setField("tags", e.target.value)}
              placeholder="schengen, student, news"
              id="blog-tags"
            />
            <Select
              label="Publish status"
              value={form.status}
              onChange={(e) => setField("status", e.target.value)}
              options={[
                { value: "draft", label: "Draft" },
                { value: "published", label: "Published" },
              ]}
              id="blog-status"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(e) => setField("featured", e.target.checked)}
              className="rounded border-border bg-surface-2 text-cyan focus:ring-cyan/30"
              id="blog-featured"
            />
            Featured on listings
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="SEO title (optional)"
              value={form.seoTitle}
              onChange={(e) => setField("seoTitle", e.target.value)}
              id="blog-seo-title"
            />
            <Input
              label="SEO description (optional)"
              value={form.seoDescription}
              onChange={(e) => setField("seoDescription", e.target.value)}
              id="blog-seo-desc"
            />
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <span className="text-sm font-medium text-text-primary">Main article body</span>
              <p className="text-xs text-text-muted max-w-md text-right">
                Stored as the first paragraph section (HTML). Tables, links, headings, and images are supported.
              </p>
            </div>
            <RichTextEditor
              value={form.mainContent}
              onChange={(html) => setField("mainContent", html)}
              onUploadImage={handleBlogImageUpload}
              toolbarEnd={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<Eye size={14} />}
                  onClick={() => setPreviewOpen(true)}
                  id="blog-body-preview"
                >
                  Preview
                </Button>
              }
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" variant="primary" loading={saving} leftIcon={<Plus size={16} />} id="blog-save">
              {editingId ? "Save changes" : "Publish / save draft"}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-semibold text-text-primary">All blog cards</h3>
            <p className="text-xs text-text-muted mt-1">
              {pagination.total ? `${pagination.total} posts` : "Posts will appear here"} — same
              layout users see on the public site.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-surface-2 p-1 rounded-xl">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  if (statusFilter === f.id) return;
                  setStatusFilter(f.id);
                  setPage(1);
                  loadPosts(1, f.id);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  statusFilter === f.id
                    ? "bg-cyan text-background"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="py-16 text-center text-text-muted">
            No posts in this view. Create one above or change the filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {posts.map((p) => (
              <AdminBlogCard
                key={p._id}
                post={p}
                onEdit={() => startEdit(p)}
                onDelete={() => handleDelete(p._id)}
                onToggleFeature={() => handleToggleFeature(p._id, p.featured)}
              />
            ))}
          </div>
        )}

        {pagination.pages > 1 ? (
          <div className="mt-6 flex items-center justify-between gap-3">
            <p className="text-xs text-text-muted">
              Page {pagination.page} of {pagination.pages}
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (page <= 1) return;
                  const next = page - 1;
                  setPage(next);
                  loadPosts(next, statusFilter);
                }}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft size={16} />
              </button>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    if (n === page) return;
                    setPage(n);
                    loadPosts(n, statusFilter);
                  }}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                    n === page
                      ? "bg-cyan text-background"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  if (page >= pagination.pages) return;
                  const next = page + 1;
                  setPage(next);
                  loadPosts(next, statusFilter);
                }}
                disabled={page >= pagination.pages}
                className="p-1.5 rounded-lg border border-border text-text-muted hover:text-text-primary hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : null}
      </Card>

      <Modal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Article preview"
        size="xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-text-muted">
              Approximate layout only; public site uses its own typography (
              <code className="text-[10px]">prose-blog</code>).
            </div>
            <div className="flex flex-wrap gap-2">
              {editingSlug ? (
                <a
                  href={`${PUBLIC_CLIENT_URL}/blog/${encodeURIComponent(editingSlug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary hover:border-cyan/40 transition-colors"
                >
                  Open live page <ExternalLink size={14} />
                </a>
              ) : null}
              <Button type="button" variant="primary" size="sm" onClick={() => setPreviewOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        }
      >
        <div
          className="prose-blog max-w-none text-text-secondary text-base leading-relaxed
            [&_a]:text-cyan [&_a]:underline
            [&_blockquote]:border-l-4 [&_blockquote]:border-cyan/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4
            [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold
            [&_li]:ml-5 [&_p]:mb-3
            [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
            [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:px-3 [&_td]:py-2 [&_th]:bg-surface-2 [&_th]:text-left
            [&_img]:max-w-full [&_img]:rounded-xl"
          dangerouslySetInnerHTML={{ __html: String(form.mainContent || "") }}
        />
      </Modal>
    </motion.div>
  );
};

export default BlogAdminPanel;
