export const formatOrdinalDate = (dateInput) => {
  if (!dateInput) return "N/A";
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "N/A";

  const day = date.getDate();
  const getOrdinalNum = (n) => {
    return n + (n > 0 ? ['th', 'st', 'nd', 'rd'][(n > 3 && n < 21) || n % 10 > 3 ? 0 : n % 10] : '');
  };

  const month = date.toLocaleString('default', { month: 'short' }); 
  const year = date.getFullYear();
  
  return `${getOrdinalNum(day)} ${month} ${year}`;
};
