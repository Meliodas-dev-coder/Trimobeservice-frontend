<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

import { api } from '@/api/client';
import { loadFieldOptions, uploadImage } from '@/api/resources';
import { useAdminI18n } from '@/i18n/admin';
import { getDrivingDistanceKm } from '@/utils/googleMaps';
import GooglePlaceInput from '@/components/GooglePlaceInput.vue';
import DynamicSpecFields from '@/components/admin/DynamicSpecFields.vue';
import LocalizedFieldControl from '@/components/admin/LocalizedFieldControl.vue';
import { cloneTranslations, ensureTranslationBucket } from '@/utils/localized';

const toast = useToast();
const { t } = useAdminI18n();

const props = defineProps({
  visible: { type: Boolean, required: true },
  title: { type: String, default: 'Save' },
  fields: { type: Array, required: true },
  initial: { type: Object, default: null }, // row being edited, or null when creating
  defaults: { type: Object, default: () => ({}) },
  loading: { type: Boolean, default: false },
  errors: { type: Object, default: () => ({}) }, // field key -> server error message
  templateKey: { type: String, default: '' }, // fixes the attributes template (variant form)
  department: { type: String, default: '' }, // scopes department-aware selects to a section
});

const emit = defineEmits(['update:visible', 'submit']);

const draft = reactive({});
const optionsMap = reactive({}); // field.key -> [{ label, value }]
const pendingFiles = reactive({}); // field.key -> File (selected, not yet uploaded)
const previews = reactive({}); // field.key -> local object URL for preview
const placeMeta = reactive({}); // field.key -> selected prediction
const submitting = ref(false); // true while uploading images during save
const computingDistance = ref(false);

// Booking form only: the selected car's existing rental schedule, shown so the
// admin can eyeball overlaps before submitting. Refetched whenever the car changes.
const carBookings = ref([]);
const carScheduleLoading = ref(false);

const isOpen = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const visibleFields = computed(() => props.fields.filter((field) => fieldVisible(field)));

// True when this dialog is driving the booking form (it carries a `car_id` field).
const hasCarSchedule = computed(() => props.fields.some((field) => field.key === 'car_id'));

// --- dynamic category-driven attributes ---
const templates = ref([]); // product-type registry from /admin/product-templates

const attributeField = computed(() => props.fields.find((field) => field.type === 'attributes') || null);

// The template key for the active attributes: from the chosen category (product
// form) or a fixed key passed in (variant form).
const activeTemplateKey = computed(() => {
  const af = attributeField.value;
  if (!af) {
    return '';
  }
  if (af.categoryField) {
    return optionFor(af.categoryField)?.item?.template_key || '';
  }
  return props.templateKey || '';
});

const activeTemplate = computed(() => templates.value.find((tpl) => tpl.key === activeTemplateKey.value) || null);

// The spec fields to render (product_fields or variant_axes of the active template).
const attributeFields = computed(() => {
  const af = attributeField.value;
  return af && activeTemplate.value ? activeTemplate.value[af.scope] || [] : [];
});

const standardFields = computed(() => visibleFields.value.filter((field) => field.type !== 'attributes'));
const localizedFields = computed(() => props.fields.filter((field) => field.localized));

const canSave = computed(() => {
  const requiredOk = standardFields.value.every((field) => {
    if (!isRequired(field)) {
      return true;
    }
    if (field.type === 'image') {
      return Boolean(pendingFiles[field.key] || draft[field.key]);
    }
    const value = draft[field.key];
    return value !== null && value !== undefined && value !== '';
  });
  const attrsOk = attributeFields.value.every((af) => {
    if (!af.required) {
      return true;
    }
    const value = draft.attributes?.[af.key];
    return value !== null && value !== undefined && value !== '';
  });
  return requiredOk && attrsOk;
});

function optionFor(key) {
  return (optionsMap[key] || []).find((option) => option.value === draft[key]) || null;
}

function fieldVisible(field) {
  if (!field.showWhen) {
    return true;
  }
  return field.showWhen(draft, { optionFor });
}

function isRequired(field) {
  return Boolean(field.required || (field.requiredWhen && field.requiredWhen(draft, { optionFor })));
}

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
  Object.keys(placeMeta).forEach((key) => delete placeMeta[key]);
  carBookings.value = [];
}

// Attributes may arrive as an object (parsed JSON) or a JSON string; always work
// on a fresh copy so we never mutate the source row.
function cloneAttributes(raw) {
  if (!raw) {
    return {};
  }
  if (typeof raw === 'string') {
    try {
      return { ...JSON.parse(raw) };
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? { ...raw } : {};
}

function resetDraft() {
  clearPending();
  Object.keys(draft).forEach((key) => delete draft[key]);
  props.fields.forEach((field) => {
    const value = initialValue(field);
    draft[field.key] = value;
  });
  if (localizedFields.value.length) {
    draft.translations = cloneTranslations(props.initial?.translations);
    localizedFields.value.forEach((field) => ensureTranslationBucket(draft.translations, field.key));
  }
  if (attributeField.value) {
    draft.attributes = cloneAttributes(props.initial?.attributes);
  }
}

async function loadTemplates() {
  const af = attributeField.value;
  if (!af) {
    return;
  }
  try {
    const data = await api.get(af.templatesEndpoint || '/admin/product-templates');
    templates.value = data?.[af.collectionKey || 'templates'] || [];
  } catch {
    templates.value = [];
  }
}

async function loadRelationOptions() {
  for (const field of props.fields) {
    if (!field.optionsEndpoint) {
      continue;
    }
    const scoped = field.scopeByDepartment && props.department;
    try {
      let opts = await loadFieldOptions(field, scoped ? { department: props.department } : {});
      if (scoped) {
        // Endpoints that don't filter server-side (product-templates) still carry
        // `department` per item; drop anything from another department.
        opts = opts.filter((o) => !o.item?.department || o.item.department === props.department);
        // If the draft's default (e.g. 'generic') isn't in this department, snap to
        // the first valid option so we never submit a cross-department value.
        if (!opts.some((o) => o.value === draft[field.key])) {
          draft[field.key] = opts[0]?.value ?? '';
        }
      }
      optionsMap[field.key] = opts;
    } catch {
      optionsMap[field.key] = [];
    }
  }
}

function optionsFor(field) {
  return optionsMap[field.key] || field.options || [];
}

function setTranslation({ field, locale, value }) {
  if (!draft.translations) {
    draft.translations = {};
  }
  ensureTranslationBucket(draft.translations, field)[locale] = value;
}

function fieldMinDate(field) {
  if (!field.minDate) {
    return undefined;
  }
  return field.minDate instanceof Function ? field.minDate() : field.minDate;
}

function handleFieldChange(field) {
  if (field.key !== 'car_id') {
    return;
  }
  loadCarSchedule();
  if (isSelectedCarCargo()) {
    draft.start_at = null;
    draft.end_at = null;
    maybeComputeDistance();
    return;
  }

  draft.cargo_service_date = null;
  clearRouteField('dropoff_location');
  clearComputedDistance();
}

// Fetch the picked car's bookings so the date pickers can mark/disable the days
// already taken. Clears when no car is chosen (or this isn't the booking form).
async function loadCarSchedule() {
  const carId = draft.car_id;
  if (!hasCarSchedule.value || !carId) {
    carBookings.value = [];
    return;
  }
  carScheduleLoading.value = true;
  try {
    const data = await api.get(`/admin/cars/${carId}/overview`);
    carBookings.value = data?.bookings || [];
  } catch {
    carBookings.value = [];
  } finally {
    carScheduleLoading.value = false;
  }
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Every individual day covered by a non-cancelled booking of the selected car,
// as JS Dates — fed to the date pickers' `disabledDates` so those days can't be
// booked again.
const takenDates = computed(() => {
  const dates = [];
  for (const booking of carBookings.value) {
    if (booking.status === 'cancelled') {
      continue;
    }
    const start = new Date(booking.start_at);
    const end = new Date(booking.end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      continue;
    }
    let cursor = startOfDay(start);
    const last = startOfDay(end);
    // Guard against bad ranges running away (cap at ~2 years of days).
    for (let guard = 0; cursor <= last && guard < 800; guard += 1) {
      dates.push(cursor);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
    }
  }
  return dates;
});

// Fast lookup ("year-monthIndex-day") for marking booked cells in the picker.
const takenKeys = computed(() => new Set(takenDates.value.map((d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)));

// Disable booked days on the booking form's date/datetime fields only.
function fieldDisabledDates(field) {
  if (!hasCarSchedule.value || (field.type !== 'date' && field.type !== 'datetime')) {
    return undefined;
  }
  return takenDates.value;
}

// slotProps.date from PrimeVue's date picker: { day, month (0-based), year, ... }.
function isDateTaken(cell) {
  return takenKeys.value.has(`${cell.year}-${cell.month}-${cell.day}`);
}

function isSelectedCarCargo() {
  return Boolean(optionFor('car_id')?.item?.is_cargo_transport);
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

function handlePlaceSelect(selection, field) {
  draft[field.key] = selection.value || selection.prediction?.description || '';
  placeMeta[field.key] = selection.prediction;
  if (field.key === 'pickup_location' || field.key === 'dropoff_location') {
    clearComputedDistance();
  }
  maybeComputeDistance();
}

function handlePlaceClear(field) {
  delete placeMeta[field.key];
  if (field.key === 'pickup_location' || field.key === 'dropoff_location') {
    clearComputedDistance();
  }
}

function clearRouteField(key) {
  draft[key] = '';
  delete placeMeta[key];
}

function clearComputedDistance() {
  draft.distance_km = null;
}

async function maybeComputeDistance() {
  if (!isSelectedCarCargo()) {
    return;
  }
  const origin = placeMeta.pickup_location?.place_id;
  const destination = placeMeta.dropoff_location?.place_id;
  if (!origin || !destination) {
    return;
  }
  computingDistance.value = true;
  try {
    draft.distance_km = await getDrivingDistanceKm(origin, destination);
  } catch (err) {
    clearComputedDistance();
    toast.add({
      severity: 'warn',
      summary: t('Distance not computed'),
      detail: t(err?.message || 'Choose another route from the Google suggestions.'),
      life: 4000,
    });
  } finally {
    computingDistance.value = false;
  }
}

async function submitForm() {
  if (!canSave.value || submitting.value || props.loading) {
    return;
  }
  // Upload any selected image files first; if any upload fails, abort the save.
  submitting.value = true;
  try {
    for (const field of visibleFields.value) {
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
      summary: t('Image upload failed'),
      detail: t(err?.message || 'The image could not be uploaded, so nothing was saved.'),
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
      loadTemplates();
      loadCarSchedule();
    } else {
      clearPending();
    }
  },
);
</script>

<template>
  <Dialog
    v-model:visible="isOpen"
    modal
    :header="title"
    style="width: min(74rem, 92vw)"
    class="resource-dialog"
    :draggable="false"
  >
    <form class="resource-form" @submit.prevent="submitForm">
      <label
        v-for="field in standardFields"
        :key="field.key"
        class="resource-form__field"
        :class="{ 'resource-form__field--wide': field.localized || field.type === 'textarea' || field.type === 'image' || field.fullWidth }"
      >
        <span class="resource-form__label">
          {{ field.label }}
          <small v-if="isRequired(field)">*</small>
        </span>

        <LocalizedFieldControl
          v-if="field.localized"
          v-model="draft[field.key]"
          :field="field"
          :translations="draft.translations"
          @update:translation="setTranslation"
        />

        <Textarea
          v-else-if="field.type === 'textarea'"
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
          :min="field.min"
          :minFractionDigits="field.minFractionDigits || 0"
          :maxFractionDigits="field.maxFractionDigits ?? field.minFractionDigits ?? 0"
          :suffix="field.suffix"
          :disabled="field.disabled || field.readonly || (field.key === 'distance_km' && computingDistance)"
          fluid
        />

        <DatePicker
          v-else-if="field.type === 'date'"
          v-model="draft[field.key]"
          showIcon
          fluid
          :minDate="fieldMinDate(field)"
          :disabledDates="fieldDisabledDates(field)"
          dateFormat="dd M yy"
        >
          <template #date="slotProps">
            <span :class="{ 'date-cell--taken': isDateTaken(slotProps.date) }">{{ slotProps.date.day }}</span>
          </template>
        </DatePicker>

        <DatePicker
          v-else-if="field.type === 'datetime'"
          v-model="draft[field.key]"
          showIcon
          showTime
          hourFormat="24"
          fluid
          :minDate="fieldMinDate(field)"
          :disabledDates="fieldDisabledDates(field)"
          dateFormat="dd M yy"
        >
          <template #date="slotProps">
            <span :class="{ 'date-cell--taken': isDateTaken(slotProps.date) }">{{ slotProps.date.day }}</span>
          </template>
        </DatePicker>

        <Select
          v-else-if="field.type === 'select'"
          v-model="draft[field.key]"
          :options="optionsFor(field)"
          optionLabel="label"
          optionValue="value"
          :placeholder="field.placeholder || t('Choose {field}', { field: field.label.toLowerCase() })"
          :showClear="!field.required"
          fluid
          @change="handleFieldChange(field)"
        />

        <div v-else-if="field.type === 'checkbox'" class="checkbox-field">
          <Checkbox v-model="draft[field.key]" binary />
          <span>{{ field.checkboxLabel || field.label }}</span>
        </div>

        <GooglePlaceInput
          v-else-if="field.type === 'place'"
          v-model="draft[field.key]"
          :manualFallback="field.manualFallback !== false"
          :placeholder="field.placeholder"
          @place-select="handlePlaceSelect($event, field)"
          @place-clear="handlePlaceClear(field)"
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
              :aria-label="t('Remove image')"
              @click="removeImage(field)"
            />
          </div>
          <label class="image-field__pick">
            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" @change="onFileChange($event, field)" />
            <span>
              <i class="pi pi-upload" />
              {{ hasImage(field) ? t('Replace image') : t('Select image') }}
            </span>
          </label>
        </div>

        <InputText v-else v-model="draft[field.key]" :placeholder="field.placeholder" />

        <small
          v-if="hasCarSchedule && ['start_at', 'cargo_service_date'].includes(field.key)"
          class="resource-form__hint"
        >
          <template v-if="carScheduleLoading">{{ t('Loading this car’s booked dates…') }}</template>
          <template v-else-if="!draft.car_id">{{ t('Pick a car to see which dates are already booked.') }}</template>
          <template v-else-if="takenDates.length">{{ t('Dimmed days are already booked and can’t be selected.') }}</template>
          <template v-else>{{ t('No bookings yet — every date is free.') }}</template>
        </small>

        <small v-if="errors[field.key]" class="resource-form__error">{{ t(errors[field.key]) }}</small>
      </label>

      <section v-if="attributeField" class="resource-form__specs">
        <p class="resource-form__specs-title">{{ t('Specifications') }}</p>
        <p v-if="!attributeFields.length" class="resource-form__specs-hint">
          {{ attributeField.categoryField && !draft[attributeField.categoryField]
            ? t('Pick a category to see its spec fields.')
            : t('This type has no extra specs.') }}
        </p>
        <DynamicSpecFields v-else :fields="attributeFields" :model-value="draft.attributes" :errors="errors" />
      </section>

      <div class="resource-form__actions">
        <Button type="button" :label="t('Cancel')" icon="pi pi-times" severity="secondary" outlined @click="closeDialog" />
        <Button type="submit" :label="t('Save')" icon="pi pi-check" :disabled="!canSave || submitting || loading" :loading="submitting || loading" />
      </div>
    </form>
  </Dialog>
</template>

<style scoped>
.resource-dialog {
  width: min(74rem, 92vw);
}

.resource-form {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  padding-top: 4px;
}

.resource-form__field {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.resource-form__field--wide {
  grid-column: 1 / -1;
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

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  color: var(--tm-heading);
  font-weight: 800;
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
.resource-form__field :deep(.p-autocomplete),
.resource-form__field :deep(.p-autocomplete-input),
.resource-form__field :deep(.p-datepicker),
.resource-form__field :deep(.p-textarea) {
  width: 100%;
}

.resource-form__hint {
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.resource-form__specs {
  grid-column: 1 / -1;
  display: grid;
  gap: 12px;
  padding-top: 6px;
  border-top: 1px solid var(--tm-border);
}

.resource-form__specs-title {
  margin: 0;
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.resource-form__specs-hint {
  margin: 0;
  color: var(--tm-muted);
  font-weight: 700;
}

.resource-form__specs-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
}

.resource-form__specs-grid .resource-form__field--wide {
  grid-column: 1 / -1;
}

/* Booked day inside a date picker: dimmed with a marker dot. The picker also
   disables it via `disabledDates`, so it can't be selected. */
.date-cell--taken {
  position: relative;
  color: var(--tm-coral);
  font-weight: 900;
}

.date-cell--taken::after {
  content: '';
  position: absolute;
  left: 50%;
  bottom: -5px;
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: var(--tm-coral);
  transform: translateX(-50%);
}

.resource-form__actions {
  display: flex;
  grid-column: 1 / -1;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 8px;
}

@media (max-width: 720px) {
  .resource-form {
    grid-template-columns: 1fr;
  }

  .resource-form__actions {
    flex-direction: column-reverse;
  }

  .resource-form__actions .p-button {
    width: 100%;
  }
}
</style>
