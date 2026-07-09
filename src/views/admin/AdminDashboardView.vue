<script setup>
import { computed, onMounted, ref } from 'vue';

import RevenueAreaChart from '@/components/admin/charts/RevenueAreaChart.vue';
import DonutChart from '@/components/admin/charts/DonutChart.vue';
import BarBreakdown from '@/components/admin/charts/BarBreakdown.vue';
import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { formatDate, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';

const { enumLabel, localeCode, t } = useAdminI18n();

const loading = ref(true);
const data = ref(null);

// severity → validated chart hue, so status bars stay consistent with the Tags
// used across the rest of the admin.
const SEVERITY_COLOR = {
  success: 'var(--tm-chart-2)',
  warn: 'var(--tm-chart-1)',
  danger: 'var(--tm-chart-4)',
  info: 'var(--tm-chart-3)',
  secondary: 'var(--tm-muted)',
};

// Payment method → fixed hue (color follows the entity, never its rank).
const METHOD_COLOR = {
  cash: 'var(--tm-chart-1)',
  bank_transfer: 'var(--tm-chart-2)',
  mobile_money: 'var(--tm-chart-3)',
  other: 'var(--tm-chart-4)',
};

const kpis = computed(() => data.value?.kpis || {});

const tiles = computed(() => {
  const k = kpis.value;
  return [
    {
      key: 'revenue',
      icon: 'pi pi-wallet',
      tone: 'gold',
      label: t('Revenue this month'),
      value: formatMGA(Number(k.revenue_month || 0)),
      trend: revenueTrend.value,
    },
    {
      key: 'orders',
      icon: 'pi pi-receipt',
      tone: 'blue',
      label: t('Orders'),
      value: String(k.orders_total ?? 0),
      note: Number(k.orders_unpaid) > 0 ? t('{n} unpaid', { n: k.orders_unpaid }) : t('All settled'),
      noteWarn: Number(k.orders_unpaid) > 0,
    },
    {
      key: 'bookings',
      icon: 'pi pi-calendar-clock',
      tone: 'emerald',
      label: t('Bookings'),
      value: String(k.bookings_total ?? 0),
      note: Number(k.bookings_to_confirm) > 0 ? t('{n} to confirm', { n: k.bookings_to_confirm }) : t('None waiting'),
      noteWarn: Number(k.bookings_to_confirm) > 0,
    },
    {
      key: 'healthcare',
      icon: 'pi pi-heart',
      tone: 'rose',
      label: t('Care requests'),
      value: String(k.healthcare_total ?? 0),
      note: Number(k.healthcare_to_review) > 0 ? t('{n} to review', { n: k.healthcare_to_review }) : t('All reviewed'),
      noteWarn: Number(k.healthcare_to_review) > 0,
    },
    {
      key: 'customers',
      icon: 'pi pi-users',
      tone: 'coral',
      label: t('Customers'),
      value: String(k.customers_total ?? 0),
      note: Number(k.customers_new_month) > 0 ? t('+{n} this month', { n: k.customers_new_month }) : t('No new sign-ups'),
    },
  ];
});

const revenueTrend = computed(() => {
  const now = Number(kpis.value.revenue_month || 0);
  const prev = Number(kpis.value.revenue_prev_month || 0);
  if (prev <= 0) {
    return now > 0 ? { dir: 'up', text: t('New revenue vs last month') } : { dir: 'flat', text: t('No revenue last month') };
  }
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) {
    return { dir: 'flat', text: t('Flat vs last month') };
  }
  return {
    dir: pct > 0 ? 'up' : 'down',
    text: t('{pct}% vs last month', { pct: `${pct > 0 ? '+' : ''}${pct}` }),
  };
});

const revenueAllTime = computed(() => formatMGA(Number(kpis.value.revenue_total || 0)));

const paymentSegments = computed(() =>
  (data.value?.payment_methods || []).map((row) => ({
    label: enumLabel(row.method),
    value: Number(row.amount || 0),
    color: METHOD_COLOR[row.method] || 'var(--tm-chart-3)',
  })),
);

const paymentTotal = computed(() =>
  formatMGA(paymentSegments.value.reduce((sum, seg) => sum + seg.value, 0)),
);

const orderStatusBars = computed(() => statusBars(data.value?.orders_by_status));
const bookingStatusBars = computed(() => statusBars(data.value?.bookings_by_status));
const healthcareStatusBars = computed(() => statusBars(data.value?.healthcare_by_status));

function statusBars(list) {
  return (list || []).map((row) => ({
    label: enumLabel(row.status),
    value: row.count,
    color: SEVERITY_COLOR[statusSeverity(row.status)] || 'var(--tm-chart-3)',
  }));
}

const unpaidOrders = computed(() => data.value?.attention?.unpaid_orders || []);
const bookingsToConfirm = computed(() => data.value?.attention?.bookings_to_confirm || []);
const healthcareToReview = computed(() => data.value?.attention?.healthcare_to_review || []);

const fleetNote = computed(() => {
  const k = kpis.value;
  if (!k.cars_total) {
    return '';
  }
  return t('{available} of {total} cars available', { available: k.cars_available ?? 0, total: k.cars_total });
});

async function load() {
  loading.value = true;
  try {
    const res = await api.get('/admin/dashboard');
    data.value = res?.dashboard || null;
  } catch {
    data.value = null;
  } finally {
    loading.value = false;
  }
}

function shortDate(value) {
  return formatDate(value, localeCode.value);
}

onMounted(load);
</script>

<template>
  <section class="dashboard">
    <header class="dashboard__head">
      <div>
        <p>{{ t('Overview') }}</p>
        <h1>{{ t('Dashboard') }}</h1>
      </div>
      <Button icon="pi pi-refresh" :label="t('Refresh')" severity="secondary" outlined :loading="loading" @click="load" />
    </header>

    <div class="tile-grid">
      <article v-for="tile in tiles" :key="tile.key" class="tile" :class="`tile--${tile.tone}`">
        <span class="tile__icon"><i :class="tile.icon" /></span>
        <span class="tile__label">{{ tile.label }}</span>
        <strong class="tile__value">{{ tile.value }}</strong>
        <p v-if="tile.trend" class="tile__trend" :class="`tile__trend--${tile.trend.dir}`">
          <i v-if="tile.trend.dir !== 'flat'" :class="tile.trend.dir === 'up' ? 'pi pi-arrow-up-right' : 'pi pi-arrow-down-right'" />
          {{ tile.trend.text }}
        </p>
        <p v-else class="tile__note" :class="{ 'tile__note--warn': tile.noteWarn }">{{ tile.note }}</p>
      </article>
    </div>

    <div class="panel-grid panel-grid--primary">
      <section class="panel">
        <div class="panel__head">
          <div>
            <p>{{ t('Confirmed revenue') }}</p>
            <h2>{{ t('Last 30 days') }}</h2>
          </div>
          <div class="panel__legend">
            <span><i class="dot" :style="{ background: 'var(--tm-chart-1)' }" /> {{ t('Orders') }}</span>
            <span><i class="dot" :style="{ background: 'var(--tm-chart-2)' }" /> {{ t('Bookings') }}</span>
          </div>
        </div>
        <RevenueAreaChart :series="data?.revenue_series || []" />
        <p class="panel__foot">{{ t('All-time confirmed revenue') }}: <strong>{{ revenueAllTime }}</strong></p>
      </section>

      <section class="panel">
        <div class="panel__head">
          <div>
            <p>{{ t('Payment mix') }}</p>
            <h2>{{ t('Paid, by method') }}</h2>
          </div>
        </div>
        <DonutChart
          :segments="paymentSegments"
          :center-label="t('Total paid')"
          :center-value="paymentTotal"
          :format-value="(v) => formatMGA(v)"
        />
        <p v-if="!paymentSegments.length" class="panel__empty">{{ t('No confirmed payments yet.') }}</p>
      </section>
    </div>

    <div class="panel-grid panel-grid--split">
      <section class="panel">
        <div class="panel__head">
          <div>
            <p>{{ t('Pipeline') }}</p>
            <h2>{{ t('Orders by status') }}</h2>
          </div>
        </div>
        <BarBreakdown :items="orderStatusBars">
          <template #empty>{{ t('No orders yet.') }}</template>
        </BarBreakdown>
      </section>

      <section class="panel">
        <div class="panel__head">
          <div>
            <p>{{ t('Fleet') }}</p>
            <h2>{{ t('Bookings by status') }}</h2>
          </div>
          <span v-if="fleetNote" class="panel__pill">{{ fleetNote }}</span>
        </div>
        <BarBreakdown :items="bookingStatusBars">
          <template #empty>{{ t('No bookings yet.') }}</template>
        </BarBreakdown>
      </section>
    </div>

    <div class="panel-grid panel-grid--split">
      <section class="panel">
        <div class="panel__head">
          <div>
            <p>{{ t('Needs attention') }}</p>
            <h2>{{ t('Unpaid orders') }}</h2>
          </div>
          <Button as="router-link" to="/admin/orders" :label="t('View all')" icon="pi pi-arrow-up-right" text />
        </div>
        <ul class="queue">
          <li v-for="item in unpaidOrders" :key="item.number">
            <div>
              <strong>{{ item.number }}</strong>
              <span>{{ shortDate(item.created_at) }}</span>
            </div>
            <span class="queue__amount">{{ formatMGA(Number(item.total || 0)) }}</span>
            <Tag :value="enumLabel(item.status)" severity="warn" />
          </li>
          <li v-if="!unpaidOrders.length" class="queue__empty">{{ t('Nothing unpaid.') }}</li>
        </ul>
      </section>

      <section class="panel">
        <div class="panel__head">
          <div>
            <p>{{ t('Needs attention') }}</p>
            <h2>{{ t('Bookings to confirm') }}</h2>
          </div>
          <Button as="router-link" to="/admin/bookings" :label="t('View all')" icon="pi pi-arrow-up-right" text />
        </div>
        <ul class="queue">
          <li v-for="item in bookingsToConfirm" :key="item.number">
            <div>
              <strong>{{ item.number }}</strong>
              <span>{{ item.label || t('Car') }}</span>
            </div>
            <span class="queue__amount">{{ shortDate(item.created_at) }}</span>
            <Tag :value="t('Assign driver')" severity="success" />
          </li>
          <li v-if="!bookingsToConfirm.length" class="queue__empty">{{ t('All bookings handled.') }}</li>
        </ul>
      </section>
    </div>

    <div class="panel-grid panel-grid--split">
      <section class="panel">
        <div class="panel__head">
          <div>
            <p>{{ t('Healthcare') }}</p>
            <h2>{{ t('Requests by status') }}</h2>
          </div>
          <Button as="router-link" to="/admin/healthcare/requests" :label="t('View all')" icon="pi pi-arrow-up-right" text />
        </div>
        <BarBreakdown :items="healthcareStatusBars">
          <template #empty>{{ t('No care requests yet.') }}</template>
        </BarBreakdown>
      </section>

      <section class="panel">
        <div class="panel__head">
          <div>
            <p>{{ t('Needs attention') }}</p>
            <h2>{{ t('Requests to review') }}</h2>
          </div>
          <Button as="router-link" to="/admin/healthcare/requests" :label="t('View all')" icon="pi pi-arrow-up-right" text />
        </div>
        <ul class="queue">
          <li v-for="item in healthcareToReview" :key="item.number">
            <div>
              <strong>{{ item.number }}</strong>
              <span>{{ enumLabel(item.label) }}</span>
            </div>
            <span class="queue__amount">{{ shortDate(item.created_at) }}</span>
            <Tag :value="enumLabel(item.status)" severity="warn" />
          </li>
          <li v-if="!healthcareToReview.length" class="queue__empty">{{ t('No requests waiting.') }}</li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 20px;
}

.dashboard__head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 16px;
}

.dashboard__head p,
.dashboard__head h1 {
  margin: 0;
}

.dashboard__head p {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dashboard__head h1 {
  margin-top: 5px;
  color: var(--tm-heading);
  font-size: clamp(1.7rem, 3vw, 2.4rem);
}

/* --- KPI tiles --- */
.tile-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
}

.tile {
  position: relative;
  display: grid;
  gap: 6px;
  padding: 18px;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.tile::before {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
}

.tile--gold::before { background: var(--tm-chart-1); }
.tile--emerald::before { background: var(--tm-chart-2); }
.tile--blue::before { background: var(--tm-chart-3); }
.tile--coral::before { background: var(--tm-chart-4); }
.tile--rose::before { background: #c05a7d; }

.tile__icon {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.tile--gold .tile__icon i { color: var(--tm-chart-1); }
.tile--emerald .tile__icon i { color: var(--tm-chart-2); }
.tile--blue .tile__icon i { color: var(--tm-chart-3); }
.tile--coral .tile__icon i { color: var(--tm-chart-4); }
.tile--rose .tile__icon i { color: #c05a7d; }

.tile__label {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 820;
}

.tile__value {
  color: var(--tm-heading);
  font-size: clamp(1.5rem, 2.4vw, 2rem);
  line-height: 1;
}

.tile__trend,
.tile__note {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  font-size: 0.82rem;
  font-weight: 800;
}

.tile__trend {
  color: var(--tm-muted);
}

.tile__trend--up { color: var(--tm-emerald); }
.tile__trend--down { color: var(--tm-coral); }

.tile__note {
  color: var(--tm-muted);
}

.tile__note--warn {
  color: var(--tm-gold);
}

/* --- panels --- */
.panel-grid {
  display: grid;
  gap: 18px;
}

.panel-grid--primary {
  grid-template-columns: minmax(0, 1.55fr) minmax(300px, 1fr);
}

.panel-grid--split {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel {
  display: grid;
  gap: 16px;
  align-content: start;
  padding: 20px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.panel__head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.panel__head p,
.panel__head h2 {
  margin: 0;
}

.panel__head p {
  color: var(--tm-gold);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.panel__head h2 {
  margin-top: 4px;
  color: var(--tm-heading);
  font-size: 1.1rem;
}

.panel__legend {
  display: flex;
  gap: 14px;
}

.panel__legend span {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 750;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}

.panel__foot {
  margin: 0;
  padding-top: 4px;
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 700;
}

.panel__foot strong {
  color: var(--tm-heading);
}

.panel__pill {
  padding: 5px 10px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  background: var(--tm-surface-soft);
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 800;
  white-space: nowrap;
}

.panel__empty {
  margin: 0;
  color: var(--tm-muted);
  font-weight: 700;
}

/* --- attention queues --- */
.queue {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.queue li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-top: 1px solid var(--tm-border);
}

.queue li:first-child {
  border-top: 0;
}

.queue li div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.queue li strong {
  color: var(--tm-heading);
  font-size: 0.92rem;
}

.queue li span {
  color: var(--tm-muted);
  font-size: 0.82rem;
}

.queue__amount {
  color: var(--tm-heading);
  font-weight: 850;
}

.queue__empty {
  display: block;
  padding: 14px 0 2px;
  color: var(--tm-muted);
  font-weight: 700;
}

@media (max-width: 1120px) {
  .tile-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .panel-grid--primary,
  .panel-grid--split {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .tile-grid {
    grid-template-columns: 1fr;
  }
}
</style>
