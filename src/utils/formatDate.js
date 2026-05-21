/**
 * Formats an ISO date string into a human-readable format.
 * @param {string} iso - ISO date string.
 * @returns {string} Formatted date or "N/A".
 */
export const fmtDate = (iso) => {
  if (!iso) return "N/A";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "N/A";

  const day = d.getDate();
  const getOrdinalNum = (n) => {
    return n + (n > 0 ? ['th', 'st', 'nd', 'rd'][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10] : '');
  };

  const month = d.toLocaleString('default', { month: 'short' }); 
  const year = d.getFullYear();
  
  return `${getOrdinalNum(day)} ${month} ${year}`;
};
