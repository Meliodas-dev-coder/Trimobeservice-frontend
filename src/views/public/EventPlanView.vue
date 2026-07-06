<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import { createEventRequest, listArtists, listEventServiceCategories, listEventServices } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatMGA } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const { t } = usePublicI18n();

const categories = ref([]);
const services = ref([]);
const artists = ref([]);
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
const selectedServiceIds = ref([]);
const selectedArtistIds = ref([]);

const today = startOfToday();
const startDate = ref(defaultStartDate());
const endDate = ref(null);

const form = reactive({
  event_type: 'wedding',
  location: '',
  guest_count: null,
  budget: null,
  contact_phone: '',
  contact_email: '',
  note: '',
});

const eventTypeOptions = [
  { label: 'Wedding', value: 'wedding' },
  { label: 'Corporate', value: 'corporate' },
  { label: 'Birthday', value: 'birthday' },
  { label: 'Concert', value: 'concert' },
  { label: 'Conference', value: 'conference' },
  { label: 'Other', value: 'other' },
];
const translatedEventTypeOptions = computed(() => eventTypeOptions.map((option) => ({ ...option, label: t(option.label) })));

const categorySections = computed(() => {
  const grouped = new Map();
  for (const service of services.value) {
    const key = Number(service.category_id || 0);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(service);
  }

  const sections = categories.value.map((category) => ({
    category,
    services: grouped.get(Number(category.id)) || [],
  }));
  const knownIds = new Set(categories.value.map((category) => Number(category.id)));
  const uncategorized = services.value.filter((service) => !knownIds.has(Number(service.category_id || 0)));
  if (uncategorized.length) {
    sections.push({
      category: { id: 'more', name: 'More services', icon: 'pi pi-sparkles' },
      services: uncategorized,
    });
  }
  return sections.filter((section) => section.services.length);
});

const selectedServices = computed(() => {
  const selected = new Set(selectedServiceIds.value.map((id) => Number(id)));
  return services.value.filter((service) => selected.has(Number(service.id)));
});

const selectedArtists = computed(() => {
  const selected = new Set(selectedArtistIds.value.map((id) => Number(id)));
  return artists.value.filter((artist) => selected.has(Number(artist.id)));
});

const selectionCount = computed(() => selectedServiceIds.value.length + selectedArtistIds.value.length);

const indicativeTotal = computed(
  () =>
    selectedServices.value.reduce((sum, service) => sum + Number(service.from_price || 0), 0) +
    selectedArtists.value.reduce((sum, artist) => sum + Number(artist.from_fee || 0), 0),
);
const invalidEndDate = computed(() => endDate.value instanceof Date && startDate.value instanceof Date && endDate.value < startDate.value);
const canSubmit = computed(
  () =>
    auth.isAuthenticated &&
    !loading.value &&
    !submitting.value &&
    form.event_type &&
    startDate.value instanceof Date &&
    !invalidEndDate.value &&
    form.location.trim() &&
    form.contact_phone.trim() &&
    selectionCount.value > 0,
);

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(18, 0, 0, 0);
  return date;
}

function priceLabel(service) {
  if (service.from_price === null || service.from_price === undefined || service.from_price === '') {
    return t('Quote by request');
  }
  return `${formatMGA(Number(service.from_price || 0))}${service.price_unit ? ` ${service.price_unit}` : ''}`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [categoryList, serviceList, artistList] = await Promise.all([
      listEventServiceCategories(),
      listEventServices(),
      listArtists(),
    ]);
    categories.value = categoryList;
    services.value = serviceList;
    artists.value = artistList;
    preselectArtist();
  } catch (err) {
    categories.value = [];
    services.value = [];
    artists.value = [];
    error.value = err?.message || t('Could not load event services');
  } finally {
    loading.value = false;
  }
}

// Pre-tick an artist when arriving from their profile (?artist=slug).
function preselectArtist() {
  const slug = route.query.artist;
  if (!slug) {
    return;
  }
  const match = artists.value.find((artist) => artist.slug === slug);
  if (match && !selectedArtistIds.value.includes(match.id)) {
    selectedArtistIds.value = [...selectedArtistIds.value, match.id];
  }
}

function prefillContact() {
  if (!form.contact_email && auth.user?.email) {
    form.contact_email = auth.user.email;
  }
  if (!form.contact_phone && auth.user?.phone) {
    form.contact_phone = auth.user.phone;
  }
}

async function submitRequest() {
  if (!auth.isAuthenticated) {
    router.push({ name: 'account', query: { redirect: route.fullPath } });
    return;
  }
  if (!canSubmit.value) {
    return;
  }

  submitting.value = true;
  try {
    const body = {
      event_type: form.event_type,
      event_start: startDate.value.toISOString(),
      location: form.location.trim(),
      contact_phone: form.contact_phone.trim(),
      services: selectedServiceIds.value.map((id) => ({ service_id: id, quantity: 1 })),
      artists: selectedArtistIds.value.map((id) => ({ artist_id: id })),
    };
    if (endDate.value instanceof Date) {
      body.event_end = endDate.value.toISOString();
    }
    if (form.guest_count) {
      body.guest_count = Number(form.guest_count);
    }
    if (form.budget) {
      body.budget = Number(form.budget).toFixed(2);
    }
    if (form.contact_email.trim()) {
      body.contact_email = form.contact_email.trim();
    }
    if (form.note.trim()) {
      body.note = form.note.trim();
    }

    const created = await createEventRequest(body);
    toast.add({ severity: 'success', summary: t('Request sent'), detail: created?.request_number || t('Event request received'), life: 3200 });
    if (created?.id) {
      router.push({ name: 'event-request-confirmation', params: { id: created.id } });
    } else {
      router.push({ name: 'orders', query: { tab: 'events' } });
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Request failed'), detail: err?.message || t('Request failed'), life: 4600 });
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await auth.ensureReady();
  if (!auth.isAuthenticated) {
    router.replace({ name: 'account', query: { redirect: route.fullPath } });
    return;
  }
  prefillContact();
  load();
});
</script>

<template>
  <section class="event-plan-page">
    <div class="app-container">
      <Button as="router-link" to="/events" icon="pi pi-arrow-left" :label="t('Back to events')" severity="secondary" outlined />

      <header class="plan-hero">
        <div>
          <p class="eyebrow">{{ t('Plan') }}</p>
          <h1>{{ t('Tell us what your event needs.') }}</h1>
          <p>
            {{ t('Pick the services, date, place, guest count, and budget. The planning team reviews your request and sends a tailored quote.') }}
          </p>
        </div>
        <div class="plan-hero__summary soft-panel">
          <span>{{ selectionCount }}</span>
          <strong>{{ t('selections') }}</strong>
          <small>{{ indicativeTotal ? `${t('From')} ${formatMGA(indicativeTotal)}` : t('Quote by request') }}</small>
        </div>
      </header>

      <div v-if="error" class="plan-state plan-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
      </div>

      <form v-else class="plan-layout" @submit.prevent="submitRequest">
        <section class="plan-panel soft-panel">
          <div class="panel-head">
            <p class="eyebrow">{{ t('Event details') }}</p>
            <h2>{{ t('Request information') }}</h2>
          </div>

          <div class="form-grid">
            <label>
              <span>{{ t('Event type*') }}</span>
              <Select v-model="form.event_type" :options="translatedEventTypeOptions" optionLabel="label" optionValue="value" fluid />
            </label>

            <label>
              <span>{{ t('Event start*') }}</span>
              <DatePicker v-model="startDate" showIcon showTime hourFormat="24" fluid dateFormat="dd M yy" :minDate="today" />
            </label>

            <label>
              <span>{{ t('Event end') }}</span>
              <DatePicker v-model="endDate" showIcon showTime hourFormat="24" fluid dateFormat="dd M yy" :minDate="startDate" />
            </label>

            <label>
              <span>{{ t('Location*') }}</span>
              <InputText v-model="form.location" :placeholder="t('Venue, hotel, city, or address')" />
            </label>

            <label>
              <span>{{ t('Guests') }}</span>
              <InputNumber v-model="form.guest_count" :min="0" fluid />
            </label>

            <label>
              <span>{{ t('Budget') }}</span>
              <InputNumber v-model="form.budget" :min="0" suffix=" MGA" fluid />
            </label>

            <label>
              <span>{{ t('Contact phone*') }}</span>
              <InputText v-model="form.contact_phone" placeholder="+261..." />
            </label>

            <label>
              <span>{{ t('Contact email') }}</span>
              <InputText v-model="form.contact_email" placeholder="name@example.com" />
            </label>
          </div>

          <p v-if="invalidEndDate" class="form-hint form-hint--error">{{ t('Event end must be after the start date.') }}</p>

          <label class="note-field">
            <span>{{ t('Notes') }}</span>
            <Textarea v-model="form.note" rows="4" autoResize :placeholder="t('Theme, timing, venue rules, preferred artists, menu ideas...')" />
          </label>
        </section>

        <section class="plan-panel soft-panel">
          <div class="panel-head">
            <p class="eyebrow">{{ t('Services') }}</p>
            <h2>{{ t('Choose what you need') }}</h2>
          </div>

          <div v-if="loading" class="service-loading">
            <Skeleton v-for="n in 6" :key="n" height="62px" borderRadius="8px" />
          </div>

          <div v-else-if="categorySections.length" class="service-sections">
            <fieldset v-for="section in categorySections" :key="section.category.id" class="service-section">
              <legend>
                <i :class="section.category.icon || 'pi pi-calendar'" />
                {{ t(section.category.name) }}
              </legend>

              <label v-for="service in section.services" :key="service.id" class="service-choice">
                <Checkbox v-model="selectedServiceIds" :inputId="`event-service-${service.id}`" :value="service.id" />
                <span>
                  <strong>{{ service.name }}</strong>
                  <small>{{ priceLabel(service) }}</small>
                </span>
              </label>
            </fieldset>
          </div>

          <div v-else class="plan-state plan-state--compact">
            <i class="pi pi-calendar" />
            <span>{{ t('Event services are being prepared for publication.') }}</span>
          </div>

          <fieldset v-if="artists.length" class="service-section artist-pick">
            <legend>
              <i class="pi pi-microphone" />
              {{ t('Gospel artists') }}
            </legend>

            <label v-for="artist in artists" :key="artist.id" class="service-choice service-choice--artist">
              <Checkbox v-model="selectedArtistIds" :inputId="`event-artist-${artist.id}`" :value="artist.id" />
              <img v-if="artist.photo_url" :src="artist.photo_url" :alt="artist.stage_name" class="artist-thumb" />
              <span v-else class="artist-thumb artist-thumb--empty"><i class="pi pi-microphone" /></span>
              <span>
                <strong>{{ artist.stage_name }}</strong>
                <small>{{ artist.genres || t('Gospel artist') }}</small>
              </span>
            </label>

            <RouterLink class="artist-pick__link" to="/events/artists">{{ t('See full artist profiles') }}</RouterLink>
          </fieldset>

          <div class="plan-actions">
            <Button
              type="submit"
              :label="selectionCount ? t('Send request') : t('Select a service or artist')"
              icon="pi pi-send"
              :loading="submitting"
              :disabled="!canSubmit"
            />
            <Button as="router-link" to="/events" :label="t('Browse services')" icon="pi pi-list" severity="secondary" outlined />
          </div>
        </section>
      </form>
    </div>
  </section>
</template>

<style scoped>
.event-plan-page {
  padding: 34px 0 72px;
}

.artist-pick {
  margin-top: 14px;
}

.service-choice--artist {
  grid-template-columns: auto auto 1fr;
  align-items: center;
}

.artist-thumb {
  width: 46px;
  height: 46px;
  border-radius: 999px;
  object-fit: cover;
  background: var(--tm-surface-soft);
}

.artist-thumb--empty {
  display: grid;
  place-items: center;
  color: var(--tm-gold);
}

.artist-pick__link {
  display: inline-block;
  margin-top: 6px;
  color: var(--tm-emerald);
  font-weight: 800;
  font-size: 0.86rem;
}

.plan-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
  margin: 26px 0 20px;
}

.plan-hero h1 {
  max-width: 780px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.3rem, 6vw, 5rem);
  line-height: 0.94;
}

.plan-hero p:not(.eyebrow) {
  max-width: 700px;
  color: var(--tm-muted);
  line-height: 1.65;
}

.plan-hero__summary {
  display: grid;
  min-width: 200px;
  gap: 4px;
  padding: 18px;
}

.plan-hero__summary span {
  color: var(--tm-heading);
  font-size: 2rem;
  font-weight: 950;
}

.plan-hero__summary strong {
  color: var(--tm-muted);
  text-transform: uppercase;
}

.plan-hero__summary small {
  color: var(--tm-gold);
  font-weight: 850;
}

.plan-layout {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: minmax(0, 0.9fr) minmax(360px, 0.72fr);
}

.plan-panel {
  display: grid;
  gap: 18px;
  padding: 20px;
}

.panel-head h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.3rem;
}

.form-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.plan-panel label,
.note-field {
  display: grid;
  gap: 7px;
}

.plan-panel label > span,
.note-field > span {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 850;
}

.plan-panel :deep(.p-select),
.plan-panel :deep(.p-datepicker),
.plan-panel :deep(.p-datepicker-input),
.plan-panel :deep(.p-inputnumber),
.plan-panel :deep(.p-inputnumber-input),
.plan-panel :deep(.p-inputtext),
.plan-panel :deep(.p-textarea) {
  width: 100%;
}

.form-hint {
  margin: 0;
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 780;
}

.form-hint--error {
  color: var(--tm-coral);
}

.service-loading,
.service-sections {
  display: grid;
  gap: 14px;
}

.service-section {
  display: grid;
  gap: 9px;
  min-width: 0;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.service-section legend {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 6px;
  color: var(--tm-heading);
  font-weight: 900;
}

.service-section legend i {
  color: var(--tm-gold);
}

.service-choice {
  display: grid !important;
  align-items: start;
  gap: 10px !important;
  grid-template-columns: auto 1fr;
  min-height: 54px;
  padding: 10px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  cursor: pointer;
}

.service-choice span {
  display: grid;
  gap: 4px;
}

.service-choice strong {
  color: var(--tm-heading);
}

.service-choice small {
  color: var(--tm-muted);
  font-weight: 760;
}

.plan-actions {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.plan-state {
  display: grid;
  min-height: 300px;
  place-items: center;
  gap: 10px;
  padding: 34px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  color: var(--tm-muted);
  font-weight: 850;
  text-align: center;
}

.plan-state--compact {
  min-height: 180px;
}

.plan-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.plan-state--error i {
  color: var(--tm-coral);
}

@media (max-width: 980px) {
  .plan-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .plan-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .form-grid,
  .plan-actions {
    grid-template-columns: 1fr;
  }

  .plan-actions .p-button {
    width: 100%;
  }
}
</style>
