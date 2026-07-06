<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getMyOrder } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = usePublicI18n();

const order = ref(null);
const loading = ref(false);
const error = ref('');

const isPickup = computed(() => order.value?.fulfillment_type === 'pickup');
const deliveryAddress = computed(() => {
  const o = order.value;
  if (!o?.ship_line1) {
    return '';
  }
  return [o.ship_line1, o.ship_line2, o.ship_city, o.ship_region, o.ship_country].filter(Boolean).join(', ');
});

const nextSteps = computed(() => {
  if (!order.value) {
    return [];
  }
  if (isPickup.value) {
    return [
      {
        icon: 'pi pi-box',
        title: 'Your items are reserved',
        text: order.value.reserved_until
          ? t('Stock is held for you until {date}. After that the reservation expires automatically.', {
              date: formatDateTime(order.value.reserved_until),
            })
          : t('Stock is held for you for 24 hours, then the reservation expires automatically.'),
      },
      {
        icon: 'pi pi-map-marker',
        title: 'Pick up at the shop',
        text: 'Bring your order number and collect your items at the Trimobe shop.',
      },
      {
        icon: 'pi pi-wallet',
        title: 'Pay on collection',
        text: 'Pay by cash, bank transfer, or mobile money when you pick up. Our team confirms the payment on the spot.',
      },
    ];
  }
  return [
    {
      icon: 'pi pi-truck',
      title: 'We prepare your delivery',
      text: deliveryAddress.value
        ? t('Your order will be delivered to {address}.', { address: deliveryAddress.value })
        : t('Your order will be delivered to the address you provided.'),
    },
    {
      icon: 'pi pi-wallet',
      title: 'Pay on delivery',
      text: 'Pay by cash, bank transfer, or mobile money when the order is handed over. Our team confirms the payment afterwards.',
    },
    {
      icon: 'pi pi-receipt',
      title: 'Track it anytime',
      text: 'Follow the fulfillment and payment status from your orders page.',
    },
  ];
});

async function load() {
  if (!auth.isAuthenticated) {
    router.replace({ name: 'account', query: { redirect: route.fullPath } });
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    order.value = await getMyOrder(route.params.id);
  } catch (err) {
    order.value = null;
    error.value = err?.message || t('Could not load order');
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.params.id,
  () => load(),
);

onMounted(load);

function titleize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}
</script>

<template>
  <section class="confirm-page">
    <div class="app-container confirm-page__inner">
      <div v-if="loading" class="confirm-state">
        <i class="pi pi-spin pi-spinner" />
        <span>{{ t('Loading order...') }}</span>
      </div>

      <div v-else-if="error" class="confirm-state confirm-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button as="router-link" to="/orders" :label="t('Go to my orders')" icon="pi pi-receipt" severity="secondary" outlined />
      </div>

      <template v-else-if="order">
        <header class="confirm-hero">
          <span class="confirm-hero__badge"><i class="pi pi-check" /></span>
          <p class="eyebrow">{{ t('Order placed') }}</p>
          <h1>{{ t('Thank you - your order is in.') }}</h1>
          <p class="confirm-hero__number">
            {{ t('Order') }} <strong>{{ order.order_number }}</strong> · {{ formatDateTime(order.created_at) }}
          </p>
          <div class="confirm-hero__tags">
            <Tag :value="t(titleize(order.status))" :severity="statusSeverity(order.status)" />
            <Tag :value="t(titleize(order.payment_status))" :severity="statusSeverity(order.payment_status)" />
            <Tag :value="isPickup ? t('Pickup on site') : t('Delivery')" severity="info" />
          </div>
        </header>

        <div class="confirm-grid">
          <section class="confirm-card soft-panel">
            <h2>{{ t('Your items') }}</h2>
            <ul class="confirm-lines">
              <li v-for="item in order.items || []" :key="item.id">
                <div>
                  <strong>{{ item.product_name }}</strong>
                  <span>{{ item.variant_label || item.sku }} · {{ item.quantity }} × {{ formatMGA(Number(item.unit_price || 0)) }}</span>
                </div>
                <strong>{{ formatMGA(Number(item.line_total || 0)) }}</strong>
              </li>
            </ul>
            <div class="confirm-totals">
              <div><span>{{ t('Subtotal') }}</span><strong>{{ formatMGA(Number(order.subtotal || 0)) }}</strong></div>
              <div v-if="Number(order.shipping_fee)"><span>{{ t('Shipping') }}</span><strong>{{ formatMGA(Number(order.shipping_fee)) }}</strong></div>
              <div class="confirm-totals__grand"><span>{{ t('Total') }}</span><strong>{{ formatMGA(Number(order.total || 0)) }}</strong></div>
            </div>
          </section>

          <section class="confirm-card soft-panel">
            <h2>{{ t('What happens next') }}</h2>
            <ol class="confirm-steps">
              <li v-for="(step, index) in nextSteps" :key="index">
                <i :class="step.icon" />
                <div>
                  <strong>{{ t(step.title) }}</strong>
                  <p>{{ t(step.text) }}</p>
                </div>
              </li>
            </ol>
          </section>
        </div>

        <div class="confirm-actions">
          <Button as="router-link" to="/orders" :label="t('View my orders')" icon="pi pi-receipt" />
          <Button as="router-link" to="/phones" :label="t('Continue shopping')" icon="pi pi-mobile" severity="secondary" outlined />
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.confirm-page {
  padding: 48px 0 72px;
}

.confirm-page__inner {
  display: grid;
  gap: 24px;
}

.confirm-state {
  display: grid;
  min-height: 320px;
  place-items: center;
  gap: 12px;
  color: var(--tm-muted);
  font-weight: 850;
}

.confirm-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.confirm-state--error i {
  color: var(--tm-coral);
}

.confirm-hero {
  display: grid;
  gap: 8px;
  justify-items: start;
}

.confirm-hero__badge {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  margin-bottom: 6px;
  border-radius: 999px;
  background: rgba(8, 124, 104, 0.12);
  color: var(--tm-emerald);
  font-size: 1.5rem;
}

.confirm-hero h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2rem, 5vw, 3.6rem);
  line-height: 1;
}

.confirm-hero__number {
  margin: 0;
  color: var(--tm-muted);
  font-weight: 780;
}

.confirm-hero__number strong {
  color: var(--tm-heading);
}

.confirm-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.confirm-grid {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.confirm-card {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.confirm-card h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.15rem;
}

.confirm-lines {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.confirm-lines li {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--tm-border);
}

.confirm-lines li > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.confirm-lines strong {
  color: var(--tm-heading);
}

.confirm-lines span {
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 760;
}

.confirm-totals {
  display: grid;
  gap: 8px;
}

.confirm-totals > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.confirm-totals span {
  color: var(--tm-muted);
  font-weight: 800;
}

.confirm-totals strong {
  color: var(--tm-heading);
}

.confirm-totals__grand {
  padding-top: 8px;
  border-top: 1px solid var(--tm-border);
  font-size: 1.08rem;
}

.confirm-steps {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.confirm-steps li {
  display: grid;
  align-items: start;
  gap: 12px;
  grid-template-columns: auto 1fr;
}

.confirm-steps i {
  margin-top: 3px;
  color: var(--tm-gold);
  font-size: 1.15rem;
}

.confirm-steps strong {
  color: var(--tm-heading);
}

.confirm-steps p {
  margin: 3px 0 0;
  color: var(--tm-muted);
  font-size: 0.92rem;
  line-height: 1.6;
}

.confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 880px) {
  .confirm-grid {
    grid-template-columns: 1fr;
  }
}
</style>
