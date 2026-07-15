<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getMyBooking } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = usePublicI18n();

const booking = ref(null);
const loading = ref(false);
const error = ref('');

const isCargo = computed(() => booking.value?.pricing_model === 'cargo_distance');

const facts = computed(() => {
  const b = booking.value;
  if (!b) {
    return [];
  }
  const rows = [
    { label: 'Car', value: b.car_name },
    { label: 'Category', value: b.car_category || '-' },
    { label: 'From', value: formatDate(b.start_at) },
    { label: 'To', value: formatDate(b.end_at) },
    { label: 'Pickup', value: b.pickup_location },
  ];
  if (b.dropoff_location) {
    rows.push({ label: 'Dropoff', value: b.dropoff_location });
  }
  if (isCargo.value) {
    rows.push({ label: 'Distance', value: `${Number(b.distance_km || 0)} km` });
  } else {
    rows.push({
      label: t('Travel area'),
      value: b.outside_antananarivo ? t('Outside Antananarivo region') : t('Within Antananarivo region'),
    });
    rows.push({ label: 'Rate', value: t('{amount} × {days} days', { amount: formatMGA(Number(b.daily_rate_snapshot || 0)), days: b.days }) });
  }
  rows.push({ label: 'Contact', value: b.contact_phone });
  return rows;
});

const nextSteps = [
  {
    icon: 'pi pi-user',
    title: 'A driver gets assigned',
    text: 'Our team assigns a driver to your booking before the start date. The car is already held for you.',
  },
  {
    icon: 'pi pi-wallet',
    title: 'Confirm payment with the team',
    text: 'Settle by cash, bank transfer, or mobile money. Our team records the payment against your booking.',
  },
  {
    icon: 'pi pi-calendar',
    title: 'Need to change plans?',
    text: 'You can cancel from your bookings page while the booking is still confirmed.',
  },
];

function titleize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

async function load() {
  if (!auth.isAuthenticated) {
    router.replace({ name: 'account', query: { redirect: route.fullPath } });
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    booking.value = await getMyBooking(route.params.id);
  } catch (err) {
    booking.value = null;
    error.value = err?.message || t('Could not load booking');
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
        <span>{{ t('Loading booking...') }}</span>
      </div>

      <div v-else-if="error" class="confirm-state confirm-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button
          as="router-link"
          :to="{ name: 'orders', query: { tab: 'bookings' } }"
          :label="t('Go to my bookings')"
          icon="pi pi-calendar-clock"
          severity="secondary"
          outlined
        />
      </div>

      <template v-else-if="booking">
        <header class="confirm-hero">
          <span class="confirm-hero__badge"><i class="pi pi-check" /></span>
          <p class="eyebrow">{{ t('Booking confirmed') }}</p>
          <h1>{{ t('The car is yours for those dates.') }}</h1>
          <p class="confirm-hero__number">
            {{ t('Booking') }} <strong>{{ booking.booking_number }}</strong>
          </p>
          <div class="confirm-hero__tags">
            <Tag :value="t(titleize(booking.status))" :severity="statusSeverity(booking.status)" />
            <Tag :value="t(titleize(booking.payment_status))" :severity="statusSeverity(booking.payment_status)" />
            <Tag :value="isCargo ? t('Cargo transport') : t('Driver included')" severity="info" />
          </div>
        </header>

        <div class="confirm-grid">
          <section class="confirm-card soft-panel">
            <h2>{{ t('Booking details') }}</h2>
            <dl class="confirm-facts">
              <div v-for="fact in facts" :key="fact.label">
                <dt>{{ t(fact.label) }}</dt>
                <dd>{{ fact.value }}</dd>
              </div>
            </dl>
            <div class="confirm-totals">
              <div class="confirm-totals__grand">
                <span>{{ t('Total') }}</span>
                <strong>{{ formatMGA(Number(booking.total_price || 0)) }}</strong>
              </div>
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
        </div>

        <div class="confirm-actions">
          <Button as="router-link" :to="{ name: 'orders', query: { tab: 'bookings' } }" :label="t('View my bookings')" icon="pi pi-calendar-clock" />
          <Button as="router-link" to="/cars" :label="t('Browse more cars')" icon="pi pi-car" severity="secondary" outlined />
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

<style scoped>
.confirm-page { padding: 28px 0 84px; }
.confirm-page__inner { gap: 22px; }
.confirm-hero { position: relative; overflow: hidden; padding: clamp(26px, 5vw, 48px); border-radius: 28px; background: radial-gradient(circle at 88% 0%, rgba(12,155,128,.27), transparent 34%), linear-gradient(135deg, var(--tm-charcoal), #17282a); box-shadow: var(--tm-shadow); }
.confirm-hero::after { position: absolute; right: -80px; bottom: -170px; width: 330px; height: 330px; border: 1px solid rgba(201,146,44,.24); border-radius: 50%; content: ''; }
.confirm-hero > * { position: relative; z-index: 1; }
.confirm-hero__badge { background: var(--tm-emerald); color: #fff; box-shadow: 0 9px 24px rgba(12,155,128,.25); }
.confirm-hero h1 { max-width: 760px; color: #fff8ed; font-size: clamp(2.5rem, 5.5vw, 5rem); letter-spacing: -.055em; }
.confirm-hero__number { color: rgba(255,255,255,.62); }
.confirm-hero__number strong { color: #fff; }
.confirm-hero__tags :deep(.p-tag) { border: 1px solid rgba(255,255,255,.13); }
.confirm-grid { gap: 18px; }
.confirm-card { padding: 22px; border-radius: 20px; box-shadow: 0 14px 38px rgba(20,29,31,.07); }
.confirm-card h2 { font-size: 1.3rem; letter-spacing: -.025em; }
.confirm-facts > div { padding: 10px 0; }
.confirm-totals { border-radius: 14px; }
.confirm-totals__grand strong { font-size: 1.7rem; }
.confirm-steps li { padding: 13px 0; }
.confirm-steps li > i { display: grid; width: 40px; height: 40px; flex: 0 0 auto; border-radius: 12px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.confirm-actions { padding: 15px; border: 1px solid var(--tm-border); border-radius: 16px; background: var(--tm-surface); }
@media (max-width: 760px) { .confirm-hero { border-radius: 22px; } .confirm-grid { grid-template-columns: 1fr; } .confirm-actions { align-items: stretch; flex-direction: column; } .confirm-actions :deep(.p-button) { width: 100%; } }
</style>
