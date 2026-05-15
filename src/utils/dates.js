export function normalizeDate(val) {
  if (val === null || val === undefined || val === '') return '';

  // Date object (SheetJS cellDates:true)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    return val.toISOString().split('T')[0];
  }

  // Excel serial number (pure integer stored as number)
  if (typeof val === 'number') {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    return '';
  }

  const s = String(val).trim();
  if (!s) return '';

  // Already ISO YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Detect separator (/ - .)
  const sepMatch = s.match(/[\/\-\.]/);
  if (!sepMatch) return s;
  const sep = sepMatch[0];
  const parts = s.split(sep).map(p => p.trim());
  if (parts.length !== 3) return s;

  let [a, b, c] = parts;

  // YYYY-?-? (4-digit year first)
  if (a.length === 4) {
    const [y, m, d] = [parseInt(a), parseInt(b), parseInt(c)];
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31)
      return `${a}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return s;
  }

  // Expand 2-digit year (last part)
  let year = parseInt(c);
  if (c.length <= 2) year = year < 30 ? 2000 + year : 1900 + year;

  const na = parseInt(a), nb = parseInt(b);

  let day, month;
  if (na > 12) {
    day = na; month = nb;
  } else if (nb > 12) {
    month = na; day = nb;
  } else {
    day = na; month = nb;
  }

  if (isNaN(day) || isNaN(month) || isNaN(year)) return s;
  if (month < 1 || month > 12 || day < 1 || day > 31) return s;

  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export function daysUntil(dateStr) {
  return Math.ceil((new Date(dateStr) - Date.now()) / 86400000);
}
