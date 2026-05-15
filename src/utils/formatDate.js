/**
 * Formats an ISO date string into a human-readable format.
 * @param {string} iso - ISO date string.
 * @returns {string} Formatted date or "N/A".
 */
export const fmtDate = (iso) => {
  if (!iso) return "N/A";
  const d = new Date(iso);
  return isNaN(d.getTime()) 
    ? "N/A" 
    : d.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric", 
        year: "numeric" 
      });
};
