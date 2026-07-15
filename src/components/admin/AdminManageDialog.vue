<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import { api } from '@/api/client';
import { getResource, serializeForm } from '@/api/resources';
import { useAdminI18n } from '@/i18n/admin';
import { formatDateTime, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';
import AdminResourceDialog from '@/components/admin/AdminResourceDialog.vue';

const props = defineProps({
  visible: { type: Boolean, required: true },
  resource: { type: Object, required: true },
  itemId: { type: [Number, String], default: null },
});

const emit = defineEmits(['update:visible', 'changed']);

const toast = useToast();
const confirm = useConfirm();
const { enumLabel, localeCode, t } = useAdminI18n();

const detail = ref(null);
const loading = ref(false);
const busy = ref(false);

const choices = reactive({});        // action.key -> selected value
const actionOptions = reactive({});  // action.key -> [{ label, value }]

const nestedOpen = ref(false);
const activeNested = ref(null);
const nestedSaving = ref(false);
const nestedErrors = ref({});

const actionFormOpen = ref(false);
const activeAction = ref(null);
const actionSaving = ref(false);
const actionErrors = ref({});

const isOpen = computed({
  get: () => props.visible,
  set: (value) => emit('update:visible', value),
});

const spec = computed(() => props.resource.manage || {});

function valueAt(source, path) {
  if (!path) {
    return source;
  }
  return String(path)
    .split('.')
    .reduce((value, key) => (value == null ? undefined : value[key]), source);
}

async function fetchDetail() {
  if (!props.itemId) {
    return;
  }
  loading.value = true;
  try {
    detail.value = await getResource(props.resource, props.itemId);
    Object.keys(choices).forEach((key) => delete choices[key]);
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not load'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    loading.value = false;
  }
}

async function loadActionOptions() {
  for (const action of spec.value.actions || []) {
    if (action.type === 'select-endpoint') {
      try {
        const data = await api.get(action.optionsEndpoint, { params: { limit: 100 } });
        actionOptions[action.key] = (data?.[action.collectionKey] ?? []).map((item) => ({
          label: item[action.optionLabel],
          value: item[action.optionValue],
        }));
      } catch {
        actionOptions[action.key] = [];
      }
    }
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      detail.value = null;
      actionFormOpen.value = false;
      activeAction.value = null;
      actionErrors.value = {};
      fetchDetail();
      loadActionOptions();
    }
  },
);

// --- actions ---

function transitionOptions(action) {
  const next = action.next ? action.next(detail.value || {}) : [];
  return next.map((value) => ({ label: enumLabel(value), value }));
}

function actionOptionsFor(action) {
  if (action.type === 'select-transition') {
    return transitionOptions(action);
  }
  if (action.type === 'select-endpoint') {
    return actionOptions[action.key] || [];
  }
  return [];
}

function actionEnabled(action) {
  if (action.type === 'select-transition') {
    return transitionOptions(action).length > 0;
  }
  if (action.enabled) {
    return action.enabled(detail.value || {});
  }
  return true;
}

function apiCall(method, path, body) {
  switch ((method || 'POST').toLowerCase()) {
    case 'patch':
      return api.patch(path, body);
    case 'put':
      return api.put(path, body);
    case 'delete':
      return api.del(path);
    default:
      return api.post(path, body);
  }
}

async function runAction(fn, action = {}) {
  busy.value = true;
  try {
    await fn();
    toast.add({ severity: 'success', summary: action.successSummary || t('Updated'), life: 2500 });
    if (action.closeAfter) {
      isOpen.value = false;
      detail.value = null;
      emit('changed');
      return;
    }
    await fetchDetail();
    emit('changed');
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Action failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    busy.value = false;
  }
}

function actionPath(action) {
  return action.path(props.itemId, detail.value || {});
}

function actionBody(action, values = {}) {
  if (typeof action.body === 'function') {
    return action.body(values, detail.value || {}, props.itemId);
  }
  return { ...(action.body || {}), ...values };
}

function openActionForm(action) {
  if (!actionEnabled(action) || busy.value || actionSaving.value) {
    return;
  }
  activeAction.value = action;
  actionErrors.value = {};
  actionFormOpen.value = true;
}

async function handleActionFormSubmit(values) {
  if (!activeAction.value) {
    return;
  }
  actionSaving.value = true;
  actionErrors.value = {};
  try {
    const action = activeAction.value;
    const body = actionBody(action, serializeForm(action.formFields || [], values));
    await apiCall(action.method, actionPath(action), body);
    toast.add({ severity: 'success', summary: action.successSummary || t('Updated'), life: 2500 });
    actionFormOpen.value = false;
    activeAction.value = null;
    await fetchDetail();
    emit('changed');
  } catch (err) {
    if (err?.details) {
      actionErrors.value = err.details;
    }
    toast.add({ severity: 'error', summary: activeAction.value.errorSummary || t('Action failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    actionSaving.value = false;
  }
}

function applyAction(action) {
  if (action.type === 'form') {
    openActionForm(action);
    return;
  }
  if (action.type === 'confirm') {
    confirm.require({
      header: action.label,
      message: action.confirmMessage || `${action.label}?`,
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      acceptLabel: t('Confirm'),
      rejectLabel: t('Cancel'),
      accept: () => runAction(() => apiCall(action.method, actionPath(action)), action),
    });
    return;
  }
  const value = choices[action.key];
  if (value === null || value === undefined || value === '') {
    return;
  }
  runAction(() => apiCall(action.method, actionPath(action), { [action.bodyKey]: value }), action);
}

// One-click status change: each reachable status is its own button (no
// select-then-validate step). Called directly from the transition buttons.
function applyTransition(action, value) {
  if (busy.value || !actionEnabled(action) || value === null || value === undefined || value === '') {
    return;
  }
  runAction(() => apiCall(action.method, actionPath(action), { [action.bodyKey]: value }), action);
}

// --- nested collections ---

function nestedRows(nested) {
  return detail.value?.[nested.collectionKey] ?? [];
}

function openNestedAdd(nested) {
  activeNested.value = nested;
  nestedErrors.value = {};
  nestedOpen.value = true;
}

async function handleNestedSubmit(values) {
  nestedSaving.value = true;
  nestedErrors.value = {};
  try {
    const body = serializeForm(activeNested.value.formFields, values);
    await api.post(activeNested.value.addPath(props.itemId), body);
    toast.add({ severity: 'success', summary: t('Added'), life: 2500 });
    nestedOpen.value = false;
    await fetchDetail();
    emit('changed');
  } catch (err) {
    if (err?.details) {
      nestedErrors.value = err.details;
    }
    toast.add({ severity: 'error', summary: t('Add failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    nestedSaving.value = false;
  }
}

function confirmNestedRemove(nested, row) {
  confirm.require({
    header: t('Confirm delete'),
    message: t('Delete this {resource}? This cannot be undone.', { resource: nested.singular }),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('Delete'),
    rejectLabel: t('Cancel'),
    accept: async () => {
      try {
        await api.del(nested.removePath(row));
        toast.add({ severity: 'success', summary: t('Deleted'), life: 2500 });
        await fetchDetail();
        emit('changed');
      } catch (err) {
        toast.add({ severity: 'error', summary: t('Delete failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
      }
    },
  });
}

// --- display helpers ---

function visibleFields(fields, source) {
  return fields.filter((field) => !field.showWhen || field.showWhen(source || {}, detail.value || {}));
}

function fieldSections(fields, source) {
  const sections = [];
  const byKey = new Map();
  visibleFields(fields, source).forEach((field) => {
    const key = field.section || 'details';
    if (!byKey.has(key)) {
      const section = {
        key,
        label: field.sectionLabel || '',
        icon: field.sectionIcon || '',
        fields: [],
      };
      byKey.set(key, section);
      sections.push(section);
    }
    byKey.get(key).fields.push(field);
  });
  return sections;
}

function fieldValue(field, source = detail.value) {
  return typeof field.value === 'function'
    ? field.value(source || {}, detail.value || {})
    : valueAt(source, field.key);
}

function fieldDisplay(field, source = detail.value) {
  const value = fieldValue(field, source);
  if (value === null || value === undefined || value === '') {
    return field.emptyLabel || '-';
  }
  if (field.type === 'money') {
    return formatMGA(Number(value));
  }
  if (field.type === 'date') {
    return formatDateTime(value, localeCode.value);
  }
  if (field.type === 'boolean') {
    // trueLabel/falseLabel arrive pre-translated via translateConfig; fall back to
    // the generic Active/Inactive wording when a field doesn't override them.
    return value ? field.trueLabel || t('Active') : field.falseLabel || t('Inactive');
  }
  if (field.type === 'enum') {
    return value ? enumLabel(value) : '-';
  }
  return field.suffix ? `${value} ${field.suffix}` : value;
}

function summaryValue(key) {
  return fieldDisplay({ key }, detail.value);
}

function targetData(target) {
  return target ? valueAt(detail.value, target.key || 'target') : null;
}

function targetRows(target) {
  const source = targetData(target);
  if (!source || !target?.itemsTable) {
    return [];
  }
  return valueAt(source, target.itemsTable.key) || [];
}

function cellDisplay(row, column) {
  const value = valueAt(row, column.field);
  if (column.type === 'image') {
    return value || '';
  }
  if (column.type === 'money') {
    return formatMGA(Number(value || 0));
  }
  if (column.type === 'boolean') {
    return value ? column.trueLabel || t('Yes') : column.falseLabel || t('No');
  }
  if (column.type === 'enum') {
    return value ? enumLabel(value) : column.emptyLabel || '-';
  }
  if (value === null || value === undefined || value === '') {
    return column.emptyLabel || '-';
  }
  return value;
}

</script>

<template>
  <Dialog
    v-model:visible="isOpen"
    modal
    :header="t('Manage {resource}', { resource: resource.singular })"
    style="width: min(1120px, 94vw)"
    :breakpoints="{ '760px': '96vw' }"
    class="manage-dialog"
    :draggable="false"
  >
    <div v-if="loading" class="manage-loading">{{ t('Loading…') }}</div>

    <div v-else-if="detail" class="manage-body">
      <header v-if="spec.summary" class="manage-summary">
        <span class="manage-summary__icon"><i :class="spec.summary.icon || 'pi pi-file'" /></span>
        <div class="manage-summary__copy">
          <span>{{ spec.summary.eyebrow }}</span>
          <h3>{{ summaryValue(spec.summary.titleKey) }}</h3>
          <p v-if="spec.summary.subtitleKey">{{ summaryValue(spec.summary.subtitleKey) }}</p>
        </div>
        <div class="manage-summary__badges">
          <span v-for="badge in spec.summary.badges || []" :key="badge.key">
            <small>{{ badge.label }}</small>
            <Tag :value="enumLabel(valueAt(detail, badge.key))" :severity="statusSeverity(valueAt(detail, badge.key))" />
          </span>
        </div>
      </header>

      <div class="manage-detail-sections">
        <section v-for="section in fieldSections(spec.fields || [], detail)" :key="section.key" class="manage-detail-section">
          <div v-if="section.label" class="manage-detail-section__head">
            <i v-if="section.icon" :class="section.icon" />
            <h3>{{ section.label }}</h3>
          </div>
          <div class="manage-fields">
            <div
              v-for="field in section.fields"
              :key="field.key"
              class="manage-field"
              :class="{
                'manage-field--wide': field.wide,
                'manage-field--note': field.type === 'note',
                'manage-field--highlight': field.highlight,
                [`manage-field--${field.tone}`]: field.tone,
              }"
            >
              <span>{{ field.label }}</span>
              <Tag
                v-if="field.type === 'enum' || field.type === 'status'"
                :value="fieldDisplay(field, detail)"
                :severity="statusSeverity(fieldValue(field, detail))"
              />
              <strong v-else>{{ fieldDisplay(field, detail) }}</strong>
            </div>
          </div>
        </section>
      </div>

      <p v-if="spec.showDriver" class="manage-driver">
        <span>{{ t('Driver') }}</span>
        <strong v-if="detail.driver">{{ detail.driver.full_name }} · {{ detail.driver.phone }}</strong>
        <strong v-else>{{ t('Not assigned') }}</strong>
      </p>

      <div v-if="(spec.actions || []).length" class="manage-actions">
        <div class="manage-actions__head">
          <span><i class="pi pi-bolt" /></span>
          <div>
            <strong>{{ t('Actions') }}</strong>
            <small>{{ t(spec.actionsDescription || 'Record payment, assign team members, or update status.') }}</small>
          </div>
        </div>
        <div class="manage-actions__body">
          <div v-for="action in spec.actions" :key="action.key" class="manage-action">
            <template v-if="action.type === 'confirm'">
              <Button
                :label="action.label"
                :icon="action.icon"
                :severity="action.severity || 'warn'"
                :disabled="!actionEnabled(action) || busy"
                :title="!actionEnabled(action) && action.disabledHelp ? t(action.disabledHelp) : action.confirmMessage"
                @click="applyAction(action)"
              />
            </template>
            <template v-else-if="action.type === 'form'">
              <Button
                :label="action.label"
                :icon="action.icon || 'pi pi-pencil'"
                :severity="action.severity"
                :disabled="!actionEnabled(action) || busy || actionSaving"
                @click="applyAction(action)"
              />
            </template>
            <template v-else-if="action.type === 'select-transition'">
              <span class="manage-action__label">{{ action.label }}</span>
              <div class="manage-action__choices">
                <Button
                  v-for="opt in actionOptionsFor(action)"
                  :key="opt.value"
                  :label="opt.label"
                  size="small"
                  :severity="statusSeverity(opt.value)"
                  :disabled="busy"
                  :loading="busy"
                  @click="applyTransition(action, opt.value)"
                />
                <span v-if="!actionOptionsFor(action).length" class="manage-action__empty">
                  {{ t('No further status changes') }}
                </span>
              </div>
            </template>
            <template v-else>
              <Select
                v-model="choices[action.key]"
                :options="actionOptionsFor(action)"
                optionLabel="label"
                optionValue="value"
                :placeholder="action.label"
                :disabled="!actionEnabled(action) || busy"
                class="manage-action__select"
              />
              <Button
                :label="action.label"
                icon="pi pi-check"
                :disabled="!actionEnabled(action) || busy || !choices[action.key]"
                :loading="busy"
                @click="applyAction(action)"
              />
            </template>
          </div>
        </div>
      </div>

      <section v-if="spec.target && targetData(spec.target)" class="manage-section manage-section--target">
        <h4>{{ spec.target.title }}</h4>
        <div class="manage-fields">
          <div v-for="field in visibleFields(spec.target.fields || [], targetData(spec.target))" :key="field.key" class="manage-field">
            <span>{{ field.label }}</span>
            <strong>{{ fieldDisplay(field, targetData(spec.target)) }}</strong>
          </div>
        </div>

        <DataTable
          v-if="spec.target.itemsTable && targetRows(spec.target).length"
          :value="targetRows(spec.target)"
          responsiveLayout="scroll"
          class="manage-table manage-table--target"
        >
          <Column v-for="col in spec.target.itemsTable.columns" :key="col.field" :field="col.field" :header="col.header">
            <template #body="{ data }">
              <span :class="{ 'cell-money': col.type === 'money' }">{{ cellDisplay(data, col) }}</span>
            </template>
          </Column>
        </DataTable>
      </section>

      <section
        v-if="spec.itemsTable && (!spec.itemsTable.showWhen || spec.itemsTable.showWhen(detail))"
        class="manage-section"
      >
        <h4>{{ spec.itemsTable.title }}</h4>
        <DataTable :value="detail[spec.itemsTable.key] || []" responsiveLayout="scroll" class="manage-table">
          <Column v-for="col in spec.itemsTable.columns" :key="col.field" :field="col.field" :header="col.header">
            <template #body="{ data }">
              <span :class="{ 'cell-money': col.type === 'money' }">{{ cellDisplay(data, col) }}</span>
            </template>
          </Column>
          <template #empty><span class="manage-empty">{{ t('No items.') }}</span></template>
        </DataTable>
      </section>

      <section v-for="table in spec.itemsTables || []" :key="table.key" class="manage-section">
        <h4>{{ table.title }}</h4>
        <DataTable :value="detail[table.key] || []" responsiveLayout="scroll" class="manage-table">
          <Column v-for="col in table.columns" :key="col.field" :field="col.field" :header="col.header">
            <template #body="{ data }">
              <span :class="{ 'cell-money': col.type === 'money' }">{{ cellDisplay(data, col) }}</span>
            </template>
          </Column>
          <template #empty><span class="manage-empty">{{ t('No items.') }}</span></template>
        </DataTable>
      </section>

      <section v-for="nested in spec.nested || []" :key="nested.key" class="manage-section">
        <div class="manage-section__head">
          <h4>{{ nested.title }}</h4>
          <Button :label="nested.addLabel" icon="pi pi-plus" size="small" @click="openNestedAdd(nested)" />
        </div>
        <DataTable :value="nestedRows(nested)" dataKey="id" responsiveLayout="scroll" class="manage-table">
          <Column v-for="col in nested.columns" :key="col.field" :field="col.field" :header="col.header">
            <template #body="{ data }">
              <Tag
                v-if="col.type === 'boolean'"
                :value="cellDisplay(data, col)"
                :severity="data[col.field] ? 'success' : 'secondary'"
              />
              <img
                v-else-if="col.type === 'image' && cellDisplay(data, col)"
                class="manage-image-thumb"
                :src="cellDisplay(data, col)"
                :alt="data.alt_text || nested.singular"
                loading="lazy"
              />
              <span v-else-if="col.type === 'image'" class="manage-image-empty">{{ t('No image') }}</span>
              <span v-else :class="{ 'cell-money': col.type === 'money' }">{{ cellDisplay(data, col) }}</span>
            </template>
          </Column>
          <Column header="" style="width: 3rem">
            <template #body="{ data }">
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                :aria-label="t('Delete')"
                @click="confirmNestedRemove(nested, data)"
              />
            </template>
          </Column>
          <template #empty><span class="manage-empty">{{ t('None yet.') }}</span></template>
        </DataTable>
      </section>
    </div>

    <AdminResourceDialog
      v-model:visible="nestedOpen"
      :title="activeNested?.addLabel || t('Add')"
      :fields="activeNested?.formFields || []"
      :templateKey="detail?.category?.template_key || ''"
      :loading="nestedSaving"
      :errors="nestedErrors"
      @submit="handleNestedSubmit"
    />

    <AdminResourceDialog
      v-model:visible="actionFormOpen"
      :title="activeAction?.label || t('Action')"
      :fields="activeAction?.formFields || []"
      :loading="actionSaving"
      :errors="actionErrors"
      @submit="handleActionFormSubmit"
    />
  </Dialog>
</template>

<style scoped>
.manage-loading {
  padding: 28px;
  color: var(--tm-muted);
  font-weight: 800;
}

.manage-body {
  display: grid;
  gap: 18px;
  padding: 2px 0 6px;
}

.manage-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background:
    radial-gradient(circle at 100% 0%, rgba(201, 146, 44, 0.12), transparent 38%),
    var(--tm-surface-soft);
}

.manage-summary__icon {
  display: grid;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  font-size: 1.1rem;
  place-items: center;
}

.manage-summary__copy {
  min-width: 0;
}

.manage-summary__copy > span,
.manage-summary__badges small {
  color: var(--tm-muted);
  font-size: 0.7rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.manage-summary__copy h3 {
  overflow: hidden;
  margin: 4px 0 2px;
  color: var(--tm-heading);
  font-size: 1.28rem;
  letter-spacing: -0.025em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.manage-summary__copy p {
  margin: 0;
  color: var(--tm-muted);
  font-size: 0.9rem;
  font-weight: 720;
}

.manage-summary__badges {
  display: flex;
  align-items: center;
  gap: 16px;
}

.manage-summary__badges > span {
  display: grid;
  gap: 5px;
}

.manage-detail-sections {
  display: grid;
  gap: 14px;
}

.manage-detail-section {
  display: grid;
  gap: 10px;
}

.manage-detail-section__head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.manage-detail-section__head i {
  display: grid;
  width: 28px;
  height: 28px;
  border-radius: 9px;
  background: rgba(201, 146, 44, 0.11);
  color: var(--tm-gold);
  font-size: 0.78rem;
  place-items: center;
}

.manage-detail-section__head h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 0.95rem;
  letter-spacing: -0.01em;
}

.manage-fields {
  display: grid;
  gap: 9px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.manage-field {
  display: grid;
  min-height: 72px;
  align-content: center;
  gap: 7px;
  padding: 12px 13px;
  border: 1px solid var(--tm-border);
  border-radius: 12px;
  background: var(--tm-surface-soft);
}

.manage-field--wide {
  grid-column: span 2;
}

.manage-field--highlight {
  position: relative;
  min-height: 92px;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--manage-field-accent, var(--tm-gold)) 38%, var(--tm-border));
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--manage-field-accent, var(--tm-gold)) 13%, transparent), transparent 50%),
    var(--tm-surface-soft);
}

.manage-field--highlight::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 4px;
  background: var(--manage-field-accent, var(--tm-gold));
  content: '';
}

.manage-field--highlight strong {
  font-size: 1.08rem;
}

.manage-field--gold {
  --manage-field-accent: var(--tm-gold);
}

.manage-field--emerald {
  --manage-field-accent: var(--tm-emerald);
}

.manage-field--violet {
  --manage-field-accent: #8065b8;
}

.manage-field--note {
  min-height: 104px;
  grid-column: 1 / -1;
  align-content: start;
  background:
    linear-gradient(135deg, rgba(201, 146, 44, 0.08), transparent 46%),
    var(--tm-surface-soft);
}

.manage-field span,
.manage-driver span {
  color: var(--tm-muted);
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.07em;
}

.manage-field strong,
.manage-driver strong {
  color: var(--tm-heading);
  font-size: 0.96rem;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.manage-field--note strong {
  white-space: pre-wrap;
}

.manage-driver {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--tm-border);
  border-radius: 12px;
  background: var(--tm-surface-soft);
}

.manage-actions {
  display: grid;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: var(--tm-surface-soft);
}

.manage-actions__head {
  display: flex;
  align-items: center;
  gap: 11px;
}

.manage-actions__head > span {
  display: grid;
  width: 36px;
  height: 36px;
  flex: 0 0 auto;
  border-radius: 11px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  place-items: center;
}

.manage-actions__head > div {
  display: grid;
  gap: 2px;
}

.manage-actions__head strong {
  color: var(--tm-heading);
  font-size: 0.92rem;
}

.manage-actions__head small {
  color: var(--tm-muted);
  font-size: 0.78rem;
}

.manage-actions__body {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--tm-border);
}

.manage-action {
  display: flex;
  align-items: center;
  gap: 8px;
}

.manage-action__select {
  min-width: 200px;
}

/* Status transitions: one button per reachable status, coloured by severity —
   click it to apply directly (no select + validate step). */
.manage-action__label {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 850;
}

:global(.manage-dialog.p-dialog) {
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 20px;
  box-shadow: 0 30px 90px rgba(0, 0, 0, 0.26);
}

:global(.manage-dialog .p-dialog-header) {
  padding: 18px 20px;
  border-bottom: 1px solid var(--tm-border);
}

:global(.manage-dialog .p-dialog-title) {
  color: var(--tm-heading);
  font-size: 1.18rem;
  letter-spacing: -0.02em;
}

:global(.manage-dialog .p-dialog-content) {
  max-height: calc(100vh - 110px);
  padding: 18px 20px 22px;
}

.manage-action__choices {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.manage-action__empty {
  color: var(--tm-muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.manage-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.manage-section h4 {
  margin: 0 0 8px;
  color: var(--tm-heading);
  font-size: 1.02rem;
}

.manage-table :deep(.p-datatable-thead > tr > th) {
  background: var(--tm-surface-soft);
  color: var(--tm-muted);
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.cell-money {
  color: var(--tm-heading);
  font-weight: 900;
}

.manage-image-thumb {
  display: block;
  width: 112px;
  height: 76px;
  object-fit: cover;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.manage-image-empty {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 750;
}

.manage-empty {
  display: block;
  padding: 14px;
  color: var(--tm-muted);
  font-weight: 700;
}

@media (max-width: 900px) {
  .manage-fields {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .manage-summary {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .manage-summary__badges {
    grid-column: 1 / -1;
    padding-top: 4px;
  }

  .manage-fields {
    grid-template-columns: 1fr;
  }

  .manage-field--wide,
  .manage-field--note {
    grid-column: auto;
  }

  .manage-driver {
    align-items: flex-start;
    flex-direction: column;
  }

  .manage-actions__body {
    align-items: stretch;
    flex-direction: column;
  }

  .manage-action {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
