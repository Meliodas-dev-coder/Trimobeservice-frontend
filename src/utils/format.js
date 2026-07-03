export function formatMGA(value) {
  return `${new Intl.NumberFormat('fr-MG', {
    maximumFractionDigits: 0,
  }).format(value)} MGA`;
}
