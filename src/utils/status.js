// Canonical status → PrimeVue severity mapping, shared by every admin screen so
// the same status never renders a different color depending on where you look.
// (Previously copy-pasted into each view, which is how `driver_assigned` drifted
// to green on the car detail page but amber everywhere else.)

// `ok` / `low` / `out` are the stock levels from the department stock screen:
// a shelf running low must read as a warning wherever it appears.
const SUCCESS = new Set(['paid', 'confirmed', 'delivered', 'picked_up', 'completed', 'in_progress', 'active', 'available', 'doctor', 'ok']);
const WARN = new Set(['unpaid', 'pending', 'requested', 'reviewing', 'quoted', 'shipped', 'driver_assigned', 'assigned', 'maintenance', 'not_available', 'nurse', 'low']);
const DANGER = new Set(['cancelled', 'expired', 'refunded', 'inactive', 'out']);

export function statusSeverity(value) {
  if (typeof value === 'boolean') {
    return value ? 'success' : 'secondary';
  }
  const status = String(value || '').toLowerCase();
  if (SUCCESS.has(status)) {
    return 'success';
  }
  if (WARN.has(status)) {
    return 'warn';
  }
  if (DANGER.has(status)) {
    return 'danger';
  }
  return 'info';
}
