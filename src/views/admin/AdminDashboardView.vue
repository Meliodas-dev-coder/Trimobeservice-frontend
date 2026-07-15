<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import BarBreakdown from '@/components/admin/charts/BarBreakdown.vue';
import DonutChart from '@/components/admin/charts/DonutChart.vue';
import RevenueAreaChart from '@/components/admin/charts/RevenueAreaChart.vue';
import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { useNotificationsStore } from '@/stores/notifications';
import { formatDate, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';

const { enumLabel, localeCode, t } = useAdminI18n();

const loading = ref(true);
const data = ref(null);
const error = ref('');
const attentionFilter = ref('all');

const SEVERITY_COLOR = {
  success: 'var(--tm-chart-2)',
  warn: 'var(--tm-chart-1)',
  danger: 'var(--tm-chart-4)',
  info: 'var(--tm-chart-3)',
  secondary: 'var(--tm-muted)',
};

const METHOD_COLOR = {
  cash: 'var(--tm-chart-1)',
  bank_transfer: 'var(--tm-chart-2)',
  mobile_money: 'var(--tm-chart-3)',
  other: 'var(--tm-chart-4)',
};

const kpis = computed(() => data.value?.kpis || {});
const todayLabel = computed(() =>
  new Intl.DateTimeFormat(localeCode.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date()),
);

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

const tiles = computed(() => {
  const k = kpis.value;
  return [
    {
      key: 'revenue',
      icon: 'pi pi-wallet',
      tone: 'gold',
      label: t('Revenue this month'),
      value: formatMGA(Number(k.revenue_month || 0)),
      note: revenueTrend.value.text,
      trend: revenueTrend.value.dir,
      to: '/admin/payments',
    },
    {
      key: 'orders',
      icon: 'pi pi-receipt',
      tone: 'coral',
      label: t('Unpaid orders'),
      value: String(k.orders_unpaid ?? 0),
      note: t('{n} orders in total', { n: k.orders_total ?? 0 }),
      needsAction: Number(k.orders_unpaid) > 0,
      to: '/admin/orders',
    },
    {
      key: 'bookings',
      icon: 'pi pi-calendar-clock',
      tone: 'blue',
      label: t('Bookings to confirm'),
      value: String(k.bookings_to_confirm ?? 0),
      note: t('{n} bookings in total', { n: k.bookings_total ?? 0 }),
      needsAction: Number(k.bookings_to_confirm) > 0,
      to: '/admin/bookings',
    },
    {
      key: 'events',
      icon: 'pi pi-sparkles',
      tone: 'violet',
      label: t('Event requests to review'),
      value: String(k.events_to_review ?? 0),
      note: t('{n} event requests in total', { n: k.event_requests_total ?? 0 }),
      needsAction: Number(k.events_to_review) > 0,
      to: '/admin/event-requests',
    },
    {
      key: 'healthcare',
      icon: 'pi pi-heart',
      tone: 'rose',
      label: t('Care requests to review'),
      value: String(k.healthcare_to_review ?? 0),
      note: t('{n} care requests in total', { n: k.healthcare_total ?? 0 }),
      needsAction: Number(k.healthcare_to_review) > 0,
      to: '/admin/healthcare/requests',
    },
    {
      key: 'customers',
      icon: 'pi pi-users',
      tone: 'emerald',
      label: t('New customers'),
      value: String(k.customers_new_month ?? 0),
      note: t('{n} registered customers', { n: k.customers_total ?? 0 }),
      to: '/admin/customers',
    },
  ];
});

const serviceMetrics = computed(() => {
  const k = kpis.value;
  return [
    { label: t('Active products'), value: String(k.products_active ?? 0), icon: 'pi pi-box', to: '/admin/tech/products' },
    { label: t('Cars available'), value: `${k.cars_available ?? 0}/${k.cars_total ?? 0}`, icon: 'pi pi-car', to: '/admin/cars' },
    { label: t('Total event requests'), value: String(k.event_requests_total ?? 0), icon: 'pi pi-calendar-plus', to: '/admin/event-requests' },
    { label: t('Total care requests'), value: String(k.healthcare_total ?? 0), icon: 'pi pi-heart', to: '/admin/healthcare/requests' },
  ];
});

const revenueAllTime = computed(() => formatMGA(Number(kpis.value.revenue_total || 0)));
const paymentSegments = computed(() =>
  (data.value?.payment_methods || []).map((row) => ({
    label: enumLabel(row.method),
    value: Number(row.amount || 0),
    color: METHOD_COLOR[row.method] || 'var(--tm-chart-3)',
  })),
);
const paymentTotal = computed(() => formatMGA(paymentSegments.value.reduce((sum, segment) => sum + segment.value, 0)));

function statusBars(list) {
  return (list || []).map((row) => ({
    label: enumLabel(row.status),
    value: row.count,
    color: SEVERITY_COLOR[statusSeverity(row.status)] || 'var(--tm-chart-3)',
  }));
}

const pipelines = computed(() => [
  { key: 'orders', eyebrow: t('Commerce'), title: t('Orders'), to: '/admin/orders', items: statusBars(data.value?.orders_by_status) },
  { key: 'bookings', eyebrow: t('Mobility'), title: t('Bookings'), to: '/admin/bookings', items: statusBars(data.value?.bookings_by_status) },
  { key: 'events', eyebrow: t('Events'), title: t('Event requests'), to: '/admin/event-requests', items: statusBars(data.value?.events_by_status) },
  { key: 'care', eyebrow: t('Healthcare'), title: t('Care requests'), to: '/admin/healthcare/requests', items: statusBars(data.value?.healthcare_by_status) },
]);

const attentionItems = computed(() => {
  const attention = data.value?.attention || {};
  const items = [
    ...(attention.unpaid_orders || []).map((item) => ({
      ...item,
      type: 'commerce',
      tone: 'gold',
      icon: 'pi pi-wallet',
      title: item.number,
      detail: t('Payment needs confirmation'),
      meta: formatMGA(Number(item.total || 0)),
      action: t('Review payment'),
      to: '/admin/orders',
    })),
    ...(attention.bookings_to_confirm || []).map((item) => ({
      ...item,
      type: 'mobility',
      tone: 'blue',
      icon: 'pi pi-car',
      title: item.number,
      detail: item.label || t('Car booking'),
      meta: t('Driver required'),
      action: t('Assign driver'),
      to: '/admin/bookings',
    })),
    ...(attention.events_to_review || []).map((item) => ({
      ...item,
      type: 'events',
      tone: 'violet',
      icon: 'pi pi-sparkles',
      title: item.number,
      detail: enumLabel(item.label || 'event'),
      meta: enumLabel(item.status),
      action: t('Review request'),
      to: '/admin/event-requests',
    })),
    ...(attention.healthcare_to_review || []).map((item) => ({
      ...item,
      type: 'healthcare',
      tone: 'rose',
      icon: 'pi pi-heart',
      title: item.number,
      detail: enumLabel(item.label || 'care'),
      meta: enumLabel(item.status),
      action: t('Review request'),
      to: '/admin/healthcare/requests',
    })),
  ];
  return items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
});

const attentionFilters = computed(() => [
  { key: 'all', label: t('All work'), count: attentionItems.value.length },
  { key: 'commerce', label: t('Commerce'), count: attentionItems.value.filter((item) => item.type === 'commerce').length },
  { key: 'mobility', label: t('Mobility'), count: attentionItems.value.filter((item) => item.type === 'mobility').length },
  { key: 'events', label: t('Events'), count: attentionItems.value.filter((item) => item.type === 'events').length },
  { key: 'healthcare', label: t('Healthcare'), count: attentionItems.value.filter((item) => item.type === 'healthcare').length },
]);

const filteredAttention = computed(() =>
  attentionFilter.value === 'all'
    ? attentionItems.value
    : attentionItems.value.filter((item) => item.type === attentionFilter.value),
);

const notifications = useNotificationsStore();
const activity = computed(() => notifications.items.slice(0, 8));
const streamConnected = computed(() => notifications.connected);

function amountLabel(notification) {
  return notification.amount != null && notification.amount !== '' ? formatMGA(Number(notification.amount)) : '';
}

function shortTime(value) {
  return new Date(value).toLocaleTimeString(localeCode.value, { hour: '2-digit', minute: '2-digit' });
}

function shortDate(value) {
  return formatDate(value, localeCode.value);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get('/admin/dashboard');
    data.value = response?.dashboard || null;
    if (!data.value) {
      error.value = t('Dashboard data is unavailable.');
    }
  } catch (err) {
    error.value = err?.message || t('Could not load dashboard');
  } finally {
    loading.value = false;
  }
}

let refetchTimer = null;
watch(
  () => notifications.lastEventAt,
  (timestamp) => {
    if (!timestamp) {
      return;
    }
    clearTimeout(refetchTimer);
    refetchTimer = setTimeout(load, 1200);
  },
);

onMounted(load);
onBeforeUnmount(() => clearTimeout(refetchTimer));
</script>

<template>
  <section class="dashboard">
    <header class="dashboard-hero">
      <div>
        <p class="dashboard-eyebrow">{{ t('Today’s operations') }}</p>
        <h2>{{ t('Run everything from one place.') }}</h2>
        <span>{{ todayLabel }}</span>
      </div>
      <div class="dashboard-hero__actions">
        <Button as="router-link" to="/admin/orders/new" :label="t('New order')" icon="pi pi-plus" />
        <Button as="router-link" to="/admin/event-requests/new" :label="t('New event request')" icon="pi pi-calendar-plus" severity="secondary" outlined />
        <Button :aria-label="t('Refresh')" icon="pi pi-refresh" severity="secondary" text rounded :loading="loading" @click="load" />
      </div>
    </header>

    <div v-if="error" class="dashboard-error" role="alert">
      <span><i class="pi pi-exclamation-triangle" /> {{ error }}</span>
      <Button :label="t('Retry')" icon="pi pi-refresh" severity="danger" outlined size="small" @click="load" />
    </div>

    <template v-if="loading && !data">
      <div class="dashboard-skeleton dashboard-skeleton--tiles">
        <Skeleton v-for="n in 6" :key="n" height="148px" borderRadius="18px" />
      </div>
      <div class="dashboard-skeleton dashboard-skeleton--panels">
        <Skeleton height="430px" borderRadius="18px" />
        <Skeleton height="430px" borderRadius="18px" />
      </div>
    </template>

    <template v-else-if="data">
      <section aria-labelledby="command-center-title">
        <div class="section-heading">
          <div>
            <p class="dashboard-eyebrow">{{ t('Command center') }}</p>
            <h2 id="command-center-title">{{ t('What needs your attention') }}</h2>
          </div>
          <span>{{ t('Live operational totals') }}</span>
        </div>

        <div class="tile-grid">
          <RouterLink v-for="tile in tiles" :key="tile.key" :to="tile.to" class="tile" :class="`tile--${tile.tone}`">
            <span class="tile__top">
              <span class="tile__icon"><i :class="tile.icon" /></span>
              <i class="pi pi-arrow-up-right tile__go" />
            </span>
            <span class="tile__label">{{ tile.label }}</span>
            <strong class="tile__value">{{ tile.value }}</strong>
            <span class="tile__note" :class="{ 'is-alert': tile.needsAction, [`is-${tile.trend}`]: tile.trend }">
              <i v-if="tile.needsAction" class="pi pi-circle-fill" />
              {{ tile.note }}
            </span>
          </RouterLink>
        </div>

        <nav class="service-metrics" :aria-label="t('Service overview')">
          <RouterLink v-for="metric in serviceMetrics" :key="metric.label" :to="metric.to">
            <i :class="metric.icon" />
            <span>{{ metric.label }}</span>
            <strong>{{ metric.value }}</strong>
            <i class="pi pi-angle-right" />
          </RouterLink>
        </nav>
      </section>

      <div class="operations-grid">
        <section id="work-queue" class="panel attention-panel">
          <div class="panel__head">
            <div>
              <p>{{ t('Needs attention') }}</p>
              <h2>{{ t('Priority work queue') }}</h2>
            </div>
            <span class="panel__count">{{ attentionItems.length }}</span>
          </div>

          <div class="attention-filters" :aria-label="t('Filter work queue')">
            <button
              v-for="filter in attentionFilters"
              :key="filter.key"
              type="button"
              :class="{ 'is-active': attentionFilter === filter.key }"
              @click="attentionFilter = filter.key"
            >
              {{ filter.label }} <span>{{ filter.count }}</span>
            </button>
          </div>

          <ul v-if="filteredAttention.length" class="attention-list">
            <li v-for="item in filteredAttention" :key="`${item.type}-${item.number}`">
              <RouterLink :to="item.to" class="attention-item" :class="`attention-item--${item.tone}`">
                <span class="attention-item__icon"><i :class="item.icon" /></span>
                <span class="attention-item__body">
                  <strong>{{ item.title }}</strong>
                  <small>{{ item.detail }} · {{ shortDate(item.created_at) }}</small>
                </span>
                <span class="attention-item__meta">{{ item.meta }}</span>
                <span class="attention-item__action">{{ item.action }} <i class="pi pi-arrow-right" /></span>
              </RouterLink>
            </li>
          </ul>
          <div v-else class="panel__empty panel__empty--center">
            <i class="pi pi-check-circle" />
            <strong>{{ t('Nothing needs attention right now.') }}</strong>
          </div>
        </section>

        <section class="panel live-panel">
          <div class="panel__head">
            <div>
              <p>{{ t('Realtime') }}</p>
              <h2>{{ t('Live activity') }}</h2>
            </div>
            <span class="live-status" :class="{ 'is-live': streamConnected }">
              <i class="live-status__dot" />
              {{ streamConnected ? t('Live') : t('Connecting…') }}
            </span>
          </div>

          <ul v-if="activity.length" class="live-list">
            <li v-for="notification in activity" :key="notification.id">
              <RouterLink class="live-item" :to="notification.to">
                <span class="live-item__icon"><i :class="notification.icon" /></span>
                <span class="live-item__body">
                  <span class="live-item__title">
                    {{ t(notification.title) }} <span v-if="notification.number">{{ notification.number }}</span>
                  </span>
                  <span class="live-item__meta">
                    <template v-if="notification.customer">{{ notification.customer }}</template>
                    <template v-else-if="notification.method">{{ enumLabel(notification.method) }}</template>
                    <template v-if="amountLabel(notification)"> · {{ amountLabel(notification) }}</template>
                  </span>
                </span>
                <time class="live-item__time">{{ shortTime(notification.at) }}</time>
              </RouterLink>
            </li>
          </ul>
          <p v-else class="panel__empty">{{ t('New orders, bookings, and requests appear here the moment they come in.') }}</p>
        </section>
      </div>

      <section aria-labelledby="analytics-title">
        <div class="section-heading">
          <div>
            <p class="dashboard-eyebrow">{{ t('Business pulse') }}</p>
            <h2 id="analytics-title">{{ t('Revenue and payment mix') }}</h2>
          </div>
          <span>{{ t('Confirmed payments only') }}</span>
        </div>

        <div class="analytics-grid">
          <section class="panel revenue-panel">
            <div class="panel__head">
              <div>
                <p>{{ t('Confirmed revenue') }}</p>
                <h2>{{ t('Last 30 days') }}</h2>
              </div>
              <div class="panel__legend">
                <span><i class="dot" :style="{ background: 'var(--tm-chart-1)' }" /> {{ t('Orders') }}</span>
                <span><i class="dot" :style="{ background: 'var(--tm-chart-2)' }" /> {{ t('Bookings') }}</span>
                <span><i class="dot" :style="{ background: '#8065b8' }" /> {{ t('Events') }}</span>
                <span><i class="dot" :style="{ background: '#c05a7d' }" /> {{ t('Healthcare') }}</span>
              </div>
            </div>
            <RevenueAreaChart :series="data.revenue_series || []" />
            <p class="panel__foot">{{ t('All-time confirmed revenue') }}: <strong>{{ revenueAllTime }}</strong></p>
          </section>

          <section class="panel payment-panel">
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
              :format-value="(value) => formatMGA(value)"
            />
            <p v-if="!paymentSegments.length" class="panel__empty">{{ t('No confirmed payments yet.') }}</p>
          </section>
        </div>
      </section>

      <section aria-labelledby="pipelines-title">
        <div class="section-heading">
          <div>
            <p class="dashboard-eyebrow">{{ t('Operations health') }}</p>
            <h2 id="pipelines-title">{{ t('Pipelines by service') }}</h2>
          </div>
          <span>{{ t('Current status distribution') }}</span>
        </div>

        <div class="pipeline-grid">
          <section v-for="pipeline in pipelines" :key="pipeline.key" class="panel pipeline-panel">
            <div class="panel__head">
              <div>
                <p>{{ pipeline.eyebrow }}</p>
                <h2>{{ pipeline.title }}</h2>
              </div>
              <Button as="router-link" :to="pipeline.to" icon="pi pi-arrow-up-right" severity="secondary" text rounded :aria-label="t('View all')" />
            </div>
            <BarBreakdown :items="pipeline.items">
              <template #empty>{{ t('No records yet.') }}</template>
            </BarBreakdown>
          </section>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.dashboard {
  display: grid;
  gap: 30px;
  max-width: 1540px;
  margin: 0 auto;
}

.dashboard-hero {
  position: relative;
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  overflow: hidden;
  padding: clamp(24px, 3vw, 34px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background:
    radial-gradient(circle at 88% -10%, rgba(201, 146, 44, 0.3), transparent 34%),
    linear-gradient(135deg, var(--tm-charcoal) 0%, #172426 100%);
  box-shadow: var(--tm-shadow);
}

.dashboard-hero::after {
  position: absolute;
  right: -68px;
  bottom: -120px;
  width: 250px;
  height: 250px;
  border: 1px solid rgba(201, 146, 44, 0.22);
  border-radius: 50%;
  content: '';
}

.dashboard-hero > div {
  position: relative;
  z-index: 1;
}

.dashboard-eyebrow,
.panel__head p {
  margin: 0;
  color: var(--tm-gold);
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.dashboard-hero h2 {
  max-width: 660px;
  margin: 8px 0 7px;
  color: #fff8ed;
  font-size: clamp(2rem, 4vw, 3.7rem);
  letter-spacing: -0.045em;
  line-height: 0.98;
}

.dashboard-hero > div:first-child > span {
  color: rgba(255, 255, 255, 0.58);
  font-weight: 720;
  text-transform: capitalize;
}

.dashboard-hero__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
  flex-wrap: wrap;
}

.dashboard-hero__actions :deep(.p-button-secondary) {
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.dashboard-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(206, 107, 85, 0.3);
  border-radius: 14px;
  background: rgba(206, 107, 85, 0.09);
  color: var(--tm-coral);
  font-weight: 800;
}

.dashboard-error span {
  display: flex;
  align-items: center;
  gap: 9px;
}

.dashboard-skeleton {
  display: grid;
  gap: 14px;
}

.dashboard-skeleton--tiles {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dashboard-skeleton--panels {
  grid-template-columns: minmax(0, 1.5fr) minmax(320px, 0.8fr);
}

.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 14px;
}

.section-heading h2 {
  margin: 4px 0 0;
  color: var(--tm-heading);
  font-size: clamp(1.35rem, 2.5vw, 2rem);
  letter-spacing: -0.035em;
}

.section-heading > span {
  color: var(--tm-muted);
  font-size: 0.84rem;
  font-weight: 750;
}

.tile-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.tile {
  --tile-accent: var(--tm-gold);
  --tile-wash: rgba(201, 146, 44, 0.12);
  position: relative;
  display: grid;
  min-height: 164px;
  gap: 7px;
  overflow: hidden;
  padding: 17px;
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background:
    radial-gradient(circle at 100% 0%, var(--tile-wash), transparent 46%),
    var(--tm-surface);
  box-shadow: 0 12px 34px rgba(37, 31, 20, 0.055);
  color: inherit;
  text-decoration: none;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.tile--coral { --tile-accent: var(--tm-coral); --tile-wash: rgba(206, 107, 85, 0.12); }
.tile--blue { --tile-accent: var(--tm-blue); --tile-wash: rgba(49, 92, 112, 0.12); }
.tile--violet { --tile-accent: #8065b8; --tile-wash: rgba(128, 101, 184, 0.12); }
.tile--rose { --tile-accent: #c05a7d; --tile-wash: rgba(192, 90, 125, 0.12); }
.tile--emerald { --tile-accent: var(--tm-emerald); --tile-wash: rgba(12, 155, 128, 0.11); }

.tile:hover,
.tile:focus-visible {
  border-color: var(--tile-accent);
  box-shadow: var(--tm-shadow-hover);
  outline: none;
  transform: translateY(-3px);
}

.tile__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tile__icon {
  display: grid;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--tile-accent);
  color: #fff;
  place-items: center;
}

.tile__go {
  color: var(--tile-accent);
  font-size: 0.8rem;
  transition: transform 160ms ease;
}

.tile:hover .tile__go {
  transform: translate(2px, -2px);
}

.tile__label {
  margin-top: 4px;
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 850;
  line-height: 1.25;
}

.tile__value {
  overflow-wrap: anywhere;
  color: var(--tm-heading);
  font-size: clamp(1.35rem, 2vw, 1.9rem);
  letter-spacing: -0.035em;
  line-height: 1;
}

.tile__note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: auto;
  color: var(--tm-muted);
  font-size: 0.73rem;
  font-weight: 760;
  line-height: 1.3;
}

.tile__note.is-alert,
.tile__note.is-down {
  color: var(--tm-coral);
}

.tile__note.is-up {
  color: var(--tm-emerald);
}

.tile__note .pi-circle-fill {
  font-size: 0.38rem;
}

.service-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 12px;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: var(--tm-surface-soft);
}

.service-metrics a {
  display: grid;
  grid-template-columns: auto 1fr auto auto;
  align-items: center;
  gap: 9px;
  min-height: 58px;
  padding: 10px 14px;
  border-left: 1px solid var(--tm-border);
  color: var(--tm-muted);
  text-decoration: none;
}

.service-metrics a:first-child {
  border-left: 0;
}

.service-metrics a:hover {
  background: var(--tm-surface);
}

.service-metrics a > i:first-child {
  color: var(--tm-gold);
}

.service-metrics span {
  font-size: 0.78rem;
  font-weight: 800;
}

.service-metrics strong {
  color: var(--tm-heading);
  font-size: 1rem;
}

.service-metrics a > i:last-child {
  font-size: 0.68rem;
}

.operations-grid,
.analytics-grid {
  display: grid;
  align-items: start;
  gap: 16px;
  grid-template-columns: minmax(0, 1.45fr) minmax(330px, 0.75fr);
}

.panel {
  display: grid;
  align-content: start;
  gap: 16px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background: var(--tm-surface);
  box-shadow: 0 12px 34px rgba(37, 31, 20, 0.055);
}

.panel__head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.panel__head h2 {
  margin: 4px 0 0;
  color: var(--tm-heading);
  font-size: 1.12rem;
  letter-spacing: -0.02em;
}

.panel__count {
  display: grid;
  min-width: 36px;
  height: 36px;
  padding: 0 9px;
  border-radius: 12px;
  background: var(--tm-charcoal);
  color: #fff;
  font-weight: 900;
  place-items: center;
}

.attention-filters {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.attention-filters button {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  background: transparent;
  color: var(--tm-muted);
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 820;
  white-space: nowrap;
}

.attention-filters button span {
  display: grid;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--tm-surface-muted);
  font-size: 0.68rem;
  place-items: center;
}

.attention-filters button.is-active {
  border-color: var(--tm-emerald);
  background: var(--tm-emerald);
  color: #fff;
}

.attention-filters button.is-active span {
  background: rgba(255, 255, 255, 0.16);
}

.attention-list,
.live-list {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.attention-item {
  --attention-accent: var(--tm-gold);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  min-height: 66px;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 13px;
  color: inherit;
  text-decoration: none;
}

.attention-item--blue { --attention-accent: var(--tm-blue); }
.attention-item--violet { --attention-accent: #8065b8; }
.attention-item--rose { --attention-accent: #c05a7d; }

.attention-item:hover,
.attention-item:focus-visible {
  border-color: var(--tm-border);
  background: var(--tm-surface-soft);
  outline: none;
}

.attention-item__icon {
  display: grid;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: color-mix(in srgb, var(--attention-accent) 12%, transparent);
  color: var(--attention-accent);
  place-items: center;
}

.attention-item__body {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.attention-item__body strong {
  overflow: hidden;
  color: var(--tm-heading);
  font-size: 0.88rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-item__body small,
.attention-item__meta {
  color: var(--tm-muted);
  font-size: 0.76rem;
}

.attention-item__meta {
  font-weight: 800;
  text-transform: capitalize;
  white-space: nowrap;
}

.attention-item__action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--attention-accent);
  font-size: 0.73rem;
  font-weight: 900;
  white-space: nowrap;
}

.panel__empty {
  margin: 0;
  color: var(--tm-muted);
  font-weight: 700;
  line-height: 1.5;
}

.panel__empty--center {
  display: grid;
  min-height: 210px;
  place-items: center;
  align-content: center;
  gap: 10px;
  text-align: center;
}

.panel__empty--center i {
  color: var(--tm-emerald);
  font-size: 1.65rem;
}

.live-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--tm-muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.live-status__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tm-muted);
}

.live-status.is-live {
  color: var(--tm-emerald);
}

.live-status.is-live .live-status__dot {
  background: var(--tm-emerald);
  box-shadow: 0 0 0 4px rgba(12, 155, 128, 0.13);
  animation: live-pulse 2s ease-in-out infinite;
}

@keyframes live-pulse {
  50% { box-shadow: 0 0 0 7px rgba(12, 155, 128, 0); }
}

.live-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 58px;
  padding: 8px;
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
}

.live-item:hover {
  background: var(--tm-surface-soft);
}

.live-item__icon {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 11px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  place-items: center;
}

.live-item__body {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.live-item__title,
.live-item__meta {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.live-item__title {
  color: var(--tm-heading);
  font-size: 0.82rem;
  font-weight: 820;
}

.live-item__title span,
.live-item__meta,
.live-item__time {
  color: var(--tm-muted);
  font-size: 0.74rem;
}

.live-item__time {
  flex: 0 0 auto;
}

.panel__legend {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.panel__legend span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tm-muted);
  font-size: 0.76rem;
  font-weight: 780;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.panel__foot {
  margin: 0;
  color: var(--tm-muted);
  font-size: 0.8rem;
  font-weight: 720;
}

.panel__foot strong {
  color: var(--tm-heading);
}

.pipeline-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.pipeline-panel {
  min-height: 200px;
}

@media (max-width: 1380px) {
  .tile-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .pipeline-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 1120px) {
  .operations-grid,
  .analytics-grid,
  .dashboard-skeleton--panels {
    grid-template-columns: 1fr;
  }

  .service-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .service-metrics a:nth-child(3) {
    border-left: 0;
  }

  .service-metrics a:nth-child(n + 3) {
    border-top: 1px solid var(--tm-border);
  }
}

@media (max-width: 720px) {
  .dashboard {
    gap: 24px;
  }

  .dashboard-hero,
  .section-heading,
  .dashboard-error {
    align-items: stretch;
    flex-direction: column;
  }

  .dashboard-hero__actions {
    justify-content: flex-start;
  }

  .tile-grid,
  .dashboard-skeleton--tiles,
  .pipeline-grid {
    grid-template-columns: 1fr;
  }

  .service-metrics {
    grid-template-columns: 1fr;
  }

  .service-metrics a,
  .service-metrics a:nth-child(3) {
    border-top: 1px solid var(--tm-border);
    border-left: 0;
  }

  .service-metrics a:first-child {
    border-top: 0;
  }

  .section-heading > span {
    display: none;
  }

  .attention-item {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .attention-item__meta {
    display: none;
  }

  .attention-item__action {
    font-size: 0;
  }

  .attention-item__action i {
    font-size: 0.8rem;
  }
}
</style>
