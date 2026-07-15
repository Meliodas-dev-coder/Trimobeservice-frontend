<script setup>
import { computed, ref } from 'vue';

import { useAdminI18n } from '@/i18n/admin';
import { formatMGA } from '@/utils/format';

const props = defineProps({
  // [{ date, orders, bookings, events, healthcare }, ...]
  series: { type: Array, default: () => [] },
});

const { localeCode, t } = useAdminI18n();

const W = 720;
const H = 260;
const PAD = { left: 56, right: 16, top: 16, bottom: 28 };
const plotLeft = PAD.left;
const plotRight = W - PAD.right;
const plotTop = PAD.top;
const plotBottom = H - PAD.bottom;

const svgEl = ref(null);
const activeIndex = ref(null);

const points = computed(() =>
  props.series.map((row) => {
    const orders = Number(row.orders || 0);
    const bookings = Number(row.bookings || 0);
    const events = Number(row.events || 0);
    const healthcare = Number(row.healthcare || 0);
    return { date: row.date, orders, bookings, events, healthcare, total: orders + bookings + events + healthcare };
  }),
);

const count = computed(() => points.value.length);
const step = computed(() => (count.value > 1 ? (plotRight - plotLeft) / (count.value - 1) : 0));

const niceMax = computed(() => {
  const peak = points.value.reduce((max, p) => Math.max(max, p.total), 0);
  if (peak <= 0) {
    return 1;
  }
  const pow = 10 ** Math.floor(Math.log10(peak));
  for (const mult of [1, 2, 2.5, 5, 10]) {
    if (pow * mult >= peak) {
      return pow * mult;
    }
  }
  return pow * 10;
});

function xAt(i) {
  return plotLeft + i * step.value;
}

function yAt(value) {
  return plotBottom - (value / niceMax.value) * (plotBottom - plotTop);
}

// Stacked areas: orders sits on the baseline, bookings stacks on top of orders.
const ordersArea = computed(() => areaPath(points.value.map((p) => p.orders), () => 0));
const bookingsArea = computed(() =>
  areaPath(
    points.value.map((p) => p.total),
    (i) => points.value[i].orders,
  ),
);
const eventsArea = computed(() =>
  areaPath(
    points.value.map((p) => p.orders + p.bookings + p.events),
    (i) => points.value[i].orders + points.value[i].bookings,
  ),
);
const healthcareArea = computed(() =>
  areaPath(
    points.value.map((p) => p.total),
    (i) => points.value[i].orders + points.value[i].bookings + points.value[i].events,
  ),
);
const ordersLine = computed(() => linePath(points.value.map((p) => p.orders)));
const bookingsLine = computed(() => linePath(points.value.map((p) => p.orders + p.bookings)));
const eventsLine = computed(() => linePath(points.value.map((p) => p.orders + p.bookings + p.events)));
const topLine = computed(() => linePath(points.value.map((p) => p.total)));

function areaPath(topValues, bottomValueAt) {
  if (!topValues.length) {
    return '';
  }
  const top = topValues.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`);
  const bottom = [];
  for (let i = topValues.length - 1; i >= 0; i -= 1) {
    bottom.push(`L${xAt(i).toFixed(1)},${yAt(bottomValueAt(i)).toFixed(1)}`);
  }
  return `${top.join('')}${bottom.join('')}Z`;
}

function linePath(values) {
  return values.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join('');
}

const gridLines = computed(() => {
  const lines = [];
  for (let g = 0; g <= 2; g += 1) {
    const value = (niceMax.value / 2) * g;
    lines.push({ y: yAt(value), label: compact(value) });
  }
  return lines;
});

const xTicks = computed(() => {
  const n = count.value;
  if (!n) {
    return [];
  }
  const every = Math.max(1, Math.round(n / 6));
  const ticks = [];
  for (let i = 0; i < n; i += every) {
    ticks.push({ x: xAt(i), label: shortDate(points.value[i].date) });
  }
  return ticks;
});

const active = computed(() => (activeIndex.value === null ? null : points.value[activeIndex.value]));
const hasData = computed(() => points.value.some((p) => p.total > 0));

function onMove(event) {
  if (!svgEl.value || count.value === 0) {
    return;
  }
  const rect = svgEl.value.getBoundingClientRect();
  const vbX = ((event.clientX - rect.left) / rect.width) * W;
  let i = step.value ? Math.round((vbX - plotLeft) / step.value) : 0;
  activeIndex.value = Math.min(count.value - 1, Math.max(0, i));
}

function onLeave() {
  activeIndex.value = null;
}

function compact(value) {
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(value >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  }
  if (value >= 1e3) {
    return `${Math.round(value / 1e3)}k`;
  }
  return String(Math.round(value));
}

function shortDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat(localeCode.value, { day: 'numeric', month: 'short' }).format(date);
}

function fullDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  return new Intl.DateTimeFormat(localeCode.value, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
</script>

<template>
  <div class="area-chart">
    <svg
      ref="svgEl"
      :viewBox="`0 0 ${W} ${H}`"
      class="area-chart__svg"
      role="img"
      :aria-label="t('Paid revenue over the last 30 days')"
      @mousemove="onMove"
      @mouseleave="onLeave"
    >
      <!-- gridlines + y labels -->
      <g class="area-chart__grid">
        <line v-for="line in gridLines" :key="line.y" :x1="plotLeft" :x2="plotRight" :y1="line.y" :y2="line.y" />
        <text v-for="line in gridLines" :key="`l-${line.y}`" :x="plotLeft - 8" :y="line.y + 3" text-anchor="end">
          {{ line.label }}
        </text>
      </g>

      <!-- x labels -->
      <g class="area-chart__xaxis">
        <text v-for="tick in xTicks" :key="tick.x" :x="tick.x" :y="H - 8" text-anchor="middle">{{ tick.label }}</text>
      </g>

      <template v-if="hasData">
        <path :d="ordersArea" class="area-chart__fill" :style="{ fill: 'var(--tm-chart-1)' }" />
        <path :d="bookingsArea" class="area-chart__fill" :style="{ fill: 'var(--tm-chart-2)' }" />
        <path :d="eventsArea" class="area-chart__fill" :style="{ fill: '#8065b8' }" />
        <path :d="healthcareArea" class="area-chart__fill" :style="{ fill: '#c05a7d' }" />
        <path :d="ordersLine" class="area-chart__seam" fill="none" />
        <path :d="bookingsLine" class="area-chart__seam" fill="none" />
        <path :d="eventsLine" class="area-chart__seam" fill="none" />
        <path :d="topLine" class="area-chart__line" fill="none" :style="{ stroke: '#c05a7d' }" />

        <!-- hover crosshair -->
        <g v-if="active" class="area-chart__cursor">
          <line :x1="xAt(activeIndex)" :x2="xAt(activeIndex)" :y1="plotTop" :y2="plotBottom" />
          <circle :cx="xAt(activeIndex)" :cy="yAt(active.orders)" r="4.5" :style="{ fill: 'var(--tm-chart-1)' }" />
          <circle :cx="xAt(activeIndex)" :cy="yAt(active.orders + active.bookings)" r="4.5" :style="{ fill: 'var(--tm-chart-2)' }" />
          <circle :cx="xAt(activeIndex)" :cy="yAt(active.orders + active.bookings + active.events)" r="4.5" :style="{ fill: '#8065b8' }" />
          <circle :cx="xAt(activeIndex)" :cy="yAt(active.total)" r="4.5" :style="{ fill: '#c05a7d' }" />
        </g>
      </template>

      <text v-else :x="W / 2" :y="H / 2" text-anchor="middle" class="area-chart__empty">
        {{ t('No confirmed revenue in this window yet.') }}
      </text>
    </svg>

    <div
      v-if="active"
      class="area-chart__tooltip"
      :style="{ left: `${(xAt(activeIndex) / W) * 100}%` }"
      :class="{ 'area-chart__tooltip--right': activeIndex > count / 2 }"
    >
      <p class="area-chart__tooltip-date">{{ fullDate(active.date) }}</p>
      <p><span class="dot" :style="{ background: 'var(--tm-chart-1)' }" /> {{ t('Orders') }}<strong>{{ formatMGA(active.orders) }}</strong></p>
      <p><span class="dot" :style="{ background: 'var(--tm-chart-2)' }" /> {{ t('Bookings') }}<strong>{{ formatMGA(active.bookings) }}</strong></p>
      <p><span class="dot" :style="{ background: '#8065b8' }" /> {{ t('Events') }}<strong>{{ formatMGA(active.events) }}</strong></p>
      <p><span class="dot" :style="{ background: '#c05a7d' }" /> {{ t('Healthcare') }}<strong>{{ formatMGA(active.healthcare) }}</strong></p>
      <p class="area-chart__tooltip-total">{{ t('Total') }}<strong>{{ formatMGA(active.total) }}</strong></p>
    </div>
  </div>
</template>

<style scoped>
.area-chart {
  position: relative;
  width: 100%;
}

.area-chart__svg {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}

.area-chart__fill {
  fill-opacity: 0.82;
}

.area-chart__seam {
  stroke: var(--tm-surface);
  stroke-width: 2.5;
}

.area-chart__line {
  stroke-width: 2;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.area-chart__grid line {
  stroke: var(--tm-grid);
  stroke-width: 1;
}

.area-chart__grid text,
.area-chart__xaxis text {
  fill: var(--tm-muted);
  font-size: 11px;
  font-weight: 700;
}

.area-chart__empty {
  fill: var(--tm-muted);
  font-size: 13px;
  font-weight: 700;
}

.area-chart__cursor line {
  stroke: var(--tm-border-strong);
  stroke-width: 1;
  stroke-dasharray: 3 3;
}

.area-chart__cursor circle {
  stroke: var(--tm-surface);
  stroke-width: 2;
}

.area-chart__tooltip {
  position: absolute;
  top: 6px;
  transform: translateX(-50%);
  min-width: 168px;
  padding: 10px 12px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
  pointer-events: none;
  z-index: 2;
}

.area-chart__tooltip--right {
  transform: translateX(-100%) translateX(-10px);
}

.area-chart__tooltip p {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.area-chart__tooltip p strong {
  margin-left: auto;
  color: var(--tm-heading);
}

.area-chart__tooltip-date {
  margin-bottom: 6px !important;
  color: var(--tm-heading) !important;
  font-weight: 900 !important;
}

.area-chart__tooltip-total {
  margin-top: 6px !important;
  padding-top: 6px;
  border-top: 1px solid var(--tm-border);
}

.area-chart__tooltip .dot {
  width: 9px;
  height: 9px;
  border-radius: 999px;
}
</style>
