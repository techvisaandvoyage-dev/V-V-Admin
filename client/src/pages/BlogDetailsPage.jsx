// ============================================================
//  Blog Details Page
//  Public single-post view. Banner image + dynamic sections
//  (heading / paragraph / image / gallery / list / quote / faq
//  / video / table) rendered from the BlogPost.sections array.
//  Adds: Like toggle, related posts, and a paginated nested
//  comment thread powered by /api/blog/:id/comments.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronRight,
  Clock,
  CornerDownRight,
  Eye,
  Heart,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  Send,
  Share2,
  Sparkles,
  Tag as TagIcon,
  Trash2,
  X,
  User as UserIcon,
} from "lucide-react";
import Navbar from "../components/layout/Navbar";
import { formatOrdinalDate } from "../utils/dateUtils";
import Footer from "../components/layout/Footer";
import Button from "../components/ui/Button";
import ImageWithShimmer from "../components/ui/ImageWithShimmer";
import { api, SERVER_URL, useAuthStore } from "../store/authStore";
import { useUIStore } from "../store/uiStore";

const FALLBACK_BANNER =
  "https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=1600&q=70";

const resolveAssetUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${SERVER_URL}${url}`;
  return `${SERVER_URL}/${url}`;
};

/** Strip obvious XSS vectors from admin-authored HTML (not a full sanitizer). */
const stripUnsafeBlogHtml = (html) => {
  let s = String(html || "");
  s = s.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style\b[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<\/?(iframe|object|embed|form|input|button|meta|link|base)\b[^>]*>/gi, "");
  s = s.replace(/\son\w+\s*=\s*(["']).*?\1/gi, "");
  s = s.replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  s = s.replace(/javascript:/gi, "");
  return s;
};

const formatDateLong = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatOrdinalDate(d);
};

const formatRelative = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return formatOrdinalDate(d);
};

const formatDayBadge = (iso) => {
  if (!iso) return { day: "", month: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "", month: "" };
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
  };
};

/**
 * Rough reading time. Concatenates all text-bearing section payloads then
 * divides by ~220 words per minute. Avoids importing a heavy NLP library.
 */
const estimateReadingTime = (post) => {
  if (!post) return 1;
  const parts = [];
  parts.push(post.title || "");
  parts.push(post.shortDescription || "");
  (post.sections || []).forEach((s) => {
    const p = s.payload || {};
    if (s.type === "paragraph") {
      if (typeof p.html === "string" && p.html.trim()) {
        parts.push(p.html.replace(/<[^>]+>/g, " "));
      } else if (typeof p.text === "string") {
        parts.push(p.text);
      }
      return;
    }
    if (typeof p.text === "string") parts.push(p.text);
    if (typeof p.html === "string") parts.push(p.html.replace(/<[^>]+>/g, " "));
    if (Array.isArray(p.items)) {
      p.items.forEach((it) => {
        if (typeof it === "string") parts.push(it);
        else if (it && typeof it === "object") {
          if (it.question) parts.push(it.question);
          if (it.answer) parts.push(it.answer);
        }
      });
    }
  });
  const words = parts.join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
};

/** Pure embed helper for YouTube/Vimeo URLs entered by admin. */
const toEmbedUrl = (url) => {
  const u = String(url || "").trim();
  if (!u) return "";
  const ytMatch = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = u.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return u;
};

/** Render one structured section. Unknown types fall back to raw text. */
const SectionRenderer = ({ section }) => {
  const payload = section.payload || {};
  switch (section.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(payload.level) || 2, 2), 4);
      const Tag = `h${level}`;
      return (
        <Tag className="text-2xl sm:text-3xl font-bold text-text-primary mt-10 mb-3">
          {payload.text || ""}
        </Tag>
      );
    }
    case "paragraph": {
      const html = typeof payload.html === "string" ? payload.html.trim() : "";
      const text = typeof payload.text === "string" ? payload.text : "";
      if (html) {
        return (
          <div
            className="blog-post-html text-base text-text-secondary leading-relaxed mb-5
              [&_a]:text-cyan [&_a]:underline
              [&_blockquote]:border-l-4 [&_blockquote]:border-cyan/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4
              [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold
              [&_li]:ml-5 [&_p]:mb-3
              [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
              [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:px-3 [&_td]:py-2 [&_th]:bg-surface-2 [&_th]:text-left
              [&_img]:max-w-full [&_img]:rounded-xl"
            dangerouslySetInnerHTML={{ __html: stripUnsafeBlogHtml(html) }}
          />
        );
      }
      return (
        <p className="text-base text-text-secondary leading-relaxed mb-5 whitespace-pre-wrap">
          {text}
        </p>
      );
    }
    case "image": {
      const src = resolveAssetUrl(payload.src || payload.url);
      if (!src) return null;
      return (
        <figure className="my-8">
          <img
            src={src}
            alt={payload.alt || ""}
            className="w-full rounded-2xl shadow-card object-cover"
            loading="lazy"
          />
          {payload.caption ? (
            <figcaption className="text-xs text-text-muted text-center mt-2">
              {payload.caption}
            </figcaption>
          ) : null}
        </figure>
      );
    }
    case "gallery": {
      const items = Array.isArray(payload.images) ? payload.images : [];
      if (!items.length) return null;
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-8">
          {items.map((item, idx) => {
            const src = resolveAssetUrl(typeof item === "string" ? item : item.src || item.url);
            if (!src) return null;
            return (
              <img
                key={idx}
                src={src}
                alt={item.alt || ""}
                className="w-full aspect-square object-cover rounded-xl"
                loading="lazy"
              />
            );
          })}
        </div>
      );
    }
    case "list": {
      const items = Array.isArray(payload.items) ? payload.items : [];
      const Ordered = payload.ordered ? "ol" : "ul";
      return (
        <Ordered
          className={`mb-5 pl-6 text-base text-text-secondary leading-relaxed ${
            payload.ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {items.map((it, idx) => (
            <li key={idx} className="mb-1">
              {String(it)}
            </li>
          ))}
        </Ordered>
      );
    }
    case "quote":
      return (
        <blockquote className="my-8 border-l-4 border-cyan pl-5 italic text-lg text-text-primary">
          “{payload.text || ""}”
          {payload.author ? (
            <footer className="mt-2 text-sm not-italic text-text-muted">— {payload.author}</footer>
          ) : null}
        </blockquote>
      );
    case "faq": {
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!items.length) return null;
      return (
        <div className="my-8 space-y-3">
          {items.map((qa, idx) => (
            <details
              key={idx}
              className="bg-surface-2 rounded-2xl p-4 border border-border open:border-cyan-border"
            >
              <summary className="cursor-pointer font-semibold text-text-primary list-none flex items-center justify-between">
                <span>{qa.question || qa.q || ""}</span>
                <span className="text-cyan ml-3">+</span>
              </summary>
              <p className="text-sm text-text-secondary mt-3 leading-relaxed">
                {qa.answer || qa.a || ""}
              </p>
            </details>
          ))}
        </div>
      );
    }
    case "video": {
      const src = toEmbedUrl(payload.url || payload.src);
      if (!src) return null;
      return (
        <div className="my-8 aspect-video rounded-2xl overflow-hidden bg-black">
          <iframe
            src={src}
            title={payload.title || "Embedded video"}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    case "table": {
      const rows = Array.isArray(payload.rows) ? payload.rows : [];
      const headers = Array.isArray(payload.headers) ? payload.headers : [];
      if (!rows.length && !headers.length) return null;
      return (
        <div className="my-8 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            {headers.length ? (
              <thead className="bg-surface-2">
                <tr>
                  {headers.map((h, idx) => (
                    <th key={idx} className="px-4 py-2.5 font-semibold text-text-primary">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            ) : null}
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri} className="border-t border-border">
                  {(Array.isArray(row) ? row : []).map((cell, ci) => (
                    <td key={ci} className="px-4 py-2.5 text-text-secondary">
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    default:
      return (
        <p className="text-base text-text-secondary leading-relaxed mb-5">
          {payload.text || ""}
        </p>
      );
  }
};

/**
 * One comment + its inline reply composer + child thread.
 *
 * Replies are fetched lazily when a user expands the comment so we keep the
 * initial payload small even for posts with deep threads.
 */
const CommentNode = ({ comment, blogId, depth = 0, currentUserId, onAfterChange }) => {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [posting, setPosting] = useState(false);
  const [liked, setLiked] = useState(!!comment.likedByMe);
  const [likes, setLikes] = useState(comment.likesCount || 0);
  const [replies, setReplies] = useState([]);
  const [repliesLoaded, setRepliesLoaded] = useState(false);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [open, setOpen] = useState(false);
  const isMine = currentUserId && String(currentUserId) === String(comment.user?._id);

  const loadReplies = useCallback(async () => {
    if (loadingReplies) return;
    setLoadingReplies(true);
    try {
      const { data } = await api.get(`/blog/${blogId}/comments`, {
        params: { parentComment: comment._id, page: 1, limit: 20 },
      });
      if (data.success) setReplies(Array.isArray(data.data) ? data.data : []);
      setRepliesLoaded(true);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReplies(false);
    }
  }, [blogId, comment._id, loadingReplies]);

  const toggleReplies = () => {
    const next = !open;
    setOpen(next);
    if (next && !repliesLoaded) loadReplies();
  };

  const handleLike = async () => {
    setLiked((v) => !v);
    setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
    try {
      const { data } = await api.post(`/comments/${comment._id}/like`);
      if (data.success) {
        setLiked(!!data.liked);
        setLikes(Number(data.likesCount) || 0);
      }
    } catch {
      setLiked((v) => !v);
      setLikes((n) => (liked ? n + 1 : Math.max(0, n - 1)));
    }
  };

  const handleSubmitReply = async (e) => {
    e.preventDefault();
    const content = replyDraft.trim();
    if (!content) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/comments/${comment._id}/reply`, { content });
      if (data.success) {
        setReplies((prev) => [data.data, ...prev]);
        setReplyDraft("");
        setShowReplyBox(false);
        setOpen(true);
        setRepliesLoaded(true);
        onAfterChange?.();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const { data } = await api.delete(`/comments/${comment._id}`);
      if (data.success) onAfterChange?.();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={depth ? "pl-4 sm:pl-6 border-l border-border" : ""}>
      <div className="flex gap-3 py-4">
        <div className="w-9 h-9 rounded-full bg-cyan/10 text-cyan flex items-center justify-center flex-shrink-0 font-semibold">
          {(comment.user?.name || "?").charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-sm font-semibold text-text-primary">
              {comment.user?.name || "Visitor"}
            </span>
            {comment.user?.username ? (
              <span className="text-xs text-text-muted">@{comment.user.username}</span>
            ) : null}
            <span className="text-xs text-text-muted">{formatRelative(comment.createdAt)}</span>
            {comment.edited ? <span className="text-xs text-text-muted">(edited)</span> : null}
          </div>
          <p className="text-sm text-text-secondary mt-1 whitespace-pre-wrap break-words">
            {comment.content}
          </p>
          <div className="flex items-center gap-4 mt-2 text-xs text-text-muted">
            <button
              type="button"
              onClick={handleLike}
              className={`inline-flex items-center gap-1 hover:text-cyan transition-colors ${
                liked ? "text-cyan" : ""
              }`}
            >
              <Heart size={14} className={liked ? "fill-cyan" : ""} />
              {likes}
            </button>
            <button
              type="button"
              onClick={() => setShowReplyBox((v) => !v)}
              className="inline-flex items-center gap-1 hover:text-text-primary"
            >
              <CornerDownRight size={14} /> Reply
            </button>
            {comment.repliesCount > 0 ? (
              <button
                type="button"
                onClick={toggleReplies}
                className="hover:text-text-primary"
              >
                {open ? "Hide" : "View"} {comment.repliesCount}{" "}
                {comment.repliesCount === 1 ? "reply" : "replies"}
              </button>
            ) : null}
            {isMine ? (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1 hover:text-red-400 ml-auto"
              >
                <Trash2 size={14} /> Delete
              </button>
            ) : null}
          </div>

          {showReplyBox ? (
            <form onSubmit={handleSubmitReply} className="mt-3 flex gap-2 items-end">
              <textarea
                rows={2}
                value={replyDraft}
                onChange={(e) => setReplyDraft(e.target.value)}
                placeholder={`Reply to @${comment.user?.username || comment.user?.name || ""}`}
                className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-cyan/30"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={posting}
                leftIcon={<Send size={14} />}
              >
                Send
              </Button>
            </form>
          ) : null}

          {open ? (
            <div className="mt-3">
              {loadingReplies ? (
                <div className="text-xs text-text-muted py-3 inline-flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" /> Loading replies…
                </div>
              ) : replies.length === 0 ? (
                <p className="text-xs text-text-muted py-2">No replies yet.</p>
              ) : (
                replies.map((child) => (
                  <CommentNode
                    key={child._id}
                    comment={child}
                    blogId={blogId}
                    depth={depth + 1}
                    currentUserId={currentUserId}
                    onAfterChange={() => {
                      loadReplies();
                      onAfterChange?.();
                    }}
                  />
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const BlogDetailsPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { showToast } = useUIStore();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [related, setRelated] = useState([]);

  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);

  const [comments, setComments] = useState([]);
  const [commentPagination, setCommentPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [posting, setPosting] = useState(false);

  // Hydrate post + bump views via the public endpoint
  useEffect(() => {
    let active = true;
    setLoading(true);
    setNotFound(false);
    api
      .get(`/blog/${slug}`)
      .then(({ data }) => {
        if (!active) return;
        if (data.success && data.data) {
          setPost(data.data);
          setLikes(Number(data.data.likesCount) || 0);
        } else {
          setNotFound(true);
        }
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        if (err?.response?.status === 404) setNotFound(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  // Related posts run after we have a slug
  useEffect(() => {
    if (!slug) return;
    api
      .get(`/blog/${slug}/related`)
      .then(({ data }) => {
        if (data.success) setRelated(Array.isArray(data.data) ? data.data : []);
      })
      .catch(() => {});
  }, [slug]);

  // SEO meta
  useEffect(() => {
    if (!post) return;
    document.title = `${post.seoTitle || post.title} | visavo.in Blog`;
  }, [post]);

  const loadComments = useCallback(
    async (targetPage = 1) => {
      if (!post?._id) return;
      setCommentsLoading(true);
      try {
        const { data } = await api.get(`/blog/${post._id}/comments`, {
          params: { page: targetPage, limit: 15 },
        });
        if (data.success) {
          setComments(Array.isArray(data.data) ? data.data : []);
          setCommentPagination(
            data.pagination || { page: targetPage, pages: 1, total: data.data?.length || 0 }
          );
        }
      } catch (err) {
        console.error(err);
      } finally {
        setCommentsLoading(false);
      }
    },
    [post?._id]
  );

  useEffect(() => {
    loadComments(1);
  }, [loadComments]);

  const handleToggleLike = async () => {
    if (!isAuthenticated) {
      showToast("Sign in to like posts.", "info");
      navigate("/login");
      return;
    }
    setLiked((v) => !v);
    setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
    try {
      const { data } = await api.post(`/blog/${post._id}/like`);
      if (data.success) {
        setLiked(!!data.liked);
        setLikes(Number(data.likesCount) || 0);
      }
    } catch (err) {
      setLiked((v) => !v);
      setLikes((n) => (liked ? n + 1 : Math.max(0, n - 1)));
      if (err?.response?.status === 401) {
        showToast("Sign in to like posts.", "info");
        navigate("/login");
      }
    }
  };

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      showToast("Sign in to comment.", "info");
      navigate("/login");
      return;
    }
    const content = commentDraft.trim();
    if (!content) return;
    setPosting(true);
    try {
      const { data } = await api.post(`/blog/${post._id}/comments`, { content });
      if (data.success) {
        setComments((prev) => [data.data, ...prev]);
        setCommentDraft("");
        setCommentPagination((p) => ({ ...p, total: (p.total || 0) + 1 }));
      }
    } catch (err) {
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        showToast("Sign in to comment.", "info");
        navigate("/login");
      }
    } finally {
      setPosting(false);
    }
  };

  const handleCopyLink = () => {
    try {
      navigator.clipboard?.writeText(window.location.href);
      showToast("Link copied to clipboard", "success");
    } catch {
      showToast("Couldn't copy link", "error");
    }
  };

  const shareLinks = useMemo(() => {
    if (typeof window === "undefined" || !post) return {};
    const url = encodeURIComponent(window.location.href);
    const text = encodeURIComponent(post.title || "");
    return {
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    };
  }, [post]);

  const readingTime = useMemo(() => estimateReadingTime(post), [post]);
  const authorName =
    post?.attributedAuthor?.name ||
    post?.attributedAuthor?.username ||
    "Visa & Voyage Editorial";
  const authorInitial = String(authorName).charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-cyan animate-spin" />
        </div>
        <Footer />
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24">
          <div className="text-6xl mb-4">📰</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">Article not found</h1>
          <p className="text-text-secondary mb-6">
            The post you’re looking for has been moved or doesn’t exist.
          </p>
          <Link to="/blog">
            <Button variant="primary" leftIcon={<ArrowLeft size={16} />}>
              Back to Blog
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  const bannerSrc = resolveAssetUrl(post.bannerImage || post.thumbnail) || FALLBACK_BANNER;
  const dateBadge = formatDayBadge(post.publishedAt || post.createdAt);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* ── Hero banner ─────────────────────────────────────── */}
      <section className="relative">
        <div className="absolute inset-0">
          <img src={bannerSrc} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-br from-cyan/85 via-cyan-dim/80 to-black/70" />
        </div>

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-24 sm:pb-32 text-white">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs sm:text-sm text-white/75 mb-5">
            <Link to="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <ChevronRight size={14} className="text-white/50" />
            <Link to="/blog" className="hover:text-white transition-colors">
              Blog
            </Link>
            {post.category?.name ? (
              <>
                <ChevronRight size={14} className="text-white/50" />
                <Link
                  to={`/blog?category=${post.category.slug || post.category._id}`}
                  className="hover:text-white transition-colors"
                >
                  {post.category.name}
                </Link>
              </>
            ) : null}
          </nav>

          {post.category?.name ? (
            <Link
              to={`/blog?category=${post.category.slug || post.category._id}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] bg-white/15 backdrop-blur border border-white/20 px-3 py-1.5 rounded-full hover:bg-white/25 transition-colors"
            >
              <Sparkles size={12} className="text-gold" />
              {post.category.name}
            </Link>
          ) : null}

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="text-3xl sm:text-5xl lg:text-6xl font-bold mt-4 leading-tight max-w-4xl tracking-tight"
          >
            {post.title}
          </motion.h1>

          {post.shortDescription ? (
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mt-5 max-w-3xl text-sm sm:text-lg text-white/85 leading-relaxed"
            >
              {post.shortDescription}
            </motion.p>
          ) : null}

          {/* Author + meta row */}
          <div className="mt-8 flex flex-wrap items-center gap-4 sm:gap-6 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-white/20 backdrop-blur border-2 border-white/30 flex items-center justify-center font-bold text-base">
                {authorInitial}
              </div>
              <div className="leading-tight">
                <p className="font-semibold text-white">{authorName}</p>
                <p className="text-xs text-white/70">Editorial team</p>
              </div>
            </div>
            <span className="hidden sm:inline-block w-px h-8 bg-white/25" aria-hidden="true" />
            <div className="flex flex-wrap items-center gap-4 text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} />
                {formatDateLong(post.publishedAt || post.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} />
                {readingTime} min read
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Eye size={14} />
                {post.viewsCount || 0}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MessageCircle size={14} />
                {post.commentsCount || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Wave separator — same flavor as the listing hero */}
        <div className="absolute -bottom-px left-0 right-0 h-10 bg-background [clip-path:polygon(0_70%,25%_30%,50%_70%,75%_30%,100%_70%,100%_100%,0_100%)]" />
      </section>

      {/* ── Body ─────────────────────────────────────────────── */}
      <main className="flex-1">
        {/* Floating action bar — lifts above the hero / article seam */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 -mt-12 relative z-10">
          <div className="bg-surface rounded-2xl shadow-modal border border-border-light px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
            <Link
              to="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-secondary hover:text-cyan transition-colors"
            >
              <ArrowLeft size={15} /> All articles
            </Link>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleLike}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-semibold transition-all ${
                  liked
                    ? "bg-cyan/10 border-cyan text-cyan shadow-cyan-glow"
                    : "border-border text-text-secondary hover:text-cyan hover:border-cyan-border"
                }`}
              >
                <Heart size={15} className={liked ? "fill-cyan" : ""} />
                {likes}
              </button>
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-2 rounded-full border border-border text-text-secondary hover:text-cyan hover:border-cyan-border transition-colors"
                title="Copy link"
              >
                <LinkIcon size={15} />
              </button>
              {shareLinks.twitter ? (
                <a
                  href={shareLinks.twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full border border-border text-text-secondary hover:text-cyan hover:border-cyan-border transition-colors"
                  title="Share on X"
                >
                  <X size={15} />
                </a>
              ) : null}
              {shareLinks.facebook ? (
                <a
                  href={shareLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full border border-border text-text-secondary hover:text-cyan hover:border-cyan-border transition-colors"
                  title="Share on Facebook"
                >
                  <Share2 size={15} />
                </a>
              ) : null}
              {shareLinks.linkedin ? (
                <a
                  href={shareLinks.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-full border border-border text-text-secondary hover:text-cyan hover:border-cyan-border transition-colors"
                  title="Share on LinkedIn"
                >
                  <Share2 size={15} />
                </a>
              ) : null}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 lg:pt-12 pb-16 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-12">
          <article className="bg-surface rounded-3xl shadow-card border border-border-light overflow-hidden">
            {/* Featured image inside article body — gives the page magazine feel */}
            <div className="relative">
              <img
                src={bannerSrc}
                alt={post.title}
                className="w-full aspect-[16/9] object-cover"
                loading="eager"
              />
              {dateBadge.day ? (
                <div className="absolute top-4 left-4 bg-gold text-white rounded-2xl shadow-lg w-14 h-16 flex flex-col items-center justify-center leading-none">
                  <span className="text-xl font-bold">{dateBadge.day}</span>
                  <span className="text-[10px] font-semibold tracking-widest">
                    {dateBadge.month}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="p-6 sm:p-10 lg:p-12">
              {(post.sections || []).length === 0 ? (
                <p className="text-text-muted italic">This article has no body content yet.</p>
              ) : (
                <div className="prose-blog">
                  {(post.sections || [])
                    .slice()
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .map((section, idx) => (
                      <div
                        key={section._id || `${section.type}-${section.order}-${idx}`}
                        className={
                          idx === 0 &&
                          section.type === "paragraph" &&
                          !(section.payload?.html && String(section.payload.html).trim())
                            ? "first-paragraph"
                            : ""
                        }
                      >
                        <SectionRenderer section={section} />
                      </div>
                    ))}
                </div>
              )}

              {Array.isArray(post.tags) && post.tags.length ? (
                <div className="mt-10 pt-6 border-t border-border-light flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-text-muted">
                    <TagIcon size={12} /> Tags
                  </span>
                  {post.tags.map((tag) => (
                    <Link
                      key={tag}
                      to={`/blog?q=${encodeURIComponent(tag)}`}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full bg-gradient-to-br from-cyan/10 to-cyan/5 text-cyan border border-cyan-border hover:from-cyan/20 hover:to-cyan/10 transition-colors"
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              ) : null}

              {/* Inline like CTA at the bottom of the article */}
              <div className="mt-10 pt-8 border-t border-border-light flex flex-wrap items-center justify-between gap-4 bg-gradient-to-br from-cyan/5 to-transparent rounded-2xl p-5">
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Found this helpful?
                  </h3>
                  <p className="text-sm text-text-muted mt-1">
                    Show some love so we know what to write next.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleLike}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition-all ${
                    liked
                      ? "bg-cyan text-white shadow-cyan-glow"
                      : "bg-surface border border-cyan text-cyan hover:bg-cyan hover:text-white"
                  }`}
                >
                  <Heart size={16} className={liked ? "fill-white" : ""} />
                  {liked ? `Liked · ${likes}` : `Like · ${likes}`}
                </button>
              </div>
            </div>
          </article>

          {/* ── Sidebar ──────────────────────────────────────── */}
          <aside className="space-y-6 lg:sticky lg:top-24 self-start">
            {/* Author card */}
            <div className="bg-surface rounded-3xl shadow-card border border-border-light p-6 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-br from-cyan to-cyan-dim" />
              <div className="relative">
                <div className="w-16 h-16 rounded-full bg-white border-4 border-white shadow-card flex items-center justify-center text-cyan font-bold text-2xl mb-3">
                  {authorInitial}
                </div>
                <p className="font-bold text-text-primary">{authorName}</p>
                <p className="text-xs text-text-muted mt-1">
                  Visa specialists writing about travel, immigration and the small print so you
                  don't have to.
                </p>
              </div>
            </div>

            {/* Related articles */}
            <div className="bg-surface rounded-3xl shadow-card border border-border-light p-6">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-cyan/10 text-cyan flex items-center justify-center">
                  <BookOpen size={16} />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-text-primary">
                  Related articles
                </h3>
              </div>
              {related.length === 0 ? (
                <p className="text-sm text-text-muted">No related posts yet.</p>
              ) : (
                <ul className="space-y-4">
                  {related.slice(0, 4).map((r) => {
                    const rBadge = formatDayBadge(r.publishedAt || r.createdAt);
                    return (
                      <li key={r._id}>
                        <Link to={`/blog/${r.slug}`} className="flex gap-3 group">
                          <div className="relative w-20 h-20 flex-shrink-0">
                            <ImageWithShimmer
                              src={resolveAssetUrl(r.thumbnail) || FALLBACK_BANNER}
                              alt={r.title}
                              className="w-full h-full rounded-xl"
                              width={160}
                            />
                            {rBadge.day ? (
                              <div className="absolute -top-1 -left-1 bg-gold text-white rounded-md text-[9px] font-bold leading-none px-1.5 py-1 shadow">
                                {rBadge.day}
                                <span className="block text-[8px] tracking-widest mt-0.5">
                                  {rBadge.month}
                                </span>
                              </div>
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-text-primary line-clamp-2 group-hover:text-cyan transition-colors">
                              {r.title}
                            </p>
                            <p className="text-xs text-text-muted mt-1.5 flex items-center gap-2">
                              <Heart size={11} /> {r.likesCount || 0}
                              <span className="text-text-muted/50">·</span>
                              <MessageCircle size={11} /> {r.commentsCount || 0}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                to="/blog"
                className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-cyan hover:text-cyan-dim"
              >
                Browse all articles <ArrowRight size={14} />
              </Link>
            </div>

            {/* CTA — visa concierge */}
            <div className="rounded-3xl p-6 bg-gradient-to-br from-cyan via-cyan-dim to-cyan-dim text-white shadow-cyan-glow-lg overflow-hidden relative">
              <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-white/15" />
              <div className="absolute -right-2 bottom-2 w-12 h-12 rounded-full bg-white/10" />
              <Sparkles size={28} className="text-gold mb-3 relative" />
              <h3 className="text-lg font-bold relative">Need a visa expert?</h3>
              <p className="text-sm text-white/85 mt-1.5 relative">
                Our specialists pre-check your documents before submission so you don't lose
                fees to avoidable mistakes.
              </p>
              <Link
                to="/destinations"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold bg-white text-cyan px-4 py-2 rounded-full hover:bg-white/90 transition-colors relative"
              >
                Explore destinations <ArrowRight size={14} />
              </Link>
            </div>
          </aside>
        </div>

        {/* ── Comments ───────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-20">
          <div className="bg-surface rounded-3xl shadow-card border border-border-light p-6 sm:p-10">
            <div className="flex items-start gap-3 mb-7">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan to-cyan-dim text-white flex items-center justify-center shadow-cyan-glow">
                <MessageCircle size={18} />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-text-primary">
                  Join the discussion
                </h2>
                <p className="text-sm text-text-muted mt-1">
                  {commentPagination.total || 0}{" "}
                  {commentPagination.total === 1 ? "comment" : "comments"} · Use{" "}
                  <span className="font-mono text-cyan">@username</span> to mention someone.
                </p>
              </div>
            </div>

            {isAuthenticated ? (
              <form
                onSubmit={handleSubmitComment}
                className="bg-gradient-to-br from-cyan/5 to-transparent rounded-2xl border border-cyan-border/40 p-4 mb-8"
              >
                <div className="flex gap-3 items-start">
                  <div className="w-10 h-10 rounded-full bg-cyan/15 text-cyan flex items-center justify-center font-bold flex-shrink-0">
                    {(user?.name || "?").charAt(0).toUpperCase()}
                  </div>
                  <textarea
                    rows={3}
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder={`Comment as ${user?.name || "you"}…`}
                    className="flex-1 bg-surface border border-border rounded-2xl px-4 py-3 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:ring-2 focus:ring-cyan/30"
                  />
                </div>
                <div className="flex items-center justify-between mt-3 pl-[3.25rem]">
                  <p className="text-xs text-text-muted pl-1">
                    Be kind. We moderate spam and abuse.
                  </p>
                  <Button
                    type="submit"
                    variant="primary"
                    loading={posting}
                    leftIcon={<Send size={15} />}
                    className="rounded-full"
                    disabled={!commentDraft.trim()}
                  >
                    Post
                  </Button>
                </div>
              </form>
            ) : (
              <div className="bg-gradient-to-br from-cyan/10 to-cyan/5 border border-cyan-border rounded-2xl p-5 mb-8 text-sm flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan/20 text-cyan flex items-center justify-center">
                    <UserIcon size={18} />
                  </div>
                  <div>
                    <p className="font-semibold text-text-primary">Join the conversation</p>
                    <p className="text-xs text-text-muted">
                      Sign in to like, comment, and reply.
                    </p>
                  </div>
                </div>
                <Link to="/login">
                  <Button variant="primary" size="sm" className="rounded-full">
                    Sign in
                  </Button>
                </Link>
              </div>
            )}

            {commentsLoading ? (
              <div className="flex items-center justify-center text-text-muted gap-2 py-12">
                <Loader2 size={16} className="animate-spin" /> Loading comments…
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12">
                <MessageCircle size={32} className="text-text-muted mx-auto mb-3 opacity-40" />
                <p className="text-sm text-text-secondary font-semibold">No comments yet</p>
                <p className="text-xs text-text-muted mt-1">
                  Be the first to share your thoughts.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border-light">
                {comments.map((c) => (
                  <CommentNode
                    key={c._id}
                    comment={c}
                    blogId={post._id}
                    currentUserId={user?.id || user?._id}
                    onAfterChange={() => loadComments(commentPagination.page)}
                  />
                ))}
              </div>
            )}

            {commentPagination.pages > 1 ? (
              <div className="mt-8 pt-6 border-t border-border-light flex items-center justify-center gap-2">
                {Array.from({ length: commentPagination.pages }).map((_, idx) => {
                  const p = idx + 1;
                  const isActive = p === commentPagination.page;
                  return (
                    <button
                      key={p}
                      onClick={() => loadComments(p)}
                      className={`min-w-[2rem] h-8 px-2 rounded-full text-xs font-semibold transition-colors ${
                        isActive
                          ? "bg-cyan text-white shadow-cyan-glow"
                          : "bg-surface-2 text-text-secondary hover:text-text-primary hover:bg-surface-3"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default BlogDetailsPage;
