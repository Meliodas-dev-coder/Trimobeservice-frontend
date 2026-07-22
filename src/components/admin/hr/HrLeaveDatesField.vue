<script setup>
import { ref, watch } from 'vue';

import { useAdminI18n } from '@/i18n/admin';

// Leave date picker for the request form. A checkbox switches between a single
// day and a date range, and it writes the plain start_date / end_date /
// start_portion / end_portion the backend already expects — no contract change.
//
// Pickers bind to *local* refs (stable references) and we push those into the
// models; binding PrimeVue's v-model straight to a computed that returns a fresh
// array every render makes it re-emit and can trip Vue's recursive-update guard.
const start = defineModel('start');
const end = defineModel('end');
const startPortion = defineModel('startPortion');
const endPortion = defineModel('endPortion');
defineProps({ minDate: { type: Date, default: null } });
const { t } = useAdminI18n();

function sameDay(a, b) {
  return a instanceof Date && b instanceof Date && a.toDateString() === b.toDateString();
}

// Seeded once from the models; the parent re-mounts this component on each open
// (via :key), so setup runs fresh for every record.
const multiple = ref(Boolean(start.value && end.value && !sameDay(start.value, end.value)));
const singleDate = ref(start.value || null);
const rangeDates = ref(start.value ? [start.value, end.value || start.value] : null);
const halfStart = ref(startPortion.value === 'half');
const halfEnd = ref(endPortion.value === 'half');

function pushToModels() {
  if (multiple.value) {
    const [a, b] = Array.isArray(rangeDates.value) ? rangeDates.value : [null, null];
    start.value = a || null;
    end.value = b || a || null;
    startPortion.value = halfStart.value ? 'half' : 'full';
    endPortion.value = halfEnd.value ? 'half' : 'full';
  } else {
    start.value = singleDate.value || null;
    end.value = singleDate.value || null;
    const portion = halfStart.value ? 'half' : 'full';
    startPortion.value = portion;
    endPortion.value = portion;
  }
}

watch([singleDate, rangeDates, halfStart, halfEnd], pushToModels, { deep: true });

function toggleMultiple(next) {
  multiple.value = next;
  if (next) {
    const base = singleDate.value || null;
    rangeDates.value = base ? [base, base] : null;
  } else {
    singleDate.value = (Array.isArray(rangeDates.value) && rangeDates.value[0]) || singleDate.value || null;
  }
  pushToModels();
}
</script>

<template>
  <div class="hr-leave-dates">
    <div class="hr-leave-dates__mode">
      <Checkbox input-id="hr-leave-multi" :model-value="multiple" binary @update:model-value="toggleMultiple" />
      <label for="hr-leave-multi">{{ t('Multiple days') }}</label>
    </div>

    <DatePicker
      v-if="!multiple"
      v-model="singleDate"
      selection-mode="single"
      show-icon
      date-format="yy-mm-dd"
      :min-date="minDate"
      fluid
    />
    <DatePicker
      v-else
      v-model="rangeDates"
      selection-mode="range"
      :number-of-months="2"
      show-icon
      date-format="yy-mm-dd"
      :min-date="minDate"
      fluid
    />

    <div class="hr-leave-dates__opts">
      <div v-if="!multiple" class="hr-leave-dates__opt">
        <Checkbox input-id="hr-leave-half" v-model="halfStart" binary />
        <label for="hr-leave-half">{{ t('Half day') }}</label>
      </div>
      <template v-else>
        <div class="hr-leave-dates__opt">
          <Checkbox input-id="hr-leave-first-half" v-model="halfStart" binary />
          <label for="hr-leave-first-half">{{ t('First day is a half-day') }}</label>
        </div>
        <div class="hr-leave-dates__opt">
          <Checkbox input-id="hr-leave-last-half" v-model="halfEnd" binary />
          <label for="hr-leave-last-half">{{ t('Last day is a half-day') }}</label>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.hr-leave-dates { display: grid; gap: 10px; }
.hr-leave-dates__mode { display: flex; align-items: center; gap: 8px; }
.hr-leave-dates__mode label { color: var(--tm-heading); font-size: 0.82rem; font-weight: 800; }
.hr-leave-dates :deep(.p-datepicker) { width: 100%; }
.hr-leave-dates__opts { display: flex; flex-wrap: wrap; gap: 14px; }
.hr-leave-dates__opt { display: flex; align-items: center; gap: 7px; }
.hr-leave-dates__opt label { color: var(--tm-muted); font-size: 0.8rem; font-weight: 700; }
</style>
