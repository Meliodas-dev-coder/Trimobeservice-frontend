import { api } from '@/api/client';

function listEnvelope(data, key, page = 1, limit = 20) {
  const items = data?.[key] || [];
  return {
    items,
    meta: data?.meta || { total: items.length, page, limit },
  };
}

export async function listCategories() {
  const data = await api.get('/categories', { auth: false });
  return data?.categories || [];
}

export async function listBrands() {
  const data = await api.get('/brands', { auth: false });
  return data?.brands || [];
}

export async function listProducts({
  page = 1,
  limit = 20,
  q = '',
  category_id = '',
  brand_id = '',
  template_key = '',
  exclude_template_key = '',
} = {}) {
  const data = await api.get('/products', {
    auth: false,
    params: { page, limit, q, category_id, brand_id, template_key, exclude_template_key },
  });
  return listEnvelope(data, 'products', page, limit);
}

export async function getProduct(slug) {
  const data = await api.get(`/products/${encodeURIComponent(slug)}`, { auth: false });
  return data?.product || null;
}

export async function listCarCategories() {
  const data = await api.get('/car-categories', { auth: false });
  return data?.car_categories || [];
}

export async function listCars({ page = 1, limit = 20, q = '', category_id = '' } = {}) {
  const data = await api.get('/cars', {
    auth: false,
    params: { page, limit, q, category_id },
  });
  return listEnvelope(data, 'cars', page, limit);
}

export async function getCar(slug) {
  const data = await api.get(`/cars/${encodeURIComponent(slug)}`, { auth: false });
  return data?.car || null;
}

export async function checkAvailability({ car_id, start, end }) {
  const data = await api.get('/availability', {
    auth: false,
    params: { car_id, start, end },
  });
  return data?.availability || null;
}

// Current and upcoming occupied windows for a car, so the booking calendar can
// disable already-taken days up front.
export async function listBookedRanges(carId) {
  const data = await api.get('/availability/ranges', {
    auth: false,
    params: { car_id: carId },
  });
  return data?.booked_ranges || [];
}

export async function createBooking(body) {
  const data = await api.post('/bookings', body);
  return data?.booking || null;
}

export async function listMyOrders({ page = 1, limit = 20 } = {}) {
  const data = await api.get('/orders', { params: { page, limit } });
  return listEnvelope(data, 'orders', page, limit);
}

export async function getMyOrder(id) {
  const data = await api.get(`/orders/${id}`);
  return data?.order || null;
}

export async function cancelMyOrder(id) {
  const data = await api.post(`/orders/${id}/cancel`, {});
  return data?.order || null;
}

export async function listMyBookings({ page = 1, limit = 20 } = {}) {
  const data = await api.get('/bookings', { params: { page, limit } });
  return listEnvelope(data, 'bookings', page, limit);
}

export async function getMyBooking(id) {
  const data = await api.get(`/bookings/${id}`);
  return data?.booking || null;
}

export async function cancelMyBooking(id) {
  const data = await api.post(`/bookings/${id}/cancel`, {});
  return data?.booking || null;
}

export async function listEventServiceCategories() {
  const data = await api.get('/event-service-categories', { auth: false });
  return data?.event_service_categories || [];
}

export async function listEventServices({ category_id = '' } = {}) {
  const data = await api.get('/event-services', {
    auth: false,
    params: { category_id },
  });
  return data?.event_services || [];
}

export async function getEventService(slug) {
  const data = await api.get(`/event-services/${encodeURIComponent(slug)}`, { auth: false });
  return data?.event_service || null;
}

export async function listArtists({ q = '', featured = '' } = {}) {
  const data = await api.get('/artists', { auth: false, params: { q, featured } });
  return data?.artists || [];
}

export async function getArtist(slug) {
  const data = await api.get(`/artists/${encodeURIComponent(slug)}`, { auth: false });
  return data?.artist || null;
}

export async function createEventRequest(body) {
  const data = await api.post('/event-requests', body);
  return data?.event_request || null;
}

export async function listMyEventRequests({ page = 1, limit = 20 } = {}) {
  const data = await api.get('/event-requests', { params: { page, limit } });
  return listEnvelope(data, 'event_requests', page, limit);
}

export async function getMyEventRequest(id) {
  const data = await api.get(`/event-requests/${id}`);
  return data?.event_request || null;
}

export async function cancelMyEventRequest(id) {
  const data = await api.post(`/event-requests/${id}/cancel`, {});
  return data?.event_request || null;
}

export async function listAddresses() {
  const data = await api.get('/account/addresses');
  return data?.addresses || [];
}

export async function createAddress(body) {
  const data = await api.post('/account/addresses', body);
  return data?.address || null;
}

export async function updateAddress(id, body) {
  const data = await api.put(`/account/addresses/${id}`, body);
  return data?.address || null;
}

export async function deleteAddress(id) {
  await api.del(`/account/addresses/${id}`);
}
