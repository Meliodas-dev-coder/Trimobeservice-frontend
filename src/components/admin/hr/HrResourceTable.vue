<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useConfirm } from 'primevue/useconfirm';
import { useToast } from 'primevue/usetoast';
import { useRouter } from 'vue-router';

import {
  createHrResource,
  deleteHrResource,
  downloadHrDocument,
  listHrLookup,
  listHrResource,
  runHrAction,
  updateHrResource,
} from '@/api/hr';
import HrResourceDialog from '@/components/admin/hr/HrResourceDialog.vue';
import {
  approverLabel,
  canMutateHrResource,
  hrFeatureForResource,
  hrResourceUsesEmployeeScope,
  scopeLabel,
} from '@/data/hrAccess';
import { getHrResource } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';
import { localizedValue } from '@/utils/localized';

const props = defineProps({
  resource: { type: Object, required: true },
  defaults: { type: Object, default: () => ({}) },
  compact: { type: Boolean, default: false },
  showHeader: { type: Boolean, default: true },
});

const emit = defineEmits(['loaded']);
const confirm = useConfirm();
const toast = useToast();
const router = useRouter();
const auth = useAuthStore();
const { enumLabel, language, localeCode, t } = useAdminI18n();

// Free-text columns backed by a `translations` bucket render in the console
// language, falling back to the stored base value when untranslated.
const localizedKeys = computed(() => new Set(
  (props.resource.fields || []).filter((field) => field.localized).map((field) => field.key),
));

const rows = ref([]);
const loading = ref(false);
const error = ref('');
const q = ref('');
const filters = ref({});
const page = ref(1);
const limit = ref(props.compact ? 8 : 20);
// Loaded option lists for dynamic (relation) filters, keyed by filter key.
const filterOptions = ref({});
const total = ref(0);
const dialogOpen = ref(false);
const current = ref(null);
const saving = ref(false);
const actionDialog = ref(false);
const pendingAction = ref(null);
const actionNote = ref('');
const actionForm = ref({});
const actionBusy = ref(false);
const detailOpen = ref(false);
const detailRecord = ref(null);

const accessFeature = computed(() => props.resource.accessFeature || hrFeatureForResource(props.resource));
const recordScope = computed(() => hrResourceUsesEmployeeScope(props.resource)
  ? auth.hrScope(accessFeature.value, 'view')
  : null);
const canDownload = computed(() => Boolean(props.resource.download && auth.canHr(accessFeature.value, 'download')));
const effectiveDefaults = computed(() => {
  const defaults = { ...props.defaults };
  const hasEmployeeField = (props.resource.fields || []).some((field) => field.key === 'employee_id');
  const createAction = props.resource.accessActions?.create || 'create';
  if (hasEmployeeField && auth.hrScope(accessFeature.value, createAction) === 'self' && auth.employee?.id && !defaults.employee_id) {
    defaults.employee_id = Number(auth.employee.id);
  }
  return defaults;
});
const canCreate = computed(() => Boolean(
  props.resource.capabilities?.create
  && canMutateHrResource(auth, props.resource, props.resource.accessActions?.create || 'create', { values: effectiveDefaults.value })
));
const visibleColumns = computed(() => props.resource.columns || []);
const detailFields = computed(() => (props.resource.fields || []).filter((field) => (
  field.type !== 'file' && !field.hidden && detailValue(detailRecord.value, field) !== ''
)));

function nestedValue(row, path) {
  if (!path) return undefined;
  return String(path).split('.').reduce((value, key) => value?.[key], row);
}

function cellValue(row, column) {
  if (localizedKeys.value.has(column.field)) {
    const localized = localizedValue(row, column.field, language.value);
    if (localized) return localized;
  }
  const direct = nestedValue(row, column.field);
  if (direct !== undefined && direct !== null && direct !== '') return direct;
  for (const fallback of column.fallback || []) {
    const value = nestedValue(row, fallback);
    if (value !== undefined && value !== null && value !== '') return value;
  }
  if (column.field === 'full_name') return `${row.first_name || ''} ${row.last_name || ''}`.trim();
  return '';
}

function formatCell(row, column) {
  const value = cellValue(row, column);
  if (value === '' || value === null || value === undefined) return '—';
  if (column.type === 'date' || column.type === 'datetime') {
    const parsed = new Date(column.type === 'date' && String(value).length === 10 ? `${value}T00:00:00` : value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat(localeCode.value, column.type === 'datetime'
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { dateStyle: 'medium' }).format(parsed);
  }
  if (column.type === 'money') {
    return new Intl.NumberFormat(localeCode.value, { style: 'currency', currency: row.currency || 'MGA', maximumFractionDigits: 2 }).format(Number(value));
  }
  if (column.type === 'boolean') return value ? t('Yes') : t('No');
  if (column.type === 'percent') return `${Number(value)}%`;
  if (column.type === 'duration') {
    const minutes = Number(value || 0);
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  }
  if (column.type === 'time') {
    // A bare "HH:MM[:SS]" (shift times) is shown as-is; a full timestamp
    // (clock in/out, stored UTC) is rendered in the viewer's local time.
    const hhmm = String(value).match(/^(\d{1,2}):(\d{2})/);
    if (hhmm) return `${hhmm[1].padStart(2, '0')}:${hhmm[2]}`;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return new Intl.DateTimeFormat(localeCode.value, { hour: '2-digit', minute: '2-digit' }).format(parsed);
    }
    return value;
  }
  if (column.type === 'weekdays') {
    const labels = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' };
    const list = Array.isArray(value) ? value : [];
    return list.length ? list.map((day) => t(labels[day] || day)).join(', ') : '—';
  }
  if (column.type === 'approvalChain') {
    const entries = Array.isArray(value) ? value : [];
    return entries.length ? entries.map((entry) => t(approverLabel(entry))).join(' → ') : '—';
  }
  if (column.type === 'enum' || column.type === 'status' || column.type === 'select') return enumLabel(value);
  if (typeof value === 'object') return value.name || value.title || JSON.stringify(value);
  return value;
}

function detailValue(row, field) {
  if (!row) return '';
  // The composite leave-date editor has no data key of its own; compose the
  // detail value from the record's real start_date / end_date instead.
  if (field.type === 'leaveDates') {
    if (!row.start_date) return '';
    const start = formatCell(row, { field: 'start_date', type: 'date' });
    const end = formatCell(row, { field: 'end_date', type: 'date' });
    return (!row.end_date || row.end_date === row.start_date) ? start : `${start} → ${end}`;
  }
  if (field.type === 'relation') {
    const stem = field.key.replace(/_id$/, '');
    const named = row[`${stem}_name`] || row[`${stem}_title`];
    if (named !== undefined && named !== null && named !== '') return named;
  }
  const column = { field: field.key, type: field.type, label: field.label };
  return formatCell(row, column);
}

function isLinkField(field) {
  return field.type === 'url' || field.key.endsWith('_url');
}

function openRecord(row) {
  detailRecord.value = row;
  detailOpen.value = true;
}

function statusSeverity(value) {
  const status = String(value || '').toLowerCase();
  if (['active', 'approved', 'completed', 'hired', 'reimbursed', 'present', 'published', 'verified', 'accepted'].includes(status)) return 'success';
  if (['pending', 'submitted', 'in_review', 'scheduled', 'onboarding', 'draft', 'sent'].includes(status)) return 'warn';
  if (['rejected', 'cancelled', 'inactive', 'offboarded', 'expired', 'absent', 'declined'].includes(status)) return 'danger';
  return 'info';
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await listHrResource(props.resource, {
      page: page.value,
      limit: limit.value,
      q: q.value,
      params: filters.value,
    });
    rows.value = result.items;
    total.value = Number(result.meta?.total ?? result.items.length);
    emit('loaded', result);
  } catch (err) {
    error.value = err.message || t('Could not load HR records.');
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  if (!canCreate.value) return;
  current.value = null;
  dialogOpen.value = true;
}

function openEdit(row) {
  if (!canEdit(row)) return;
  current.value = row;
  dialogOpen.value = true;
}

async function save(body) {
  saving.value = true;
  try {
    if (body.__uploadedRecord) {
      // The secure multipart endpoint creates the document atomically; do not
      // follow it with a second JSON POST against the read-only collection.
    } else if (current.value) await updateHrResource(props.resource, current.value.id, body);
    else await createHrResource(props.resource, body);
    toast.add({ severity: 'success', summary: t('Saved'), detail: t('HR record saved successfully.'), life: 2800 });
    dialogOpen.value = false;
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not save'), detail: err.message, life: 5000 });
  } finally {
    saving.value = false;
  }
}

async function download(row) {
  try {
    await downloadHrDocument(row.id, row.file_name || row.name);
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Download failed'), detail: err.message, life: 5000 });
  }
}

function remove(row) {
  if (!canRemove(row)) return;
  confirm.require({
    header: t('Delete {item}', { item: t(props.resource.singular) }),
    message: t('This record will be permanently removed. Continue?'),
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: t('Cancel'),
    acceptLabel: t('Delete'),
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await deleteHrResource(props.resource, row.id);
        toast.add({ severity: 'success', summary: t('Deleted'), detail: t('HR record removed.'), life: 2500 });
        await load();
      } catch (err) {
        toast.add({ severity: 'error', summary: t('Could not delete'), detail: err.message, life: 5000 });
      }
    },
  });
}

function startAction(row, action) {
  pendingAction.value = { row, action };
  actionNote.value = '';
  actionForm.value = Object.fromEntries((action.formFields || []).map((field) => [field.key, field.key === 'work_email' ? row.email || '' : field.default ?? '']));
  if (action.requiresNote || action.inputKey || action.formFields?.length) actionDialog.value = true;
  else executeAction();
}

function actionReady() {
  const action = pendingAction.value?.action;
  if (!action) return false;
  if ((action.requiresNote || action.inputKey) && !actionNote.value.trim()) return false;
  return !(action.formFields || []).some((field) => field.required && !String(actionForm.value[field.key] ?? '').trim());
}

async function executeAction() {
  if (!pendingAction.value) return;
  actionBusy.value = true;
  const { row, action } = pendingAction.value;
  try {
    const body = action.formFields?.length
      ? Object.fromEntries(Object.entries(actionForm.value).filter(([, value]) => value !== '' && value !== null && value !== undefined))
      : action.inputKey
      ? { [action.inputKey]: actionNote.value }
      : actionNote.value ? { note: actionNote.value } : {};
    await runHrAction(props.resource, row.id, action.key, body, action.method || 'post');
    toast.add({ severity: 'success', summary: t('Action completed'), detail: t('{action} completed successfully.', { action: t(action.label) }), life: 2800 });
    actionDialog.value = false;
    pendingAction.value = null;
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Action failed'), detail: err.message, life: 5000 });
  } finally {
    actionBusy.value = false;
  }
}

function openDetail(row) {
  if (!props.resource.detailRoute) return;
  router.push({ name: props.resource.detailRoute, params: { id: row.id } });
}

function onPage(event) {
  page.value = event.page + 1;
  limit.value = event.rows;
  load();
}

function visibleActions(row) {
  return (props.resource.actions || []).filter((action) => (
    (!action.when || action.when(row))
    && canMutateHrResource(auth, props.resource, action.permissionAction || action.key, { row })
  ));
}

function canEdit(row) {
  return Boolean(
    props.resource.capabilities?.edit
    && (!props.resource.editWhen || props.resource.editWhen(row))
    && canMutateHrResource(auth, props.resource, props.resource.accessActions?.edit || 'update', { row })
  );
}

function canRemove(row) {
  return Boolean(
    props.resource.capabilities?.remove
    && canMutateHrResource(auth, props.resource, props.resource.accessActions?.remove || 'delete', { row })
  );
}

// Load option lists for any filter that pulls from a resource (e.g. a Department
// filter on the positions list). Static enum filters need nothing loaded.
async function loadFilterOptions() {
  const relationFilters = (props.resource.filters || []).filter((f) => f.resource);
  if (!relationFilters.length) {
    filterOptions.value = {};
    return;
  }
  const out = {};
  await Promise.all(relationFilters.map(async (filter) => {
    try {
      const items = ['employees', 'departments', 'positions', 'admin-users'].includes(filter.resource)
        ? await listHrLookup(filter.resource)
        : (await listHrResource(getHrResource(filter.resource), { limit: 100 })).items;
      out[filter.key] = items
        .filter((item) => item.is_active === undefined || item.is_active === null
          || (item.is_active !== false && item.is_active !== 0 && item.is_active !== '0'))
        .map((item) => ({ label: item[filter.optionLabel] || item.name || item.title || `#${item.id}`, value: item.id }));
    } catch {
      out[filter.key] = [];
    }
  }));
  filterOptions.value = out;
}

watch(() => props.resource.id, () => {
  page.value = 1;
  q.value = '';
  filters.value = {};
  load();
  loadFilterOptions();
});

onMounted(() => {
  load();
  loadFilterOptions();
});

defineExpose({ load, openCreate });
</script>

<template>
  <section class="hr-resource" :class="{ 'is-compact': compact }">
    <header v-if="showHeader" class="hr-resource__head">
      <div>
        <span class="hr-resource__icon"><i :class="resource.icon" /></span>
        <div>
          <p>{{ t('HR records') }}</p>
          <h3>{{ t(resource.title) }}</h3>
          <span>{{ t(resource.description) }}</span>
          <Tag v-if="recordScope" class="hr-resource__scope" :value="t(scopeLabel(recordScope))" severity="info" />
        </div>
      </div>
      <Button
        v-if="canCreate"
        :label="t('Add {item}', { item: t(resource.singular) })"
        icon="pi pi-plus"
        @click="openCreate"
      />
    </header>

    <div class="hr-resource__table">
      <div class="hr-resource__toolbar">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="q" :placeholder="t('Search HR records')" @keyup.enter="page = 1; load()" />
        </IconField>
        <template v-for="filter in resource.filters || []" :key="filter.key">
          <Select
            v-if="filter.resource"
            v-model="filters[filter.key]"
            :options="filterOptions[filter.key] || []"
            option-label="label"
            option-value="value"
            filter
            :placeholder="t(filter.label)"
            show-clear
            @change="page = 1; load()"
          />
          <Select
            v-else
            v-model="filters[filter.key]"
            :options="filter.options"
            :option-label="(value) => enumLabel(value)"
            :placeholder="t(filter.label)"
            show-clear
            @change="page = 1; load()"
          />
        </template>
        <Button icon="pi pi-refresh" severity="secondary" text rounded :aria-label="t('Refresh')" :loading="loading" @click="load" />
      </div>

      <div v-if="error" class="hr-resource__state is-error">
        <i class="pi pi-exclamation-circle" />
        <strong>{{ t('Could not load HR records') }}</strong>
        <span>{{ error }}</span>
        <Button :label="t('Try again')" severity="secondary" outlined @click="load" />
      </div>

      <DataTable
        v-else
        :value="rows"
        :loading="loading"
        data-key="id"
        striped-rows
        responsive-layout="scroll"
        :paginator="!compact"
        :lazy="!compact"
        :first="(page - 1) * limit"
        :rows="limit"
        :rows-per-page-options="[10, 20, 50]"
        :total-records="total"
        @page="onPage"
        @row-dblclick="openDetail($event.data)"
      >
        <template #empty>
          <div class="hr-resource__state">
            <i :class="resource.icon" />
            <strong>{{ t('No {items} yet', { items: t(resource.title).toLowerCase() }) }}</strong>
            <span>{{ t('Create the first record or adjust your search and filters.') }}</span>
          </div>
        </template>

        <Column v-for="column in visibleColumns" :key="column.field" :header="t(column.label)">
          <template #body="{ data }">
            <Tag
              v-if="column.type === 'status'"
              :value="formatCell(data, column)"
              :severity="statusSeverity(cellValue(data, column))"
            />
            <span v-else :class="{ 'hr-cell-money': column.type === 'money' }">{{ formatCell(data, column) }}</span>
          </template>
        </Column>

        <Column :header="t('Actions')" frozen align-frozen="right">
          <template #body="{ data }">
            <div class="hr-row-actions">
              <Button icon="pi pi-eye" severity="secondary" text rounded :aria-label="t('View details')" :title="t('View details')" @click="openRecord(data)" />
              <Button
                v-for="action in visibleActions(data)"
                :key="action.key"
                :icon="action.icon"
                :severity="action.severity"
                text
                rounded
                :aria-label="t(action.label)"
                :title="t(action.label)"
                @click="startAction(data, action)"
              />
              <Button v-if="canDownload" icon="pi pi-download" severity="secondary" text rounded :aria-label="t('Download')" @click="download(data)" />
              <Button v-if="resource.detailRoute" icon="pi pi-arrow-right" severity="secondary" text rounded :aria-label="t('Open')" @click="openDetail(data)" />
              <Button v-if="resource.fields.length && canEdit(data)" icon="pi pi-pencil" severity="secondary" text rounded :aria-label="t('Edit')" @click="openEdit(data)" />
              <Button v-if="canRemove(data)" icon="pi pi-trash" severity="danger" text rounded :aria-label="t('Delete')" @click="remove(data)" />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <HrResourceDialog
      v-model:visible="dialogOpen"
      :resource="resource"
      :record="current"
      :defaults="effectiveDefaults"
      :saving="saving"
      @submit="save"
    />

    <Dialog v-model:visible="actionDialog" modal :header="t(pendingAction?.action?.dialogTitle || (pendingAction?.action?.inputKey ? pendingAction.action.inputLabel : 'Reason required'))" :style="{ width: 'min(560px, 94vw)' }">
      <div v-if="pendingAction?.action?.formFields?.length" class="hr-action-form">
        <label v-for="field in pendingAction.action.formFields" :key="field.key">
          <span>{{ t(field.label) }} <b v-if="field.required">*</b></span>
          <Select
            v-if="field.type === 'select'"
            v-model="actionForm[field.key]"
            :options="field.options"
            :option-label="(value) => enumLabel(value)"
            :placeholder="t('Select an option')"
          />
          <InputText v-else v-model="actionForm[field.key]" :type="field.type === 'email' ? 'email' : 'text'" />
        </label>
      </div>
      <label v-else class="hr-action-note">
        <span>{{ t(pendingAction?.action?.inputLabel || 'Add a clear reason for this decision.') }}</span>
        <Textarea v-model="actionNote" rows="4" auto-resize autofocus />
      </label>
      <template #footer>
        <Button :label="t('Cancel')" severity="secondary" text @click="actionDialog = false" />
        <Button :label="t('Confirm action')" :disabled="!actionReady()" :loading="actionBusy" @click="executeAction" />
      </template>
    </Dialog>

    <Dialog v-model:visible="detailOpen" modal :header="t('{item} details', { item: t(resource.singular) })" :style="{ width: 'min(760px, 94vw)' }">
      <div v-if="detailRecord" class="hr-record-detail">
        <article v-for="field in detailFields" :key="field.key" :class="{ 'is-wide': field.fullWidth || field.type === 'textarea' || field.type === 'json' }">
          <span>{{ t(field.label) }}</span>
          <a v-if="isLinkField(field) && detailRecord[field.key]" :href="detailRecord[field.key]" target="_blank" rel="noopener noreferrer">{{ t('Open secure document') }} <i class="pi pi-external-link" /></a>
          <strong v-else>{{ detailValue(detailRecord, field) }}</strong>
        </article>
      </div>
      <template #footer>
        <Button v-if="canDownload" :label="t('Download')" icon="pi pi-download" severity="secondary" outlined @click="download(detailRecord)" />
        <Button :label="t('Close')" @click="detailOpen = false" />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.hr-resource { display: grid; gap: 16px; min-width: 0; }
.hr-resource__head { display: flex; align-items: center; justify-content: space-between; gap: 18px; }
.hr-resource__head > div { display: flex; align-items: flex-start; gap: 13px; min-width: 0; }
.hr-resource__head p { margin: 0 0 4px; color: var(--tm-gold); font-size: 0.69rem; font-weight: 950; letter-spacing: 0.11em; text-transform: uppercase; }
.hr-resource__head h3 { margin: 0; color: var(--tm-heading); font-size: 1.35rem; letter-spacing: -0.03em; }
.hr-resource__head div > div > span { display: block; max-width: 760px; margin-top: 6px; color: var(--tm-muted); font-size: 0.86rem; line-height: 1.5; }
.hr-resource__head :deep(.hr-resource__scope) { display: inline-flex; margin-top: 8px; }
.hr-resource__icon { display: grid; width: 42px; height: 42px; flex: 0 0 auto; border-radius: 13px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.hr-resource__table { overflow: hidden; border: 1px solid var(--tm-border); border-radius: 17px; background: var(--tm-surface); box-shadow: 0 10px 28px rgba(37, 31, 20, 0.05); }
.hr-resource__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 9px; padding: 12px; border-bottom: 1px solid var(--tm-border); background: var(--tm-surface-soft); }
.hr-resource__toolbar :deep(.p-iconfield) { width: min(100%, 320px); }
.hr-resource__toolbar :deep(.p-iconfield .p-inputtext) { width: 100%; }
.hr-resource__toolbar :deep(.p-select) { min-width: 155px; }
.hr-resource__toolbar > .p-button:last-child { margin-left: auto; }
.hr-resource :deep(.p-datatable-thead > tr > th) { border-color: var(--tm-border); background: var(--tm-surface-soft); color: var(--tm-muted); font-size: 0.73rem; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase; }
.hr-resource :deep(.p-datatable-tbody > tr > td) { border-color: var(--tm-border); color: var(--tm-text); font-size: 0.88rem; }
.hr-row-actions { display: flex; justify-content: flex-end; white-space: nowrap; }
.hr-cell-money { color: var(--tm-heading); font-weight: 850; white-space: nowrap; }
.hr-resource__state { display: grid; justify-items: center; gap: 7px; padding: 38px 20px; color: var(--tm-muted); text-align: center; }
.hr-resource__state i { color: var(--tm-gold); font-size: 1.5rem; }
.hr-resource__state strong { color: var(--tm-heading); }
.hr-resource__state span { max-width: 520px; font-size: 0.85rem; }
.hr-resource__state.is-error i { color: var(--tm-coral); }
.hr-action-note { display: grid; gap: 9px; color: var(--tm-heading); font-weight: 800; }
.hr-action-note :deep(.p-textarea) { width: 100%; }
.hr-action-form { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 13px; }
.hr-action-form label { display: grid; gap: 6px; color: var(--tm-heading); font-size: .78rem; font-weight: 800; }
.hr-action-form label b { color: var(--tm-coral); }.hr-action-form :deep(.p-inputtext),.hr-action-form :deep(.p-select) { width: 100%; }
.hr-record-detail { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 1px; overflow: hidden; border: 1px solid var(--tm-border); border-radius: 13px; background: var(--tm-border); }.hr-record-detail article { display: grid; align-content: start; gap: 5px; min-width: 0; padding: 12px; background: var(--tm-surface); }.hr-record-detail article.is-wide { grid-column: 1 / -1; }.hr-record-detail span { color: var(--tm-muted); font-size: .68rem; font-weight: 800; }.hr-record-detail strong,.hr-record-detail a { overflow-wrap: anywhere; color: var(--tm-heading); font-size: .82rem; line-height: 1.5; white-space: pre-wrap; }.hr-record-detail a { color: var(--tm-emerald); font-weight: 850; text-decoration: none; }
.hr-resource.is-compact .hr-resource__toolbar { display: none; }

@media (max-width: 720px) {
  .hr-resource__head { align-items: stretch; flex-direction: column; }
  .hr-resource__head > .p-button { width: 100%; }
  .hr-resource__toolbar :deep(.p-iconfield), .hr-resource__toolbar :deep(.p-select) { width: 100%; }
  .hr-resource__toolbar > .p-button:last-child { margin-left: 0; }
  .hr-record-detail { grid-template-columns: 1fr; }.hr-record-detail article.is-wide { grid-column: auto; }
}
</style>
