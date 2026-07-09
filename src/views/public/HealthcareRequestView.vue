<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import GooglePlaceInput from '@/components/GooglePlaceInput.vue';
import { createHealthcareRequest, listHealthcareCategories, listHealthcareServices } from '@/api/public';
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
const loading = ref(false);
const submitting = ref(false);
const error = ref('');

const today = startOfToday();
const selectedServiceId = ref(null); // null = general consultation
const preferredAt = ref(null);
const startAt = ref(defaultStartDate());

const form = reactive({
  patient_name: '',
  patient_age: null,
  patient_gender: '',
  address: '',
  symptoms: '',
  contact_phone: '',
  contact_email: '',
});

const genderOptions = computed(() => [
  { label: t('Male'), value: 'male' },
  { label: t('Female'), value: 'female' },
  { label: t('Other'), value: 'other' },
]);

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
  return sections.filter((section) => section.services.length);
});

const selectedService = computed(
  () => services.value.find((service) => Number(service.id) === Number(selectedServiceId.value)) || null,
);
const isPackage = computed(() => selectedService.value?.service_type === 'package');

const priceHint = computed(() => {
  const service = selectedService.value;
  if (!service) {
    return t('A general home consultation. Our team reviews and sends a quote.');
  }
  if (service.service_type === 'package') {
    return `${formatMGA(Number(service.price || 0))}${service.price_unit ? ` ${service.price_unit}` : ''}`;
  }
  if (service.from_price) {
    return `${t('From')} ${formatMGA(Number(service.from_price || 0))} — ${t('final quote after review')}`;
  }
  return t('Quote after review');
});

const canSubmit = computed(
  () =>
    auth.isAuthenticated &&
    !loading.value &&
    !submitting.value &&
    form.patient_name.trim() &&
    form.address.trim() &&
    form.contact_phone.trim() &&
    (!isPackage.value || startAt.value instanceof Date),
);

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  date.setHours(9, 0, 0, 0);
  return date;
}

function selectService(id) {
  selectedServiceId.value = id;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [categoryList, serviceList] = await Promise.all([
      listHealthcareCategories(),
      listHealthcareServices(),
    ]);
    categories.value = categoryList;
    services.value = serviceList;
    preselectService();
  } catch (err) {
    categories.value = [];
    services.value = [];
    error.value = err?.message || t('Could not load healthcare services');
  } finally {
    loading.value = false;
  }
}

// Pre-tick a service when arriving from a card (?service=slug).
function preselectService() {
  const slug = route.query.service;
  if (!slug) {
    return;
  }
  const match = services.value.find((service) => service.slug === slug);
  if (match) {
    selectedServiceId.value = match.id;
  }
}

function prefillContact() {
  if (!form.contact_email && auth.user?.email) {
    form.contact_email = auth.user.email;
  }
  if (!form.contact_phone && auth.user?.phone) {
    form.contact_phone = auth.user.phone;
  }
  if (!form.patient_name && auth.user?.full_name) {
    form.patient_name = auth.user.full_name;
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
      patient_name: form.patient_name.trim(),
      address: form.address.trim(),
      contact_phone: form.contact_phone.trim(),
    };
    if (selectedServiceId.value) {
      body.service_id = Number(selectedServiceId.value);
    }
    if (isPackage.value && startAt.value instanceof Date) {
      body.start_at = startAt.value.toISOString();
    }
    if (!isPackage.value && preferredAt.value instanceof Date) {
      body.preferred_at = preferredAt.value.toISOString();
    }
    if (form.patient_age) {
      body.patient_age = Number(form.patient_age);
    }
    if (form.patient_gender) {
      body.patient_gender = form.patient_gender;
    }
    if (form.symptoms.trim()) {
      body.symptoms = form.symptoms.trim();
    }
    if (form.contact_email.trim()) {
      body.contact_email = form.contact_email.trim();
    }

    const created = await createHealthcareRequest(body);
    toast.add({ severity: 'success', summary: t('Request sent'), detail: created?.request_number || t('Healthcare request received'), life: 3200 });
    if (created?.id) {
      router.push({ name: 'healthcare-request-confirmation', params: { id: created.id } });
    } else {
      router.push({ name: 'healthcare' });
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
  <section class="care-request-page">
    <div class="app-container">
      <Button as="router-link" to="/healthcare" icon="pi pi-arrow-left" :label="t('Back to healthcare')" severity="secondary" outlined />

      <header class="request-hero">
        <div>
          <p class="eyebrow">{{ t('Healthcare') }}</p>
          <h1>{{ t('Request care at home.') }}</h1>
          <p>
            {{ t('Choose a consultation or a care package, tell us who it is for and where, and our team reviews your request and follows up.') }}
          </p>
        </div>
        <div class="request-hero__summary soft-panel">
          <span>{{ isPackage ? t('Package') : t('Consultation') }}</span>
          <strong>{{ selectedService ? selectedService.name : t('General consultation') }}</strong>
          <small>{{ priceHint }}</small>
        </div>
      </header>

      <div v-if="error" class="request-state request-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
      </div>

      <form v-else class="request-layout" @submit.prevent="submitRequest">
        <section class="request-panel soft-panel">
          <div class="panel-head">
            <p class="eyebrow">{{ t('Service') }}</p>
            <h2>{{ t('What do you need?') }}</h2>
          </div>

          <div v-if="loading" class="service-loading">
            <Skeleton v-for="n in 5" :key="n" height="58px" borderRadius="8px" />
          </div>

          <div v-else class="service-sections">
            <label class="service-choice" :class="{ 'is-selected': selectedServiceId === null }">
              <RadioButton v-model="selectedServiceId" :value="null" inputId="care-service-general" />
              <span>
                <strong>{{ t('General home consultation') }}</strong>
                <small>{{ t('Not sure which service? Describe your need and we will advise.') }}</small>
              </span>
            </label>

            <fieldset v-for="section in categorySections" :key="section.category.id" class="service-section">
              <legend>
                <i :class="section.category.icon || 'pi pi-heart'" />
                {{ t(section.category.name) }}
              </legend>

              <label
                v-for="service in section.services"
                :key="service.id"
                class="service-choice"
                :class="{ 'is-selected': Number(selectedServiceId) === Number(service.id) }"
              >
                <RadioButton v-model="selectedServiceId" :value="service.id" :inputId="`care-service-${service.id}`" />
                <span>
                  <strong>
                    {{ service.name }}
                    <Tag
                      class="service-choice__tag"
                      :value="service.service_type === 'package' ? t('Package') : t('Consultation')"
                      :severity="service.service_type === 'package' ? 'success' : 'info'"
                    />
                  </strong>
                  <small>
                    <template v-if="service.service_type === 'package'">
                      {{ formatMGA(Number(service.price || 0)) }}{{ service.price_unit ? ` ${service.price_unit}` : '' }}
                    </template>
                    <template v-else-if="service.from_price">
                      {{ t('From') }} {{ formatMGA(Number(service.from_price || 0)) }}
                    </template>
                    <template v-else>{{ t('Quote after review') }}</template>
                  </small>
                </span>
              </label>
            </fieldset>
          </div>
        </section>

        <section class="request-panel soft-panel">
          <div class="panel-head">
            <p class="eyebrow">{{ t('Details') }}</p>
            <h2>{{ t('Patient & visit') }}</h2>
          </div>

          <div class="form-grid">
            <label>
              <span>{{ t('Patient name*') }}</span>
              <InputText v-model="form.patient_name" :placeholder="t('Who is the care for?')" />
            </label>
            <label>
              <span>{{ t('Age') }}</span>
              <InputNumber v-model="form.patient_age" :min="0" :max="130" fluid />
            </label>
            <label>
              <span>{{ t('Gender') }}</span>
              <Select v-model="form.patient_gender" :options="genderOptions" optionLabel="label" optionValue="value" showClear fluid :placeholder="t('Unspecified')" />
            </label>

            <label v-if="isPackage">
              <span>{{ t('Coverage start*') }}</span>
              <DatePicker v-model="startAt" showIcon fluid dateFormat="dd M yy" :minDate="today" />
            </label>
            <label v-else>
              <span>{{ t('Preferred visit time') }}</span>
              <DatePicker v-model="preferredAt" showIcon showTime hourFormat="24" fluid dateFormat="dd M yy" :minDate="today" />
            </label>

            <label class="full">
              <span>{{ t('Home address*') }}</span>
              <GooglePlaceInput v-model="form.address" :placeholder="t('Street, neighbourhood, city')" />
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

          <label class="note-field">
            <span>{{ t('Reason / symptoms') }}</span>
            <Textarea v-model="form.symptoms" rows="4" autoResize :placeholder="t('Describe the symptoms, condition, or care needed...')" />
          </label>

          <div class="request-actions">
            <Button
              type="submit"
              :label="t('Send request')"
              icon="pi pi-send"
              :loading="submitting"
              :disabled="!canSubmit"
            />
            <Button as="router-link" to="/healthcare" :label="t('Browse services')" icon="pi pi-list" severity="secondary" outlined />
          </div>
        </section>
      </form>
    </div>
  </section>
</template>

<style scoped>
.care-request-page {
  padding: 34px 0 72px;
}

.request-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
  margin: 26px 0 20px;
}

.request-hero h1 {
  max-width: 720px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.2rem, 6vw, 4.4rem);
  line-height: 0.96;
}

.request-hero p:not(.eyebrow) {
  max-width: 640px;
  color: var(--tm-muted);
  line-height: 1.65;
}

.request-hero__summary {
  display: grid;
  min-width: 220px;
  gap: 4px;
  padding: 18px;
}

.request-hero__summary span {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
}

.request-hero__summary strong {
  color: var(--tm-heading);
  font-size: 1.1rem;
}

.request-hero__summary small {
  color: var(--tm-muted);
  font-weight: 800;
}

.request-layout {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: minmax(0, 0.85fr) minmax(360px, 1fr);
}

.request-panel {
  display: grid;
  gap: 18px;
  padding: 20px;
}

.panel-head h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.3rem;
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
  display: grid;
  align-items: start;
  gap: 10px;
  grid-template-columns: auto 1fr;
  min-height: 54px;
  padding: 12px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  cursor: pointer;
}

.service-choice.is-selected {
  border-color: var(--tm-gold);
  box-shadow: 0 0 0 1px var(--tm-gold);
}

.service-choice span {
  display: grid;
  gap: 4px;
}

.service-choice strong {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tm-heading);
}

.service-choice__tag {
  transform: scale(0.86);
  transform-origin: left center;
}

.service-choice small {
  color: var(--tm-muted);
  font-weight: 760;
}

.form-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-grid .full {
  grid-column: 1 / -1;
}

.request-panel label,
.note-field {
  display: grid;
  gap: 7px;
}

.request-panel label > span,
.note-field > span {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 850;
}

.request-panel :deep(.p-select),
.request-panel :deep(.p-datepicker),
.request-panel :deep(.p-datepicker-input),
.request-panel :deep(.p-inputnumber),
.request-panel :deep(.p-inputnumber-input),
.request-panel :deep(.p-inputtext),
.request-panel :deep(.p-textarea) {
  width: 100%;
}

.request-actions {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.request-state {
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

.request-state--error i {
  color: var(--tm-coral);
}

@media (max-width: 980px) {
  .request-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .request-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .form-grid,
  .request-actions {
    grid-template-columns: 1fr;
  }

  .request-actions .p-button {
    width: 100%;
  }
}
</style>
