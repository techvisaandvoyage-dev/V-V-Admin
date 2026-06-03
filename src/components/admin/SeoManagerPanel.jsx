import { useMemo, useState } from "react";
import { Globe, ImagePlus, Link2, Search, ShieldCheck } from "lucide-react";
import Card from "../common/Card";
import Button from "../common/Button";
import Input from "../common/Input";
import Textarea from "../common/Textarea";
import { api, SERVER_URL } from "../../store/authStore";

const DEFAULT_SITE_URL = "https://visavo.in";

const toAbsoluteUrl = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `${SERVER_URL}${raw}`;
  return `${SERVER_URL}/${raw}`;
};

const extractSeoFields = (settings = {}) => ({
  seoWebsiteTitle: settings.seoWebsiteTitle || "Visa & Voyage",
  seoMetaDescription: settings.seoMetaDescription || "",
  seoMetaKeywords: settings.seoMetaKeywords || "",
  seoHomepageTitle: settings.seoHomepageTitle || "",
  seoHomepageDescription: settings.seoHomepageDescription || "",
  seoTwitterTitle: settings.seoTwitterTitle || "",
  seoTwitterDescription: settings.seoTwitterDescription || "",
  seoCanonicalUrl: settings.seoCanonicalUrl || DEFAULT_SITE_URL,
  seoFaviconUrl: settings.seoFaviconUrl || "",
  seoFavicon32Url: settings.seoFavicon32Url || "",
  seoFavicon192Url: settings.seoFavicon192Url || "",
  seoAppleTouchIconUrl: settings.seoAppleTouchIconUrl || "",
  seoRobotsIndex: settings.seoRobotsIndex !== false,
  seoSitemapUrl: settings.seoSitemapUrl || `${DEFAULT_SITE_URL}/sitemap.xml`,
});

const scoreItem = (label, ok) => ({ label, ok });

const SeoManagerPanel = ({
  settings,
  setSettings,
  saveSettingsPartial,
  savingSettingsKey,
  showToast,
}) => {
  const [faviconFile, setFaviconFile] = useState(null);
  const [uploadingAssets, setUploadingAssets] = useState(false);

  const previewTitle =
    String(settings.seoHomepageTitle || settings.seoWebsiteTitle || "Visa & Voyage").trim() || "Visa & Voyage";
  const previewDescription =
    String(settings.seoHomepageDescription || settings.seoMetaDescription || "").trim() ||
    "Visa & Voyage helps travellers apply for visas with expert guidance and fast updates.";
  const previewUrl = String(settings.seoCanonicalUrl || DEFAULT_SITE_URL).trim() || DEFAULT_SITE_URL;

  const faviconPreview = toAbsoluteUrl(settings.seoFavicon32Url || settings.seoFaviconUrl);

  const healthChecks = useMemo(() => {
    const checks = [
      scoreItem("Title Present", Boolean(String(settings.seoWebsiteTitle || "").trim())),
      scoreItem("Description Present", Boolean(String(settings.seoMetaDescription || "").trim())),
      scoreItem("Favicon Present", Boolean(String(settings.seoFaviconUrl || settings.seoFavicon32Url || "").trim())),
      scoreItem("Canonical URL Present", Boolean(String(settings.seoCanonicalUrl || "").trim())),
      scoreItem(
        "Twitter Meta Ready",
        Boolean(String(settings.seoTwitterTitle || "").trim() && String(settings.seoTwitterDescription || "").trim())
      ),
      scoreItem(
        "Structured Data Ready",
        Boolean(String(settings.seoWebsiteTitle || "").trim() && String(settings.seoCanonicalUrl || "").trim())
      ),
    ];
    const passed = checks.filter((item) => item.ok).length;
    return {
      checks,
      score: Math.round((passed / checks.length) * 100),
    };
  }, [settings]);

  const handleFieldChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await saveSettingsPartial(
      "seo",
      {
        seoWebsiteTitle: settings.seoWebsiteTitle,
        seoMetaDescription: settings.seoMetaDescription,
        seoMetaKeywords: settings.seoMetaKeywords,
        seoHomepageTitle: settings.seoHomepageTitle,
        seoHomepageDescription: settings.seoHomepageDescription,
        seoTwitterTitle: settings.seoTwitterTitle,
        seoTwitterDescription: settings.seoTwitterDescription,
        seoCanonicalUrl: settings.seoCanonicalUrl,
        seoRobotsIndex: settings.seoRobotsIndex,
        seoSitemapUrl: settings.seoSitemapUrl,
      },
      "SEO settings updated successfully"
    );
  };

  const handleUploadAssets = async () => {
    if (!faviconFile) {
      showToast("Choose a favicon first.", "error");
      return;
    }

    setUploadingAssets(true);
    try {
      const formData = new FormData();
      if (faviconFile) formData.append("favicon", faviconFile);
      const { data } = await api.post("/admin/settings/seo-assets", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (!data?.success || !data?.settings) {
        showToast(data?.message || "Failed to upload SEO assets.", "error");
        return;
      }
      setSettings((prev) => ({ ...prev, ...extractSeoFields(data.settings) }));
      setFaviconFile(null);
      showToast("Favicon updated successfully.", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to upload favicon.", "error");
    } finally {
      setUploadingAssets(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
        <Card className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan/10 text-cyan">
              <Search size={18} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-text-primary">SEO Manager</h2>
              <p className="text-sm text-text-muted">Control Google, Twitter, favicon, and crawl settings from Admin.</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Website Title" value={settings.seoWebsiteTitle} onChange={(e) => handleFieldChange("seoWebsiteTitle", e.target.value)} />
            <Input label="Canonical URL" value={settings.seoCanonicalUrl} onChange={(e) => handleFieldChange("seoCanonicalUrl", e.target.value)} />
            <Input label="Meta Keywords" value={settings.seoMetaKeywords} onChange={(e) => handleFieldChange("seoMetaKeywords", e.target.value)} />
            <Textarea label="Meta Description" rows={4} value={settings.seoMetaDescription} onChange={(e) => handleFieldChange("seoMetaDescription", e.target.value)} />
            <Input label="Homepage SEO Title" value={settings.seoHomepageTitle} onChange={(e) => handleFieldChange("seoHomepageTitle", e.target.value)} />
            <Textarea label="Homepage SEO Description" rows={3} value={settings.seoHomepageDescription} onChange={(e) => handleFieldChange("seoHomepageDescription", e.target.value)} />
            <Input label="Twitter Title" value={settings.seoTwitterTitle} onChange={(e) => handleFieldChange("seoTwitterTitle", e.target.value)} />
            <Textarea label="Twitter Description" rows={3} value={settings.seoTwitterDescription} onChange={(e) => handleFieldChange("seoTwitterDescription", e.target.value)} />
            <Input label="Sitemap URL" value={settings.seoSitemapUrl} onChange={(e) => handleFieldChange("seoSitemapUrl", e.target.value)} />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-text-secondary">Robots Index</span>
              <label className="inline-flex w-fit items-center gap-3 rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm text-text-primary">
                <input
                  type="checkbox"
                  checked={settings.seoRobotsIndex}
                  onChange={(e) => handleFieldChange("seoRobotsIndex", e.target.checked)}
                />
                Allow search engines to index the site
              </label>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              variant="primary"
              loading={savingSettingsKey === "seo"}
              onClick={handleSave}
            >
              Save SEO Settings
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center gap-2 text-text-primary">
              <Globe size={16} className="text-cyan" />
              <h3 className="text-base font-semibold">Google Search Preview</h3>
            </div>
            <div className="rounded-2xl border border-border bg-surface-2 p-5">
              <p className="truncate text-[22px] leading-tight text-[#8ab4f8]">{previewTitle}</p>
              <p className="mt-1 truncate text-sm text-[#99c3ff]">{previewUrl.replace(/^https?:\/\//i, "")}</p>
              <p className="mt-2 text-sm leading-6 text-[#bdc1c6]">{previewDescription}</p>
            </div>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center gap-2 text-text-primary">
              <ImagePlus size={16} className="text-cyan" />
              <h3 className="text-base font-semibold">Favicon</h3>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-text-secondary">Favicon</span>
              <label className="flex min-h-[116px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2 px-4 py-4 text-center">
                {faviconPreview ? <img src={faviconPreview} alt="Favicon" className="h-10 w-10 rounded-xl object-contain" /> : <span className="text-sm text-text-muted">Upload favicon</span>}
                <span className="mt-2 text-xs text-text-muted">{faviconFile ? faviconFile.name : "Used for favicon.ico, 32x32, 192x192, apple-touch-icon"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFaviconFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="grid gap-2 text-xs text-text-muted">
              <p>Current favicon: {settings.seoFaviconUrl || "Not uploaded yet"}</p>
              <p>Apple touch icon: {settings.seoAppleTouchIconUrl || "Not generated yet"}</p>
            </div>
            <Button variant="secondary" loading={uploadingAssets} onClick={handleUploadAssets}>
              Upload Favicon
            </Button>
          </Card>

          <Card className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-text-primary">
                <ShieldCheck size={16} className="text-cyan" />
                <h3 className="text-base font-semibold">SEO Health</h3>
              </div>
              <div className="rounded-full border border-cyan/30 bg-cyan/10 px-3 py-1 text-sm font-semibold text-cyan">
                {healthChecks.score}/100
              </div>
            </div>
            <div className="space-y-2">
              {healthChecks.checks.map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
                  <span className="text-text-secondary">{item.label}</span>
                  <span className={item.ok ? "text-emerald-400" : "text-amber-300"}>
                    {item.ok ? "OK" : "Missing"}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-surface-2 p-3 text-xs text-text-muted">
              <div className="flex items-center gap-2">
                <Link2 size={14} className="text-cyan" />
                Structured data uses your website title and canonical URL automatically.
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SeoManagerPanel;
