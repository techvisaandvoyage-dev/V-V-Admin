/**
 * Help for sharing a Google Drive folder (inline under one field, or once at bottom for all travelers).
 * @param {{ variant?: "inline" | "shared" }} props
 */
export default function GoogleDriveLinkHint({ variant = "inline" }) {
  const step3 =
    variant === "shared"
      ? "Copy the link and paste it into each traveler’s Google Drive field above."
      : "Copy the link and paste it in the box above.";

  return (
    <div
      className={`${variant === "shared" ? "mt-0" : "mt-2"} rounded-xl border border-border/70 bg-background/60 px-3 py-2.5 text-[11px] sm:text-xs text-text-muted leading-relaxed`}
    >
      <p className="font-medium text-text-secondary mb-1.5">How to share your folder</p>
      <ol className="list-decimal list-inside space-y-1 marker:text-text-muted">
        <li>
          Upload your files to a <span className="text-text-secondary">new folder</span> in Google Drive.
        </li>
        <li>
          Open the folder, click the <span className="text-text-secondary">three dots (⋮)</span> →{" "}
          <span className="text-text-secondary">Share</span> →{" "}
          <span className="text-text-secondary">Manage access</span> (or General access). Change access from{" "}
          <span className="text-text-secondary">Restricted</span> to{" "}
          <span className="text-text-secondary">Anyone with the link</span> (Viewer is fine).
        </li>
        <li>{step3}</li>
        <li className="text-text-muted/90">
          Optional: you can add a <span className="text-text-secondary">second folder link</span> for extra
          reference materials — it does not replace your main documents folder.
        </li>
      </ol>
    </div>
  );
}
