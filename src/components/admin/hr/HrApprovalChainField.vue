<script setup>
import { computed } from 'vue';

import { HR_APPROVER_ROLES, HR_APPROVER_LABELS, approverLabel, approverRole } from '@/data/hrAccess';
import { useAdminI18n } from '@/i18n/admin';

// Visual editor for a leave policy's ordered approval chain. It reads and writes
// the exact array the backend expects (role strings, plus any preserved legacy
// entry), so no API/contract change is involved. Order in the list is the order
// of approval.
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue']);
const { t } = useAdminI18n();

const MAX_STEPS = 10;
const roleOptions = computed(() => HR_APPROVER_ROLES.map((value) => ({ value, label: t(HR_APPROVER_LABELS[value]) })));

const steps = computed(() => (props.modelValue || []).map((entry, index) => {
  const role = approverRole(entry);
  return { index, role, editable: role !== null, label: t(approverLabel(entry)) };
}));

function commit(next) {
  if (!props.disabled) emit('update:modelValue', next);
}
function setRole(index, role) {
  commit((props.modelValue || []).map((entry, i) => (i === index ? role : entry)));
}
function addStep() {
  if (props.disabled || steps.value.length >= MAX_STEPS) return;
  commit([...(props.modelValue || []), 'manager']);
}
function removeStep(index) {
  if (props.disabled || steps.value.length <= 1) return;
  commit((props.modelValue || []).filter((_, i) => i !== index));
}
function move(index, delta) {
  const target = index + delta;
  if (props.disabled || target < 0 || target >= steps.value.length) return;
  const next = [...(props.modelValue || [])];
  [next[index], next[target]] = [next[target], next[index]];
  commit(next);
}
</script>

<template>
  <div class="hr-chain">
    <ol class="hr-chain__list">
      <li v-for="step in steps" :key="step.index" class="hr-chain__step">
        <span class="hr-chain__num">{{ step.index + 1 }}</span>
        <Select
          v-if="step.editable"
          :model-value="step.role"
          :options="roleOptions"
          option-label="label"
          option-value="value"
          :disabled="disabled"
          class="hr-chain__select"
          @update:model-value="setRole(step.index, $event)"
        />
        <span v-else class="hr-chain__legacy" :title="t('Configured outside this editor and kept as-is.')">
          <i class="pi pi-lock" /> {{ step.label }}
        </span>
        <div class="hr-chain__actions">
          <Button
            icon="pi pi-arrow-up"
            text
            rounded
            severity="secondary"
            :disabled="disabled || step.index === 0"
            :aria-label="t('Move up')"
            @click="move(step.index, -1)"
          />
          <Button
            icon="pi pi-arrow-down"
            text
            rounded
            severity="secondary"
            :disabled="disabled || step.index === steps.length - 1"
            :aria-label="t('Move down')"
            @click="move(step.index, 1)"
          />
          <Button
            icon="pi pi-times"
            text
            rounded
            severity="danger"
            :disabled="disabled || steps.length <= 1"
            :aria-label="t('Remove step')"
            @click="removeStep(step.index)"
          />
        </div>
      </li>
    </ol>
    <Button
      type="button"
      :label="t('Add step')"
      icon="pi pi-plus"
      size="small"
      severity="secondary"
      outlined
      :disabled="disabled || steps.length >= MAX_STEPS"
      @click="addStep"
    />
  </div>
</template>

<style scoped>
.hr-chain { display: grid; gap: 10px; }
.hr-chain__list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.hr-chain__step { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--tm-border); border-radius: 11px; background: var(--tm-surface); }
.hr-chain__num { display: grid; width: 26px; height: 26px; flex: 0 0 auto; border-radius: 8px; background: var(--tm-charcoal); color: var(--tm-gold); font-size: 0.8rem; font-weight: 900; place-items: center; }
.hr-chain__select { flex: 1 1 auto; min-width: 0; }
.hr-chain__select :deep(.p-select) { width: 100%; }
.hr-chain__legacy { display: inline-flex; flex: 1 1 auto; align-items: center; gap: 7px; color: var(--tm-muted); font-size: 0.82rem; font-weight: 700; }
.hr-chain__actions { display: flex; flex: 0 0 auto; gap: 2px; }
</style>
