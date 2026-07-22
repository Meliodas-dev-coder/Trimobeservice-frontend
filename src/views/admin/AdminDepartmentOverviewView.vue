<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import BarBreakdown from '@/components/admin/charts/BarBreakdown.vue';
import DepartmentWorkspaceNav from '@/components/admin/DepartmentWorkspaceNav.vue';
import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { formatDate, formatMGA } from '@/utils/format';

// The home screen of one catalog department's back office. Every figure comes
// from GET /admin/dashboard/departments/{department}, which computes them from
// the same rows the Orders and Stock screens read — so nothing here can quote a
// number those screens would contradict.
//
// The customer's experience is unchanged by this split: they check out once and
// pay once. "Department share" is this department's slice of those same orders.
const route = useRoute();
const { enumLabel, t } = useAdminI18n();

const department = computed(() => route.meta.department || 'coffee');
const departmentLabel = computed(
  () => department.value.charAt(0).toUpperCase() + department.value.slice(1),
);

// Where the public storefront for this department lives, for the hero link.
const STOREFRONT = { tech: '/tech', fashion: '/fashion', coffee: '/coffee' };

const loading = ref(true);
const error = ref('');
const data = ref(null);

const kpis = computed(() => data.value?.kpis || {});
const series = computed(() => data.value?.revenue_series || []);

// Month-on-month movement in paid revenue. Growing from nothing has no
// meaningful percentage, so it is reported as a plain "new" rather than ∞%.
const revenueTrend = computed(() => {
  const current = Number(kpis.value.revenue_month || 0);
  const previous = Number(kpis.value.revenue_prev_month || 0);
  if (previous <= 0) {
    return current > 0 ? { tone: 'up', label: t('First revenue this month') } : null;
  }
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) {
    return { tone: 'flat', label: t('Level with last month') };
  }
  return {
    tone: change > 0 ? 'up' : 'down',
    label: change > 0
      ? t('{n}% above last month', { n: change })
      : t('{n}% below last month', { n: Math.abs(change) }),
  };
});

const kpiCards = computed(() => [
  {
    key: 'revenue-month',
    icon: 'pi pi-chart-line',
    tone: 'emerald',
    eyebrow: t('Paid this month'),
    value: formatMGA(kpis.value.revenue_month || 0),
    note: revenueTrend.value?.label || t('No revenue yet'),
    noteTone: revenueTrend.value?.tone,
  },
  {
    key: 'revenue-total',
    icon: 'pi pi-wallet',
    tone: 'gold',
    eyebrow: t('Paid all time'),
    value: formatMGA(kpis.value.revenue_total || 0),
    note: t('{n} units sold', { n: kpis.value.units_sold || 0 }),
  },
  {
    key: 'orders',
    icon: 'pi pi-shopping-cart',
    tone: 'blue',
    eyebrow: t('Orders'),
    value: kpis.value.orders_total || 0,
    note: kpis.value.orders_open
      ? t('{n} still to hand over', { n: kpis.value.orders_open })
      : t('Nothing waiting to be handed over'),
    to: `/admin/${department.value}/orders`,
  },
  {
    key: 'unpaid',
    icon: 'pi pi-exclamation-circle',
    tone: kpis.value.orders_unpaid ? 'coral' : 'blue',
    eyebrow: t('Awaiting payment'),
    value: kpis.value.orders_unpaid || 0,
    note: t('{amount} of this department', { amount: formatMGA(kpis.value.unpaid_value || 0) }),
    to: `/admin/${department.value}/orders`,
  },
  {
    key: 'stock-value',
    icon: 'pi pi-box',
    tone: 'gold',
    eyebrow: t('Stock on hand'),
    value: formatMGA(kpis.value.stock_value || 0),
    note: t('{n} units across {s} SKUs', { n: kpis.value.units_on_hand || 0, s: kpis.value.skus_total || 0 }),
    to: `/admin/${department.value}/stock`,
  },
  {
    key: 'stock-alerts',
    icon: 'pi pi-bell',
    tone: kpis.value.out_of_stock || kpis.value.low_stock ? 'coral' : 'emerald',
    eyebrow: t('Needs restocking'),
    value: (kpis.value.low_stock || 0) + (kpis.value.out_of_stock || 0),
    note: kpis.value.out_of_stock
      ? t('{n} completely out of stock', { n: kpis.value.out_of_stock })
      : t('Nothing is out of stock'),
    to: `/admin/${department.value}/stock`,
  },
]);

const statusBars = computed(() =>
  (data.value?.orders_by_status || []).map((row, index) => ({
    label: enumLabel(row.status),
    value: row.count,
    color: `var(--tm-chart-${(index % 6) + 1})`,
  })),
);

const topProducts = computed(() => data.value?.top_products || []);
const attention = computed(() => data.value?.attention || {});

const hasAttention = computed(() =>
  Boolean(
    attention.value.orders_to_fulfil?.length ||
    attention.value.unpaid_orders?.length ||
    attention.value.low_stock?.length,
  ),
);

// --- 30-day revenue sparkline ------------------------------------------------
// A small inline area chart: enough to read the shape of the month without
// pulling in the full cross-domain dashboard chart, whose stacked series do not
// apply to a single department.
const CHART = { width: 720, height: 150, top: 12, bottom: 24, left: 8, right: 8 };

const chart = computed(() => {
  const points = series.value.map((row) => Number(row.revenue || 0));
  if (!points.length) {
    return null;
  }
  const peak = Math.max(...points, 0);
  const scale = peak > 0 ? peak : 1;
  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const step = points.length > 1 ? plotWidth / (points.length - 1) : 0;

  const coords = points.map((value, index) => ({
    x: CHART.left + index * step,
    y: CHART.top + plotHeight - (value / scale) * plotHeight,
  }));
  const line = coords.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const baseline = CHART.top + plotHeight;
  return {
    line,
    area: `${CHART.left},${baseline} ${line} ${(CHART.left + plotWidth).toFixed(1)},${baseline}`,
    peak,
    hasRevenue: peak > 0,
  };
});

const chartRange = computed(() => {
  if (!series.value.length) {
    return '';
  }
  const first = series.value[0]?.date;
  const last = series.value[series.value.length - 1]?.date;
  return `${formatDate(first)} — ${formatDate(last)}`;
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const payload = await api.get(`/admin/dashboard/departments/${department.value}`);
    data.value = payload?.overview || null;
  } catch (err) {
    data.value = null;
    error.value = err?.message || 'Could not load this department overview';
  } finally {
    loading.value = false;
  }
}

watch(department, load, { immediate: true });
</script>

<template>
  <section class="department-overview">
    <DepartmentWorkspaceNav :department="department" />

    <header class="department-hero">
      <div class="department-hero__copy">
        <p>{{ t('{department} back office', { department: t(departmentLabel) }) }}</p>
        <h2>{{ t('Everything {department} sells, in one place.', { department: t(departmentLabel) }) }}</h2>
        <span>
          {{ t('Follow this department\'s orders from placement to hand-over, watch the shelf, and keep the catalog ready to sell.') }}
        </span>
      </div>
      <div class="department-hero__actions">
        <Button
          as="router-link"
          :to="`/admin/${department}/orders`"
          :label="t('Follow orders')"
          icon="pi pi-shopping-cart"
        />
        <Button
          as="router-link"
          :to="`/admin/${department}/stock`"
          :label="t('Manage stock')"
          icon="pi pi-box"
          severity="secondary"
          outlined
        />
        <Button
          v-if="STOREFRONT[department]"
          as="router-link"
          :to="STOREFRONT[department]"
          :label="t('View storefront')"
          icon="pi pi-external-link"
          severity="secondary"
          outlined
        />
      </div>
    </header>

    <div v-if="error" class="department-error">
      <span><i class="pi pi-exclamation-circle" />{{ t(error) }}</span>
      <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
    </div>

    <div v-if="loading" class="department-skeletons">
      <Skeleton v-for="index in 6" :key="index" height="8.5rem" borderRadius="18px" />
    </div>

    <template v-else-if="data">
      <section class="kpi-grid" :aria-label="t('Key figures')">
        <component
          :is="card.to ? 'RouterLink' : 'div'"
          v-for="card in kpiCards"
          :key="card.key"
          :to="card.to"
          class="kpi-card"
          :class="[`kpi-card--${card.tone}`, { 'kpi-card--link': card.to }]"
        >
          <div class="kpi-card__top">
            <span><i :class="card.icon" /></span>
            <i v-if="card.to" class="pi pi-arrow-up-right" />
          </div>
          <p>{{ card.eyebrow }}</p>
          <strong>{{ card.value }}</strong>
          <small :class="card.noteTone ? `is-${card.noteTone}` : ''">{{ card.note }}</small>
        </component>
      </section>

      <section class="panel panel--chart">
        <div class="panel__head">
          <div>
            <p>{{ t('Last 30 days') }}</p>
            <h3>{{ t('Paid revenue for this department') }}</h3>
          </div>
          <span class="panel__meta">{{ chartRange }}</span>
        </div>
        <div v-if="chart?.hasRevenue" class="chart">
          <svg :viewBox="`0 0 ${CHART.width} ${CHART.height}`" role="img" :aria-label="t('Paid revenue over the last 30 days')">
            <defs>
              <linearGradient id="department-revenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--tm-emerald)" stop-opacity="0.35" />
                <stop offset="100%" stop-color="var(--tm-emerald)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <polygon :points="chart.area" fill="url(#department-revenue)" />
            <polyline :points="chart.line" fill="none" stroke="var(--tm-emerald)" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="chart__legend">
            <span>{{ t('Peak day') }}: <strong>{{ formatMGA(chart.peak) }}</strong></span>
            <span>{{ t('{n} units sold this month', { n: kpis.units_sold_month || 0 }) }}</span>
          </div>
        </div>
        <p v-else class="panel__empty">{{ t('No payment has been recorded for this department in the last 30 days.') }}</p>
      </section>

      <div class="panel-grid">
        <section class="panel">
          <div class="panel__head">
            <div>
              <p>{{ t('Order pipeline') }}</p>
              <h3>{{ t('Where this department’s orders stand') }}</h3>
            </div>
            <RouterLink class="panel__link" :to="`/admin/${department}/orders`">{{ t('Open orders') }}</RouterLink>
          </div>
          <BarBreakdown :items="statusBars" />
          <p v-if="!statusBars.length" class="panel__empty">{{ t('No order has included a product from this department yet.') }}</p>
        </section>

        <section class="panel">
          <div class="panel__head">
            <div>
              <p>{{ t('Best sellers') }}</p>
              <h3>{{ t('Most units sold') }}</h3>
            </div>
          </div>
          <ol v-if="topProducts.length" class="ranked">
            <li v-for="(product, index) in topProducts" :key="`${product.product_id}-${product.product_name}`">
              <span class="ranked__rank">{{ index + 1 }}</span>
              <span class="ranked__copy">
                <strong>{{ product.product_name }}</strong>
                <small>{{ t('{n} units', { n: product.units }) }} · {{ formatMGA(product.revenue) }}</small>
              </span>
            </li>
          </ol>
          <p v-else class="panel__empty">{{ t('Nothing has sold yet.') }}</p>
        </section>
      </div>

      <section v-if="hasAttention" class="panel">
        <div class="panel__head">
          <div>
            <p>{{ t('Needs a decision') }}</p>
            <h3>{{ t('What to deal with next') }}</h3>
          </div>
        </div>

        <div class="queues">
          <article v-if="attention.orders_to_fulfil?.length">
            <h4><i class="pi pi-box" />{{ t('To hand over') }}</h4>
            <RouterLink
              v-for="order in attention.orders_to_fulfil"
              :key="`fulfil-${order.id}`"
              :to="`/admin/${department}/orders`"
            >
              <span>
                <strong>{{ order.order_number }}</strong>
                <small>{{ order.customer_name || t('Walk-in customer') }}</small>
              </span>
              <Tag :value="t(enumLabel(order.status))" :severity="order.status === 'pending' ? 'warn' : 'info'" />
            </RouterLink>
          </article>

          <article v-if="attention.unpaid_orders?.length">
            <h4><i class="pi pi-wallet" />{{ t('Awaiting payment') }}</h4>
            <RouterLink
              v-for="order in attention.unpaid_orders"
              :key="`unpaid-${order.id}`"
              :to="`/admin/${department}/orders`"
            >
              <span>
                <strong>{{ order.order_number }}</strong>
                <small>{{ t('This department') }}: {{ formatMGA(order.department_subtotal) }}</small>
              </span>
              <Tag :value="formatMGA(order.total)" severity="secondary" />
            </RouterLink>
          </article>

          <article v-if="attention.low_stock?.length">
            <h4><i class="pi pi-bell" />{{ t('Running out') }}</h4>
            <RouterLink
              v-for="item in attention.low_stock"
              :key="`stock-${item.variant_id}`"
              :to="`/admin/${department}/stock`"
            >
              <span>
                <strong>{{ item.product_name }}</strong>
                <small>{{ item.label || item.sku }}</small>
              </span>
              <Tag
                :value="item.level === 'out' ? t('Out of stock') : t('{n} left', { n: item.stock_quantity })"
                :severity="item.level === 'out' ? 'danger' : 'warn'"
              />
            </RouterLink>
          </article>
        </div>
      </section>

      <section class="panel">
        <div class="panel__head">
          <div>
            <p>{{ t('Latest activity') }}</p>
            <h3>{{ t('Recent orders') }}</h3>
          </div>
          <RouterLink class="panel__link" :to="`/admin/${department}/orders`">{{ t('See all') }}</RouterLink>
        </div>
        <div v-if="data.recent_orders?.length" class="recent">
          <RouterLink
            v-for="order in data.recent_orders"
            :key="order.id"
            :to="`/admin/${department}/orders`"
            class="recent__row"
          >
            <span class="recent__main">
              <strong>{{ order.order_number }}</strong>
              <small>{{ order.customer_name || t('Walk-in customer') }} · {{ formatDate(order.created_at) }}</small>
            </span>
            <span class="recent__share">
              <strong>{{ formatMGA(order.department_subtotal) }}</strong>
              <small v-if="String(order.departments || '').includes(',')">
                {{ t('of {total} across departments', { total: formatMGA(order.total) }) }}
              </small>
              <small v-else>{{ t('{n} units', { n: order.department_quantity }) }}</small>
            </span>
            <Tag :value="t(enumLabel(order.status))" severity="secondary" />
          </RouterLink>
        </div>
        <p v-else class="panel__empty">{{ t('No orders yet.') }}</p>
      </section>
    </template>
  </section>
</template>

<style scoped>
.department-overview {
  display: grid;
  gap: 18px;
}

.department-hero {
  position: relative;
  display: grid;
  align-items: end;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr) auto;
  overflow: hidden;
  padding: clamp(24px, 4vw, 38px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background:
    radial-gradient(circle at 88% -10%, rgba(12, 155, 128, 0.3), transparent 35%),
    linear-gradient(135deg, var(--tm-charcoal) 0%, #17282a 100%);
  box-shadow: var(--tm-shadow);
}

.department-hero::after {
  position: absolute;
  right: -70px;
  bottom: -130px;
  width: 270px;
  height: 270px;
  border: 1px solid rgba(201, 146, 44, 0.22);
  border-radius: 50%;
  content: '';
}

.department-hero__copy,
.department-hero__actions {
  position: relative;
  z-index: 1;
}

.department-hero p,
.panel__head p,
.kpi-card > p {
  margin: 0;
  color: var(--tm-gold);
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.department-hero h2 {
  max-width: 720px;
  margin: 8px 0 9px;
  color: #fff8ed;
  font-size: clamp(1.9rem, 3.6vw, 3.3rem);
  letter-spacing: -0.048em;
  line-height: 1;
}

.department-hero__copy > span {
  display: block;
  max-width: 700px;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.55;
}

.department-hero__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 9px;
}

.department-hero__actions :deep(.p-button-secondary) {
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.department-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(206, 107, 85, 0.28);
  border-radius: 14px;
  background: rgba(206, 107, 85, 0.08);
  color: var(--tm-coral);
  font-weight: 800;
}

.department-error span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.department-skeletons,
.kpi-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.kpi-card {
  --card-accent: var(--tm-gold);
  --card-wash: rgba(201, 146, 44, 0.12);
  display: grid;
  align-content: start;
  min-height: 136px;
  gap: 6px;
  padding: 18px;
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background:
    radial-gradient(circle at 100% 0%, var(--card-wash), transparent 48%),
    var(--tm-surface);
  box-shadow: 0 12px 34px rgba(37, 31, 20, 0.055);
  color: inherit;
  text-decoration: none;
}

.kpi-card--blue { --card-accent: var(--tm-blue); --card-wash: rgba(49, 92, 112, 0.12); }
.kpi-card--emerald { --card-accent: var(--tm-emerald); --card-wash: rgba(12, 155, 128, 0.12); }
.kpi-card--coral { --card-accent: var(--tm-coral); --card-wash: rgba(206, 107, 85, 0.14); }

.kpi-card--link {
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.kpi-card--link:hover,
.kpi-card--link:focus-visible {
  border-color: var(--card-accent);
  box-shadow: var(--tm-shadow-hover);
  outline: none;
  transform: translateY(-3px);
}

.kpi-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.kpi-card__top > span {
  display: grid;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--card-accent);
  color: #fff;
  place-items: center;
}

.kpi-card__top > i {
  color: var(--card-accent);
}

.kpi-card strong {
  color: var(--tm-heading);
  font-size: 1.65rem;
  letter-spacing: -0.045em;
  line-height: 1.15;
}

.kpi-card small {
  color: var(--tm-muted);
  font-weight: 760;
}

.kpi-card small.is-up { color: var(--tm-emerald); }
.kpi-card small.is-down { color: var(--tm-coral); }

.panel {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background: var(--tm-surface);
  box-shadow: 0 12px 34px rgba(37, 31, 20, 0.055);
}

.panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel__head h3 {
  margin: 4px 0 0;
  color: var(--tm-heading);
  font-size: 1.1rem;
  letter-spacing: -0.025em;
}

.panel__meta {
  color: var(--tm-muted);
  font-size: 0.8rem;
  font-weight: 800;
}

.panel__link {
  color: var(--tm-emerald);
  font-size: 0.82rem;
  font-weight: 850;
  text-decoration: none;
  white-space: nowrap;
}

.panel__empty {
  margin: 0;
  color: var(--tm-muted);
  font-weight: 780;
}

.chart svg {
  display: block;
  width: 100%;
  height: auto;
}

.chart__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
  margin-top: 6px;
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 780;
}

.chart__legend strong {
  color: var(--tm-heading);
}

.panel-grid {
  display: grid;
  align-items: start;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ranked {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ranked li {
  display: grid;
  align-items: center;
  gap: 11px;
  grid-template-columns: auto minmax(0, 1fr);
}

.ranked__rank {
  display: grid;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: var(--tm-surface-soft);
  color: var(--tm-heading);
  font-size: 0.82rem;
  font-weight: 900;
  place-items: center;
}

.ranked__copy {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.ranked__copy strong {
  overflow: hidden;
  color: var(--tm-heading);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ranked__copy small,
.recent__main small,
.recent__share small {
  color: var(--tm-muted);
  font-weight: 740;
}

.queues {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.queues h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
  color: var(--tm-heading);
  font-size: 0.9rem;
}

.queues h4 i {
  color: var(--tm-gold);
}

.queues a,
.recent__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 9px 0;
  border-bottom: 1px solid var(--tm-border);
  color: inherit;
  text-decoration: none;
}

.queues a:last-child,
.recent__row:last-child {
  border-bottom: 0;
}

.queues a span,
.recent__main,
.recent__share {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.queues a strong,
.recent__main strong,
.recent__share strong {
  overflow: hidden;
  color: var(--tm-heading);
  font-size: 0.88rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.queues a small {
  color: var(--tm-muted);
  font-weight: 740;
}

.recent__row {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto;
}

.recent__share {
  justify-items: flex-end;
  text-align: right;
}

.recent__row:hover strong {
  color: var(--tm-emerald);
}

@media (max-width: 1080px) {
  .department-skeletons,
  .kpi-grid,
  .queues {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .department-hero,
  .panel-grid {
    grid-template-columns: 1fr;
  }

  .department-hero__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .department-skeletons,
  .kpi-grid,
  .queues {
    grid-template-columns: 1fr;
  }

  .recent__row {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .recent__share {
    grid-column: 1 / -1;
    justify-items: flex-start;
    text-align: left;
  }

  .department-hero__actions :deep(.p-button),
  .department-error {
    width: 100%;
  }

  .department-error {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
