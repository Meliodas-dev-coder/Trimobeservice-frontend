export function formatMGA(value) {
  return `${new Intl.NumberFormat('fr-MG', {
    maximumFractionDigits: 0,
  }).format(value)} MGA`;
}

// Date-only display (e.g. "04 Jul 2026"). Falls back to the raw string on an
// unparseable value and to "-" when empty.
export function formatDate(value, locale = 'fr-MG') {
  if (!value) {
    return '-';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

// Date + time display (e.g. "04 Jul 2026, 14:30").
export function formatDateTime(value, locale = 'fr-MG') {
  if (!value) {
    return '-';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
