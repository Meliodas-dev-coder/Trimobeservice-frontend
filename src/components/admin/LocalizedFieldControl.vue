<script setup>
import { computed, ref } from 'vue';

import { useAdminI18n } from '@/i18n/admin';
import { CONTENT_LOCALES } from '@/utils/localized';

const props = defineProps({
  field: { type: Object, required: true },
  modelValue: { type: [String, Number], default: '' },
  translations: { type: Object, default: () => ({}) },
});

const emit = defineEmits(['update:modelValue', 'update:translation']);
const { language, t } = useAdminI18n();

const activeLocale = ref(language.value === 'fr' ? 'en' : 'fr');
const isLong = computed(() => props.field.type === 'textarea');

const baseValue = computed({
  get: () => props.modelValue ?? '',
  set: (value) => emit('update:modelValue', value),
});

const translationValue = computed({
  get: () => props.translations?.[props.field.key]?.[activeLocale.value] ?? '',
  set: (value) => emit('update:translation', {
    field: props.field.key,
    locale: activeLocale.value,
    value,
  }),
});

function setLocale(locale) {
  activeLocale.value = locale;
}
</script>

<template>
  <div class="localized-control">
    <Textarea
      v-if="isLong"
      v-model="baseValue"
      :placeholder="field.placeholder"
      rows="3"
      autoResize
    />
    <InputText v-else v-model="baseValue" :placeholder="field.placeholder" />

    <div class="localized-control__bar">
      <span>{{ t('Translations') }}</span>
      <div class="localized-control__tabs">
        <Button
          v-for="locale in CONTENT_LOCALES"
          :key="locale.code"
          type="button"
          :label="locale.label"
          size="small"
          :severity="activeLocale === locale.code ? 'primary' : 'secondary'"
          :outlined="activeLocale !== locale.code"
          @click="setLocale(locale.code)"
        />
      </div>
    </div>

    <Textarea
      v-if="isLong"
      v-model="translationValue"
      :placeholder="t('{lang} version', { lang: activeLocale.toUpperCase() })"
      rows="3"
      autoResize
    />
    <InputText
      v-else
      v-model="translationValue"
      :placeholder="t('{lang} version', { lang: activeLocale.toUpperCase() })"
    />
  </div>
</template>

<style scoped>
.localized-control {
  display: grid;
  gap: 9px;
  min-width: 0;
}

.localized-control__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.localized-control__bar span {
  color: var(--tm-muted);
  font-size: 0.76rem;
  font-weight: 820;
}

.localized-control__tabs {
  display: inline-flex;
  gap: 6px;
}

.localized-control :deep(.p-inputtext),
.localized-control :deep(.p-textarea) {
  width: 100%;
}
</style>
