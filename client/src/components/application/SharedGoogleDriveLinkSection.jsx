import { CheckCircle, Info, Link2 } from "lucide-react";
import Button from "../ui/Button";

const DriveShareGuidePopover = ({ showSkipHint = true }) => (
  <span className="pointer-events-none absolute right-0 bottom-full z-30 mb-2 hidden w-80 rounded-2xl border border-border bg-surface p-4 text-[11px] font-normal leading-relaxed text-text-secondary shadow-xl group-hover:block">
    <p className="font-semibold text-text-primary text-sm mb-2">How to share your folder</p>
    <ol className="list-decimal list-inside space-y-2">
      <li>
        Upload your files to a <span className="font-medium text-text-primary">new folder</span> in Google Drive.
      </li>
      <li>
        Open the folder, click the <span className="font-medium text-text-primary">three dots (⋮)</span> →{" "}
        <span className="font-medium text-text-primary">Share</span> → set access to{" "}
        <span className="font-medium text-text-primary">Anyone with the link</span> (Viewer is fine).
      </li>
      <li>
        Click <span className="font-medium text-text-primary">Copy link</span> and paste it in the field below.
      </li>
    </ol>
    {showSkipHint ? (
      <p className="mt-2 text-text-muted">
        You can skip this now and add the link later from your dashboard.
      </p>
    ) : null}
  </span>
);

/**
 * Single Google Drive folder link for all travelers (apply flow, details, summary).
 */
export default function SharedGoogleDriveLinkSection({
  value,
  onChange,
  onSave,
  savedLink = "",
  loading = false,
  disabled = false,
  /** When false (e.g. fee already paid), hide “skip for now” in the info hover guide. */
  showSkipHint = true,
  className = "",
}) {
  const trimmedSaved = String(savedLink || "").trim();
  const showSaved = trimmedSaved && String(value || "").trim() === trimmedSaved;

  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-5 shadow-[0_12px_35px_rgba(15,23,42,0.05)] ${className}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <Link2 size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold text-text-primary">Google Drive Link (for all travelers)</h4>
            <span className="group relative inline-flex align-middle">
              <button
                type="button"
                className="inline-flex rounded-full p-0.5 text-text-muted transition-all duration-150 hover:bg-cyan/10 hover:text-cyan focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
                aria-label="How to share your Google Drive folder"
              >
                <Info size={14} />
              </button>
              <DriveShareGuidePopover showSkipHint={showSkipHint} />
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Add a single Google Drive link containing all required documents.
          </p>

          {showSaved ? (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                  <CheckCircle size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-text-primary">Google Drive link saved</p>
                  <a
                    href={trimmedSaved}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-[10px] text-cyan hover:underline truncate block max-w-full"
                  >
                    {trimmedSaved}
                  </a>
                </div>
              </div>
            </div>
          ) : null}

          <input
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://drive.google.com/your-folder-link"
            disabled={disabled || loading}
            autoComplete="off"
            className="mt-4 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-cyan/50 disabled:opacity-50"
          />
          {onSave ? (
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Link2 size={14} />}
                loading={loading}
                disabled={disabled || !String(value || "").trim()}
                onClick={onSave}
              >
                Save Drive Link
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
