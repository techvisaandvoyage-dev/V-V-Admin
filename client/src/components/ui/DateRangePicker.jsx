import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { formatOrdinalDate } from "../../utils/dateUtils";

/**
 * Date-range calendar picker. Two trigger pills (Start / End) sit on top; the
 * calendar drops down as a panel showing two months side-by-side (one on
 * mobile). Picks behave like every familiar booking calendar:
 *   1st click → sets start (clears end)
 *   2nd click after start → sets end (auto-closes the panel)
 *   click earlier than current start → resets start
 *   click again after both are set → starts a new range
 *
 * The component is fully controlled — owner passes `startDate` / `endDate` as
 * "YYYY-MM-DD" strings (the same format the existing travel-state uses) and
 * receives updates via `onChange({ startDate, endDate })`.
 */

// ── Helpers ────────────────────────────────────────────────────────────────
const pad2 = (n) => String(n).padStart(2, "0");

const toYmd = (d) =>
  d instanceof Date && !Number.isNaN(d.getTime())
    ? `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
    : "";

const fromYmd = (s) => {
  if (!s || typeof s !== "string") return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["S", "M", "T", "W", "T", "F", "S"];

/** Build a 6×7 grid of Date objects for a given month, including
 *  leading/trailing days from neighbouring months (flagged `outside`). */
const getMonthGrid = (year, month) => {
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = startWeekday - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), outside: true });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({ date: new Date(year, month, i), outside: false });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(last.getDate() + 1);
    cells.push({ date: next, outside: true });
  }
  return cells;
};

const stepMonth = ({ year, month }, delta) => {
  let m = month + delta;
  let y = year;
  while (m < 0) { m += 12; y -= 1; }
  while (m > 11) { m -= 12; y += 1; }
  return { year: y, month: m };
};

const prettyDate = (s) => {
  const d = fromYmd(s);
  if (!d) return "";
  return formatOrdinalDate(d);
};

// ── Component ──────────────────────────────────────────────────────────────
const DateRangePicker = ({
  startDate = "",
  endDate = "",
  minDate = "",
  onChange,
  open,
  onOpenChange,
  invalid = false,
  startPlaceholder = "Select start date",
  endPlaceholder = "Select end date",
  startLabel = "DEPARTURE",
  endLabel = "RETURN",
}) => {
  const containerRef = useRef(null);
  const [hoverYmd, setHoverYmd] = useState("");
  /** Tracks which pill was clicked last so the next selection is intuitive:
   *  click "End" → next selection becomes the end (even if start exists). */
  const [pendingSide, setPendingSide] = useState("start");

  const startObj = useMemo(() => fromYmd(startDate), [startDate]);
  const endObj = useMemo(() => fromYmd(endDate), [endDate]);
  const minObj = useMemo(() => fromYmd(minDate) || new Date(), [minDate]);
  const minYmd = useMemo(() => toYmd(minObj), [minObj]);

  /** Anchor = first of the two visible months. Defaults to start month (or
   *  today). Snaps forward if the anchor is in the past relative to today. */
  const [anchor, setAnchor] = useState(() => {
    const base = startObj || new Date();
    return { year: base.getFullYear(), month: base.getMonth() };
  });

  // When the consumer changes startDate externally (draft load, etc.), keep
  // the anchor in sync so the new range is visible the next time we open.
  useEffect(() => {
    if (!startObj) return;
    setAnchor((prev) => {
      const same = prev.year === startObj.getFullYear() && prev.month === startObj.getMonth();
      const next = stepMonth(prev, 1);
      const inSecond = next.year === startObj.getFullYear() && next.month === startObj.getMonth();
      return same || inSecond ? prev : { year: startObj.getFullYear(), month: startObj.getMonth() };
    });
  }, [startObj]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target)) return;
      onOpenChange?.(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open, onOpenChange]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onOpenChange?.(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Auto-scroll into view when opened on mobile.
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    if (window.innerWidth >= 640) return; // Only for mobile

    const timer = window.setTimeout(() => {
      if (!containerRef.current) return;
      // Scroll so the top of the container is near the top of the viewport
      const offset = 80; // Offset for sticky navbar/header
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = containerRef.current.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [open]);

  const months = useMemo(() => {
    const a = anchor;
    const b = stepMonth(a, 1);
    return [
      { label: `${MONTH_NAMES[a.month]} ${a.year}`, cells: getMonthGrid(a.year, a.month) },
      { label: `${MONTH_NAMES[b.month]} ${b.year}`, cells: getMonthGrid(b.year, b.month) },
    ];
  }, [anchor]);

  const openWith = (side) => {
    setPendingSide(side);
    onOpenChange?.(true);
  };

  const handleCellClick = (cell) => {
    if (cell.outside) return;
    const ymd = toYmd(cell.date);
    if (ymd < minYmd) return;

    // "End" pill primed AND a start is already chosen → set end (or swap if before start).
    if (pendingSide === "end" && startDate) {
      if (ymd < startDate) {
        // Picked something before start — treat as new start.
        onChange?.({ startDate: ymd, endDate: "" });
        setPendingSide("end");
        return;
      }
      onChange?.({ startDate, endDate: ymd });
      setPendingSide("start");
      window.setTimeout(() => onOpenChange?.(false), 120);
      return;
    }

    // Start a new range when nothing's selected OR both ends are set.
    if (!startDate || (startDate && endDate)) {
      onChange?.({ startDate: ymd, endDate: "" });
      setPendingSide("end");
      return;
    }

    // Have start, no end. If user clicked before start → reset start.
    if (ymd < startDate) {
      onChange?.({ startDate: ymd, endDate: "" });
      setPendingSide("end");
      return;
    }
    onChange?.({ startDate, endDate: ymd });
    setPendingSide("start");
    window.setTimeout(() => onOpenChange?.(false), 120);
  };

  const previewEndYmd = endDate || (pendingSide === "end" ? hoverYmd : "");

  const isInRange = (ymd) => {
    if (!startDate || !previewEndYmd) return false;
    const [lo, hi] = startDate <= previewEndYmd ? [startDate, previewEndYmd] : [previewEndYmd, startDate];
    return ymd > lo && ymd < hi;
  };

  const dayCount = useMemo(() => {
    if (!startObj || !endObj) return 0;
    return Math.round((endObj.getTime() - startObj.getTime()) / 86400000) + 1;
  }, [startObj, endObj]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => openWith("start")}
          className={`text-left bg-background border rounded-xl px-3 py-2.5 transition-colors flex items-center gap-3 ${
            open && pendingSide === "start"
              ? "border-cyan"
              : invalid && !startDate
                ? "border-red-500"
                : "border-border hover:border-cyan/40"
          }`}
        >
          <CalendarDays size={16} className="text-cyan shrink-0" />
          <span className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary">{startLabel}</span>
            <span className={`text-sm font-medium truncate ${startDate ? "text-text-primary" : "text-text-secondary"}`}>
              {startDate ? prettyDate(startDate) : startPlaceholder}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => openWith("end")}
          className={`text-left bg-background border rounded-xl px-3 py-2.5 transition-colors flex items-center gap-3 ${
            open && pendingSide === "end"
              ? "border-cyan"
              : invalid && !endDate
                ? "border-red-500"
                : "border-border hover:border-cyan/40"
          }`}
        >
          <CalendarDays size={16} className="text-cyan shrink-0" />
          <span className="flex flex-col min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-text-secondary">{endLabel}</span>
            <span className={`text-sm font-medium truncate ${endDate ? "text-text-primary" : "text-text-secondary"}`}>
              {endDate ? prettyDate(endDate) : endPlaceholder}
            </span>
          </span>
        </button>
      </div>

      {/* Calendar panel */}
      {open && (
        <div
          className="mt-3 rounded-2xl border border-border bg-surface shadow-modal p-4 sm:p-5 relative z-30"
          role="dialog"
          aria-label="Select travel dates"
        >
          {/* Month-nav header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setAnchor((a) => stepMonth(a, -1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-surface-2 text-text-primary hover:text-cyan hover:border-cyan/40 transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-xs text-text-secondary font-medium">
              {startDate && !endDate ? "Pick your return date" : "Pick your travel dates"}
            </p>
            <button
              type="button"
              onClick={() => setAnchor((a) => stepMonth(a, 1))}
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg border border-border bg-surface-2 text-text-primary hover:text-cyan hover:border-cyan/40 transition-colors"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Months grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {months.map((g, gi) => (
              <div key={gi}>
                <p className="text-sm font-bold text-text-primary text-center mb-3">{g.label}</p>
                <div className="grid grid-cols-7 gap-1 mb-1 text-center">
                  {DOW.map((d, i) => (
                    <span key={i} className="text-[11px] font-semibold text-text-secondary">{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {g.cells.map((cell, ci) => {
                    const ymd = toYmd(cell.date);
                    const isOutside = cell.outside;
                    const isDisabled = !isOutside && ymd < minYmd;
                    const isStart = !isOutside && ymd === startDate;
                    const isEnd = !isOutside && ymd === endDate;
                    const isEndpoint = isStart || isEnd;
                    const inRange = !isOutside && !isEndpoint && isInRange(ymd);
                    const isHoverPreviewEnd =
                      !isOutside &&
                      !isEndpoint &&
                      pendingSide === "end" &&
                      startDate &&
                      !endDate &&
                      ymd === hoverYmd &&
                      ymd >= startDate;

                    let classes =
                      "aspect-square w-full inline-flex items-center justify-center text-sm rounded-lg transition-colors select-none";
                    if (isOutside) {
                      classes += " text-transparent pointer-events-none";
                    } else if (isDisabled) {
                      classes += " text-text-muted/30 cursor-not-allowed";
                    } else if (isEndpoint) {
                      classes += " bg-cyan text-background font-bold shadow-sm";
                    } else if (inRange) {
                      classes += " bg-cyan/15 text-text-primary";
                    } else if (isHoverPreviewEnd) {
                      classes += " bg-cyan/10 text-text-primary";
                    } else {
                      classes += " text-text-primary hover:bg-surface-2 hover:text-cyan";
                    }

                    return (
                      <button
                        key={ci}
                        type="button"
                        disabled={isOutside || isDisabled}
                        onClick={() => handleCellClick(cell)}
                        onMouseEnter={() => !isOutside && !isDisabled && setHoverYmd(ymd)}
                        onMouseLeave={() => setHoverYmd("")}
                        className={classes}
                        aria-label={cell.date.toLocaleDateString()}
                        aria-pressed={isEndpoint}
                      >
                        {cell.date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-border">
            <span className="text-[11px] text-text-secondary font-medium">
              {startDate && endDate
                ? `${dayCount} day${dayCount === 1 ? "" : "s"} selected`
                : startDate
                  ? "Now pick your return date"
                  : "Choose your departure date first"}
            </span>
            <div className="flex items-center gap-2">
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    onChange?.({ startDate: "", endDate: "" });
                    setPendingSide("start");
                  }}
                  className="text-[11px] font-medium text-text-muted hover:text-red-400 transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => onOpenChange?.(false)}
                className="text-[11px] font-semibold text-cyan hover:underline"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
