<script setup>
import { useAdminI18n } from '@/i18n/admin';

// Renders a product template's dynamic fields (product specs or variant axes)
// into a shared attributes object. Used by both the product screen and the
// variant dialog. Values are written straight onto the passed object.
const props = defineProps({
  fields: { type: Array, default: () => [] },
  modelValue: { type: Object, default: () => ({}) },
  errors: { type: Object, default: () => ({}) }, // keyed "attributes.<key>"
  errorPrefix: { type: String, default: 'attributes.' },
});

const { t } = useAdminI18n();

function errorFor(field) {
  return props.errors[`${props.errorPrefix}${field.key}`];
}
</script>

<template>
  <div class="spec-grid">
    <label
      v-for="field in fields"
      :key="field.key"
      class="spec-field"
      :class="{ 'spec-field--wide': field.type === 'bool' }"
    >
      <span class="spec-field__label">
        {{ t(field.label) }}
        <small v-if="field.required">*</small>
      </span>

      <InputNumber
        v-if="field.type === 'number'"
        v-model="modelValue[field.key]"
        :useGrouping="false"
        :suffix="field.unit ? ` ${field.unit}` : ''"
        fluid
      />

      <div v-else-if="field.type === 'bool'" class="spec-check">
        <Checkbox v-model="modelValue[field.key]" binary :inputId="`spec-${field.key}`" />
        <span>{{ t(field.label) }}</span>
      </div>

      <Select
        v-else-if="field.type === 'select'"
        v-model="modelValue[field.key]"
        :options="field.options"
        :placeholder="t('Choose {field}', { field: t(field.label).toLowerCase() })"
        showClear
        fluid
      />

      <InputText v-else v-model="modelValue[field.key]" />

      <small v-if="errorFor(field)" class="spec-field__error">{{ t(errorFor(field)) }}</small>
    </label>
  </div>
</template>

<style scoped>
.spec-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.spec-field {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.spec-field--wide {
  grid-column: 1 / -1;
}

.spec-field__label {
  color: var(--tm-muted);
  font-size: 0.84rem;
  font-weight: 820;
}

.spec-field__label small {
  color: var(--tm-coral);
}

.spec-field__error {
  color: var(--tm-coral);
  font-size: 0.78rem;
  font-weight: 700;
}

.spec-check {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  color: var(--tm-heading);
  font-weight: 800;
}

.spec-field :deep(.p-inputtext),
.spec-field :deep(.p-inputnumber),
.spec-field :deep(.p-inputnumber-input),
.spec-field :deep(.p-select) {
  width: 100%;
}

@media (max-width: 640px) {
  .spec-grid {
    grid-template-columns: 1fr;
  }
}
</style>
