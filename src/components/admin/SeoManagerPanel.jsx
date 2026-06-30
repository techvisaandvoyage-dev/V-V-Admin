import { useMemo, useState } from "react";
import { Globe, ImagePlus, Link2, Search, ShieldCheck, Code, CheckCircle } from "lucide-react";
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
  seoCanonicalUrl: settings.seoCanonicalUrl || DEFAULT_SITE_URL,
  seoFaviconUrl: settings.seoFaviconUrl || "",
  seoFavicon32Url: settings.seoFavicon32Url || "",
  seoFavicon192Url: settings.seoFavicon192Url || "",
  seoAppleTouchIconUrl: settings.seoAppleTouchIconUrl || "",
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
  
  const ogTitle = previewTitle;
  const ogDesc = previewDescription;
  const twitterTitle = previewTitle;
  const twitterDesc = previewDescription;
  
  const canonical = settings.seoCanonicalUrl || DEFAULT_SITE_URL;

  const healthChecks = useMemo(() => {
    const checks = [
      scoreItem("Title Present", Boolean(String(settings.seoWebsiteTitle || "").trim())),
      scoreItem("Description Present", Boolean(String(settings.seoMetaDescription || "").trim())),
      scoreItem("Favicon Present", Boolean(String(settings.seoFaviconUrl || settings.seoFavicon32Url || "").trim())),
      scoreItem("Canonical URL Present", Boolean(String(settings.seoCanonicalUrl || "").trim())),
      scoreItem(
        "Twitter Meta Ready",
        Boolean(String(twitterTitle || "").trim() && String(twitterDesc || "").trim())
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
        seoCanonicalUrl: settings.seoCanonicalUrl,
      },
      "SEO HTML Settings updated successfully! Changes are instantly live via Cloudflare."
    );
  };

  const handleUploadAssets = async () => {
    if (!faviconFile) {
      showToast("Choose a favicon/logo first.", "error");
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
      showToast("Favicon & Organization Logo updated successfully.", "success");
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to upload favicon.", "error");
    } finally {
      setUploadingAssets(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_380px]">
        <div className="space-y-6">
          <Card className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan/10 text-cyan">
                <Code size={18} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary">SEO HTML Manager</h2>
                <p className="text-sm text-text-muted">Control the exact HTML head tags served to browsers and Google.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Input label="Website Title" value={settings.seoWebsiteTitle} onChange={(e) => handleFieldChange("seoWebsiteTitle", e.target.value)} />
              <Input label="Canonical URL" value={settings.seoCanonicalUrl} onChange={(e) => handleFieldChange("seoCanonicalUrl", e.target.value)} />
              <Input label="Meta Keywords" value={settings.seoMetaKeywords} onChange={(e) => handleFieldChange("seoMetaKeywords", e.target.value)} />
              <Textarea label="Meta Description" rows={4} value={settings.seoMetaDescription} onChange={(e) => handleFieldChange("seoMetaDescription", e.target.value)} />
            </div>

            <div className="flex justify-end">
              <Button
                variant="primary"
                loading={savingSettingsKey === "seo"}
                onClick={handleSave}
              >
                Save SEO HTML Settings
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="space-y-4">
            <div className="flex items-center gap-2 text-text-primary">
              <CheckCircle size={16} className="text-emerald-500" />
              <h3 className="text-base font-semibold">Test SEO</h3>
            </div>
            <p className="text-xs text-text-muted border-b border-border pb-2 mb-2">Live computed values served to search engines.</p>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-text-muted block text-xs">Current Title</span>
                <span className="text-text-primary font-medium">{previewTitle}</span>
              </div>
              <div>
                <span className="text-text-muted block text-xs">Current Meta Description</span>
                <span className="text-text-primary font-medium">{previewDescription || "-"}</span>
              </div>
              <div>
                <span className="text-text-muted block text-xs">Current Canonical</span>
                <span className="text-cyan font-medium break-all">{canonical}</span>
              </div>
              <div>
                <span className="text-text-muted block text-xs">Current Favicon / Logo</span>
                <span className="text-text-primary font-medium break-all">{settings.seoFaviconUrl || "-"}</span>
              </div>
            </div>
          </Card>

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
              <h3 className="text-base font-semibold">Favicon & Organization Logo</h3>
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-text-secondary">Upload Icon / Logo</span>
              <label className="flex min-h-[116px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-2 px-4 py-4 text-center">
                {faviconPreview ? <img src={faviconPreview} alt="Favicon" className="h-10 w-10 rounded-xl object-contain" /> : <span className="text-sm text-text-muted">Upload logo</span>}
                <span className="mt-2 text-xs text-text-muted">{faviconFile ? faviconFile.name : "Used for favicon, apple-touch-icon, and Open Graph image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => setFaviconFile(e.target.files?.[0] || null)} />
              </label>
            </div>
            <div className="grid gap-2 text-xs text-text-muted">
              <p>Current favicon: {settings.seoFaviconUrl || "Not uploaded yet"}</p>
              <p>Apple touch icon: {settings.seoAppleTouchIconUrl || "Not generated yet"}</p>
            </div>
            <Button variant="secondary" loading={uploadingAssets} onClick={handleUploadAssets}>
              Upload Logo
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default SeoManagerPanel;
