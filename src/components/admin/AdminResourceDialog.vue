<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

import { loadFieldOptions, uploadImage } from '@/api/resources';

const toast = useToast();

const props = defineProps({
  visible: { type: Boolean, required: true },
  title: { type: String, default: 'Save' },
  fields: { type: Array, required: true },
  initial: { type: Object, default: null }, // row being edited, or null when creating
  defaults: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  errors: { type: Object, default: () => ({}) }, // field key -> server error message
});

const emit = defineEmits(['update:visible', 'submit']);

const draft = reactive({});
const optionsMap = reactive({}); // field.key -> [{ label, value }]
const pendingFiles = reactive({}); // field.key -> File (selected, not yet uploaded)
const previews = reactive({}); // field.key -> local object URL for preview
const submitting = ref(false); // true while uploading images during save

const isOpen = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const canSave = computed(() =>
  props.fields.every((field) => {
    if (!field.required) {
      return true;
    }
    if (field.type === 'image') {
      return Boolean(pendingFiles[field.key] || draft[field.key]);
    }
    const value = draft[field.key];
    return value !== null && value !== undefined && value !== '';
  }),
);

function fieldDefault(field) {
  if (field.defaultValue instanceof Function) {
    return field.defaultValue();
  }
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  if (props.defaults[field.key] !== undefined) {
    return props.defaults[field.key];
  }
  if (field.type === 'number' || field.type === 'money') {
    return null;
  }
  return '';
}

function initialValue(field) {
  const raw = props.initial ? props.initial[field.key] : undefined;
  if (raw !== undefined && raw !== null) {
    if (field.type === 'money' || field.type === 'number') {
      return Number(raw);
    }
    return raw;
  }
  return fieldDefault(field);
}

function clearPending() {
  Object.values(previews).forEach((url) => URL.revokeObjectURL(url));
  Object.keys(previews).forEach((key) => delete previews[key]);
  Object.keys(pendingFiles).forEach((key) => delete pendingFiles[key]);
}

function resetDraft() {
  clearPending();
  Object.keys(draft).forEach((key) => delete draft[key]);
  props.fields.forEach((field) => {
    draft[field.key] = initialValue(field);
  });
}

async function loadRelationOptions() {
  for (const field of props.fields) {
    if (field.optionsEndpoint) {
      try {
        optionsMap[field.key] = await loadFieldOptions(field);
      } catch {
        optionsMap[field.key] = [];
      }
    }
  }
}

function optionsFor(field) {
  return optionsMap[field.key] || field.options || [];
}

// --- image fields: pick now, upload on save ---

function onFileChange(event, field) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) {
    return;
  }
  if (previews[field.key]) {
    URL.revokeObjectURL(previews[field.key]);
  }
  pendingFiles[field.key] = file;
  previews[field.key] = URL.createObjectURL(file);
}

function imageSrc(field) {
  return previews[field.key] || draft[field.key] || '';
}

function hasImage(field) {
  return Boolean(pendingFiles[field.key] || draft[field.key]);
}

function removeImage(field) {
  if (previews[field.key]) {
    URL.revokeObjectURL(previews[field.key]);
  }
  delete previews[field.key];
  delete pendingFiles[field.key];
  draft[field.key] = '';
}

function closeDialog() {
  isOpen.value = false;
}

async function submitForm() {
  if (!canSave.value || submitting.value || props.loading) {
    return;
  }
  // Upload any selected image files first; if any upload fails, abort the save.
  submitting.value = true;
  try {
    for (const field of props.fields) {
      if (field.type === 'image' && pendingFiles[field.key]) {
        const { url } = await uploadImage(pendingFiles[field.key]);
        draft[field.key] = url;
        if (previews[field.key]) {
          URL.revokeObjectURL(previews[field.key]);
        }
        delete previews[field.key];
        delete pendingFiles[field.key];
      }
    }
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Image upload failed',
      detail: err?.message || 'The image could not be uploaded, so nothing was saved.',
      life: 5000,
    });
    submitting.value = false;
    return;
  }
  submitting.value = false;
  emit('submit', { ...draft });
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      resetDraft();
      loadRelationOptions();
    } else {
      clearPending();
    }
  },
);
</script>

<template>
  <Dialog v-model:visible="isOpen" modal :header="title" style="width: 50vw" class="resource-dialog" :draggable="false">
    <form class="resource-form" @submit.prevent="submitForm">
      <label v-for="field in fields" :key="field.key" class="resource-form__field">
        <span class="resource-form__label">
          {{ field.label }}
          <small v-if="field.required">*</small>
        </span>

        <Textarea
          v-if="field.type === 'textarea'"
          v-model="draft[field.key]"
          :placeholder="field.placeholder"
          rows="3"
          autoResize
        />

        <InputNumber
          v-else-if="field.type === 'money'"
          v-model="draft[field.key]"
          :min="0"
          :useGrouping="true"
          suffix=" MGA"
          fluid
        />

        <InputNumber
          v-else-if="field.type === 'number'"
          v-model="draft[field.key]"
          :useGrouping="false"
          fluid
        />

        <DatePicker
          v-else-if="field.type === 'date'"
          v-model="draft[field.key]"
          showIcon
          fluid
          dateFormat="dd M yy"
        />

        <Select
          v-else-if="field.type === 'select'"
          v-model="draft[field.key]"
          :options="optionsFor(field)"
          optionLabel="label"
          optionValue="value"
          :placeholder="field.placeholder || `Choose ${field.label.toLowerCase()}`"
          :showClear="!field.required"
          fluid
        />

        <div v-else-if="field.type === 'image'" class="image-field">
          <div v-if="imageSrc(field)" class="image-field__preview">
            <img :src="imageSrc(field)" alt="preview" />
            <Button
              type="button"
              icon="pi pi-times"
              text
              rounded
              severity="secondary"
              aria-label="Remove image"
              @click="removeImage(field)"
            />
          </div>
          <label class="image-field__pick">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="onFileChange($event, field)" />
            <span>
              <i class="pi pi-upload" />
              {{ hasImage(field) ? 'Replace image' : 'Select image' }}
            </span>
          </label>
        </div>

        <InputText v-else v-model="draft[field.key]" :placeholder="field.placeholder" />

        <small v-if="errors[field.key]" class="resource-form__error">{{ errors[field.key] }}</small>
      </label>

      <div class="resource-form__actions">
        <Button type="button" label="Cancel" icon="pi pi-times" severity="secondary" outlined @click="closeDialog" />
        <Button type="submit" label="Save" icon="pi pi-check" :disabled="!canSave || submitting || loading" :loading="submitting || loading" />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
.resource-dialog {
  width: 50vw;
}

.resource-form {
  display: grid;
  gap: 16px;
  padding-top: 4px;
}

.resource-form__field {
  display: grid;
  gap: 7px;
}

.resource-form__label {
  color: var(--tm-muted);
  font-size: 0.84rem;
  font-weight: 820;
}

.resource-form__label small {
  color: var(--tm-coral);
}

.resource-form__error {
  color: var(--tm-coral, #d9534f);
  font-size: 0.78rem;
  font-weight: 700;
}

.image-field {
  display: grid;
  gap: 10px;
}

.image-field__preview {
  position: relative;
  width: fit-content;
}

.image-field__preview img {
  display: block;
  max-width: 200px;
  max-height: 150px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
}

.image-field__preview :deep(.p-button) {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--tm-surface);
}

.image-field__pick input {
  display: none;
}

.image-field__pick span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border: 1px dashed var(--tm-border);
  border-radius: 8px;
  color: var(--tm-muted);
  font-weight: 800;
  cursor: pointer;
}

.image-field__pick span:hover {
  color: var(--tm-heading);
  border-color: var(--tm-gold);
}

.resource-form__field :deep(.p-inputtext),
.resource-form__field :deep(.p-inputnumber),
.resource-form__field :deep(.p-inputnumber-input),
.resource-form__field :deep(.p-select),
.resource-form__field :deep(.p-datepicker),
.resource-form__field :deep(.p-textarea) {
  width: 100%;
}

.resource-form__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

@media (max-width: 520px) {
  .resource-form__actions {
    flex-direction: column-reverse;
  }

  .resource-form__actions .p-button {
    width: 100%;
  }
}
</style>
