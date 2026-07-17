<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import ClientLocationPicker from '@/components/ClientLocationPicker.vue';
import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import {
  checkAvailability,
  createBookings,
  listCarCategories,
  listCars,
} from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatMGA, setPageTitle } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const { content, t } = usePublicI18n();

const DRAFT_KEY = 'trimobe-multi-car-booking';
const MAX_CARS = 10;

const today = new Date();
today.setHours(0, 0, 0, 0);
const earliestPickup = addDays(today, 1);

const step = ref(1);
const startDate = ref(new Date(earliestPickup));
const endDate = ref(addDays(earliestPickup, 1));
const outsideAntananarivo = ref(null);
const categories = ref([]);
const availableCars = ref([]);
const selectedCarIds = ref([]);
const search = ref('');
const loadingFleet = ref(false);
const fleetError = ref('');
const booking = ref(false);
const confirmedDetails = ref(false);

const form = reactive({
  pickup_location: '',
  pickup_latitude: null,
  pickup_longitude: null,
  pickup_reference: '',
  dropoff_location: '',
  dropoff_latitude: null,
  dropoff_longitude: null,
  dropoff_reference: '',
  contact_phone: '',
  note: '',
});

const billedDays = computed(() => inclusiveDays(startDate.value, endDate.value));
const dateWindow = computed(() => serviceWindow(startDate.value, endDate.value));
const datesReady = computed(() => (
  startDate.value instanceof Date
  && endDate.value instanceof Date
  && endDate.value >= startDate.value
  && outsideAntananarivo.value !== null
));
const visibleCars = computed(() => {
  const needle = search.value.trim().toLowerCase();
  if (!needle) {
    return availableCars.value;
  }
  return availableCars.value.filter((car) => [car.name, car.make, car.model, categoryName(car.category_id)]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(needle)));
});
const selectedCars = computed(() => {
  const selected = new Set(selectedCarIds.value);
  return availableCars.value.filter((car) => selected.has(car.id));
});
const combinedSubtotal = computed(() => selectedCars.value.reduce((sum, car) => sum + carSubtotal(car), 0));
const canContinueWithCars = computed(() => selectedCarIds.value.length >= 2);
const routeReady = computed(() => Boolean(form.pickup_location.trim() && form.contact_phone.trim()));

function addDays(value, days) {
  const result = new Date(value);
  result.setDate(result.getDate() + days);
  return result;
}

function inclusiveDays(startValue, endValue) {
  if (!(startValue instanceof Date) || !(endValue instanceof Date)) {
    return 1;
  }
  const start = new Date(startValue);
  const end = new Date(endValue);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function serviceWindow(startValue, endValue) {
  if (!(startValue instanceof Date) || !(endValue instanceof Date)) {
    return { start: '', end: '' };
  }
  const start = new Date(startValue);
  const end = new Date(endValue);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 0);
  return { start: localRFC3339(start), end: localRFC3339(end) };
}

// Keep the browser's calendar-day offset in the API timestamp. This makes the
// server's inclusive-day calculation match the dates and subtotal shown here.
function localRFC3339(value) {
  const pad = (number) => String(number).padStart(2, '0');
  const offset = -value.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const offsetHours = pad(Math.floor(Math.abs(offset) / 60));
  const offsetMinutes = pad(Math.abs(offset) % 60);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
    + `T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`
    + `${sign}${offsetHours}:${offsetMinutes}`;
}

function carName(car) {
  return content(car, 'name') || car.name;
}

function categoryName(categoryID) {
  const category = categories.value.find((item) => item.id === categoryID);
  return category ? content(category, 'name') || category.name : t('Car');
}

function carRate(car) {
  return Number(
    outsideAntananarivo.value
      ? car.outside_antananarivo_daily_rate || 0
      : car.daily_rate || 0,
  );
}

function carSubtotal(car) {
  return carRate(car) * billedDays.value;
}

function isSelected(carID) {
  return selectedCarIds.value.includes(carID);
}

function toggleCar(carID) {
  const index = selectedCarIds.value.indexOf(carID);
  if (index >= 0) {
    selectedCarIds.value.splice(index, 1);
  } else if (selectedCarIds.value.length < MAX_CARS) {
    selectedCarIds.value.push(carID);
  }
  confirmedDetails.value = false;
}

function handleStartDate() {
  if (!(endDate.value instanceof Date) || endDate.value < startDate.value) {
    endDate.value = addDays(startDate.value, 1);
  }
}

async function fetchAvailableCars({ clearSelection = true } = {}) {
  loadingFleet.value = true;
  fleetError.value = '';
  try {
    const result = await listCars({
      limit: 100,
      start: dateWindow.value.start,
      end: dateWindow.value.end,
    });
    availableCars.value = (result.items || []).filter((car) => (
      !car.is_cargo_transport && car.available_for_range !== false
    ));
    if (clearSelection) {
      selectedCarIds.value = [];
    } else {
      const availableIDs = new Set(availableCars.value.map((car) => car.id));
      selectedCarIds.value = selectedCarIds.value.filter((id) => availableIDs.has(id)).slice(0, MAX_CARS);
    }
    return true;
  } catch (err) {
    availableCars.value = [];
    if (clearSelection) {
      selectedCarIds.value = [];
    }
    fleetError.value = err?.message || t('Could not load available cars');
    return false;
  } finally {
    loadingFleet.value = false;
  }
}

async function findCars() {
  if (!datesReady.value) {
    return;
  }
  if (await fetchAvailableCars()) {
    search.value = '';
    step.value = 2;
  }
}

function continueToDetails() {
  if (!canContinueWithCars.value) {
    return;
  }
  confirmedDetails.value = false;
  step.value = 3;
}

function saveDraft() {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({
      start_at: startDate.value.toISOString(),
      end_at: endDate.value.toISOString(),
      outside_antananarivo: outsideAntananarivo.value,
      selected_car_ids: selectedCarIds.value,
      form: { ...form },
    }));
  } catch {
    // Sign-in can still continue; the draft is a convenience only.
  }
}

async function restoreDraft() {
  if (route.query.resume_booking !== '1') {
    return;
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null');
    if (!saved) {
      return;
    }
    if (saved.start_at) startDate.value = new Date(saved.start_at);
    if (saved.end_at) endDate.value = new Date(saved.end_at);
    outsideAntananarivo.value = typeof saved.outside_antananarivo === 'boolean'
      ? saved.outside_antananarivo
      : null;
    selectedCarIds.value = Array.isArray(saved.selected_car_ids) ? saved.selected_car_ids.slice(0, MAX_CARS) : [];
    Object.assign(form, saved.form || {});
    if (datesReady.value && await fetchAvailableCars({ clearSelection: false })) {
      step.value = selectedCarIds.value.length >= 2 ? 3 : 2;
    }
  } catch {
    sessionStorage.removeItem(DRAFT_KEY);
  }
}

async function submitBooking() {
  if (!auth.isAuthenticated) {
    saveDraft();
    const resume = router.resolve({ name: 'multi-car-booking', query: { resume_booking: '1' } }).fullPath;
    router.push({ name: 'account', query: { redirect: resume } });
    return;
  }
  if (!routeReady.value || !canContinueWithCars.value || !confirmedDetails.value) {
    return;
  }

  booking.value = true;
  try {
    const availability = await Promise.all(selectedCarIds.value.map((carID) => checkAvailability({
      car_id: carID,
      start: dateWindow.value.start,
      end: dateWindow.value.end,
    })));
    if (availability.some((item) => !item?.available)) {
      toast.add({
        severity: 'warn',
        summary: t('A selected car is no longer available'),
        detail: t('Review your car selection and try again.'),
        life: 4600,
      });
      step.value = 2;
      await fetchAvailableCars({ clearSelection: false });
      return;
    }

    const body = {
      car_ids: selectedCarIds.value,
      start_at: dateWindow.value.start,
      end_at: dateWindow.value.end,
      outside_antananarivo: outsideAntananarivo.value,
      pickup_location: form.pickup_location.trim(),
      contact_phone: form.contact_phone.trim(),
    };
    if (Number.isFinite(form.pickup_latitude) && Number.isFinite(form.pickup_longitude)) {
      body.pickup_latitude = form.pickup_latitude;
      body.pickup_longitude = form.pickup_longitude;
    }
    if (form.pickup_reference.trim()) body.pickup_reference = form.pickup_reference.trim();
    if (form.dropoff_location.trim()) body.dropoff_location = form.dropoff_location.trim();
    if (Number.isFinite(form.dropoff_latitude) && Number.isFinite(form.dropoff_longitude)) {
      body.dropoff_latitude = form.dropoff_latitude;
      body.dropoff_longitude = form.dropoff_longitude;
    }
    if (form.dropoff_reference.trim()) body.dropoff_reference = form.dropoff_reference.trim();
    if (form.note.trim()) body.note = form.note.trim();

    const created = await createBookings(body);
    if (!created?.id) {
      throw new Error(t('Booking response was empty'));
    }
    sessionStorage.removeItem(DRAFT_KEY);
    toast.add({
      severity: 'success',
      summary: t('Booking created'),
      detail: t('{count} cars reserved under one booking', { count: created.car_count || selectedCarIds.value.length }),
      life: 3400,
    });
    router.push({
      name: 'booking-confirmation',
      params: { id: created.id },
    });
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: t('Booking failed'),
      detail: err?.message || t('Request failed'),
      life: 4600,
    });
  } finally {
    booking.value = false;
  }
}

onMounted(async () => {
  setPageTitle(t('Book multiple cars'));
  try {
    categories.value = await listCarCategories();
  } catch {
    categories.value = [];
  }
  await restoreDraft();
});
</script>

<template>
  <section class="multi-book-page">
    <div class="app-container multi-book-page__inner">
      <RouterLink class="back-link" :to="{ name: 'cars' }"><i class="pi pi-arrow-left" />{{ t('Back to cars') }}</RouterLink>

      <header class="multi-book-hero">
        <div>
          <p class="eyebrow">{{ t('Group travel') }}</p>
          <h1>{{ t('Book multiple cars in one request.') }}</h1>
          <p>{{ t('Choose one trip window, compare the available fleet, and reserve every car together.') }}</p>
        </div>
        <div class="multi-book-hero__mark"><i class="pi pi-car" /><i class="pi pi-car" /></div>
      </header>

      <ol class="multi-stepper" :aria-label="t('Booking progress')">
        <li v-for="item in [{ n: 1, label: 'Dates' }, { n: 2, label: 'Choose cars' }, { n: 3, label: 'Trip details' }]" :key="item.n" :class="{ 'is-active': step === item.n, 'is-complete': step > item.n }">
          <span><i v-if="step > item.n" class="pi pi-check" /><b v-else>{{ item.n }}</b></span>
          <div><strong>{{ t(item.label) }}</strong><small>{{ item.n === 1 ? t('When and where') : item.n === 2 ? t('Fleet and subtotal') : t('Contact and confirm') }}</small></div>
        </li>
      </ol>

      <section v-if="step === 1" class="flow-panel date-panel">
        <header class="flow-panel__head">
          <div><p class="eyebrow">{{ t('Step 1') }}</p><h2>{{ t('Set the trip window') }}</h2></div>
          <span><i class="pi pi-calendar" /></span>
        </header>

        <div class="date-fields">
          <label>
            <span>{{ t('Pickup date') }}</span>
            <DatePicker v-model="startDate" showIcon fluid dateFormat="dd M yy" :minDate="earliestPickup" @update:modelValue="handleStartDate" />
          </label>
          <label>
            <span>{{ t('Return date') }}</span>
            <DatePicker v-model="endDate" showIcon fluid dateFormat="dd M yy" :minDate="startDate || earliestPickup" />
          </label>
        </div>

        <fieldset class="travel-area">
          <legend>{{ t('Travel area') }}</legend>
          <p>{{ t('This sets the rate used for every selected car.') }}</p>
          <div>
            <label :class="{ 'is-selected': outsideAntananarivo === false }">
              <RadioButton v-model="outsideAntananarivo" inputId="multi-local" :value="false" />
              <span><strong>{{ t('Within Antananarivo region') }}</strong><small>{{ t('Use each car’s local daily rate') }}</small></span>
            </label>
            <label :class="{ 'is-selected': outsideAntananarivo === true }">
              <RadioButton v-model="outsideAntananarivo" inputId="multi-outside" :value="true" />
              <span><strong>{{ t('Outside Antananarivo region') }}</strong><small>{{ t('Use each car’s outside-region rate') }}</small></span>
            </label>
          </div>
        </fieldset>

        <div class="flow-note"><i class="pi pi-info-circle" /><span>{{ t('Multiple-car booking is available for passenger vehicles with daily pricing. Cargo transport keeps its route-distance booking process.') }}</span></div>

        <div class="flow-actions flow-actions--end">
          <Button :label="t('Show available cars')" icon="pi pi-arrow-right" iconPos="right" :disabled="!datesReady" :loading="loadingFleet" @click="findCars" />
        </div>
      </section>

      <section v-else-if="step === 2" class="selection-layout">
        <div class="selection-main">
          <header class="selection-head">
            <div>
              <p class="eyebrow">{{ t('Step 2') }}</p>
              <h2>{{ t('Select at least two cars') }}</h2>
              <span>{{ t('{count} available for {days} billed days', { count: availableCars.length, days: billedDays }) }}</span>
            </div>
            <IconField>
              <InputIcon class="pi pi-search" />
              <InputText v-model="search" :placeholder="t('Search available cars')" />
            </IconField>
          </header>

          <div v-if="loadingFleet" class="selection-grid" aria-hidden="true">
            <Skeleton v-for="n in 6" :key="n" height="350px" borderRadius="18px" />
          </div>
          <div v-else-if="fleetError" class="fleet-state fleet-state--error">
            <i class="pi pi-exclamation-triangle" /><strong>{{ fleetError }}</strong>
            <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="fetchAvailableCars()" />
          </div>
          <div v-else-if="visibleCars.length" class="selection-grid">
            <button
              v-for="car in visibleCars"
              :key="car.id"
              type="button"
              class="selection-card"
              :class="{ 'is-selected': isSelected(car.id) }"
              :disabled="selectedCarIds.length >= MAX_CARS && !isSelected(car.id)"
              :aria-pressed="isSelected(car.id)"
              @click="toggleCar(car.id)"
            >
              <figure v-if="car.primary_image_url"><img :src="car.primary_image_url" :alt="carName(car)" /></figure>
              <VisualPlaceholder v-else kind="car" tone="charcoal" />
              <span class="selection-card__check"><i :class="isSelected(car.id) ? 'pi pi-check' : 'pi pi-plus'" /></span>
              <div class="selection-card__body">
                <p>{{ categoryName(car.category_id) }}</p>
                <h3>{{ carName(car) }}</h3>
                <div class="selection-card__features">
                  <span v-if="car.seats"><i class="pi pi-users" />{{ car.seats }} {{ t('seats') }}</span>
                  <span v-if="car.transmission"><i class="pi pi-cog" />{{ t(car.transmission) }}</span>
                  <span><i class="pi pi-user" />{{ t('Driver included') }}</span>
                </div>
                <div class="selection-card__price">
                  <span>{{ formatMGA(carRate(car)) }} {{ t('/ day') }}</span>
                  <strong>{{ formatMGA(carSubtotal(car)) }}</strong>
                </div>
              </div>
            </button>
          </div>
          <div v-else class="fleet-state">
            <i class="pi pi-calendar-times" />
            <strong>{{ search ? t('No cars match your search.') : t('Fewer than two passenger cars are available for these dates.') }}</strong>
            <span>{{ search ? t('Clear the search to see all available cars.') : t('Choose another trip window to continue.') }}</span>
          </div>
        </div>

        <aside class="selection-summary">
          <div class="selection-summary__head">
            <span><i class="pi pi-car" /></span>
            <div><small>{{ t('Your selection') }}</small><strong>{{ t('{count} of {max} cars', { count: selectedCars.length, max: MAX_CARS }) }}</strong></div>
          </div>
          <div v-if="selectedCars.length" class="selected-lines">
            <div v-for="car in selectedCars" :key="car.id">
              <span><strong>{{ carName(car) }}</strong><small>{{ formatMGA(carRate(car)) }} × {{ billedDays }}</small></span>
              <b>{{ formatMGA(carSubtotal(car)) }}</b>
              <button type="button" :aria-label="t('Remove {car}', { car: carName(car) })" @click="toggleCar(car.id)"><i class="pi pi-times" /></button>
            </div>
          </div>
          <p v-else class="selection-summary__empty">{{ t('Select two or more cars to build your group booking.') }}</p>
          <div class="selection-summary__total"><span>{{ t('Subtotal') }}</span><strong>{{ formatMGA(combinedSubtotal) }}</strong></div>
          <small>{{ t('{days} billed days · driver included for every car', { days: billedDays }) }}</small>
          <Button :label="t('Continue with {count} cars', { count: selectedCars.length })" icon="pi pi-arrow-right" iconPos="right" :disabled="!canContinueWithCars" @click="continueToDetails" />
          <Button :label="t('Change dates')" icon="pi pi-calendar" severity="secondary" outlined @click="step = 1" />
        </aside>
      </section>

      <section v-else class="details-layout">
        <div class="flow-panel details-panel">
          <header class="flow-panel__head">
            <div><p class="eyebrow">{{ t('Step 3') }}</p><h2>{{ t('Add the shared trip details') }}</h2></div>
            <span><i class="pi pi-map-marker" /></span>
          </header>

          <div class="trip-recap">
            <span><i class="pi pi-calendar" /></span>
            <div><strong>{{ formatDate(startDate) }} — {{ formatDate(endDate) }}</strong><small>{{ t('{count} cars · {days} billed days', { count: selectedCars.length, days: billedDays }) }}</small></div>
          </div>

          <div class="place-fields place-fields--maps">
            <ClientLocationPicker
              v-model="form.pickup_location"
              v-model:latitude="form.pickup_latitude"
              v-model:longitude="form.pickup_longitude"
              v-model:locationReference="form.pickup_reference"
              :label="t('Pickup location or city*')"
              :placeholder="t('Hotel, airport, office...')"
            />
            <ClientLocationPicker
              v-model="form.dropoff_location"
              v-model:latitude="form.dropoff_latitude"
              v-model:longitude="form.dropoff_longitude"
              v-model:locationReference="form.dropoff_reference"
              :label="t('Dropoff location or city')"
              :placeholder="t('Optional for standard hire')"
            />
          </div>
          <label>
            <span>{{ t('Contact phone*') }}</span>
            <InputText v-model="form.contact_phone" placeholder="+261..." />
          </label>
          <label>
            <span>{{ t('Note') }}</span>
            <Textarea v-model="form.note" rows="4" autoResize :placeholder="t('Group name, flight number, luggage, accessibility needs...')" />
          </label>

          <div class="flow-note"><i class="pi pi-wallet" /><span>{{ t('All cars share one booking reference and one payment record. Each car receives its own driver.') }}</span></div>
          <label class="confirmation-check">
            <Checkbox v-model="confirmedDetails" binary />
            <span>{{ t('I confirm the selected cars and shared trip details.') }}</span>
          </label>
        </div>

        <aside class="selection-summary final-summary">
          <div class="selection-summary__head">
            <span><i class="pi pi-check-circle" /></span>
            <div><small>{{ t('Final review') }}</small><strong>{{ t('{count} cars selected', { count: selectedCars.length }) }}</strong></div>
          </div>
          <div class="selected-lines">
            <div v-for="car in selectedCars" :key="car.id">
              <span><strong>{{ carName(car) }}</strong><small>{{ categoryName(car.category_id) }}</small></span>
              <b>{{ formatMGA(carSubtotal(car)) }}</b>
            </div>
          </div>
          <div class="selection-summary__total"><span>{{ t('Combined total') }}</span><strong>{{ formatMGA(combinedSubtotal) }}</strong></div>
          <small>{{ outsideAntananarivo ? t('Outside Antananarivo region') : t('Within Antananarivo region') }}</small>
          <Button
            :label="auth.isAuthenticated ? t('Confirm one booking for {count} cars', { count: selectedCars.length }) : t('Sign in to confirm')"
            icon="pi pi-check"
            :loading="booking"
            :disabled="!confirmedDetails || (auth.isAuthenticated && !routeReady)"
            @click="submitBooking"
          />
          <Button :label="t('Back to car selection')" icon="pi pi-arrow-left" severity="secondary" outlined @click="step = 2" />
        </aside>
      </section>
    </div>
  </section>
</template>

<style scoped>
.multi-book-page { padding: 24px 0 88px; }
.multi-book-page__inner { display: grid; gap: 20px; }
.back-link { display: inline-flex; width: fit-content; align-items: center; gap: 8px; color: var(--tm-muted); font-size: .84rem; font-weight: 850; text-decoration: none; }
.multi-book-hero { position: relative; display: grid; min-height: 300px; grid-template-columns: minmax(0,1fr) auto; align-items: center; gap: 30px; overflow: hidden; padding: clamp(28px,5vw,56px); border-radius: 28px; background: radial-gradient(circle at 82% 15%, rgba(201,146,44,.24), transparent 29%), linear-gradient(130deg, #101719, #1b292b); box-shadow: var(--tm-shadow); }
.multi-book-hero::after { position: absolute; right: -100px; bottom: -210px; width: 420px; height: 420px; border: 1px solid rgba(201,146,44,.2); border-radius: 50%; content: ''; }
.multi-book-hero > * { position: relative; z-index: 1; }
.multi-book-hero .eyebrow { color: var(--tm-gold); }
.multi-book-hero h1 { max-width: 820px; margin: 7px 0 12px; color: #fff8ed; font-size: clamp(2.6rem,5vw,5.2rem); letter-spacing: -.055em; line-height: .94; }
.multi-book-hero p:last-child { max-width: 680px; margin: 0; color: rgba(255,255,255,.68); line-height: 1.65; }
.multi-book-hero__mark { display: flex; align-items: center; padding-right: 28px; color: var(--tm-gold); font-size: clamp(3.5rem,8vw,7rem); }
.multi-book-hero__mark i + i { margin-left: -22px; color: #fff; font-size: .7em; transform: translateY(22px); }
.multi-stepper { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 10px; margin: 0; padding: 14px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(20,29,31,.06); list-style: none; }
.multi-stepper li { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 13px; color: var(--tm-muted); }
.multi-stepper li > span { display: grid; width: 38px; height: 38px; flex: 0 0 auto; border: 1px solid var(--tm-border); border-radius: 50%; background: var(--tm-surface-soft); place-items: center; }
.multi-stepper li > div { display: grid; gap: 2px; }
.multi-stepper strong { color: inherit; font-size: .85rem; }
.multi-stepper small { font-size: .68rem; font-weight: 700; }
.multi-stepper li.is-active { background: var(--tm-charcoal); color: #fff; }
.multi-stepper li.is-active > span { border-color: var(--tm-gold); background: var(--tm-gold); color: var(--tm-charcoal); }
.multi-stepper li.is-complete { color: var(--tm-emerald); }
.multi-stepper li.is-complete > span { border-color: var(--tm-emerald); background: var(--tm-emerald); color: #fff; }
.flow-panel { display: grid; gap: 20px; padding: clamp(20px,4vw,34px); border: 1px solid var(--tm-border); border-radius: 22px; background: var(--tm-surface); box-shadow: var(--tm-shadow); }
.date-panel { width: min(880px,100%); justify-self: center; }
.flow-panel__head, .selection-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
.flow-panel__head p, .flow-panel__head h2, .selection-head p, .selection-head h2 { margin: 0; }
.flow-panel__head h2, .selection-head h2 { margin-top: 4px; color: var(--tm-heading); font-size: clamp(1.7rem,3vw,2.5rem); letter-spacing: -.04em; }
.flow-panel__head > span { display: grid; width: 48px; height: 48px; border-radius: 14px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.date-fields, .place-fields { display: grid; gap: 14px; grid-template-columns: repeat(2,minmax(0,1fr)); }
.place-fields--maps { grid-template-columns: 1fr; }
.flow-panel label { display: grid; gap: 7px; min-width: 0; }
.flow-panel label > span, .date-fields label > span { color: var(--tm-heading); font-size: .8rem; font-weight: 850; }
.flow-panel :deep(.p-datepicker), .flow-panel :deep(.p-inputtext), .flow-panel :deep(.p-textarea) { width: 100%; }
.travel-area { display: grid; gap: 10px; margin: 0; padding: 16px; border: 1px solid var(--tm-border); border-radius: 16px; background: var(--tm-surface-soft); }
.travel-area legend { padding: 0 5px; color: var(--tm-heading); font-weight: 900; }
.travel-area > p { margin: 0; color: var(--tm-muted); font-size: .78rem; }
.travel-area > div { display: grid; gap: 10px; grid-template-columns: repeat(2,minmax(0,1fr)); }
.travel-area label { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 10px; padding: 13px; border: 1px solid var(--tm-border); border-radius: 13px; background: var(--tm-surface); cursor: pointer; }
.travel-area label.is-selected { border-color: var(--tm-emerald); box-shadow: 0 0 0 2px rgba(12,155,128,.08); }
.travel-area label > span { display: grid; gap: 3px; }
.travel-area label strong { color: var(--tm-heading); font-size: .82rem; }
.travel-area label small { color: var(--tm-muted); font-size: .72rem; }
.flow-note { display: flex; align-items: flex-start; gap: 10px; padding: 13px; border-radius: 13px; background: rgba(49,92,112,.08); color: var(--tm-blue); font-size: .8rem; font-weight: 760; line-height: 1.5; }
.flow-note i { margin-top: 2px; }
.flow-actions { display: flex; gap: 10px; }
.flow-actions--end { justify-content: flex-end; }
.selection-layout, .details-layout { display: grid; grid-template-columns: minmax(0,1fr) 350px; align-items: start; gap: 20px; }
.selection-main { display: grid; gap: 18px; min-width: 0; }
.selection-head > div > span { color: var(--tm-muted); font-size: .82rem; font-weight: 760; }
.selection-head :deep(.p-inputtext) { min-width: 240px; }
.selection-grid { display: grid; gap: 16px; grid-template-columns: repeat(3,minmax(0,1fr)); }
.selection-card { position: relative; display: grid; min-width: 0; overflow: hidden; padding: 0; border: 1px solid var(--tm-border); border-radius: 19px; background: var(--tm-surface); box-shadow: 0 12px 32px rgba(20,29,31,.06); color: inherit; font: inherit; text-align: left; cursor: pointer; transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
.selection-card:hover { border-color: rgba(12,155,128,.45); transform: translateY(-2px); }
.selection-card.is-selected { border-color: var(--tm-emerald); box-shadow: 0 0 0 3px rgba(12,155,128,.1), 0 18px 40px rgba(20,29,31,.09); }
.selection-card:disabled { cursor: not-allowed; opacity: .52; transform: none; }
.selection-card figure { aspect-ratio: 16/10; margin: 0; overflow: hidden; background: var(--tm-stone); }
.selection-card figure img { width: 100%; height: 100%; object-fit: cover; }
.selection-card__check { position: absolute; top: 12px; right: 12px; display: grid; width: 36px; height: 36px; border: 1px solid rgba(255,255,255,.5); border-radius: 50%; background: rgba(255,255,255,.94); color: var(--tm-heading); box-shadow: 0 6px 18px rgba(20,29,31,.13); place-items: center; }
.selection-card.is-selected .selection-card__check { border-color: var(--tm-emerald); background: var(--tm-emerald); color: #fff; }
.selection-card__body { display: grid; gap: 12px; padding: 16px; }
.selection-card__body > p { margin: 0; color: var(--tm-gold); font-size: .68rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.selection-card h3 { margin: -7px 0 0; color: var(--tm-heading); font-size: 1.2rem; }
.selection-card__features { display: flex; flex-wrap: wrap; gap: 6px; }
.selection-card__features span { display: inline-flex; align-items: center; gap: 5px; padding: 6px 8px; border-radius: 999px; background: var(--tm-surface-soft); color: var(--tm-muted); font-size: .67rem; font-weight: 760; }
.selection-card__price { display: flex; align-items: end; justify-content: space-between; gap: 10px; padding-top: 12px; border-top: 1px solid var(--tm-border); }
.selection-card__price span { color: var(--tm-muted); font-size: .7rem; font-weight: 760; }
.selection-card__price strong { color: var(--tm-heading); font-size: 1.05rem; }
.fleet-state { display: grid; min-height: 320px; align-content: center; justify-items: center; gap: 9px; padding: 28px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); color: var(--tm-muted); text-align: center; }
.fleet-state i { color: var(--tm-gold); font-size: 1.7rem; }
.fleet-state strong { color: var(--tm-heading); }
.fleet-state--error i { color: var(--tm-coral); }
.selection-summary { position: sticky; top: 92px; display: grid; gap: 14px; padding: 20px; border: 1px solid var(--tm-border); border-radius: 20px; background: var(--tm-surface); box-shadow: var(--tm-shadow); }
.selection-summary__head { display: flex; align-items: center; gap: 10px; }
.selection-summary__head > span { display: grid; width: 43px; height: 43px; flex: 0 0 auto; border-radius: 13px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.selection-summary__head > div { display: grid; gap: 2px; }
.selection-summary__head small { color: var(--tm-muted); font-size: .68rem; font-weight: 850; text-transform: uppercase; }
.selection-summary__head strong { color: var(--tm-heading); }
.selected-lines { display: grid; gap: 0; border-top: 1px solid var(--tm-border); }
.selected-lines > div { display: grid; grid-template-columns: minmax(0,1fr) auto auto; align-items: center; gap: 8px; padding: 10px 0; border-bottom: 1px solid var(--tm-border); }
.selected-lines span { display: grid; gap: 2px; min-width: 0; }
.selected-lines span strong { overflow: hidden; color: var(--tm-heading); font-size: .78rem; text-overflow: ellipsis; white-space: nowrap; }
.selected-lines small { color: var(--tm-muted); font-size: .68rem; }
.selected-lines b { color: var(--tm-heading); font-size: .75rem; }
.selected-lines button { display: grid; width: 26px; height: 26px; padding: 0; border: 0; border-radius: 50%; background: rgba(206,107,85,.09); color: var(--tm-coral); cursor: pointer; place-items: center; }
.final-summary .selected-lines > div { grid-template-columns: minmax(0,1fr) auto; }
.selection-summary__empty { margin: 0; padding: 18px 10px; border-radius: 12px; background: var(--tm-surface-soft); color: var(--tm-muted); font-size: .76rem; line-height: 1.5; text-align: center; }
.selection-summary__total { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px; border: 1px solid var(--tm-gold); border-radius: 13px; }
.selection-summary__total span { color: var(--tm-heading); font-weight: 850; }
.selection-summary__total strong { color: var(--tm-heading); font-size: 1.35rem; }
.selection-summary > small { color: var(--tm-muted); font-size: .7rem; font-weight: 720; text-align: center; }
.details-panel { min-width: 0; }
.trip-recap { display: flex; align-items: center; gap: 11px; padding: 13px; border-radius: 13px; background: var(--tm-surface-soft); }
.trip-recap > span { display: grid; width: 40px; height: 40px; flex: 0 0 auto; border-radius: 12px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.trip-recap > div { display: grid; gap: 3px; }
.trip-recap strong { color: var(--tm-heading); }
.trip-recap small { color: var(--tm-muted); font-size: .74rem; }
.confirmation-check { display: flex !important; grid-template-columns: auto 1fr; align-items: center; gap: 9px !important; color: var(--tm-heading); font-size: .82rem; font-weight: 820; }
@media (max-width: 1080px) { .selection-layout, .details-layout { grid-template-columns: 1fr; } .selection-summary { position: static; } .selection-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 720px) { .multi-book-page { padding-top: 14px; } .multi-book-hero { min-height: auto; grid-template-columns: 1fr; padding: 28px 24px; border-radius: 22px; } .multi-book-hero__mark { display: none; } .multi-stepper { grid-template-columns: 1fr; } .multi-stepper li { display: grid; grid-template-columns: auto 1fr; } .date-fields, .place-fields, .travel-area > div, .selection-grid { grid-template-columns: 1fr; } .selection-head { align-items: stretch; flex-direction: column; } .selection-head :deep(.p-iconfield), .selection-head :deep(.p-inputtext) { width: 100%; min-width: 0; } .flow-actions, .flow-actions :deep(.p-button) { width: 100%; } }
</style>
