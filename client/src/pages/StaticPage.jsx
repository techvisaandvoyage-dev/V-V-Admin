import { useEffect, useState } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";
import Button from "../components/ui/Button";
import ImageWithShimmer from "../components/ui/ImageWithShimmer";
import { api, SERVER_URL } from "../store/authStore";

const resolveAssetUrl = (value) => {
  const url = String(value || "").trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("/")) return `${SERVER_URL}${url}`;
  return `${SERVER_URL}/${url}`;
};

const ensureMetaTag = (selector, creator) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = creator();
    document.head.appendChild(element);
  }
  return element;
};

/**
 * Render a CMS-managed static page.
 *
 * Usually mounted at `/page/:slug` and reads the slug from the route params.
 * Pages with a "fixed" public URL (e.g. `/terms` → Terms & Conditions) can
 * mount this same component and supply `slugOverride` to pin the document
 * being fetched. Falling back through the same UI keeps the look-and-feel,
 * SEO meta handling and admin editability identical regardless of URL.
 */
const StaticPage = ({ slugOverride } = {}) => {
  const { slug: paramSlug } = useParams();
  const slug = slugOverride || paramSlug;
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadPage = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await api.get(`/pages/${slug}`);
        if (!active) return;
        setPage(data.page || null);
      } catch (err) {
        if (!active) return;
        setError(err.response?.data?.message || "Page not found.");
        setPage(null);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPage();
    return () => {
      active = false;
    };
  }, [slug]);

  useEffect(() => {
    if (!page) return;

    document.title = page.seo?.metaTitle || `${page.title} | visavo.in`;

    const metaDescription = ensureMetaTag('meta[name="description"]', () => {
      const meta = document.createElement("meta");
      meta.name = "description";
      return meta;
    });
    metaDescription.setAttribute("content", page.seo?.metaDescription || page.summary || "");

    const metaKeywords = ensureMetaTag('meta[name="keywords"]', () => {
      const meta = document.createElement("meta");
      meta.name = "keywords";
      return meta;
    });
    metaKeywords.setAttribute("content", Array.isArray(page.seo?.keywords) ? page.seo.keywords.join(", ") : "");

    const canonical = ensureMetaTag('link[rel="canonical"]', () => {
      const link = document.createElement("link");
      link.rel = "canonical";
      return link;
    });
    canonical.setAttribute("href", page.seo?.canonicalUrl || `${window.location.origin}/page/${page.slug}`);

    const ogImage = ensureMetaTag('meta[property="og:image"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:image");
      return meta;
    });
    ogImage.setAttribute("content", resolveAssetUrl(page.seo?.openGraphImage || page.featuredImage));
  }, [page]);

  const handleBack = () => {
    const from = location.state?.from;
    if (typeof from === "string" && from.startsWith("/")) {
      navigate(from, { replace: true });
      return;
    }
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background text-text-primary">
      <Navbar />
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <button
          type="button"
          onClick={handleBack}
          className="mb-8 inline-flex items-center gap-2 text-sm text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={16} />
          Back
        </button>

        {loading ? (
          <div className="space-y-6">
            <div className="animate-pulse rounded-3xl border border-border bg-surface p-8">
              <div className="h-4 w-28 rounded bg-surface-2" />
              <div className="mt-4 h-12 w-3/4 rounded bg-surface-2" />
              <div className="mt-4 h-5 w-full rounded bg-surface-2" />
              <div className="mt-2 h-5 w-5/6 rounded bg-surface-2" />
            </div>
            <div className="animate-pulse rounded-3xl border border-border bg-surface p-8">
              <div className="h-5 w-full rounded bg-surface-2" />
              <div className="mt-3 h-5 w-full rounded bg-surface-2" />
              <div className="mt-3 h-5 w-4/5 rounded bg-surface-2" />
            </div>
          </div>
        ) : error || !page ? (
          <div className="rounded-3xl border border-border bg-surface px-6 py-14 text-center">
            <Loader2 size={28} className="mx-auto mb-4 text-cyan" />
            <h1 className="text-2xl font-bold text-text-primary">Page unavailable</h1>
            <p className="mt-3 text-sm text-text-secondary">{error || "This page is not published yet."}</p>
            <div className="mt-6">
              <Button variant="primary" onClick={() => navigate("/")}>Return Home</Button>
            </div>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
            <section className="overflow-hidden rounded-[28px] border border-border bg-surface">
              {page.featuredImage && (
                <ImageWithShimmer
                  src={resolveAssetUrl(page.featuredImage)}
                  alt={page.title}
                  className="h-56 w-full sm:h-72"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </ImageWithShimmer>
              )}
              <div className="px-6 py-8 sm:px-10 sm:py-10">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan">{page.template.replace("-", " ")}</p>
                <h1 className="mt-3 text-3xl font-bold leading-tight text-text-primary sm:text-5xl">{page.title}</h1>
                {(page.summary || page.seo?.metaDescription) && (
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary sm:text-base">
                    {page.summary || page.seo?.metaDescription}
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-border bg-surface px-6 py-8 sm:px-10 sm:py-10">
              <article
                className="prose prose-neutral max-w-none text-text-primary prose-headings:text-text-primary prose-p:text-text-secondary prose-li:text-text-secondary prose-strong:text-text-primary prose-a:text-cyan [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-border [&_td]:p-3 [&_th]:border [&_th]:border-border [&_th]:bg-surface-2 [&_th]:p-3 [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: page.content }}
              />
            </section>
          </motion.div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default StaticPage;
