import { api, downloadFile, uploadFile } from '@/api/client';
import { cleanTranslations } from '@/utils/localized';

export const HR_BASE = '/admin/hr';

function endpoint(resource) {
  return `${HR_BASE}/${resource.endpoint || resource.id}`;
}

function unwrapList(data, resource) {
  if (Array.isArray(data)) return data;
  return data?.[resource.collectionKey || resource.id]
    || data?.items
    || data?.data
    || [];
}

function unwrapItem(data, resource) {
  if (!data) return null;
  return data?.[resource.itemKey || resource.singularKey]
    || data?.item
    || data?.data
    || data;
}

export function toDateOnly(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Normalize a time field (Date from the picker, or a "HH:MM[:SS]" string) to the
// "HH:MM" the MySQL TIME column expects.
export function toTimeString(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : String(value);
}

function normalizeMoney(value) {
  const raw = String(value).trim();
  const match = raw.match(/^(-?)(\d+)(?:\.(\d{0,2}))?$/);
  if (!match) return raw;
  const whole = match[2].replace(/^0+(?=\d)/, '') || '0';
  return `${match[1]}${whole}.${(match[3] || '').padEnd(2, '0')}`;
}

export function serializeHrForm(fields, source, includeNulls = false) {
  const body = {};
  const localizedKeys = [];
  for (const field of fields) {
    if (field.localized) localizedKeys.push(field.key);
    if (field.persist === false || source[field.key] === undefined) continue;
    let value = source[field.key];
    if (typeof value === 'string') value = value.trim();
    const blank = value === '' || value === null;
    if (blank && !field.required) {
      if (includeNulls) body[field.key] = null;
      continue;
    }
    if (field.type === 'date') value = toDateOnly(value);
    if (field.type === 'time') value = toTimeString(value);
    if (field.type === 'datetime' && value instanceof Date) value = value.toISOString();
    if (field.type === 'number') value = blank ? null : Number(value);
    // Monetary values intentionally stay decimal strings. This preserves cents
    // and matches the Go/MySQL contract instead of introducing float rounding.
    if (field.type === 'money') value = blank ? null : normalizeMoney(value);
    if (field.type === 'json') {
      if (typeof value === 'string') {
        value = value.trim() ? JSON.parse(value) : null;
      }
    }
    if (field.type === 'file') continue;
    body[field.key] = value;
  }
  // Per-locale content for free-text fields travels in its own `translations`
  // JSON column, exactly like the catalog/mobility resources do.
  if (localizedKeys.length) {
    body.translations = cleanTranslations(source.translations, localizedKeys);
  }
  return body;
}

export async function listHrResource(resource, options = {}) {
  const params = {
    page: options.page || 1,
    limit: options.limit || 20,
    ...(resource.fixedParams || {}),
    ...(options.params || {}),
  };
  if (options.q) params.q = options.q;
  const data = await api.get(endpoint(resource), { params });
  const items = unwrapList(data, resource);
  return {
    items,
    meta: data?.meta || { page: params.page, limit: params.limit, total: items.length },
  };
}

export async function listHrLookup(name) {
  const data = await api.get(`${HR_BASE}/lookups/${name}`);
  return data?.[name.replaceAll('-', '_')] || data?.items || data?.data || [];
}

export async function getHrResource(resource, id) {
  const data = await api.get(`${endpoint(resource)}/${id}`);
  return unwrapItem(data, resource);
}

export async function createHrResource(resource, body) {
  const data = await api.post(endpoint(resource), body);
  return unwrapItem(data, resource);
}

export async function updateHrResource(resource, id, body) {
  const data = await api.put(`${endpoint(resource)}/${id}`, body);
  return unwrapItem(data, resource);
}

export async function deleteHrResource(resource, id) {
  return api.del(`${endpoint(resource)}/${id}`);
}

export async function runHrAction(resource, id, action, body = {}, method = 'post') {
  return api[method](`${endpoint(resource)}/${id}/${action}`, body);
}

// Self-service attendance clock. Times are stamped by the server, so the record
// cannot be faked; the endpoints act on the caller's own employee only.
export async function getMyAttendanceToday() {
  const data = await api.get(`${HR_BASE}/attendance/me/today`);
  return data?.attendance_record || null;
}

export async function clockInAttendance() {
  const data = await api.post(`${HR_BASE}/attendance/clock-in`, {});
  return data?.attendance_record || null;
}

export async function clockOutAttendance() {
  const data = await api.post(`${HR_BASE}/attendance/clock-out`, {});
  return data?.attendance_record || null;
}

export async function loadHrDashboard(params = {}) {
  return api.get(`${HR_BASE}/dashboard`, { params });
}

export async function loadHrLeaveCalendar(start, end) {
  const data = await api.get(`${HR_BASE}/leave-calendar`, { params: { start, end } });
  return data?.leave_calendar || data?.requests || data?.items || [];
}

// Employee × day attendance grid. The server returns one cell per employee per
// day of the window — including the days with no record — so the client never
// has to guess where the holes are.
export async function loadHrAttendanceCalendar({ start, end, departmentId } = {}) {
  const params = { start, end };
  if (departmentId) params.department_id = departmentId;
  const data = await api.get(`${HR_BASE}/attendance/calendar`, { params });
  return data?.attendance_calendar || { start, end, days: [], employees: [] };
}

export async function loadHrReport(report, params = {}) {
  return api.get(`${HR_BASE}/reports/${report}`, { params });
}

export async function exportHrReport(report, params = {}) {
  const result = await downloadFile(`${HR_BASE}/exports/${report}`, { params });
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename || `hr-${report}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// HR documents never use the public image endpoint. The returned object is
// deliberately passed through so the backend may expose a secure file_id,
// storage_key, or signed URL without requiring a dialog redesign.
export async function uploadHrDocument(file, metadata = {}) {
  const form = new FormData();
  form.append('file', file);
  const accepted = ['employee_id', 'document_type', 'name', 'expires_at', 'is_confidential', 'notes'];
  for (const key of accepted) {
    const value = metadata[key];
    if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
  }
  return uploadFile(`${HR_BASE}/documents/upload`, form);
}

export async function downloadHrDocument(id, fallbackName = 'document') {
  const result = await downloadFile(`${HR_BASE}/documents/${id}/download`);
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = result.filename || fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// Organization-driven access control. Department modules are the outer
// boundary; position capabilities and HR policies are evaluated inside it.
export async function loadHrAccessCatalog() {
  return api.get(`${HR_BASE}/access/catalog`);
}

export async function loadDepartmentAccess(id) {
  return api.get(`${HR_BASE}/departments/${id}/access`);
}

export async function saveDepartmentAccess(id, modules) {
  return api.put(`${HR_BASE}/departments/${id}/access`, { modules });
}

export async function loadPositionAccess(id) {
  return api.get(`${HR_BASE}/positions/${id}/access`);
}

export async function savePositionAccess(id, payload) {
  return api.put(`${HR_BASE}/positions/${id}/access`, payload);
}

export async function loadEmployeeAccess(id) {
  return api.get(`${HR_BASE}/employees/${id}/access`);
}

// Base position hierarchy per department. The ladder seeds onboarding managers
// and drives the `position_hierarchy` leave-approval step.
export async function loadPositionHierarchy(departmentId) {
  const data = await api.get(`${HR_BASE}/departments/${departmentId}/position-hierarchy`);
  return data?.positions || [];
}

export async function applyPositionTemplate(departmentId) {
  const data = await api.post(`${HR_BASE}/departments/${departmentId}/position-hierarchy/apply`, {});
  return data?.positions || [];
}

export async function updatePositionHierarchy(id, body) {
  const data = await api.put(`${HR_BASE}/positions/${id}`, body);
  return data?.position || data;
}

// Contract/agreement templates. The preview is rendered server-side so what the
// author sees comes from the same renderer that will freeze issued documents.
export async function loadContractTokens() {
  const data = await api.get(`${HR_BASE}/contract-templates/tokens`);
  return data?.contract_tokens || [];
}

export async function previewContractTemplate(kind, body, values = {}) {
  const data = await api.post(`${HR_BASE}/contract-templates/preview`, { kind, body, values });
  return data?.preview || { rendered: '', blanks: [], unknown: [], conditional: [] };
}

// Issued contract documents. A draft is re-rendered on every save; issuing
// freezes the body and assigns a gapless reference, after which the stored text
// is the document and the template is never consulted again.
export async function previewContractDocument(payload) {
  const data = await api.post(`${HR_BASE}/contract-documents/preview`, payload);
  return data?.preview || { rendered: '', blanks: [], unknown: [], unfilled: [] };
}

export async function createContractDocument(payload) {
  const data = await api.post(`${HR_BASE}/contract-documents`, payload);
  return data?.contract_document || null;
}

export async function updateContractDocument(id, payload) {
  const data = await api.put(`${HR_BASE}/contract-documents/${id}`, payload);
  return data?.contract_document || null;
}

export async function getContractDocument(id) {
  const data = await api.get(`${HR_BASE}/contract-documents/${id}`);
  return data?.contract_document || data?.item || data;
}

export async function issueContractDocument(id) {
  const data = await api.post(`${HR_BASE}/contract-documents/${id}/issue`, {});
  return data?.contract_document || null;
}

export async function signContractDocument(id) {
  const data = await api.post(`${HR_BASE}/contract-documents/${id}/sign`, {});
  return data?.contract_document || null;
}

export async function voidContractDocument(id, reason) {
  const data = await api.post(`${HR_BASE}/contract-documents/${id}/void`, { reason });
  return data?.contract_document || null;
}

export async function deleteContractDocument(id) {
  return api.del(`${HR_BASE}/contract-documents/${id}`);
}

export async function provisionEmployeeAccount(id, payload = {}) {
  return api.post(`${HR_BASE}/employees/${id}/account`, payload);
}

export async function updateEmployeeAccount(id, payload) {
  return api.patch(`${HR_BASE}/employees/${id}/account`, payload);
}
