<script setup>
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import HrAttendanceCalendar from '@/components/admin/hr/HrAttendanceCalendar.vue';
import HrClockCard from '@/components/admin/hr/HrClockCard.vue';
import HrContractDocuments from '@/components/admin/hr/HrContractDocuments.vue';
import HrContractTemplates from '@/components/admin/hr/HrContractTemplates.vue';
import HrLeaveCalendar from '@/components/admin/hr/HrLeaveCalendar.vue';
import HrPositionHierarchy from '@/components/admin/hr/HrPositionHierarchy.vue';
import HrRecruitmentPipeline from '@/components/admin/hr/HrRecruitmentPipeline.vue';
import HrResourceTable from '@/components/admin/hr/HrResourceTable.vue';
import HrTimeSummary from '@/components/admin/hr/HrTimeSummary.vue';
import HrWorkspaceNav from '@/components/admin/hr/HrWorkspaceNav.vue';
import { hrFeatureForResource, scopeLabel } from '@/data/hrAccess';
import { getHrArea, getHrResource } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = useAdminI18n();
const area = computed(() => getHrArea(route.params.area));
const visibleResourceIds = computed(() => (area.value?.resources || []).filter((id) => auth.canHr(hrFeatureForResource(id), 'view')));
const activeId = computed(() => {
  const requested = route.params.resource;
  return visibleResourceIds.value.includes(requested) ? requested : visibleResourceIds.value[0];
});
// Panels that are not generic CRUD tables get their own component and tab meta.
const SPECIAL_PANELS = {
  calendar: { icon: 'pi pi-calendar', title: 'Leave calendar' },
  'position-hierarchy': { icon: 'pi pi-sitemap', title: 'Position hierarchy' },
  'contract-templates': { icon: 'pi pi-file-edit', title: 'Contract templates' },
  'contract-documents': { icon: 'pi pi-file', title: 'Contract documents' },
};
const resource = computed(() => (SPECIAL_PANELS[activeId.value] ? null : getHrResource(activeId.value)));
const tabIcon = (id) => SPECIAL_PANELS[id]?.icon || getHrResource(id)?.icon;
const tabTitle = (id) => SPECIAL_PANELS[id]?.title || getHrResource(id)?.title;
const activeScope = computed(() => activeId.value ? auth.hrScope(hrFeatureForResource(activeId.value), 'view') : null);
const resourceDefaults = computed(() => activeScope.value === 'self' && auth.employee?.id ? { employee_id: Number(auth.employee.id) } : {});

// The self-service clock is shown to every employee (anyone with a linked HR
// employee record) on the attendance screen.
const showClock = computed(() => route.params.area === 'time' && activeId.value === 'attendance' && auth.hasEmployee);
const timeSummaryRef = ref(null);
const attendanceTableRef = ref(null);
const attendanceCalendarRef = ref(null);
// Attendance reads as a calendar by default — an employee × day grid answers
// "who was in this fortnight?" far faster than a row-per-record table. The
// detailed list stays one click away for corrections and exports.
const isAttendance = computed(() => route.params.area === 'time' && activeId.value === 'attendance');
const attendanceView = ref('calendar');

function onClockChanged() {
  timeSummaryRef.value?.load?.();
  attendanceTableRef.value?.load?.();
  attendanceCalendarRef.value?.load?.();
}

function choose(id) {
  router.push({ name: 'admin-hr-area-resource', params: { area: route.params.area, resource: id } });
}
</script>

<template>
  <section v-if="area" class="hr-area">
    <HrWorkspaceNav />
    <header class="hr-area__hero">
      <span><i :class="area.icon" /></span>
      <div><p>{{ t('Human Resources') }}</p><h2>{{ t(area.title) }}</h2><div>{{ t(area.description) }}</div><Tag v-if="activeScope" :value="t(scopeLabel(activeScope))" severity="info" /></div>
    </header>

    <nav class="hr-area__tabs" :aria-label="t(area.title)">
      <button
        v-for="id in visibleResourceIds"
        :key="id"
        type="button"
        :class="{ 'is-active': activeId === id }"
        @click="choose(id)"
      >
        <i :class="tabIcon(id)" />
        <span>{{ t(tabTitle(id)) }}</span>
      </button>
    </nav>

    <HrClockCard v-if="showClock" @changed="onClockChanged" />
    <HrTimeSummary v-if="isAttendance" ref="timeSummaryRef" />
    <div v-if="isAttendance" class="hr-area__views" role="group" :aria-label="t('View')">
      <button type="button" :class="{ 'is-active': attendanceView === 'calendar' }" @click="attendanceView = 'calendar'">
        <i class="pi pi-calendar" /><span>{{ t('Calendar') }}</span>
      </button>
      <button type="button" :class="{ 'is-active': attendanceView === 'records' }" @click="attendanceView = 'records'">
        <i class="pi pi-list" /><span>{{ t('Records') }}</span>
      </button>
    </div>
    <HrRecruitmentPipeline v-if="route.params.area === 'recruitment' && activeId === 'candidates'" />
    <HrAttendanceCalendar v-if="isAttendance && attendanceView === 'calendar'" ref="attendanceCalendarRef" />
    <HrLeaveCalendar v-else-if="activeId === 'calendar'" />
    <HrPositionHierarchy v-else-if="activeId === 'position-hierarchy'" />
    <HrContractTemplates v-else-if="activeId === 'contract-templates'" />
    <HrContractDocuments v-else-if="activeId === 'contract-documents'" />
    <HrResourceTable v-else-if="resource" ref="attendanceTableRef" :resource="resource" :defaults="resourceDefaults" />
    <section v-else-if="!visibleResourceIds.length" class="hr-area__missing">
      <i class="pi pi-lock" />
      <h2>{{ t('No access to this HR workspace') }}</h2>
      <RouterLink to="/admin/hr/overview"><Button :label="t('Back to HR overview')" /></RouterLink>
    </section>
  </section>
  <section v-else class="hr-area__missing">
    <i class="pi pi-exclamation-circle" />
    <h2>{{ t('HR workspace not found') }}</h2>
    <RouterLink to="/admin/hr/overview"><Button :label="t('Back to HR overview')" /></RouterLink>
  </section>
</template>

<style scoped>
.hr-area { display: grid; gap: 16px; min-width: 0; }
.hr-area__hero { display: flex; align-items: center; gap: 14px; padding: 19px 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: radial-gradient(circle at 100% 0%,rgba(201,146,44,.1),transparent 47%),var(--tm-surface); box-shadow: 0 10px 28px rgba(37,31,20,.045); }
.hr-area__hero > span { display: grid; width: 45px; height: 45px; flex: 0 0 auto; border-radius: 13px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }.hr-area__hero p { margin: 0 0 4px; color: var(--tm-gold); font-size: .67rem; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; }.hr-area__hero h2 { margin: 0; color: var(--tm-heading); font-size: 1.45rem; letter-spacing: -.035em; }.hr-area__hero div > div { margin-top: 5px; color: var(--tm-muted); font-size: .85rem; line-height: 1.45; }
.hr-area__hero div > :deep(.p-tag) { margin-top: 9px; }
.hr-area__tabs { display: flex; gap: 5px; overflow-x: auto; padding-bottom: 2px; scrollbar-width: thin; }.hr-area__tabs button { display: flex; min-width: max-content; min-height: 40px; align-items: center; gap: 7px; padding: 8px 12px; border: 1px solid var(--tm-border); border-radius: 10px; background: var(--tm-surface); color: var(--tm-muted); cursor: pointer; font-size: .76rem; font-weight: 850; }.hr-area__tabs button:hover { color: var(--tm-heading); }.hr-area__tabs button.is-active { border-color: var(--tm-charcoal); background: var(--tm-charcoal); color: #fff8ed; }.hr-area__tabs button.is-active i { color: var(--tm-gold); }
.hr-area__views { display: flex; gap: 5px; }.hr-area__views button { display: flex; min-height: 36px; align-items: center; gap: 7px; padding: 7px 13px; border: 1px solid var(--tm-border); border-radius: 999px; background: var(--tm-surface); color: var(--tm-muted); cursor: pointer; font-size: .74rem; font-weight: 850; }.hr-area__views button.is-active { border-color: var(--tm-charcoal); background: var(--tm-charcoal); color: #fff8ed; }.hr-area__views button.is-active i { color: var(--tm-gold); }
.hr-area__missing { display: grid; min-height: 50vh; align-content: center; justify-items: center; gap: 10px; text-align: center; }.hr-area__missing i { color: var(--tm-coral); font-size: 2rem; }.hr-area__missing h2 { color: var(--tm-heading); }
</style>
