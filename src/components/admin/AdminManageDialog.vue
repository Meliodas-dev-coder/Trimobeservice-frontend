<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import { api } from '@/api/client';
import { getResource, serializeForm } from '@/api/resources';
import { useAdminI18n } from '@/i18n/admin';
import { formatMGA } from '@/utils/format';
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

async function runAction(fn) {
  busy.value = true;
  try {
    await fn();
    toast.add({ severity: 'success', summary: t('Updated'), life: 2500 });
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
      accept: () => runAction(() => apiCall(action.method, actionPath(action))),
    });
    return;
  }
  const value = choices[action.key];
  if (value === null || value === undefined || value === '') {
    return;
  }
  runAction(() => apiCall(action.method, actionPath(action), { [action.bodyKey]: value }));
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

function fieldDisplay(field) {
  const value = detail.value ? detail.value[field.key] : undefined;
  if (field.type === 'money') {
    return formatMGA(Number(value || 0));
  }
  if (field.type === 'date') {
    return value ? new Date(value).toLocaleString(localeCode.value) : '-';
  }
  if (field.type === 'boolean') {
    // trueLabel/falseLabel arrive pre-translated via translateConfig; fall back to
    // the generic Active/Inactive wording when a field doesn't override them.
    return value ? field.trueLabel || t('Active') : field.falseLabel || t('Inactive');
  }
  if (field.type === 'enum') {
    return value ? enumLabel(value) : '-';
  }
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return value;
}

function cellDisplay(row, column) {
  const value = row[column.field];
  if (column.type === 'image') {
    return value || '';
  }
  if (column.type === 'money') {
    return formatMGA(Number(value || 0));
  }
  if (column.type === 'boolean') {
    return value ? column.trueLabel || t('Yes') : column.falseLabel || t('No');
  }
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return value;
}

</script>

<template>
  <Dialog
    v-model:visible="isOpen"
    modal
    :header="t('Manage {resource}', { resource: resource.singular })"
    style="width: 60vw"
    class="manage-dialog"
    :draggable="false"
  >
    <div v-if="loading" class="manage-loading">{{ t('Loading…') }}</div>

    <div v-else-if="detail" class="manage-body">
      <div class="manage-fields">
        <div v-for="field in spec.fields || []" :key="field.key" class="manage-field">
          <span>{{ field.label }}</span>
          <strong>{{ fieldDisplay(field) }}</strong>
        </div>
      </div>

      <p v-if="spec.showDriver" class="manage-driver">
        <span>{{ t('Driver') }}</span>
        <strong v-if="detail.driver">{{ detail.driver.full_name }} · {{ detail.driver.phone }}</strong>
        <strong v-else>{{ t('Not assigned') }}</strong>
      </p>

      <div v-if="(spec.actions || []).length" class="manage-actions">
        <div v-for="action in spec.actions" :key="action.key" class="manage-action">
          <template v-if="action.type === 'confirm'">
            <Button
              :label="action.label"
              severity="warn"
              :disabled="!actionEnabled(action) || busy"
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

      <section v-if="spec.itemsTable" class="manage-section">
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
  gap: 22px;
  padding-top: 4px;
}

.manage-fields {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.manage-field {
  display: grid;
  gap: 4px;
}

.manage-field span,
.manage-driver span {
  color: var(--tm-muted);
  font-size: 0.76rem;
  font-weight: 820;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.manage-field strong,
.manage-driver strong {
  color: var(--tm-heading);
  font-size: 1rem;
}

.manage-driver {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.manage-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.manage-action {
  display: flex;
  align-items: center;
  gap: 8px;
}

.manage-action__select {
  min-width: 200px;
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

@media (max-width: 640px) {
  .manage-action {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
