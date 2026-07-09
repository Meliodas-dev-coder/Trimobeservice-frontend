<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import GooglePlaceInput from '@/components/GooglePlaceInput.vue';
import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import { checkAvailability, createBooking, getCar, listBookedRanges } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatMGA, setPageTitle } from '@/utils/format';
import { getDrivingDistanceKm, hasGoogleMapsKey } from '@/utils/googleMaps';
import { statusSeverity } from '@/utils/status';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const { t } = usePublicI18n();

const car = ref(null);
const loading = ref(false);
const error = ref('');
const checking = ref(false);
const booking = ref(false);
const availability = ref(null);
const bookedRanges = ref([]);
const selectedImageUrl = ref('');
const computingDistance = ref(false);

const today = new Date();
today.setHours(0, 0, 0, 0);

const startDate = ref(new Date(today));
const endDate = ref(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
const serviceDate = ref(new Date(today));

const form = reactive({
  pickup_location: '',
  dropoff_location: '',
  distance_km: null,
  contact_phone: '',
  note: '',
});
const placeMeta = reactive({});

const isCargo = computed(() => Boolean(car.value?.is_cargo_transport));
const images = computed(() => car.value?.images || []);
const primaryImage = computed(() => images.value.find((image) => image.is_primary)?.url || images.value[0]?.url || '');
const heroImage = computed(() => selectedImageUrl.value || primaryImage.value);
const attributes = computed(() => parseAttributes(car.value?.attributes));
const dateRange = computed(() => {
  if (isCargo.value) {
    return serviceWindow(serviceDate.value);
  }
  return serviceWindow(startDate.value, endDate.value);
});
const estimatedTotal = computed(() => {
  if (!car.value) {
    return 0;
  }
  if (isCargo.value) {
    const distance = Number(form.distance_km || 0);
    const minimum = Number(car.value.cargo_minimum_rate || 0);
    const perKm = Number(car.value.cargo_per_km_rate || 0);
    return distance > 10 ? minimum + (distance - 10) * perKm : minimum;
  }
  return inclusiveDays(startDate.value, endDate.value) * Number(car.value.daily_rate || 0);
});
// Every calendar day touched by an occupying booking, expanded so the date
// pickers can grey them out. Capped ~9 months ahead to bound the array.
const disabledDates = computed(() => {
  const out = [];
  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + 9);
  for (const range of bookedRanges.value) {
    const start = new Date(range.start_at);
    const end = new Date(range.end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    while (day < end && day <= horizon) {
      if (day >= today) {
        out.push(new Date(day));
      }
      day.setDate(day.getDate() + 1);
    }
  }
  return out;
});

// True when the selected window overlaps a booked one — used to block the
// submit before the server would refuse it anyway.
const hasDateConflict = computed(() => {
  const { start, end } = dateRange.value;
  if (!start || !end || !bookedRanges.value.length) {
    return false;
  }
  const selectedStart = new Date(start);
  const selectedEnd = new Date(end);
  return bookedRanges.value.some(
    (range) => selectedStart < new Date(range.end_at) && selectedEnd > new Date(range.start_at),
  );
});

const canCheck = computed(() => Boolean(car.value && dateRange.value.start && dateRange.value.end));
const canBook = computed(() => {
  if (!auth.isAuthenticated || !car.value || !form.pickup_location.trim() || !form.contact_phone.trim()) {
    return false;
  }
  if (hasDateConflict.value) {
    return false;
  }
  if (isCargo.value) {
    return Boolean(form.dropoff_location.trim() && Number(form.distance_km || 0) > 0);
  }
  return Boolean(startDate.value && endDate.value && startDate.value <= endDate.value);
});

function parseAttributes(raw) {
  if (!raw) {
    return {};
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function titleize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

function specValue(value) {
  if (typeof value === 'boolean') {
    return value ? t('Yes') : t('No');
  }
  return value === null || value === undefined || value === '' ? '-' : value;
}

function serviceWindow(startValue, endValue = startValue) {
  const start = startValue instanceof Date ? new Date(startValue) : null;
  const end = endValue instanceof Date ? new Date(endValue) : null;
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { start: '', end: '' };
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function inclusiveDays(startValue, endValue) {
  if (!(startValue instanceof Date) || !(endValue instanceof Date)) {
    return 1;
  }
  const start = new Date(startValue);
  const end = new Date(endValue);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.round((end - start) / 86400000);
  return Math.max(1, diff + 1);
}

function clearComputedDistance() {
  form.distance_km = null;
}

function clearPlaceField(key) {
  form[key] = '';
  delete placeMeta[key];
  if (key === 'pickup_location' || key === 'dropoff_location') {
    clearComputedDistance();
  }
}

function resetBookingLocations() {
  clearPlaceField('pickup_location');
  clearPlaceField('dropoff_location');
}

function handlePlaceClear(key) {
  delete placeMeta[key];
  clearComputedDistance();
}

function handlePlaceSelect(selection, key) {
  form[key] = selection.value || selection.prediction?.description || '';
  placeMeta[key] = selection.prediction;
  clearComputedDistance();
  maybeComputeDistance();
}

async function maybeComputeDistance() {
  if (!isCargo.value) {
    return;
  }
  const origin = placeMeta.pickup_location?.place_id;
  const destination = placeMeta.dropoff_location?.place_id;
  if (!origin || !destination) {
    return;
  }
  computingDistance.value = true;
  try {
    form.distance_km = await getDrivingDistanceKm(origin, destination);
  } catch (err) {
    clearComputedDistance();
    toast.add({
      severity: 'warn',
      summary: t('Distance not computed'),
      detail: err?.message || t('Choose another route from the Google suggestions.'),
      life: 4200,
    });
  } finally {
    computingDistance.value = false;
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  selectedImageUrl.value = '';
  resetBookingLocations();
  try {
    car.value = await getCar(route.params.slug);
    setPageTitle(car.value?.name);
    loadBookedRanges();
  } catch (err) {
    car.value = null;
    error.value = err?.message || t('Could not load car');
  } finally {
    loading.value = false;
  }
}

// Best-effort: when this fails, the submit-time availability check and the DB
// trigger still guard against double-booking.
async function loadBookedRanges() {
  bookedRanges.value = [];
  if (!car.value?.id) {
    return;
  }
  try {
    bookedRanges.value = await listBookedRanges(car.value.id);
  } catch {
    bookedRanges.value = [];
  }
}

async function runAvailability() {
  if (!canCheck.value) {
    return null;
  }
  checking.value = true;
  availability.value = null;
  try {
    availability.value = await checkAvailability({
      car_id: car.value.id,
      start: dateRange.value.start,
      end: dateRange.value.end,
    });
    return availability.value;
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Availability failed'), detail: err?.message || t('Request failed'), life: 4200 });
    return null;
  } finally {
    checking.value = false;
  }
}

async function submitBooking() {
  if (!auth.isAuthenticated) {
    router.push({ name: 'account', query: { redirect: route.fullPath } });
    return;
  }
  if (!canBook.value) {
    return;
  }
  booking.value = true;
  try {
    const available = await runAvailability();
    if (available && available.available === false) {
      toast.add({ severity: 'warn', summary: t('Car not available'), detail: t('Choose another date range.'), life: 4200 });
      return;
    }
    const body = {
      car_id: car.value.id,
      start_at: dateRange.value.start,
      end_at: dateRange.value.end,
      pickup_location: form.pickup_location.trim(),
      contact_phone: form.contact_phone.trim(),
    };
    if (form.dropoff_location.trim()) {
      body.dropoff_location = form.dropoff_location.trim();
    }
    if (isCargo.value) {
      body.distance_km = Number(form.distance_km).toFixed(2);
    }
    if (form.note.trim()) {
      body.note = form.note.trim();
    }
    const created = await createBooking(body);
    toast.add({ severity: 'success', summary: t('Booking created'), detail: created?.booking_number || car.value.name, life: 3400 });
    if (created?.id) {
      router.push({ name: 'booking-confirmation', params: { id: created.id } });
    } else {
      router.push({ name: 'orders', query: { tab: 'bookings' } });
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Booking failed'), detail: err?.message || t('Request failed'), life: 4600 });
  } finally {
    booking.value = false;
  }
}

watch(
  () => route.params.slug,
  () => load(),
);

watch([startDate, endDate, serviceDate], () => {
  availability.value = null;
});

onMounted(load);
</script>

<template>
  <section class="car-page">
    <div class="app-container">
      <div v-if="loading" class="car-detail" aria-hidden="true">
        <Skeleton height="520px" borderRadius="8px" />
        <div class="detail-skeleton">
          <Skeleton width="30%" height="0.9rem" />
          <Skeleton width="80%" height="2.8rem" />
          <Skeleton width="100%" height="3.6rem" />
          <Skeleton width="100%" height="320px" borderRadius="8px" />
        </div>
      </div>

      <div v-else-if="error" class="car-state car-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
      </div>

      <template v-else-if="car">
        <Button as="router-link" to="/cars" icon="pi pi-arrow-left" :label="t('Back to cars')" severity="secondary" outlined />

        <section class="car-detail">
          <div class="car-media">
            <figure v-if="heroImage" class="car-media__hero">
              <img :src="heroImage" :alt="car.name" />
            </figure>
            <VisualPlaceholder v-else kind="car" tone="charcoal" />

            <div v-if="images.length" class="car-media__thumbs">
              <button
                v-for="image in images"
                :key="image.id"
                type="button"
                :class="{ 'is-active': heroImage === image.url }"
                @click="selectedImageUrl = image.url"
              >
                <img :src="image.url" :alt="image.alt_text || car.name" />
              </button>
            </div>
          </div>

          <div class="car-info">
            <p class="eyebrow">{{ t(car.category?.name || 'Fleet') }}</p>
            <h1>{{ car.name }}</h1>
            <p v-if="car.description" class="car-info__description">{{ car.description }}</p>

            <div class="car-info__meta">
              <Tag :value="t(titleize(car.status))" :severity="statusSeverity(car.status)" />
              <Tag v-if="car.seats" :value="`${car.seats} ${t('seats')}`" severity="secondary" />
              <Tag :value="isCargo ? t('Cargo pricing') : t('Daily pricing')" severity="info" />
            </div>

            <section class="booking-panel soft-panel">
              <div class="booking-panel__price">
                <span>{{ isCargo ? t('Estimated cargo total') : t('Daily rate') }}</span>
                <strong>{{ isCargo ? formatMGA(estimatedTotal) : formatMGA(Number(car.daily_rate || 0)) }}</strong>
                <small v-if="!isCargo">{{ t('{days} billed days: {amount}', { days: inclusiveDays(startDate, endDate), amount: formatMGA(estimatedTotal) }) }}</small>
                <small v-else>{{ t('Minimum: {amount}', { amount: formatMGA(Number(car.cargo_minimum_rate || 0)) }) }}</small>
              </div>

              <div class="date-grid">
                <label v-if="isCargo">
                  <span>{{ t('Transport date') }}</span>
                  <DatePicker v-model="serviceDate" showIcon fluid dateFormat="dd M yy" :minDate="today" :disabledDates="disabledDates" />
                </label>
                <template v-else>
                  <label>
                    <span>{{ t('Start') }}</span>
                    <DatePicker v-model="startDate" showIcon fluid dateFormat="dd M yy" :minDate="today" :disabledDates="disabledDates" />
                  </label>
                  <label>
                    <span>{{ t('End') }}</span>
                    <DatePicker
                      v-model="endDate"
                      showIcon
                      fluid
                      dateFormat="dd M yy"
                      :minDate="startDate || today"
                      :disabledDates="disabledDates"
                    />
                  </label>
                </template>
              </div>
              <p v-if="disabledDates.length" class="booking-panel__hint">{{ t('Greyed-out days in the calendar are already booked.') }}</p>

              <div class="place-grid">
                <label>
                  <span>{{ t('Pickup location*') }}</span>
                  <GooglePlaceInput
                    v-model="form.pickup_location"
                    :manualFallback="false"
                    :placeholder="t('Hotel, airport, office...')"
                    @place-select="handlePlaceSelect($event, 'pickup_location')"
                    @place-clear="handlePlaceClear('pickup_location')"
                  />
                </label>
                <label>
                  <span>{{ isCargo ? t('Dropoff location*') : t('Dropoff location') }}</span>
                  <GooglePlaceInput
                    v-model="form.dropoff_location"
                    :manualFallback="false"
                    :placeholder="t('Optional for standard hire')"
                    @place-select="handlePlaceSelect($event, 'dropoff_location')"
                    @place-clear="handlePlaceClear('dropoff_location')"
                  />
                </label>
              </div>

              <label v-if="isCargo">
                <span>{{ t('Route distance*') }}</span>
                <InputNumber
                  v-model="form.distance_km"
                  :min="0.01"
                  :minFractionDigits="2"
                  :maxFractionDigits="2"
                  suffix=" km"
                  fluid
                  disabled
                />
                <small class="booking-panel__hint">
                  {{ computingDistance ? t('Computing route distance...') : t('Distance is computed from the selected Google places.') }}
                </small>
              </label>

              <p v-if="!hasGoogleMapsKey()" class="booking-panel__hint booking-panel__hint--warn">
                {{ t('Google Maps key is missing, so location suggestions are unavailable.') }}
              </p>

              <label>
                <span>{{ t('Contact phone*') }}</span>
                <InputText v-model="form.contact_phone" placeholder="+261..." />
              </label>

              <label>
                <span>{{ t('Note') }}</span>
                <Textarea v-model="form.note" rows="3" autoResize />
              </label>

              <div v-if="hasDateConflict" class="availability-result">
                <i class="pi pi-times-circle" />
                <span>{{ t('These dates overlap an existing booking — pick different days.') }}</span>
              </div>

              <div v-else-if="availability" class="availability-result" :class="{ 'is-free': availability.available }">
                <i :class="availability.available ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
                <span>{{ availability.available ? t('Available for these dates') : t('Not available for these dates') }}</span>
              </div>

              <div class="booking-actions">
                <Button
                  :label="t('Check availability')"
                  icon="pi pi-calendar"
                  severity="secondary"
                  outlined
                  :loading="checking"
                  :disabled="!canCheck"
                  @click="runAvailability"
                />
                <Button
                  :label="auth.isAuthenticated ? t('Book this car') : t('Sign in to book')"
                  icon="pi pi-check"
                  :loading="booking"
                  :disabled="auth.isAuthenticated && !canBook"
                  @click="submitBooking"
                />
              </div>
            </section>
          </div>
        </section>

        <section class="car-specs">
          <div class="section-header">
            <div>
              <p class="eyebrow">{{ t('Fleet details') }}</p>
              <h2 class="section-title">{{ t('Vehicle information') }}</h2>
            </div>
          </div>

          <div class="spec-grid">
            <article v-if="car.make">
              <span>{{ t('Make') }}</span>
              <strong>{{ car.make }}</strong>
            </article>
            <article v-if="car.model">
              <span>{{ t('Model') }}</span>
              <strong>{{ car.model }}</strong>
            </article>
            <article v-if="car.year">
              <span>{{ t('Year') }}</span>
              <strong>{{ car.year }}</strong>
            </article>
            <article v-if="car.transmission">
              <span>{{ t('Transmission') }}</span>
              <strong>{{ car.transmission }}</strong>
            </article>
            <article v-for="[key, value] in Object.entries(attributes)" :key="key">
              <span>{{ t(titleize(key)) }}</span>
              <strong>{{ specValue(value) }}</strong>
            </article>
          </div>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.car-page {
  padding: 34px 0 64px;
}

.car-state {
  display: grid;
  min-height: 360px;
  place-items: center;
  gap: 10px;
  color: var(--tm-muted);
  font-weight: 850;
}

.car-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.car-state--error i {
  color: var(--tm-coral);
}

.detail-skeleton {
  display: grid;
  align-content: start;
  gap: 16px;
}

.car-detail {
  display: grid;
  gap: 28px;
  margin-top: 18px;
  grid-template-columns: minmax(0, 0.95fr) minmax(360px, 0.72fr);
  align-items: start;
}

.car-media {
  display: grid;
  gap: 12px;
}

.car-media__hero {
  min-height: 520px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
  box-shadow: var(--tm-shadow);
}

.car-media__hero img {
  width: 100%;
  height: 100%;
  min-height: 520px;
  object-fit: cover;
}

.car-media__thumbs {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
}

.car-media__thumbs button {
  height: 78px;
  overflow: hidden;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 8px;
  background: var(--tm-surface);
  cursor: pointer;
}

.car-media__thumbs button.is-active {
  border-color: var(--tm-emerald);
}

.car-media__thumbs img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.car-info {
  display: grid;
  gap: 18px;
}

.car-info h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.2rem, 5vw, 4.8rem);
  line-height: 0.95;
}

.car-info__description {
  margin: 0;
  color: var(--tm-muted);
  line-height: 1.7;
}

.car-info__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.booking-panel {
  display: grid;
  gap: 15px;
  padding: 18px;
}

.booking-panel label {
  display: grid;
  gap: 7px;
}

.booking-panel label > span,
.booking-panel__price span {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 850;
}

.booking-panel__price {
  display: grid;
  gap: 4px;
}

.booking-panel__price strong {
  color: var(--tm-heading);
  font-size: 1.7rem;
  line-height: 1;
}

.booking-panel__price small {
  color: var(--tm-muted);
  font-weight: 760;
}

.booking-panel__hint {
  margin: 0;
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 750;
}

.booking-panel__hint--warn {
  padding: 10px 12px;
  border: 1px solid rgba(185, 138, 46, 0.26);
  border-radius: 8px;
  background: rgba(185, 138, 46, 0.09);
  color: var(--tm-gold);
}

.booking-panel :deep(.p-autocomplete),
.booking-panel :deep(.p-autocomplete-input),
.booking-panel :deep(.p-inputnumber),
.booking-panel :deep(.p-inputnumber-input),
.booking-panel :deep(.p-inputtext),
.booking-panel :deep(.p-textarea) {
  width: 100%;
}

.date-grid,
.place-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.availability-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 11px 12px;
  border: 1px solid rgba(185, 74, 59, 0.28);
  border-radius: 8px;
  color: var(--tm-coral);
  font-weight: 850;
  background: rgba(185, 74, 59, 0.08);
}

.availability-result.is-free {
  border-color: rgba(8, 124, 104, 0.25);
  color: var(--tm-emerald);
  background: rgba(8, 124, 104, 0.08);
}

.booking-actions {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.car-specs {
  margin-top: 52px;
}

.spec-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.spec-grid article {
  display: grid;
  gap: 5px;
  min-height: 86px;
  align-content: center;
  padding: 14px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
}

.spec-grid span {
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 850;
}

.spec-grid strong {
  color: var(--tm-heading);
}

@media (max-width: 980px) {
  .car-detail {
    grid-template-columns: 1fr;
  }

  .spec-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 620px) {
  .car-media__hero,
  .car-media__hero img {
    min-height: 320px;
  }

  .date-grid,
  .place-grid,
  .booking-actions,
  .spec-grid {
    grid-template-columns: 1fr;
  }
}
</style>
