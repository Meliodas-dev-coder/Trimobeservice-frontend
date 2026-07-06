<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import {
  cancelMyBooking,
  cancelMyEventRequest,
  cancelMyOrder,
  listMyBookings,
  listMyEventRequests,
  listMyOrders,
} from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatDateTime, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';

const route = useRoute();
const toast = useToast();
const auth = useAuthStore();
const { t } = usePublicI18n();

const orders = ref([]);
const bookings = ref([]);
const events = ref([]);
const loading = ref(false);
const error = ref('');
const activeTab = ref(initialTab());

const tabs = computed(() => [
  { label: t('Orders'), value: 'orders', icon: 'pi pi-receipt' },
  { label: t('Bookings'), value: 'bookings', icon: 'pi pi-calendar-clock' },
  { label: t('Events'), value: 'events', icon: 'pi pi-calendar' },
]);

const visibleItems = computed(() => {
  if (activeTab.value === 'events') {
    return events.value;
  }
  return activeTab.value === 'orders' ? orders.value : bookings.value;
});

const emptyCta = computed(() => {
  if (activeTab.value === 'events') {
    return { to: '/events', label: t('Plan an event'), icon: 'pi pi-calendar' };
  }
  if (activeTab.value === 'bookings') {
    return { to: '/cars', label: t('Browse cars'), icon: 'pi pi-car' };
  }
  return { to: '/phones', label: t('Browse products'), icon: 'pi pi-mobile' };
});

const emptyMessage = computed(() => {
  if (activeTab.value === 'events') {
    return t('No event requests found for this account.');
  }
  if (activeTab.value === 'bookings') {
    return t('No car bookings found for this account.');
  }
  return t('No product orders found for this account.');
});

function initialTab() {
  return ['orders', 'bookings', 'events'].includes(route.query.tab) ? route.query.tab : 'orders';
}

async function load() {
  if (!auth.isAuthenticated) {
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    const [orderRes, bookingRes, eventRes] = await Promise.all([
      listMyOrders({ limit: 50 }),
      listMyBookings({ limit: 50 }),
      listMyEventRequests({ limit: 50 }),
    ]);
    orders.value = orderRes.items || [];
    bookings.value = bookingRes.items || [];
    events.value = eventRes.items || [];
  } catch (err) {
    error.value = err?.message || t('Could not load history');
  } finally {
    loading.value = false;
  }
}

function canCancelOrder(order) {
  return ['pending', 'confirmed'].includes(order.status);
}

function canCancelBooking(booking) {
  return ['confirmed', 'driver_assigned'].includes(booking.status);
}

function canCancelEvent(eventRequest) {
  return ['requested', 'reviewing', 'quoted', 'confirmed'].includes(eventRequest.status) && eventRequest.payment_status !== 'paid';
}

async function cancelOrder(order) {
  try {
    await cancelMyOrder(order.id);
    toast.add({ severity: 'success', summary: t('Order cancelled'), detail: order.order_number, life: 3000 });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Cancel failed'), detail: err?.message || t('Request failed'), life: 4200 });
  }
}

async function cancelBooking(booking) {
  try {
    await cancelMyBooking(booking.id);
    toast.add({ severity: 'success', summary: t('Booking cancelled'), detail: booking.booking_number, life: 3000 });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Cancel failed'), detail: err?.message || t('Request failed'), life: 4200 });
  }
}

async function cancelEvent(eventRequest) {
  try {
    await cancelMyEventRequest(eventRequest.id);
    toast.add({ severity: 'success', summary: t('Event request cancelled'), detail: eventRequest.request_number, life: 3000 });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Cancel failed'), detail: err?.message || t('Request failed'), life: 4200 });
  }
}

function itemEyebrow(item) {
  if (activeTab.value === 'events') {
    return t(titleize(item.event_type));
  }
  return activeTab.value === 'orders' ? t(titleize(item.fulfillment_type)) : item.car_name;
}

function itemTitle(item) {
  if (activeTab.value === 'events') {
    return item.request_number;
  }
  return activeTab.value === 'orders' ? item.order_number : item.booking_number;
}

function itemDate(item) {
  if (activeTab.value === 'events') {
    return formatDate(item.event_start);
  }
  if (activeTab.value === 'orders') {
    return formatDateTime(item.created_at);
  }
  return `${formatDate(item.start_at)} - ${formatDate(item.end_at)}`;
}

function itemTotal(item) {
  if (activeTab.value === 'events') {
    return item.quoted_price ? formatMGA(Number(item.quoted_price || 0)) : t('Pending quote');
  }
  return formatMGA(Number(activeTab.value === 'orders' ? item.total : item.total_price || 0));
}

function canCancelItem(item) {
  if (activeTab.value === 'events') {
    return canCancelEvent(item);
  }
  return activeTab.value === 'orders' ? canCancelOrder(item) : canCancelBooking(item);
}

function cancelItem(item) {
  if (activeTab.value === 'events') {
    return cancelEvent(item);
  }
  return activeTab.value === 'orders' ? cancelOrder(item) : cancelBooking(item);
}

function labelStatus(value) {
  return t(titleize(value));
}

function titleize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

onMounted(load);
</script>

<template>
  <section class="orders-page">
    <div class="app-container">
      <header class="orders-hero">
        <div>
          <p class="eyebrow">{{ t('Account') }}</p>
          <h1>{{ t('Orders, bookings, and events') }}</h1>
          <p>{{ t('Track product fulfillment, car bookings, event requests, assisted payment status, and allowed cancellations.') }}</p>
        </div>
        <Button v-if="auth.isAuthenticated" icon="pi pi-refresh" :label="t('Refresh')" severity="secondary" outlined :loading="loading" @click="load" />
      </header>

      <section v-if="!auth.isAuthenticated" class="orders-auth soft-panel">
        <i class="pi pi-lock" />
        <div>
          <h2>{{ t('Sign in to view your history') }}</h2>
          <p>{{ t('Your orders, bookings, and event requests are linked to your customer account.') }}</p>
        </div>
        <Button as="router-link" :to="{ name: 'account', query: { redirect: '/orders' } }" :label="t('Sign in')" icon="pi pi-user" />
      </section>

      <template v-else>
        <div class="history-tabs" :aria-label="t('History type')">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            type="button"
            :class="{ 'is-active': activeTab === tab.value }"
            @click="activeTab = tab.value"
          >
            <i :class="tab.icon" />
            {{ tab.label }}
          </button>
        </div>

        <div v-if="error" class="history-state history-state--error">
          <i class="pi pi-exclamation-triangle" />
          <span>{{ error }}</span>
        </div>

        <div v-else-if="loading" class="history-list" aria-hidden="true">
          <Skeleton v-for="n in 3" :key="n" height="86px" borderRadius="8px" />
        </div>

        <div v-else-if="visibleItems.length" class="history-list">
          <article v-for="item in visibleItems" :key="`${activeTab}-${item.id}`" class="history-card">
            <div class="history-card__main">
              <p>{{ itemEyebrow(item) }}</p>
              <h2>{{ itemTitle(item) }}</h2>
              <span>{{ itemDate(item) }}</span>
            </div>

            <div class="history-card__status">
              <Tag :value="labelStatus(item.status)" :severity="statusSeverity(item.status)" />
              <Tag :value="labelStatus(item.payment_status)" :severity="statusSeverity(item.payment_status)" />
            </div>

            <strong class="history-card__total">
              {{ itemTotal(item) }}
            </strong>

            <Button
              v-if="canCancelItem(item)"
              :label="t('Cancel')"
              icon="pi pi-times"
              severity="danger"
              outlined
              @click="cancelItem(item)"
            />
          </article>
        </div>

        <div v-else class="history-state">
          <i class="pi pi-inbox" />
          <span>{{ emptyMessage }}</span>
          <Button
            as="router-link"
            :to="emptyCta.to"
            :label="emptyCta.label"
            :icon="emptyCta.icon"
          />
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.orders-page {
  padding: 48px 0 64px;
}

.orders-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 20px;
}

.orders-hero h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.4rem, 6vw, 5rem);
  line-height: 0.95;
}

.orders-hero p:not(.eyebrow),
.orders-auth p {
  max-width: 680px;
  color: var(--tm-muted);
  line-height: 1.65;
}

.orders-auth {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 18px;
  padding: 22px;
}

.orders-auth i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.orders-auth h2 {
  margin: 0;
  color: var(--tm-heading);
}

.orders-auth p {
  margin: 5px 0 0;
}

.history-tabs {
  display: inline-grid;
  grid-template-columns: repeat(3, minmax(140px, 1fr));
  gap: 6px;
  margin-bottom: 18px;
  padding: 5px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
}

.history-tabs button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 42px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--tm-muted);
  cursor: pointer;
  font-weight: 850;
}

.history-tabs button.is-active {
  background: var(--tm-emerald);
  color: #fff;
}

.history-list {
  display: grid;
  gap: 12px;
}

.history-card {
  display: grid;
  align-items: center;
  gap: 14px;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  padding: 16px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.history-card__main {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.history-card__main p {
  margin: 0;
  color: var(--tm-gold);
  font-size: 0.76rem;
  font-weight: 900;
  text-transform: uppercase;
}

.history-card__main h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.1rem;
}

.history-card__main span {
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 760;
}

.history-card__status {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.history-card__total {
  color: var(--tm-heading);
  white-space: nowrap;
}

.history-state {
  display: grid;
  min-height: 300px;
  place-items: center;
  gap: 10px;
  padding: 30px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  color: var(--tm-muted);
  font-weight: 850;
}

.history-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.history-state--error i {
  color: var(--tm-coral);
}

@media (max-width: 780px) {
  .orders-hero,
  .orders-auth {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .history-tabs {
    width: 100%;
  }

  .history-card {
    align-items: start;
    grid-template-columns: 1fr;
  }

  .history-card .p-button {
    width: 100%;
  }
}
</style>
