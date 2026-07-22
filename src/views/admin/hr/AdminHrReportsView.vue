<script setup>
import { computed, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

import { exportHrReport, loadHrReport, toDateOnly } from '@/api/hr';
import HrWorkspaceNav from '@/components/admin/hr/HrWorkspaceNav.vue';
import { hrReports } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const { enumLabel, localeCode, t } = useAdminI18n();
const toast = useToast();
const auth = useAuthStore();
const reportFeatures = {
  workforce: 'employees', leave: 'leave', attendance: 'attendance', performance: 'performance',
  recruitment: 'recruitment', expenses: 'expenses', compensation: 'compensation',
};
const visibleReports = computed(() => hrReports.filter((item) => auth.canHr('reports', 'view') && auth.canHr(reportFeatures[item.id], 'view')));
const canExport = computed(() => auth.canHr('reports', 'export'));
const selected = ref(visibleReports.value[0]?.id || '');
watch(visibleReports, (available) => {
  if (!available.some((item) => item.id === selected.value)) selected.value = available[0]?.id || '';
});
const startDate = ref(new Date(new Date().getFullYear(), 0, 1));
const endDate = ref(new Date());
const loading = ref(false);
const exporting = ref(false);
const error = ref('');
const report = ref(null);

const activeReport = computed(() => visibleReports.value.find((item) => item.id === selected.value));
const rows = computed(() => report.value?.rows || report.value?.items || report.value?.data || []);
const columns = computed(() => {
  if (report.value?.columns?.length) return report.value.columns.map((column) => typeof column === 'string' ? { field: column, label: column } : column);
  const first = rows.value[0];
  return first ? Object.keys(first).filter((key) => !['id'].includes(key)).slice(0, 10).map((field) => ({ field, label: field.replaceAll('_', ' ') })) : [];
});
const summary = computed(() => report.value?.summary || report.value?.metrics || {});

function params() {
  return { start: toDateOnly(startDate.value), end: toDateOnly(endDate.value) };
}

function format(value, row) {
  if (value === null || value === undefined || value === '') return '—';
  if (/(_at|_date)$/.test(row.field || '') || row.type === 'date') {
    const parsed = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
    if (!Number.isNaN(parsed.getTime())) return new Intl.DateTimeFormat(localeCode.value, { dateStyle: 'medium' }).format(parsed);
  }
  if (row.type === 'money' || /(salary|amount|cost|expense|compensation)/.test(row.field || '')) {
    const numeric = Number(value);
    if (!Number.isNaN(numeric)) return new Intl.NumberFormat(localeCode.value, { style: 'currency', currency: 'MGA', maximumFractionDigits: 2 }).format(numeric);
  }
  if (typeof value === 'boolean') return value ? t('Yes') : t('No');
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

async function run() {
  if (!activeReport.value) return;
  loading.value = true;
  error.value = '';
  try {
    const data = await loadHrReport(selected.value, params());
    report.value = data || {};
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function exportCsv() {
  if (!activeReport.value) return;
  exporting.value = true;
  try {
    await exportHrReport(selected.value, params());
    toast.add({ severity: 'success', summary: t('Export ready'), detail: t('Your CSV download has started.'), life: 2800 });
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Export failed'), detail: err.message, life: 5000 });
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <section class="hr-reports">
    <HrWorkspaceNav />
    <header class="hr-reports__hero">
      <div><p>{{ t('Decisions and compliance') }}</p><h2>{{ t('HR reports and exports') }}</h2><span>{{ t('Turn current HR records into clear operational reports and downloadable CSV files.') }}</span></div>
      <div><RouterLink to="/admin/hr/notifications"><Button :label="t('Notifications')" icon="pi pi-bell" severity="secondary" outlined /></RouterLink><RouterLink v-if="auth.isSuperAdmin" to="/admin/hr/audit-history"><Button :label="t('Audit history')" icon="pi pi-history" severity="secondary" outlined /></RouterLink></div>
    </header>

    <section class="hr-reports__catalog">
      <button v-for="item in visibleReports" :key="item.id" type="button" :class="{ 'is-active': selected === item.id }" @click="selected = item.id; report = null">
        <i class="pi pi-chart-bar" /><div><strong>{{ t(item.label) }}</strong><span>{{ t(item.description) }}</span></div><i class="pi pi-angle-right" />
      </button>
    </section>

    <section v-if="activeReport" class="hr-reports__workspace">
      <header>
        <div><p>{{ t('Report builder') }}</p><h3>{{ t(activeReport.label) }}</h3><span>{{ t(activeReport.description) }}</span></div>
        <div class="hr-reports__filters">
          <label><span>{{ t('From') }}</span><DatePicker v-model="startDate" show-icon date-format="yy-mm-dd" /></label>
          <label><span>{{ t('To') }}</span><DatePicker v-model="endDate" show-icon date-format="yy-mm-dd" /></label>
          <Button :label="t('Run report')" icon="pi pi-play" :loading="loading" :disabled="!activeReport" @click="run" />
          <Button v-if="canExport" :label="t('Export CSV')" icon="pi pi-download" severity="secondary" outlined :loading="exporting" :disabled="!activeReport" @click="exportCsv" />
        </div>
      </header>

      <div v-if="Object.keys(summary).length" class="hr-reports__summary">
        <article v-for="(value, key) in summary" :key="key"><span>{{ enumLabel(key) }}</span><strong>{{ format(value, { field: key }) }}</strong></article>
      </div>
      <div v-if="error" class="hr-reports__state is-error"><i class="pi pi-exclamation-circle" /><strong>{{ t('Could not run report') }}</strong><span>{{ error }}</span></div>
      <div v-else-if="loading" class="hr-reports__loading"><Skeleton v-for="index in 6" :key="index" height="44px" /></div>
      <DataTable v-else-if="rows.length" :value="rows" striped-rows paginator :rows="20" :rows-per-page-options="[20,50,100]" responsive-layout="scroll">
        <Column v-for="column in columns" :key="column.field" :header="t(column.label || column.field)"><template #body="{ data }">{{ format(data[column.field], column) }}</template></Column>
      </DataTable>
      <div v-else class="hr-reports__state"><i class="pi pi-chart-bar" /><strong>{{ t('Choose a period and run the report.') }}</strong><span>{{ t('The results will appear here and can be exported as CSV.') }}</span></div>
    </section>
    <section v-else class="hr-reports__no-access">
      <i class="pi pi-lock" /><h3>{{ t('No HR reports assigned') }}</h3><p>{{ t('Your role can open the reports workspace but has no report-domain permission.') }}</p>
    </section>
  </section>
</template>

<style scoped>
.hr-reports { display: grid; gap: 16px; }.hr-reports__hero { display: flex; align-items: end; justify-content: space-between; gap: 20px; padding: 21px; border: 1px solid var(--tm-border); border-radius: 19px; background: radial-gradient(circle at 100% 0%,rgba(49,92,112,.14),transparent 46%),var(--tm-surface); }.hr-reports__hero p,.hr-reports__workspace header p { margin: 0 0 4px; color: var(--tm-gold); font-size: .68rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }.hr-reports__hero h2 { margin: 0; color: var(--tm-heading); font-size: 1.55rem; letter-spacing: -.04em; }.hr-reports__hero span { display: block; margin-top: 6px; color: var(--tm-muted); font-size: .85rem; }.hr-reports__hero > div:last-child { display: flex; gap: 7px; }.hr-reports__hero a { text-decoration: none; }
.hr-reports__catalog { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; }.hr-reports__catalog button { display: flex; align-items: center; gap: 10px; padding: 13px; border: 1px solid var(--tm-border); border-radius: 13px; background: var(--tm-surface); color: inherit; cursor: pointer; text-align: left; }.hr-reports__catalog button > i:first-child { display: grid; width: 34px; height: 34px; flex: 0 0 auto; border-radius: 10px; background: var(--tm-surface-soft); color: var(--tm-gold); place-items: center; }.hr-reports__catalog button > i:last-child { margin-left: auto; color: var(--tm-muted); }.hr-reports__catalog button div { display: grid; gap: 3px; }.hr-reports__catalog strong { color: var(--tm-heading); font-size: .78rem; }.hr-reports__catalog span { color: var(--tm-muted); font-size: .67rem; line-height: 1.35; }.hr-reports__catalog button.is-active { border-color: var(--tm-charcoal); background: var(--tm-charcoal); }.hr-reports__catalog button.is-active strong { color: #fff8ed; }.hr-reports__catalog button.is-active span { color: rgba(255,255,255,.58); }
.hr-reports__workspace { overflow: hidden; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 10px 28px rgba(37,31,20,.05); }.hr-reports__workspace > header { display: flex; align-items: end; justify-content: space-between; gap: 18px; padding: 16px; border-bottom: 1px solid var(--tm-border); }.hr-reports__workspace h3 { margin: 0; color: var(--tm-heading); font-size: 1.2rem; }.hr-reports__workspace header > div > span { display: block; margin-top: 5px; color: var(--tm-muted); font-size: .78rem; }.hr-reports__filters { display: flex; align-items: end; gap: 7px; }.hr-reports__filters label { display: grid; gap: 4px; color: var(--tm-muted); font-size: .67rem; font-weight: 800; }.hr-reports__filters :deep(.p-datepicker-input) { width: 135px; }
.hr-reports__no-access { display: grid; min-height: 260px; align-content: center; justify-items: center; padding: 24px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); text-align: center; }.hr-reports__no-access i { color: var(--tm-gold); font-size: 1.7rem; }.hr-reports__no-access h3 { margin: 10px 0 2px; color: var(--tm-heading); }.hr-reports__no-access p { color: var(--tm-muted); }
.hr-reports__summary { display: grid; grid-template-columns: repeat(auto-fit,minmax(140px,1fr)); gap: 8px; padding: 12px; border-bottom: 1px solid var(--tm-border); }.hr-reports__summary article { display: grid; gap: 4px; padding: 11px; border-radius: 10px; background: var(--tm-surface-soft); }.hr-reports__summary span { color: var(--tm-muted); font-size: .69rem; font-weight: 800; }.hr-reports__summary strong { color: var(--tm-heading); font-size: 1.15rem; }
.hr-reports__workspace :deep(.p-datatable-thead th) { background: var(--tm-surface-soft); color: var(--tm-muted); font-size: .72rem; font-weight: 900; text-transform: uppercase; }.hr-reports__state { display: grid; min-height: 250px; align-content: center; justify-items: center; gap: 8px; padding: 25px; color: var(--tm-muted); text-align: center; }.hr-reports__state i { color: var(--tm-gold); font-size: 1.6rem; }.hr-reports__state strong { color: var(--tm-heading); }.hr-reports__state span { font-size: .8rem; }.hr-reports__state.is-error i { color: var(--tm-coral); }.hr-reports__loading { display: grid; gap: 6px; padding: 14px; }
@media (max-width: 1080px) { .hr-reports__catalog { grid-template-columns: repeat(2,minmax(0,1fr)); }.hr-reports__workspace > header { align-items: stretch; flex-direction: column; }.hr-reports__filters { flex-wrap: wrap; } }
@media (max-width: 650px) { .hr-reports__hero { align-items: stretch; flex-direction: column; }.hr-reports__hero > div:last-child,.hr-reports__filters { flex-direction: column; align-items: stretch; }.hr-reports__hero :deep(.p-button),.hr-reports__filters :deep(.p-button),.hr-reports__filters :deep(.p-datepicker),.hr-reports__filters :deep(.p-datepicker-input) { width: 100%; }.hr-reports__catalog { grid-template-columns: 1fr; } }
</style>
