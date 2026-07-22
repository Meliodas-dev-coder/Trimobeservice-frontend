<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { getHrResource as fetchHrResource } from '@/api/hr';
import HrEmployeeAccessPanel from '@/components/admin/hr/HrEmployeeAccessPanel.vue';
import HrResourceTable from '@/components/admin/hr/HrResourceTable.vue';
import HrWorkspaceNav from '@/components/admin/hr/HrWorkspaceNav.vue';
import { getHrResource } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();
const { enumLabel, localeCode, t } = useAdminI18n();
const employee = ref(null);
const loading = ref(true);
const error = ref('');
const activeTab = ref('contracts');
const employeeId = computed(() => Number(route.params.id || auth.employee?.id || 0));
const isOwnProfile = computed(() => employeeId.value && employeeId.value === Number(auth.employee?.id));

const name = computed(() => employee.value?.full_name
  || `${employee.value?.first_name || ''} ${employee.value?.last_name || ''}`.trim()
  || t('Employee'));
const initials = computed(() => `${employee.value?.first_name?.[0] || ''}${employee.value?.last_name?.[0] || ''}`.toUpperCase() || 'HR');

const tabDefinitions = [
  { id: 'contracts', label: 'Contracts', icon: 'pi pi-file-edit', resource: 'contracts', feature: 'contracts' },
  { id: 'documents', label: 'Documents', icon: 'pi pi-folder', resource: 'documents', feature: 'documents' },
  { id: 'contacts', label: 'Emergency contacts', icon: 'pi pi-phone', resource: 'emergency-contacts', feature: 'emergency_contacts' },
  { id: 'lifecycle', label: 'Lifecycle', icon: 'pi pi-directions', resource: 'lifecycle-events', feature: 'lifecycle' },
  { id: 'leave', label: 'Leave balances', icon: 'pi pi-calendar', resource: 'leave-balances', feature: 'leave_balances' },
  { id: 'compensation', label: 'Compensation', icon: 'pi pi-money-bill', resource: 'compensation', feature: 'compensation' },
  { id: 'benefits', label: 'Benefit enrolments', icon: 'pi pi-gift', resource: 'benefit-enrollments', feature: 'benefit_enrollments' },
  { id: 'access', label: 'Access', icon: 'pi pi-shield', access: true },
];
const tabs = computed(() => tabDefinitions.filter((tab) => (
  tab.access ? (auth.isSuperAdmin || isOwnProfile.value) : auth.canHr(tab.feature, 'view')
)));
watch(tabs, (available) => {
  if (!available.some((tab) => tab.id === activeTab.value)) activeTab.value = available[0]?.id || '';
}, { immediate: true });
const activeResource = computed(() => {
  const tab = tabs.value.find((item) => item.id === activeTab.value) || tabs.value[0];
  if (!tab) return null;
  if (tab.access) return null;
  return { ...getHrResource(tab.resource), fixedParams: { employee_id: employeeId.value } };
});

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(localeCode.value, { dateStyle: 'medium' }).format(date);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    if (!employeeId.value) throw new Error(t('No employee record is linked to this account.'));
    employee.value = await fetchHrResource(getHrResource('employees'), employeeId.value);
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="hr-employee">
    <HrWorkspaceNav />
    <div v-if="loading" class="hr-employee__loading"><Skeleton height="200px" border-radius="20px" /><Skeleton height="360px" border-radius="18px" /></div>
    <section v-else-if="error" class="hr-employee__error">
      <i class="pi pi-exclamation-circle" /><h2>{{ t('Could not load employee') }}</h2><p>{{ error }}</p>
        <RouterLink :to="isOwnProfile ? '/admin/hr/overview' : '/admin/hr/employees'"><Button :label="t(isOwnProfile ? 'Back to HR overview' : 'Back to directory')" /></RouterLink>
    </section>
    <template v-else-if="employee">
      <header class="hr-employee__profile">
        <div class="hr-employee__avatar">
          <img v-if="employee.photo_url" :src="employee.photo_url" :alt="name" />
          <span v-else>{{ initials }}</span>
        </div>
        <div class="hr-employee__identity">
          <p>{{ employee.employee_number }}</p>
          <h2>{{ name }}</h2>
          <span>{{ employee.position_title || t('Position not assigned') }} · {{ employee.department_name || t('Department not assigned') }}</span>
          <div>
            <Tag :value="enumLabel(employee.employment_status)" :severity="employee.employment_status === 'active' ? 'success' : 'info'" />
            <Tag :value="enumLabel(employee.employment_type)" severity="secondary" />
          </div>
        </div>
        <RouterLink :to="isOwnProfile ? '/admin/hr/overview' : '/admin/hr/employees'"><Button :label="t(isOwnProfile ? 'Back to HR overview' : 'Back to directory')" icon="pi pi-arrow-left" severity="secondary" outlined /></RouterLink>
      </header>

      <section class="hr-employee__facts">
        <article><i class="pi pi-envelope" /><div><span>{{ t('Work email') }}</span><strong>{{ employee.work_email }}</strong></div></article>
        <article><i class="pi pi-phone" /><div><span>{{ t('Phone') }}</span><strong>{{ employee.phone || '—' }}</strong></div></article>
        <article><i class="pi pi-calendar" /><div><span>{{ t('Hire date') }}</span><strong>{{ formatDate(employee.hire_date) }}</strong></div></article>
        <article><i class="pi pi-map-marker" /><div><span>{{ t('Work location') }}</span><strong>{{ employee.work_location || '—' }}</strong></div></article>
        <article><i class="pi pi-user" /><div><span>{{ t('Manager') }}</span><strong>{{ employee.manager_name || '—' }}</strong></div></article>
      </section>

      <nav class="hr-employee__tabs">
        <button v-for="tab in tabs" :key="tab.id" type="button" :class="{ 'is-active': activeTab === tab.id }" @click="activeTab = tab.id">
          <i :class="tab.icon" /><span>{{ t(tab.label) }}</span>
        </button>
      </nav>
      <HrEmployeeAccessPanel v-if="activeTab === 'access'" :employee="employee" />
      <HrResourceTable v-else-if="activeResource" :key="activeResource.id" :resource="activeResource" :defaults="{ employee_id: employeeId }" />
    </template>
  </section>
</template>

<style scoped>
.hr-employee { display: grid; gap: 16px; }.hr-employee__loading { display: grid; gap: 14px; }
.hr-employee__profile { display: flex; align-items: center; gap: 16px; padding: 22px; border: 1px solid var(--tm-border); border-radius: 20px; background: radial-gradient(circle at 100% 0%,rgba(12,155,128,.11),transparent 45%),var(--tm-surface); box-shadow: 0 12px 32px rgba(37,31,20,.05); }
.hr-employee__avatar { display: grid; width: 76px; height: 76px; flex: 0 0 auto; overflow: hidden; border-radius: 21px; background: linear-gradient(135deg,var(--tm-gold),var(--tm-charcoal)); color: #fff; font-size: 1.4rem; font-weight: 950; place-items: center; }.hr-employee__avatar img { width: 100%; height: 100%; object-fit: cover; }
.hr-employee__identity { min-width: 0; }.hr-employee__identity p { margin: 0 0 3px; color: var(--tm-gold); font-size: .69rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }.hr-employee__identity h2 { margin: 0; color: var(--tm-heading); font-size: clamp(1.55rem,3vw,2.2rem); letter-spacing: -.04em; }.hr-employee__identity > span { display: block; margin-top: 4px; color: var(--tm-muted); }.hr-employee__identity > div { display: flex; gap: 6px; margin-top: 10px; }.hr-employee__profile > a { margin-left: auto; text-decoration: none; }
.hr-employee__facts { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 8px; }.hr-employee__facts article { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 12px; border: 1px solid var(--tm-border); border-radius: 13px; background: var(--tm-surface); }.hr-employee__facts i { display: grid; width: 32px; height: 32px; flex: 0 0 auto; border-radius: 9px; background: var(--tm-surface-soft); color: var(--tm-gold); place-items: center; }.hr-employee__facts div { display: grid; gap: 3px; min-width: 0; }.hr-employee__facts span { color: var(--tm-muted); font-size: .67rem; font-weight: 800; }.hr-employee__facts strong { overflow: hidden; color: var(--tm-heading); font-size: .76rem; text-overflow: ellipsis; white-space: nowrap; }
.hr-employee__tabs { display: flex; gap: 5px; overflow-x: auto; }.hr-employee__tabs button { display: flex; min-width: max-content; align-items: center; gap: 7px; padding: 9px 11px; border: 1px solid var(--tm-border); border-radius: 10px; background: var(--tm-surface); color: var(--tm-muted); cursor: pointer; font-size: .75rem; font-weight: 850; }.hr-employee__tabs button.is-active { border-color: var(--tm-charcoal); background: var(--tm-charcoal); color: #fff8ed; }.hr-employee__tabs button.is-active i { color: var(--tm-gold); }
.hr-employee__error { display: grid; min-height: 52vh; align-content: center; justify-items: center; text-align: center; }.hr-employee__error > i { color: var(--tm-coral); font-size: 2rem; }.hr-employee__error h2 { color: var(--tm-heading); }.hr-employee__error p { color: var(--tm-muted); }
@media (max-width: 1050px) { .hr-employee__facts { grid-template-columns: repeat(3,minmax(0,1fr)); } }
@media (max-width: 650px) { .hr-employee__profile { align-items: flex-start; flex-wrap: wrap; }.hr-employee__profile > a { width: 100%; margin-left: 0; }.hr-employee__profile > a :deep(.p-button) { width: 100%; }.hr-employee__facts { grid-template-columns: 1fr; } }
</style>
