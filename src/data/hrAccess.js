// HR access is intentionally described with stable feature keys rather than
// route names or translated labels. The backend remains authoritative and
// applies the employee scope to every list, item and mutation.
export const HR_SCOPE_ORDER = ['self', 'reporting_tree', 'department_tree', 'all'];

export const HR_SCOPE_LABELS = {
  self: 'My records',
  reporting_tree: 'Complete reporting tree',
  department_tree: 'Department and child departments',
  all: 'All employees',
};

export const HR_RESOURCE_FEATURES = {
  employees: 'employees',
  departments: 'organization',
  positions: 'organization',
  'position-hierarchy': 'organization',
  // Templates are ownerless configuration, so they follow the all-scope
  // organization feature rather than the per-employee `contracts` feature.
  'contract-templates': 'organization',
  contracts: 'contracts',
  // Issued documents have no employee column (a memo may be signed with an
  // external party), so the backend requires all-scope; mirror that here.
  'contract-documents': 'contracts',
  documents: 'documents',
  'emergency-contacts': 'emergency_contacts',
  'lifecycle-events': 'lifecycle',
  'leave-policies': 'leave',
  'leave-balances': 'leave',
  'leave-requests': 'leave',
  calendar: 'leave',
  shifts: 'attendance',
  'shift-assignments': 'attendance',
  attendance: 'attendance',
  timesheets: 'attendance',
  overtime: 'attendance',
  lateness: 'attendance',
  'performance-reviews': 'performance',
  goals: 'performance',
  feedback: 'performance',
  'one-to-ones': 'performance',
  vacancies: 'recruitment',
  candidates: 'recruitment',
  interviews: 'recruitment',
  offers: 'recruitment',
  expenses: 'expenses',
  compensation: 'compensation',
  benefits: 'benefits',
  'benefit-enrollments': 'benefits',
  notifications: 'notifications',
  'audit-history': 'audit',
};

export const HR_AREA_RESOURCES = {
  organization: ['departments', 'positions', 'position-hierarchy', 'contracts', 'contract-templates', 'contract-documents', 'documents', 'emergency-contacts'],
  lifecycle: ['lifecycle-events'],
  leave: ['leave-requests', 'leave-policies', 'leave-balances', 'calendar'],
  time: ['attendance', 'shifts', 'shift-assignments', 'timesheets', 'overtime', 'lateness'],
  performance: ['performance-reviews', 'goals', 'feedback', 'one-to-ones'],
  recruitment: ['vacancies', 'candidates', 'interviews', 'offers'],
  finance: ['expenses', 'compensation', 'benefits', 'benefit-enrollments'],
};

// Feature policies are intentionally broad (for example `leave.create`).
// These resource rules mirror the backend's second authorization layer so a
// broad self-service action never turns into a misleading global-config or
// official-record button in the UI.
const ALL_SCOPE_MUTATION_RESOURCES = new Set([
  'departments',
  'positions',
  'contract-templates',
  'contract-documents',
  'leave-policies',
  'leave-balances',
  'shifts',
  'shift-assignments',
  'vacancies',
  'candidates',
  'interviews',
  'offers',
  'benefits',
]);

const EMPLOYEE_SCOPED_RESOURCES = new Set([
  'employees',
  'emergency-contacts',
  'contracts',
  'documents',
  'lifecycle-events',
  'leave-balances',
  'leave-requests',
  'shift-assignments',
  'attendance',
  'timesheets',
  'performance-reviews',
  'goals',
  'feedback',
  'one-to-ones',
  'expenses',
  'compensation',
  'benefit-enrollments',
]);

const NO_SELF_MUTATION_RESOURCES = new Set([
  'leave-balances',
  'shift-assignments',
  'performance-reviews',
  'one-to-ones',
]);

const SEPARATED_DUTY_ACTIONS = {
  'leave-requests': new Set(['approve']),
  timesheets: new Set(['approve']),
  expenses: new Set(['approve', 'reimburse']),
  'lifecycle-events': new Set(['complete']),
  'performance-reviews': new Set(['complete']),
};

const EDITABLE_STATUSES = {
  contracts: new Set(['draft', 'active']),
  expenses: new Set(['pending']),
  timesheets: new Set(['draft', 'rejected']),
  'performance-reviews': new Set(['draft', 'in_progress', 'employee_acknowledged']),
  'one-to-ones': new Set(['scheduled']),
  vacancies: new Set(['draft', 'open', 'paused']),
  candidates: new Set(['applied', 'screening', 'interview', 'offer']),
  interviews: new Set(['scheduled']),
  offers: new Set(['draft']),
  'benefit-enrollments': new Set(['active']),
  'shift-assignments': new Set(['active']),
};

const SELF_EMPLOYEE_EDIT_FIELDS = new Set([
  'first_name',
  'last_name',
  'personal_email',
  'phone',
  'date_of_birth',
  'gender',
  'nationality',
  'address',
  'work_location',
  'photo_url',
]);

function resourceId(resource) {
  return typeof resource === 'string' ? resource : resource?.id;
}

function numberId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function hrResourceTargetsSelf(auth, resource, values = {}) {
  const id = resourceId(resource);
  const target = id === 'employees' ? numberId(values?.id) : numberId(values?.employee_id);
  const employee = numberId(auth.employee?.id);
  return Boolean(target && employee && target === employee);
}

export function hrResourceRecordEditable(resource, row) {
  const allowed = EDITABLE_STATUSES[resourceId(resource)];
  if (!allowed || !row) return true;
  return allowed.has(String(row.status || ''));
}

export function hrResourceUsesEmployeeScope(resource) {
  return EMPLOYEE_SCOPED_RESOURCES.has(resourceId(resource));
}

export function canMutateHrResource(auth, resource, action, { values = {}, row = null } = {}) {
  const id = resourceId(resource);
  const feature = hrFeatureForResource(id);
  if (!id || !action || !auth.canHr(feature, action)) return false;

  const scope = auth.hrScope(feature, action);
  if (!scope) return false;
  const target = row || values || {};
  const isSelf = hrResourceTargetsSelf(auth, id, target);

  if (ALL_SCOPE_MUTATION_RESOURCES.has(id) && scope !== 'all') return false;
  // Creating an employee identity has no existing target row against which a
  // narrower employee scope can be evaluated.
  if (id === 'employees' && action === 'create' && scope !== 'all') return false;
  if (NO_SELF_MUTATION_RESOURCES.has(id) && (scope === 'self' || isSelf)) return false;
  if (SEPARATED_DUTY_ACTIONS[id]?.has(action) && isSelf) return false;
  if (action === 'update' && !hrResourceRecordEditable(id, row)) return false;

  if (id === 'leave-requests' && action === 'approve') {
    const actorUserID = numberId(auth.user?.id);
    const approvals = Array.isArray(target.approvals) ? target.approvals : [];
    if (actorUserID && approvals.some((approval) => numberId(approval?.approver_user_id) === actorUserID)) return false;
  }

  // Feedback remains author-owned, and scoped managers never edit HR-private
  // notes even when they can see another record in the same feature area.
  if (id === 'feedback' && action === 'update') {
    if (target.visibility === 'hr_private' && scope !== 'all') return false;
    if (scope !== 'all' && numberId(target.author_employee_id) !== numberId(auth.employee?.id)) return false;
  }
  return true;
}

export function hrResourceFieldWritable(auth, resource, field, { record = null, values = {}, action = null } = {}) {
  const id = resourceId(resource);
  if (!field) return false;
  const target = record || values || {};
  // Ownership is selected at creation and never reassigned by generic edit.
  if (record && field.key === 'employee_id') return false;
  // Moving a position between departments changes its access boundary and is
  // never allowed through generic position editing.
  if (id === 'positions' && record && field.key === 'department_id') return false;
  // The backend derives feedback authorship from the signed-in employee.
  if (id === 'feedback' && field.key === 'author_employee_id') return false;
  // Department hierarchy and leadership directly change access scope.
  if (id === 'departments' && ['manager_employee_id', 'parent_department_id'].includes(field.key) && !auth.isSuperAdmin) return false;
  // Scoped attendance is stamped by the backend from the employee's active
  // assignment and cannot claim an arbitrary source or shift.
  const mutationAction = action || (record ? 'update' : 'create');
  if (id === 'attendance' && !auth.isSuperAdmin
    && auth.hrScope('attendance', mutationAction) !== 'all'
    && ['shift_id', 'source'].includes(field.key)) return false;
  // Department, position, manager and employment status are access-bearing
  // employee fields. Non-super actors use lifecycle/access workflows for them.
  if (id === 'employees' && record && !auth.isSuperAdmin
    && ['user_id', 'department_id', 'position_id', 'manager_id', 'employment_status'].includes(field.key)) return false;
  if (id === 'employees' && record && hrResourceTargetsSelf(auth, id, target)) {
    return SELF_EMPLOYEE_EDIT_FIELDS.has(field.key);
  }
  return true;
}

export function hrResourceFieldOptions(auth, resource, action, field, options = []) {
  if (resourceId(resource) === 'feedback' && field?.key === 'visibility'
    && auth.hrScope('performance', action) !== 'all') {
    return options.filter((option) => option !== 'hr_private');
  }
  return options;
}

export function hrFeatureForResource(resource) {
  const id = typeof resource === 'string' ? resource : resource?.id;
  return HR_RESOURCE_FEATURES[id] || String(id || '').replaceAll('-', '_');
}

// Leave-policy approval chain. The backend stores an ordered array where each
// entry is an approver role string ('manager' | 'hr' | 'hr_admin' |
// 'position_hierarchy') or, for a named approver, { approver: 'user', user_id }.
// 'position_hierarchy' resolves the approver by walking up the employee's base
// position ladder — each successive position_hierarchy step escalates one rung.
// Array order is the approval sequence. The editor exposes only the role steps
// (per product decision); a stored 'user' step is shown read-only and preserved.
export const HR_APPROVER_ROLES = ['manager', 'hr', 'hr_admin', 'position_hierarchy'];

export const HR_APPROVER_LABELS = {
  manager: 'Direct manager',
  hr: 'HR team',
  hr_admin: 'HR administrator',
  position_hierarchy: 'Next position up',
  user: 'Specific person',
};

// approverRole returns the role of an entry when it is one the editor manages,
// otherwise null (a legacy/named approver that must be preserved untouched).
export function approverRole(entry) {
  const approver = entry && typeof entry === 'object' ? entry.approver : entry;
  return HR_APPROVER_ROLES.includes(approver) ? approver : null;
}

// approverLabel resolves a display key for any entry (translate with t()).
export function approverLabel(entry) {
  const approver = entry && typeof entry === 'object' ? entry.approver : entry;
  return HR_APPROVER_LABELS[approver] || 'Custom approver';
}

export function scopeLabel(scope) {
  return HR_SCOPE_LABELS[scope] || scope || 'My records';
}

export function widestScope(scopes = []) {
  return scopes.reduce((best, scope) => (
    HR_SCOPE_ORDER.indexOf(scope) > HR_SCOPE_ORDER.indexOf(best) ? scope : best
  ), 'self');
}
