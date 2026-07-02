import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Image as ImageIcon,
  ExternalLink,
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
  ChevronUp,
  Plus,
  Minus,
  Trash2,
  MoveHorizontal,
  Move,
  Type,
  Pin,
  BoxSelect,
  Shapes,
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

const CustomPromptModal = ({ config }) => {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (config) {
      setValue(config.defaultValue || "");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [config]);

  if (!config) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    config.onResolve(value);
  };

  const handleCancel = () => {
    config.onResolve(null);
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
      <div className="bg-white border border-gray-200 shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden flex flex-col">
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{config.title}</h3>
          <div className="space-y-4">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  config.onResolve(value);
                }
              }}
              className="w-full px-4 py-2.5 bg-gray-50 border border-gray-300 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm text-gray-900 mb-6"
            />
            <div className="flex justify-between items-center gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="px-5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 font-semibold transition-colors flex-1 shadow-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => config.onResolve(value)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors flex-1 shadow-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  const wrapperRef = useRef(null);
  const fileInputRef = useRef(null);
  const savedRangeRef = useRef(null);
  const draggedRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [promptConfig, setPromptConfig] = useState(null);
  const promptAsync = useCallback((title, defaultValue = "") => {
    return new Promise((resolve) => {
      setTimeout(() => {
        setPromptConfig({
          title,
          defaultValue,
          onResolve: (val) => {
            setPromptConfig(null);
            resolve(val);
          },
        });
      }, 0);
    });
  }, []);

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
  const [imageEditor, setImageEditor] = useState(null);
  const [tableEditor, setTableEditor] = useState(null);
  const [groupEditor, setGroupEditor] = useState(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  
  const [shapeEditor, setShapeEditor] = useState(null);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [showShapesDropdown, setShowShapesDropdown] = useState(false);

  const lastHtmlRef = useRef(value || "");

  /* ── Sync external value into editor without breaking the caret. ── */
  useEffect(() => {
    if (!editorRef.current) return;
    if (value !== lastHtmlRef.current) {
      editorRef.current.innerHTML = value || "";
      lastHtmlRef.current = value || "";
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

  /* ── Make images draggable via MutationObserver ──────────── */
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const markDraggable = () => {
      el.querySelectorAll("img").forEach((img) => {
        if (!img.hasAttribute("draggable")) img.setAttribute("draggable", "true");
      });
    };
    markDraggable();
    const obs = new MutationObserver(markDraggable);
    obs.observe(el, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  /* ── Image drag-and-drop ───────────────────────────────── */
  const handleDragStart = (e) => {
    const img = e.target.closest("img");
    if (!img || !editorRef.current?.contains(img)) return;
    draggedRef.current = img;
    setIsDraggingImage(true);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", img.outerHTML);
  };

  const handleDragOver = (e) => {
    if (!draggedRef.current) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnd = () => {
    draggedRef.current = null;
    setIsDraggingImage(false);
  };

  const handleDrop = (e) => {
    const draggedImg = draggedRef.current;
    draggedRef.current = null;
    setIsDraggingImage(false);
    closeImageEditor();
    closeTableEditor();
    if (!draggedImg || !editorRef.current?.contains(draggedImg)) return;
    e.preventDefault();
    const point = document.caretRangeFromPoint
      ? document.caretRangeFromPoint(e.clientX, e.clientY)
      : document.caretPositionFromPoint?.(e.clientX, e.clientY);
    if (!point) return;
    const range = point.commonAncestorContainer ? { startContainer: point, startOffset: 0 } : point;
    const fig = draggedImg.closest("figure") || draggedImg;
    const parent = fig.parentNode;
    if (!parent) return;
    const atNode = range.startContainer;
    if (fig.contains(atNode) || fig === atNode) return;
    
    let refNode = atNode;
    if (refNode.nodeType === 3) refNode = refNode.parentNode;
    
    let blockNode = refNode;
    while (blockNode && blockNode !== editorRef.current && !['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI'].includes(blockNode.tagName?.toUpperCase())) {
      blockNode = blockNode.parentNode;
    }
    
    if (blockNode && blockNode !== editorRef.current && blockNode.parentNode) {
      blockNode.parentNode.insertBefore(fig, blockNode);
    } else {
      const offset = range.startOffset;
      const insertBefore = refNode.childNodes[offset] || null;
      if (insertBefore === fig || insertBefore?.parentNode === fig) return;
      refNode.insertBefore(fig, insertBefore);
    }
    
    parent.normalize();
    editorRef.current?.focus();
    emitChange();
  };

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
    if (!editorRef.current) return;
    
    // Create a temporary clone to strip selection outlines before saving
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = editorRef.current.innerHTML;
    
    const elementsToClean = tempDiv.querySelectorAll("img, table, .resizable-group, [data-type='shape']");
    elementsToClean.forEach(el => {
      el.style.outline = "";
      el.style.outlineOffset = "";
      // If style attribute is now completely empty, remove it to keep HTML clean
      if (!el.getAttribute("style")) {
        el.removeAttribute("style");
      }
    });
    
    const cleanedHtml = tempDiv.innerHTML || "";
    lastHtmlRef.current = cleanedHtml;
    onChange(cleanedHtml);
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
  const handleLink = async () => {
    const sel = window.getSelection();
    const hasSelection = sel && !sel.isCollapsed && editorRef.current?.contains(sel.anchorNode);
    let savedRange = null;
    if (hasSelection) savedRange = sel.getRangeAt(0);

    const url = await promptAsync("Enter link URL (https://…)", "https://");
    if (!url) return;
    
    focusEditor();
    if (savedRange) {
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(savedRange);
    }

    if (hasSelection) {
      runCommand("createLink", url);
    } else {
      const label = await promptAsync("Link text", "Click here") || url;
      if (!label) return;
      focusEditor();
      insertHtml(`<a href="${url}">${label}</a>`);
    }
  };

  /* ── Table / CTA / Image ───────────────────────────────── */
  const handleAddTable = async () => {
    const colsStr = await promptAsync("Number of columns?", "3");
    if (!colsStr) return;
    const cols = Math.max(1, Math.min(8, Number(colsStr) || 3));
    
    const rowsStr = await promptAsync("Number of rows?", "3");
    if (!rowsStr) return;
    const rows = Math.max(1, Math.min(20, Number(rowsStr) || 3));

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

    focusEditor();
    insertHtml(
      `<table style="width:100%;border-collapse:collapse;margin:16px 0;"><thead><tr>${th}</tr></thead><tbody>${bodyRows}</tbody></table><p><br/></p>`
    );
  };

  const handleAddCta = async () => {
    const label = await promptAsync("Button label", "Start Application");
    if (!label) return;
    const href = await promptAsync("Button link", "/apply");
    if (!href) return;
    focusEditor();
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
      const imgHtml = `<img src="${uploadedUrl}" alt="" style="max-width:100%;display:inline-block;" />`;
      insertHtml(
        `<figure style="margin:20px 0;text-align:center;">${imgHtml}</figure><p><br/></p>`
      );
    }
  };

  /* ── Insert image from URL ─────────────────────────────── */
  const handleAddImageUrl = async () => {
    const url = await promptAsync("Enter image URL (https://…)", "https://");
    if (!url) return;
    focusEditor();
    insertHtml(
      `<figure style="margin:20px 0;text-align:center;"><img src="${url}" alt="" style="max-width:100%;display:inline-block;" /></figure><p><br/></p>`
    );
  };

  /* ── Insert Shapes ─────────────────────────────── */
  const handleAddShape = (shapeType) => {
    setShowShapesDropdown(false);
    focusEditor();
    let svgContent = "";
    if (shapeType === "rectangle") {
      svgContent = `<rect width="100%" height="100%" fill="#3b82f6" />`;
    } else if (shapeType === "circle") {
      svgContent = `<ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill="#3b82f6" />`;
    } else if (shapeType === "triangle") {
      svgContent = `<polygon points="50,0 100,100 0,100" fill="#3b82f6" style="transform-origin: center; transform: scale(1);" />`;
    } else if (shapeType === "star") {
      svgContent = `<polygon points="50,5 61,40 98,40 68,62 79,96 50,75 21,96 32,62 2,40 39,40" fill="#3b82f6" />`;
    }

    const html = `<span data-type="shape" data-shape="${shapeType}" data-fill="#3b82f6" contenteditable="false" style="display:inline-block; width:100px; height:100px; margin: 0 4px; vertical-align: middle; cursor: pointer;">
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none" style="pointer-events: none;">
        ${svgContent}
      </svg>
    </span>&nbsp;`;
    insertHtml(html);
  };

  /* ── Group / Resize Block ──────────────────────────────── */
  const handleGroup = () => {
    captureSelection();
    focusEditor();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    
    let blockNode = range.startContainer;
    if (blockNode.nodeType === 3) blockNode = blockNode.parentNode;
    while (blockNode && blockNode !== editorRef.current && !['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI'].includes(blockNode.tagName?.toUpperCase())) {
      blockNode = blockNode.parentNode;
    }
    
    if (blockNode && blockNode !== editorRef.current) {
      if (blockNode.classList.contains("resizable-group") || blockNode.closest(".resizable-group")) return; 
      
      const groupDiv = document.createElement("div");
      groupDiv.className = "resizable-group";
      groupDiv.style.width = "50%";
      groupDiv.style.maxWidth = "100%";
      groupDiv.style.minWidth = "100px";
      groupDiv.style.display = "block";
      groupDiv.style.margin = "0 auto";
      groupDiv.style.padding = "10px";
      groupDiv.style.outline = "1px dashed transparent";
      
      blockNode.parentNode.insertBefore(groupDiv, blockNode);
      groupDiv.appendChild(blockNode);
      
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const groupRect = groupDiv.getBoundingClientRect();
      setGroupEditor({
        group: groupDiv,
        top: groupRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
        left: Math.max(0, groupRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
        groupTop: groupRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0),
        groupLeft: groupRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0),
        groupWidth: groupRect.width,
        groupHeight: groupRect.height,
      });
      groupDiv.style.outline = "2px solid #06b6d4";
      
      emitChange();
    }
  };

  /* ── Image / Table click → popover ─────────────────────── */
  const handleEditorClick = (event) => {
    const target = event.target;
    
    if (target === editorRef.current || target.closest('figure')) {
      const lastChild = editorRef.current.lastElementChild;
      if (lastChild && target === editorRef.current) {
        const lastRect = lastChild.getBoundingClientRect();
        if (event.clientY > lastRect.bottom + 10) {
          const gap = event.clientY - lastRect.bottom;
          const numParas = Math.floor(gap / 24);
          if (numParas > 0) {
            for (let i = 0; i < numParas; i++) {
              const p = document.createElement("p");
              p.innerHTML = "<br/>";
              editorRef.current.appendChild(p);
            }
            emitChange();
          }
          const sel = window.getSelection();
          const r = document.createRange();
          r.selectNodeContents(editorRef.current);
          r.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(r);
          return; // Click was handled by vertical pad
        }
      }
      // Let native text alignment handle horizontal click placement
    }

    const group = target?.closest?.(".resizable-group");
    if (group && editorRef.current?.contains(group)) {
      closeImageEditor();
      closeTableEditor();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      setGroupEditor({
        group,
        top: groupRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
        left: Math.max(0, groupRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
        groupTop: groupRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0),
        groupLeft: groupRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0),
        groupWidth: groupRect.width,
        groupHeight: groupRect.height,
      });
      Array.from(editorRef.current.querySelectorAll(".resizable-group")).forEach((g) => {
        g.style.outline = "1px dashed transparent";
      });
      group.style.outline = "2px solid #06b6d4";
      return;
    } else {
      closeGroupEditor();
    }

    const table = target?.closest?.("table");
    if (table && editorRef.current?.contains(table)) {
      event.preventDefault();
      closeImageEditor();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const cell = target?.closest?.("td, th");
      setTableEditor({
        table,
        cell,
        top: tableRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
        left: Math.max(0, tableRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
      });
      Array.from(editorRef.current.querySelectorAll("table")).forEach((t) => {
        t.style.outline = "";
      });
      table.style.outline = "2px solid #06b6d4";
      return;
    }
    if (target?.tagName === "IMG") {
      event.preventDefault();
      closeTableEditor();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const imgRect = target.getBoundingClientRect();
      setImageEditor({
        img: target,
        top: imgRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
        left: Math.max(0, imgRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
        imgTop: imgRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0),
        imgLeft: imgRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0),
        imgWidth: imgRect.width,
        imgHeight: imgRect.height,
      });
      Array.from(editorRef.current.querySelectorAll("img")).forEach((img) => {
        img.style.outline = "";
      });
      target.style.outline = "3px solid #06b6d4";
      target.style.outlineOffset = "2px";
      return;
    }
    
    const shape = target?.closest?.("[data-type='shape']");
    if (shape && editorRef.current?.contains(shape)) {
      event.preventDefault();
      closeImageEditor();
      closeTableEditor();
      closeGroupEditor();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();
      const shapeRect = shape.getBoundingClientRect();
      setShapeEditor({
        shape,
        top: shapeRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
        left: Math.max(0, shapeRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
        shapeTop: shapeRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0),
        shapeLeft: shapeRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0),
        shapeWidth: shapeRect.width,
        shapeHeight: shapeRect.height,
      });
      Array.from(editorRef.current.querySelectorAll("[data-type='shape']")).forEach((s) => {
        s.style.outline = "";
      });
      shape.style.outline = "3px solid #06b6d4";
      shape.style.outlineOffset = "2px";
    } else {
      closeImageEditor();
      closeTableEditor();
      closeGroupEditor();
      closeShapeEditor();
    }
  };

  const closeGroupEditor = () => {
    if (groupEditor?.group) {
      groupEditor.group.style.outline = "1px dashed transparent";
    }
    setGroupEditor(null);
  };

  const closeShapeEditor = () => {
    if (shapeEditor?.shape) {
      shapeEditor.shape.style.outline = "";
    }
    setShapeEditor(null);
  };

  const closeImageEditor = () => {
    if (imageEditor?.img) {
      imageEditor.img.style.outline = "";
      imageEditor.img.style.outlineOffset = "";
    }
    setImageEditor(null);
  };

  const closeTableEditor = () => {
    if (tableEditor?.table) {
      tableEditor.table.style.outline = "";
    }
    setTableEditor(null);
  };

  const handleCornerResizeStart = (e, corner) => {
    e.preventDefault();
    e.stopPropagation();
    if (!imageEditor?.img) return;
    const img = imageEditor.img;
    const startX = e.clientX;
    const startWidth = img.getBoundingClientRect().width;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth;
      
      if (corner === 'ne' || corner === 'se') {
        newWidth = startWidth + deltaX;
      } else {
        newWidth = startWidth - deltaX;
      }
      
      newWidth = Math.max(50, newWidth);
      img.style.width = `${newWidth}px`;
      img.style.height = "auto";

      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      
      if (wrapperRect) {
        setImageEditor((prev) => ({
          ...prev,
          imgTop: imgRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0),
          imgLeft: imgRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0),
          imgWidth: imgRect.width,
          imgHeight: imgRect.height,
          top: imgRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
          left: Math.max(0, imgRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
        }));
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      emitChange();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleShapeCornerResizeStart = (e, corner) => {
    e.preventDefault();
    e.stopPropagation();
    if (!shapeEditor?.shape) return;
    const shape = shapeEditor.shape;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = shape.getBoundingClientRect().width;
    const startHeight = shape.getBoundingClientRect().height;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      let newWidth = startWidth;
      let newHeight = startHeight;
      
      if (corner === 'ne' || corner === 'se') {
        newWidth = startWidth + deltaX;
      } else {
        newWidth = startWidth - deltaX;
      }

      if (corner === 'se' || corner === 'sw') {
        newHeight = startHeight + deltaY;
      } else {
        newHeight = startHeight - deltaY;
      }
      
      newWidth = Math.max(20, newWidth);
      newHeight = Math.max(20, newHeight);
      
      shape.style.width = `${newWidth}px`;
      shape.style.height = `${newHeight}px`;

      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const shapeRect = shape.getBoundingClientRect();
      
      if (wrapperRect) {
        setShapeEditor((prev) => ({
          ...prev,
          shapeTop: shapeRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0),
          shapeLeft: shapeRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0),
          shapeWidth: shapeRect.width,
          shapeHeight: shapeRect.height,
          top: shapeRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
          left: Math.max(0, shapeRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
        }));
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      emitChange();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleGroupCornerResizeStart = (e, corner) => {
    e.preventDefault();
    e.stopPropagation();
    if (!groupEditor?.group) return;
    const group = groupEditor.group;
    const startX = e.clientX;
    const startWidth = group.getBoundingClientRect().width;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      let newWidth = startWidth;
      
      if (corner === 'ne' || corner === 'se') {
        newWidth = startWidth + deltaX;
      } else {
        newWidth = startWidth - deltaX;
      }
      
      newWidth = Math.max(100, newWidth);
      group.style.width = `${newWidth}px`;

      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      
      if (wrapperRect) {
        setGroupEditor((prev) => ({
          ...prev,
          groupTop: groupRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0),
          groupLeft: groupRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0),
          groupWidth: groupRect.width,
          groupHeight: groupRect.height,
          top: groupRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
          left: Math.max(0, groupRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
        }));
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      emitChange();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleUngroup = () => {
    if (!groupEditor?.group) return;
    const group = groupEditor.group;
    const parent = group.parentNode;
    while (group.firstChild) {
      parent.insertBefore(group.firstChild, group);
    }
    group.remove();
    closeGroupEditor();
    emitChange();
  };

  const handleGroupMoveStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!groupEditor?.group) return;
    const group = groupEditor.group;
    const startX = e.clientX;
    const startY = e.clientY;
    
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    const editorWidth = editorRef.current?.clientWidth || 800;
    const groupWidth = group.offsetWidth;
    const groupRect = group.getBoundingClientRect();
    
    const startVisualLeft = groupRect.left - (wrapperRect?.left || 0) - 16;
    const style = window.getComputedStyle(group);
    const startMarginTop = parseInt(style.marginTop) || 0;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      let targetX = startVisualLeft + deltaX;
      let newMarginTop = startMarginTop + deltaY;
      
      const maxTargetX = editorWidth - groupWidth - 32;
      targetX = Math.max(0, Math.min(targetX, maxTargetX));
      
      const groupCenter = targetX + groupWidth / 2;
      const editorCenter = editorWidth / 2;
      
      if (Math.abs(groupCenter - editorCenter) < 50) {
        group.style.float = "none";
        group.style.marginLeft = "auto";
        group.style.marginRight = "auto";
      } else if (groupCenter > editorCenter) {
        group.style.float = "right";
        group.style.marginRight = `${Math.max(0, editorWidth - (targetX + groupWidth + 32))}px`;
        group.style.marginLeft = "20px";
      } else {
        group.style.float = "left";
        group.style.marginLeft = `${targetX}px`;
        group.style.marginRight = "20px";
      }
      
      group.style.marginTop = `${newMarginTop}px`;
      
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const groupRect = group.getBoundingClientRect();
      
      if (wrapperRect) {
        setGroupEditor((prev) => ({
          ...prev,
          groupTop: groupRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0),
          groupLeft: groupRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0),
          groupWidth: groupRect.width,
          groupHeight: groupRect.height,
          top: groupRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
          left: Math.max(0, groupRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
        }));
      }
    };
    
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      emitChange();
    };
    
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleMoveStart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!imageEditor?.img) return;
    const img = imageEditor.img;
    const fig = img.closest("figure") || img;
    
    if (fig.style.display === "grid") {
      fig.style.display = "block";
      fig.style.gridTemplateColumns = "";
      fig.style.gap = "";
      fig.style.alignItems = "";
      
      const divs = fig.querySelectorAll("div");
      if (divs.length === 2) {
        while(divs[0].firstChild) {
          if (divs[0].firstChild.nodeName !== "BR") fig.insertBefore(divs[0].firstChild, divs[0]);
          else divs[0].removeChild(divs[0].firstChild);
        }
        divs[0].remove();
        
        while(divs[1].firstChild) {
          if (divs[1].firstChild.nodeName !== "BR") fig.appendChild(divs[1].firstChild);
          else divs[1].removeChild(divs[1].firstChild);
        }
        divs[1].remove();
      }
    }
    
    if (img.style.display === "inline-block") {
      img.style.display = "block";
      fig.style.display = "block";
    }

    const startX = e.clientX;
    const startY = e.clientY;
    
    const wrapperRect = wrapperRef.current?.getBoundingClientRect();
    const editorWidth = editorRef.current?.clientWidth || 800;
    const imgWidth = img.offsetWidth;
    const imgRect = img.getBoundingClientRect();
    
    // Always calculate from absolute visual position to handle float switching smoothly
    const startVisualLeft = imgRect.left - (wrapperRect?.left || 0) - 16;
    const style = window.getComputedStyle(fig);
    const startMarginTop = parseInt(style.marginTop) || 0;
    
    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      let targetX = startVisualLeft + deltaX;
      let newMarginTop = startMarginTop + deltaY;
      
      const maxTargetX = editorWidth - imgWidth - 32;
      targetX = Math.max(0, Math.min(targetX, maxTargetX));
      
      const imgCenter = targetX + imgWidth / 2;
      const editorCenter = editorWidth / 2;
      
      // Dynamic Float based on X position to allow text wrapping
      if (Math.abs(imgCenter - editorCenter) < 50) {
        // Center snap (no text wrapping)
        fig.style.float = "none";
        fig.style.marginLeft = "auto";
        fig.style.marginRight = "auto";
        fig.style.textAlign = "center";
      } else if (imgCenter > editorCenter) {
        // Right half (Float Right)
        fig.style.float = "right";
        fig.style.marginRight = `${Math.max(0, editorWidth - (targetX + imgWidth + 32))}px`;
        fig.style.marginLeft = "20px";
        fig.style.textAlign = "";
      } else {
        // Left half (Float Left)
        fig.style.float = "left";
        fig.style.marginLeft = `${targetX}px`;
        fig.style.marginRight = "20px";
        fig.style.textAlign = "";
      }
      
      fig.style.marginTop = `${newMarginTop}px`;
      
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      if (wrapperRect) {
        setImageEditor((prev) => ({
          ...prev,
          imgTop: imgRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0),
          imgLeft: imgRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0),
          imgWidth: imgRect.width,
          imgHeight: imgRect.height,
          top: imgRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
          left: Math.max(0, imgRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
        }));
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      
      let currentMarginTop = parseInt(fig.style.marginTop) || 0;
      if (currentMarginTop > 24) {
        const numParas = Math.floor(currentMarginTop / 24);
        currentMarginTop = currentMarginTop % 24;
        for (let i = 0; i < numParas; i++) {
          const p = document.createElement("p");
          p.innerHTML = "<br/>";
          fig.parentNode.insertBefore(p, fig);
        }
      } else if (currentMarginTop < 0) {
        let prev = fig.previousElementSibling;
        while (prev && currentMarginTop <= -24 && prev.tagName === 'P' && (prev.innerHTML === '<br>' || prev.innerHTML === '<br/>' || prev.innerHTML === '')) {
          const toRemove = prev;
          prev = prev.previousElementSibling;
          toRemove.remove();
          currentMarginTop += 24;
        }
        currentMarginTop = Math.max(0, currentMarginTop);
      }
      
      fig.style.marginTop = `${currentMarginTop}px`;
      emitChange();
      
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const imgRect = img.getBoundingClientRect();
      if (wrapperRect) {
        setImageEditor((prev) => ({
          ...prev,
          imgTop: imgRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0),
          imgLeft: imgRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0),
          imgWidth: imgRect.width,
          imgHeight: imgRect.height,
          top: imgRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44,
          left: Math.max(0, imgRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)),
        }));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const moveTable = (direction) => {
    if (!tableEditor?.table) return;
    const table = tableEditor.table;
    const sibling = direction === "up" ? table.previousElementSibling : table.nextElementSibling;
    if (!sibling) return;
    if (direction === "up") {
      table.parentNode?.insertBefore(table, sibling);
    } else {
      table.parentNode?.insertBefore(sibling, table);
    }
    emitChange();
    const wrapperRect = wrapperRef.current.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    setTableEditor((prev) => prev ? { ...prev, top: tableRect.top - wrapperRect.top + (wrapperRef.current?.scrollTop || 0) - 44, left: Math.max(0, tableRect.left - wrapperRect.left + (wrapperRef.current?.scrollLeft || 0)) } : null);
  };

  const tableAddRow = (position = 'below') => {
    if (!tableEditor?.table || !tableEditor?.cell) return;
    const tr = tableEditor.cell.closest("tr");
    if (!tr) return;
    const cols = tr.children.length;
    const newTr = document.createElement("tr");
    for (let i = 0; i < cols; i++) {
      const td = document.createElement("td");
      td.style.border = "1px solid #d1d5db";
      td.style.padding = "10px";
      td.innerHTML = "&nbsp;";
      newTr.appendChild(td);
    }
    if (position === 'above') {
      tr.parentNode.insertBefore(newTr, tr);
    } else {
      tr.parentNode.insertBefore(newTr, tr.nextSibling);
    }
    emitChange();
  };

  const tableAddCol = (position = 'right') => {
    if (!tableEditor?.table || !tableEditor?.cell) return;
    const cell = tableEditor.cell;
    const tr = cell.closest("tr");
    if (!tr) return;
    const index = Array.from(tr.children).indexOf(cell);
    const table = tableEditor.table;
    const rows = table.querySelectorAll("tr");
    
    rows.forEach(row => {
      const isHeader = row.closest("thead") !== null || row.querySelector("th") !== null;
      const newCell = document.createElement(isHeader ? "th" : "td");
      newCell.style.border = "1px solid #d1d5db";
      newCell.style.padding = "10px";
      if (isHeader) {
        newCell.style.textAlign = "left";
        newCell.style.background = "#f3f4f6";
        newCell.textContent = "New";
      } else {
        newCell.innerHTML = "&nbsp;";
      }
      
      const targetCell = row.children[index];
      if (position === 'left') {
        row.insertBefore(newCell, targetCell);
      } else {
        row.insertBefore(newCell, targetCell?.nextSibling || null);
      }
    });
    emitChange();
  };

  const tableDeleteRow = () => {
    if (!tableEditor?.table || !tableEditor?.cell) return;
    const tr = tableEditor.cell.closest("tr");
    if (!tr) return;
    const tbody = tr.closest("tbody") || tr.closest("thead");
    if (tbody && tbody.querySelectorAll("tr").length <= 1) {
        if (tbody.tagName.toLowerCase() === "thead") {
            // Cannot delete last header row easily without breaking structure, but allowed
        }
    }
    tr.remove();
    emitChange();
    closeTableEditor();
  };

  const tableDeleteCol = () => {
    if (!tableEditor?.table || !tableEditor?.cell) return;
    const cell = tableEditor.cell;
    const tr = cell.closest("tr");
    if (!tr) return;
    const index = Array.from(tr.children).indexOf(cell);
    const table = tableEditor.table;
    const rows = table.querySelectorAll("tr");
    
    if (tr.children.length <= 1) {
      deleteTable();
      return;
    }
    
    rows.forEach(row => {
      if (row.children[index]) {
        row.children[index].remove();
      }
    });
    emitChange();
    closeTableEditor();
  };

  const deleteTable = () => {
    if (!tableEditor?.table) return;
    const target = tableEditor.table;
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNode(target);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("delete", false, null);
    } else {
      target.remove();
    }
    emitChange();
    closeTableEditor();
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
    img.style.display = "inline-block";
    img.style.verticalAlign = "";
    img.style.margin = "";
    img.style.float = "";
    img.style.position = "";
    img.style.left = "";
    img.style.transform = "";
    if (fig) {
      fig.style.float = "";
      fig.style.margin = "";
      fig.style.display = "";
      fig.style.position = "";
      fig.style.minHeight = "";
      fig.style.gridTemplateColumns = "";
      fig.style.gap = "";
      fig.style.alignItems = "";
      
      const divs = fig.querySelectorAll("div");
      if (divs.length === 2 && align !== "fixed-center") {
        while(divs[0].firstChild) {
          if (divs[0].firstChild.nodeName !== "BR") fig.insertBefore(divs[0].firstChild, divs[0]);
          else divs[0].removeChild(divs[0].firstChild);
        }
        divs[0].remove();
        
        while(divs[1].firstChild) {
          if (divs[1].firstChild.nodeName !== "BR") fig.appendChild(divs[1].firstChild);
          else divs[1].removeChild(divs[1].firstChild);
        }
        divs[1].remove();
      }
    }
    if (align === "center") {
      if (fig) {
        fig.style.textAlign = "center";
        fig.style.margin = "20px 0";
      }
    } else if (align === "left") {
      if (fig) {
        fig.style.textAlign = "left";
        fig.style.float = "left";
        fig.style.margin = "10px 20px 10px 0";
      }
    } else if (align === "right") {
      if (fig) {
        fig.style.textAlign = "right";
        fig.style.float = "right";
        fig.style.margin = "10px 0 10px 20px";
      }
    } else if (align === "inline") {
      img.style.verticalAlign = "middle";
      if (fig) {
        fig.style.display = "inline-block";
        fig.style.margin = "0 10px";
      }
    } else if (align === "fixed-center") {
      img.style.display = "block";
      img.style.margin = "0 auto";
      if (fig) {
        fig.style.display = "grid";
        fig.style.gridTemplateColumns = "1fr auto 1fr";
        fig.style.gap = "20px";
        fig.style.alignItems = "center";
        
        const divs = fig.querySelectorAll("div");
        if (divs.length === 0) {
          Array.from(fig.childNodes).forEach(child => {
             if (child !== img) child.remove();
          });
          
          const leftDiv = document.createElement("div");
          leftDiv.style.minHeight = "24px";
          leftDiv.style.textAlign = "left";
          leftDiv.innerHTML = "<br/>";
          
          const rightDiv = document.createElement("div");
          rightDiv.style.minHeight = "24px";
          rightDiv.style.textAlign = "left";
          rightDiv.innerHTML = "<br/>";
          
          fig.insertBefore(leftDiv, img);
          fig.appendChild(rightDiv);
        }
      }
    }
    emitChange();
  };

  const handleImageLink = async () => {
    if (!imageEditor?.img) return;
    const img = imageEditor.img;
    const existingAnchor = img.closest("a");
    const currentUrl = existingAnchor?.getAttribute("href") || "";
    const url = await promptAsync("Image link URL (leave blank to remove link)", currentUrl);
    if (url === null) return;
    if (!url.trim()) {
      if (existingAnchor) {
        const parent = existingAnchor.parentNode;
        existingAnchor.replaceWith(img);
        parent?.normalize();
        emitChange();
      }
    } else {
      if (existingAnchor) {
        existingAnchor.setAttribute("href", url);
        existingAnchor.setAttribute("target", "_blank");
        existingAnchor.setAttribute("rel", "noopener noreferrer");
      } else {
        const anchor = document.createElement("a");
        anchor.setAttribute("href", url);
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
        img.parentNode?.insertBefore(anchor, img);
        anchor.appendChild(img);
      }
      emitChange();
    }
  };

  const deleteImage = () => {
    if (!imageEditor?.img) return;
    const img = imageEditor.img;
    const fig = img.closest("figure");
    const target = fig || img;
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNode(target);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("delete", false, null);
    } else {
      target.remove();
    }
    closeImageEditor();
    emitChange();
  };

  const deleteShape = () => {
    if (!shapeEditor?.shape) return;
    const target = shapeEditor.shape;
    const sel = window.getSelection();
    if (sel) {
      const range = document.createRange();
      range.selectNode(target);
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand("delete", false, null);
    } else {
      target.remove();
    }
    closeShapeEditor();
    emitChange();
  };

  const setShapeAlign = (align) => {
    if (!shapeEditor?.shape) return;
    const shape = shapeEditor.shape;
    if (align === "left") {
      shape.style.display = "inline-block";
      shape.style.float = "left";
      shape.style.margin = "0 16px 16px 0";
    } else if (align === "right") {
      shape.style.display = "inline-block";
      shape.style.float = "right";
      shape.style.margin = "0 0 16px 16px";
    } else if (align === "center") {
      shape.style.display = "block";
      shape.style.float = "none";
      shape.style.margin = "0 auto 16px auto";
    } else {
      shape.style.display = "inline-block";
      shape.style.float = "none";
      shape.style.margin = "0 4px";
    }
    closeShapeEditor();
    emitChange();
  };

  const handleShapeColorChange = (e) => {
    if (!shapeEditor?.shape) return;
    const color = e.target.value;
    const shape = shapeEditor.shape;
    shape.setAttribute("data-fill", color);
    const svgElement = shape.querySelector("svg").firstElementChild;
    if (svgElement) {
      svgElement.setAttribute("fill", color);
    }
    emitChange();
  };

  /* ── Render ────────────────────────────────────────────── */

  return (
    <div ref={wrapperRef} className="rounded-2xl border border-border bg-background relative max-h-[70vh] min-h-[500px] overflow-y-auto flex flex-col">
      {/* ── Toolbar ── */}
      <div className="sticky top-0 z-20 flex-none flex flex-wrap items-center gap-1.5 border-b border-border p-2 sm:p-3 bg-background rounded-t-2xl">
        {/* History */}
        <button type="button" className={toolbarButtonClass} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("undo")} disabled={disabled} title="Undo (Ctrl+Z)">
          <Undo2 size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onMouseDown={(e) => e.preventDefault()} onClick={() => runCommand("redo")} disabled={disabled} title="Redo (Ctrl+Y)">
          <Redo2 size={15} />
        </button>
        <ToolbarDivider />

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
          className={`${toolbarButtonClass} hidden`}
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
        <button type="button" className={`${toolbarButtonClass} hidden`} onClick={handleAddCta} disabled={disabled} title="Insert CTA button">
          <MousePointerSquareDashed size={15} />
        </button>
        <button type="button" className={toolbarButtonClass} onClick={handleGroup} disabled={disabled} title="Group / Resize Block">
          <BoxSelect size={15} />
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
        <button
          type="button"
          className={toolbarButtonClass}
          onClick={handleAddImageUrl}
          disabled={disabled}
          title="Insert image from URL"
        >
          <ExternalLink size={15} />
        </button>

        <div className="relative hidden">
          <button
            type="button"
            className={`${toolbarButtonClass} ${showShapesDropdown ? toolbarButtonActiveClass : ""}`}
            onClick={() => setShowShapesDropdown((p) => !p)}
            disabled={disabled}
            title="Insert Shape"
          >
            <Shapes size={15} />
            <ChevronDown size={12} className="ml-1 opacity-60" />
          </button>
          {showShapesDropdown && (
            <div className="absolute top-full left-0 mt-1 w-32 bg-surface border border-border rounded-xl shadow-lg z-50 py-1 overflow-hidden">
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-2"
                onClick={() => handleAddShape("rectangle")}
              >
                Rectangle
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-2"
                onClick={() => handleAddShape("circle")}
              >
                Circle
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-2"
                onClick={() => handleAddShape("triangle")}
              >
                Triangle
              </button>
              <button
                type="button"
                className="w-full text-left px-3 py-1.5 text-sm text-text-primary hover:bg-surface-2"
                onClick={() => handleAddShape("star")}
              >
                Star
              </button>
            </div>
          )}
        </div>

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
            onClick={() => setImageAlign("inline")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Inline (Text pushes image)"
          >
            <Type size={13} />
          </button>
          <button
            type="button"
            onClick={() => setImageAlign("fixed-center")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Fixed Center (Text on both sides)"
          >
            <Pin size={13} />
          </button>
          <span className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onClick={handleImageLink}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title={imageEditor?.img?.closest("a") ? "Edit image link" : "Add link to image"}
          >
            <LinkIcon size={13} />
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

      {/* ── Image corner resize overlay ── */}
      {imageEditor ? (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            top: imageEditor.imgTop,
            left: imageEditor.imgLeft,
            width: imageEditor.imgWidth,
            height: imageEditor.imgHeight,
          }}
        >
          {/* NW corner */}
          <div
            className="absolute top-0 left-0 w-2.5 h-2.5 bg-white border border-cyan-500 pointer-events-auto cursor-nwse-resize -translate-x-1/2 -translate-y-1/2"
            onMouseDown={(e) => handleCornerResizeStart(e, 'nw')}
          />
          {/* NE corner */}
          <div
            className="absolute top-0 right-0 w-2.5 h-2.5 bg-white border border-cyan-500 pointer-events-auto cursor-nesw-resize translate-x-1/2 -translate-y-1/2"
            onMouseDown={(e) => handleCornerResizeStart(e, 'ne')}
          />
          {/* SW corner */}
          <div
            className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-white border border-cyan-500 pointer-events-auto cursor-nesw-resize -translate-x-1/2 translate-y-1/2"
            onMouseDown={(e) => handleCornerResizeStart(e, 'sw')}
          />
          {/* SE corner */}
          <div
            className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-white border border-cyan-500 pointer-events-auto cursor-nwse-resize translate-x-1/2 translate-y-1/2"
            onMouseDown={(e) => handleCornerResizeStart(e, 'se')}
          />
          {/* Central move handle */}
          <div
            onMouseDown={handleMoveStart}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-surface-2 border border-border shadow-md rounded-full pointer-events-auto cursor-grab flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
            title="Drag to freely move image"
          >
            <Move size={16} className="text-text-primary" />
          </div>
        </div>
      ) : null}

      {/* ── Floating shape popover ── */}
      {shapeEditor ? (
        <div
          className="absolute z-20 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface shadow-modal p-1.5"
          style={{ top: Math.max(0, shapeEditor.top), left: shapeEditor.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <input
            type="color"
            title="Fill Color"
            className="w-6 h-6 p-0 border-0 cursor-pointer rounded-md overflow-hidden bg-transparent"
            value={shapeEditor.shape?.getAttribute("data-fill") || "#3b82f6"}
            onChange={handleShapeColorChange}
          />
          <span className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onClick={() => setShapeAlign("left")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Align left"
          >
            <AlignLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => setShapeAlign("center")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Align center"
          >
            <AlignCenter size={13} />
          </button>
          <button
            type="button"
            onClick={() => setShapeAlign("right")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Align right"
          >
            <AlignRight size={13} />
          </button>
          <span className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onClick={() => setShapeAlign("inline")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Inline"
          >
            <Type size={13} />
          </button>
          <span className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onClick={deleteShape}
            className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10"
            title="Delete shape"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ) : null}

      {/* ── Shape corner resize overlay ── */}
      {shapeEditor ? (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            top: shapeEditor.shapeTop,
            left: shapeEditor.shapeLeft,
            width: shapeEditor.shapeWidth,
            height: shapeEditor.shapeHeight,
          }}
        >
          {/* NW corner */}
          <div
            className="absolute top-0 left-0 w-2.5 h-2.5 bg-white border border-cyan-500 pointer-events-auto cursor-nwse-resize -translate-x-1/2 -translate-y-1/2"
            onMouseDown={(e) => handleShapeCornerResizeStart(e, 'nw')}
          />
          {/* NE corner */}
          <div
            className="absolute top-0 right-0 w-2.5 h-2.5 bg-white border border-cyan-500 pointer-events-auto cursor-nesw-resize translate-x-1/2 -translate-y-1/2"
            onMouseDown={(e) => handleShapeCornerResizeStart(e, 'ne')}
          />
          {/* SW corner */}
          <div
            className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-white border border-cyan-500 pointer-events-auto cursor-nesw-resize -translate-x-1/2 translate-y-1/2"
            onMouseDown={(e) => handleShapeCornerResizeStart(e, 'sw')}
          />
          {/* SE corner */}
          <div
            className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-white border border-cyan-500 pointer-events-auto cursor-nwse-resize translate-x-1/2 translate-y-1/2"
            onMouseDown={(e) => handleShapeCornerResizeStart(e, 'se')}
          />
        </div>
      ) : null}


      {/* ── Floating table popover ── */}
      {tableEditor ? (
        <div
          className="absolute z-20 flex items-center gap-1 rounded-xl border border-border bg-surface shadow-modal p-1.5"
          style={{ top: Math.max(0, tableEditor.top), left: tableEditor.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            onClick={() => moveTable("up")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-40"
            title="Move table up"
            disabled={!tableEditor.table?.previousElementSibling}
          >
            <ChevronUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => moveTable("down")}
            className="p-1.5 rounded-md text-text-secondary hover:bg-surface-2 hover:text-text-primary disabled:opacity-40"
            title="Move table down"
            disabled={!tableEditor.table?.nextElementSibling}
          >
            <ChevronDown size={14} />
          </button>
          <span className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onClick={() => tableAddRow('above')}
            className="px-2 py-1 rounded-md text-xs font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Add row above"
          >
            +R Above
          </button>
          <button
            type="button"
            onClick={() => tableAddRow('below')}
            className="px-2 py-1 rounded-md text-xs font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Add row below"
          >
            +R Below
          </button>
          <button
            type="button"
            onClick={() => tableAddCol('left')}
            className="px-2 py-1 rounded-md text-xs font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Add column left"
          >
            +C Left
          </button>
          <button
            type="button"
            onClick={() => tableAddCol('right')}
            className="px-2 py-1 rounded-md text-xs font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            title="Add column right"
          >
            +C Right
          </button>
          <span className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onClick={tableDeleteRow}
            className="px-2 py-1 rounded-md text-xs font-medium text-red-400 hover:bg-red-500/10"
            title="Delete row"
          >
            -Row
          </button>
          <button
            type="button"
            onClick={tableDeleteCol}
            className="px-2 py-1 rounded-md text-xs font-medium text-red-400 hover:bg-red-500/10"
            title="Delete column"
          >
            -Col
          </button>
          <span className="w-px h-5 bg-border mx-0.5" />
          <button
            type="button"
            onClick={deleteTable}
            className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10"
            title="Delete table"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ) : null}

      {/* ── Group Corner resize overlay ── */}
      {groupEditor ? (
        <>
          <div
            className="absolute z-20 flex flex-wrap items-center gap-1 rounded-xl border border-border bg-surface shadow-modal p-1.5"
            style={{ top: Math.max(0, groupEditor.top), left: groupEditor.left }}
            onMouseDown={(e) => e.preventDefault()}
          >
            <button
              type="button"
              onClick={handleUngroup}
              className="p-1.5 rounded-md text-red-400 hover:bg-red-500/10"
              title="Ungroup"
            >
              <Trash2 size={13} />
            </button>
          </div>
          <div
            className="absolute z-10 pointer-events-none"
            style={{
              top: groupEditor.groupTop,
              left: groupEditor.groupLeft,
              width: groupEditor.groupWidth,
              height: groupEditor.groupHeight,
            }}
          >
            {/* NW */}
            <div
              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan rounded-full cursor-nwse-resize pointer-events-auto"
              onMouseDown={(e) => handleGroupCornerResizeStart(e, 'nw')}
            />
            {/* NE */}
            <div
              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan rounded-full cursor-nesw-resize pointer-events-auto"
              onMouseDown={(e) => handleGroupCornerResizeStart(e, 'ne')}
            />
            {/* SW */}
            <div
              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-cyan rounded-full cursor-nesw-resize pointer-events-auto"
              onMouseDown={(e) => handleGroupCornerResizeStart(e, 'sw')}
            />
            {/* SE */}
            <div
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-cyan rounded-full cursor-nwse-resize pointer-events-auto"
              onMouseDown={(e) => handleGroupCornerResizeStart(e, 'se')}
            />
            {/* Central move handle */}
            <div
              onMouseDown={handleGroupMoveStart}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-surface-2 border border-border shadow-md rounded-full pointer-events-auto cursor-grab flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
              title="Drag to freely move group"
            >
              <Move size={16} className="text-text-primary" />
            </div>
          </div>
        </>
      ) : null}

      {/* ── Editable surface ── */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={() => emitChange()}
        onKeyUp={refreshState}
        onMouseUp={refreshState}
        onClick={handleEditorClick}
        onBlur={captureSelection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDrop={handleDrop}
        className={`flex-1 min-h-[400px] flow-root px-4 py-4 text-sm text-text-primary focus:outline-none
          [&_a]:text-cyan [&_a]:underline
          [&_blockquote]:border-l-4 [&_blockquote]:border-cyan/40 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:my-4
          [&_h1]:mt-6 [&_h1]:text-3xl [&_h1]:font-bold
          [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-semibold
          [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold
          [&_h4]:mt-4 [&_h4]:text-lg [&_h4]:font-semibold
          [&_li]:ml-5 [&_ul]:list-disc [&_ol]:list-decimal [&_p]:mb-1 [&_p]:leading-[1.4]
          [&_table]:w-full [&_table]:border-collapse [&_table]:my-4
          [&_th]:border [&_td]:border [&_th]:border-border [&_td]:border-border [&_th]:px-3 [&_td]:py-2 [&_th]:bg-surface-2 [&_th]:text-left
          [&_img]:max-w-full [&_img]:!rounded-none [&_img]:cursor-grab ${isDraggingImage ? "[&_img]:opacity-40" : ""}`}
      />

      <CustomPromptModal config={promptConfig} />
    </div>
  );
};

export default RichTextEditor;
