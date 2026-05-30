import { Download, FileText } from "lucide-react";
import Modal from "./Modal";

export default function FilePreviewModal({ isOpen, onClose, previewFile }) {
  if (!previewFile) return null;

  const isPdf = previewFile.type?.includes("pdf") || /\.pdf($|\?)/i.test(String(previewFile.url || ""));
  const isImage = /^image\//i.test(String(previewFile.type || "")) || /\.(png|jpe?g|gif|webp|bmp|svg)($|\?)/i.test(String(previewFile.url || ""));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={previewFile.name || "Document Preview"}
      size="4xl"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6">
          <h3 className="font-semibold text-text-primary">
            {previewFile.name || "Document Preview"}
          </h3>
          {previewFile.url && (
            <a
              href={previewFile.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-3"
            >
              <Download size={14} />
              Open Original
            </a>
          )}
        </div>
        <div className="relative flex-1 overflow-hidden bg-background">
          {isPdf ? (
            <iframe
              src={previewFile.url}
              title={previewFile.name || "Document Preview"}
              className="h-full min-h-[60vh] w-full border-none"
            />
          ) : isImage ? (
            <div className="flex h-full min-h-[60vh] w-full items-center justify-center p-4">
              <img
                src={previewFile.url}
                alt={previewFile.name || "Document Preview"}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[60vh] w-full items-center justify-center p-8 text-center text-text-muted">
              <div className="flex max-w-sm flex-col items-center gap-3">
                <FileText size={48} className="text-border" />
                <p>Preview is not available for this file type.</p>
                {previewFile.url && (
                  <a
                    href={previewFile.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-sm font-medium text-cyan hover:underline"
                  >
                    Download to view
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
