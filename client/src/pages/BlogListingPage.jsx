// ============================================================
//  Blog Listing Page
//  Public visa blog. Hero banner + dynamic category navbar +
//  responsive card grid backed by /api/blog (server pagination).
//  Design inspired by reference "Blog & Article" layout: full-
//  width hero with overlay title, then a 3-column grid of
//  rounded cards with date badges, title, excerpt and CTA.
// ============================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Heart, Loader2, MessageCircle, Search } from "lucide-react";
import Navbar from "../components/layout/Navbar";
import { formatOrdinalDate } from "../utils/dateUtils";
import Footer from "../components/layout/Footer";
import Button from "../components/ui/Button";
import ImageWithShimmer from "../components/ui/ImageWithShimmer";
import { api, SERVER_URL } from "../store/authStore";

/** Hero image — uses a stock travel photo so the page works even without a
 *  Cloudinary/Firebase upload yet. Admin can override later via Settings. */
const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=70";

const FALLBACK_THUMB =
  "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?auto=format&fit=crop&w=800&q=70";

/** Convert relative `/uploads/...` URLs into absolute API URLs so the <img/>
 *  tag works regardless of where the API origin lives. */
const resolveAssetUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${SERVER_URL}${url}`;
  return `${SERVER_URL}/${url}`;
};

const formatDay = (iso) => {
  if (!iso) return { day: "", month: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { day: "", month: "" };
  return {
    day: String(d.getDate()).padStart(2, "0"),
    month: d.toLocaleString("en-US", { month: "short" }).toUpperCase(),
  };
};

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return formatOrdinalDate(d);
};

const SORT_OPTIONS = [
  { id: "latest", label: "Latest" },
  { id: "trending", label: "Trending" },
  { id: "likes", label: "Most Liked" },
];

/**
 * One card in the grid — matches the reference layout (image with date badge,
 * title, short copy, and a "Learn more" arrow link).
 */
const BlogCard = ({ post, index }) => {
  const dateBits = formatDay(post.publishedAt || post.createdAt);
  const thumbSrc = resolveAssetUrl(post.thumbnail) || FALLBACK_THUMB;
  const categoryLabel = post.category?.name;

  return (
    <motion.article
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.4), ease: "easeOut" }}
      className="group bg-surface rounded-3xl overflow-hidden shadow-card hover:shadow-cyan-glow transition-all duration-300 flex flex-col"
    >
      <Link to={`/blog/${post.slug}`} className="block relative">
        <ImageWithShimmer
          src={thumbSrc}
          alt={post.title}
          className="w-full aspect-[16/10] sm:aspect-[4/3]"
          width={640}
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          priority={index < 3}
        />
        {dateBits.day ? (
          <div className="absolute top-3 left-3 z-30 bg-gold text-white rounded-xl shadow-md w-12 h-14 flex flex-col items-center justify-center leading-none">
            <span className="text-lg font-bold">{dateBits.day}</span>
            <span className="text-[10px] font-semibold tracking-wider">{dateBits.month}</span>
          </div>
        ) : null}
        {categoryLabel ? (
          <span className="absolute top-3 right-3 z-30 bg-cyan/95 text-white text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full">
            {categoryLabel}
          </span>
        ) : null}
      </Link>

      <div className="flex-1 flex flex-col p-5">
        <h3 className="text-base sm:text-lg font-bold text-text-primary line-clamp-2 group-hover:text-cyan transition-colors">
          <Link to={`/blog/${post.slug}`}>{post.title}</Link>
        </h3>
        <p className="text-sm text-text-secondary mt-2 line-clamp-3 leading-relaxed">
          {post.shortDescription || ""}
        </p>

        <div className="mt-4 flex items-center gap-4 text-xs text-text-muted">
          <span className="inline-flex items-center gap-1">
            <Heart size={14} /> {post.likesCount || 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={14} /> {post.commentsCount || 0}
          </span>
          <span className="inline-flex items-center gap-1 ml-auto">
            <Calendar size={14} />
            {formatDate(post.publishedAt || post.createdAt)}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-border-light">
          <Link
            to={`/blog/${post.slug}`}
            className="inline-flex items-center gap-1 text-sm font-semibold text-cyan hover:text-cyan-dim"
          >
            Learn more
            <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
};

const SkeletonCard = () => (
  <div className="bg-surface rounded-3xl overflow-hidden shadow-card">
    <div className="aspect-[4/3] glass-shimmer bg-surface-3" />
    <div className="p-5 space-y-3">
      <div className="h-4 rounded bg-surface-3 w-3/4" />
      <div className="h-3 rounded bg-surface-3 w-full" />
      <div className="h-3 rounded bg-surface-3 w-5/6" />
      <div className="h-3 rounded bg-surface-3 w-1/2 mt-4" />
    </div>
  </div>
);

const BlogListingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "all";
  const sortKey = searchParams.get("sort") || "latest";
  const searchTerm = searchParams.get("q") || "";

  const [categories, setCategories] = useState([]);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchDraft, setSearchDraft] = useState(searchTerm);

  useEffect(() => {
    let active = true;
    api
      .get("/blog/categories")
      .then(({ data }) => {
        if (active && data.success) setCategories(Array.isArray(data.data) ? data.data : []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadPosts = useCallback(
    async (targetPage, append = false) => {
      const setBusy = append ? setLoadingMore : setLoading;
      setBusy(true);
      try {
        const params = { page: targetPage, limit: 9 };
        if (activeCategory && activeCategory !== "all") params.category = activeCategory;
        if (sortKey && sortKey !== "latest") params.sort = sortKey;
        if (searchTerm) params.search = searchTerm;
        const { data } = await api.get("/blog", { params });
        if (data.success) {
          const items = Array.isArray(data.data) ? data.data : [];
          setPosts((prev) => (append ? [...prev, ...items] : items));
          setPagination(data.pagination || { page: targetPage, pages: 1, total: items.length });
        }
      } catch (err) {
        if (!append) setPosts([]);
        console.error("Failed to load blog posts:", err?.response?.data?.message || err);
      } finally {
        setBusy(false);
      }
    },
    [activeCategory, sortKey, searchTerm]
  );

  useEffect(() => {
    setPage(1);
    loadPosts(1, false);
  }, [loadPosts]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  useEffect(() => {
    document.title = "Visa Blog | Visa & Voyage";
  }, []);

  const navItems = useMemo(
    () => [
      { _id: "all", name: "Home", slug: "all" },
      ...categories.map((c) => ({ _id: String(c._id), name: c.name, slug: c.slug })),
    ],
    [categories]
  );

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value && value !== "all" && value !== "latest" && value !== "") next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    loadPosts(nextPage, true);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setParam("q", searchDraft.trim());
  };

  const hasMore = pagination.page < pagination.pages;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      {/* ── Hero banner ─────────────────────────────────────── */}
      <section className="relative">
        <div className="absolute inset-0">
          <img
            src={DEFAULT_HERO_IMAGE}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-cyan/80 via-cyan-dim/70 to-black/60" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center text-white">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <p className="text-xs sm:text-sm uppercase tracking-[0.4em] text-white/80 mb-3">
              Visa & Voyage
            </p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
              Blog <span className="italic font-light text-gold">&amp; Article</span>
            </h1>
            <p className="mt-5 max-w-2xl mx-auto text-sm sm:text-base text-white/85 leading-relaxed">
              Visa updates, country guides, and travel tips from our team — handpicked to help you
              plan smarter and travel further.
            </p>
          </motion.div>

          {/* Search */}
          <form
            onSubmit={handleSearchSubmit}
            className="mt-8 max-w-xl mx-auto flex items-center gap-2 bg-white/95 backdrop-blur rounded-2xl shadow-card p-1.5"
          >
            <span className="pl-3 text-text-muted">
              <Search size={18} />
            </span>
            <input
              type="search"
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search articles, countries, visa types…"
              className="flex-1 bg-transparent border-none outline-none px-2 py-2.5 text-sm text-text-primary placeholder-text-muted"
              aria-label="Search blog posts"
            />
            <Button type="submit" variant="primary" size="sm" className="rounded-xl">
              Search
            </Button>
          </form>
        </div>

        {/* Soft separator under hero */}
        <div className="absolute -bottom-px left-0 right-0 h-10 bg-background [clip-path:polygon(0_70%,25%_30%,50%_70%,75%_30%,100%_70%,100%_100%,0_100%)]" />
      </section>

      {/* ── Category bar ────────────────────────────────────── */}
      <div className="bg-surface border-b border-border sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = activeCategory === item.slug || activeCategory === item._id;
            return (
              <button
                key={item._id}
                onClick={() => setParam("category", item.slug)}
                className={`relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-cyan"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {item.name}
                {isActive && (
                  <motion.span
                    layoutId="blogCategoryUnderline"
                    className="absolute bottom-0 left-3 right-3 h-0.5 bg-cyan rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </button>
            );
          })}

          <div className="ml-auto hidden md:flex items-center gap-1 py-2">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setParam("sort", opt.id)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  sortKey === opt.id
                    ? "bg-cyan/10 text-cyan border border-cyan-border"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Grid ────────────────────────────────────────────── */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-text-primary">Latest News &amp; Articles</h2>
              <p className="text-sm text-text-muted mt-1">
                {pagination.total ? `${pagination.total} stories` : "Curated travel & visa stories"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="bg-surface rounded-3xl shadow-card py-20 text-center">
              <p className="text-base font-semibold text-text-primary">No articles yet.</p>
              <p className="text-sm text-text-muted mt-1">
                Check back soon or try a different category.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post, i) => (
                <BlogCard key={post._id} post={post} index={i} />
              ))}
            </div>
          )}

          {hasMore && !loading ? (
            <div className="mt-10 flex justify-center">
              <Button
                variant="primary"
                size="lg"
                onClick={handleLoadMore}
                loading={loadingMore}
                className="rounded-full px-8"
              >
                Load more
              </Button>
            </div>
          ) : null}

          {loadingMore && !hasMore ? (
            <div className="mt-10 flex justify-center text-text-muted">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : null}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BlogListingPage;
