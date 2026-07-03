<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import AdminResourceDialog from '@/components/admin/AdminResourceDialog.vue';
import AdminManageDialog from '@/components/admin/AdminManageDialog.vue';
import { adminResources } from '@/data/adminResources';
import { formatMGA } from '@/utils/format';
import {
  createResource,
  deleteResource,
  isPaginated,
  listResource,
  serializeForm,
  updateResource,
} from '@/api/resources';

const route = useRoute();
const toast = useToast();
const confirm = useConfirm();

const resourceKey = computed(() => route.meta.resource || 'products');
const resource = computed(() => adminResources[resourceKey.value] || adminResources.products);
const serverPaginated = computed(() => isPaginated(resource.value));

const canCreate = computed(
  () => resource.value.capabilities?.create !== false && Boolean(resource.value.actionLabel),
);
const canEdit = computed(() => resource.value.capabilities?.edit !== false);
const canRemove = computed(() => resource.value.capabilities?.remove !== false);
const hasManage = computed(() => Boolean(resource.value.manage));
const hasRowActions = computed(() => canEdit.value || canRemove.value || hasManage.value);

const rows = ref([]);
const total = ref(0);
const loading = ref(false);
const first = ref(0);
const limit = ref(20);
const search = ref('');
const filters = reactive({});

const dialogOpen = ref(false);
const dialogMode = ref('create');
const editing = ref(null);
const saving = ref(false);
const formErrors = ref({});

const manageOpen = ref(false);
const manageId = ref(null);

const moneyColumn = computed(() => resource.value.columns.find((column) => column.type === 'money'));

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

const metrics = computed(() => {
  const list = [{ label: 'Records', value: serverPaginated.value ? total.value : tableRows.value.length }];
  list.push({ label: 'Needs attention', value: attentionCount(rows.value) });
  if (moneyColumn.value) {
    const sum = rows.value.reduce((acc, row) => acc + Number(row[moneyColumn.value.field] || 0), 0);
    list.push({ label: `Loaded ${moneyColumn.value.header.toLowerCase()}`, value: formatMGA(sum) });
  } else {
    list.push({ label: 'Listing', value: serverPaginated.value ? 'Paginated' : 'Full list' });
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
  try {
    const page = Math.floor(first.value / limit.value) + 1;
    const { items, meta } = await listResource(resource.value, {
      page,
      limit: limit.value,
      q: serverPaginated.value ? search.value.trim() : '',
      filters: activeFilters(),
    });
    rows.value = items;
    total.value = meta.total ?? items.length;
  } catch (err) {
    rows.value = [];
    total.value = 0;
    toast.add({ severity: 'error', summary: 'Could not load records', detail: err?.message || 'Request failed', life: 4000 });
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
    return; // client-side filtering handles it
  }
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    first.value = 0;
    fetchData();
  }, 350);
});

watch(resourceKey, () => {
  dialogOpen.value = false;
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

function filterOptions(filter) {
  return filter.options.map((option) => ({ label: prettify(option), value: option }));
}

function openCreate() {
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
  manageId.value = row[resource.value.rowKey];
  manageOpen.value = true;
}

function confirmRemove(row) {
  confirm.require({
    header: 'Confirm delete',
    message: `Delete this ${resource.value.singular}? This cannot be undone.`,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: 'Delete',
    rejectLabel: 'Cancel',
    accept: async () => {
      try {
        await deleteResource(resource.value, row[resource.value.rowKey]);
        toast.add({ severity: 'success', summary: 'Deleted', life: 2500 });
        fetchData();
      } catch (err) {
        toast.add({ severity: 'error', summary: 'Delete failed', detail: err?.message || 'Request failed', life: 4000 });
      }
    },
  });
}

async function handleSubmit(values) {
  saving.value = true;
  formErrors.value = {};
  try {
    const body = serializeForm(resource.value.formFields, values);
    if (dialogMode.value === 'edit' && editing.value) {
      await updateResource(resource.value, editing.value[resource.value.rowKey], body);
      toast.add({ severity: 'success', summary: 'Changes saved', life: 2500 });
    } else {
      await createResource(resource.value, body);
      toast.add({ severity: 'success', summary: `${capitalize(resource.value.singular)} created`, life: 2500 });
    }
    dialogOpen.value = false;
    fetchData();
  } catch (err) {
    if (err?.details) {
      formErrors.value = err.details;
    }
    toast.add({ severity: 'error', summary: 'Save failed', detail: err?.message || 'Request failed', life: 4000 });
  } finally {
    saving.value = false;
  }
}

function attentionCount(list) {
  return list.filter((row) => {
    const values = [row.status, row.payment_status].map((value) => String(value || '').toLowerCase());
    return values.some((value) => ['unpaid', 'pending', 'requested'].includes(value));
  }).length;
}

function prettify(value) {
  return String(value).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function capitalize(value) {
  return String(value).replace(/^\w/, (c) => c.toUpperCase());
}

function formatDate(value) {
  if (!value) {
    return '-';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat('fr-MG', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function statusSeverity(value) {
  if (typeof value === 'boolean') {
    return value ? 'success' : 'secondary';
  }
  const status = String(value || '').toLowerCase();
  if (['paid', 'confirmed', 'delivered', 'picked_up', 'completed', 'active', 'available'].includes(status)) {
    return 'success';
  }
  if (['unpaid', 'pending', 'requested', 'shipped', 'driver_assigned', 'maintenance'].includes(status)) {
    return 'warn';
  }
  if (['cancelled', 'expired', 'refunded', 'inactive'].includes(status)) {
    return 'danger';
  }
  return 'info';
}

function displayValue(row, column) {
  const value = row[column.field];
  if (column.type === 'money') {
    return formatMGA(Number(value || 0));
  }
  if (column.type === 'date') {
    return formatDate(value);
  }
  if (column.type === 'boolean') {
    return value ? 'Active' : 'Inactive';
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
        <p>{{ resource.eyebrow }}</p>
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

    <section class="resource-table" :aria-label="`${resource.plural} table`">
      <div class="resource-table__toolbar">
        <div class="resource-table__filters">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="search" :placeholder="`Search ${resource.plural.toLowerCase()}`" />
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
        <Button icon="pi pi-refresh" label="Refresh" severity="secondary" outlined @click="fetchData" />
      </div>

      <DataTable
        :value="tableRows"
        :dataKey="resource.rowKey"
        :loading="loading"
        :lazy="serverPaginated"
        paginator
        v-model:first="first"
        v-model:rows="limit"
        :rowsPerPageOptions="[10, 20, 50]"
        :totalRecords="serverPaginated ? total : tableRows.length"
        stripedRows
        responsiveLayout="scroll"
        tableStyle="min-width: 860px"
        @page="onPage"
      >
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

        <Column v-if="hasRowActions" header="Actions" :exportable="false" style="width: 8rem">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                v-if="hasManage"
                icon="pi pi-window-maximize"
                severity="secondary"
                text
                rounded
                aria-label="Manage"
                title="Manage / detail"
                @click="openManage(data)"
              />
              <Button
                v-if="canEdit"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                aria-label="Edit"
                title="Edit"
                @click="openEdit(data)"
              />
              <Button
                v-if="canRemove"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                aria-label="Delete"
                title="Delete"
                @click="confirmRemove(data)"
              />
            </div>
          </template>
        </Column>

        <template #empty>
          <div class="resource-empty">
            <i class="pi pi-inbox" />
            <span>{{ loading ? 'Loading…' : 'No records found.' }}</span>
          </div>
        </template>
      </DataTable>
    </section>

    <AdminResourceDialog
      v-model:visible="dialogOpen"
      :title="dialogMode === 'edit' ? `Edit ${resource.singular}` : resource.actionLabel || 'Create'"
      :fields="resource.formFields"
      :initial="editing"
      :defaults="resource.defaultRow"
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
}
</style>
