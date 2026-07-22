const statusOptions = ['active', 'inactive'];
const employeeStatuses = ['onboarding', 'probation', 'active', 'leave', 'suspended', 'offboarded'];
const employmentTypes = ['permanent', 'fixed_term', 'contract', 'intern', 'temporary'];
const requestStatuses = ['pending', 'approved', 'rejected', 'cancelled'];

const text = (key, label, extra = {}) => ({ key, label, ...extra });
const select = (key, label, options, extra = {}) => ({ key, label, type: 'select', options, ...extra });
const time = (key, label, extra = {}) => ({ key, label, type: 'time', ...extra });
const weekdays = (key, label, extra = {}) => ({ key, label, type: 'weekdays', ...extra });
const date = (key, label, extra = {}) => ({ key, label, type: 'date', ...extra });
const number = (key, label, extra = {}) => ({ key, label, type: 'number', ...extra });
const money = (key, label, extra = {}) => ({ key, label, type: 'money', ...extra });
const relation = (key, label, resource, optionLabel = 'name', extra = {}) => ({
  key,
  label,
  type: 'relation',
  resource,
  optionLabel,
  ...extra,
});

function resource(id, title, singular, icon, description, config = {}) {
  return {
    id,
    endpoint: config.endpoint || id,
    collectionKey: config.collectionKey || id.replaceAll('-', '_'),
    itemKey: config.itemKey || id.replace(/s$/, '').replaceAll('-', '_'),
    title,
    singular,
    icon,
    description,
    rowKey: 'id',
    ...config,
    capabilities: { create: true, edit: true, remove: false, ...(config.capabilities || {}) },
    fields: config.fields || [],
    columns: config.columns || [],
  };
}

export const hrResources = {
  employees: resource('employees', 'Employee directory', 'employee', 'pi pi-id-card', 'The source of truth for every person employed by Trimobe.', {
    itemKey: 'employee',
    fields: [
      text('employee_number', 'Employee number', { required: true, placeholder: 'e.g. TRM-0042' }),
      text('first_name', 'First name', { required: true }),
      text('last_name', 'Last name', { required: true }),
      text('work_email', 'Work email', { type: 'email', required: true }),
      text('personal_email', 'Personal email', { type: 'email' }),
      text('phone', 'Phone'),
      date('date_of_birth', 'Date of birth'),
      select('gender', 'Gender', ['female', 'male', 'non_binary', 'prefer_not_to_say']),
      text('nationality', 'Nationality'),
      relation('department_id', 'Department', 'departments', 'name', { help: 'Reassignment. Changing department may require selecting a position that belongs to it.' }),
      relation('position_id', 'Position', 'positions', 'title', { dependsOn: 'department_id' }),
      relation('manager_id', 'Manager', 'employees', 'full_name'),
      select('employment_type', 'Employment type', employmentTypes, { required: true }),
      select('employment_status', 'Status', employeeStatuses, { required: true, createOnly: true }),
      date('hire_date', 'Hire date', { required: true }),
      date('end_date', 'End date', { createOnly: true }),
      text('work_location', 'Work location'),
      text('address', 'Home address', { type: 'textarea', fullWidth: true }),
      text('notes', 'Internal notes', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'employee_number', label: 'Employee #' },
      { field: 'full_name', label: 'Employee', fallback: ['name'] },
      { field: 'position_title', label: 'Position', fallback: ['position.title'] },
      { field: 'department_name', label: 'Department', fallback: ['department.name'] },
      { field: 'work_email', label: 'Work email' },
      { field: 'account_status', label: 'Account status', type: 'status' },
      { field: 'employment_type', label: 'Type', type: 'enum' },
      { field: 'employment_status', label: 'Status', type: 'status' },
    ],
    filters: [{ key: 'employment_status', label: 'Status', options: employeeStatuses }],
    detailRoute: 'admin-hr-employee-detail',
    capabilities: { remove: false },
  }),

  departments: resource('departments', 'Departments', 'department', 'pi pi-sitemap', 'Define reporting lines and ownership across the organization.', {
    itemKey: 'department',
    fields: [
      text('name', 'Department name', { required: true, localized: true }),
      text('code', 'Code', { required: true, placeholder: 'e.g. OPS' }),
      relation('parent_department_id', 'Parent department', 'departments', 'name', { help: 'Department heads cover this department and every child department below it.' }),
      relation('manager_employee_id', 'Department head', 'employees', 'full_name'),
      text('description', 'Description', { type: 'textarea', fullWidth: true, localized: true }),
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { field: 'name', label: 'Department' },
      { field: 'code', label: 'Code' },
      { field: 'parent_department_name', label: 'Parent department' },
      { field: 'manager_name', label: 'Department head' },
      { field: 'employee_count', label: 'Employees', type: 'number' },
      { field: 'is_active', label: 'Active', type: 'boolean' },
    ],
  }),

  positions: resource('positions', 'Positions', 'position', 'pi pi-briefcase', 'Maintain job titles, levels, and their departments.', {
    itemKey: 'position',
    fields: [
      text('title', 'Position title', { required: true, localized: true }),
      text('code', 'Code', { required: true }),
      relation('department_id', 'Department', 'departments', 'name', { required: true }),
      relation('parent_position_id', 'Reports to (parent position)', 'positions', 'title', { dependsOn: 'department_id', excludeSelf: true, help: 'Must belong to the same department. Sets the base reporting line used to seed onboarding managers and position-based leave approvals. Use the Position hierarchy tab for a visual editor.' }),
      number('hierarchy_rank', 'Hierarchy rank', { help: '1 = most senior. Orders the ladder within a department.' }),
      text('grade', 'Grade'),
      money('min_salary', 'Minimum salary'),
      money('max_salary', 'Maximum salary'),
      text('currency', 'Currency', { placeholder: 'MGA' }),
      text('description', 'Description', { type: 'textarea', fullWidth: true, localized: true }),
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { field: 'title', label: 'Position' },
      { field: 'code', label: 'Code' },
      { field: 'department_name', label: 'Department' },
      { field: 'parent_position_title', label: 'Reports to' },
      { field: 'hierarchy_rank', label: 'Rank', type: 'number' },
      { field: 'grade', label: 'Grade' },
      { field: 'employee_count', label: 'Employees', type: 'number' },
      { field: 'is_active', label: 'Active', type: 'boolean' },
    ],
    filters: [{ key: 'department_id', label: 'Department', resource: 'departments', optionLabel: 'name' }],
  }),

  // Authored in a dedicated editor (HrContractTemplates), not the generic table:
  // a template body is long-form prose with placeholders and needs a live
  // preview. The definition still lives here so the shared HR api helpers
  // resolve the endpoint and envelope keys.
  'contract-templates': resource('contract-templates', 'Contract templates', 'contract template', 'pi pi-file-edit', 'Author reusable contract and agreement bodies with fill-in-the-blank placeholders.', {
    fields: [
      select('kind', 'Template kind', ['employment', 'memo_deal'], { required: true }),
      text('name', 'Template name', { required: true }),
      text('code', 'Code', { required: true, placeholder: 'e.g. EMPLOYMENT_STD' }),
      text('description', 'Description', { type: 'textarea', fullWidth: true }),
      text('body', 'Body', { type: 'textarea', fullWidth: true, required: true }),
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { field: 'name', label: 'Template' },
      { field: 'kind', label: 'Kind', type: 'enum' },
      { field: 'code', label: 'Code' },
      { field: 'is_active', label: 'Active', type: 'boolean' },
    ],
  }),

  // Read-only through the generic helpers; drafting, issuing, signing and
  // voiding all go through the dedicated workflow endpoints.
  'contract-documents': resource('contract-documents', 'Contract documents', 'contract document', 'pi pi-file', 'Issue contracts and agreements from a template, then freeze and print them.', {
    capabilities: { create: false, edit: false, remove: false },
    fields: [],
    columns: [
      { field: 'reference', label: 'Reference' },
      { field: 'party_name', label: 'Party' },
      { field: 'template_name', label: 'Template' },
      { field: 'kind', label: 'Kind', type: 'enum' },
      { field: 'issue_date', label: 'Issued', type: 'date' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
  }),

  contracts: resource('contracts', 'Contracts', 'contract', 'pi pi-file-edit', 'Track employment terms, dates, working hours, and contract status.', {
    itemKey: 'contract',
    capabilities: { remove: false },
    editWhen: (row) => row.status === 'draft',
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      select('contract_type', 'Contract type', employmentTypes, { required: true }),
      date('start_date', 'Start date', { required: true }),
      date('end_date', 'End date'),
      date('probation_end_date', 'Probation end date'),
      money('salary', 'Salary', { required: true }),
      text('currency', 'Currency', { placeholder: 'MGA' }),
      select('pay_frequency', 'Pay frequency', ['weekly', 'biweekly', 'monthly'], { required: true }),
      select('status', 'Status', ['draft', 'active', 'expired', 'terminated'], { required: true }),
      text('document_url', 'Contract document URL'),
      text('terms', 'Terms and notes', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'contract_type', label: 'Type', type: 'enum' },
      { field: 'start_date', label: 'Starts', type: 'date' },
      { field: 'end_date', label: 'Ends', type: 'date' },
      { field: 'salary', label: 'Salary', type: 'money' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
  }),

  documents: resource('documents', 'Employee documents', 'document', 'pi pi-folder', 'Store secure employee records with expiry and verification tracking.', {
    itemKey: 'document',
    accessActions: { create: 'upload' },
    capabilities: { remove: true },
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      select('document_type', 'Document type', ['identity', 'contract', 'certificate', 'work_permit', 'medical', 'tax', 'other'], { required: true }),
      text('name', 'Document name', { required: true }),
      { key: 'attachment', label: 'Secure file', type: 'file', fullWidth: true, persist: false },
      date('expires_at', 'Expiry date'),
      { key: 'is_confidential', label: 'Confidential', type: 'boolean' },
      text('notes', 'Notes', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'name', label: 'Document' },
      { field: 'document_type', label: 'Type', type: 'enum' },
      { field: 'expires_at', label: 'Expires', type: 'date' },
      { field: 'is_confidential', label: 'Confidential', type: 'boolean' },
    ],
    download: true,
  }),

  'emergency-contacts': resource('emergency-contacts', 'Emergency contacts', 'emergency contact', 'pi pi-phone', 'Keep trusted contacts readily available for employee emergencies.', {
    itemKey: 'emergency_contact',
    capabilities: { remove: true },
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      text('name', 'Contact name', { required: true }),
      text('relationship', 'Relationship', { required: true }),
      text('phone', 'Phone', { required: true }),
      text('alternate_phone', 'Alternate phone'),
      text('email', 'Email', { type: 'email' }),
      { key: 'is_primary', label: 'Primary contact', type: 'boolean' },
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'name', label: 'Contact' },
      { field: 'relationship', label: 'Relationship' },
      { field: 'phone', label: 'Phone' },
      { field: 'is_primary', label: 'Primary', type: 'boolean' },
    ],
  }),

  'lifecycle-events': resource('lifecycle-events', 'Employee lifecycle', 'lifecycle event', 'pi pi-directions', 'Plan and audit onboarding, probation, moves, promotions, and offboarding.', {
    itemKey: 'lifecycle_event',
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      select('event_type', 'Journey stage', ['onboarding', 'probation_started', 'probation_completed', 'transfer', 'promotion', 'offboarding'], { required: true }),
      text('title', 'Event title', { required: true }),
      date('effective_date', 'Effective date', { required: true }),
      relation('to_department_id', 'To department', 'departments'),
      relation('to_position_id', 'To position', 'positions', 'title', { dependsOn: 'to_department_id', dependsOptional: true }),
      relation('to_manager_id', 'To manager', 'employees', 'full_name'),
      date('probation_end_date', 'Probation end date'),
      text('notes', 'Notes', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'event_type', label: 'Journey stage', type: 'enum' },
      { field: 'title', label: 'Event' },
      { field: 'effective_date', label: 'Effective date', type: 'date' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    filters: [{ key: 'event_type', label: 'Journey stage', options: ['onboarding', 'probation_started', 'probation_completed', 'transfer', 'promotion', 'offboarding'] }],
    capabilities: { edit: false, remove: false },
    actions: [
      { key: 'complete', label: 'Complete', icon: 'pi pi-check', severity: 'success', when: (row) => row.status === 'scheduled' },
    ],
  }),

  'leave-policies': resource('leave-policies', 'Leave policies', 'leave policy', 'pi pi-cog', 'Define entitlements, accrual, carry-over, and approval paths.', {
    itemKey: 'leave_policy',
    fields: [
      text('name', 'Policy name', { required: true, localized: true }),
      text('code', 'Code', { required: true }),
      select('leave_type', 'Leave type', ['annual', 'sick', 'maternity', 'paternity', 'compassionate', 'unpaid', 'other'], { required: true }),
      number('days_per_year', 'Annual allowance (days)', { required: true }),
      select('accrual_mode', 'Accrual mode', ['annual', 'monthly', 'manual'], { required: true }),
      number('carry_over_days', 'Carry-over limit (days)'),
      number('minimum_notice_days', 'Minimum notice (days)'),
      number('max_consecutive_days', 'Maximum consecutive days'),
      { key: 'approval_levels', label: 'Approval chain', type: 'approvalChain', required: true, fullWidth: true, help: 'Requests are approved in this order; each step must sign off before the next.' },
      { key: 'requires_attachment', label: 'Attachment required', type: 'boolean' },
      { key: 'is_active', label: 'Active', type: 'boolean' },
      text('description', 'Policy details', { type: 'textarea', fullWidth: true, localized: true }),
    ],
    columns: [
      { field: 'name', label: 'Policy' },
      { field: 'leave_type', label: 'Leave type', type: 'enum' },
      { field: 'days_per_year', label: 'Annual days', type: 'number' },
      { field: 'accrual_mode', label: 'Accrual', type: 'enum' },
      { field: 'approval_levels', label: 'Approval chain', type: 'approvalChain' },
      { field: 'is_active', label: 'Active', type: 'boolean' },
    ],
  }),

  'leave-balances': resource('leave-balances', 'Leave balances', 'leave balance', 'pi pi-chart-pie', 'Review entitlement, usage, pending days, and remaining leave.', {
    itemKey: 'leave_balance',
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      relation('policy_id', 'Leave policy', 'leave-policies', 'name', { required: true }),
      number('balance_year', 'Year', { required: true }),
      number('allocated_days', 'Allocated days', { required: true }),
      number('carried_days', 'Carried days'),
      number('adjustment_days', 'Adjustment days'),
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'policy_name', label: 'Policy' },
      { field: 'balance_year', label: 'Year', type: 'number' },
      { field: 'allocated_days', label: 'Allocated', type: 'number' },
      { field: 'carried_days', label: 'Carried', type: 'number' },
      { field: 'used_days', label: 'Used', type: 'number' },
      { field: 'pending_days', label: 'Pending', type: 'number' },
      { field: 'remaining_days', label: 'Remaining', type: 'number' },
    ],
    capabilities: { remove: false },
  }),

  'leave-requests': resource('leave-requests', 'Leave requests', 'leave request', 'pi pi-calendar-plus', 'Submit, review, and process leave through multi-level approvals.', {
    itemKey: 'leave_request',
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      relation('policy_id', 'Leave policy', 'leave-policies', 'name', { required: true }),
      // Composite editor drives the four fields below (kept for serialization).
      { key: 'leave_dates', label: 'Leave dates', type: 'leaveDates', fullWidth: true, persist: false },
      date('start_date', 'Start date', { required: true, hidden: true }),
      date('end_date', 'End date', { required: true, hidden: true }),
      select('start_portion', 'First day', ['full', 'half'], { hidden: true }),
      select('end_portion', 'Last day', ['full', 'half'], { hidden: true }),
      // Reason sits right under the dates so it isn't scrolled past at the bottom.
      text('reason', 'Reason', { type: 'textarea', fullWidth: true }),
      relation('document_id', 'Supporting document', 'documents', 'name', { permission: ['hr', 'hr_documents'] }),
      text('attachment_url', 'Attachment URL'),
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'policy_name', label: 'Leave type', fallback: ['leave_type'] },
      { field: 'start_date', label: 'Starts', type: 'date' },
      { field: 'end_date', label: 'Ends', type: 'date' },
      { field: 'requested_days', label: 'Days', type: 'number' },
      { field: 'current_approval_level', label: 'Approval level', type: 'number' },
      { field: 'total_approval_levels', label: 'Total approvals', type: 'number' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    filters: [{ key: 'status', label: 'Status', options: requestStatuses }],
    actions: [
      { key: 'approve', label: 'Approve', icon: 'pi pi-check', severity: 'success', when: (row) => row.status === 'pending' },
      { key: 'reject', permissionAction: 'approve', label: 'Reject', icon: 'pi pi-times', severity: 'danger', when: (row) => row.status === 'pending', requiresNote: true },
      { key: 'cancel', label: 'Cancel request', icon: 'pi pi-ban', severity: 'secondary', when: (row) => ['pending', 'approved'].includes(row.status) },
    ],
    capabilities: { edit: false, remove: false },
  }),

  shifts: resource('shifts', 'Shift planning', 'shift', 'pi pi-clock', 'Create rotas and assign employees to planned working periods.', {
    itemKey: 'shift',
    fields: [
      select('shift_type', 'Shift type', ['day', 'night', 'special'], { required: true }),
      // Day/night shifts carry a canonical name (composed on submit); only a
      // special shift asks for a bespoke name.
      text('name', 'Shift name', {
        required: true,
        visibleWhen: (form) => form.shift_type === 'special',
        deriveValue: (form) => (form.shift_type === 'night' ? 'Night' : 'Day'),
        placeholder: 'e.g. Weekend cover',
        help: 'Only special shifts need a custom name.',
      }),
      text('code', 'Code', { required: true }),
      time('start_time', 'Start time', { required: true }),
      time('end_time', 'End time', { required: true }),
      number('break_minutes', 'Break (minutes)'),
      number('grace_minutes', 'Grace period (minutes)'),
      weekdays('work_days', 'Work days', { required: true, fullWidth: true, help: 'The weekly days this shift is worked. Assigned employees follow it until a new shift is assigned.' }),
      { key: 'is_active', label: 'Active', type: 'boolean' },
    ],
    columns: [
      { field: 'shift_type', label: 'Type', type: 'enum' },
      { field: 'name', label: 'Shift' },
      { field: 'code', label: 'Code' },
      { field: 'start_time', label: 'Starts', type: 'time' },
      { field: 'end_time', label: 'Ends', type: 'time' },
      { field: 'break_minutes', label: 'Break', type: 'duration' },
      { field: 'grace_minutes', label: 'Grace', type: 'duration' },
      { field: 'work_days', label: 'Work days', type: 'weekdays' },
      { field: 'is_active', label: 'Active', type: 'boolean' },
    ],
  }),

  'shift-assignments': resource('shift-assignments', 'Shift assignments', 'shift assignment', 'pi pi-calendar', 'Assign reusable shift patterns to employees for an effective date range.', {
    itemKey: 'shift_assignment',
    capabilities: { remove: false },
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      relation('shift_id', 'Shift', 'shifts', 'name', { required: true }),
      date('start_date', 'Start date', { required: true }),
      date('end_date', 'End date'),
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'shift_name', label: 'Shift' },
      { field: 'start_date', label: 'Starts', type: 'date' },
      { field: 'end_date', label: 'Ends', type: 'date' },
    ],
  }),

  attendance: resource('attendance', 'Attendance', 'attendance record', 'pi pi-calendar-clock', 'Compare scheduled and actual time, including late arrivals and overtime.', {
    itemKey: 'attendance_record',
    // Records are created by the self-service clock (server-stamped times), not a
    // manual form. Admins may still edit a record to correct it.
    capabilities: { create: false, remove: false },
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      relation('shift_id', 'Shift', 'shifts', 'name'),
      date('attendance_date', 'Attendance date', { required: true }),
      { key: 'clock_in', label: 'Clock in', type: 'datetime' },
      { key: 'clock_out', label: 'Clock out', type: 'datetime' },
      select('status', 'Status', ['present', 'absent', 'leave', 'holiday', 'remote'], { required: true }),
      select('source', 'Source', ['manual', 'import', 'device', 'system']),
      text('notes', 'Notes', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'attendance_date', label: 'Date', type: 'date' },
      { field: 'employee_name', label: 'Employee' },
      { field: 'clock_in', label: 'Clock in', type: 'time' },
      { field: 'clock_out', label: 'Clock out', type: 'time' },
      { field: 'worked_minutes', label: 'Worked', type: 'duration' },
      { field: 'late_minutes', label: 'Late', type: 'duration' },
      { field: 'overtime_minutes', label: 'Overtime', type: 'duration' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
  }),

  overtime: resource('overtime', 'Overtime', 'attendance record', 'pi pi-hourglass', 'Review and correct overtime captured from attendance.', {
    endpoint: 'attendance', collectionKey: 'attendance', itemKey: 'attendance_record', fixedParams: { overtime: true },
    capabilities: { create: false, edit: false, remove: false },
    fields: [],
    columns: [
      { field: 'attendance_date', label: 'Date', type: 'date' },
      { field: 'employee_name', label: 'Employee' },
      { field: 'overtime_minutes', label: 'Overtime', type: 'duration' },
      { field: 'notes', label: 'Notes' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
  }),

  lateness: resource('lateness', 'Lateness', 'attendance record', 'pi pi-stopwatch', 'Spot recurring late arrivals and capture manager follow-up.', {
    endpoint: 'attendance', collectionKey: 'attendance', itemKey: 'attendance_record', fixedParams: { late: true },
    capabilities: { create: false, edit: false, remove: false },
    fields: [],
    columns: [
      { field: 'attendance_date', label: 'Date', type: 'date' },
      { field: 'employee_name', label: 'Employee' },
      { field: 'clock_in', label: 'Clock in' },
      { field: 'late_minutes', label: 'Late', type: 'duration' },
      { field: 'notes', label: 'Manager note' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
  }),

  timesheets: resource('timesheets', 'Timesheets', 'timesheet', 'pi pi-list-check', 'Capture submitted hours, approvals, and overtime totals.', {
    itemKey: 'timesheet',
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      date('week_start', 'Week starting', { required: true }),
      number('regular_hours', 'Regular hours', { required: true }),
      number('overtime_hours', 'Overtime hours'),
      { key: 'entries', label: 'Entries (JSON)', type: 'json', fullWidth: true, placeholder: '[]' },
      text('notes', 'Notes', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'week_start', label: 'Week starting', type: 'date' },
      { field: 'regular_hours', label: 'Regular hours', type: 'number' },
      { field: 'overtime_hours', label: 'Overtime hours', type: 'number' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    capabilities: { remove: false },
    editWhen: (row) => ['draft', 'rejected'].includes(row.status),
    actions: [
      { key: 'submit', label: 'Submit', icon: 'pi pi-send', severity: 'info', when: (row) => ['draft', 'rejected'].includes(row.status) },
      { key: 'approve', label: 'Approve', icon: 'pi pi-check', severity: 'success', when: (row) => row.status === 'submitted' },
      { key: 'reject', permissionAction: 'approve', label: 'Reject', icon: 'pi pi-times', severity: 'danger', requiresNote: true, when: (row) => row.status === 'submitted' },
    ],
  }),

  'performance-reviews': resource('performance-reviews', 'Performance reviews', 'performance review', 'pi pi-chart-line', 'Run structured reviews with ratings and development outcomes.', {
    itemKey: 'performance_review',
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      relation('reviewer_employee_id', 'Reviewer', 'employees', 'full_name', { required: true }),
      date('review_period_start', 'Period start', { required: true }),
      date('review_period_end', 'Period end', { required: true }),
      select('review_type', 'Review type', ['annual', 'probation', 'quarterly', 'project', 'other'], { required: true }),
      number('overall_rating', 'Overall rating'),
      text('strengths', 'Strengths', { type: 'textarea', fullWidth: true }),
      text('improvements', 'Development areas', { type: 'textarea', fullWidth: true }),
      text('employee_comments', 'Employee comments', { type: 'textarea', fullWidth: true }),
      text('reviewer_comments', 'Reviewer comments', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'reviewer_name', label: 'Reviewer' },
      { field: 'review_period_end', label: 'Period end', type: 'date' },
      { field: 'review_type', label: 'Type', type: 'enum' },
      { field: 'overall_rating', label: 'Rating', type: 'number' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    capabilities: { remove: false },
    editWhen: (row) => row.status !== 'completed',
    actions: [
      { key: 'complete', label: 'Complete review', icon: 'pi pi-check', severity: 'success', when: (row) => ['draft', 'in_progress', 'employee_acknowledged'].includes(row.status) },
    ],
  }),

  goals: resource('goals', 'Goals', 'goal', 'pi pi-flag', 'Connect measurable employee goals to review cycles.', {
    itemKey: 'goal',
    capabilities: { remove: false },
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      relation('review_id', 'Performance review', 'performance-reviews', 'review_type'),
      text('title', 'Goal', { required: true }),
      text('description', 'Description', { type: 'textarea', fullWidth: true }),
      date('start_date', 'Start date'),
      date('due_date', 'Due date'),
      number('progress_percent', 'Progress (%)'),
      number('weight_percent', 'Weight (%)'),
      select('status', 'Status', ['not_started', 'in_progress', 'completed', 'cancelled'], { required: true }),
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'title', label: 'Goal' },
      { field: 'due_date', label: 'Due', type: 'date' },
      { field: 'progress_percent', label: 'Progress', type: 'percent' },
      { field: 'weight_percent', label: 'Weight', type: 'percent' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
  }),

  feedback: resource('feedback', 'Feedback', 'feedback entry', 'pi pi-comments', 'Record timely recognition and constructive feedback.', {
    itemKey: 'feedback',
    capabilities: { remove: false },
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      relation('author_employee_id', 'Feedback author', 'employees', 'full_name'),
      select('feedback_type', 'Feedback type', ['recognition', 'constructive', 'peer', 'manager', 'client'], { required: true }),
      select('visibility', 'Visibility', ['employee', 'manager', 'hr_private'], { required: true }),
      date('feedback_date', 'Date', { required: true }),
      number('rating', 'Rating'),
      text('content', 'Feedback', { type: 'textarea', required: true, fullWidth: true }),
    ],
    columns: [
      { field: 'feedback_date', label: 'Date', type: 'date' },
      { field: 'employee_name', label: 'Employee' },
      { field: 'author_name', label: 'From' },
      { field: 'feedback_type', label: 'Type', type: 'enum' },
      { field: 'content', label: 'Feedback' },
      { field: 'visibility', label: 'Visibility', type: 'enum' },
      { field: 'rating', label: 'Rating', type: 'number' },
    ],
  }),

  'one-to-ones': resource('one-to-ones', 'One-to-ones', 'one-to-one', 'pi pi-users', 'Schedule manager conversations and track agreed actions.', {
    itemKey: 'one_to_one',
    capabilities: { remove: false },
    editWhen: (row) => row.status === 'scheduled',
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      relation('manager_employee_id', 'Manager', 'employees', 'full_name', { required: true }),
      { key: 'scheduled_at', label: 'Scheduled at', type: 'datetime', required: true },
      text('agenda', 'Agenda', { type: 'textarea', fullWidth: true }),
      text('notes', 'Private notes', { type: 'textarea', fullWidth: true }),
      { key: 'action_items', label: 'Action items (JSON)', type: 'json', fullWidth: true, placeholder: '[]' },
    ],
    columns: [
      { field: 'scheduled_at', label: 'When', type: 'datetime' },
      { field: 'employee_name', label: 'Employee' },
      { field: 'manager_name', label: 'Manager' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    actions: [
      { key: 'complete', label: 'Complete', icon: 'pi pi-check', severity: 'success', when: (row) => row.status === 'scheduled' },
      { key: 'cancel', permissionAction: 'update', label: 'Cancel', icon: 'pi pi-ban', severity: 'secondary', requiresNote: true, when: (row) => row.status === 'scheduled' },
    ],
  }),

  vacancies: resource('vacancies', 'Vacancies', 'vacancy', 'pi pi-megaphone', 'Open approved roles and follow their hiring progress.', {
    itemKey: 'vacancy',
    capabilities: { remove: false },
    editWhen: (row) => !['filled', 'closed'].includes(row.status),
    fields: [
      text('title', 'Vacancy title', { required: true }),
      text('code', 'Code', { required: true }),
      relation('department_id', 'Department', 'departments', 'name', { required: true }),
      relation('position_id', 'Position', 'positions', 'title', { dependsOn: 'department_id' }),
      relation('hiring_manager_employee_id', 'Hiring manager', 'employees', 'full_name'),
      number('openings', 'Number of openings', { required: true }),
      { key: 'closes_at', label: 'Closes at', type: 'datetime' },
      select('employment_type', 'Employment type', employmentTypes),
      text('location', 'Location'),
      text('description', 'Role description', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'title', label: 'Vacancy' },
      { field: 'department_name', label: 'Department' },
      { field: 'hiring_manager_name', label: 'Hiring manager' },
      { field: 'openings', label: 'Openings', type: 'number' },
      { field: 'candidate_count', label: 'Candidates', type: 'number' },
      { field: 'closes_at', label: 'Closes', type: 'datetime' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    actions: [
      { key: 'submit', permissionAction: 'update', label: 'Open vacancy', icon: 'pi pi-send', severity: 'info', when: (row) => ['draft', 'paused'].includes(row.status) },
      { key: 'pause', permissionAction: 'update', label: 'Pause vacancy', icon: 'pi pi-pause', severity: 'warn', requiresNote: true, when: (row) => row.status === 'open' },
      { key: 'complete', permissionAction: 'update', label: 'Close as filled', icon: 'pi pi-check', severity: 'success', when: (row) => ['open', 'paused'].includes(row.status) },
      { key: 'cancel', permissionAction: 'update', label: 'Close vacancy', icon: 'pi pi-ban', severity: 'secondary', requiresNote: true, when: (row) => ['draft', 'open', 'paused'].includes(row.status) },
    ],
  }),

  candidates: resource('candidates', 'Candidates', 'candidate', 'pi pi-user-plus', 'Move applicants through a clear recruitment pipeline.', {
    itemKey: 'candidate',
    fields: [
      relation('vacancy_id', 'Vacancy', 'vacancies', 'title', { required: true }),
      text('first_name', 'First name', { required: true }),
      text('last_name', 'Last name', { required: true }),
      text('email', 'Email', { type: 'email', required: true }),
      text('phone', 'Phone'),
      text('source', 'Source'),
      text('resume_url', 'CV / resume URL'),
      number('rating', 'Rating'),
      text('notes', 'Recruiter notes', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'full_name', label: 'Candidate' },
      { field: 'vacancy_title', label: 'Vacancy' },
      { field: 'email', label: 'Email' },
      { field: 'source', label: 'Source' },
      { field: 'rating', label: 'Rating', type: 'number' },
      { field: 'status', label: 'Stage', type: 'status' },
    ],
    filters: [{ key: 'status', label: 'Stage', options: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn'] }],
    capabilities: { remove: false },
    editWhen: (row) => !['hired', 'rejected', 'withdrawn'].includes(row.status),
    actions: [
      { key: 'approve', label: 'Advance candidate', icon: 'pi pi-arrow-right', severity: 'success', when: (row) => ['applied', 'screening', 'interview'].includes(row.status) },
      { key: 'reject', permissionAction: 'update', label: 'Reject', icon: 'pi pi-times', severity: 'danger', requiresNote: true, when: (row) => ['applied', 'screening', 'interview', 'offer'].includes(row.status) },
      { key: 'cancel', permissionAction: 'update', label: 'Withdraw', icon: 'pi pi-ban', severity: 'secondary', requiresNote: true, when: (row) => ['applied', 'screening', 'interview', 'offer'].includes(row.status) },
      {
        key: 'hire', label: 'Hire candidate', icon: 'pi pi-user-plus', severity: 'success', when: (row) => row.status === 'offer', dialogTitle: 'Create employee from candidate',
        formFields: [
          { key: 'employee_number', label: 'Employee number', required: true },
          { key: 'work_email', label: 'Work email', type: 'email', required: true },
          { key: 'employment_type', label: 'Employment type', type: 'select', options: employmentTypes },
          { key: 'work_location', label: 'Work location' },
        ],
      },
    ],
  }),

  interviews: resource('interviews', 'Interviews', 'interview', 'pi pi-calendar', 'Coordinate interviews, interviewers, and decisions.', {
    itemKey: 'interview',
    capabilities: { remove: false },
    editWhen: (row) => row.status === 'scheduled',
    fields: [
      relation('candidate_id', 'Candidate', 'candidates', 'full_name', { required: true }),
      { key: 'scheduled_at', label: 'Scheduled at', type: 'datetime', required: true },
      number('duration_minutes', 'Duration (minutes)'),
      select('interview_type', 'Interview type', ['phone', 'video', 'onsite', 'technical', 'panel'], { required: true }),
      text('location', 'Location or video link'),
      { key: 'interviewer_employee_ids', label: 'Interviewer employee IDs (JSON)', type: 'json', fullWidth: true, placeholder: '[]' },
      number('score', 'Score'),
      text('feedback', 'Interview feedback', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'scheduled_at', label: 'When', type: 'datetime' },
      { field: 'candidate_name', label: 'Candidate' },
      { field: 'vacancy_title', label: 'Vacancy' },
      { field: 'interview_type', label: 'Type', type: 'enum' },
      { field: 'interviewer_employee_ids', label: 'Interviewers' },
      { field: 'status', label: 'Status', type: 'status' },
      { field: 'score', label: 'Score', type: 'number' },
    ],
    actions: [
      { key: 'complete', permissionAction: 'update', label: 'Complete interview', icon: 'pi pi-check', severity: 'success', when: (row) => row.status === 'scheduled' },
      { key: 'cancel', permissionAction: 'update', label: 'Cancel interview', icon: 'pi pi-ban', severity: 'secondary', requiresNote: true, when: (row) => row.status === 'scheduled' },
    ],
  }),

  offers: resource('offers', 'Offers and hiring', 'offer', 'pi pi-send', 'Issue offers and convert accepted candidates into employees.', {
    itemKey: 'offer',
    fields: [
      relation('candidate_id', 'Candidate', 'candidates', 'full_name', { required: true }),
      relation('position_id', 'Position', 'positions', 'title'),
      date('expires_at', 'Expiry date'),
      date('start_date', 'Proposed start date', { required: true }),
      money('offered_salary', 'Offered salary', { required: true }),
      text('currency', 'Currency', { placeholder: 'MGA' }),
      text('document_url', 'Offer document URL'),
      text('terms', 'Offer terms', { type: 'textarea', fullWidth: true }),
    ],
    columns: [
      { field: 'candidate_name', label: 'Candidate' },
      { field: 'vacancy_title', label: 'Vacancy' },
      { field: 'offered_salary', label: 'Salary', type: 'money' },
      { field: 'start_date', label: 'Start date', type: 'date' },
      { field: 'expires_at', label: 'Expires', type: 'date' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    capabilities: { remove: false },
    editWhen: (row) => row.status === 'draft',
    actions: [
      { key: 'submit', permissionAction: 'update', label: 'Send offer', icon: 'pi pi-send', severity: 'info', when: (row) => row.status === 'draft' },
      { key: 'approve', label: 'Accept offer', icon: 'pi pi-check', severity: 'success', when: (row) => row.status === 'sent' },
      { key: 'reject', permissionAction: 'update', label: 'Decline offer', icon: 'pi pi-times', severity: 'danger', requiresNote: true, when: (row) => row.status === 'sent' },
      { key: 'cancel', permissionAction: 'update', label: 'Withdraw offer', icon: 'pi pi-ban', severity: 'secondary', requiresNote: true, when: (row) => ['draft', 'sent'].includes(row.status) },
    ],
  }),

  expenses: resource('expenses', 'Expenses and approvals', 'expense', 'pi pi-wallet', 'Review employee claims from submission through reimbursement.', {
    itemKey: 'expense',
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      date('expense_date', 'Expense date', { required: true }),
      select('category', 'Category', ['travel', 'meals', 'accommodation', 'transport', 'supplies', 'communication', 'other'], { required: true }),
      text('description', 'Description', { required: true }),
      money('amount', 'Amount', { required: true }),
      text('currency', 'Currency', { placeholder: 'MGA' }),
      text('receipt_url', 'Receipt URL'),
    ],
    columns: [
      { field: 'expense_date', label: 'Date', type: 'date' },
      { field: 'employee_name', label: 'Employee' },
      { field: 'category', label: 'Category', type: 'enum' },
      { field: 'description', label: 'Description' },
      { field: 'amount', label: 'Amount', type: 'money' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
    filters: [{ key: 'status', label: 'Status', options: ['pending', 'approved', 'rejected', 'reimbursed'] }],
    actions: [
      { key: 'approve', label: 'Approve', icon: 'pi pi-check', severity: 'success', when: (row) => row.status === 'pending' },
      { key: 'reject', permissionAction: 'approve', label: 'Reject', icon: 'pi pi-times', severity: 'danger', when: (row) => row.status === 'pending', requiresNote: true },
      { key: 'reimburse', label: 'Mark reimbursed', icon: 'pi pi-wallet', severity: 'info', inputKey: 'payment_reference', inputLabel: 'Payment reference', when: (row) => row.status === 'approved' },
    ],
    capabilities: { remove: false },
    editWhen: (row) => row.status === 'pending',
  }),

  compensation: resource('compensation', 'Compensation', 'compensation record', 'pi pi-money-bill', 'Keep an effective-dated history of employee compensation.', {
    itemKey: 'compensation_record',
    fields: [
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      date('effective_date', 'Effective date', { required: true }),
      money('base_salary', 'Base salary', { required: true }),
      text('currency', 'Currency', { placeholder: 'MGA' }),
      select('pay_frequency', 'Pay frequency', ['monthly', 'weekly', 'daily', 'hourly']),
      money('bonus_target', 'Bonus target'),
      { key: 'allowances', label: 'Allowances (JSON)', type: 'json', fullWidth: true, placeholder: '[]' },
      text('reason', 'Change reason'),
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'effective_date', label: 'Effective', type: 'date' },
      { field: 'base_salary', label: 'Base salary', type: 'money' },
      { field: 'bonus_target', label: 'Bonus target', type: 'money' },
      { field: 'pay_frequency', label: 'Frequency', type: 'enum' },
      { field: 'is_current', label: 'Current', type: 'boolean' },
    ],
    capabilities: { edit: false, remove: false },
  }),

  benefits: resource('benefits', 'Benefits', 'benefit', 'pi pi-gift', 'Administer employee benefit enrolments and employer contributions.', {
    itemKey: 'benefit',
    fields: [
      text('name', 'Benefit name', { required: true, localized: true }),
      text('code', 'Code', { required: true }),
      select('benefit_type', 'Benefit type', ['health', 'life', 'transport', 'meal', 'housing', 'pension', 'allowance', 'other'], { required: true }),
      money('employee_contribution', 'Employee contribution'),
      money('employer_contribution', 'Employer contribution'),
      text('currency', 'Currency', { placeholder: 'MGA' }),
      { key: 'is_active', label: 'Active', type: 'boolean' },
      text('description', 'Description', { type: 'textarea', fullWidth: true, localized: true }),
    ],
    columns: [
      { field: 'name', label: 'Benefit' },
      { field: 'code', label: 'Code' },
      { field: 'benefit_type', label: 'Type', type: 'enum' },
      { field: 'employer_contribution', label: 'Employer contribution', type: 'money' },
      { field: 'employee_contribution', label: 'Employee contribution', type: 'money' },
      { field: 'is_active', label: 'Active', type: 'boolean' },
    ],
  }),

  'benefit-enrollments': resource('benefit-enrollments', 'Benefit enrolments', 'benefit enrolment', 'pi pi-user-plus', 'Enroll employees into benefit plans and keep dated coverage history.', {
    itemKey: 'benefit_enrollment',
    capabilities: { remove: false },
    fields: [
      relation('benefit_id', 'Benefit', 'benefits', 'name', { required: true }),
      relation('employee_id', 'Employee', 'employees', 'full_name', { required: true }),
      date('start_date', 'Start date', { required: true }),
      date('end_date', 'End date'),
      select('status', 'Status', ['active', 'suspended', 'ended'], { required: true }),
      { key: 'details', label: 'Details (JSON)', type: 'json', fullWidth: true, placeholder: '{}' },
    ],
    columns: [
      { field: 'employee_name', label: 'Employee' },
      { field: 'benefit_name', label: 'Benefit' },
      { field: 'start_date', label: 'Starts', type: 'date' },
      { field: 'end_date', label: 'Ends', type: 'date' },
      { field: 'status', label: 'Status', type: 'status' },
    ],
  }),

  notifications: resource('notifications', 'HR notifications', 'notification', 'pi pi-bell', 'A focused feed of HR deadlines, approvals, and employee changes.', {
    itemKey: 'notification',
    capabilities: { create: false, edit: false, remove: false },
    fields: [],
    columns: [
      { field: 'created_at', label: 'When', type: 'datetime' },
      { field: 'title', label: 'Notification' },
      { field: 'message', label: 'Details' },
      { field: 'notification_type', label: 'Type', type: 'enum' },
      { field: 'entity_type', label: 'Resource', type: 'enum' },
      { field: 'entity_id', label: 'Record #' },
      { field: 'is_read', label: 'Read', type: 'boolean' },
    ],
    actions: [
      { key: 'read', label: 'Mark as read', icon: 'pi pi-check', severity: 'success', method: 'patch', when: (row) => !row.is_read },
    ],
  }),

  'audit-history': resource('audit-history', 'HR audit history', 'audit event', 'pi pi-history', 'A complete, append-only trail of HR access and changes.', {
    itemKey: 'audit_event',
    capabilities: { create: false, edit: false, remove: false },
    fields: [],
    columns: [
      { field: 'created_at', label: 'When', type: 'datetime' },
      { field: 'actor_name', label: 'Who' },
      { field: 'source', label: 'Source', type: 'enum' },
      { field: 'method', label: 'Action', type: 'enum' },
      { field: 'target_type', label: 'Resource', type: 'enum' },
      { field: 'target_id', label: 'Record #' },
      { field: 'from_status', label: 'From status', type: 'status' },
      { field: 'to_status', label: 'To status', type: 'status' },
      { field: 'note', label: 'Reason / note' },
      { field: 'status_code', label: 'Status', type: 'number' },
    ],
  }),
};

export const hrAreas = {
  organization: {
    title: 'Organization and records',
    description: 'Departments, positions, contracts, employee documents, and emergency contacts.',
    icon: 'pi pi-sitemap',
    defaultResource: 'departments',
    // Keep in step with HR_AREA_RESOURCES in data/hrAccess.js: this list renders
    // the tab strip, that one gates the sidebar entry. A resource missing here
    // simply never appears, with no error to explain why.
    resources: ['departments', 'positions', 'position-hierarchy', 'contracts', 'contract-templates', 'contract-documents', 'documents', 'emergency-contacts'],
  },
  lifecycle: {
    title: 'Employee lifecycle',
    description: 'Onboarding, probation, transfers, promotions, and offboarding in one dated history.',
    icon: 'pi pi-directions',
    defaultResource: 'lifecycle-events',
    resources: ['lifecycle-events'],
  },
  leave: {
    title: 'Leave management',
    description: 'Policies, employee balances, multi-level approvals, and the company leave calendar.',
    icon: 'pi pi-calendar-plus',
    defaultResource: 'leave-requests',
    resources: ['leave-requests', 'leave-policies', 'leave-balances', 'calendar'],
  },
  time: {
    title: 'Time and attendance',
    description: 'Shift planning, attendance, timesheets, overtime, and lateness.',
    icon: 'pi pi-clock',
    defaultResource: 'attendance',
    resources: ['attendance', 'shifts', 'shift-assignments', 'timesheets', 'overtime', 'lateness'],
  },
  performance: {
    title: 'Performance and growth',
    description: 'Reviews, goals, feedback, and one-to-one conversations.',
    icon: 'pi pi-chart-line',
    defaultResource: 'performance-reviews',
    resources: ['performance-reviews', 'goals', 'feedback', 'one-to-ones'],
  },
  recruitment: {
    title: 'Recruitment',
    description: 'Vacancies, candidates, interviews, offers, and hiring.',
    icon: 'pi pi-briefcase',
    defaultResource: 'candidates',
    resources: ['vacancies', 'candidates', 'interviews', 'offers'],
  },
  finance: {
    title: 'Pay and benefits',
    description: 'Expense approvals, reimbursements, compensation, and employee benefits.',
    icon: 'pi pi-wallet',
    defaultResource: 'expenses',
    resources: ['expenses', 'compensation', 'benefits', 'benefit-enrollments'],
  },
};

export const hrReports = [
  { id: 'workforce', label: 'Workforce', description: 'People by status, department, position, and employment type.' },
  { id: 'leave', label: 'Leave usage', description: 'Entitlement, pending requests, and days taken.' },
  { id: 'attendance', label: 'Attendance', description: 'Presence, absences, lateness, and overtime.' },
  { id: 'performance', label: 'Performance', description: 'Review completion, ratings, goals, and progress.' },
  { id: 'recruitment', label: 'Recruitment funnel', description: 'Vacancies, stages, time-to-hire, and offer outcomes.' },
  { id: 'expenses', label: 'Expenses', description: 'Submitted, approved, rejected, and reimbursed claims.' },
  { id: 'compensation', label: 'Compensation', description: 'Effective-dated salary and benefit totals.' },
];

export function getHrResource(id) {
  return hrResources[id] || null;
}

export function getHrArea(id) {
  return hrAreas[id] || null;
}
