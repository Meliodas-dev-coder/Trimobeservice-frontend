<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import AdminResourceDialog from '@/components/admin/AdminResourceDialog.vue';
import CarUsageCalendar from '@/components/admin/CarUsageCalendar.vue';
import LocalizedFieldControl from '@/components/admin/LocalizedFieldControl.vue';
import MobilityWorkspaceNav from '@/components/admin/MobilityWorkspaceNav.vue';
import { api } from '@/api/client';
import { loadFieldOptions, serializeForm } from '@/api/resources';
import { adminResources } from '@/data/adminResources';
import { useAdminI18n } from '@/i18n/admin';
import { formatDateTime, formatMGA } from '@/utils/format';
import { cloneTranslations, ensureTranslationBucket } from '@/utils/localized';
import { statusSeverity } from '@/utils/status';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const { enumLabel, localeCode, t, translateConfig } = useAdminI18n();

const carId = computed(() => Number(route.params.id));
const car = ref(null);
const stats = ref({
  revenue_total: '0.00',
  total_bookings: 0,
  future_bookings: 0,
  paid_bookings: 0,
});
const bookings = ref([]);
const loading = ref(false);
const saving = ref(false);
const formErrors = ref({});
const draft = reactive({});
const optionsMap = reactive({});

const imageDialogOpen = ref(false);
const imageSaving = ref(false);
const imageErrors = ref({});

const carsResource = computed(() => translateConfig(adminResources.cars));

const carFields = computed(() =>
  (carsResource.value.formFields || []).filter((field) => !field.createOnly && field.persist !== false),
);
const localizedCarFields = computed(() => carFields.value.filter((field) => field.localized));
const visibleCarFields = computed(() => carFields.value.filter((field) => fieldVisible(field)));
const isCargoVehicle = computed(() => Boolean(car.value?.is_cargo_transport));
const publicPrice = computed(() => (
  isCargoVehicle.value
    ? `${t('From')} ${formatMGA(Number(car.value?.cargo_minimum_rate || 0))}`
    : `${formatMGA(Number(car.value?.daily_rate || 0))} ${t('/ day')}`
));
const outsideRegionPrice = computed(() => (
  `${formatMGA(Number(car.value?.outside_antananarivo_daily_rate || 0))} ${t('/ day outside Antananarivo')}`
));
const canSave = computed(() => visibleCarFields.value.every((field) => {
  if (!isRequired(field)) {
    return true;
  }
  const value = draft[field.key];
  if (value === null || value === undefined || value === '') {
    return false;
  }
  return field.min === undefined || Number(value) >= Number(field.min);
}));

const imageFields = computed(() => {
  const images = carsResource.value.manage?.nested?.find((item) => item.key === 'images');
  return images?.formFields || [];
});

const metrics = computed(() => [
  { label: t('Revenue paid'), value: formatMGA(Number(stats.value.revenue_total || 0)), icon: 'pi pi-wallet', tone: 'gold' },
  { label: t('Bookings'), value: String(stats.value.total_bookings || 0), icon: 'pi pi-calendar-clock', tone: 'blue' },
  { label: t('Future bookings'), value: String(stats.value.future_bookings || 0), icon: 'pi pi-forward', tone: 'emerald' },
  { label: t('Paid bookings'), value: String(stats.value.paid_bookings || 0), icon: 'pi pi-check-circle', tone: 'emerald' },
]);

const primaryImage = computed(() => car.value?.primary_image_url || car.value?.images?.[0]?.url || '');

function optionsFor(field) {
  if (field.key === 'status' && draft[field.key] === 'not_available') {
    return [{ label: t('Not available'), value: 'not_available' }, ...(optionsMap[field.key] || field.options || [])];
  }
  return optionsMap[field.key] || field.options || [];
}

function optionFor(key) {
  return (optionsMap[key] || []).find((option) => option.value === draft[key]) || null;
}

function fieldVisible(field) {
  return !field.showWhen || field.showWhen(draft, { optionFor });
}

function isRequired(field) {
  return Boolean(field.required || (field.requiredWhen && field.requiredWhen(draft, { optionFor })));
}

function fieldDefault(field) {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  if (field.type === 'number' || field.type === 'money') {
    return null;
  }
  return '';
}

function resetDraft() {
  Object.keys(draft).forEach((key) => delete draft[key]);
  for (const field of carFields.value) {
    const raw = car.value ? car.value[field.key] : undefined;
    if (raw !== undefined && raw !== null) {
      draft[field.key] = field.type === 'money' || field.type === 'number' ? Number(raw) : raw;
    } else {
      draft[field.key] = fieldDefault(field);
    }
  }
  if (localizedCarFields.value.length) {
    draft.translations = cloneTranslations(car.value?.translations);
    localizedCarFields.value.forEach((field) => ensureTranslationBucket(draft.translations, field.key));
  }
}

function setTranslation({ field, locale, value }) {
  if (!draft.translations) {
    draft.translations = {};
  }
  ensureTranslationBucket(draft.translations, field)[locale] = value;
}

async function loadOptions() {
  for (const field of carFields.value) {
    if (!field.optionsEndpoint) {
      continue;
    }
    try {
      optionsMap[field.key] = await loadFieldOptions(field);
    } catch {
      optionsMap[field.key] = [];
    }
  }
}

async function loadOverview() {
  if (!carId.value) {
    return;
  }
  loading.value = true;
  try {
    const data = await api.get(`/admin/cars/${carId.value}/overview`);
    car.value = data?.car || null;
    stats.value = data?.stats || stats.value;
    bookings.value = data?.bookings || [];
    resetDraft();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not load car'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    loading.value = false;
  }
}

async function saveCar() {
  saving.value = true;
  formErrors.value = {};
  try {
    const body = serializeForm(carFields.value, draft);
    const data = await api.put(`/admin/cars/${carId.value}`, body);
    car.value = data?.car || car.value;
    toast.add({ severity: 'success', summary: t('Car saved'), life: 2500 });
    await loadOverview();
  } catch (err) {
    if (err?.details) {
      formErrors.value = err.details;
    }
    toast.add({ severity: 'error', summary: t('Save failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    saving.value = false;
  }
}

function openImageDialog() {
  imageErrors.value = {};
  imageDialogOpen.value = true;
}

async function handleImageSubmit(values) {
  imageSaving.value = true;
  imageErrors.value = {};
  try {
    const body = serializeForm(imageFields.value, values);
    await api.post(`/admin/cars/${carId.value}/images`, body);
    toast.add({ severity: 'success', summary: t('Image added'), life: 2500 });
    imageDialogOpen.value = false;
    await loadOverview();
  } catch (err) {
    if (err?.details) {
      imageErrors.value = err.details;
    }
    toast.add({ severity: 'error', summary: t('Image failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    imageSaving.value = false;
  }
}

function confirmImageRemove(image) {
  confirm.require({
    header: t('Delete image'),
    message: t('Delete this car image?'),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('Delete'),
    rejectLabel: t('Cancel'),
    accept: async () => {
      try {
        await api.del(`/admin/car-images/${image.id}`);
        toast.add({ severity: 'success', summary: t('Image deleted'), life: 2500 });
        await loadOverview();
      } catch (err) {
        toast.add({ severity: 'error', summary: t('Delete failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
      }
    },
  });
}

function confirmBookingRemove(booking) {
  confirm.require({
    header: t('Delete booking'),
    message: t('Permanently delete this unpaid booking? This cannot be undone.'),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('Delete'),
    rejectLabel: t('Cancel'),
    accept: async () => {
      try {
        await api.del(`/admin/bookings/${booking.id}`);
        toast.add({ severity: 'success', summary: t('Booking deleted'), life: 2500 });
        await loadOverview();
      } catch (err) {
        toast.add({ severity: 'error', summary: t('Delete failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
      }
    },
  });
}

function formatDate(value) {
  return formatDateTime(value, localeCode.value);
}

function prettify(value) {
  return enumLabel(value);
}

function goBack() {
  router.push({ name: 'admin-cars' });
}

function duplicateCar() {
  router.push({ name: 'admin-cars', query: { duplicate: carId.value } });
}

onMounted(() => {
  loadOptions();
  loadOverview();
});

watch(carId, () => {
  loadOverview();
});
</script>

<template>
  <section class="car-detail">
    <MobilityWorkspaceNav />

    <div class="car-detail__top">
      <div class="car-detail__context">
        <span><i class="pi pi-car" /></span>
        <div><small>{{ t('Fleet workspace') }}</small><strong>{{ car?.name || t('Car detail') }}</strong></div>
      </div>
      <div class="car-detail__actions">
        <Button icon="pi pi-copy" :label="t('Duplicate car')" severity="secondary" outlined @click="duplicateCar" />
        <Button icon="pi pi-arrow-left" :label="t('Back to cars')" severity="secondary" outlined @click="goBack" />
        <Button icon="pi pi-refresh" :label="t('Refresh')" severity="secondary" outlined :loading="loading" @click="loadOverview" />
      </div>
    </div>

    <div v-if="loading && !car" class="car-detail__loading">{{ t('Loading car...') }}</div>

    <template v-else-if="car">
      <section class="car-hero">
        <div class="car-hero__image">
          <img v-if="primaryImage" :src="primaryImage" :alt="car.name" />
          <i v-else class="pi pi-car" />
        </div>
        <div class="car-hero__content">
          <p>{{ t('Fleet car') }}</p>
          <div class="car-hero__title">
            <h2>{{ car.name }}</h2>
            <Tag :value="prettify(car.status)" :severity="statusSeverity(car.status)" />
          </div>
          <div class="car-hero__meta">
            <span>{{ car.registration_plate || t('No plate') }}</span>
            <span>{{ car.category?.name || t('No category') }}</span>
            <span>{{ publicPrice }}</span>
            <span v-if="!isCargoVehicle">{{ outsideRegionPrice }}</span>
          </div>
        </div>
      </section>

      <div class="car-metrics">
        <article v-for="metric in metrics" :key="metric.label" :class="`is-${metric.tone}`">
          <span class="car-metrics__icon"><i :class="metric.icon" /></span>
          <div><span>{{ metric.label }}</span><strong>{{ metric.value }}</strong></div>
        </article>
      </div>

      <section class="car-panel car-edit">
        <div class="car-panel__head">
          <span class="car-panel__head-icon"><i class="pi pi-sliders-h" /></span>
          <div class="car-panel__head-copy">
            <h3>{{ t('Car details') }}</h3>
            <p>{{ t('Registration, category, rate, status, and vehicle specs.') }}</p>
          </div>
          <Button :label="t('Save changes')" icon="pi pi-check" :loading="saving" :disabled="!canSave" @click="saveCar" />
        </div>

        <div class="car-form">
          <template v-for="field in visibleCarFields" :key="field.key">
            <div v-if="field.sectionLabel" class="car-form__section">
              <span><i :class="field.sectionIcon || 'pi pi-pencil'" /></span>
              <div><strong>{{ field.sectionLabel }}</strong><small v-if="field.sectionDescription">{{ field.sectionDescription }}</small></div>
            </div>
            <label class="car-form__field" :class="{ 'car-form__field--wide': field.localized || field.type === 'textarea' }">
            <span>
              {{ field.label }}
              <small v-if="isRequired(field)">*</small>
            </span>

            <LocalizedFieldControl
              v-if="field.localized"
              v-model="draft[field.key]"
              :field="field"
              :translations="draft.translations"
              @update:translation="setTranslation"
            />

            <Textarea
              v-else-if="field.type === 'textarea'"
              v-model="draft[field.key]"
              :placeholder="field.placeholder"
              rows="3"
              autoResize
            />

            <InputNumber
              v-else-if="field.type === 'money'"
              v-model="draft[field.key]"
              :min="field.min ?? 0"
              :useGrouping="true"
              suffix=" MGA"
              fluid
            />

            <InputNumber
              v-else-if="field.type === 'number'"
              v-model="draft[field.key]"
              :useGrouping="false"
              :min="field.min"
              :minFractionDigits="field.minFractionDigits || 0"
              :maxFractionDigits="field.maxFractionDigits ?? field.minFractionDigits ?? 0"
              :suffix="field.suffix"
              fluid
            />

            <Select
              v-else-if="field.type === 'select'"
              v-model="draft[field.key]"
              :options="optionsFor(field)"
              optionLabel="label"
              optionValue="value"
              :placeholder="field.placeholder || t('Choose {field}', { field: field.label.toLowerCase() })"
              :showClear="!isRequired(field)"
              fluid
            />

            <InputText v-else v-model="draft[field.key]" :placeholder="field.placeholder" />

            <small v-if="field.help" class="car-form__help">{{ field.help }}</small>
            <small v-if="formErrors[field.key]" class="car-form__error">{{ t(formErrors[field.key]) }}</small>
            </label>
          </template>
        </div>
      </section>

      <section class="car-panel car-images">
        <div class="car-panel__head">
          <span class="car-panel__head-icon"><i class="pi pi-images" /></span>
          <div class="car-panel__head-copy">
            <h3>{{ t('Images') }}</h3>
            <p>{{ t((car.images?.length || 0) === 1 ? '{count} image' : '{count} images', { count: car.images?.length || 0 }) }}</p>
          </div>
          <Button :label="t('Add image')" icon="pi pi-plus" @click="openImageDialog" />
        </div>

        <div v-if="car.images?.length" class="image-grid">
          <article v-for="image in car.images" :key="image.id" class="image-item">
            <img :src="image.url" :alt="image.alt_text || car.name" />
            <div>
              <strong>{{ image.alt_text || car.name }}</strong>
              <span>{{ image.is_primary ? t('Primary image') : t('Gallery image') }}</span>
            </div>
            <Tag v-if="image.is_primary" :value="t('Primary')" severity="success" />
            <Button icon="pi pi-trash" severity="danger" text rounded :aria-label="t('Delete image')" @click="confirmImageRemove(image)" />
          </article>
        </div>
        <div v-else class="empty-state">{{ t('No images yet.') }}</div>
      </section>

      <CarUsageCalendar :bookings="bookings" :title="t('Usage calendar')" />

      <section class="car-panel">
        <div class="car-panel__head">
          <span class="car-panel__head-icon"><i class="pi pi-calendar-clock" /></span>
          <div class="car-panel__head-copy">
            <h3>{{ t('Bookings') }}</h3>
            <p>{{ t('{count} loaded for this car', { count: bookings.length }) }}</p>
          </div>
        </div>

        <DataTable :value="bookings" responsiveLayout="scroll" tableStyle="min-width: 900px">
          <Column field="booking_number" :header="t('Booking')" />
          <Column field="customer_name" :header="t('Customer')">
            <template #body="{ data }">{{ data.customer_name || '-' }}</template>
          </Column>
          <Column field="status" :header="t('Status')">
            <template #body="{ data }">
              <Tag :value="prettify(data.status)" :severity="statusSeverity(data.status)" />
            </template>
          </Column>
          <Column field="payment_status" :header="t('Payment')">
            <template #body="{ data }">
              <Tag :value="prettify(data.payment_status)" :severity="statusSeverity(data.payment_status)" />
            </template>
          </Column>
          <Column field="start_at" :header="t('Start')">
            <template #body="{ data }">{{ formatDate(data.start_at) }}</template>
          </Column>
          <Column field="end_at" :header="t('End')">
            <template #body="{ data }">{{ formatDate(data.end_at) }}</template>
          </Column>
          <Column field="total_price" :header="t('Total')">
            <template #body="{ data }">
              <span class="cell-money">{{ formatMGA(Number(data.total_price || 0)) }}</span>
            </template>
          </Column>
          <Column :header="t('Actions')" :exportable="false" style="width: 5rem">
            <template #body="{ data }">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                :disabled="data.payment_status !== 'unpaid'"
                :aria-label="t('Delete booking')"
                :title="data.payment_status === 'unpaid' ? t('Delete booking') : t('Bookings with payment history cannot be deleted.')"
                @click="confirmBookingRemove(data)"
              />
            </template>
          </Column>
          <template #empty>
            <div class="empty-state">{{ t('No bookings yet.') }}</div>
          </template>
        </DataTable>
      </section>

      <AdminResourceDialog
        v-model:visible="imageDialogOpen"
        :title="t('Add car image')"
        :fields="imageFields"
        :loading="imageSaving"
        :errors="imageErrors"
        @submit="handleImageSubmit"
      />
    </template>
  </section>
</template>

<style scoped>
.car-detail {
  display: grid;
  gap: 18px;
}

.car-detail__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: var(--tm-surface);
}

.car-detail__context,
.car-detail__actions {
  display: flex;
  align-items: center;
  gap: 9px;
}

.car-detail__context > span {
  display: grid;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  place-items: center;
}

.car-detail__context > div {
  display: grid;
  gap: 2px;
}

.car-detail__context small {
  color: var(--tm-muted);
  font-size: 0.7rem;
  font-weight: 850;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.car-detail__context strong {
  color: var(--tm-heading);
}

.car-detail__loading,
.empty-state {
  padding: 28px;
  color: var(--tm-muted);
  font-weight: 800;
}

.car-hero {
  display: grid;
  grid-template-columns: minmax(220px, 340px) 1fr;
  gap: 20px;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 22px;
  background:
    radial-gradient(circle at 96% 0%, rgba(49, 92, 112, 0.48), transparent 42%),
    linear-gradient(135deg, var(--tm-charcoal), #17282a);
  box-shadow: var(--tm-shadow);
}

.car-hero__image {
  min-height: 230px;
  background: rgba(255, 255, 255, 0.055);
}

.car-hero__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.car-hero__image i {
  display: grid;
  min-height: 230px;
  place-items: center;
  color: var(--tm-gold);
  font-size: 3rem;
}

.car-hero__content {
  display: grid;
  align-content: center;
  gap: 12px;
  padding: 26px 24px 26px 0;
}

.car-hero__content p,
.car-hero__title h2 {
  margin: 0;
}

.car-hero__content p {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.car-hero__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.car-hero__title h2 {
  color: #fff8ed;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
}

.car-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.car-hero__meta span {
  padding: 7px 10px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 0.85rem;
  font-weight: 800;
  background: rgba(255, 255, 255, 0.06);
}

.car-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.car-metrics article,
.car-panel {
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.car-metrics article {
  --metric-accent: var(--tm-gold);
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 92px;
  padding: 16px;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--metric-accent) 11%, transparent), transparent 48%),
    var(--tm-surface);
}

.car-metrics article.is-blue { --metric-accent: var(--tm-blue); }
.car-metrics article.is-emerald { --metric-accent: var(--tm-emerald); }

.car-metrics article > div {
  display: grid;
  gap: 5px;
}

.car-metrics__icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 13px;
  background: var(--metric-accent);
  color: #fff;
  place-items: center;
}

.car-metrics span,
.car-panel__head p,
.image-item span {
  color: var(--tm-muted);
}

.car-metrics .car-metrics__icon {
  color: #fff;
}

.car-metrics span,
.car-form__field span {
  font-size: 0.8rem;
  font-weight: 820;
}

.car-metrics strong {
  color: var(--tm-heading);
  font-size: clamp(1.28rem, 2vw, 1.75rem);
  line-height: 1.05;
}

.car-panel {
  overflow: hidden;
}

.car-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  border-bottom: 1px solid var(--tm-border);
}

.car-panel__head-icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 12px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  place-items: center;
}

.car-panel__head-copy {
  flex: 1;
  min-width: 0;
}

.car-panel__head h3,
.car-panel__head p {
  margin: 0;
}

.car-panel__head h3 {
  color: var(--tm-heading);
  font-size: 1.05rem;
}

.car-panel__head p {
  margin-top: 4px;
  font-size: 0.86rem;
  font-weight: 700;
}

.car-form {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 16px;
}

.car-form__field {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.car-form__field--wide {
  grid-column: 1 / -1;
}

.car-form__section {
  display: flex;
  grid-column: 1 / -1;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  padding-top: 16px;
  border-top: 1px solid var(--tm-border);
}

.car-form__section:first-child {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

.car-form__section > span {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 11px;
  background: var(--tm-surface-soft);
  color: var(--tm-emerald);
  place-items: center;
}

.car-form__section > div {
  display: grid;
  gap: 2px;
}

.car-form__section strong {
  color: var(--tm-heading);
  font-size: 0.9rem;
}

.car-form__section small,
.car-form__help {
  color: var(--tm-muted) !important;
  font-size: 0.76rem;
  font-weight: 700;
}

.car-form__field span {
  color: var(--tm-muted);
}

.car-form__field small,
.car-form__error {
  color: var(--tm-coral);
}

.car-form__field :deep(.p-inputtext),
.car-form__field :deep(.p-inputnumber),
.car-form__field :deep(.p-inputnumber-input),
.car-form__field :deep(.p-select),
.car-form__field :deep(.p-textarea) {
  width: 100%;
}

.image-grid {
  display: grid;
  gap: 12px;
  padding: 16px;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.image-item {
  display: grid;
  grid-template-columns: 96px 1fr auto auto;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--tm-border);
  border-radius: 14px;
  background: var(--tm-surface-soft);
}

.image-item img {
  width: 96px;
  height: 66px;
  object-fit: cover;
  border-radius: 6px;
}

.image-item div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.image-item strong {
  overflow: hidden;
  color: var(--tm-heading);
  font-size: 0.9rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-money {
  color: var(--tm-heading);
  font-weight: 900;
}

.car-panel :deep(.p-datatable-thead > tr > th) {
  background: var(--tm-surface-soft);
  color: var(--tm-muted);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.car-panel :deep(.p-datatable-tbody > tr > td) {
  border-color: var(--tm-border);
}

@media (max-width: 920px) {
  .car-hero,
  .car-form {
    grid-template-columns: 1fr;
  }

  .car-hero__content {
    padding: 0 18px 18px;
  }

  .car-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .car-detail__top,
  .car-panel__head {
    align-items: stretch;
    flex-direction: column;
  }

  .car-detail__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .car-detail__top .p-button,
  .car-panel__head .p-button {
    width: 100%;
  }

  .car-metrics {
    grid-template-columns: 1fr;
  }

  .image-item {
    grid-template-columns: 84px 1fr auto;
  }

  .image-item img {
    width: 84px;
  }
}
</style>
