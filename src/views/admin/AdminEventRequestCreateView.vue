<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import GooglePlaceInput from '@/components/GooglePlaceInput.vue';
import EventWorkspaceNav from '@/components/admin/EventWorkspaceNav.vue';
import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { formatMGA } from '@/utils/format';

const router = useRouter();
const toast = useToast();
const { t } = useAdminI18n();

const saving = ref(false);
const loading = ref(false);
const errors = ref({});

const categories = ref([]);
const services = ref([]);
const customers = ref([]);
const selectedServiceIds = ref([]);

const today = startOfToday();
const startDate = ref(defaultStartDate());
const endDate = ref(null);

const form = reactive({
  customer_name: '',
  user_id: null,
  event_type: 'wedding',
  location: '',
  guest_count: null,
  budget: null,
  contact_phone: '',
  contact_email: '',
  note: '',
});

const eventTypeOptions = [
  { label: t('Wedding'), value: 'wedding' },
  { label: t('Corporate'), value: 'corporate' },
  { label: t('Birthday'), value: 'birthday' },
  { label: t('Concert'), value: 'concert' },
  { label: t('Conference'), value: 'conference' },
  { label: t('Other'), value: 'other' },
];

const customerOptions = computed(() =>
  customers.value.map((c) => ({ label: `${c.full_name} · ${c.email}`, value: c.id })),
);

const categorySections = computed(() => {
  const grouped = new Map();
  for (const service of services.value) {
    const key = Number(service.category_id || 0);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(service);
  }
  return categories.value
    .map((category) => ({ category, services: grouped.get(Number(category.id)) || [] }))
    .filter((section) => section.services.length);
});

const selectedServices = computed(() => {
  const selected = new Set(selectedServiceIds.value.map((id) => Number(id)));
  return services.value.filter((service) => selected.has(Number(service.id)));
});
const indicativeTotal = computed(() =>
  selectedServices.value.reduce((sum, service) => sum + Number(service.from_price || 0), 0),
);

const invalidEndDate = computed(
  () => endDate.value instanceof Date && startDate.value instanceof Date && endDate.value < startDate.value,
);
const canSubmit = computed(
  () =>
    !saving.value &&
    form.customer_name.trim() &&
    form.event_type &&
    startDate.value instanceof Date &&
    !invalidEndDate.value &&
    form.location.trim() &&
    form.contact_phone.trim() &&
    selectedServiceIds.value.length > 0,
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

async function submit() {
  if (!canSubmit.value) {
    return;
  }
  saving.value = true;
  errors.value = {};
  try {
    const body = {
      customer_name: form.customer_name.trim(),
      event_type: form.event_type,
      event_start: startDate.value.toISOString(),
      location: form.location.trim(),
      contact_phone: form.contact_phone.trim(),
      services: selectedServiceIds.value.map((id) => ({ service_id: id, quantity: 1 })),
    };
    if (form.user_id) {
      body.user_id = form.user_id;
    }
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
    const data = await api.post('/admin/event-requests', body);
    toast.add({ severity: 'success', summary: t('Event request created'), detail: data?.event_request?.request_number || '', life: 2800 });
    router.push({ name: 'admin-event-requests' });
  } catch (err) {
    if (err?.details) {
      errors.value = err.details;
    }
    toast.add({ severity: 'error', summary: t('Save failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push({ name: 'admin-event-requests' });
}

onMounted(async () => {
  loading.value = true;
  try {
    const [cat, svc, cust] = await Promise.all([
      api.get('/admin/event-service-categories'),
      api.get('/admin/event-services', { params: { limit: 100 } }),
      api.get('/admin/customers', { params: { limit: 100 } }),
    ]);
    categories.value = cat?.event_service_categories || [];
    services.value = (svc?.event_services || []).filter((service) => service.is_active);
    customers.value = cust?.customers || [];
  } catch {
    // form still usable; selects just stay empty
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <section class="event-create">
    <EventWorkspaceNav />

    <header class="event-create__head">
      <div>
        <p>{{ t('Event planning') }}</p>
        <h1>{{ t('Create a clear request from the first conversation.') }}</h1>
        <span>{{ t('Capture the client, schedule, venue, services, and indicative budget now; quote and payment stay in the request workflow.') }}</span>
      </div>
      <div class="event-create__top">
        <Button icon="pi pi-arrow-left" :label="t('Event requests')" severity="secondary" outlined @click="goBack" />
        <Button :label="t('Create request')" icon="pi pi-check" :loading="saving" :disabled="!canSubmit" @click="submit" />
      </div>
    </header>

    <div class="event-grid">
      <div class="event-grid__main">
        <!-- Customer -->
        <section class="panel">
          <div class="panel__head"><h3>{{ t('Customer') }}</h3></div>
          <div class="field-grid">
            <label class="field">
              <span>{{ t('Customer name') }}<small>*</small></span>
              <InputText v-model="form.customer_name" :placeholder="t('Phone caller name')" />
              <small v-if="errors.customer_name" class="field__error">{{ t(errors.customer_name) }}</small>
            </label>
            <label class="field">
              <span>{{ t('Link account (optional)') }}</span>
              <Select
                v-model="form.user_id"
                :options="customerOptions"
                optionLabel="label"
                optionValue="value"
                :placeholder="t('None')"
                showClear
                filter
                fluid
              />
            </label>
          </div>
        </section>

        <!-- Event details -->
        <section class="panel">
          <div class="panel__head"><h3>{{ t('Event details') }}</h3></div>
          <div class="field-grid">
            <label class="field">
              <span>{{ t('Event type') }}<small>*</small></span>
              <Select v-model="form.event_type" :options="eventTypeOptions" optionLabel="label" optionValue="value" fluid />
            </label>
            <label class="field">
              <span>{{ t('Event start') }}<small>*</small></span>
              <DatePicker v-model="startDate" showIcon showTime hourFormat="24" fluid dateFormat="dd M yy" :minDate="today" />
            </label>
            <label class="field">
              <span>{{ t('Event end') }}</span>
              <DatePicker v-model="endDate" showIcon showTime hourFormat="24" fluid dateFormat="dd M yy" :minDate="startDate" />
            </label>
            <label class="field">
              <span>{{ t('Location') }}<small>*</small></span>
              <GooglePlaceInput v-model="form.location" :placeholder="t('Venue, hotel, city, or address')" />
              <small v-if="errors.location" class="field__error">{{ t(errors.location) }}</small>
            </label>
            <label class="field">
              <span>{{ t('Guests') }}</span>
              <InputNumber v-model="form.guest_count" :min="0" fluid />
            </label>
            <label class="field">
              <span>{{ t('Budget') }}</span>
              <InputNumber v-model="form.budget" :min="0" suffix=" MGA" fluid />
            </label>
            <label class="field">
              <span>{{ t('Contact phone') }}<small>*</small></span>
              <InputText v-model="form.contact_phone" placeholder="+261..." />
              <small v-if="errors.contact_phone" class="field__error">{{ t(errors.contact_phone) }}</small>
            </label>
            <label class="field">
              <span>{{ t('Contact email') }}</span>
              <InputText v-model="form.contact_email" placeholder="name@example.com" />
            </label>
          </div>
          <p v-if="invalidEndDate" class="event-create__hint">{{ t('Event end must be after the start date.') }}</p>
        </section>

        <!-- Services -->
        <section class="panel">
          <div class="panel__head">
            <h3>{{ t('Services') }}</h3>
            <span class="panel__count">{{ selectedServiceIds.length }} {{ t('selected') }}</span>
          </div>
          <div class="services">
            <div v-if="loading" class="services__state">{{ t('Loading…') }}</div>
            <template v-else-if="categorySections.length">
              <fieldset v-for="section in categorySections" :key="section.category.id" class="service-section">
                <legend>
                  <i :class="section.category.icon || 'pi pi-calendar'" />
                  {{ section.category.name }}
                </legend>
                <label v-for="service in section.services" :key="service.id" class="service-choice">
                  <Checkbox v-model="selectedServiceIds" :inputId="`admin-event-service-${service.id}`" :value="service.id" />
                  <span>
                    <strong>{{ service.name }}</strong>
                    <small>{{ priceLabel(service) }}</small>
                  </span>
                </label>
              </fieldset>
            </template>
            <div v-else class="services__state">{{ t('No event services yet. Add some in the catalog first.') }}</div>
            <small v-if="errors.services" class="field__error">{{ t(errors.services) }}</small>
          </div>
        </section>
      </div>

      <!-- Sidebar: note + summary -->
      <aside class="event-grid__side">
        <section class="panel">
          <div class="panel__head"><h3>{{ t('Note') }}</h3></div>
          <div class="field-grid">
            <label class="field field--wide">
              <span>{{ t('Internal / client note') }}</span>
              <Textarea v-model="form.note" rows="4" autoResize />
            </label>
          </div>
        </section>

        <section class="panel summary">
          <div class="summary__row">
            <span>{{ t('Services') }}</span>
            <strong>{{ selectedServiceIds.length }}</strong>
          </div>
          <div class="summary__row summary__row--total">
            <span>{{ t('Indicative total') }}</span>
            <strong>{{ indicativeTotal ? formatMGA(indicativeTotal) : t('Quote by request') }}</strong>
          </div>
          <Button :label="t('Create request')" icon="pi pi-check" :loading="saving" :disabled="!canSubmit" @click="submit" />
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.event-create {
  display: grid;
  gap: 18px;
}

.event-create__top {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.event-create__head {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 24px;
  overflow: hidden;
  padding: clamp(24px, 4vw, 36px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background:
    radial-gradient(circle at 90% 0%, rgba(201, 146, 44, 0.34), transparent 38%),
    linear-gradient(135deg, var(--tm-charcoal), #2a2220);
  box-shadow: var(--tm-shadow);
}

.event-create__head::after {
  position: absolute;
  right: -70px;
  bottom: -150px;
  width: 280px;
  height: 280px;
  border: 1px solid rgba(206, 107, 85, 0.28);
  border-radius: 50%;
  content: '';
}

.event-create__head > div {
  position: relative;
  z-index: 1;
}

.event-create__head p,
.event-create__head h1 {
  margin: 0;
}

.event-create__head p {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.event-create__head h1 {
  max-width: 760px;
  margin-top: 7px;
  color: #fff8ed;
  font-size: clamp(2rem, 4vw, 3.35rem);
  letter-spacing: -0.045em;
  line-height: 1;
}

.event-create__head span {
  display: block;
  margin-top: 8px;
  max-width: 760px;
  color: rgba(255, 255, 255, 0.64);
  font-weight: 700;
  line-height: 1.55;
}

.event-create__head :deep(.p-button-secondary) {
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.event-create__hint {
  margin: 0 16px 16px;
  color: var(--tm-coral);
  font-size: 0.82rem;
  font-weight: 780;
}

.event-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.42fr);
  align-items: start;
}

.event-grid__main,
.event-grid__side {
  display: grid;
  gap: 18px;
}

.panel {
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background: var(--tm-surface);
  box-shadow: 0 12px 34px rgba(37, 31, 20, 0.055);
  overflow: hidden;
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--tm-border);
}

.panel__head h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.02rem;
}

.panel__count {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 820;
}

.field-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 16px;
}

.field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.field--wide {
  grid-column: 1 / -1;
}

.field span {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 820;
}

.field span small {
  color: var(--tm-coral);
}

.field__error {
  color: var(--tm-coral);
  font-size: 0.78rem;
  font-weight: 700;
}

.field :deep(.p-inputtext),
.field :deep(.p-select),
.field :deep(.p-datepicker),
.field :deep(.p-datepicker-input),
.field :deep(.p-inputnumber),
.field :deep(.p-inputnumber-input),
.field :deep(.p-textarea) {
  width: 100%;
}

.services {
  display: grid;
  gap: 14px;
  padding: 16px;
}

.services__state {
  padding: 8px 4px;
  color: var(--tm-muted);
  font-weight: 750;
}

.service-section {
  display: grid;
  gap: 9px;
  min-width: 0;
  margin: 0;
  padding: 14px;
  border: 1px solid var(--tm-border);
  border-radius: 14px;
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
  min-height: 52px;
  padding: 10px;
  border: 1px solid var(--tm-border);
  border-radius: 12px;
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

.summary {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--tm-muted);
  font-weight: 800;
}

.summary__row--total {
  padding-top: 10px;
  border-top: 1px solid var(--tm-border);
}

.summary__row--total strong {
  color: var(--tm-heading);
  font-size: 1.1rem;
  text-align: right;
}

@media (max-width: 960px) {
  .event-grid,
  .event-create__head {
    grid-template-columns: 1fr;
  }

  .event-create__top {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .field-grid {
    grid-template-columns: 1fr;
  }

  .event-create__top {
    flex-direction: column;
  }

  .event-create__top .p-button {
    width: 100%;
  }
}
</style>
