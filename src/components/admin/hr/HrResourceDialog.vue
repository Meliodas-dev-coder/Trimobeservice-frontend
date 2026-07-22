<script setup>
import { computed, ref, watch } from 'vue';

import { listHrLookup, listHrResource, serializeHrForm, uploadHrDocument } from '@/api/hr';
import LocalizedFieldControl from '@/components/admin/LocalizedFieldControl.vue';
import HrApprovalChainField from '@/components/admin/hr/HrApprovalChainField.vue';
import HrLeaveDatesField from '@/components/admin/hr/HrLeaveDatesField.vue';
import { getHrResource } from '@/data/hrResources';
import {
  approverRole,
  canMutateHrResource,
  hrFeatureForResource,
  hrResourceFieldOptions,
  hrResourceFieldWritable,
} from '@/data/hrAccess';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';
import { cloneTranslations, ensureTranslationBucket } from '@/utils/localized';

const props = defineProps({
  visible: { type: Boolean, default: false },
  resource: { type: Object, required: true },
  record: { type: Object, default: null },
  defaults: { type: Object, default: () => ({}) },
  saving: { type: Boolean, default: false },
});

const emit = defineEmits(['update:visible', 'submit']);
const auth = useAuthStore();
const { enumLabel, t } = useAdminI18n();
const form = ref({});
const errors = ref({});
const relationItems = ref({});
const relationError = ref('');
const optionsLoading = ref(false);
const uploadBusy = ref(false);
const file = ref(null);
// Bumped on every open so composite fields (e.g. the leave date editor) re-mount
// with fresh state instead of carrying over the previous record's mode.
const formToken = ref(0);

const mutationAction = computed(() => props.record
  ? props.resource.accessActions?.edit || 'update'
  : props.resource.accessActions?.create || 'create');
const availableFields = computed(() => props.resource.fields.filter((field) => !field.permission || auth.can(field.permission)));
const submissionFields = computed(() => availableFields.value.filter((field) => (
  !(props.record && field.createOnly)
    && hrResourceFieldWritable(auth, props.resource, field, {
      record: props.record,
      values: form.value,
      action: mutationAction.value,
    })
)));
const editableFields = computed(() => submissionFields.value.filter((field) => {
  if (field.hidden || (props.record && field.type === 'file')) return false;
  // Conditionally-shown fields (e.g. a special shift's custom name) reveal only
  // when their predicate holds against the live form values.
  if (field.visibleWhen && !field.visibleWhen(form.value)) return false;
  // A self-service employee is always the subject of their own submission.
  // Keep employee_id in the serialized body, but do not expose a selector that
  // could imply another employee is selectable.
  if (field.key === 'employee_id' && props.defaults.employee_id
    && auth.hrScope(hrFeatureForResource(props.resource), mutationAction.value) === 'self') return false;
  return true;
}));
const mutationAllowed = computed(() => canMutateHrResource(
  auth,
  props.resource,
  mutationAction.value,
  props.record ? { row: props.record } : { values: form.value },
));
const title = computed(() => props.record
  ? t('Edit {item}', { item: t(props.resource.singular) })
  : t('New {item}', { item: t(props.resource.singular) }));

// ISO weekday order (Monday = 1 … Sunday = 7), matching how the backend reads
// work_days when computing attendance.
const weekdayOptions = computed(() => (
  [['Mon', 1], ['Tue', 2], ['Wed', 3], ['Thu', 4], ['Fri', 5], ['Sat', 6], ['Sun', 7]]
    .map(([label, value]) => ({ label: t(label), value }))
));

function asDate(value) {
  if (!value) return null;
  const parsed = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// A TIME value ("HH:MM[:SS]") becomes a Date the time picker can bind; the date
// part is irrelevant and dropped again on serialize.
function asTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const match = String(value).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const parsed = new Date();
  parsed.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return parsed;
}

function reset() {
  const values = { ...props.defaults, ...(props.record || {}) };
  for (const field of props.resource.fields) {
    if (field.type === 'date' || field.type === 'datetime') values[field.key] = asDate(values[field.key]);
    if (field.type === 'time') values[field.key] = asTime(values[field.key]);
    if (field.type === 'weekdays') values[field.key] = Array.isArray(values[field.key]) ? values[field.key].map(Number) : [];
    // New config records should be usable immediately: default is_active on when
    // creating (otherwise a new leave policy/shift/benefit is born inactive and
    // silently rejected). Other booleans still default off.
    if (field.type === 'boolean' && values[field.key] == null) values[field.key] = !props.record && field.key === 'is_active';
    if (field.type === 'json' && values[field.key] != null && typeof values[field.key] !== 'string') {
      values[field.key] = JSON.stringify(values[field.key], null, 2);
    }
    if (field.type === 'approvalChain') {
      // Collapse known role entries to plain strings (dropping the legacy,
      // backend-ignored `level` key) while preserving any named-person step.
      // Never leave the required chain empty: a new policy starts with one step.
      const raw = Array.isArray(values[field.key]) ? values[field.key] : [];
      const normalized = raw.map((entry) => approverRole(entry) || entry);
      values[field.key] = normalized.length ? normalized : ['manager'];
    }
  }
  // Free-text fields keep their per-locale copy in a `translations` bucket,
  // seeded from the record so editing preserves existing translations.
  const localized = props.resource.fields.filter((field) => field.localized);
  if (localized.length) {
    values.translations = cloneTranslations(props.record?.translations);
    localized.forEach((field) => ensureTranslationBucket(values.translations, field.key));
  }
  form.value = values;
  errors.value = {};
  file.value = null;
  relationError.value = '';
  formToken.value += 1;
}

function setTranslation({ field, locale, value }) {
  ensureTranslationBucket(form.value.translations, field)[locale] = value;
}

function optionLabel(item, field) {
  if (field.optionLabel === 'full_name') {
    return item.full_name || item.name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || `#${item.id}`;
  }
  return item[field.optionLabel] || item.name || item.title || `#${item.id}`;
}

function selectOptions(field) {
  return hrResourceFieldOptions(auth, props.resource, mutationAction.value, field, field.options || []);
}

// A relation row is selectable unless it is explicitly deactivated. is_active
// comes back as a MySQL TINYINT (0/1) or bool; absence means the record has no
// such flag and stays selectable.
function optionActive(item) {
  const value = item?.is_active;
  if (value === undefined || value === null) return true;
  return value !== false && value !== 0 && value !== '0';
}

async function loadRelations() {
  const fields = submissionFields.value.filter((field) => field.type === 'relation');
  if (!fields.length) {
    relationItems.value = {};
    return;
  }
  optionsLoading.value = true;
  try {
    const unique = [...new Set(fields.map((field) => field.resource))];
    const settled = await Promise.allSettled(unique.map(async (id) => {
      if (['employees', 'departments', 'positions', 'admin-users'].includes(id)) return [id, await listHrLookup(id)];
      const relationResource = getHrResource(id);
      const result = await listHrResource(relationResource, { limit: 100 });
      return [id, result.items];
    }));
    const loaded = settled.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const failed = settled.filter((result) => result.status === 'rejected');
    relationItems.value = Object.fromEntries(loaded);
    relationError.value = failed.length ? t('Some selection options could not be loaded.') : '';
  } catch (err) {
    relationItems.value = {};
    relationError.value = err.message || t('Could not load selection options.');
  } finally {
    optionsLoading.value = false;
  }
}

// Options are derived so a relation scoped to another field (e.g. a position
// scoped to the chosen department) reacts live as that field changes.
const relationOptions = computed(() => {
  const out = {};
  for (const field of submissionFields.value) {
    if (field.type !== 'relation') continue;
    const currentValue = form.value[field.key];
    const isCurrent = (item) => String(item.id) === String(currentValue);
    let items = (relationItems.value[field.resource] || [])
      // Never offer a deactivated record for a new link (e.g. an inactive leave
      // policy, which the backend then rejects with a confusing 404). The
      // currently-selected value is always kept so editing stays consistent.
      .filter((item) => optionActive(item) || isCurrent(item));
    if (field.key === 'employee_id') {
      items = items.filter((item) => canMutateHrResource(
        auth,
        props.resource,
        mutationAction.value,
        { values: { ...form.value, employee_id: item.id } },
      ));
    }
    // Department-scoped selection (mirrors the access-control screen): pick the
    // department first, then only its rows show. Optional dependencies fall back
    // to the full list when no department is chosen.
    if (field.dependsOn) {
      const dep = form.value[field.dependsOn];
      const hasDep = dep !== undefined && dep !== null && dep !== '';
      if (hasDep) {
        items = items.filter((item) => String(item.department_id) === String(dep) || isCurrent(item));
      } else if (!field.dependsOptional) {
        items = items.filter(isCurrent);
      }
    }
    if (field.excludeSelf && props.record) {
      items = items.filter((item) => String(item.id) !== String(props.record.id));
    }
    out[field.key] = items.map((item) => ({ label: optionLabel(item, field), value: item.id }));
  }
  return out;
});

// Guide the user to pick the scoping field first, and drop a now-invalid
// selection when its department changes to a non-matching one.
function relationPlaceholder(field) {
  if (field.dependsOn && !field.dependsOptional) {
    const dep = form.value[field.dependsOn];
    if (dep === undefined || dep === null || dep === '') return t('Select a department first');
  }
  return t('Select an option');
}

watch(
  () => submissionFields.value
    .filter((f) => f.type === 'relation' && f.dependsOn)
    .map((f) => `${f.key}=${form.value[f.dependsOn] ?? ''}`)
    .join('|'),
  () => {
    for (const field of submissionFields.value) {
      if (field.type !== 'relation' || !field.dependsOn) continue;
      const dep = form.value[field.dependsOn];
      if (dep === undefined || dep === null || dep === '') continue;
      const current = form.value[field.key];
      if (current === undefined || current === null) continue;
      const selected = (relationItems.value[field.resource] || []).find((item) => String(item.id) === String(current));
      if (selected && String(selected.department_id) !== String(dep)) form.value[field.key] = null;
    }
  },
);

watch(() => props.visible, (visible) => {
  if (!visible) return;
  reset();
  loadRelations();
}, { immediate: true });

function onFile(event) {
  file.value = event.target.files?.[0] || null;
}

function close() {
  if (!props.saving && !uploadBusy.value) emit('update:visible', false);
}

async function submit() {
  if (!mutationAllowed.value) {
    errors.value = { ...errors.value, _form: t('This action is not available for the selected employee or record.') };
    return;
  }
  // Fill fields hidden by their predicate from a derived value (e.g. day/night
  // shifts get their canonical name) so the record stays complete before submit.
  for (const field of submissionFields.value) {
    if (typeof field.deriveValue !== 'function') continue;
    if (field.visibleWhen && field.visibleWhen(form.value)) continue;
    form.value[field.key] = field.deriveValue(form.value);
  }
  const nextErrors = {};
  for (const field of submissionFields.value) {
    // Hidden fields are populated by a composite editor (e.g. the leave dates),
    // not a visible input, so a per-field required message would have nowhere to
    // show; the composite/guards below validate them instead.
    if (field.hidden || !field.required) continue;
    // A field hidden by its predicate is either derived above or optional in this
    // state, so it must not raise a phantom "required" error.
    if (field.visibleWhen && !field.visibleWhen(form.value)) continue;
    const value = form.value[field.key];
    if (field.type === 'weekdays') {
      if (!Array.isArray(value) || value.length === 0) nextErrors[field.key] = t('Select at least one work day.');
      continue;
    }
    if (value === '' || value === null || value === undefined) nextErrors[field.key] = t('This field is required.');
  }
  if (props.resource.id === 'leave-requests' && (!form.value.start_date || !form.value.end_date)) {
    nextErrors._form = t('Choose the leave date(s).');
  }
  for (const field of submissionFields.value.filter((item) => item.type === 'json')) {
    const value = form.value[field.key];
    if (typeof value !== 'string' || !value.trim()) continue;
    try {
      JSON.parse(value);
    } catch {
      nextErrors[field.key] = t('Enter valid JSON.');
    }
  }
  if (props.resource.id === 'documents' && !props.record && !file.value) {
    nextErrors.attachment = t('Choose a file to create a secure document.');
  }
  errors.value = nextErrors;
  if (Object.keys(nextErrors).length) return;

  const body = serializeHrForm(submissionFields.value, form.value, Boolean(props.record));
  if (file.value) {
    uploadBusy.value = true;
    try {
      const uploaded = await uploadHrDocument(file.value, body);
      emit('submit', { __uploadedRecord: uploaded.document || uploaded });
      return;
    } catch (err) {
      errors.value = { ...errors.value, attachment: err.message || t('Document upload failed.') };
      return;
    } finally {
      uploadBusy.value = false;
    }
  }
  emit('submit', body);
}
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :header="title"
    :style="{ width: 'min(760px, 94vw)' }"
    :closable="!saving && !uploadBusy"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="hr-form">
      <div v-if="relationError" class="hr-form__relations-error"><i class="pi pi-exclamation-circle" /> {{ relationError }}</div>
      <div v-if="errors._form || !mutationAllowed" class="hr-form__relations-error"><i class="pi pi-lock" /> {{ errors._form || t('This action is not available for the selected employee or record.') }}</div>
      <div
        v-for="field in editableFields"
        :key="field.key"
        class="hr-form__field"
        :class="{ 'is-full': field.fullWidth || field.localized || field.type === 'textarea' || field.type === 'file' }"
      >
        <!-- A localized field renders a base input plus a per-locale input, so it
             labels the group rather than binding `for` to a single control. -->
        <label :for="field.localized ? undefined : `hr-field-${field.key}`">
          {{ t(field.label) }} <span v-if="field.required" aria-hidden="true">*</span>
        </label>

        <LocalizedFieldControl
          v-if="field.localized"
          v-model="form[field.key]"
          :field="{ ...field, placeholder: field.placeholder ? t(field.placeholder) : undefined }"
          :translations="form.translations || {}"
          @update:translation="setTranslation"
        />
        <Textarea
          v-else-if="field.type === 'textarea' || field.type === 'json'"
          :id="`hr-field-${field.key}`"
          v-model="form[field.key]"
          rows="4"
          auto-resize
          :placeholder="field.placeholder ? t(field.placeholder) : undefined"
          :invalid="Boolean(errors[field.key])"
        />
        <Select
          v-else-if="field.type === 'select'"
          :id="`hr-field-${field.key}`"
          v-model="form[field.key]"
          :options="selectOptions(field)"
          :option-label="(value) => enumLabel(value)"
          :placeholder="t('Select an option')"
          show-clear
          :invalid="Boolean(errors[field.key])"
        />
        <HrApprovalChainField
          v-else-if="field.type === 'approvalChain'"
          v-model="form[field.key]"
        />
        <HrLeaveDatesField
          v-else-if="field.type === 'leaveDates'"
          :key="`leave-dates-${formToken}`"
          v-model:start="form.start_date"
          v-model:end="form.end_date"
          v-model:startPortion="form.start_portion"
          v-model:endPortion="form.end_portion"
        />
        <Select
          v-else-if="field.type === 'relation'"
          :id="`hr-field-${field.key}`"
          v-model="form[field.key]"
          :options="relationOptions[field.key] || []"
          option-label="label"
          option-value="value"
          filter
          show-clear
          :loading="optionsLoading"
          :placeholder="relationPlaceholder(field)"
          :invalid="Boolean(errors[field.key])"
        />
        <DatePicker
          v-else-if="field.type === 'time'"
          :id="`hr-field-${field.key}`"
          v-model="form[field.key]"
          time-only
          hour-format="24"
          show-icon
          icon="pi pi-clock"
          :invalid="Boolean(errors[field.key])"
        />
        <SelectButton
          v-else-if="field.type === 'weekdays'"
          v-model="form[field.key]"
          :options="weekdayOptions"
          option-label="label"
          option-value="value"
          multiple
          :aria-label="t(field.label)"
          :invalid="Boolean(errors[field.key])"
        />
        <DatePicker
          v-else-if="field.type === 'date' || field.type === 'datetime'"
          :id="`hr-field-${field.key}`"
          v-model="form[field.key]"
          show-icon
          :show-time="field.type === 'datetime'"
          :hour-format="field.type === 'datetime' ? '24' : undefined"
          date-format="yy-mm-dd"
          :invalid="Boolean(errors[field.key])"
        />
        <InputNumber
          v-else-if="field.type === 'number'"
          :id="`hr-field-${field.key}`"
          v-model="form[field.key]"
          :min-fraction-digits="0"
          :max-fraction-digits="2"
          :invalid="Boolean(errors[field.key])"
        />
        <InputText
          v-else-if="field.type === 'money'"
          :id="`hr-field-${field.key}`"
          v-model="form[field.key]"
          inputmode="decimal"
          placeholder="0.00"
          :invalid="Boolean(errors[field.key])"
        />
        <div v-else-if="field.type === 'boolean'" class="hr-form__check">
          <Checkbox :input-id="`hr-field-${field.key}`" v-model="form[field.key]" binary />
          <span>{{ form[field.key] ? t('Yes') : t('No') }}</span>
        </div>
        <div v-else-if="field.type === 'file'" class="hr-form__file">
          <input :id="`hr-field-${field.key}`" type="file" @change="onFile" />
          <small>{{ t('Files are uploaded through the secure HR document service.') }}</small>
          <small v-if="errors[field.key]" class="hr-form__error">{{ errors[field.key] }}</small>
        </div>
        <InputText
          v-else
          :id="`hr-field-${field.key}`"
          v-model="form[field.key]"
          :type="field.type === 'email' ? 'email' : 'text'"
          :placeholder="field.placeholder ? t(field.placeholder) : undefined"
          :invalid="Boolean(errors[field.key])"
        />

        <small v-if="errors[field.key]" class="hr-form__error">{{ errors[field.key] }}</small>
        <small v-else-if="field.help">{{ t(field.help) }}</small>
      </div>
    </div>

    <template #footer>
      <Button :label="t('Cancel')" severity="secondary" text :disabled="saving || uploadBusy" @click="close" />
      <Button
        v-if="mutationAllowed"
        :label="t(record ? 'Save changes' : 'Create')"
        icon="pi pi-check"
        :loading="saving || uploadBusy"
        @click="submit"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.hr-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  padding-top: 4px;
}

.hr-form__field {
  display: grid;
  align-content: start;
  gap: 7px;
  min-width: 0;
}

.hr-form__field.is-full { grid-column: 1 / -1; }
.hr-form__field label { color: var(--tm-heading); font-size: 0.8rem; font-weight: 850; }
.hr-form__field label span, .hr-form__error { color: var(--tm-coral); }
.hr-form__field > small { color: var(--tm-muted); font-size: 0.74rem; }
.hr-form__field :deep(.p-inputtext),
.hr-form__field :deep(.p-select),
.hr-form__field :deep(.p-datepicker),
.hr-form__field :deep(.p-inputnumber) { width: 100%; }
.hr-form__field :deep(.p-selectbutton) { display: flex; flex-wrap: wrap; }
.hr-form__field :deep(.p-selectbutton .p-togglebutton) { flex: 1 0 auto; }
.hr-form__check { display: flex; min-height: 42px; align-items: center; gap: 9px; }
.hr-form__file { display: grid; gap: 7px; padding: 12px; border: 1px dashed var(--tm-border); border-radius: 10px; background: var(--tm-surface-soft); }
.hr-form__file input { width: 100%; color: var(--tm-text); }
.hr-form__relations-error { grid-column: 1 / -1; padding: 10px 12px; border: 1px solid color-mix(in srgb,var(--tm-coral) 35%,var(--tm-border)); border-radius: 9px; color: var(--tm-coral); font-size: .78rem; }

@media (max-width: 620px) {
  .hr-form { grid-template-columns: 1fr; }
  .hr-form__field.is-full { grid-column: auto; }
}
</style>
