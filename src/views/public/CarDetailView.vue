<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import GooglePlaceInput from '@/components/GooglePlaceInput.vue';
import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import { checkAvailability, createBooking, getCar, listBookedRanges } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatMGA, setPageTitle } from '@/utils/format';
import { getDrivingDistanceKm, hasGoogleMapsKey } from '@/utils/googleMaps';
import { statusSeverity } from '@/utils/status';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const { content, t } = usePublicI18n();

const car = ref(null);
const loading = ref(false);
const error = ref('');
const checking = ref(false);
const booking = ref(false);
const availability = ref(null);
const bookedRanges = ref([]);
const selectedImageUrl = ref('');
const computingDistance = ref(false);
const bookingStep = ref(1);
const confirmedDetails = ref(false);
const restoringDraft = ref(false);

const today = new Date();
today.setHours(0, 0, 0, 0);

const startDate = ref(new Date(today));
const endDate = ref(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
const serviceDate = ref(new Date(today));

const form = reactive({
  pickup_location: '',
  dropoff_location: '',
  distance_km: null,
  outside_antananarivo: null,
  contact_phone: '',
  note: '',
});
const placeMeta = reactive({});

const isCargo = computed(() => Boolean(car.value?.is_cargo_transport));
const carName = computed(() => (car.value ? content(car.value, 'name') || car.value.name : ''));
const carDescription = computed(() => (car.value ? content(car.value, 'description') || car.value.description : ''));
const categoryName = computed(() => (
  car.value?.category ? content(car.value.category, 'name') || car.value.category.name : t('Fleet')
));
const images = computed(() => car.value?.images || []);
const primaryImage = computed(() => images.value.find((image) => image.is_primary)?.url || images.value[0]?.url || '');
const heroImage = computed(() => selectedImageUrl.value || primaryImage.value);
const bookingDraftKey = computed(() => `trimobe-car-booking:${route.params.slug || 'car'}`);
const hasSelectedDateQuery = computed(() => Boolean(route.query.start_date && route.query.end_date));
const listedDateAvailability = computed(() => route.query.date_available !== '0');
const availabilityLabel = computed(() => {
  if (availability.value?.available === true || (availability.value == null && hasSelectedDateQuery.value && listedDateAvailability.value)) {
    return t('Available for your dates');
  }
  if (availability.value?.available === false || (availability.value == null && hasSelectedDateQuery.value && !listedDateAvailability.value)) {
    return t('Not available for these dates');
  }
  return t(titleize(car.value?.status));
});
const availabilitySeverity = computed(() => (
  availability.value?.available === true || (availability.value == null && hasSelectedDateQuery.value && listedDateAvailability.value)
    ? 'success'
    : statusSeverity(car.value?.status)
));
const attributes = computed(() => parseAttributes(car.value?.attributes));
const dateRange = computed(() => {
  if (isCargo.value) {
    return serviceWindow(serviceDate.value);
  }
  return serviceWindow(startDate.value, endDate.value);
});
const selectedDailyRate = computed(() => Number(
  form.outside_antananarivo === true
    ? car.value?.outside_antananarivo_daily_rate || 0
    : car.value?.daily_rate || 0,
));
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
  return inclusiveDays(startDate.value, endDate.value) * selectedDailyRate.value;
});
const billedDays = computed(() => (isCargo.value ? 1 : inclusiveDays(startDate.value, endDate.value)));
const bookingRange = computed({
  get: () => [startDate.value, endDate.value],
  set: (range) => {
    const nextStart = range?.[0] instanceof Date ? range[0] : startDate.value;
    const nextEnd = range?.[1] instanceof Date ? range[1] : null;
    startDate.value = nextStart;
    endDate.value = nextEnd;
  },
});
const featureTiles = computed(() => {
  const items = [];
  if (car.value?.seats) {
    items.push({ icon: 'pi pi-users', label: t('Seats'), value: `${car.value.seats}` });
  }
  if (car.value?.transmission) {
    items.push({ icon: 'pi pi-cog', label: t('Transmission'), value: titleize(car.value.transmission) });
  }
  if (attributes.value.air_conditioning !== undefined) {
    items.push({ icon: 'pi pi-snowflake', label: t('Comfort'), value: attributes.value.air_conditioning ? t('Air conditioning') : t('Standard cabin') });
  }
  items.push({
    icon: isCargo.value ? 'pi pi-truck' : 'pi pi-user',
    label: t('Service'),
    value: isCargo.value ? t('Cargo transport') : t('Driver included'),
  });
  return items.slice(0, 4);
});
const routeReady = computed(() => {
  if (!form.pickup_location.trim() || !form.contact_phone.trim()) {
    return false;
  }
  if (isCargo.value) {
    return Boolean(form.dropoff_location.trim() && Number(form.distance_km || 0) > 0);
  }
  return form.outside_antananarivo !== null;
});
const reviewFacts = computed(() => [
  {
    icon: 'pi pi-calendar',
    label: isCargo.value ? t('Transport date') : t('Dates'),
    value: isCargo.value
      ? formatDate(serviceDate.value)
      : `${formatDate(startDate.value)} — ${formatDate(endDate.value)}`,
  },
  { icon: 'pi pi-map-marker', label: t('Pickup'), value: form.pickup_location || '-' },
  ...(form.dropoff_location ? [{ icon: 'pi pi-flag', label: t('Dropoff'), value: form.dropoff_location }] : []),
  ...(!isCargo.value ? [{
    icon: form.outside_antananarivo ? 'pi pi-map' : 'pi pi-home',
    label: t('Travel area'),
    value: form.outside_antananarivo ? t('Outside Antananarivo region') : t('Within Antananarivo region'),
  }] : []),
  { icon: 'pi pi-phone', label: t('Contact'), value: form.contact_phone || '-' },
]);
// Every calendar day touched by a booking, expanded so the pickers can flag
// them. Bounded to a window around today (~6 months back → 9 months ahead) so
// recent-past and upcoming bookings both show without unbounding the array.
const disabledDates = computed(() => {
  const out = [];
  const horizon = new Date(today);
  horizon.setMonth(horizon.getMonth() + 9);
  const pastHorizon = new Date(today);
  pastHorizon.setMonth(pastHorizon.getMonth() - 6);
  for (const range of bookedRanges.value) {
    const start = new Date(range.start_at);
    const end = new Date(range.end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    while (day < end && day <= horizon) {
      if (day >= pastHorizon) {
        out.push(new Date(day));
      }
      day.setDate(day.getDate() + 1);
    }
  }
  return out;
});

// Fast lookup of every booked calendar day (keyed local Y-M-D) so the pickers
// can flag them red — not just disable them (a plain disabled day reads the same
// as a past day, so clients couldn't tell "booked" from "unavailable").
const bookedDayKeys = computed(() => {
  const set = new Set();
  for (const day of disabledDates.value) {
    set.add(`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`);
  }
  return set;
});

// slotDate is PrimeVue's date-slot payload ({ day, month (0-based), year }).
function isBookedDay(slotDate) {
  return bookedDayKeys.value.has(`${slotDate.year}-${slotDate.month}-${slotDate.day}`);
}

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
  return Boolean(
    startDate.value
    && endDate.value
    && startDate.value <= endDate.value
    && form.outside_antananarivo !== null,
  );
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
  form.outside_antananarivo = null;
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
  bookingStep.value = 1;
  confirmedDetails.value = false;
  resetBookingLocations();
  hydrateDatesFromRoute();
  try {
    car.value = await getCar(route.params.slug);
    setPageTitle(carName.value);
    restoreBookingDraft();
    loadBookedRanges();
  } catch (err) {
    car.value = null;
    error.value = err?.message || t('Could not load car');
  } finally {
    loading.value = false;
  }
}

function saveBookingDraft() {
  try {
    sessionStorage.setItem(bookingDraftKey.value, JSON.stringify({
      start_at: startDate.value?.toISOString?.() || null,
      end_at: endDate.value?.toISOString?.() || null,
      service_at: serviceDate.value?.toISOString?.() || null,
      form: { ...form },
    }));
  } catch {
    // Booking can still continue; the draft is only a convenience around sign-in.
  }
}

function restoreBookingDraft() {
  if (route.query.resume_booking !== '1') {
    return;
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(bookingDraftKey.value) || 'null');
    if (!saved) {
      return;
    }
    restoringDraft.value = true;
    if (saved.start_at) startDate.value = new Date(saved.start_at);
    if (saved.end_at) endDate.value = new Date(saved.end_at);
    if (saved.service_at) serviceDate.value = new Date(saved.service_at);
    Object.assign(form, saved.form || {});
    confirmedDetails.value = false;
    nextTick(() => {
      bookingStep.value = 3;
      restoringDraft.value = false;
    });
  } catch {
    // Ignore an expired or malformed browser draft.
  }
}

function parseQueryDate(raw) {
  const match = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const value = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  value.setHours(0, 0, 0, 0);
  return Number.isNaN(value.getTime()) ? null : value;
}

function hydrateDatesFromRoute() {
  const routeStart = parseQueryDate(route.query.start_date);
  const routeEnd = parseQueryDate(route.query.end_date);
  if (routeStart) {
    startDate.value = routeStart;
    serviceDate.value = routeStart;
  }
  if (routeEnd && (!routeStart || routeEnd >= routeStart)) {
    endDate.value = routeEnd;
  } else if (routeStart) {
    endDate.value = new Date(routeStart.getFullYear(), routeStart.getMonth(), routeStart.getDate() + 1);
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

async function continueFromDates() {
  if (!canCheck.value || hasDateConflict.value) {
    return;
  }
  const result = await runAvailability();
  if (result?.available) {
    bookingStep.value = 2;
  }
}

function continueFromRoute() {
  if (!routeReady.value) {
    return;
  }
  confirmedDetails.value = false;
  bookingStep.value = 3;
}

function goBackStep() {
  bookingStep.value = Math.max(1, bookingStep.value - 1);
}

async function submitBooking() {
  if (!auth.isAuthenticated) {
    saveBookingDraft();
    const resume = router.resolve({
      name: 'car-detail',
      params: { slug: route.params.slug },
      query: { ...route.query, resume_booking: '1' },
    }).fullPath;
    router.push({ name: 'account', query: { redirect: resume } });
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
    } else {
      body.outside_antananarivo = form.outside_antananarivo;
    }
    if (form.note.trim()) {
      body.note = form.note.trim();
    }
    const created = await createBooking(body);
    sessionStorage.removeItem(bookingDraftKey.value);
    toast.add({ severity: 'success', summary: t('Booking created'), detail: created?.booking_number || carName.value, life: 3400 });
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
  confirmedDetails.value = false;
  if (!restoringDraft.value && bookingStep.value > 1) {
    bookingStep.value = 1;
  }
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
              <img :src="heroImage" :alt="carName" />
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
                <img :src="image.url" :alt="image.alt_text || carName" />
              </button>
            </div>

            <div class="car-feature-grid">
              <article v-for="feature in featureTiles" :key="feature.label">
                <i :class="feature.icon" />
                <span>{{ feature.label }}</span>
                <strong>{{ feature.value }}</strong>
              </article>
            </div>
          </div>

          <div class="car-info">
            <p class="eyebrow">{{ categoryName }}</p>
            <h1>{{ carName }}</h1>
            <p v-if="carDescription" class="car-info__description">{{ carDescription }}</p>

            <div class="car-info__meta">
              <Tag :value="availabilityLabel" :severity="availabilitySeverity" />
              <Tag v-if="car.seats" :value="`${car.seats} ${t('seats')}`" severity="secondary" />
              <Tag :value="isCargo ? t('Cargo pricing') : t('Daily pricing')" severity="info" />
            </div>

            <section class="booking-panel soft-panel">
              <header class="booking-panel__head">
                <div>
                  <p class="eyebrow">{{ t('Book this car') }}</p>
                  <h2>{{ bookingStep === 1 ? t('Plan your trip') : bookingStep === 2 ? t('Add route details') : t('Review your trip') }}</h2>
                </div>
                <span>{{ bookingStep }}/3</span>
              </header>

              <ol class="booking-stepper" :aria-label="t('Booking progress')">
                <li v-for="step in [{ n: 1, label: 'Dates' }, { n: 2, label: 'Route' }, { n: 3, label: 'Review' }]" :key="step.n" :class="{ 'is-active': bookingStep === step.n, 'is-complete': bookingStep > step.n }">
                  <span><i v-if="bookingStep > step.n" class="pi pi-check" /><b v-else>{{ step.n }}</b></span>
                  <strong>{{ t(step.label) }}</strong>
                </li>
              </ol>

              <template v-if="bookingStep === 1">
              <div class="booking-panel__price">
                <span>{{ isCargo ? t('Cargo transport from') : t('Local daily rate') }}</span>
                <strong>{{ isCargo ? formatMGA(Number(car.cargo_minimum_rate || 0)) : formatMGA(Number(car.daily_rate || 0)) }}</strong>
                <small v-if="!isCargo">{{ t('Outside Antananarivo: {amount} / day', { amount: formatMGA(Number(car.outside_antananarivo_daily_rate || 0)) }) }}</small>
                <small v-else>{{ t('The minimum covers 10 km; each additional kilometre is 10,000 MGA.') }}</small>
              </div>

              <div class="date-grid">
                <label v-if="isCargo">
                  <span>{{ t('Transport date') }}</span>
                  <DatePicker v-model="serviceDate" showIcon fluid dateFormat="dd M yy" :minDate="today" :disabledDates="disabledDates">
                    <template #date="slotProps">
                      <span :class="{ 'booked-day': isBookedDay(slotProps.date) }">{{ slotProps.date.day }}</span>
                    </template>
                  </DatePicker>
                </label>
                <template v-else>
                  <label>
                    <span>{{ t('Start') }}</span>
                    <DatePicker v-model="startDate" showIcon fluid dateFormat="dd M yy" :minDate="today" :disabledDates="disabledDates">
                      <template #date="slotProps">
                        <span :class="{ 'booked-day': isBookedDay(slotProps.date) }">{{ slotProps.date.day }}</span>
                      </template>
                    </DatePicker>
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
                    >
                      <template #date="slotProps">
                        <span :class="{ 'booked-day': isBookedDay(slotProps.date) }">{{ slotProps.date.day }}</span>
                      </template>
                    </DatePicker>
                  </label>
                </template>
              </div>

              <DatePicker
                v-if="isCargo"
                v-model="serviceDate"
                inline
                fluid
                :minDate="today"
                :disabledDates="disabledDates"
                class="booking-calendar"
              >
                <template #date="slotProps"><span :class="{ 'booked-day': isBookedDay(slotProps.date) }">{{ slotProps.date.day }}</span></template>
              </DatePicker>
              <DatePicker
                v-else
                v-model="bookingRange"
                selectionMode="range"
                :manualInput="false"
                inline
                fluid
                :minDate="today"
                :disabledDates="disabledDates"
                class="booking-calendar"
              >
                <template #date="slotProps"><span :class="{ 'booked-day': isBookedDay(slotProps.date) }">{{ slotProps.date.day }}</span></template>
              </DatePicker>

              <div class="calendar-legend">
                <span class="calendar-legend__item"><i class="legend-dot legend-dot--booked" />{{ t('Booked — unavailable') }}</span>
                <span class="calendar-legend__item calendar-legend__item--selected"><i class="legend-dot legend-dot--selected" />{{ t('Your dates') }}</span>
                <span v-if="hasDateConflict" class="calendar-legend__hint">{{ t('Your dates overlap an existing booking — pick free (non-red) days.') }}</span>
              </div>

              <div v-if="availability && !hasDateConflict" class="availability-result" :class="{ 'is-free': availability.available }">
                <i :class="availability.available ? 'pi pi-check-circle' : 'pi pi-times-circle'" />
                <span>{{ availability.available ? t('Available for these dates') : t('Not available for these dates') }}</span>
              </div>

              <div class="booking-total">
                <span>{{ isCargo ? t('Starting price') : t('Local estimate for {days} billed days', { days: billedDays }) }}</span>
                <small v-if="!isCargo">{{ formatMGA(Number(car.daily_rate || 0)) }} × {{ billedDays }}</small>
                <strong>{{ isCargo ? formatMGA(Number(car.cargo_minimum_rate || 0)) : formatMGA(estimatedTotal) }}</strong>
              </div>
              </template>

              <template v-else-if="bookingStep === 2">
              <div class="booking-section-intro">
                <span><i class="pi pi-map-marker" /></span>
                <div><strong>{{ t('Where should the trip begin?') }}</strong><small>{{ t('Choose locations from the suggestions so we can prepare the route.') }}</small></div>
              </div>

              <fieldset v-if="!isCargo" class="region-choice">
                <legend>{{ t('Will you travel outside the Antananarivo region?') }}</legend>
                <p>{{ t('Choose one so we can apply the correct daily rate.') }}</p>
                <div class="region-choice__options">
                  <label :class="{ 'is-selected': form.outside_antananarivo === false }" for="region-local">
                    <RadioButton v-model="form.outside_antananarivo" inputId="region-local" :value="false" />
                    <span><strong>{{ t('No, stay within the region') }}</strong><small>{{ formatMGA(Number(car.daily_rate || 0)) }} {{ t('/ day') }}</small></span>
                  </label>
                  <label :class="{ 'is-selected': form.outside_antananarivo === true }" for="region-outside">
                    <RadioButton v-model="form.outside_antananarivo" inputId="region-outside" :value="true" />
                    <span><strong>{{ t('Yes, leave the region') }}</strong><small>{{ formatMGA(Number(car.outside_antananarivo_daily_rate || 0)) }} {{ t('/ day') }}</small></span>
                  </label>
                </div>
              </fieldset>

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

              <div v-if="isCargo && Number(form.distance_km || 0) > 0" class="booking-total">
                <span>{{ t('Distance-based route estimate') }}</span>
                <small>{{ t('First 10 km: {minimum}; then {rate} per additional km', { minimum: formatMGA(Number(car.cargo_minimum_rate || 0)), rate: formatMGA(Number(car.cargo_per_km_rate || 0)) }) }}</small>
                <strong>{{ formatMGA(estimatedTotal) }}</strong>
              </div>

              <div v-if="!isCargo && form.outside_antananarivo !== null" class="booking-total">
                <span>{{ form.outside_antananarivo ? t('Outside-region trip estimate') : t('Local trip estimate') }}</span>
                <small>{{ formatMGA(selectedDailyRate) }} × {{ billedDays }}</small>
                <strong>{{ formatMGA(estimatedTotal) }}</strong>
              </div>

              <p v-if="!hasGoogleMapsKey()" class="booking-panel__hint booking-panel__hint--warn">
                {{ t('Google Maps key is missing, so location suggestions are unavailable.') }}
              </p>

              <label>
                <span>{{ t('Contact phone*') }}</span>
                <InputText v-model="form.contact_phone" placeholder="+261..." />
              </label>

              <label>
                <span>{{ t('Note') }}</span>
                <Textarea v-model="form.note" rows="3" autoResize :placeholder="t('Flight number, luggage, accessibility needs...')" />
              </label>

              <div class="booking-assurance"><i class="pi pi-shield" /><span><strong>{{ t('Payment comes later') }}</strong><small>{{ t('The Trimobe team confirms payment with you after the booking is sent.') }}</small></span></div>
              </template>

              <template v-else>
                <section class="review-car">
                  <span class="review-car__icon"><i :class="isCargo ? 'pi pi-truck' : 'pi pi-car'" /></span>
                  <div><small>{{ categoryName }}</small><strong>{{ carName }}</strong></div>
                  <Tag :value="isCargo ? t('Cargo transport') : t('Driver included')" severity="info" />
                </section>

                <dl class="review-facts">
                  <div v-for="fact in reviewFacts" :key="fact.label">
                    <dt><i :class="fact.icon" />{{ fact.label }}</dt>
                    <dd>{{ fact.value }}</dd>
                  </div>
                </dl>

                <section class="review-price">
                  <div v-if="isCargo"><span>{{ t('Rate after 10 km') }}</span><strong>{{ formatMGA(Number(car.cargo_per_km_rate || 0)) }} / km</strong></div>
                  <div v-if="isCargo"><span>{{ t('Starting price') }}</span><strong>{{ formatMGA(Number(car.cargo_minimum_rate || 0)) }}</strong></div>
                  <div v-else><span>{{ form.outside_antananarivo ? t('Outside-region daily rate') : t('Local daily rate') }}</span><strong>{{ formatMGA(selectedDailyRate) }}</strong></div>
                  <div v-if="!isCargo"><span>{{ t('Billed days') }}</span><strong>{{ billedDays }}</strong></div>
                  <div class="review-price__total"><span>{{ t('Total') }}</span><strong>{{ formatMGA(estimatedTotal) }}</strong></div>
                </section>

                <div class="booking-info"><i class="pi pi-info-circle" /><span>{{ t('Payment is handled with the Trimobe team after booking.') }}</span></div>

                <label class="booking-consent">
                  <Checkbox v-model="confirmedDetails" binary />
                  <span>{{ t('I confirm these trip details.') }}</span>
                </label>
              </template>

              <div class="booking-actions">
                <Button
                  v-if="bookingStep === 1"
                  :label="t('Check availability and continue')"
                  icon="pi pi-calendar"
                  iconPos="right"
                  :loading="checking"
                  :disabled="!canCheck || hasDateConflict"
                  @click="continueFromDates"
                />
                <Button
                  v-if="bookingStep === 2"
                  :label="t('Back')"
                  icon="pi pi-arrow-left"
                  severity="secondary"
                  outlined
                  @click="goBackStep"
                />
                <Button
                  v-if="bookingStep === 2"
                  :label="t('Continue to review')"
                  icon="pi pi-arrow-right"
                  iconPos="right"
                  :disabled="!routeReady"
                  @click="continueFromRoute"
                />
                <Button
                  v-if="bookingStep === 3"
                  :label="t('Back')"
                  icon="pi pi-arrow-left"
                  severity="secondary"
                  outlined
                  @click="goBackStep"
                />
                <Button
                  v-if="bookingStep === 3"
                  :label="auth.isAuthenticated ? t('Confirm booking') : t('Sign in to confirm')"
                  icon="pi pi-check"
                  :loading="booking"
                  :disabled="!confirmedDetails || (auth.isAuthenticated && !canBook)"
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

/* Booked day inside the (teleported) date picker. A plain scoped class on the
   slot span reaches it because the span carries this component's data-v
   attribute — no :deep needed. Kept subtle to match the admin booking form:
   dimmed red + a marker dot, and the day is already non-selectable via
   :disabledDates. */
.booked-day {
  position: relative;
  color: var(--tm-coral);
  font-weight: 900;
}

.booked-day::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -5px;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: var(--tm-coral);
  transform: translateX(-50%);
}

.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
}

.calendar-legend__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tm-coral);
  font-size: 0.78rem;
  font-weight: 850;
}

.calendar-legend__hint {
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 750;
}

.legend-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 999px;
}

.legend-dot--booked {
  background: var(--tm-coral);
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

<style scoped>
.car-page { padding: 22px 0 84px; }
.car-detail { gap: 32px; margin-top: 24px; grid-template-columns: minmax(0, .98fr) minmax(390px, .82fr); }
.car-media__hero { min-height: 500px; border-radius: 22px; box-shadow: 0 18px 44px rgba(20,29,31,.12); }
.car-media__hero img { min-height: 500px; }
.car-media__thumbs { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
.car-media__thumbs button { height: 96px; border-radius: 14px; opacity: .72; transition: opacity 150ms ease, transform 150ms ease; }
.car-media__thumbs button:hover, .car-media__thumbs button.is-active { opacity: 1; transform: translateY(-1px); }
.car-feature-grid { display: grid; gap: 10px; grid-template-columns: repeat(4, minmax(0,1fr)); }
.car-feature-grid article { display: grid; min-height: 108px; align-content: center; justify-items: center; gap: 5px; padding: 12px 8px; border: 1px solid var(--tm-border); border-radius: 16px; background: var(--tm-surface); text-align: center; }
.car-feature-grid i { margin-bottom: 4px; color: var(--tm-emerald); font-size: 1.3rem; }
.car-feature-grid span { color: var(--tm-muted); font-size: .68rem; font-weight: 820; text-transform: uppercase; }
.car-feature-grid strong { color: var(--tm-heading); font-size: .82rem; }
.car-info { gap: 16px; }
.car-info h1 { font-size: clamp(2.5rem, 5vw, 4.9rem); letter-spacing: -.052em; }
.booking-panel { gap: 18px; padding: 22px; border-radius: 22px; box-shadow: 0 18px 44px rgba(20,29,31,.085); }
.booking-panel__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; }
.booking-panel__head p, .booking-panel__head h2 { margin: 0; }
.booking-panel__head h2 { margin-top: 4px; color: var(--tm-heading); font-size: 1.35rem; letter-spacing: -.025em; }
.booking-panel__head > span { display: grid; min-width: 42px; height: 36px; padding: 0 9px; border-radius: 11px; background: var(--tm-charcoal); color: #fff; font-size: .78rem; font-weight: 900; place-items: center; }
.booking-stepper { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; margin: 0; padding: 0 0 16px; border-bottom: 1px solid var(--tm-border); list-style: none; }
.booking-stepper li { position: relative; display: flex; align-items: center; gap: 7px; color: var(--tm-muted); }
.booking-stepper li:not(:last-child)::after { position: absolute; top: 15px; right: 1px; width: calc(100% - 72px); height: 1px; background: var(--tm-border); content: ''; transform: translateX(50%); }
.booking-stepper li > span { position: relative; z-index: 1; display: grid; width: 31px; height: 31px; flex: 0 0 auto; border: 1px solid var(--tm-border); border-radius: 50%; background: var(--tm-surface); font-size: .76rem; place-items: center; }
.booking-stepper li strong { font-size: .76rem; }
.booking-stepper li.is-active { color: var(--tm-heading); }
.booking-stepper li.is-active > span { border-color: var(--tm-emerald); background: var(--tm-emerald); color: #fff; }
.booking-stepper li.is-complete { color: var(--tm-emerald); }
.booking-stepper li.is-complete > span { border-color: var(--tm-gold); background: var(--tm-gold); color: #fff; }
.booking-stepper li.is-complete::after { background: var(--tm-gold); }
.booking-panel__price { grid-template-columns: 1fr auto; align-items: end; column-gap: 14px; padding: 14px; border: 1px solid var(--tm-border); border-radius: 14px; background: var(--tm-surface-soft); }
.booking-panel__price > span, .booking-panel__price > small { grid-column: 1; }
.booking-panel__price > strong { grid-column: 2; grid-row: 1 / span 2; font-size: 1.45rem; }
.booking-calendar { overflow: hidden; border: 1px solid var(--tm-border); border-radius: 16px; }
.booking-calendar :deep(.p-datepicker-panel) { width: 100%; border: 0; box-shadow: none; }
.booking-calendar :deep(.p-datepicker-calendar-container), .booking-calendar :deep(.p-datepicker-calendar) { width: 100%; }
.booking-calendar :deep(.p-datepicker-day-selected), .booking-calendar :deep(.p-datepicker-day-selected-range) { background: var(--tm-emerald); color: #fff; }
.calendar-legend { gap: 8px 14px; }
.calendar-legend__item--selected { color: var(--tm-emerald); }
.legend-dot--selected { background: var(--tm-emerald); }
.calendar-legend__hint { flex-basis: 100%; padding: 8px 10px; border-radius: 9px; background: rgba(206,107,85,.08); color: var(--tm-coral); }
.availability-result { border-radius: 12px; }
.booking-total { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 3px 12px; padding: 15px; border: 1px solid var(--tm-border); border-radius: 14px; }
.booking-total > span { color: var(--tm-heading); font-weight: 850; }
.booking-total small { color: var(--tm-muted); font-weight: 740; }
.booking-total strong { grid-column: 2; grid-row: 1 / span 2; color: var(--tm-heading); font-size: 1.45rem; }
.booking-section-intro { display: flex; align-items: center; gap: 11px; padding: 13px; border-radius: 13px; background: var(--tm-surface-soft); }
.booking-section-intro > span { display: grid; width: 38px; height: 38px; flex: 0 0 auto; border-radius: 12px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.booking-section-intro > div, .booking-assurance span { display: grid; gap: 3px; }
.booking-section-intro strong, .booking-assurance strong { color: var(--tm-heading); font-size: .86rem; }
.booking-section-intro small, .booking-assurance small { color: var(--tm-muted); font-size: .74rem; font-weight: 700; line-height: 1.35; }
.region-choice { display: grid; gap: 7px; margin: 0; padding: 15px; border: 1px solid var(--tm-border); border-radius: 14px; background: var(--tm-surface-soft); }
.region-choice legend { padding: 0 5px; color: var(--tm-heading); font-weight: 900; }
.region-choice > p { margin: 0; color: var(--tm-muted); font-size: .78rem; font-weight: 700; }
.region-choice__options { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 5px; }
.region-choice__options > label { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 13px; border: 1px solid var(--tm-border); border-radius: 12px; background: var(--tm-surface); cursor: pointer; transition: border-color 160ms ease, box-shadow 160ms ease; }
.region-choice__options > label.is-selected { border-color: var(--tm-emerald); box-shadow: 0 0 0 2px rgba(8,124,104,.1); }
.region-choice__options label > span { display: grid; gap: 3px; min-width: 0; }
.region-choice__options strong { color: var(--tm-heading); font-size: .82rem; }
.region-choice__options small { color: var(--tm-muted); font-size: .73rem; font-weight: 750; }
.booking-assurance { display: flex; align-items: center; gap: 10px; padding: 13px; border: 1px solid rgba(49,92,112,.2); border-radius: 13px; background: rgba(49,92,112,.07); }
.booking-assurance > i { color: var(--tm-blue); font-size: 1.25rem; }
.review-car { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 11px; padding: 13px; border-radius: 14px; background: var(--tm-charcoal); }
.review-car__icon { display: grid; width: 42px; height: 42px; border-radius: 13px; background: rgba(255,255,255,.08); color: var(--tm-gold); place-items: center; }
.review-car > div { display: grid; gap: 3px; }
.review-car small { color: var(--tm-gold); font-size: .68rem; font-weight: 880; text-transform: uppercase; }
.review-car strong { color: #fff8ed; }
.review-facts { display: grid; gap: 0; margin: 0; border: 1px solid var(--tm-border); border-radius: 14px; }
.review-facts > div { display: grid; grid-template-columns: minmax(120px,.55fr) minmax(0,1fr); gap: 12px; padding: 11px 13px; border-bottom: 1px solid var(--tm-border); }
.review-facts > div:last-child { border-bottom: 0; }
.review-facts dt { display: flex; align-items: center; gap: 7px; color: var(--tm-muted); font-size: .75rem; font-weight: 820; }
.review-facts dt i { color: var(--tm-gold); }
.review-facts dd { margin: 0; color: var(--tm-heading); font-size: .82rem; font-weight: 820; text-align: right; overflow-wrap: anywhere; }
.review-price { display: grid; gap: 10px; }
.review-price > div { display: flex; justify-content: space-between; gap: 14px; color: var(--tm-muted); font-size: .82rem; }
.review-price strong { color: var(--tm-heading); }
.review-price__total { align-items: center; padding: 14px; border: 1px solid var(--tm-gold) !important; border-radius: 13px; color: var(--tm-heading) !important; font-size: 1rem !important; font-weight: 900; }
.review-price__total strong { font-size: 1.45rem; }
.booking-info { display: flex; align-items: center; gap: 9px; padding: 12px; border: 1px solid rgba(49,92,112,.25); border-radius: 12px; background: rgba(49,92,112,.07); color: var(--tm-blue); font-size: .78rem; font-weight: 780; }
.booking-info i { font-size: 1.15rem; }
.booking-consent { display: flex !important; grid-template-columns: auto 1fr; align-items: center; gap: 9px !important; color: var(--tm-heading); font-size: .82rem; font-weight: 820; }
.booking-consent > span { color: var(--tm-heading) !important; }
.booking-actions { margin-top: 2px; }
.booking-actions :deep(.p-button:only-child) { grid-column: 1 / -1; width: 100%; }
.car-specs { margin-top: 64px; padding-top: 32px; border-top: 1px solid var(--tm-border); }
.spec-grid article { border-radius: 16px; }
@media (max-width: 1040px) { .car-detail { grid-template-columns: 1fr; } .car-info { max-width: 760px; } }
@media (max-width: 720px) { .car-feature-grid, .region-choice__options { grid-template-columns: 1fr; } .booking-panel { padding: 17px; } .booking-stepper li:not(:last-child)::after { display: none; } .booking-stepper li { flex-direction: column; align-items: flex-start; } .booking-stepper li strong { font-size: .68rem; } .booking-panel__price, .booking-total { grid-template-columns: 1fr; } .booking-panel__price > strong, .booking-total strong { grid-column: 1; grid-row: auto; } .review-facts > div { grid-template-columns: 1fr; gap: 5px; } .review-facts dd { text-align: left; } }
@media (max-width: 520px) { .car-media__hero, .car-media__hero img { min-height: 300px; } .car-media__thumbs { grid-template-columns: repeat(3, minmax(0,1fr)); } .car-media__thumbs button { height: 72px; } .review-car { grid-template-columns: auto 1fr; } .review-car :deep(.p-tag) { grid-column: 2; width: fit-content; } }
</style>
