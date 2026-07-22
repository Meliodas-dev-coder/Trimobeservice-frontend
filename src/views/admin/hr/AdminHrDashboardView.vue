<script setup>
import { computed, onMounted, ref } from 'vue';

import { loadHrDashboard } from '@/api/hr';
import HrWorkspaceNav from '@/components/admin/hr/HrWorkspaceNav.vue';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const { enumLabel, t } = useAdminI18n();
const auth = useAuthStore();
const loading = ref(true);
const error = ref('');
const dashboard = ref({});

function pick(...paths) {
  for (const path of paths) {
    const value = String(path).split('.').reduce((current, key) => current?.[key], dashboard.value);
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

const metrics = computed(() => [
  { label: 'Total employees', value: pick('employees_total'), icon: 'pi pi-users', tone: 'gold' },
  { label: 'Active employees', value: pick('employees_active'), icon: 'pi pi-user-check', tone: 'emerald' },
  { label: 'Onboarding and probation', value: pick('employees_onboarding'), icon: 'pi pi-user-plus', tone: 'blue' },
  { label: 'Offboarded employees', value: pick('employees_offboarded'), icon: 'pi pi-user-minus', tone: 'coral' },
  { label: 'Departments', value: Array.isArray(dashboard.value.headcount_by_department) ? dashboard.value.headcount_by_department.length : undefined, icon: 'pi pi-sitemap', tone: 'violet' },
].filter((metric) => metric.value !== undefined && metric.value !== null));
const headcountByDepartment = computed(() => dashboard.value.headcount_by_department || []);
const headcountByStatus = computed(() => dashboard.value.headcount_by_status || []);
const hasDepartmentBreakdown = computed(() => Array.isArray(dashboard.value.headcount_by_department));
const hasStatusBreakdown = computed(() => Array.isArray(dashboard.value.headcount_by_status));
const canViewWorkforceReport = computed(() => auth.canHr('reports', 'view') && auth.canHr('employees', 'view'));
const canViewDirectory = computed(() => auth.canHr('employees', 'view') && auth.hrScope('employees', 'view') !== 'self');

const modules = [
  { title: 'My employee record', text: 'My contracts, documents, emergency contacts, and access.', icon: 'pi pi-id-card', to: '/admin/hr/me', visible: () => auth.hasEmployee },
  { title: 'Employee records', text: 'Directory, employee profiles, and emergency contacts.', icon: 'pi pi-users', to: '/admin/hr/employees', visible: () => canViewDirectory.value },
  { title: 'Organization and records', text: 'Departments, positions, contracts, and employee documents.', icon: 'pi pi-sitemap', to: '/admin/hr/organization', visible: () => auth.canHrArea('organization') },
  { title: 'Leave management', text: 'Requests, balances, approvals, and team availability.', icon: 'pi pi-calendar-plus', to: '/admin/hr/leave', visible: () => auth.canHrArea('leave') },
  { title: 'Time and attendance', text: 'Attendance, shifts, timesheets, overtime, and lateness.', icon: 'pi pi-clock', to: '/admin/hr/time', visible: () => auth.canHrArea('time') },
  { title: 'Performance and growth', text: 'Reviews, goals, feedback, and one-to-ones.', icon: 'pi pi-chart-line', to: '/admin/hr/performance', visible: () => auth.canHrArea('performance') },
  { title: 'Pay and benefits', text: 'Expenses, compensation, reimbursements, and benefits.', icon: 'pi pi-wallet', to: '/admin/hr/finance', visible: () => auth.canHrArea('finance') },
  { title: 'Organization access control', text: 'Department modules, position submenus, and scoped HR responsibilities.', icon: 'pi pi-shield', to: '/admin/hr/access', visible: () => auth.isSuperAdmin },
];
const visibleModules = computed(() => modules.filter((item) => item.visible()));

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await loadHrDashboard();
    dashboard.value = data?.dashboard || data || {};
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="hr-dashboard">
    <HrWorkspaceNav />

    <header class="hr-dashboard__hero">
      <div>
        <span class="hr-dashboard__eyebrow">{{ t(auth.isSuperAdmin ? 'People operations' : 'My HR workspace') }}</span>
        <h2>{{ t(auth.isSuperAdmin ? 'Your workforce, clearly organized.' : 'Everything you need for work and HR.') }}</h2>
        <p>{{ t(auth.isSuperAdmin ? 'See current headcount, onboarding status, and department distribution from one secure view.' : 'View your employment records and use the HR services assigned to your position and responsibilities.') }}</p>
      </div>
      <div class="hr-dashboard__hero-actions">
        <RouterLink v-if="canViewDirectory" to="/admin/hr/employees"><Button :label="t('Open directory')" icon="pi pi-users" /></RouterLink>
        <RouterLink v-else-if="auth.hasEmployee" to="/admin/hr/me"><Button :label="t('Open my profile')" icon="pi pi-id-card" /></RouterLink>
        <RouterLink v-if="canViewWorkforceReport" to="/admin/hr/reports"><Button :label="t('View reports')" icon="pi pi-chart-bar" severity="secondary" outlined /></RouterLink>
      </div>
    </header>

    <div v-if="error" class="hr-dashboard__error">
      <i class="pi pi-exclamation-circle" />
      <div><strong>{{ t('Could not load the HR dashboard') }}</strong><span>{{ error }}</span></div>
      <Button :label="t('Try again')" severity="secondary" outlined @click="load" />
    </div>

    <section class="hr-dashboard__metrics">
      <Skeleton v-if="loading" v-for="index in 5" :key="index" height="96px" border-radius="16px" />
      <article v-else v-for="metric in metrics" :key="metric.label" :class="`is-${metric.tone}`">
        <i :class="metric.icon" />
        <div><span>{{ t(metric.label) }}</span><strong>{{ metric.value }}</strong></div>
      </article>
    </section>

    <section v-if="loading || hasDepartmentBreakdown || hasStatusBreakdown" class="hr-dashboard__middle">
      <article v-if="loading || hasDepartmentBreakdown" class="hr-dashboard__panel">
        <header><div><p>{{ t('Workforce distribution') }}</p><h3>{{ t('By department') }}</h3></div><Tag :value="String(headcountByDepartment.length)" severity="secondary" /></header>
        <div v-if="loading" class="hr-dashboard__skeleton"><Skeleton v-for="index in 4" :key="index" height="48px" /></div>
        <ul v-else-if="headcountByDepartment.length">
          <li v-for="item in headcountByDepartment.slice(0, 8)" :key="item.id">
            <i class="pi pi-sitemap" />
            <div><strong>{{ item.name }}</strong><span>{{ t('Department') }}</span></div>
            <time>{{ item.employee_count }}</time>
          </li>
        </ul>
        <div v-else class="hr-dashboard__empty"><i class="pi pi-sitemap" /><span>{{ t('No department data yet.') }}</span></div>
      </article>

      <article v-if="loading || hasStatusBreakdown" class="hr-dashboard__panel">
        <header><div><p>{{ t('Employment status') }}</p><h3>{{ t('Current workforce') }}</h3></div><i class="pi pi-users" /></header>
        <div v-if="loading" class="hr-dashboard__skeleton"><Skeleton v-for="index in 4" :key="index" height="48px" /></div>
        <ul v-else-if="headcountByStatus.length">
          <li v-for="item in headcountByStatus" :key="item.status">
            <i class="pi pi-id-card" />
            <div><strong>{{ enumLabel(item.status) }}</strong><span>{{ t('Employees') }}</span></div>
            <time>{{ item.count }}</time>
          </li>
        </ul>
        <div v-else class="hr-dashboard__empty"><i class="pi pi-users" /><span>{{ t('No employment status data yet.') }}</span></div>
      </article>
    </section>

    <section class="hr-dashboard__modules">
      <RouterLink v-for="module in visibleModules" :key="module.title" :to="module.to">
        <i :class="module.icon" />
        <div><strong>{{ t(module.title) }}</strong><span>{{ t(module.text) }}</span></div>
        <i class="pi pi-arrow-right" />
      </RouterLink>
    </section>
  </section>
</template>

<style scoped>
.hr-dashboard { display: grid; gap: 17px; }
.hr-dashboard__hero { display: flex; align-items: end; justify-content: space-between; gap: 24px; overflow: hidden; padding: clamp(25px,4vw,42px); border: 1px solid rgba(255,255,255,.08); border-radius: 23px; background: radial-gradient(circle at 88% -20%,rgba(12,155,128,.3),transparent 40%), radial-gradient(circle at 0 110%,rgba(201,146,44,.2),transparent 36%), linear-gradient(135deg,var(--tm-charcoal),#172d2d); box-shadow: var(--tm-shadow); }
.hr-dashboard__eyebrow { color: var(--tm-gold); font-size: .7rem; font-weight: 950; letter-spacing: .13em; text-transform: uppercase; }
.hr-dashboard__hero h2 { max-width: 850px; margin: 8px 0 10px; color: #fff8ed; font-size: clamp(2rem,4vw,3.7rem); letter-spacing: -.052em; line-height: 1; }
.hr-dashboard__hero p { max-width: 760px; margin: 0; color: rgba(255,255,255,.65); line-height: 1.58; }
.hr-dashboard__hero-actions { display: flex; flex: 0 0 auto; gap: 8px; }.hr-dashboard__hero-actions a { text-decoration: none; }
.hr-dashboard__metrics { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 9px; }
.hr-dashboard__metrics article { --accent: var(--tm-gold); display: flex; min-height: 96px; align-items: center; gap: 10px; padding: 14px; border: 1px solid var(--tm-border); border-radius: 16px; background: var(--tm-surface); color: inherit; box-shadow: 0 9px 24px rgba(37,31,20,.045); }
.hr-dashboard__metrics article.is-emerald { --accent: var(--tm-emerald); }.hr-dashboard__metrics article.is-blue { --accent: var(--tm-blue); }.hr-dashboard__metrics article.is-coral { --accent: var(--tm-coral); }.hr-dashboard__metrics article.is-violet { --accent: #7c63a8; }.hr-dashboard__metrics article.is-slate { --accent: #647780; }
.hr-dashboard__metrics article > i:first-child { display: grid; width: 34px; height: 34px; flex: 0 0 auto; border-radius: 10px; background: color-mix(in srgb,var(--accent) 14%,transparent); color: var(--accent); place-items: center; }
.hr-dashboard__metrics div { display: grid; gap: 4px; min-width: 0; }.hr-dashboard__metrics span { color: var(--tm-muted); font-size: .69rem; font-weight: 800; }.hr-dashboard__metrics strong { color: var(--tm-heading); font-size: 1.35rem; }
.hr-dashboard__middle { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }
.hr-dashboard__panel { overflow: hidden; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 10px 28px rgba(37,31,20,.05); }
.hr-dashboard__panel > header { display: flex; align-items: center; justify-content: space-between; padding: 16px; border-bottom: 1px solid var(--tm-border); }.hr-dashboard__panel header p { margin: 0 0 3px; color: var(--tm-gold); font-size: .66rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }.hr-dashboard__panel h3 { margin: 0; color: var(--tm-heading); font-size: 1.05rem; }
.hr-dashboard__panel ul { margin: 0; padding: 4px 12px; list-style: none; }.hr-dashboard__panel li { display: flex; align-items: center; gap: 10px; padding: 10px 4px; border-bottom: 1px solid var(--tm-border); }.hr-dashboard__panel li:last-child { border: 0; }.hr-dashboard__panel li > i { display: grid; width: 32px; height: 32px; flex: 0 0 auto; border-radius: 9px; background: var(--tm-surface-soft); color: var(--tm-gold); place-items: center; }.hr-dashboard__panel li div { display: grid; gap: 3px; min-width: 0; }.hr-dashboard__panel li strong { overflow: hidden; color: var(--tm-heading); font-size: .8rem; text-overflow: ellipsis; white-space: nowrap; }.hr-dashboard__panel li span,.hr-dashboard__panel time { color: var(--tm-muted); font-size: .7rem; }.hr-dashboard__panel time { margin-left: auto; white-space: nowrap; }
.hr-dashboard__skeleton { display: grid; gap: 6px; padding: 12px; }.hr-dashboard__empty { display: grid; gap: 8px; min-height: 210px; color: var(--tm-muted); place-items: center; align-content: center; }.hr-dashboard__empty i { color: var(--tm-emerald); font-size: 1.45rem; }
.hr-dashboard__modules { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 9px; }.hr-dashboard__modules a { display: flex; align-items: center; gap: 11px; padding: 15px; border: 1px solid var(--tm-border); border-radius: 14px; background: var(--tm-surface); color: inherit; text-decoration: none; }.hr-dashboard__modules a > i:first-child { display: grid; width: 38px; height: 38px; flex: 0 0 auto; border-radius: 11px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }.hr-dashboard__modules a > i:last-child { margin-left: auto; color: var(--tm-muted); }.hr-dashboard__modules div { display: grid; gap: 4px; }.hr-dashboard__modules strong { color: var(--tm-heading); font-size: .84rem; }.hr-dashboard__modules span { color: var(--tm-muted); font-size: .72rem; line-height: 1.4; }
.hr-dashboard__error { display: flex; align-items: center; gap: 11px; padding: 14px; border: 1px solid color-mix(in srgb,var(--tm-coral) 35%,var(--tm-border)); border-radius: 14px; background: color-mix(in srgb,var(--tm-coral) 7%,var(--tm-surface)); }.hr-dashboard__error > i { color: var(--tm-coral); }.hr-dashboard__error div { display: grid; gap: 3px; }.hr-dashboard__error strong { color: var(--tm-heading); }.hr-dashboard__error span { color: var(--tm-muted); font-size: .8rem; }.hr-dashboard__error .p-button { margin-left: auto; }
@media (max-width: 1180px) { .hr-dashboard__metrics { grid-template-columns: repeat(3,minmax(0,1fr)); } }
@media (max-width: 820px) { .hr-dashboard__hero { align-items: stretch; flex-direction: column; }.hr-dashboard__middle,.hr-dashboard__modules { grid-template-columns: 1fr; } }
@media (max-width: 580px) { .hr-dashboard__metrics { grid-template-columns: repeat(2,minmax(0,1fr)); }.hr-dashboard__hero-actions { flex-direction: column; }.hr-dashboard__hero-actions :deep(.p-button) { width: 100%; } }
</style>
