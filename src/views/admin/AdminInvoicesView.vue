<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { formatDate, formatMGA } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { t } = useAdminI18n();

const loading = ref(false);
const rows = ref([]);
const total = ref(0);

const filters = reactive({ kind: '', status: '', invoiceable_type: '' });

const typeOptions = [
  { label: t('Order'), value: 'order' },
  { label: t('Booking'), value: 'booking' },
  { label: t('Event'), value: 'event' },
  { label: t('Healthcare'), value: 'healthcare' },
];
const kindOptions = [
  { label: t('Proforma'), value: 'proforma' },
  { label: t('Final'), value: 'final' },
  { label: t('Credit note'), value: 'credit_note' },
];
const statusOptions = [
  { label: t('Draft'), value: 'draft' },
  { label: t('Issued'), value: 'issued' },
  { label: t('Void'), value: 'void' },
  { label: t('Credited'), value: 'credited' },
];

function kindLabel(k) { return kindOptions.find((o) => o.value === k)?.label || k; }
function typeLabel(k) { return typeOptions.find((o) => o.value === k)?.label || k; }
function kindSeverity(k) { return k === 'final' ? 'success' : k === 'credit_note' ? 'danger' : 'warn'; }
function statusSeverity(s) {
  return { draft: 'secondary', issued: 'info', void: 'danger', credited: 'warn' }[s] || 'secondary';
}
function money(v) { return formatMGA(Number.parseFloat(v || '0')); }

async function load() {
  loading.value = true;
  try {
    const data = await api.get('/admin/invoices', {
      params: { kind: filters.kind, status: filters.status, invoiceable_type: filters.invoiceable_type, limit: 100 },
    });
    rows.value = data?.invoices || [];
    total.value = data?.meta?.total || rows.value.length;
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not load'), detail: err?.message || t('Request failed'), life: 4000 });
  } finally {
    loading.value = false;
  }
}

function open(row) {
  router.push({ name: 'admin-invoice-detail', params: { id: row.id } });
}

// --- create dialog ---
const dialog = reactive({ visible: false, saving: false });
const draft = reactive({ invoiceable_type: 'order', invoiceable_id: null, kind: 'proforma', due_date: null, issue: false });

function openCreate(prefill = {}) {
  draft.invoiceable_type = prefill.type || 'order';
  draft.invoiceable_id = prefill.id ? Number(prefill.id) : null;
  draft.kind = 'proforma';
  draft.due_date = null;
  draft.issue = false;
  dialog.visible = true;
}

function toDateStr(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${m}-${day}`;
}

async function submitCreate() {
  if (!draft.invoiceable_id || draft.invoiceable_id <= 0) {
    toast.add({ severity: 'warn', summary: t('Enter a transaction ID'), life: 3000 });
    return;
  }
  dialog.saving = true;
  try {
    const data = await api.post('/admin/invoices', {
      invoiceable_type: draft.invoiceable_type,
      invoiceable_id: Number(draft.invoiceable_id),
      kind: draft.kind,
      due_date: toDateStr(draft.due_date),
      issue: draft.issue,
    });
    dialog.visible = false;
    const inv = data?.invoice;
    if (inv?.id) {
      router.push({ name: 'admin-invoice-detail', params: { id: inv.id } });
    } else {
      load();
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not create invoice'), detail: err?.message || t('Request failed'), life: 5000 });
  } finally {
    dialog.saving = false;
  }
}

const hasRows = computed(() => rows.value.length > 0);

onMounted(() => {
  load();
  // Deep-link: /admin/invoices?type=booking&id=12&create=1 opens the dialog prefilled.
  if (route.query.create) {
    openCreate({ type: route.query.type, id: route.query.id });
  }
});
</script>

<template>
  <section class="invoices">
    <header class="inv-hero">
      <div>
        <p>{{ t('Billing') }}</p>
        <h2>{{ t('Invoices') }}</h2>
        <span>{{ t('Proforma bills, final invoices, and credit notes across every service.') }}</span>
      </div>
      <div class="inv-hero__actions">
        <Button as="router-link" to="/admin/org-settings" :label="t('Billing settings')" icon="pi pi-cog" severity="secondary" outlined />
        <Button :label="t('New invoice')" icon="pi pi-plus" @click="openCreate()" />
      </div>
    </header>

    <div class="inv-filters">
      <Select v-model="filters.invoiceable_type" :options="typeOptions" option-label="label" option-value="value"
        show-clear :placeholder="t('All services')" @change="load" />
      <Select v-model="filters.kind" :options="kindOptions" option-label="label" option-value="value"
        show-clear :placeholder="t('All kinds')" @change="load" />
      <Select v-model="filters.status" :options="statusOptions" option-label="label" option-value="value"
        show-clear :placeholder="t('All statuses')" @change="load" />
      <span class="inv-count">{{ total }} {{ t('invoices') }}</span>
    </div>

    <DataTable :value="rows" :loading="loading" data-key="id" removable-sort class="inv-table"
      selection-mode="single" @row-click="(e) => open(e.data)">
      <template #empty>
        <p v-if="!loading" class="inv-empty">{{ t('No invoices yet. Create one from a transaction.') }}</p>
      </template>
      <Column :header="t('Number')">
        <template #body="{ data }">
          <strong>{{ data.invoice_number || t('Draft') }}</strong>
        </template>
      </Column>
      <Column :header="t('Kind')">
        <template #body="{ data }"><Tag :value="kindLabel(data.kind)" :severity="kindSeverity(data.kind)" /></template>
      </Column>
      <Column :header="t('Service')">
        <template #body="{ data }">
          <span>{{ typeLabel(data.invoiceable_type) }}</span>
          <small v-if="data.source_number" class="muted"> · {{ data.source_number }}</small>
        </template>
      </Column>
      <Column field="buyer_name" :header="t('Customer')">
        <template #body="{ data }">{{ data.buyer_name || '—' }}</template>
      </Column>
      <Column :header="t('Total')">
        <template #body="{ data }"><strong>{{ money(data.total) }}</strong></template>
      </Column>
      <Column :header="t('Status')">
        <template #body="{ data }"><Tag :value="t(data.status)" :severity="statusSeverity(data.status)" /></template>
      </Column>
      <Column :header="t('Issued')">
        <template #body="{ data }">{{ data.issue_date ? formatDate(data.issue_date) : '—' }}</template>
      </Column>
      <Column :header="''">
        <template #body="{ data }">
          <Button icon="pi pi-arrow-right" text rounded :aria-label="t('Open')" @click.stop="open(data)" />
        </template>
      </Column>
    </DataTable>

    <Dialog v-model:visible="dialog.visible" modal :header="t('New invoice')" :style="{ width: '460px', maxWidth: '94vw' }">
      <div class="create-form">
        <label>
          <span>{{ t('Service') }}</span>
          <Select v-model="draft.invoiceable_type" :options="typeOptions" option-label="label" option-value="value" />
        </label>
        <label>
          <span>{{ t('Transaction ID') }}</span>
          <InputNumber v-model="draft.invoiceable_id" :use-grouping="false" :min="1" show-buttons />
          <small>{{ t('The order / booking / request number’s numeric ID.') }}</small>
        </label>
        <label>
          <span>{{ t('Kind') }}</span>
          <Select v-model="draft.kind" :options="kindOptions.slice(0, 2)" option-label="label" option-value="value" />
          <small>{{ t('Credit notes are created from an issued final invoice.') }}</small>
        </label>
        <label>
          <span>{{ t('Due date (optional)') }}</span>
          <DatePicker v-model="draft.due_date" date-format="dd/mm/yy" show-icon />
        </label>
        <label class="check">
          <Checkbox v-model="draft.issue" :binary="true" input-id="issue-now" />
          <span>{{ t('Issue immediately (assign a number)') }}</span>
        </label>
      </div>
      <template #footer>
        <Button :label="t('Cancel')" severity="secondary" text @click="dialog.visible = false" />
        <Button :label="t('Create')" icon="pi pi-check" :loading="dialog.saving" @click="submitCreate" />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.invoices { display: grid; gap: 18px; }
.inv-hero { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: end; gap: 24px; padding: clamp(22px,3.5vw,32px); border: 1px solid var(--tm-border); border-radius: 22px; background: radial-gradient(circle at 90% -20%, rgba(201,146,44,.28), transparent 42%), linear-gradient(135deg, var(--tm-charcoal), #22301f); box-shadow: var(--tm-shadow); }
.inv-hero p { margin: 0; color: var(--tm-gold); font-size: .72rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
.inv-hero h2 { margin: 8px 0 8px; color: #fff8ed; font-size: clamp(1.7rem,3vw,2.6rem); letter-spacing: -.04em; line-height: 1; }
.inv-hero > div:first-child > span { display: block; max-width: 620px; color: rgba(255,255,255,.66); line-height: 1.5; }
.inv-hero__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 9px; }
.inv-hero__actions :deep(.p-button.p-button-outlined) { border-color: rgba(255,255,255,.2); color: #fff; }
.inv-filters { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.inv-count { margin-left: auto; color: var(--tm-muted); font-size: .82rem; font-weight: 800; }
.inv-table :deep(.p-datatable-tbody > tr) { cursor: pointer; }
.inv-table .muted, .muted { color: var(--tm-muted); }
.inv-empty { padding: 18px; color: var(--tm-muted); text-align: center; }
.create-form { display: grid; gap: 14px; padding-top: 6px; }
.create-form label { display: grid; gap: 6px; }
.create-form label > span { color: var(--tm-heading); font-size: .82rem; font-weight: 850; }
.create-form label small { color: var(--tm-muted); font-size: .74rem; line-height: 1.4; }
.create-form :deep(.p-select), .create-form :deep(.p-inputnumber), .create-form :deep(.p-datepicker) { width: 100%; }
.create-form .check { grid-template-columns: auto 1fr; align-items: center; gap: 10px; }
@media (max-width: 720px) { .inv-hero { grid-template-columns: 1fr; } .inv-hero__actions { justify-content: flex-start; } }
</style>
