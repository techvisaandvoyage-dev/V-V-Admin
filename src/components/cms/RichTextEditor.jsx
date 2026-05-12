import { useEffect, useRef, useState } from "react";
import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Table,
  Type,
  MousePointerSquareDashed,
  Undo2,
  Redo2,
} from "lucide-react";
import Button from "../ui/Button";

const toolbarButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-secondary transition-colors hover:border-cyan/40 hover:text-text-primary";

const RichTextEditor = ({ value, onChange, onUploadImage, disabled = false }) => {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  const focusEditor = () => {
    editorRef.current?.focus();
  };

  const runCommand = (command, commandValue = null) => {
    if (disabled) return;
    focusEditor();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current?.innerHTML || "");
  };

  const insertHtml = (html) => {
    if (disabled) return;
    focusEditor();
    document.execCommand("insertHTML", false, html);
    onChange(editorRef.current?.innerHTML || "");
  };

  const handleLink = () => {
    const url = window.prompt("Enter link URL");
    if (!url) return;
    runCommand("createLink", url);
  };

  const handleAddTable = () => {
    insertHtml(
      `<table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <thead>
          <tr>
            <th style="border:1px solid #d1d5db;padding:10px;text-align:left;">Header 1</th>
            <th style="border:1px solid #d1d5db;padding:10px;text-align:left;">Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="border:1px solid #d1d5db;padding:10px;">Value</td>
            <td style="border:1px solid #d1d5db;padding:10px;">Value</td>
          </tr>
        </tbody>
      </table><p></p>`
    );
  };

  const handleAddCta = () => {
    const label = window.prompt("CTA label", "Start Application");
    if (!label) return;
    const href = window.prompt("CTA link", "/apply");
    if (!href) return;
    insertHtml(
      `<p><a href="${href}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:600;">${label}</a></p>`
    );
  };

  const handleImageSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onUploadImage) return;

    setIsUploading(true);
    const uploadedUrl = await onUploadImage(file);
    setIsUploading(false);

    if (uploadedUrl) {
      insertHtml(
        `<figure style="margin:20px 0;"><img src="${uploadedUrl}" alt="" style="max-width:100%;border-radius:16px;" /></figure><p></p>`
      );
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <button type="button" className={toolbarButtonClass} onClick={() => runCommand("undo")} disabled={disabled}>
          <Undo2 size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={() => runCommand("redo")} disabled={disabled}>
          <Redo2 size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={() => runCommand("bold")} disabled={disabled}>
          <Bold size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={() => runCommand("formatBlock", "<h2>")} disabled={disabled}>
          <Heading2 size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={() => runCommand("formatBlock", "<h3>")} disabled={disabled}>
          <Heading3 size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={() => runCommand("formatBlock", "<p>")} disabled={disabled}>
          <Type size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={() => runCommand("insertUnorderedList")} disabled={disabled}>
          <List size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={() => runCommand("insertOrderedList")} disabled={disabled}>
          <ListOrdered size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={handleLink} disabled={disabled}>
          <LinkIcon size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={handleAddTable} disabled={disabled}>
          <Table size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={handleAddCta} disabled={disabled}>
          <MousePointerSquareDashed size={15} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
        >
          <ImageIcon size={15} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageSelect}
        />
        <div className="ml-auto">
          <Button variant="ghost" size="sm" disabled>
            {isUploading ? "Uploading..." : "HTML editor"}
          </Button>
        </div>
      </div>

      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        className="min-h-[320px] px-4 py-4 text-sm text-text-primary focus:outline-none [&_a]:text-cyan [&_blockquote]:border-l-4 [&_blockquote]:border-cyan/40 [&_blockquote]:pl-4 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:ml-5 [&_p]:mb-3"
      />
    </div>
  );
};

export default RichTextEditor;
