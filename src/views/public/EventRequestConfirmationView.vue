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
  return rows;
});

const indicativeTotal = computed(() => (
  services.value.reduce((sum, service) => sum + (Number(service.from_price_snapshot || 0) * Number(service.quantity || 1)), 0)
  + requestArtists.value.reduce((sum, artist) => sum + Number(artist.fee_snapshot || 0), 0)
));
const budgetComparison = computed(() => {
  const budget = Number(request.value?.budget || 0);
  if (!budget || !indicativeTotal.value) return null;
  const difference = budget - indicativeTotal.value;
  return { within: difference >= 0, amount: Math.abs(difference) };
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
          <div class="confirm-hero__actions">
            <Button as="router-link" :to="{ name: 'orders', query: { tab: 'events' } }" :label="t('Track this request')" icon="pi pi-arrow-right" iconPos="right" />
            <Button as="router-link" to="/events" :label="t('Back to events')" severity="secondary" outlined />
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
              <div>
                <span>{{ t('Starting estimate') }}</span>
                <strong>{{ indicativeTotal ? formatMGA(indicativeTotal) : t('Quote by request') }}</strong>
              </div>
              <div>
                <span>{{ t('Client budget') }}</span>
                <strong>{{ request.budget ? formatMGA(Number(request.budget)) : '—' }}</strong>
              </div>
              <div class="confirm-totals__grand">
                <span>{{ t('Quote') }}</span>
                <strong>{{ quoteLabel }}</strong>
              </div>
              <p v-if="budgetComparison" :class="budgetComparison.within ? 'is-within' : 'is-over'">
                <i :class="budgetComparison.within ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'" />
                {{ budgetComparison.within ? t('{amount} below your budget', { amount: formatMGA(budgetComparison.amount) }) : t('{amount} above your budget', { amount: formatMGA(budgetComparison.amount) }) }}
              </p>
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
  padding: 22px 0 78px;
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
  position: relative;
  display: grid;
  gap: 8px;
  justify-items: start;
  overflow: hidden;
  padding: clamp(28px, 5vw, 52px);
  border-radius: 26px;
  background:
    radial-gradient(circle at 88% 0%, rgba(201, 146, 44, 0.26), transparent 36%),
    linear-gradient(135deg, #11191b, #292123);
  box-shadow: var(--tm-shadow);
}

.confirm-hero::after {
  position: absolute;
  right: -90px;
  bottom: -190px;
  width: 330px;
  height: 330px;
  border: 1px solid rgba(206, 107, 85, 0.25);
  border-radius: 50%;
  content: '';
}

.confirm-hero__badge {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  margin-bottom: 6px;
  border-radius: 999px;
  z-index: 1;
  background: var(--tm-gold);
  color: var(--tm-charcoal);
  font-size: 1.5rem;
}

.confirm-hero h1 {
  position: relative;
  z-index: 1;
  max-width: 820px;
  margin: 0;
  color: #fff8ed;
  font-size: clamp(2.5rem, 5.8vw, 5rem);
  letter-spacing: -0.052em;
  line-height: 0.96;
}

.confirm-hero .eyebrow { position: relative; z-index: 1; color: var(--tm-gold); }

.confirm-hero__number {
  margin: 0;
  position: relative;
  z-index: 1;
  color: rgba(255, 255, 255, 0.64);
  font-weight: 780;
}

.confirm-hero__number strong {
  color: #fff;
}

.confirm-hero__tags {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.confirm-hero__actions {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-top: 14px;
}

.confirm-hero__actions :deep(.p-button-secondary) {
  border-color: rgba(255, 255, 255, 0.22);
  color: #fff;
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
  padding: 22px;
  border-radius: 20px;
  box-shadow: 0 12px 34px rgba(37, 31, 20, 0.055);
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
  gap: 10px;
  padding: 14px;
  border-radius: 14px;
  background: var(--tm-charcoal);
}

.confirm-totals > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.confirm-totals__grand {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 1.08rem;
  padding-top: 10px;
  border-top: 1px solid rgba(255, 255, 255, 0.13);
}

.confirm-totals span {
  color: rgba(255, 255, 255, 0.58);
  font-weight: 800;
}

.confirm-totals strong {
  color: #fff;
  text-align: right;
}

.confirm-totals p {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  font-size: 0.76rem;
  font-weight: 820;
}

.confirm-totals p.is-within { color: #6ee7c8; }
.confirm-totals p.is-over { color: #f3a18e; }

.service-list {
  display: grid;
  gap: 10px;
}

.service-list article {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--tm-border);
  border-radius: 14px;
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

.confirm-steps li > i {
  display: grid;
  width: 38px;
  height: 38px;
  margin-top: 0;
  border-radius: 12px;
  background: var(--tm-charcoal);
  place-items: center;
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

@media (max-width: 560px) {
  .confirm-hero__actions,
  .confirm-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .confirm-hero__actions :deep(.p-button),
  .confirm-actions :deep(.p-button) {
    width: 100%;
  }
}
</style>
