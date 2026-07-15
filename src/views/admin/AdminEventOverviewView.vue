<script setup>
import { computed, onMounted, ref } from 'vue';

import EventWorkspaceNav from '@/components/admin/EventWorkspaceNav.vue';
import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { formatDateTime, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';

const { enumLabel, localeCode, t } = useAdminI18n();

const loading = ref(true);
const error = ref('');
const categories = ref([]);
const services = ref([]);
const artists = ref([]);
const requests = ref([]);
const requestTotal = ref(0);

const activeCategories = computed(() => categories.value.filter((item) => item.is_active).length);
const activeServices = computed(() => services.value.filter((item) => item.is_active).length);
const activeArtists = computed(() => artists.value.filter((item) => item.is_active).length);
const featuredArtists = computed(() => artists.value.filter((item) => item.is_active && item.is_featured).length);
const requestsToReview = computed(() => requests.value.filter((item) => ['requested', 'reviewing'].includes(item.status)).length);
const unquotedRequests = computed(() => requests.value.filter((item) => (
  !['cancelled', 'completed'].includes(item.status) && !Number(item.quoted_price || 0)
)).length);
const unpaidRequests = computed(() => requests.value.filter((item) => (
  item.payment_status === 'unpaid' && !['cancelled'].includes(item.status)
)).length);

const workspaceCards = computed(() => [
  {
    key: 'categories', icon: 'pi pi-sitemap', tone: 'gold', eyebrow: t('Offer structure'),
    title: t('Service categories'), value: categories.value.length,
    note: t('{n} active', { n: activeCategories.value }), to: '/admin/event-service-categories',
  },
  {
    key: 'services', icon: 'pi pi-star', tone: 'emerald', eyebrow: t('Event catalog'),
    title: t('Event services'), value: services.value.length,
    note: t('{n} available', { n: activeServices.value }), to: '/admin/event-services',
  },
  {
    key: 'artists', icon: 'pi pi-microphone', tone: 'blue', eyebrow: t('Talent roster'),
    title: t('Gospel artists'), value: artists.value.length,
    note: t('{n} featured', { n: featuredArtists.value }), to: '/admin/artists',
  },
  {
    key: 'requests', icon: 'pi pi-calendar-plus', tone: 'coral', eyebrow: t('Planning pipeline'),
    title: t('Event requests'), value: requestTotal.value,
    note: requestsToReview.value ? t('{n} to review', { n: requestsToReview.value }) : t('All reviewed'),
    to: '/admin/event-requests',
  },
]);

const readinessRows = computed(() => [
  { label: t('Active service categories'), value: activeCategories.value, total: categories.value.length, icon: 'pi pi-sitemap' },
  { label: t('Available event services'), value: activeServices.value, total: services.value.length, icon: 'pi pi-star' },
  { label: t('Available artists'), value: activeArtists.value, total: artists.value.length, icon: 'pi pi-microphone' },
  {
    label: t('Services with an image'),
    value: services.value.filter((item) => item.is_active && item.image_url).length,
    total: activeServices.value,
    icon: 'pi pi-image',
  },
]);

const attentionItems = computed(() => [
  {
    label: t('Requests waiting for review'), value: requestsToReview.value, icon: 'pi pi-inbox',
    tone: requestsToReview.value ? 'coral' : 'emerald', to: '/admin/event-requests',
  },
  {
    label: t('Requests need a quote'), value: unquotedRequests.value, icon: 'pi pi-tag',
    tone: unquotedRequests.value ? 'gold' : 'emerald', to: '/admin/event-requests',
  },
  {
    label: t('Event payments outstanding'), value: unpaidRequests.value, icon: 'pi pi-wallet',
    tone: unpaidRequests.value ? 'blue' : 'emerald', to: '/admin/event-requests',
  },
]);

const upcomingRequests = computed(() => {
  const now = Date.now();
  return [...requests.value]
    .filter((item) => !['cancelled', 'completed'].includes(item.status) && new Date(item.event_start || 0).getTime() >= now)
    .sort((a, b) => new Date(a.event_start || 0) - new Date(b.event_start || 0))
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
  const budget = Number(request.budget || 0);
  return budget ? t('Budget {amount}', { amount: formatMGA(budget) }) : t('Quote pending');
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [categoryData, serviceData, artistData, requestData] = await Promise.all([
      api.get('/admin/event-service-categories'),
      api.get('/admin/event-services', { params: { limit: 100, page: 1 } }),
      api.get('/admin/artists', { params: { limit: 100, page: 1 } }),
      api.get('/admin/event-requests', { params: { limit: 100, page: 1 } }),
    ]);
    categories.value = categoryData?.event_service_categories || [];
    services.value = serviceData?.event_services || [];
    artists.value = artistData?.artists || [];
    requests.value = requestData?.event_requests || [];
    requestTotal.value = Number(requestData?.meta?.total ?? requests.value.length);
  } catch (err) {
    categories.value = [];
    services.value = [];
    artists.value = [];
    requests.value = [];
    requestTotal.value = 0;
    error.value = err?.message || t('Could not load Events operations');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="event-overview">
    <EventWorkspaceNav />

    <header class="event-hero">
      <div class="event-hero__copy">
        <p>{{ t('Event operations') }}</p>
        <h2>{{ t('Turn every request into a clear event plan.') }}</h2>
        <span>{{ t('Keep services and artists ready, review client needs, compare budgets, quote confidently, and follow every event through payment.') }}</span>
      </div>
      <div class="event-hero__actions">
        <Button as="router-link" to="/admin/event-requests/new" :label="t('Create request')" icon="pi pi-plus" />
        <Button as="router-link" to="/admin/event-services" :label="t('Manage services')" icon="pi pi-star" severity="secondary" outlined />
        <Button as="router-link" to="/events" :label="t('View events page')" icon="pi pi-external-link" severity="secondary" outlined />
      </div>
    </header>

    <div v-if="error" class="event-error">
      <span><i class="pi pi-exclamation-circle" />{{ t(error) }}</span>
      <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
    </div>

    <div v-if="loading" class="workspace-grid">
      <Skeleton v-for="index in 4" :key="index" height="10.5rem" borderRadius="18px" />
    </div>

    <template v-else>
      <section class="workspace-grid" :aria-label="t('Events workspace')">
        <RouterLink v-for="card in workspaceCards" :key="card.key" :to="card.to" class="workspace-card" :class="`is-${card.tone}`">
          <div class="workspace-card__top"><span><i :class="card.icon" /></span><i class="pi pi-arrow-up-right" /></div>
          <p>{{ card.eyebrow }}</p>
          <div class="workspace-card__value"><h3>{{ card.title }}</h3><strong>{{ card.value }}</strong></div>
          <small>{{ card.note }}</small>
        </RouterLink>
      </section>

      <div class="event-overview__grid">
        <section class="event-panel">
          <div class="event-panel__head">
            <div><p>{{ t('Catalog readiness') }}</p><h3>{{ t('What clients can request') }}</h3></div>
            <span class="event-panel__count">{{ activeServices }}/{{ services.length }}</span>
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
        </section>

        <section class="event-panel">
          <div class="event-panel__head">
            <div><p>{{ t('Needs attention') }}</p><h3>{{ t('Planning checklist') }}</h3></div>
          </div>
          <div class="attention-list">
            <RouterLink v-for="item in attentionItems" :key="item.label" :to="item.to" :class="`is-${item.tone}`">
              <span><i :class="item.icon" /></span><strong>{{ item.label }}</strong><b>{{ item.value }}</b><i class="pi pi-arrow-right" />
            </RouterLink>
          </div>
        </section>
      </div>

      <section class="event-panel upcoming-panel">
        <div class="event-panel__head">
          <div><p>{{ t('Event calendar') }}</p><h3>{{ t('Upcoming client events') }}</h3></div>
          <Button as="router-link" to="/admin/event-requests" :label="t('View all requests')" icon="pi pi-arrow-right" severity="secondary" text />
        </div>
        <div v-if="upcomingRequests.length" class="request-list">
          <article v-for="request in upcomingRequests" :key="request.id">
            <span class="request-list__date"><i class="pi pi-calendar" />{{ formatDateTime(request.event_start, localeCode) }}</span>
            <span class="request-list__main">
              <strong>{{ enumLabel(request.event_type) }}</strong>
              <small>{{ request.customer_name || t('Customer') }} · {{ request.request_number }}</small>
            </span>
            <span class="request-list__amount">{{ requestAmount(request) }}</span>
            <Tag :value="enumLabel(request.status)" :severity="statusSeverity(request.status)" />
          </article>
        </div>
        <div v-else class="event-empty"><i class="pi pi-calendar" /><span>{{ t('No upcoming event requests.') }}</span></div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.event-overview { display: grid; gap: 18px; }
.event-hero { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 24px; overflow: hidden; padding: clamp(24px, 4vw, 38px); border: 1px solid rgba(255,255,255,.08); border-radius: 24px; background: radial-gradient(circle at 88% -10%, rgba(201,146,44,.36), transparent 38%), linear-gradient(135deg, var(--tm-charcoal), #2a2220); box-shadow: var(--tm-shadow); }
.event-hero::after { position: absolute; right: -58px; bottom: -125px; width: 270px; height: 270px; border: 1px solid rgba(206,107,85,.28); border-radius: 50%; content: ''; }
.event-hero__copy, .event-hero__actions { position: relative; z-index: 1; }
.event-hero p, .event-panel__head p, .workspace-card > p { margin: 0; color: var(--tm-gold); font-size: .72rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
.event-hero h2 { max-width: 760px; margin: 8px 0 9px; color: #fff8ed; font-size: clamp(2rem, 4vw, 3.7rem); letter-spacing: -.048em; line-height: .98; }
.event-hero__copy > span { display: block; max-width: 760px; color: rgba(255,255,255,.64); line-height: 1.55; }
.event-hero__actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 9px; }
.event-hero__actions :deep(.p-button-secondary) { border-color: rgba(255,255,255,.2); color: #fff; }
.event-error { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border: 1px solid rgba(206,107,85,.28); border-radius: 14px; background: rgba(206,107,85,.08); color: var(--tm-coral); font-weight: 800; }
.event-error span { display: flex; align-items: center; gap: 8px; }
.workspace-grid { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0,1fr)); }
.workspace-card { --accent: var(--tm-gold); --wash: rgba(201,146,44,.12); display: grid; min-height: 170px; gap: 8px; padding: 18px; border: 1px solid var(--tm-border); border-radius: 18px; background: radial-gradient(circle at 100% 0%, var(--wash), transparent 50%), var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); color: inherit; text-decoration: none; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
.workspace-card.is-emerald { --accent: var(--tm-emerald); --wash: rgba(12,155,128,.12); } .workspace-card.is-blue { --accent: var(--tm-blue); --wash: rgba(49,92,112,.12); } .workspace-card.is-coral { --accent: var(--tm-coral); --wash: rgba(206,107,85,.12); }
.workspace-card:hover, .workspace-card:focus-visible { border-color: var(--accent); box-shadow: var(--tm-shadow-hover); outline: none; transform: translateY(-3px); }
.workspace-card__top, .workspace-card__value, .event-panel__head, .health-list__label { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.workspace-card__top > span { display: grid; width: 40px; height: 40px; border-radius: 13px; background: var(--accent); color: #fff; place-items: center; } .workspace-card__top > i { color: var(--accent); }
.workspace-card__value h3, .workspace-card__value strong { margin: 0; color: var(--tm-heading); } .workspace-card__value h3 { font-size: 1.08rem; } .workspace-card__value strong { font-size: 2rem; letter-spacing: -.05em; } .workspace-card small { margin-top: auto; color: var(--tm-muted); font-weight: 760; }
.event-overview__grid { display: grid; align-items: stretch; gap: 16px; grid-template-columns: minmax(0,1.15fr) minmax(280px,.85fr); }
.event-panel { display: grid; gap: 18px; padding: 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); }
.event-panel__head { align-items: flex-start; } .event-panel__head h3 { margin: 4px 0 0; color: var(--tm-heading); font-size: 1.15rem; letter-spacing: -.025em; }
.event-panel__count { display: grid; min-width: 48px; height: 38px; padding: 0 10px; border-radius: 12px; background: var(--tm-charcoal); color: #fff; font-weight: 900; place-items: center; }
.health-list { display: grid; gap: 16px; } .health-list article { display: grid; grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 11px; } .health-list__icon { display: grid; width: 38px; height: 38px; border-radius: 12px; background: var(--tm-surface-soft); color: var(--tm-coral); place-items: center; } .health-list__label strong { color: var(--tm-heading); font-size: .84rem; } .health-list__label span { color: var(--tm-muted); font-size: .78rem; font-weight: 800; } .health-list__track { height: 7px; margin-top: 7px; overflow: hidden; border-radius: 999px; background: var(--tm-surface-soft); } .health-list__track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--tm-coral), var(--tm-gold)); }
.attention-list { display: grid; gap: 10px; } .attention-list a { --attention: var(--tm-gold); display: grid; grid-template-columns: auto minmax(0,1fr) auto auto; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--tm-border); border-radius: 13px; color: inherit; text-decoration: none; } .attention-list a.is-coral { --attention: var(--tm-coral); } .attention-list a.is-blue { --attention: var(--tm-blue); } .attention-list a.is-emerald { --attention: var(--tm-emerald); } .attention-list a > span { display: grid; width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--attention) 12%, transparent); color: var(--attention); place-items: center; } .attention-list a strong { color: var(--tm-heading); font-size: .86rem; } .attention-list a b { color: var(--attention); font-size: 1.25rem; } .attention-list a > i { color: var(--tm-muted); font-size: .78rem; }
.upcoming-panel { overflow: hidden; } .request-list { display: grid; } .request-list article { display: grid; grid-template-columns: minmax(180px,.7fr) minmax(230px,1fr) auto auto; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--tm-border); } .request-list article:last-child { border-bottom: 0; } .request-list__date { display: flex; align-items: center; gap: 8px; color: var(--tm-muted); font-size: .82rem; font-weight: 780; } .request-list__date i { color: var(--tm-gold); } .request-list__main { display: grid; gap: 3px; } .request-list__main strong { color: var(--tm-heading); } .request-list__main small { color: var(--tm-muted); font-weight: 720; } .request-list__amount { color: var(--tm-heading); font-weight: 900; white-space: nowrap; }
.event-empty { display: grid; gap: 9px; place-items: center; padding: 24px; color: var(--tm-muted); font-weight: 800; } .event-empty i { color: var(--tm-gold); font-size: 1.5rem; }
@media (max-width: 1120px) { .workspace-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 920px) { .event-hero, .event-overview__grid { grid-template-columns: 1fr; } .event-hero__actions { justify-content: flex-start; } }
@media (max-width: 720px) { .workspace-grid { grid-template-columns: 1fr; } .event-hero__actions, .event-error { align-items: stretch; flex-direction: column; } .request-list article { grid-template-columns: 1fr auto; } .request-list__main, .request-list__date { grid-column: 1; } .request-list__amount, .request-list :deep(.p-tag) { grid-column: 2; } }
</style>
