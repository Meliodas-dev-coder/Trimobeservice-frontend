<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import AdminResourceDialog from '@/components/admin/AdminResourceDialog.vue';
import AdminManageDialog from '@/components/admin/AdminManageDialog.vue';
import CardView from '@/components/admin/CardView.vue';
import { api } from '@/api/client';
import { adminResources } from '@/data/adminResources';
import { useAdminI18n } from '@/i18n/admin';
import { formatDate, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';
import {
  createResource,
  deleteResource,
  getResource,
  isPaginated,
  listResource,
  serializeForm,
  updateResource,
} from '@/api/resources';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const { enumLabel, localeCode, t, translateConfig } = useAdminI18n();

const resourceKey = computed(() => route.meta.resource || 'products');
const department = computed(() => route.meta.department || '');
const baseResource = computed(() => adminResources[resourceKey.value] || adminResources.products);
const resource = computed(() => translateConfig(baseResource.value));
const serverPaginated = computed(() => isPaginated(resource.value));

// Merge the section's department into create defaults (e.g. new brands land in
// the current department; new items in the right section).
const dialogDefaults = computed(() => ({
  ...(resource.value.defaultRow || {}),
  ...(department.value ? { department: department.value } : {}),
}));

// "Fashion · Catalog" when scoped to a department, else the plain eyebrow.
const heroEyebrow = computed(() => {
  if (!department.value) {
    return resource.value.eyebrow;
  }
  const label = department.value.charAt(0).toUpperCase() + department.value.slice(1);
  return `${t(label)} · ${resource.value.eyebrow}`;
});

const canCreate = computed(
  () => resource.value.capabilities?.create !== false && Boolean(resource.value.actionLabel),
);
const canEdit = computed(() => resource.value.capabilities?.edit !== false);
const canRemove = computed(() => resource.value.capabilities?.remove !== false);
const hasDetailRoute = computed(() => Boolean(resource.value.detailRoute));
const canEditRow = computed(() => canEdit.value && !hasDetailRoute.value);
const hasManage = computed(() => Boolean(resource.value.manage || resource.value.detailRoute));
const hasRowActions = computed(() => canEditRow.value || canRemove.value || hasManage.value);
const hasCardView = computed(() => Boolean(resource.value.cardView));
const hasExpansion = computed(() => Boolean(resource.value.expansion));

const rows = ref([]);
const total = ref(0);
const loading = ref(false);
const first = ref(0);
const limit = ref(20);
const search = ref('');
const viewMode = ref('table');
const filters = reactive({});

const dialogOpen = ref(false);
const dialogMode = ref('create');
const editing = ref(null);
const saving = ref(false);
const formErrors = ref({});

const manageOpen = ref(false);
const manageId = ref(null);

// Expandable rows (tree): rowKey -> { loading, rows }, children fetched lazily.
const expandedRows = ref({});
const expansionCache = reactive({});

const moneyColumn = computed(() => resource.value.columns.find((column) => column.type === 'money'));
const dialogFields = computed(() =>
  (resource.value.formFields || []).filter((field) => {
    if (field.createOnly && dialogMode.value !== 'create') {
      return false;
    }
    if (field.editOnly && dialogMode.value !== 'edit') {
      return false;
    }
    return true;
  }),
);

const clientFilteredRows = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) {
    return rows.value;
  }
  return rows.value.filter((row) =>
    Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(query)),
  );
});

const tableRows = computed(() => (serverPaginated.value ? rows.value : clientFilteredRows.value));
const cardRows = computed(() => {
  if (serverPaginated.value) {
    return tableRows.value;
  }
  return tableRows.value.slice(first.value, first.value + limit.value);
});
const cardTotal = computed(() => (serverPaginated.value ? total.value : tableRows.value.length));

const metrics = computed(() => {
  const list = [{ label: t('Records'), value: serverPaginated.value ? total.value : tableRows.value.length }];
  list.push({ label: t('Needs attention'), value: attentionCount(rows.value) });
  if (moneyColumn.value) {
    const sum = rows.value.reduce((acc, row) => acc + Number(row[moneyColumn.value.field] || 0), 0);
    list.push({ label: t('Loaded {field}', { field: moneyColumn.value.header.toLowerCase() }), value: formatMGA(sum) });
  } else {
    list.push({ label: t('Listing'), value: serverPaginated.value ? t('Paginated') : t('Full list') });
  }
  return list;
});

function activeFilters() {
  const out = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      out[key] = value;
    }
  }
  return out;
}

async function fetchData() {
  loading.value = true;
  expandedRows.value = {};
  Object.keys(expansionCache).forEach((key) => delete expansionCache[key]);
  try {
    const page = Math.floor(first.value / limit.value) + 1;
    const { items, meta } = await listResource(resource.value, {
      page,
      limit: limit.value,
      q: serverPaginated.value ? search.value.trim() : '',
      filters: { ...activeFilters(), ...(department.value ? { department: department.value } : {}) },
    });
    rows.value = items;
    total.value = meta.total ?? items.length;
  } catch (err) {
    rows.value = [];
    total.value = 0;
    toast.add({ severity: 'error', summary: t('Could not load records'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    loading.value = false;
  }
}

function resetAndFetch() {
  first.value = 0;
  search.value = '';
  Object.keys(filters).forEach((key) => delete filters[key]);
  (resource.value.filters || []).forEach((filter) => {
    filters[filter.key] = '';
  });
  fetchData();
}

let searchTimer = null;
watch(search, () => {
  if (!serverPaginated.value) {
    first.value = 0;
    return; // client-side filtering handles it
  }
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    first.value = 0;
    fetchData();
  }, 350);
});

watch([resourceKey, department], () => {
  dialogOpen.value = false;
  viewMode.value = 'table';
  resetAndFetch();
}, { immediate: true });

function onPage(event) {
  first.value = event.first;
  limit.value = event.rows;
  if (serverPaginated.value) {
    fetchData();
  }
}

function onFilterChange() {
  first.value = 0;
  fetchData();
}

function setViewMode(mode) {
  viewMode.value = mode;
}

function filterOptions(filter) {
  return filter.options.map((option) => ({ label: enumLabel(option), value: option }));
}

function openCreate() {
  if (resource.value.createRoute) {
    const target = resource.value.createRoute();
    if (department.value) {
      target.query = { ...(target.query || {}), department: department.value };
    }
    router.push(target);
    return;
  }
  dialogMode.value = 'create';
  editing.value = null;
  formErrors.value = {};
  dialogOpen.value = true;
}

function openEdit(row) {
  dialogMode.value = 'edit';
  editing.value = row;
  formErrors.value = {};
  dialogOpen.value = true;
}

function openManage(row) {
  if (resource.value.detailRoute) {
    router.push(resource.value.detailRoute(row));
    return;
  }
  manageId.value = row[resource.value.rowKey];
  manageOpen.value = true;
}

async function onRowExpand(event) {
  const id = event.data[resource.value.rowKey];
  if (expansionCache[id]) {
    return; // already fetched
  }
  expansionCache[id] = { loading: true, rows: [] };
  try {
    const detail = await getResource(resource.value, id);
    expansionCache[id] = { loading: false, rows: detail?.[resource.value.expansion.collectionKey] || [] };
  } catch {
    expansionCache[id] = { loading: false, rows: [] };
  }
}

function expansionRows(row) {
  return expansionCache[row[resource.value.rowKey]]?.rows || [];
}

function expansionLoading(row) {
  return Boolean(expansionCache[row[resource.value.rowKey]]?.loading);
}

function confirmRemove(row) {
  confirm.require({
    header: t('Confirm delete'),
    message: t('Delete this {resource}? This cannot be undone.', { resource: resource.value.singular }),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('Delete'),
    rejectLabel: t('Cancel'),
    accept: async () => {
      try {
        await deleteResource(resource.value, row[resource.value.rowKey]);
        toast.add({ severity: 'success', summary: t('Deleted'), life: 2500 });
        fetchData();
      } catch (err) {
        toast.add({ severity: 'error', summary: t('Delete failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
      }
    },
  });
}

async function handleSubmit(values) {
  saving.value = true;
  formErrors.value = {};
  try {
    const mode = dialogMode.value;
    const body = serializeForm(dialogFields.value, values);
    let saved = null;
    if (dialogMode.value === 'edit' && editing.value) {
      saved = await updateResource(resource.value, editing.value[resource.value.rowKey], body);
      toast.add({ severity: 'success', summary: t('Changes saved'), life: 2500 });
    } else {
      saved = await createResource(resource.value, body);
      const hookFailures = await runAfterSaveHooks(saved, values, mode);
      toast.add({ severity: 'success', summary: t('{resource} created', { resource: capitalize(resource.value.singular) }), life: 2500 });
      showAfterSaveWarnings(hookFailures);
    }
    dialogOpen.value = false;
    fetchData();
  } catch (err) {
    if (err?.details) {
      formErrors.value = err.details;
    }
    toast.add({ severity: 'error', summary: t('Save failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    saving.value = false;
  }
}

function callHook(method, path, body) {
  switch ((method || 'post').toLowerCase()) {
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

async function runAfterSaveHooks(saved, values, mode) {
  const failures = [];
  for (const hook of resource.value.afterSave || []) {
    if (hook.modes && !hook.modes.includes(mode)) {
      continue;
    }
    const value = values[hook.field];
    if (!saved || value === null || value === undefined || value === '') {
      continue;
    }
    try {
      await callHook(
        hook.method,
        hook.path(saved, values),
        hook.body ? hook.body(value, values, saved) : { [hook.field]: value },
      );
    } catch (err) {
      failures.push({ hook, err });
    }
  }
  return failures;
}

function showAfterSaveWarnings(failures) {
  for (const { hook, err } of failures) {
    toast.add({
      severity: 'warn',
      summary: hook.errorSummary || t('Follow-up save failed'),
      detail: t(err?.message || 'The main record was saved, but a related update failed.'),
      life: 5000,
    });
  }
}

function attentionCount(list) {
  return list.filter((row) => {
    const values = [row.status, row.payment_status].map((value) => String(value || '').toLowerCase());
    return values.some((value) => ['unpaid', 'pending', 'requested'].includes(value));
  }).length;
}

function prettify(value) {
  return enumLabel(value);
}

function capitalize(value) {
  return String(value).replace(/^\w/, (c) => c.toUpperCase());
}

function displayValue(row, column) {
  if (typeof column.format === 'function') {
    return column.format(row);
  }
  const value = row[column.field];
  if (column.type === 'money') {
    return formatMGA(Number(value || 0));
  }
  if (column.type === 'date') {
    return formatDate(value, localeCode.value);
  }
  if (column.type === 'boolean') {
    return value ? column.trueLabel || t('Active') : column.falseLabel || t('Inactive');
  }
  if (column.type === 'status') {
    return prettify(value);
  }
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return value;
}
</script>

<template>
  <section class="admin-resource">
    <div class="resource-hero">
      <div>
        <p>{{ heroEyebrow }}</p>
        <h2>{{ resource.plural }}</h2>
        <span>{{ resource.description }}</span>
      </div>
      <Button v-if="canCreate" :label="resource.actionLabel" icon="pi pi-plus" @click="openCreate" />
    </div>

    <div class="resource-metrics">
      <article v-for="metric in metrics" :key="metric.label">
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
      </article>
    </div>

    <section class="resource-table" :aria-label="resource.plural">
      <div class="resource-table__toolbar">
        <div class="resource-table__filters">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="search" :placeholder="t('Search {resource}', { resource: resource.plural.toLowerCase() })" />
          </IconField>
          <Select
            v-for="filter in resource.filters || []"
            :key="filter.key"
            v-model="filters[filter.key]"
            :options="filterOptions(filter)"
            optionLabel="label"
            optionValue="value"
            :placeholder="filter.label"
            showClear
            class="resource-filter"
            @change="onFilterChange"
          />
        </div>
        <div class="resource-table__tools">
          <div v-if="hasCardView" class="resource-view-toggle" :aria-label="t('View style')">
            <Button
              icon="pi pi-table"
              :severity="viewMode === 'table' ? 'primary' : 'secondary'"
              :outlined="viewMode !== 'table'"
              :aria-label="t('Table view')"
              :title="t('Table view')"
              @click="setViewMode('table')"
            />
            <Button
              icon="pi pi-th-large"
              :severity="viewMode === 'card' ? 'primary' : 'secondary'"
              :outlined="viewMode !== 'card'"
              :aria-label="t('Card view')"
              :title="t('Card view')"
              @click="setViewMode('card')"
            />
          </div>
          <Button icon="pi pi-refresh" :label="t('Refresh')" severity="secondary" outlined @click="fetchData" />
        </div>
      </div>

      <DataTable
        v-if="viewMode === 'table'"
        :value="tableRows"
        :dataKey="resource.rowKey"
        :loading="loading"
        :lazy="serverPaginated"
        paginator
        v-model:first="first"
        v-model:rows="limit"
        v-model:expandedRows="expandedRows"
        :rowsPerPageOptions="[10, 20, 50]"
        :totalRecords="serverPaginated ? total : tableRows.length"
        stripedRows
        responsiveLayout="scroll"
        tableStyle="min-width: 860px"
        @page="onPage"
        @row-expand="onRowExpand"
      >
        <Column v-if="hasExpansion" expander style="width: 3.5rem" :exportable="false" />

        <Column v-for="column in resource.columns" :key="column.field" :field="column.field" :header="column.header">
          <template #body="{ data }">
            <Tag
              v-if="column.type === 'status' || column.type === 'boolean'"
              :value="displayValue(data, column)"
              :severity="statusSeverity(data[column.field])"
            />
            <span v-else :class="{ 'cell-money': column.type === 'money' }">
              {{ displayValue(data, column) }}
            </span>
          </template>
        </Column>

        <Column v-if="hasRowActions" :header="t('Actions')" :exportable="false" style="width: 8rem">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                v-if="hasManage"
                icon="pi pi-window-maximize"
                severity="secondary"
                text
                rounded
                :aria-label="t('Manage')"
                :title="t('Manage / detail')"
                @click="openManage(data)"
              />
              <Button
                v-if="canEditRow"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                :aria-label="t('Edit')"
                :title="t('Edit')"
                @click="openEdit(data)"
              />
              <Button
                v-if="canRemove"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                :aria-label="t('Delete')"
                :title="t('Delete')"
                @click="confirmRemove(data)"
              />
            </div>
          </template>
        </Column>

        <template v-if="hasExpansion" #expansion="{ data }">
          <div class="row-expansion">
            <div v-if="expansionLoading(data)" class="row-expansion__state">{{ t('Loading…') }}</div>
            <table v-else-if="expansionRows(data).length" class="subtable">
              <thead>
                <tr>
                  <th v-for="col in resource.expansion.columns" :key="col.field">{{ col.header }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="child in expansionRows(data)" :key="child.id">
                  <td v-for="col in resource.expansion.columns" :key="col.field">
                    <Tag
                      v-if="col.type === 'status' || col.type === 'boolean'"
                      :value="displayValue(child, col)"
                      :severity="statusSeverity(child[col.field])"
                    />
                    <span v-else :class="{ 'cell-money': col.type === 'money' }">{{ displayValue(child, col) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="row-expansion__state">{{ t(resource.expansion.emptyLabel || 'None yet.') }}</div>
          </div>
        </template>

        <template #empty>
          <div class="resource-empty">
            <i class="pi pi-inbox" />
            <span>{{ loading ? t('Loading…') : t('No records found.') }}</span>
          </div>
        </template>
      </DataTable>

      <CardView
        v-else
        :rows="cardRows"
        :resource="resource"
        :rowKey="resource.rowKey"
        :loading="loading"
        :totalRecords="cardTotal"
        :first="first"
        :rowsPerPage="limit"
        :hasManage="hasManage"
        :canEdit="canEditRow"
        :canRemove="canRemove"
        @page="onPage"
        @manage="openManage"
        @edit="openEdit"
        @remove="confirmRemove"
      />
    </section>

    <AdminResourceDialog
      v-model:visible="dialogOpen"
      :title="dialogMode === 'edit' ? t('Edit {resource}', { resource: resource.singular }) : resource.actionLabel || t('Create')"
      :fields="dialogFields"
      :initial="editing"
      :defaults="dialogDefaults"
      :department="department"
      :loading="saving"
      :errors="formErrors"
      @submit="handleSubmit"
    />

    <AdminManageDialog
      v-if="hasManage"
      v-model:visible="manageOpen"
      :resource="resource"
      :itemId="manageId"
      @changed="fetchData"
    />
  </section>
</template>

<style scoped>
.admin-resource {
  display: grid;
  gap: 18px;
}

.resource-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
}

.resource-hero p,
.resource-hero h2 {
  margin: 0;
}

.resource-hero p {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.resource-hero h2 {
  margin-top: 5px;
  color: var(--tm-heading);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
}

.resource-hero span {
  display: block;
  max-width: 740px;
  margin-top: 10px;
  color: var(--tm-muted);
  line-height: 1.55;
}

.resource-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.resource-metrics article {
  display: grid;
  gap: 6px;
  min-height: 92px;
  align-content: center;
  padding: 16px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.resource-metrics span {
  color: var(--tm-muted);
  font-size: 0.8rem;
  font-weight: 820;
}

.resource-metrics strong {
  color: var(--tm-heading);
  font-size: clamp(1.35rem, 2vw, 1.8rem);
  line-height: 1.05;
}

.resource-table {
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.resource-table__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--tm-border);
}

.resource-table__tools,
.resource-view-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resource-table__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.resource-table__filters :deep(.p-iconfield) {
  width: min(100%, 320px);
}

.resource-table__filters :deep(.p-inputtext) {
  width: 100%;
}

.resource-filter {
  min-width: 160px;
}

.resource-table :deep(.p-datatable-header) {
  border: 0;
}

.resource-table :deep(.p-datatable-thead > tr > th) {
  border-color: var(--tm-border);
  background: var(--tm-surface-soft);
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.resource-table :deep(.p-datatable-tbody > tr > td) {
  border-color: var(--tm-border);
  color: var(--tm-text);
  vertical-align: middle;
}

.resource-table :deep(.p-paginator) {
  border-color: var(--tm-border);
  background: var(--tm-surface);
}

.cell-money {
  color: var(--tm-heading);
  font-weight: 900;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

.row-expansion {
  padding: 6px 10px 10px 3.5rem;
}

.row-expansion__state {
  padding: 12px 4px;
  color: var(--tm-muted);
  font-weight: 700;
}

.subtable {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--tm-surface-soft);
}

.subtable th {
  padding: 9px 12px;
  color: var(--tm-muted);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  border-bottom: 1px solid var(--tm-border);
}

.subtable td {
  padding: 10px 12px;
  color: var(--tm-text);
  font-size: 0.9rem;
  border-bottom: 1px solid var(--tm-border);
}

.subtable tbody tr:last-child td {
  border-bottom: 0;
}

.resource-empty {
  display: grid;
  gap: 8px;
  place-items: center;
  padding: 36px;
  color: var(--tm-muted);
  font-weight: 800;
}

.resource-empty i {
  color: var(--tm-gold);
  font-size: 1.5rem;
}

@media (max-width: 760px) {
  .resource-hero,
  .resource-table__toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .resource-metrics {
    grid-template-columns: 1fr;
  }

  .resource-hero .p-button,
  .resource-table__toolbar .p-button {
    width: 100%;
  }

  .resource-table__tools,
  .resource-view-toggle {
    width: 100%;
  }

  .resource-view-toggle .p-button {
    flex: 1;
  }
}
</style>
