// Generic CRUD helpers that drive the admin resource screens from the
// `adminResources` contract.
import { api, uploadFile } from '@/api/client';

// These admin list endpoints support server-side pagination (+ ?q / filters).
// The rest return the full list in one shot (categories, brands, car-categories,
// drivers), so those paginate on the client.
const PAGINATED = new Set(['products', 'cars', 'orders', 'bookings', 'payments', 'customers']);

export function isPaginated(resource) {
  return PAGINATED.has(resource.id);
}

export async function listResource(resource, { page = 1, limit = 20, q = '', filters = {} } = {}) {
  const params = {};
  if (isPaginated(resource)) {
    params.page = page;
    params.limit = limit;
    if (q) {
      params.q = q;
    }
  }
  for (const [key, value] of Object.entries(filters)) {
    if (value !== null && value !== undefined && value !== '') {
      params[key] = value;
    }
  }
  const data = await api.get(resource.api.list, { params });
  const items = data?.[resource.api.collectionKey] ?? [];
  const meta = data?.meta ?? { total: items.length, page, limit };
  return { items, meta };
}

export async function getResource(resource, id) {
  const data = await api.get(`${resource.api.itemBase}/${id}`);
  return data?.[resource.api.itemKey] ?? null;
}

export async function createResource(resource, body) {
  const data = await api.post(resource.api.create, body);
  return data?.[resource.api.itemKey] ?? null;
}

export async function updateResource(resource, id, body) {
  const data = await api.put(`${resource.api.itemBase}/${id}`, body);
  return data?.[resource.api.itemKey] ?? null;
}

export async function deleteResource(resource, id) {
  await api.del(`${resource.api.itemBase}/${id}`);
}

// Upload an image file to the backend, which stores it in cloud storage and
// returns its public URL: { url, key }.
export async function uploadImage(file) {
  const form = new FormData();
  form.append('file', file);
  return uploadFile('/admin/uploads', form);
}

// Load {label,value} options for a relation select field (e.g. category_id).
export async function loadFieldOptions(field) {
  const data = await api.get(field.optionsEndpoint, { params: { limit: 100 } });
  const items = data?.[field.collectionKey] ?? [];
  return items.map((item) => ({ label: item[field.optionLabel], value: item[field.optionValue] }));
}

// Build an API request body from raw form values, coercing types to match the
// backend DTOs (money → DECIMAL string, number → number, blank optionals dropped).
export function serializeForm(fields, values) {
  const body = {};
  for (const field of fields) {
    let value = values[field.key];
    if (value === undefined) {
      continue;
    }
    if (typeof value === 'string') {
      value = value.trim();
    }
    const isBlank = value === '' || value === null;

    if (field.type === 'money') {
      if (isBlank) {
        continue; // let the backend apply its default (e.g. category rate)
      }
      body[field.key] = Number(value).toFixed(2);
      continue;
    }
    if (field.type === 'number') {
      if (isBlank) {
        continue;
      }
      body[field.key] = Number(value);
      continue;
    }
    if (isBlank && !field.required) {
      continue; // omit optional blanks (relation selects, optional text)
    }
    body[field.key] = value;
  }
  return body;
}
