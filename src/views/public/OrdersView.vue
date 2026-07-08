<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import {
  cancelMyBooking,
  cancelMyEventRequest,
  cancelMyOrder,
  getMyBooking,
  getMyEventRequest,
  getMyOrder,
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
const confirm = useConfirm();
const auth = useAuthStore();
const { t } = usePublicI18n();

// Per-tab API + field wiring, so the shared handlers stay branch-free.
const TYPES = {
  orders: { get: getMyOrder, cancel: cancelMyOrder, numberField: 'order_number' },
  bookings: { get: getMyBooking, cancel: cancelMyBooking, numberField: 'booking_number' },
  events: { get: getMyEventRequest, cancel: cancelMyEventRequest, numberField: 'request_number' },
};

const orders = ref([]);
const bookings = ref([]);
const events = ref([]);
const loading = ref(false);
const error = ref('');
const activeTab = ref(initialTab());

const detailOpen = ref(false);
const detailType = ref('orders');
const detailLoading = ref(false);
const detailError = ref('');
const detail = ref(null);

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

// --- detail dialog ---

async function openDetail(item) {
  detailType.value = activeTab.value;
  detailOpen.value = true;
  detailLoading.value = true;
  detailError.value = '';
  detail.value = null;
  try {
    detail.value = await TYPES[activeTab.value].get(item.id);
  } catch (err) {
    detailError.value = err?.message || t('Could not load details');
  } finally {
    detailLoading.value = false;
  }
}

const detailNumber = computed(() => detail.value?.[TYPES[detailType.value].numberField] || '');
const detailServices = computed(() => detail.value?.services || []);
const detailArtists = computed(() => detail.value?.artists || []);
const detailItems = computed(() => detail.value?.items || []);

const detailFacts = computed(() => {
  const it = detail.value;
  if (!it) {
    return [];
  }
  if (detailType.value === 'orders') {
    const rows = [
      { label: t('Fulfillment'), value: t(titleize(it.fulfillment_type)) },
      { label: t('Placed'), value: formatDateTime(it.created_at) },
    ];
    if (it.fulfillment_type === 'delivery') {
      if (it.ship_recipient_name) rows.push({ label: t('Recipient'), value: it.ship_recipient_name });
      if (it.ship_phone) rows.push({ label: t('Phone'), value: it.ship_phone });
      const line = [it.ship_line1, it.ship_line2, it.ship_city, it.ship_region, it.ship_country, it.ship_postal_code]
        .filter(Boolean)
        .join(', ');
      if (line) rows.push({ label: t('Address'), value: line });
    }
    if (it.note) rows.push({ label: t('Note'), value: it.note });
    return rows;
  }
  if (detailType.value === 'bookings') {
    const rows = [
      { label: t('Car'), value: it.car_name },
      { label: t('Category'), value: it.car_category || '-' },
      { label: t('Start'), value: formatDateTime(it.start_at) },
      { label: t('End'), value: formatDateTime(it.end_at) },
    ];
    if (it.pricing_model === 'cargo_distance') {
      rows.push({ label: t('Distance'), value: `${Number(it.distance_km || 0)} km` });
    } else {
      rows.push({ label: t('Days'), value: it.days });
      rows.push({ label: t('Daily rate'), value: formatMGA(Number(it.daily_rate_snapshot || 0)) });
    }
    rows.push({ label: t('Pickup'), value: it.pickup_location });
    if (it.dropoff_location) rows.push({ label: t('Dropoff'), value: it.dropoff_location });
    rows.push({ label: t('Contact'), value: it.contact_phone });
    if (it.driver) rows.push({ label: t('Driver'), value: `${it.driver.full_name} · ${it.driver.phone}` });
    if (it.note) rows.push({ label: t('Note'), value: it.note });
    return rows;
  }
  const rows = [
    { label: t('Event type'), value: t(titleize(it.event_type)) },
    { label: t('Start'), value: formatDateTime(it.event_start) },
  ];
  if (it.event_end) rows.push({ label: t('End'), value: formatDateTime(it.event_end) });
  rows.push({ label: t('Location'), value: it.location });
  if (it.guest_count !== null && it.guest_count !== undefined) rows.push({ label: t('Guests'), value: it.guest_count });
  if (it.budget) rows.push({ label: t('Budget'), value: formatMGA(Number(it.budget)) });
  rows.push({ label: t('Contact'), value: it.contact_phone });
  if (it.contact_email) rows.push({ label: t('Email'), value: it.contact_email });
  if (it.note) rows.push({ label: t('Note'), value: it.note });
  return rows;
});

const detailTotal = computed(() => {
  const it = detail.value;
  if (!it) {
    return '';
  }
  if (detailType.value === 'events') {
    return it.quoted_price ? formatMGA(Number(it.quoted_price)) : t('Pending quote');
  }
  return formatMGA(Number(detailType.value === 'orders' ? it.total : it.total_price || 0));
});

const canCancelDetail = computed(() => {
  const it = detail.value;
  if (!it) {
    return false;
  }
  if (detailType.value === 'orders') return canCancelOrder(it);
  if (detailType.value === 'bookings') return canCancelBooking(it);
  return canCancelEvent(it);
});

// --- cancellation (with confirmation) ---

function canCancelOrder(order) {
  return ['pending', 'confirmed'].includes(order.status);
}

function canCancelBooking(booking) {
  return ['confirmed', 'driver_assigned'].includes(booking.status);
}

function canCancelEvent(eventRequest) {
  return ['requested', 'reviewing', 'quoted', 'confirmed'].includes(eventRequest.status) && eventRequest.payment_status !== 'paid';
}

function canCancelItem(item) {
  if (activeTab.value === 'events') return canCancelEvent(item);
  return activeTab.value === 'orders' ? canCancelOrder(item) : canCancelBooking(item);
}

function requestCancel(item, type = activeTab.value) {
  confirm.require({
    header: t('Confirm cancellation'),
    message: t('Cancel {name}? This cannot be undone.', { name: item[TYPES[type].numberField] }),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('Yes, cancel'),
    rejectLabel: t('Keep it'),
    accept: () => performCancel(item, type),
  });
}

async function performCancel(item, type) {
  try {
    await TYPES[type].cancel(item.id);
    toast.add({ severity: 'success', summary: t('Cancelled'), detail: item[TYPES[type].numberField], life: 3000 });
    detailOpen.value = false;
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Cancel failed'), detail: err?.message || t('Request failed'), life: 4200 });
  }
}

// --- card display helpers ---

function itemEyebrow(item) {
  if (activeTab.value === 'events') return t(titleize(item.event_type));
  return activeTab.value === 'orders' ? t(titleize(item.fulfillment_type)) : item.car_name;
}

function itemTitle(item) {
  if (activeTab.value === 'events') return item.request_number;
  return activeTab.value === 'orders' ? item.order_number : item.booking_number;
}

function itemDate(item) {
  if (activeTab.value === 'events') return formatDate(item.event_start);
  if (activeTab.value === 'orders') return formatDateTime(item.created_at);
  return `${formatDate(item.start_at)} - ${formatDate(item.end_at)}`;
}

function itemTotal(item) {
  if (activeTab.value === 'events') {
    return item.quoted_price ? formatMGA(Number(item.quoted_price || 0)) : t('Pending quote');
  }
  return formatMGA(Number(activeTab.value === 'orders' ? item.total : item.total_price || 0));
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
          <article
            v-for="item in visibleItems"
            :key="`${activeTab}-${item.id}`"
            class="history-card"
            role="button"
            tabindex="0"
            @click="openDetail(item)"
            @keydown.enter="openDetail(item)"
          >
            <div class="history-card__main">
              <p>{{ itemEyebrow(item) }}</p>
              <h2>{{ itemTitle(item) }}</h2>
              <span>{{ itemDate(item) }}</span>
            </div>

            <div class="history-card__status">
              <Tag :value="labelStatus(item.status)" :severity="statusSeverity(item.status)" />
              <Tag :value="labelStatus(item.payment_status)" :severity="statusSeverity(item.payment_status)" />
            </div>

            <strong class="history-card__total">{{ itemTotal(item) }}</strong>

            <div class="history-card__actions" @click.stop>
              <Button
                v-if="canCancelItem(item)"
                :label="t('Cancel')"
                icon="pi pi-times"
                severity="danger"
                outlined
                @click="requestCancel(item)"
              />
              <span class="history-card__chevron" :aria-label="t('View details')"><i class="pi pi-chevron-right" /></span>
            </div>
          </article>
        </div>

        <div v-else class="history-state">
          <i class="pi pi-inbox" />
          <span>{{ emptyMessage }}</span>
          <Button as="router-link" :to="emptyCta.to" :label="emptyCta.label" :icon="emptyCta.icon" />
        </div>
      </template>
    </div>

    <!-- ============ DETAIL DIALOG ============ -->
    <Dialog
      v-model:visible="detailOpen"
      modal
      :header="detailNumber || t('Details')"
      :style="{ width: '640px', maxWidth: '94vw' }"
      :draggable="false"
    >
      <div v-if="detailLoading" class="dlg-state">
        <i class="pi pi-spin pi-spinner" /><span>{{ t('Loading...') }}</span>
      </div>

      <div v-else-if="detailError" class="dlg-state dlg-state--error">
        <i class="pi pi-exclamation-triangle" /><span>{{ detailError }}</span>
      </div>

      <div v-else-if="detail" class="dlg">
        <div class="dlg__tags">
          <Tag :value="labelStatus(detail.status)" :severity="statusSeverity(detail.status)" />
          <Tag :value="labelStatus(detail.payment_status)" :severity="statusSeverity(detail.payment_status)" />
        </div>

        <dl class="dlg__facts">
          <div v-for="fact in detailFacts" :key="fact.label">
            <dt>{{ fact.label }}</dt>
            <dd>{{ fact.value }}</dd>
          </div>
        </dl>

        <!-- Order line items -->
        <section v-if="detailType === 'orders' && detailItems.length" class="dlg__section">
          <h4>{{ t('Items') }}</h4>
          <div v-for="line in detailItems" :key="line.id" class="dlg-line">
            <div>
              <strong>{{ line.product_name }}</strong>
              <small v-if="line.variant_label">{{ line.variant_label }}</small>
            </div>
            <span>{{ t('Qty') }} {{ line.quantity }} · {{ formatMGA(Number(line.unit_price || 0)) }}</span>
            <strong class="dlg-line__total">{{ formatMGA(Number(line.line_total || 0)) }}</strong>
          </div>
        </section>

        <!-- Event services -->
        <section v-if="detailType === 'events' && detailServices.length" class="dlg__section">
          <h4>{{ t('Requested services') }}</h4>
          <div v-for="svc in detailServices" :key="svc.id" class="dlg-line">
            <div>
              <strong>{{ svc.service_name }}</strong>
              <small v-if="svc.category_name">{{ svc.category_name }}</small>
            </div>
            <span>{{ t('Qty') }} {{ svc.quantity || 1 }}</span>
            <strong class="dlg-line__total">{{ svc.from_price_snapshot ? formatMGA(Number(svc.from_price_snapshot)) : '—' }}</strong>
          </div>
        </section>

        <!-- Event artists -->
        <section v-if="detailType === 'events' && detailArtists.length" class="dlg__section">
          <h4>{{ t('Requested artists') }}</h4>
          <div v-for="art in detailArtists" :key="art.id" class="dlg-line">
            <strong>{{ art.artist_name }}</strong>
            <span />
            <strong class="dlg-line__total">{{ art.fee_snapshot ? formatMGA(Number(art.fee_snapshot)) : '—' }}</strong>
          </div>
        </section>

        <div class="dlg__totals">
          <div v-if="detailType === 'orders'" class="dlg__totals-row">
            <span>{{ t('Subtotal') }}</span>
            <span>{{ formatMGA(Number(detail.subtotal || 0)) }}</span>
          </div>
          <div v-if="detailType === 'orders' && Number(detail.shipping_fee || 0) > 0" class="dlg__totals-row">
            <span>{{ t('Shipping') }}</span>
            <span>{{ formatMGA(Number(detail.shipping_fee || 0)) }}</span>
          </div>
          <div class="dlg__totals-row dlg__totals-row--grand">
            <span>{{ detailType === 'events' ? t('Quote') : t('Total') }}</span>
            <strong>{{ detailTotal }}</strong>
          </div>
        </div>

        <div v-if="canCancelDetail" class="dlg__actions">
          <Button
            :label="t('Cancel this request')"
            icon="pi pi-times"
            severity="danger"
            outlined
            @click="requestCancel(detail, detailType)"
          />
        </div>
      </div>
    </Dialog>
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
  cursor: pointer;
  transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.history-card:hover,
.history-card:focus-visible {
  border-color: rgba(8, 124, 104, 0.34);
  transform: translateY(-2px);
  outline: none;
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

.history-card__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.history-card__chevron {
  display: grid;
  place-items: center;
  color: var(--tm-muted);
}

.history-card:hover .history-card__chevron {
  color: var(--tm-emerald);
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

/* --- detail dialog --- */
.dlg-state {
  display: grid;
  min-height: 160px;
  place-items: center;
  gap: 10px;
  color: var(--tm-muted);
  font-weight: 820;
}

.dlg-state i {
  color: var(--tm-gold);
  font-size: 1.4rem;
}

.dlg-state--error i {
  color: var(--tm-coral);
}

.dlg {
  display: grid;
  gap: 18px;
}

.dlg__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dlg__facts {
  display: grid;
  gap: 10px;
  margin: 0;
}

.dlg__facts > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--tm-border);
}

.dlg__facts dt {
  color: var(--tm-muted);
  font-size: 0.85rem;
  font-weight: 850;
}

.dlg__facts dd {
  margin: 0;
  color: var(--tm-heading);
  font-weight: 780;
  text-align: right;
  overflow-wrap: anywhere;
}

.dlg__section h4 {
  margin: 0 0 10px;
  color: var(--tm-heading);
  font-size: 1rem;
}

.dlg-line {
  display: grid;
  align-items: center;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto auto;
  padding: 10px 0;
  border-bottom: 1px solid var(--tm-border);
}

.dlg-line > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.dlg-line strong {
  color: var(--tm-heading);
}

.dlg-line small {
  color: var(--tm-muted);
  font-size: 0.84rem;
}

.dlg-line span {
  color: var(--tm-muted);
  font-size: 0.86rem;
  white-space: nowrap;
}

.dlg-line__total {
  white-space: nowrap;
}

.dlg__totals {
  display: grid;
  gap: 8px;
  padding-top: 6px;
}

.dlg__totals-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--tm-muted);
  font-weight: 780;
}

.dlg__totals-row--grand {
  padding-top: 10px;
  border-top: 1px solid var(--tm-border);
  color: var(--tm-heading);
  font-size: 1.1rem;
}

.dlg__totals-row--grand strong {
  color: var(--tm-heading);
}

.dlg__actions {
  display: flex;
  justify-content: end;
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
    grid-template-columns: 1fr auto;
  }

  .history-card__total {
    grid-column: 1;
  }

  .history-card__actions {
    grid-column: 2;
    grid-row: 1 / 3;
  }
}
</style>
