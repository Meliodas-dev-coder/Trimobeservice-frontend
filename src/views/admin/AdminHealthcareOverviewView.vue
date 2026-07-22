<script setup>
import { computed, onMounted, ref } from 'vue';

import HealthcareWorkspaceNav from '@/components/admin/HealthcareWorkspaceNav.vue';
import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';

const { enumLabel, localeCode, t } = useAdminI18n();
const auth = useAuthStore();

const loading = ref(true);
const error = ref('');
const categories = ref([]);
const services = ref([]);
const serviceTotal = ref(0);
const practitioners = ref([]);
const practitionerTotal = ref(0);
const requests = ref([]);
const requestTotal = ref(0);
const emergency = ref(null);

const activeCategories = computed(() => categories.value.filter((item) => item.is_active).length);
const activeServices = computed(() => services.value.filter((item) => item.is_active).length);
const activePractitioners = computed(() => practitioners.value.filter((item) => item.status === 'active').length);
const activeDoctors = computed(() => practitioners.value.filter((item) => item.status === 'active' && item.type === 'doctor').length);
const activeNurses = computed(() => practitioners.value.filter((item) => item.status === 'active' && item.type === 'nurse').length);
const packageServices = computed(() => services.value.filter((item) => item.service_type === 'package'));
const staffedPackages = computed(() => packageServices.value.filter((item) => Number(item.staff_doctors || 0) + Number(item.staff_nurses || 0) > 0).length);
const requestsToReview = computed(() => requests.value.filter((item) => ['requested', 'reviewing'].includes(item.status)).length);
const requestsNeedAssignment = computed(() => requests.value.filter((item) => (
  ['confirmed', 'assigned', 'in_progress'].includes(item.status) && Number(item.assignment_count || 0) === 0
)).length);
const unpaidRequests = computed(() => requests.value.filter((item) => (
  item.payment_status === 'unpaid' && !['cancelled'].includes(item.status)
)).length);
const hasChildAccess = computed(() => [
  'healthcare.categories',
  'healthcare.services',
  'healthcare.practitioners',
  'healthcare.requests',
  'healthcare.settings',
].some((capability) => auth.canBusiness(capability)));

const workspaceCards = computed(() => [
  {
    key: 'categories', icon: 'pi pi-sitemap', tone: 'gold', eyebrow: t('Care structure'),
    title: t('Care categories'), value: categories.value.length,
    note: t('{n} active', { n: activeCategories.value }), to: '/admin/healthcare/categories', capability: 'healthcare.categories',
  },
  {
    key: 'services', icon: 'pi pi-heart-fill', tone: 'rose', eyebrow: t('Care catalog'),
    title: t('Care services'), value: serviceTotal.value,
    note: t('{n} available', { n: activeServices.value }), to: '/admin/healthcare/services', capability: 'healthcare.services',
  },
  {
    key: 'practitioners', icon: 'pi pi-user-plus', tone: 'emerald', eyebrow: t('Clinical roster'),
    title: t('Practitioners'), value: practitionerTotal.value,
    note: t('{n} ready to assign', { n: activePractitioners.value }), to: '/admin/practitioners', capability: 'healthcare.practitioners',
  },
  {
    key: 'requests', icon: 'pi pi-calendar-plus', tone: 'blue', eyebrow: t('Care pipeline'),
    title: t('Care requests'), value: requestTotal.value,
    note: requestsToReview.value ? t('{n} to review', { n: requestsToReview.value }) : t('All reviewed'),
    to: '/admin/healthcare/requests', capability: 'healthcare.requests',
  },
].filter((card) => auth.canBusiness(card.capability)));

const readinessRows = computed(() => [
  { label: t('Active care categories'), value: activeCategories.value, total: categories.value.length, icon: 'pi pi-sitemap', capability: 'healthcare.categories' },
  { label: t('Available care services'), value: activeServices.value, total: services.value.length, icon: 'pi pi-heart', capability: 'healthcare.services' },
  { label: t('Active practitioners'), value: activePractitioners.value, total: practitioners.value.length, icon: 'pi pi-user-plus', capability: 'healthcare.practitioners' },
  { label: t('Packages with a care team'), value: staffedPackages.value, total: packageServices.value.length, icon: 'pi pi-users', capability: 'healthcare.services' },
].filter((row) => auth.canBusiness(row.capability)));

const attentionItems = computed(() => [
  { label: t('Requests waiting for review'), value: requestsToReview.value, icon: 'pi pi-inbox', tone: requestsToReview.value ? 'rose' : 'emerald', to: '/admin/healthcare/requests', capability: 'healthcare.requests' },
  { label: t('Confirmed requests need staff'), value: requestsNeedAssignment.value, icon: 'pi pi-user-plus', tone: requestsNeedAssignment.value ? 'gold' : 'emerald', to: '/admin/healthcare/requests', capability: 'healthcare.requests' },
  { label: t('Care payments outstanding'), value: unpaidRequests.value, icon: 'pi pi-wallet', tone: unpaidRequests.value ? 'blue' : 'emerald', to: '/admin/healthcare/requests', capability: 'healthcare.requests' },
].filter((item) => auth.canBusiness(item.capability)));

function scheduleAt(request) {
  return request.request_type === 'package' ? request.start_at : request.preferred_at;
}

const upcomingRequests = computed(() => {
  const now = Date.now();
  return [...requests.value]
    .filter((item) => {
      const at = scheduleAt(item);
      return at && !['cancelled', 'completed'].includes(item.status) && new Date(at).getTime() >= now;
    })
    .sort((a, b) => new Date(scheduleAt(a)) - new Date(scheduleAt(b)))
    .slice(0, 5);
});

function percent(row) {
  return row.total ? Math.round((row.value / row.total) * 100) : 0;
}

function requestAmount(request) {
  const quote = Number(request.quoted_price || 0);
  if (quote) {
    return formatMGA(quote);
  }
  const indicative = Number(request.price_snapshot || 0);
  return indicative ? formatMGA(indicative) : t('Quote pending');
}

async function load() {
  loading.value = true;
  error.value = '';
  categories.value = [];
  services.value = [];
  practitioners.value = [];
  requests.value = [];
  serviceTotal.value = 0;
  practitionerTotal.value = 0;
  requestTotal.value = 0;
  emergency.value = null;
  const failures = [];
  const loadWidget = async (capability, request, apply) => {
    if (!auth.canBusiness(capability)) return;
    try {
      apply(await request());
    } catch (err) {
      if (err?.status !== 403) failures.push(err);
    }
  };
  await Promise.all([
    loadWidget('healthcare.categories', () => api.get('/admin/healthcare/categories'), (data) => {
      categories.value = data?.healthcare_service_categories || [];
    }),
    loadWidget('healthcare.services', () => api.get('/admin/healthcare/services', { params: { limit: 100, page: 1 } }), (data) => {
      services.value = data?.healthcare_services || [];
      serviceTotal.value = Number(data?.meta?.total ?? services.value.length);
    }),
    loadWidget('healthcare.practitioners', () => api.get('/admin/practitioners', { params: { limit: 100, page: 1 } }), (data) => {
      practitioners.value = data?.practitioners || [];
      practitionerTotal.value = Number(data?.meta?.total ?? practitioners.value.length);
    }),
    loadWidget('healthcare.requests', () => api.get('/admin/healthcare/requests', { params: { limit: 100, page: 1 } }), (data) => {
      requests.value = data?.healthcare_requests || [];
      requestTotal.value = Number(data?.meta?.total ?? requests.value.length);
    }),
    loadWidget('healthcare.settings', () => api.get('/admin/healthcare/settings'), (data) => {
      emergency.value = data?.emergency || null;
    }),
  ]);
  if (failures.length) error.value = failures[0]?.message || t('Could not load Healthcare operations');
  loading.value = false;
}

onMounted(load);
</script>

<template>
  <section class="care-overview">
    <HealthcareWorkspaceNav />

    <header class="care-hero">
      <div class="care-hero__copy">
        <p>{{ t('Care operations') }}</p>
        <h2>{{ t('Keep every home-care request clear and ready.') }}</h2>
        <span>{{ t('Organize services, maintain the clinical roster, review patient needs, assign practitioners, quote clearly, and follow payment in one workflow.') }}</span>
      </div>
      <div class="care-hero__actions">
        <Button v-if="auth.canBusiness('healthcare.requests')" as="router-link" to="/admin/healthcare/requests" :label="t('Open care requests')" icon="pi pi-calendar-plus" />
        <Button v-if="auth.canBusiness('healthcare.practitioners', 'manage')" as="router-link" to="/admin/practitioners" :label="t('Manage practitioners')" icon="pi pi-user-plus" severity="secondary" outlined />
        <Button as="router-link" to="/healthcare" :label="t('View healthcare page')" icon="pi pi-external-link" severity="secondary" outlined />
      </div>
    </header>

    <div v-if="error" class="care-error">
      <span><i class="pi pi-exclamation-circle" />{{ t(error) }}</span>
      <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
    </div>

    <div v-if="loading && hasChildAccess" class="workspace-grid">
      <Skeleton v-for="index in Math.max(workspaceCards.length, 1)" :key="index" height="10.5rem" borderRadius="18px" />
    </div>

    <template v-else>
      <section v-if="workspaceCards.length" class="workspace-grid" :aria-label="t('Healthcare workspace')">
        <RouterLink v-for="card in workspaceCards" :key="card.key" :to="card.to" class="workspace-card" :class="`is-${card.tone}`">
          <div class="workspace-card__top"><span><i :class="card.icon" /></span><i class="pi pi-arrow-up-right" /></div>
          <p>{{ card.eyebrow }}</p>
          <div class="workspace-card__value"><h3>{{ card.title }}</h3><strong>{{ card.value }}</strong></div>
          <small>{{ card.note }}</small>
        </RouterLink>
      </section>

      <section v-if="!hasChildAccess" class="overview-access-note">
        <i class="pi pi-eye" />
        <div><strong>{{ t('Overview access is active') }}</strong><span>{{ t('Additional submenu access is required to view operational data.') }}</span></div>
      </section>

      <section v-if="auth.canBusiness('healthcare.settings')" class="emergency-strip">
        <span class="emergency-strip__icon"><i class="pi pi-phone" /></span>
        <div>
          <p>{{ t('Client emergency line') }}</p>
          <strong>{{ emergency?.emergency_phone || t('Not configured') }}</strong>
          <small>{{ emergency?.emergency_hours || t('Hours not configured') }}</small>
        </div>
        <p class="emergency-strip__note">{{ emergency?.emergency_note || t('Add the urgent-care guidance shown to clients.') }}</p>
        <Button v-if="auth.canBusiness('healthcare.settings', 'manage')" as="router-link" to="/admin/healthcare/settings" :label="t('Edit emergency contact')" icon="pi pi-arrow-right" severity="secondary" outlined />
      </section>

      <div v-if="readinessRows.length || attentionItems.length" class="care-overview__grid">
        <section v-if="readinessRows.length" class="care-panel">
          <div class="care-panel__head">
            <div><p>{{ t('Care readiness') }}</p><h3>{{ t('What can serve patients now') }}</h3></div>
            <span class="care-panel__count">{{ activeServices }}/{{ services.length }}</span>
          </div>
          <div class="health-list">
            <article v-for="row in readinessRows" :key="row.label">
              <span class="health-list__icon"><i :class="row.icon" /></span>
              <div>
                <div class="health-list__label"><strong>{{ row.label }}</strong><span>{{ row.value }}/{{ row.total }}</span></div>
                <div class="health-list__track"><span :style="{ width: `${percent(row)}%` }" /></div>
              </div>
            </article>
          </div>
          <div v-if="auth.canBusiness('healthcare.practitioners')" class="roster-split">
            <span><i class="pi pi-user" /><strong>{{ activeDoctors }}</strong>{{ t('active doctors') }}</span>
            <span><i class="pi pi-user" /><strong>{{ activeNurses }}</strong>{{ t('active nurses') }}</span>
          </div>
        </section>

        <section v-if="attentionItems.length" class="care-panel">
          <div class="care-panel__head">
            <div><p>{{ t('Needs attention') }}</p><h3>{{ t('Care coordination checklist') }}</h3></div>
          </div>
          <div class="attention-list">
            <RouterLink v-for="item in attentionItems" :key="item.label" :to="item.to" :class="`is-${item.tone}`">
              <span><i :class="item.icon" /></span><strong>{{ item.label }}</strong><b>{{ item.value }}</b><i class="pi pi-arrow-right" />
            </RouterLink>
          </div>
        </section>
      </div>

      <section v-if="auth.canBusiness('healthcare.requests')" class="care-panel upcoming-panel">
        <div class="care-panel__head">
          <div><p>{{ t('Care schedule') }}</p><h3>{{ t('Upcoming consultations and packages') }}</h3></div>
          <Button as="router-link" to="/admin/healthcare/requests" :label="t('View all requests')" icon="pi pi-arrow-right" severity="secondary" text />
        </div>
        <div v-if="upcomingRequests.length" class="request-list">
          <article v-for="request in upcomingRequests" :key="request.id">
            <span class="request-list__date"><i class="pi pi-calendar" />{{ formatDateTime(scheduleAt(request), localeCode) }}</span>
            <span class="request-list__main">
              <strong>{{ request.patient_name }} · {{ request.service_name || t('General consultation') }}</strong>
              <small>{{ request.customer_name || t('Customer') }} · {{ request.request_number }}</small>
            </span>
            <span class="request-list__amount">{{ requestAmount(request) }}</span>
            <Tag :value="enumLabel(request.status)" :severity="statusSeverity(request.status)" />
          </article>
        </div>
        <div v-else class="care-empty"><i class="pi pi-calendar" /><span>{{ t('No upcoming care requests.') }}</span></div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.care-overview { display: grid; gap: 18px; }
.care-hero { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 24px; overflow: hidden; padding: clamp(24px, 4vw, 38px); border: 1px solid rgba(255,255,255,.08); border-radius: 24px; background: radial-gradient(circle at 88% -10%, rgba(192,90,125,.48), transparent 38%), linear-gradient(135deg, var(--tm-charcoal), #302126); box-shadow: var(--tm-shadow); }
.care-hero::after { position: absolute; right: -58px; bottom: -125px; width: 270px; height: 270px; border: 1px solid rgba(239,157,184,.28); border-radius: 50%; content: ''; }
.care-hero__copy, .care-hero__actions { position: relative; z-index: 1; }
.care-hero p, .care-panel__head p, .workspace-card > p, .emergency-strip p { margin: 0; color: #ef9db8; font-size: .72rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
.care-hero h2 { max-width: 760px; margin: 8px 0 9px; color: #fff8ed; font-size: clamp(2rem, 4vw, 3.7rem); letter-spacing: -.048em; line-height: .98; }
.care-hero__copy > span { display: block; max-width: 780px; color: rgba(255,255,255,.67); line-height: 1.55; }
.care-hero__actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 9px; }
.care-hero__actions :deep(.p-button-secondary) { border-color: rgba(255,255,255,.2); color: #fff; }
.care-error { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border: 1px solid rgba(192,90,125,.28); border-radius: 14px; background: rgba(192,90,125,.08); color: #b44169; font-weight: 800; }
.care-error span { display: flex; align-items: center; gap: 8px; }
.workspace-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); }
.overview-access-note { display: flex; align-items: center; gap: 13px; padding: 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); color: var(--tm-muted); }
.overview-access-note > i { display: grid; width: 42px; height: 42px; flex: 0 0 auto; border-radius: 13px; background: var(--tm-surface-soft); color: #c05a7d; place-items: center; }
.overview-access-note div { display: grid; gap: 4px; }.overview-access-note strong { color: var(--tm-heading); }.overview-access-note span { font-size: .86rem; }
.workspace-card { --accent: var(--tm-gold); --wash: rgba(201,146,44,.12); display: grid; min-height: 170px; gap: 8px; padding: 18px; border: 1px solid var(--tm-border); border-radius: 18px; background: radial-gradient(circle at 100% 0%, var(--wash), transparent 50%), var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); color: inherit; text-decoration: none; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
.workspace-card.is-rose { --accent: #c05a7d; --wash: rgba(192,90,125,.13); } .workspace-card.is-emerald { --accent: var(--tm-emerald); --wash: rgba(12,155,128,.12); } .workspace-card.is-blue { --accent: var(--tm-blue); --wash: rgba(49,92,112,.12); }
.workspace-card:hover, .workspace-card:focus-visible { border-color: var(--accent); box-shadow: var(--tm-shadow-hover); outline: none; transform: translateY(-3px); }
.workspace-card__top, .workspace-card__value, .care-panel__head, .health-list__label { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.workspace-card__top > span { display: grid; width: 40px; height: 40px; border-radius: 13px; background: var(--accent); color: #fff; place-items: center; } .workspace-card__top > i { color: var(--accent); }
.workspace-card__value h3, .workspace-card__value strong { margin: 0; color: var(--tm-heading); } .workspace-card__value h3 { font-size: 1.08rem; } .workspace-card__value strong { font-size: 2rem; letter-spacing: -.05em; } .workspace-card small { margin-top: auto; color: var(--tm-muted); font-weight: 760; }
.emergency-strip { display: grid; grid-template-columns: auto minmax(180px,.55fr) minmax(260px,1fr) auto; align-items: center; gap: 16px; padding: 16px 18px; border: 1px solid rgba(192,90,125,.22); border-radius: 18px; background: linear-gradient(90deg, rgba(192,90,125,.09), transparent 42%), var(--tm-surface); }
.emergency-strip__icon { display: grid; width: 44px; height: 44px; border-radius: 14px; background: #c05a7d; color: #fff; place-items: center; }
.emergency-strip > div { display: grid; gap: 2px; } .emergency-strip strong { color: var(--tm-heading); font-size: 1.15rem; } .emergency-strip small, .emergency-strip__note { color: var(--tm-muted); font-weight: 720; } .emergency-strip__note { margin: 0; line-height: 1.45; text-transform: none; letter-spacing: 0; }
.care-overview__grid { display: grid; align-items: stretch; gap: 16px; grid-template-columns: minmax(0, 1.15fr) minmax(280px,.85fr); }
.care-panel { display: grid; gap: 18px; padding: 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); }
.care-panel__head { align-items: flex-start; } .care-panel__head h3 { margin: 4px 0 0; color: var(--tm-heading); font-size: 1.15rem; letter-spacing: -.025em; }
.care-panel__count { display: grid; min-width: 48px; height: 38px; padding: 0 10px; border-radius: 12px; background: var(--tm-charcoal); color: #fff; font-weight: 900; place-items: center; }
.health-list { display: grid; gap: 16px; } .health-list article { display: grid; grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 11px; } .health-list__icon { display: grid; width: 38px; height: 38px; border-radius: 12px; background: rgba(192,90,125,.09); color: #c05a7d; place-items: center; } .health-list__label strong { color: var(--tm-heading); font-size: .84rem; } .health-list__label span { color: var(--tm-muted); font-size: .78rem; font-weight: 800; } .health-list__track { height: 7px; margin-top: 7px; overflow: hidden; border-radius: 999px; background: var(--tm-surface-soft); } .health-list__track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #c05a7d, var(--tm-gold)); }
.roster-split { display: grid; gap: 9px; grid-template-columns: repeat(2,minmax(0,1fr)); } .roster-split span { display: flex; align-items: center; gap: 7px; padding: 10px 12px; border-radius: 12px; background: var(--tm-surface-soft); color: var(--tm-muted); font-size: .78rem; font-weight: 750; } .roster-split i { color: #c05a7d; } .roster-split strong { color: var(--tm-heading); font-size: 1rem; }
.attention-list { display: grid; gap: 10px; } .attention-list a { --attention: var(--tm-gold); display: grid; grid-template-columns: auto minmax(0,1fr) auto auto; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--tm-border); border-radius: 13px; color: inherit; text-decoration: none; } .attention-list a.is-rose { --attention: #c05a7d; } .attention-list a.is-blue { --attention: var(--tm-blue); } .attention-list a.is-emerald { --attention: var(--tm-emerald); } .attention-list a > span { display: grid; width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--attention) 12%, transparent); color: var(--attention); place-items: center; } .attention-list a strong { color: var(--tm-heading); font-size: .86rem; } .attention-list a b { color: var(--attention); font-size: 1.25rem; } .attention-list a > i { color: var(--tm-muted); font-size: .78rem; }
.upcoming-panel { overflow: hidden; } .request-list { display: grid; } .request-list article { display: grid; grid-template-columns: minmax(180px,.65fr) minmax(260px,1fr) auto auto; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--tm-border); } .request-list article:last-child { border-bottom: 0; } .request-list__date { display: flex; align-items: center; gap: 8px; color: var(--tm-muted); font-size: .82rem; font-weight: 780; } .request-list__date i { color: #c05a7d; } .request-list__main { display: grid; gap: 3px; } .request-list__main strong { color: var(--tm-heading); } .request-list__main small { color: var(--tm-muted); font-weight: 720; } .request-list__amount { color: var(--tm-heading); font-weight: 900; white-space: nowrap; }
.care-empty { display: grid; gap: 9px; place-items: center; padding: 24px; color: var(--tm-muted); font-weight: 800; } .care-empty i { color: #c05a7d; font-size: 1.5rem; }
@media (max-width: 1120px) { .workspace-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } .emergency-strip { grid-template-columns: auto 1fr auto; } .emergency-strip__note { grid-column: 2; } }
@media (max-width: 920px) { .care-hero, .care-overview__grid { grid-template-columns: 1fr; } .care-hero__actions { justify-content: flex-start; } }
@media (max-width: 720px) { .workspace-grid { grid-template-columns: 1fr; } .care-hero__actions, .care-error { align-items: stretch; flex-direction: column; } .emergency-strip { grid-template-columns: auto 1fr; } .emergency-strip__note, .emergency-strip :deep(.p-button) { grid-column: 1 / -1; } .request-list article { grid-template-columns: 1fr auto; } .request-list__main, .request-list__date { grid-column: 1; } .request-list__amount, .request-list :deep(.p-tag) { grid-column: 2; } }
</style>
