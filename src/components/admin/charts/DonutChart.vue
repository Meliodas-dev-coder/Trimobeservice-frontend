<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  // [{ label, value: Number, color: 'var(--tm-chart-1)' }]
  segments: { type: Array, default: () => [] },
  centerLabel: { type: String, default: '' },
  centerValue: { type: String, default: '' },
  formatValue: { type: Function, default: (v) => String(v) },
});

const GAP = 2; // percent of the ring left blank between segments
const activeIndex = ref(null);

const total = computed(() => props.segments.reduce((sum, s) => sum + Number(s.value || 0), 0));

const arcs = computed(() => {
  if (total.value <= 0) {
    return [];
  }
  let cursor = 0;
  return props.segments.map((seg, index) => {
    const pct = (Number(seg.value || 0) / total.value) * 100;
    const len = Math.max(pct - GAP, 0.6);
    const arc = {
      index,
      label: seg.label,
      value: Number(seg.value || 0),
      color: seg.color,
      pct,
      dash: `${len} ${100 - len}`,
      offset: -cursor,
    };
    cursor += pct;
    return arc;
  });
});

const active = computed(() => (activeIndex.value === null ? null : arcs.value[activeIndex.value]));

const centerTop = computed(() => (active.value ? active.value.label : props.centerLabel));
const centerMain = computed(() => (active.value ? props.formatValue(active.value.value) : props.centerValue));
const centerSub = computed(() => (active.value ? `${Math.round(active.value.pct)}%` : ''));

function percent(seg) {
  return total.value > 0 ? Math.round((Number(seg.value || 0) / total.value) * 100) : 0;
}
</script>

<template>
  <div class="donut">
    <div class="donut__ring">
      <svg viewBox="0 0 42 42" role="img">
        <circle class="donut__track" cx="21" cy="21" r="15.915" fill="none" pathLength="100" />
        <g transform="rotate(-90 21 21)">
          <circle
            v-for="arc in arcs"
            :key="arc.index"
            class="donut__seg"
            :class="{ 'donut__seg--dim': activeIndex !== null && activeIndex !== arc.index }"
            cx="21"
            cy="21"
            r="15.915"
            fill="none"
            pathLength="100"
            :stroke-dasharray="arc.dash"
            :stroke-dashoffset="arc.offset"
            :style="{ stroke: arc.color }"
            @mouseenter="activeIndex = arc.index"
            @mouseleave="activeIndex = null"
          />
        </g>
      </svg>
      <div class="donut__center">
        <span class="donut__center-top">{{ centerTop }}</span>
        <strong class="donut__center-main">{{ centerMain }}</strong>
        <span v-if="centerSub" class="donut__center-sub">{{ centerSub }}</span>
      </div>
    </div>

    <ul class="donut__legend">
      <li
        v-for="arc in arcs"
        :key="arc.index"
        :class="{ 'is-active': activeIndex === arc.index }"
        @mouseenter="activeIndex = arc.index"
        @mouseleave="activeIndex = null"
      >
        <span class="donut__swatch" :style="{ background: arc.color }" />
        <span class="donut__legend-label">{{ arc.label }}</span>
        <span class="donut__legend-value">{{ formatValue(arc.value) }}</span>
        <span class="donut__legend-pct">{{ percent(arc) }}%</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.donut {
  display: grid;
  gap: 18px;
  grid-template-columns: 148px minmax(0, 1fr);
  align-items: center;
}

.donut__ring {
  position: relative;
  width: 148px;
  height: 148px;
}

.donut__ring svg {
  width: 100%;
  height: 100%;
}

.donut__track {
  stroke: var(--tm-grid);
  stroke-width: 3.4;
}

.donut__seg {
  stroke-width: 4.2;
  stroke-linecap: round;
  transition: stroke-width 140ms ease, opacity 140ms ease;
  cursor: pointer;
}

.donut__seg--dim {
  opacity: 0.42;
}

.donut__center {
  position: absolute;
  inset: 0;
  display: grid;
  align-content: center;
  justify-items: center;
  gap: 2px;
  text-align: center;
  pointer-events: none;
}

.donut__center-top {
  max-width: 118px;
  overflow: hidden;
  color: var(--tm-muted);
  font-size: 0.72rem;
  font-weight: 800;
  text-overflow: ellipsis;
  text-transform: capitalize;
  white-space: nowrap;
}

.donut__center-main {
  color: var(--tm-heading);
  font-size: 1.02rem;
  line-height: 1.1;
}

.donut__center-sub {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 800;
}

.donut__legend {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.donut__legend li {
  display: grid;
  grid-template-columns: 12px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 9px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: default;
}

.donut__legend li.is-active {
  background: var(--tm-surface-soft);
}

.donut__swatch {
  width: 11px;
  height: 11px;
  border-radius: 3px;
}

.donut__legend-label {
  overflow: hidden;
  color: var(--tm-text);
  font-size: 0.86rem;
  font-weight: 750;
  text-overflow: ellipsis;
  text-transform: capitalize;
  white-space: nowrap;
}

.donut__legend-value {
  color: var(--tm-heading);
  font-size: 0.86rem;
  font-weight: 850;
}

.donut__legend-pct {
  min-width: 34px;
  color: var(--tm-muted);
  font-size: 0.8rem;
  font-weight: 800;
  text-align: right;
}

@media (max-width: 520px) {
  .donut {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .donut__legend {
    width: 100%;
  }
}
</style>
