<script setup>
import { computed } from 'vue';

const props = defineProps({
  // [{ label, value: Number, color: 'var(--tm-chart-1)' }]
  items: { type: Array, default: () => [] },
});

const max = computed(() => props.items.reduce((m, item) => Math.max(m, Number(item.value || 0)), 0));
const totalValue = computed(() => props.items.reduce((sum, item) => sum + Number(item.value || 0), 0));

function width(item) {
  if (max.value <= 0) {
    return 0;
  }
  // Floor non-zero bars at a visible sliver so a count of 1 never disappears.
  return Math.max((Number(item.value || 0) / max.value) * 100, item.value ? 6 : 0);
}
</script>

<template>
  <div v-if="totalValue > 0" class="bars">
    <div v-for="item in items" :key="item.label" class="bars__row" :title="`${item.label}: ${item.value}`">
      <span class="bars__label">{{ item.label }}</span>
      <span class="bars__track">
        <span class="bars__fill" :style="{ width: `${width(item)}%`, background: item.color }" />
      </span>
      <span class="bars__value">{{ item.value }}</span>
    </div>
  </div>
  <p v-else class="bars__empty">{{ $slots.empty ? '' : '—' }}<slot name="empty" /></p>
</template>

<style scoped>
.bars {
  display: grid;
  gap: 10px;
}

.bars__row {
  display: grid;
  grid-template-columns: 116px minmax(0, 1fr) 34px;
  align-items: center;
  gap: 12px;
}

.bars__label {
  overflow: hidden;
  color: var(--tm-text);
  font-size: 0.86rem;
  font-weight: 750;
  text-overflow: ellipsis;
  text-transform: capitalize;
  white-space: nowrap;
}

.bars__track {
  height: 12px;
  border-radius: 999px;
  background: var(--tm-grid);
}

.bars__fill {
  display: block;
  height: 100%;
  min-width: 12px;
  border-radius: 999px;
  transition: width 320ms ease;
}

.bars__value {
  color: var(--tm-heading);
  font-size: 0.9rem;
  font-weight: 850;
  text-align: right;
}

.bars__empty {
  margin: 0;
  padding: 8px 0;
  color: var(--tm-muted);
  font-weight: 700;
}
</style>
