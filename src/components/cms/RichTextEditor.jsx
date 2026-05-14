import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Image as ImageIcon,
  Link as LinkIcon,
  List,
  ListOrdered,
  Table,
  MousePointerSquareDashed,
  Undo2,
  Redo2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent,
  Quote,
  Eraser,
  Subscript,
  Superscript,
  ChevronDown,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";

const toolbarButtonClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface-2 text-text-secondary transition-colors hover:border-cyan/40 hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed";

const toolbarButtonActiveClass =
  "border-cyan/60 !bg-cyan/15 !text-text-primary";

const ToolbarDivider = () => (
  <span className="hidden sm:inline-block w-px h-6 bg-border mx-0.5" aria-hidden />
);

const FONT_FAMILIES = [
  { label: "Default", value: "" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', Tahoma, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Tahoma", value: "Tahoma, Geneva, sans-serif" },
];

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72];

const HEADING_OPTIONS = [
  { label: "Normal text", tag: "p" },
  { label: "Heading 1", tag: "h1" },
  { label: "Heading 2", tag: "h2" },
  { label: "Heading 3", tag: "h3" },
  { label: "Heading 4", tag: "h4" },
  { label: "Quote", tag: "blockquote" },
];

/**
 * Word-style rich HTML editor (contentEditable + execCommand + range wrappers).
 *
 * Adds: font-family / font-size dropdowns, +/- size buttons, native colour
 * pickers, headings dropdown, clickable image resize / align popover, and
 * live active-state for bold / italic / etc.
 *
 * @param {string} value HTML string
 * @param {(html: string) => void} onChange
 * @param {(file: File) => Promise<string|null>} [onUploadImage]
 * @param {boolean} [disabled]
 * @param {import("react").ReactNode} [toolbarEnd] e.g. Preview button
 */
const RichTextEditor = ({
  value,
  onChange,
  onUploadImage,
  disabled = false,
  toolbarEnd = null,
}) => {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    sub: false,
    sup: false,
    ul: false,
    ol: false,
    alignLeft: false,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
  });
  const [headingValue, setHeadingValue] = useState("p");
  const [imageEditor, setImageEditor] = useState(null); // { top, left, img }

  /* ── Sync external value into editor without breaking the caret. ── */
  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  /* ── Track selection state for active-button styling. ── */
  const refreshState = useCallback(() => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (!editorRef.current.contains(sel.anchorNode)) return;
    setActive({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strike: document.queryCommandState("strikeThrough"),
      sub: document.queryCommandState("subscript"),
      sup: document.queryCommandState("superscript"),
      ul: document.queryCommandState("insertUnorderedList"),
      ol: document.queryCommandState("insertOrderedList"),
      alignLeft: document.queryCommandState("justifyLeft"),
      alignCenter: document.queryCommandState("justifyCenter"),
      alignRight: document.queryCommandState("justifyRight"),
      alignJustify: document.queryCommandState("justifyFull"),
    });
    /* Detect current block element for heading dropdown */
    const blockTag = (() => {
      let node = sel.anchorNode;
      while (node && node !== editorRef.current) {
        if (node.nodeType === 1) {
          const tn = node.tagName?.toLowerCase();
          if (
            ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "li"].includes(tn)
          ) {
            return tn === "li" ? "p" : tn;
          }
        }
        node = node.parentNode;
      }
      return "p";
    })();
    setHeadingValue(blockTag);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshState);
    return () => document.removeEventListener("selectionchange", refreshState);
  }, [refreshState]);

  /* ── Helpers ───────────────────────────────────────────── */

  const focusEditor = () => {
    editorRef.current?.focus();
    const range = savedRangeRef.current;
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  };

  const captureSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    if (!editorRef.current?.contains(sel.anchorNode)) return;
    savedRangeRef.current = sel.getRangeAt(0).cloneRange();
  };

  const emitChange = () => {
    onChange(editorRef.current?.innerHTML || "");
  };

  const runCommand = (command, commandValue = null) => {
    if (disabled) return;
    focusEditor();
    document.execCommand(command, false, commandValue);
    emitChange();
    refreshState();
  };

  const insertHtml = (html) => {
    if (disabled) return;
    focusEditor();
    document.execCommand("insertHTML", false, html);
    emitChange();
  };

  /**
   * Wraps the current selection in a <span> with the given inline-style.
   * Works on collapsed selections too (creates an empty styled span at caret).
   * Returns true if any change was applied.
   */
  const wrapSelectionStyle = (styleProp, styleValue) => {
    if (disabled) return false;
    focusEditor();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return false;
    const range = sel.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return false;

    if (range.collapsed) {
      const span = document.createElement("span");
      span.style[styleProp] = styleValue;
      span.appendChild(document.createTextNode("\u200B"));
      range.insertNode(span);
      const r = document.createRange();
      r.setStart(span.firstChild, 1);
      r.setEnd(span.firstChild, 1);
      sel.removeAllRanges();
      sel.addRange(r);
    } else {
      const span = document.createElement("span");
      span.style[styleProp] = styleValue;
      span.appendChild(range.extractContents());
      range.insertNode(span);
      const r = document.createRange();
      r.selectNodeContents(span);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    emitChange();
    return true;
  };

  /* ── Heading dropdown ──────────────────────────────────── */
  const applyHeading = (tag) => {
    if (disabled) return;
    focusEditor();
    document.execCommand("formatBlock", false, `<${tag}>`);
    emitChange();
    refreshState();
  };

  /* ── Font family / size dropdowns ──────────────────────── */
  const applyFontFamily = (family) => {
    if (!family) {
      wrapSelectionStyle("fontFamily", "");
      return;
    }
    wrapSelectionStyle("fontFamily", family);
  };

  const applyFontSizePx = (px) => {
    wrapSelectionStyle("fontSize", `${px}px`);
  };

  /** Get the effective font-size at the current selection (in px, integer). */
  const getSelectionFontSize = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return 16;
    let node = sel.anchorNode;
    if (!node) return 16;
    if (node.nodeType === 3) node = node.parentNode;
    if (!node) return 16;
    const cs = window.getComputedStyle(node);
    const n = parseFloat(cs.fontSize);
    return Number.isFinite(n) ? Math.round(n) : 16;
  };

  const bumpFontSize = (delta) => {
    const current = getSelectionFontSize();
    const next = Math.max(8, Math.min(120, current + delta));
    applyFontSizePx(next);
  };

  /* ── Colours (native <input type="color">) ─────────────── */
  const handleTextColor = (event) => {
    runCommand("foreColor", event.target.value);
  };
  const handleHighlight = (event) => {
    /* hiliteColor needs styleWithCSS in some browsers */
    document.execCommand("styleWithCSS", false, true);
    runCommand("hiliteColor", event.target.value);
    document.execCommand("styleWithCSS", false, false);
  };

  /* ── Link ──────────────────────────────────────────────── */
  const handleLink = () => {
    const sel = window.getSelection();
    const hasSelection = sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode);
    const url = window.prompt("Enter link URL (https://…)", "https://");
    if (!url) return;
    if (hasSelection) {
      runCommand("createLink", url);
    } else {
      const label = window.prompt("Link text", "Click here") || url;
      insertHtml(`<a href="${url}">${label}</a>`);
    }
  };

  /* ── Table / CTA / Image ───────────────────────────────── */
  const handleAddTable = () => {
    const cols = Math.max(1, Math.min(8, Number(window.prompt("Number of columns?", "3")) || 3));
    const rows = Math.max(1, Math.min(20, Number(window.prompt("Number of rows?", "3")) || 3));

    const th = Array.from({ length: cols })
      .map(
        (_, i) =>
          `<th style="border:1px solid #d1d5db;padding:10px;text-align:left;background:#f3f4f6;">Header ${i + 1}</th>`
      )
      .join("");
    const bodyRows = Array.from({ length: rows })
      .map(
        () =>
          `<tr>${Array.from({ length: cols })
            .map(
              () => `<td style="border:1px solid #d1d5db;padding:10px;">&nbsp;</td>`
            )
            .join("")}</tr>`
      )
      .join("");

    insertHtml(
      `<table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr>${th}</tr></thead><tbody>${bodyRows}</tbody></table><p><br/></p>`
    );
  };

  const handleAddCta = () => {
    const label = window.prompt("Button label", "Start Application");
    if (!label) return;
    const href = window.prompt("Button link", "/apply");
    if (!href) return;
    insertHtml(
      `<p><a href="${href}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#0284c7;color:#ffffff;text-decoration:none;font-weight:600;">${label}</a></p><p><br/></p>`
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
      focusEditor();
      insertHtml(
        `<figure style="margin:20px 0;text-align:center;"><img src="${uploadedUrl}" alt="" style="max-width:100%;border-radius:16px;display:inline-block;" /></figure><p><br/></p>`
      );
    }
  };

  /* ── Image click → resize / align popover ──────────────── */
  const handleEditorClick = (event) => {
    const target = event.target;
    if (target?.tagName === "IMG") {
      event.preventDefault();
      const editorRect = editorRef.current.getBoundingClientRect();
      const imgRect = target.getBoundingClientRect();
      setImageEditor({
        img: target,
        top: imgRect.top - editorRect.top - 44,
        left: Math.max(0, imgRect.left - editorRect.left),
      });
      /* Visual selection ring */
      Array.from(editorRef.current.querySelectorAll("img")).forEach((img) => {
        img.style.outline = "";
      });
      target.style.outline = "3px solid #06b6d4";
      target.style.outlineOffset = "2px";
    } else {
      closeImageEditor();
    }
  };

  const closeImageEditor = () => {
    if (imageEditor?.img) {
      imageEditor.img.style.outline = "";
      imageEditor.img.style.outlineOffset = "";
    }
    setImageEditor(null);
  };

  const setImageWidth = (widthCss) => {
    if (!imageEditor?.img) return;
    imageEditor.img.style.width = widthCss;
    imageEditor.img.style.height = "auto";
    emitChange();
  };

  const setImageAlign = (align) => {
    if (!imageEditor?.img) return;
    const img = imageEditor.img;
    const fig = img.closest("figure");
    if (align === "center") {
      img.style.display = "inline-block";
      img.style.marginLeft = "auto";
      img.style.marginRight = "auto";
      img.style.float = "";
      if (fig) fig.style.textAlign = "center";
    } else if (align === "left") {
      img.style.display = "inline-block";
      img.style.float = "left";
      img.style.marginRight = "16px";
      img.style.marginLeft = "0";
      if (fig) fig.style.textAlign = "left";
    } else if (align === "right") {
      img.style.display = "inline-block";
      img.style.float = "right";
      img.style.marginLeft = "16px";
      img.style.marginRight = "0";
      if (fig) fig.style.textAlign = "right";
    }
    emitChange();
  };

  const deleteImage = () => {
    if (!imageEditor?.img) return;
    const img = imageEditor.img;
    const fig = img.closest("figure");
    (fig || img).remove();
    closeImageEditor();
    emitChange();
  };

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div className="rounded-2xl border border-border bg-background relative">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border p-2 sm:p-3">
        {/* History */}
        <button type="button" className={toolbarButtonClass} onClick={() => runCommand("undo")} disabled={disabled} title="Undo (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={() => runCommand("redo")} disabled={disabled} title="Redo (Ctrl+Y)">
          <Redo2 size={15} />
        </button>
        <ToolbarDivider />

        {/* Heading style */}
        <div className="relative">
          <select
            value={headingValue}
            onChange={(e) => applyHeading(e.target.value)}
            onMouseDown={captureSelection}
            disabled={disabled}
            className="appearance-none h-9 pr-7 pl-2.5 rounded-lg border border-border bg-surface-2 text-xs font-semibold text-text-secondary hover:border-cyan/40 focus:outline-none focus:border-cyan/60"
            title="Paragraph style"
          >
            {HEADING_OPTIONS.map((o) => (
              <option key={o.tag} value={o.tag}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
        </div>

        {/* Font family */}
        <div className="relative">
          <select
            defaultValue=""
            onChange={(e) => { applyFontFamily(e.target.value); e.target.value = ""; }}
            onMouseDown={captureSelection}
            disabled={disabled}
            className="appearance-none h-9 pr-7 pl-2.5 rounded-lg border border-border bg-surface-2 text-xs font-semibold text-text-secondary hover:border-cyan/40 focus:outline-none focus:border-cyan/60 max-w-[140px]"
            title="Font family"
          >
            <option value="">Font…</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f.label} value={f.value} style={{ fontFamily: f.value || "inherit" }}>
                {f.label}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
        </div>

        {/* Font size dropdown + +/- */}
        <div className="inline-flex items-center gap-0.5">
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => bumpFontSize(-2)}
            disabled={disabled}
            title="Decrease font size"
          >
            <Minus size={14} />
          </button>
          <div className="relative">
            <select
              defaultValue=""
              onChange={(e) => { applyFontSizePx(Number(e.target.value)); e.target.value = ""; }}
              onMouseDown={captureSelection}
              disabled={disabled}
              className="appearance-none h-9 w-[68px] pr-6 pl-2.5 rounded-lg border border-border bg-surface-2 text-xs font-semibold text-text-secondary hover:border-cyan/40 focus:outline-none focus:border-cyan/60"
              title="Font size"
            >
              <option value="">Size</option>
              {FONT_SIZES.map((s) => (
                <option key={s} value={s}>{s}px</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted" />
          </div>
          <button
            type="button"
            className={toolbarButtonClass}
            onClick={() => bumpFontSize(2)}
            disabled={disabled}
            title="Increase font size"
          >
            <Plus size={14} />
          </button>
        </div>
        <ToolbarDivider />

        {/* Inline formatting */}
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.bold ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("bold")}
          disabled={disabled}
          title="Bold (Ctrl+B)"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.italic ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("italic")}
          disabled={disabled}
          title="Italic (Ctrl+I)"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.underline ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("underline")}
          disabled={disabled}
          title="Underline (Ctrl+U)"
        >
          <Underline size={15} />
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.strike ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("strikeThrough")}
          disabled={disabled}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.sub ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("subscript")}
          disabled={disabled}
          title="Subscript"
        >
          <Subscript size={15} />
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.sup ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("superscript")}
          disabled={disabled}
          title="Superscript"
        >
          <Superscript size={15} />
        </button>
        <ToolbarDivider />

        {/* Colour pickers (native swatches) */}
        <label className={`${toolbarButtonClass} relative cursor-pointer`} title="Text colour">
          <span className="text-[11px] font-bold leading-none">A</span>
          <span className="absolute bottom-1 left-1.5 right-1.5 h-1 rounded-sm bg-cyan" />
          <input
            type="color"
            onChange={handleTextColor}
            onMouseDown={captureSelection}
            disabled={disabled}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <label className={`${toolbarButtonClass} relative cursor-pointer`} title="Highlight colour">
          <span className="text-[11px] font-bold leading-none">H</span>
          <span className="absolute bottom-1 left-1.5 right-1.5 h-1 rounded-sm bg-yellow-300" />
          <input
            type="color"
            defaultValue="#fef08a"
            onChange={handleHighlight}
            onMouseDown={captureSelection}
            disabled={disabled}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </label>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => runCommand("removeFormat")}
          disabled={disabled}
          title="Clear formatting"
        >
          <Eraser size={15} />
        </button>
        <ToolbarDivider />

        {/* Quote (kept as quick button, headings dropdown handles it too) */}
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => runCommand("formatBlock", "<blockquote>")}
          disabled={disabled}
          title="Quote"
        >
          <Quote size={15} />
        </button>

        {/* Lists & indent */}
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.ul ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("insertUnorderedList")}
          disabled={disabled}
          title="Bullet list"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.ol ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("insertOrderedList")}
          disabled={disabled}
          title="Numbered list"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => runCommand("indent")}
          disabled={disabled}
          title="Increase indent"
        >
          <Indent size={15} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => runCommand("outdent")}
          disabled={disabled}
          title="Decrease indent"
        >
          <Indent size={15} className="scale-x-[-1]" />
        </button>
        <ToolbarDivider />

        {/* Alignment */}
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.alignLeft ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("justifyLeft")}
          disabled={disabled}
          title="Align left"
        >
          <AlignLeft size={15} />
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.alignCenter ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("justifyCenter")}
          disabled={disabled}
          title="Align center"
        >
          <AlignCenter size={15} />
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.alignRight ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("justifyRight")}
          disabled={disabled}
          title="Align right"
        >
          <AlignRight size={15} />
        </button>
        <button
          type="button"
          className={`${toolbarButtonClass} ${active.alignJustify ? toolbarButtonActiveClass : ""}`}
          onClick={() => runCommand("justifyFull")}
          disabled={disabled}
          title="Justify"
        >
          <AlignJustify size={15} />
        </button>
        <ToolbarDivider />

        {/* Insert: link / table / cta / image */}
        <button type="button" className={toolbarButtonClass} onClick={handleLink} disabled={disabled} title="Insert / edit link">
          <LinkIcon size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={handleAddTable} disabled={disabled} title="Insert table">
          <Table size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={handleAddCta} disabled={disabled} title="Insert CTA button">
          <MousePointerSquareDashed size={15} />
        </button>
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || isUploading}
          title="Insert image"
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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {toolbarEnd}
          <span className="text-[10px] uppercase tracking-wider text-text-muted hidden lg:inline">
            {isUploading ? "Uploading…" : "Rich text"}
          </span>
        </div>
      </div>

      {/* ── Floating image popover ── */}
      {imageEditor ? (
        <div
          className="absolute z-20 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface shadow-modal p-1.5"
          style={{ top: Math.max(0, imageEditor.top), left: imageEditor.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          {[
            { label: "25%", value: "25%" },
            { label: "50%", value: "50%" },
            { label: "75%", value: "75%" },
            { label: "100%", value: "100%" },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setImageWidth(s.value)}
              className="px-2 py-1 rounded-md text-[11px] font-semibold text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            >
              {s.label}
            </button>
          ))}
          <span className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onClick={() => setImageAlign("left")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Align left"
          >
            <AlignLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => setImageAlign("center")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Align center"
          >
            <AlignCenter size={13} />
          </button>
          <button
            type="button"
            onClick={() => setImageAlign("right")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Align right"
          >
            <AlignRight size={13} />
          </button>
          <span className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onClick={deleteImage}
            className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10"
            title="Delete image"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ) : null}

      {/* ── Editable surface ── */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
        onClick={handleEditorClick}
        onBlur={captureSelection}
        className="min-h-[400px] px-4 py-4 text-sm text-text-primary focus:outline-none
          [&_a]:text-cyan [&_a]:underline
          [&_blockquote]:border-l-4 [&_blockquote]:border-cyan/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4
          [&_h1]:mt-6 [&_h1]:text-3xl [&_h1]:font-bold
          [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold
          [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold
          [&_h4]:mt-4 [&_h4]:text-lg [&_h4]:font-semibold
          [&_li]:ml-5 [&_ul]:list-disc [&_ol]:list-decimal [&_p]:mb-3
          [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
          [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:px-3 [&_td]:py-2 [&_th]:bg-surface-2 [&_th]:text-left
          [&_img]:max-w-full [&_img]:rounded-xl [&_img]:cursor-pointer"
      />

      <div className="px-4 py-2 border-t border-border text-[11px] text-text-muted flex flex-wrap gap-x-4 gap-y-1">
        <span>Tip: select text, then change size, colour, or family.</span>
        <span>Click any image to resize or align it.</span>
      </div>
    </div>
  );
};

export default RichTextEditor;
