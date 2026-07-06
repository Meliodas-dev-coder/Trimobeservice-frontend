<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getMyEventRequest } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = usePublicI18n();

const request = ref(null);
const loading = ref(false);
const error = ref('');

const services = computed(() => request.value?.services || []);
const requestArtists = computed(() => request.value?.artists || []);
const facts = computed(() => {
  const eventRequest = request.value;
  if (!eventRequest) {
    return [];
  }
  const rows = [
    { label: 'Event type', value: t(titleize(eventRequest.event_type)) },
    { label: 'Start', value: formatDateTime(eventRequest.event_start) },
    { label: 'Location', value: eventRequest.location },
    { label: 'Contact', value: eventRequest.contact_phone },
  ];
  if (eventRequest.event_end) {
    rows.splice(2, 0, { label: 'End', value: formatDateTime(eventRequest.event_end) });
  }
  if (eventRequest.guest_count !== null && eventRequest.guest_count !== undefined) {
    rows.push({ label: 'Guests', value: eventRequest.guest_count });
  }
  if (eventRequest.contact_email) {
    rows.push({ label: 'Email', value: eventRequest.contact_email });
  }
  if (eventRequest.budget) {
    rows.push({ label: 'Budget', value: formatMGA(Number(eventRequest.budget || 0)) });
  }
  return rows;
});

const quoteLabel = computed(() => {
  if (!request.value?.quoted_price) {
    return t('Our team will send a quote.');
  }
  return formatMGA(Number(request.value.quoted_price || 0));
});

const nextSteps = [
  {
    icon: 'pi pi-search',
    title: 'The team reviews your request',
    text: 'We check the selected services, event timing, venue needs, and availability.',
  },
  {
    icon: 'pi pi-tag',
    title: 'You receive a quote',
    text: 'An admin adds the final quoted price and any internal planning notes.',
  },
  {
    icon: 'pi pi-wallet',
    title: 'Confirm payment with the team',
    text: 'After the quote, settle by cash, bank transfer, or mobile money. Our team records the payment against your event request.',
  },
  {
    icon: 'pi pi-calendar-plus',
    title: 'We plan the event',
    text: 'Once confirmed, the request moves through planning, event day, and completion.',
  },
];

function titleize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

async function load() {
  await auth.ensureReady();
  if (!auth.isAuthenticated) {
    router.replace({ name: 'account', query: { redirect: route.fullPath } });
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    request.value = await getMyEventRequest(route.params.id);
  } catch (err) {
    request.value = null;
    error.value = err?.message || t('Could not load event request');
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.params.id,
  () => load(),
);

onMounted(load);
</script>

<template>
  <section class="confirm-page">
    <div class="app-container confirm-page__inner">
      <div v-if="loading" class="confirm-state">
        <i class="pi pi-spin pi-spinner" />
        <span>{{ t('Loading request...') }}</span>
      </div>

      <div v-else-if="error" class="confirm-state confirm-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button
          as="router-link"
          :to="{ name: 'orders', query: { tab: 'events' } }"
          :label="t('Go to my requests')"
          icon="pi pi-calendar"
          severity="secondary"
          outlined
        />
      </div>

      <template v-else-if="request">
        <header class="confirm-hero">
          <span class="confirm-hero__badge"><i class="pi pi-check" /></span>
          <p class="eyebrow">{{ t('Request received') }}</p>
          <h1>{{ t('Your event request is with the team.') }}</h1>
          <p class="confirm-hero__number">
            {{ t('Request') }} <strong>{{ request.request_number }}</strong>
          </p>
          <div class="confirm-hero__tags">
            <Tag :value="t(titleize(request.status))" :severity="statusSeverity(request.status)" />
            <Tag :value="t(titleize(request.payment_status))" :severity="statusSeverity(request.payment_status)" />
            <Tag :value="t(titleize(request.event_type))" severity="info" />
          </div>
        </header>

        <div class="confirm-grid">
          <section class="confirm-card soft-panel">
            <h2>{{ t('Event details') }}</h2>
            <dl class="confirm-facts">
              <div v-for="fact in facts" :key="fact.label">
                <dt>{{ t(fact.label) }}</dt>
                <dd>{{ fact.value }}</dd>
              </div>
            </dl>
            <div class="confirm-totals">
              <div class="confirm-totals__grand">
                <span>{{ t('Quote') }}</span>
                <strong>{{ quoteLabel }}</strong>
              </div>
            </div>
          </section>

          <section class="confirm-card soft-panel">
            <h2>{{ t('Requested services') }}</h2>
            <div v-if="services.length" class="service-list">
              <article v-for="service in services" :key="service.id">
                <span>{{ service.category_name || t('Service') }}</span>
                <strong>{{ service.service_name }}</strong>
                <small>
                  {{ t('Qty') }} {{ service.quantity || 1 }}
                  <template v-if="service.from_price_snapshot">
                    - {{ t('From') }} {{ formatMGA(Number(service.from_price_snapshot || 0)) }}
                  </template>
                </small>
              </article>
            </div>
            <p v-else class="service-empty">{{ t('No services attached to this request.') }}</p>
          </section>
        </div>

        <section v-if="requestArtists.length" class="confirm-card soft-panel">
          <h2>{{ t('Requested artists') }}</h2>
          <div class="service-list">
            <article v-for="artist in requestArtists" :key="artist.id">
              <span>{{ t('Gospel artist') }}</span>
              <strong>{{ artist.artist_name }}</strong>
              <small v-if="artist.fee_snapshot">{{ t('From') }} {{ formatMGA(Number(artist.fee_snapshot || 0)) }}</small>
            </article>
          </div>
        </section>

        <section class="confirm-card soft-panel">
          <h2>{{ t('What happens next') }}</h2>
          <ol class="confirm-steps">
            <li v-for="(step, index) in nextSteps" :key="index">
              <i :class="step.icon" />
              <div>
                  <strong>{{ t(step.title) }}</strong>
                  <p>{{ t(step.text) }}</p>
              </div>
            </li>
          </ol>
        </section>

        <div class="confirm-actions">
          <Button as="router-link" :to="{ name: 'orders', query: { tab: 'events' } }" :label="t('View my requests')" icon="pi pi-calendar" />
          <Button as="router-link" to="/events" :label="t('Browse event services')" icon="pi pi-list" severity="secondary" outlined />
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.confirm-page {
  padding: 48px 0 72px;
}

.confirm-page__inner {
  display: grid;
  gap: 24px;
}

.confirm-state {
  display: grid;
  min-height: 320px;
  place-items: center;
  gap: 12px;
  color: var(--tm-muted);
  font-weight: 850;
}

.confirm-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.confirm-state--error i {
  color: var(--tm-coral);
}

.confirm-hero {
  display: grid;
  gap: 8px;
  justify-items: start;
}

.confirm-hero__badge {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  margin-bottom: 6px;
  border-radius: 999px;
  background: rgba(8, 124, 104, 0.12);
  color: var(--tm-emerald);
  font-size: 1.5rem;
}

.confirm-hero h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2rem, 5vw, 3.6rem);
  line-height: 1;
}

.confirm-hero__number {
  margin: 0;
  color: var(--tm-muted);
  font-weight: 780;
}

.confirm-hero__number strong {
  color: var(--tm-heading);
}

.confirm-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.confirm-grid {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.confirm-card {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.confirm-card h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.15rem;
}

.confirm-facts {
  display: grid;
  gap: 10px;
  margin: 0;
}

.confirm-facts > div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--tm-border);
}

.confirm-facts dt {
  color: var(--tm-muted);
  font-size: 0.85rem;
  font-weight: 850;
}

.confirm-facts dd {
  margin: 0;
  color: var(--tm-heading);
  font-weight: 780;
  text-align: right;
}

.confirm-totals {
  display: grid;
  gap: 8px;
}

.confirm-totals__grand {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 1.08rem;
}

.confirm-totals span {
  color: var(--tm-muted);
  font-weight: 800;
}

.confirm-totals strong {
  color: var(--tm-heading);
  text-align: right;
}

.service-list {
  display: grid;
  gap: 10px;
}

.service-list article {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.service-list span {
  color: var(--tm-gold);
  font-size: 0.76rem;
  font-weight: 900;
  text-transform: uppercase;
}

.service-list strong {
  color: var(--tm-heading);
}

.service-list small,
.service-empty {
  margin: 0;
  color: var(--tm-muted);
  font-weight: 760;
}

.confirm-steps {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.confirm-steps li {
  display: grid;
  align-items: start;
  gap: 12px;
  grid-template-columns: auto 1fr;
}

.confirm-steps i {
  margin-top: 3px;
  color: var(--tm-gold);
  font-size: 1.15rem;
}

.confirm-steps strong {
  color: var(--tm-heading);
}

.confirm-steps p {
  margin: 3px 0 0;
  color: var(--tm-muted);
  font-size: 0.92rem;
  line-height: 1.6;
}

.confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 880px) {
  .confirm-grid {
    grid-template-columns: 1fr;
  }
}
</style>
