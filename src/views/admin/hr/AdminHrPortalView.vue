<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { getHrResource, listHrResource } from '@/api/hr';
import HrClockCard from '@/components/admin/hr/HrClockCard.vue';
import { hrResources } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const { enumLabel, localeCode, t } = useAdminI18n();

const employeeId = computed(() => Number(auth.employee?.id) || null);
const employee = ref(null);
const balances = ref([]);
const requests = ref([]);
const attendance = ref([]);
// Contracts addressed to this employee. The backend scopes these to the actor
// and hides anything still in draft, so whatever arrives here is theirs to read.
const contractDocuments = ref([]);
const loading = ref(true);

const displayName = computed(() => employee.value?.full_name
  || employee.value?.first_name
  || auth.displayName);
const roleLine = computed(() => {
  const parts = [employee.value?.position_title, employee.value?.department_name].filter(Boolean);
  return parts.join(' · ');
});

// Only the most recent balance year, one card per leave policy.
const currentBalances = computed(() => {
  if (!balances.value.length) return [];
  const latestYear = Math.max(...balances.value.map((row) => Number(row.balance_year) || 0));
  return balances.value.filter((row) => Number(row.balance_year) === latestYear);
});

const details = computed(() => {
  const row = employee.value || {};
  return [
    { label: 'Employee number', value: row.employee_number },
    { label: 'Work email', value: row.work_email },
    { label: 'Phone', value: row.phone },
    { label: 'Manager', value: row.manager_name },
    { label: 'Work location', value: row.work_location },
    { label: 'Employment type', value: row.employment_type ? enumLabel(row.employment_type) : '' },
    { label: 'Hire date', value: formatDate(row.hire_date) },
  ].filter((item) => item.value);
});

function formatDate(value) {
  if (!value) return '';
  const parsed = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat(localeCode.value, { dateStyle: 'medium' }).format(parsed);
}

function formatTime(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat(localeCode.value, { hour: '2-digit', minute: '2-digit' }).format(parsed);
}

function formatDuration(value) {
  const minutes = Number(value || 0);
  if (minutes <= 0) return '0m';
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

function dateRange(row) {
  const start = formatDate(row.start_date);
  const end = formatDate(row.end_date);
  return !row.end_date || row.end_date === row.start_date ? start : `${start} → ${end}`;
}

function statusSeverity(value) {
  const status = String(value || '').toLowerCase();
  if (['active', 'approved', 'completed', 'present', 'remote'].includes(status)) return 'success';
  if (['pending', 'submitted', 'onboarding', 'draft'].includes(status)) return 'warn';
  if (['rejected', 'cancelled', 'absent', 'expired'].includes(status)) return 'danger';
  return 'info';
}

async function load() {
  if (!employeeId.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  const params = { employee_id: employeeId.value };
  const [emp, bal, req, att, docs] = await Promise.allSettled([
    getHrResource(hrResources.employees, employeeId.value),
    listHrResource(hrResources['leave-balances'], { params, limit: 50 }),
    listHrResource(hrResources['leave-requests'], { params, limit: 5 }),
    listHrResource(hrResources.attendance, { params, limit: 6 }),
    listHrResource(hrResources['contract-documents'], { params, limit: 10 }),
  ]);
  if (emp.status === 'fulfilled') employee.value = emp.value;
  if (bal.status === 'fulfilled') balances.value = bal.value.items || [];
  if (req.status === 'fulfilled') requests.value = req.value.items || [];
  if (att.status === 'fulfilled') attendance.value = att.value.items || [];
  if (docs.status === 'fulfilled') contractDocuments.value = docs.value.items || [];
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <section class="hr-portal">
    <header class="hr-portal__hero">
      <div class="hr-portal__who">
        <span class="hr-portal__avatar">{{ String(displayName).trim().charAt(0).toUpperCase() }}</span>
        <div>
          <p>{{ t('My HR') }}</p>
          <h2>{{ t('Hi, {name}', { name: displayName }) }}</h2>
          <span v-if="roleLine">{{ roleLine }}</span>
        </div>
      </div>
      <div class="hr-portal__hero-actions">
        <Tag v-if="employee?.employment_status" :value="enumLabel(employee.employment_status)" :severity="statusSeverity(employee.employment_status)" />
        <Button :label="t('My full profile')" icon="pi pi-id-card" severity="secondary" outlined size="small" @click="router.push({ name: 'admin-hr-self' })" />
      </div>
    </header>

    <HrClockCard @changed="load" />

    <div class="hr-portal__grid">
      <!-- Contracts addressed to this employee -->
      <article class="hr-portal__panel">
        <header><i class="pi pi-file" /><h3>{{ t('My contract documents') }}</h3></header>
        <div v-if="loading" class="hr-portal__muted">{{ t('Loading…') }}</div>
        <template v-else>
          <ul v-if="contractDocuments.length" class="hr-portal__list">
            <li v-for="row in contractDocuments" :key="row.id">
              <div>
                <strong>{{ row.template_name }}</strong>
                <span>{{ row.reference }}<template v-if="row.issue_date"> · {{ formatDate(row.issue_date) }}</template></span>
              </div>
              <div class="hr-portal__doc-actions">
                <Tag :value="enumLabel(row.status)" :severity="statusSeverity(row.status)" />
                <Button
                  icon="pi pi-eye"
                  text
                  rounded
                  :aria-label="t('Open')"
                  @click="router.push(`/admin/hr/contract-documents/${row.id}`)"
                />
              </div>
            </li>
          </ul>
          <p v-else class="hr-portal__muted">{{ t('No contract documents yet.') }}</p>
        </template>
      </article>

      <!-- Leave -->
      <article class="hr-portal__panel">
        <header><i class="pi pi-calendar-plus" /><h3>{{ t('My leave') }}</h3></header>
        <div v-if="loading" class="hr-portal__muted">{{ t('Loading…') }}</div>
        <template v-else>
          <div v-if="currentBalances.length" class="hr-portal__balances">
            <div v-for="row in currentBalances" :key="row.id" class="hr-portal__balance">
              <span class="hr-portal__balance-name">{{ row.policy_name }}</span>
              <strong>{{ row.remaining_days }} <small>{{ t('days left') }}</small></strong>
              <span class="hr-portal__balance-sub">{{ t('{used} used · {pending} pending · {total} total', { used: row.used_days, pending: row.pending_days, total: row.allocated_days }) }}</span>
            </div>
          </div>
          <p v-else class="hr-portal__muted">{{ t('No leave balance on record yet.') }}</p>

          <div class="hr-portal__subhead">{{ t('Recent requests') }}</div>
          <ul v-if="requests.length" class="hr-portal__list">
            <li v-for="row in requests" :key="row.id">
              <div>
                <strong>{{ row.policy_name || t('Leave') }}</strong>
                <span>{{ dateRange(row) }} · {{ row.requested_days }} {{ t('days') }}</span>
              </div>
              <Tag :value="enumLabel(row.status)" :severity="statusSeverity(row.status)" />
            </li>
          </ul>
          <p v-else class="hr-portal__muted">{{ t('No leave requests yet.') }}</p>
        </template>
      </article>

      <!-- Details -->
      <article class="hr-portal__panel">
        <header><i class="pi pi-user" /><h3>{{ t('My details') }}</h3></header>
        <div v-if="loading" class="hr-portal__muted">{{ t('Loading…') }}</div>
        <dl v-else-if="details.length" class="hr-portal__details">
          <div v-for="item in details" :key="item.label">
            <dt>{{ t(item.label) }}</dt>
            <dd>{{ item.value }}</dd>
          </div>
        </dl>
        <p v-else class="hr-portal__muted">{{ t('No details on record.') }}</p>
      </article>

      <!-- Recent attendance -->
      <article class="hr-portal__panel is-wide">
        <header><i class="pi pi-clock" /><h3>{{ t('Recent attendance') }}</h3></header>
        <div v-if="loading" class="hr-portal__muted">{{ t('Loading…') }}</div>
        <div v-else-if="attendance.length" class="hr-portal__table-wrap">
          <table class="hr-portal__table">
            <thead>
              <tr>
                <th>{{ t('Date') }}</th>
                <th>{{ t('Clock in') }}</th>
                <th>{{ t('Clock out') }}</th>
                <th>{{ t('Worked') }}</th>
                <th>{{ t('Late') }}</th>
                <th>{{ t('Overtime') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in attendance" :key="row.id">
                <td>{{ formatDate(row.attendance_date) }}</td>
                <td>{{ formatTime(row.clock_in) }}</td>
                <td>{{ formatTime(row.clock_out) }}</td>
                <td>{{ formatDuration(row.worked_minutes) }}</td>
                <td :class="{ 'is-flag': Number(row.late_minutes) > 0 }">{{ formatDuration(row.late_minutes) }}</td>
                <td :class="{ 'is-ot': Number(row.overtime_minutes) > 0 }">{{ formatDuration(row.overtime_minutes) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="hr-portal__muted">{{ t('No attendance recorded yet.') }}</p>
      </article>
    </div>
  </section>
</template>

<style scoped>
.hr-portal { display: grid; gap: 16px; min-width: 0; }
.hr-portal__hero { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 14px; padding: 19px 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: radial-gradient(circle at 100% 0%, rgba(201,146,44,.1), transparent 47%), var(--tm-surface); box-shadow: 0 10px 28px rgba(37,31,20,.045); }
.hr-portal__who { display: flex; align-items: center; gap: 14px; min-width: 0; }
.hr-portal__avatar { display: grid; width: 48px; height: 48px; flex: 0 0 auto; border-radius: 14px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; font-size: 1.2rem; font-weight: 900; }
.hr-portal__who p { margin: 0 0 3px; color: var(--tm-gold); font-size: .67rem; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; }
.hr-portal__who h2 { margin: 0; color: var(--tm-heading); font-size: 1.4rem; letter-spacing: -.03em; }
.hr-portal__who > div > span { display: block; margin-top: 4px; color: var(--tm-muted); font-size: .86rem; }
.hr-portal__hero-actions { display: flex; align-items: center; gap: 10px; }

.hr-portal__grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
.hr-portal__panel { display: grid; align-content: start; gap: 12px; padding: 16px 18px; border: 1px solid var(--tm-border); border-radius: 16px; background: var(--tm-surface); box-shadow: 0 8px 22px rgba(37,31,20,.04); min-width: 0; }
.hr-portal__panel.is-wide { grid-column: 1 / -1; }
.hr-portal__panel > header { display: flex; align-items: center; gap: 9px; }
.hr-portal__panel > header i { color: var(--tm-gold); }
.hr-portal__panel > header h3 { margin: 0; color: var(--tm-heading); font-size: 1.02rem; letter-spacing: -.02em; }
.hr-portal__muted { margin: 0; color: var(--tm-muted); font-size: .84rem; }

.hr-portal__balances { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px,1fr)); gap: 10px; }
.hr-portal__balance { display: grid; gap: 3px; padding: 12px; border: 1px solid var(--tm-border); border-radius: 12px; background: var(--tm-surface-soft); }
.hr-portal__balance-name { color: var(--tm-muted); font-size: .72rem; font-weight: 850; }
.hr-portal__balance strong { color: var(--tm-emerald); font-size: 1.4rem; }
.hr-portal__balance strong small { color: var(--tm-muted); font-size: .68rem; font-weight: 700; }
.hr-portal__balance-sub { color: var(--tm-muted); font-size: .7rem; }

.hr-portal__subhead { margin-top: 4px; color: var(--tm-heading); font-size: .74rem; font-weight: 850; text-transform: uppercase; letter-spacing: .05em; }
.hr-portal__list { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.hr-portal__list li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 11px; border: 1px solid var(--tm-border); border-radius: 11px; background: var(--tm-surface-soft); }
.hr-portal__list strong { display: block; color: var(--tm-heading); font-size: .86rem; }
.hr-portal__list li span { color: var(--tm-muted); font-size: .76rem; }
.hr-portal__doc-actions { display: flex; align-items: center; gap: 4px; flex: 0 0 auto; }

.hr-portal__details { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; overflow: hidden; margin: 0; border: 1px solid var(--tm-border); border-radius: 12px; background: var(--tm-border); }
.hr-portal__details > div { display: grid; gap: 3px; padding: 10px 12px; background: var(--tm-surface); }
.hr-portal__details dt { color: var(--tm-muted); font-size: .68rem; font-weight: 800; }
.hr-portal__details dd { margin: 0; color: var(--tm-heading); font-size: .84rem; overflow-wrap: anywhere; }

.hr-portal__table-wrap { overflow-x: auto; }
.hr-portal__table { width: 100%; border-collapse: collapse; font-size: .82rem; }
.hr-portal__table th { padding: 8px 10px; border-bottom: 1px solid var(--tm-border); color: var(--tm-muted); font-size: .68rem; font-weight: 900; letter-spacing: .04em; text-transform: uppercase; text-align: left; }
.hr-portal__table td { padding: 9px 10px; border-bottom: 1px solid var(--tm-border); color: var(--tm-text); white-space: nowrap; }
.hr-portal__table td.is-flag { color: var(--tm-coral); font-weight: 800; }
.hr-portal__table td.is-ot { color: var(--tm-blue); font-weight: 800; }

@media (max-width: 760px) {
  .hr-portal__grid { grid-template-columns: 1fr; }
  .hr-portal__details { grid-template-columns: 1fr; }
}
</style>
