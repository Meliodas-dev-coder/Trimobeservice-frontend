<script setup>
import { onMounted, ref } from 'vue';

import { api } from '@/api/client';
import { formatMGA } from '@/utils/format';

const stats = ref([
  { key: 'unpaidOrders', label: 'Unpaid orders', value: '—', trend: 'Awaiting payment', tone: 'gold' },
  { key: 'confirmBookings', label: 'Bookings to confirm', value: '—', trend: 'Assign a driver', tone: 'emerald' },
  { key: 'customers', label: 'Customers', value: '—', trend: 'Registered accounts', tone: 'blue' },
  { key: 'products', label: 'Products', value: '—', trend: 'In catalog', tone: 'coral' },
]);

const queue = ref([]);
const loading = ref(true);

async function totalOf(path, params = {}) {
  try {
    const data = await api.get(path, { params: { ...params, limit: 1 } });
    return data?.meta?.total ?? 0;
  } catch {
    return 0;
  }
}

function setStat(key, value) {
  const stat = stats.value.find((item) => item.key === key);
  if (stat) {
    stat.value = String(value);
  }
}

async function load() {
  loading.value = true;

  const [unpaidOrders, confirmBookings, customers, products] = await Promise.all([
    totalOf('/admin/orders', { payment_status: 'unpaid' }),
    totalOf('/admin/bookings', { status: 'confirmed' }),
    totalOf('/admin/customers'),
    totalOf('/admin/products'),
  ]);
  setStat('unpaidOrders', unpaidOrders);
  setStat('confirmBookings', confirmBookings);
  setStat('customers', customers);
  setStat('products', products);

  const items = [];
  try {
    const orders = await api.get('/admin/orders', { params: { payment_status: 'unpaid', limit: 4 } });
    (orders?.orders ?? []).forEach((order) => {
      items.push({
        id: order.order_number,
        type: 'Order',
        detail: `${prettify(order.fulfillment_type)} · ${formatMGA(Number(order.total || 0))}`,
        status: prettify(order.status),
      });
    });
  } catch {
    // ignore — dashboard degrades gracefully when the API is unavailable
  }
  try {
    const bookings = await api.get('/admin/bookings', { params: { status: 'confirmed', limit: 4 } });
    (bookings?.bookings ?? []).forEach((booking) => {
      items.push({
        id: booking.booking_number,
        type: 'Booking',
        detail: booking.car_name,
        status: 'Assign driver',
      });
    });
  } catch {
    // ignore
  }

  queue.value = items;
  loading.value = false;
}

function prettify(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

onMounted(load);
</script>

<template>
  <section class="admin-dashboard">
    <div class="stat-grid">
      <article v-for="stat in stats" :key="stat.label" class="stat-card" :class="`stat-card--${stat.tone}`">
        <span>{{ stat.label }}</span>
        <strong>{{ stat.value }}</strong>
        <p>{{ stat.trend }}</p>
      </article>
    </div>

    <div class="dashboard-grid">
      <section class="ops-panel">
        <div class="ops-panel__header">
          <div>
            <p>Queue</p>
            <h2>Needs attention</h2>
          </div>
          <Button as="router-link" to="/admin/orders" label="View orders" icon="pi pi-arrow-up-right" outlined />
        </div>

        <div class="queue-list">
          <article v-for="item in queue" :key="item.id" class="queue-row">
            <div>
              <strong>{{ item.id }}</strong>
              <span>{{ item.type }}</span>
            </div>
            <div>
              <strong>{{ item.detail }}</strong>
            </div>
            <Tag :value="item.status" severity="warn" />
          </article>

          <p v-if="!loading && !queue.length" class="queue-empty">Nothing needs attention right now.</p>
          <p v-else-if="loading" class="queue-empty">Loading…</p>
        </div>
      </section>

      <aside class="ops-panel ops-panel--dark">
        <div class="ops-panel__header">
          <div>
            <p>Workflow</p>
            <h2>Manual payment first</h2>
          </div>
        </div>

        <div class="workflow-list">
          <span><i class="pi pi-shopping-bag" /> Create order or booking</span>
          <span><i class="pi pi-truck" /> Deliver or hand over</span>
          <span><i class="pi pi-wallet" /> Record offline payment</span>
          <span><i class="pi pi-id-card" /> Assign driver for bookings</span>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.admin-dashboard {
  display: grid;
  gap: 24px;
}

.stat-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.stat-card {
  display: grid;
  gap: 8px;
  min-height: 142px;
  align-content: end;
  padding: 18px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.stat-card span {
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 800;
}

.stat-card strong {
  color: var(--tm-heading);
  font-size: 2.4rem;
  line-height: 0.95;
}

.stat-card p {
  margin: 0;
  font-weight: 800;
}

.stat-card--gold p {
  color: var(--tm-gold);
}

.stat-card--emerald p {
  color: var(--tm-emerald);
}

.stat-card--coral p {
  color: var(--tm-coral);
}

.stat-card--blue p {
  color: var(--tm-blue);
}

.dashboard-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 0.45fr);
}

.ops-panel {
  display: grid;
  gap: 18px;
  padding: 22px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.ops-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.ops-panel__header p,
.ops-panel__header h2 {
  margin: 0;
}

.ops-panel__header p {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ops-panel__header h2 {
  margin-top: 5px;
  color: var(--tm-heading);
}

.queue-list {
  display: grid;
}

.queue-row {
  display: grid;
  align-items: center;
  gap: 18px;
  grid-template-columns: 160px minmax(0, 1fr) auto;
  min-height: 74px;
  padding: 14px 0;
  border-top: 1px solid var(--tm-border);
}

.queue-row div {
  display: grid;
  gap: 4px;
}

.queue-row strong {
  color: var(--tm-heading);
}

.queue-row span {
  color: var(--tm-muted);
  font-size: 0.9rem;
}

.queue-empty {
  padding: 18px 0 2px;
  color: var(--tm-muted);
  font-weight: 700;
}

.ops-panel--dark {
  color: #fff;
  background:
    linear-gradient(160deg, rgba(8, 124, 104, 0.24), transparent 52%),
    var(--tm-charcoal);
}

.ops-panel--dark .ops-panel__header h2 {
  color: #fff;
}

.workflow-list {
  display: grid;
  gap: 12px;
}

.workflow-list span {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 12px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.78);
  font-weight: 760;
}

.workflow-list i {
  color: var(--tm-gold);
}

@media (max-width: 1120px) {
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .stat-grid {
    grid-template-columns: 1fr;
  }

  .queue-row {
    align-items: start;
    grid-template-columns: 1fr;
  }
}
</style>
