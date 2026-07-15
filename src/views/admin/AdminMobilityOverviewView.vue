<script setup>
import { computed, onMounted, ref } from 'vue';

import MobilityWorkspaceNav from '@/components/admin/MobilityWorkspaceNav.vue';
import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { formatDateTime, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';

const { enumLabel, localeCode, t } = useAdminI18n();

const loading = ref(true);
const error = ref('');
const categories = ref([]);
const cars = ref([]);
const carTotal = ref(0);
const drivers = ref([]);
const bookings = ref([]);
const bookingTotal = ref(0);

const activeCategories = computed(() => categories.value.filter((item) => item.is_active).length);
const availableCars = computed(() => cars.value.filter((item) => item.status === 'available').length);
const maintenanceCars = computed(() => cars.value.filter((item) => item.status === 'maintenance').length);
const availableDrivers = computed(() => drivers.value.filter((item) => item.status === 'available').length);
const activeBookings = computed(() => bookings.value.filter((item) => ['confirmed', 'driver_assigned', 'active'].includes(item.status)).length);
const bookingsWithoutDriver = computed(() => bookings.value.filter((item) => ['confirmed', 'active'].includes(item.status) && !item.driver_id).length);
const unpaidBookings = computed(() => bookings.value.filter((item) => item.payment_status === 'unpaid' && item.status !== 'cancelled').length);

const workspaceCards = computed(() => [
  {
    key: 'categories', icon: 'pi pi-sitemap', tone: 'gold', eyebrow: t('Fleet structure'),
    title: t('Car categories'), value: categories.value.length,
    note: t('{n} active', { n: activeCategories.value }), to: '/admin/car-categories',
  },
  {
    key: 'cars', icon: 'pi pi-car', tone: 'emerald', eyebrow: t('Fleet readiness'),
    title: t('Cars'), value: carTotal.value,
    note: t('{n} available now', { n: availableCars.value }), to: '/admin/cars',
  },
  {
    key: 'drivers', icon: 'pi pi-id-card', tone: 'blue', eyebrow: t('Dispatch team'),
    title: t('Drivers'), value: drivers.value.length,
    note: t('{n} ready to assign', { n: availableDrivers.value }), to: '/admin/drivers',
  },
  {
    key: 'bookings', icon: 'pi pi-calendar-clock', tone: 'coral', eyebrow: t('Rental operations'),
    title: t('Bookings'), value: bookingTotal.value,
    note: t('{n} currently active', { n: activeBookings.value }), to: '/admin/bookings',
  },
]);

const healthRows = computed(() => [
  { label: t('Available cars'), value: availableCars.value, total: cars.value.length, icon: 'pi pi-car' },
  { label: t('Available drivers'), value: availableDrivers.value, total: drivers.value.length, icon: 'pi pi-id-card' },
  { label: t('Active categories'), value: activeCategories.value, total: categories.value.length, icon: 'pi pi-sitemap' },
  {
    label: t('Bookings with a driver'),
    value: Math.max(activeBookings.value - bookingsWithoutDriver.value, 0),
    total: activeBookings.value,
    icon: 'pi pi-user-plus',
  },
]);

const attentionItems = computed(() => [
  { label: t('Bookings need a driver'), value: bookingsWithoutDriver.value, icon: 'pi pi-user-plus', tone: bookingsWithoutDriver.value ? 'coral' : 'emerald', to: '/admin/bookings' },
  { label: t('Bookings awaiting payment'), value: unpaidBookings.value, icon: 'pi pi-wallet', tone: unpaidBookings.value ? 'gold' : 'emerald', to: '/admin/bookings' },
  { label: t('Cars in maintenance'), value: maintenanceCars.value, icon: 'pi pi-wrench', tone: maintenanceCars.value ? 'blue' : 'emerald', to: '/admin/cars' },
]);

const upcomingBookings = computed(() => {
  const now = Date.now();
  return [...bookings.value]
    .filter((item) => item.status !== 'cancelled' && new Date(item.end_at || 0).getTime() >= now)
    .sort((a, b) => new Date(a.start_at || 0) - new Date(b.start_at || 0))
    .slice(0, 5);
});

function percent(row) {
  return row.total ? Math.round((row.value / row.total) * 100) : 0;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [categoryData, carData, driverData, bookingData] = await Promise.all([
      api.get('/admin/car-categories'),
      api.get('/admin/cars', { params: { limit: 100, page: 1 } }),
      api.get('/admin/drivers'),
      api.get('/admin/bookings', { params: { limit: 100, page: 1 } }),
    ]);
    categories.value = categoryData?.car_categories || [];
    cars.value = carData?.cars || [];
    carTotal.value = Number(carData?.meta?.total ?? cars.value.length);
    drivers.value = driverData?.drivers || [];
    bookings.value = bookingData?.bookings || [];
    bookingTotal.value = Number(bookingData?.meta?.total ?? bookings.value.length);
  } catch (err) {
    categories.value = [];
    cars.value = [];
    drivers.value = [];
    bookings.value = [];
    carTotal.value = 0;
    bookingTotal.value = 0;
    error.value = err?.message || t('Could not load Mobility operations');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="mobility-overview">
    <MobilityWorkspaceNav />

    <header class="mobility-hero">
      <div class="mobility-hero__copy">
        <p>{{ t('Mobility operations') }}</p>
        <h2>{{ t('Keep every trip ready to move.') }}</h2>
        <span>{{ t('Organize the fleet, see real availability, assign drivers, and follow every booking from confirmation to payment.') }}</span>
      </div>
      <div class="mobility-hero__actions">
        <Button as="router-link" to="/admin/cars" :label="t('Manage fleet')" icon="pi pi-car" />
        <Button as="router-link" to="/admin/bookings" :label="t('Open bookings')" icon="pi pi-calendar-clock" severity="secondary" outlined />
        <Button as="router-link" to="/cars" :label="t('View car rentals')" icon="pi pi-external-link" severity="secondary" outlined />
      </div>
    </header>

    <div v-if="error" class="mobility-error">
      <span><i class="pi pi-exclamation-circle" />{{ t(error) }}</span>
      <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
    </div>

    <div v-if="loading" class="workspace-grid">
      <Skeleton v-for="index in 4" :key="index" height="10.5rem" borderRadius="18px" />
    </div>

    <template v-else>
      <section class="workspace-grid" :aria-label="t('Mobility workspace')">
        <RouterLink v-for="card in workspaceCards" :key="card.key" :to="card.to" class="workspace-card" :class="`is-${card.tone}`">
          <div class="workspace-card__top"><span><i :class="card.icon" /></span><i class="pi pi-arrow-up-right" /></div>
          <p>{{ card.eyebrow }}</p>
          <div class="workspace-card__value"><h3>{{ card.title }}</h3><strong>{{ card.value }}</strong></div>
          <small>{{ card.note }}</small>
        </RouterLink>
      </section>

      <div class="mobility-overview__grid">
        <section class="mobility-panel">
          <div class="mobility-panel__head">
            <div><p>{{ t('Dispatch readiness') }}</p><h3>{{ t('What can move right now') }}</h3></div>
            <span class="mobility-panel__count">{{ availableCars }}/{{ cars.length }}</span>
          </div>
          <div class="health-list">
            <article v-for="row in healthRows" :key="row.label">
              <span class="health-list__icon"><i :class="row.icon" /></span>
              <div>
                <div class="health-list__label"><strong>{{ row.label }}</strong><span>{{ row.value }}/{{ row.total }}</span></div>
                <div class="health-list__track"><span :style="{ width: `${percent(row)}%` }" /></div>
              </div>
            </article>
          </div>
        </section>

        <section class="mobility-panel">
          <div class="mobility-panel__head">
            <div><p>{{ t('Needs attention') }}</p><h3>{{ t('Dispatch checklist') }}</h3></div>
          </div>
          <div class="attention-list">
            <RouterLink v-for="item in attentionItems" :key="item.label" :to="item.to" :class="`is-${item.tone}`">
              <span><i :class="item.icon" /></span><strong>{{ item.label }}</strong><b>{{ item.value }}</b><i class="pi pi-arrow-right" />
            </RouterLink>
          </div>
        </section>
      </div>

      <section class="mobility-panel upcoming-panel">
        <div class="mobility-panel__head">
          <div><p>{{ t('Schedule') }}</p><h3>{{ t('Upcoming and active bookings') }}</h3></div>
          <Button as="router-link" to="/admin/bookings" :label="t('View all bookings')" icon="pi pi-arrow-right" severity="secondary" text />
        </div>
        <div v-if="upcomingBookings.length" class="booking-list">
          <article v-for="booking in upcomingBookings" :key="booking.id">
            <span class="booking-list__date"><i class="pi pi-calendar" />{{ formatDateTime(booking.start_at, localeCode) }}</span>
            <span class="booking-list__main"><strong>{{ booking.car_name }}</strong><small>{{ booking.customer_name || t('Customer') }} · {{ booking.booking_number }}</small></span>
            <span class="booking-list__price">{{ formatMGA(Number(booking.total_price || 0)) }}</span>
            <Tag :value="enumLabel(booking.status)" :severity="statusSeverity(booking.status)" />
          </article>
        </div>
        <div v-else class="mobility-empty"><i class="pi pi-calendar" /><span>{{ t('No upcoming bookings.') }}</span></div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.mobility-overview { display: grid; gap: 18px; }
.mobility-hero { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 24px; overflow: hidden; padding: clamp(24px, 4vw, 38px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; background: radial-gradient(circle at 88% -10%, rgba(49, 92, 112, 0.52), transparent 38%), linear-gradient(135deg, var(--tm-charcoal), #17282a); box-shadow: var(--tm-shadow); }
.mobility-hero::after { position: absolute; right: -58px; bottom: -125px; width: 270px; height: 270px; border: 1px solid rgba(201, 146, 44, 0.24); border-radius: 50%; content: ''; }
.mobility-hero__copy, .mobility-hero__actions { position: relative; z-index: 1; }
.mobility-hero p, .mobility-panel__head p, .workspace-card > p { margin: 0; color: var(--tm-gold); font-size: .72rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
.mobility-hero h2 { max-width: 720px; margin: 8px 0 9px; color: #fff8ed; font-size: clamp(2rem, 4vw, 3.7rem); letter-spacing: -.048em; line-height: .98; }
.mobility-hero__copy > span { display: block; max-width: 720px; color: rgba(255,255,255,.64); line-height: 1.55; }
.mobility-hero__actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 9px; }
.mobility-hero__actions :deep(.p-button-secondary) { border-color: rgba(255,255,255,.2); color: #fff; }
.mobility-error { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border: 1px solid rgba(206,107,85,.28); border-radius: 14px; background: rgba(206,107,85,.08); color: var(--tm-coral); font-weight: 800; }
.mobility-error span { display: flex; align-items: center; gap: 8px; }
.workspace-grid { display: grid; gap: 14px; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.workspace-card { --accent: var(--tm-gold); --wash: rgba(201,146,44,.12); display: grid; min-height: 170px; gap: 8px; padding: 18px; border: 1px solid var(--tm-border); border-radius: 18px; background: radial-gradient(circle at 100% 0%, var(--wash), transparent 50%), var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); color: inherit; text-decoration: none; transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease; }
.workspace-card.is-emerald { --accent: var(--tm-emerald); --wash: rgba(12,155,128,.12); } .workspace-card.is-blue { --accent: var(--tm-blue); --wash: rgba(49,92,112,.12); } .workspace-card.is-coral { --accent: var(--tm-coral); --wash: rgba(206,107,85,.12); }
.workspace-card:hover, .workspace-card:focus-visible { border-color: var(--accent); box-shadow: var(--tm-shadow-hover); outline: none; transform: translateY(-3px); }
.workspace-card__top, .workspace-card__value, .mobility-panel__head, .health-list__label { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.workspace-card__top > span { display: grid; width: 40px; height: 40px; border-radius: 13px; background: var(--accent); color: #fff; place-items: center; } .workspace-card__top > i { color: var(--accent); }
.workspace-card__value h3, .workspace-card__value strong { margin: 0; color: var(--tm-heading); } .workspace-card__value h3 { font-size: 1.08rem; } .workspace-card__value strong { font-size: 2rem; letter-spacing: -.05em; } .workspace-card small { margin-top: auto; color: var(--tm-muted); font-weight: 760; }
.mobility-overview__grid { display: grid; align-items: stretch; gap: 16px; grid-template-columns: minmax(0, 1.15fr) minmax(280px, .85fr); }
.mobility-panel { display: grid; gap: 18px; padding: 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); }
.mobility-panel__head { align-items: flex-start; } .mobility-panel__head h3 { margin: 4px 0 0; color: var(--tm-heading); font-size: 1.15rem; letter-spacing: -.025em; }
.mobility-panel__count { display: grid; min-width: 48px; height: 38px; padding: 0 10px; border-radius: 12px; background: var(--tm-charcoal); color: #fff; font-weight: 900; place-items: center; }
.health-list { display: grid; gap: 16px; } .health-list article { display: grid; grid-template-columns: auto minmax(0,1fr); align-items: center; gap: 11px; } .health-list__icon { display: grid; width: 38px; height: 38px; border-radius: 12px; background: var(--tm-surface-soft); color: var(--tm-emerald); place-items: center; } .health-list__label strong { color: var(--tm-heading); font-size: .84rem; } .health-list__label span { color: var(--tm-muted); font-size: .78rem; font-weight: 800; } .health-list__track { height: 7px; margin-top: 7px; overflow: hidden; border-radius: 999px; background: var(--tm-surface-soft); } .health-list__track span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--tm-emerald), var(--tm-gold)); }
.attention-list { display: grid; gap: 10px; } .attention-list a { --attention: var(--tm-gold); display: grid; grid-template-columns: auto minmax(0,1fr) auto auto; align-items: center; gap: 10px; padding: 12px; border: 1px solid var(--tm-border); border-radius: 13px; color: inherit; text-decoration: none; } .attention-list a.is-coral { --attention: var(--tm-coral); } .attention-list a.is-blue { --attention: var(--tm-blue); } .attention-list a.is-emerald { --attention: var(--tm-emerald); } .attention-list a > span { display: grid; width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--attention) 12%, transparent); color: var(--attention); place-items: center; } .attention-list a strong { color: var(--tm-heading); font-size: .86rem; } .attention-list a b { color: var(--attention); font-size: 1.25rem; } .attention-list a > i { color: var(--tm-muted); font-size: .78rem; }
.upcoming-panel { overflow: hidden; } .booking-list { display: grid; } .booking-list article { display: grid; grid-template-columns: minmax(180px,.65fr) minmax(230px,1fr) auto auto; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--tm-border); } .booking-list article:last-child { border-bottom: 0; } .booking-list__date { display: flex; align-items: center; gap: 8px; color: var(--tm-muted); font-size: .82rem; font-weight: 780; } .booking-list__date i { color: var(--tm-gold); } .booking-list__main { display: grid; gap: 3px; } .booking-list__main strong { color: var(--tm-heading); } .booking-list__main small { color: var(--tm-muted); font-weight: 720; } .booking-list__price { color: var(--tm-heading); font-weight: 900; white-space: nowrap; }
.mobility-empty { display: grid; gap: 9px; place-items: center; padding: 24px; color: var(--tm-muted); font-weight: 800; } .mobility-empty i { color: var(--tm-gold); font-size: 1.5rem; }
@media (max-width: 1120px) { .workspace-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 920px) { .mobility-hero, .mobility-overview__grid { grid-template-columns: 1fr; } .mobility-hero__actions { justify-content: flex-start; } }
@media (max-width: 720px) { .workspace-grid { grid-template-columns: 1fr; } .mobility-hero__actions, .mobility-error { align-items: stretch; flex-direction: column; } .booking-list article { grid-template-columns: 1fr auto; } .booking-list__main, .booking-list__date { grid-column: 1; } .booking-list__price, .booking-list :deep(.p-tag) { grid-column: 2; } }
</style>
