<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import GooglePlaceInput from '@/components/GooglePlaceInput.vue';
import { listAddresses } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { formatMGA } from '@/utils/format';

const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const cart = useCartStore();
const { t } = usePublicI18n();

const loading = ref(false);
const checkingOut = ref(false);
const error = ref('');
const checkoutErrors = ref({});
const savedAddress = ref(null);

const checkout = reactive({
  fulfillment_type: 'pickup',
  note: '',
});

const address = reactive({
  recipient_name: '',
  phone: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  country: 'Madagascar',
  postal_code: '',
});

const fulfillmentOptions = computed(() => [
  { label: t('Pickup on site'), value: 'pickup' },
  { label: t('Delivery'), value: 'delivery' },
]);

const isDelivery = computed(() => checkout.fulfillment_type === 'delivery');
const canCheckout = computed(() => {
  if (!auth.isAuthenticated || !cart.hasItems || checkingOut.value) {
    return false;
  }
  if (!isDelivery.value) {
    return true;
  }
  return ['recipient_name', 'phone', 'line1', 'city', 'country'].every((key) => String(address[key] || '').trim());
});

function resetDeliveryAddress() {
  Object.assign(address, {
    recipient_name: auth.user?.full_name || '',
    phone: auth.user?.phone || '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    country: 'Madagascar',
    postal_code: '',
  });
}

function fillDeliveryAddress(saved) {
  if (!saved) {
    resetDeliveryAddress();
    return;
  }
  Object.assign(address, {
    recipient_name: saved.recipient_name || auth.user?.full_name || '',
    phone: saved.phone || auth.user?.phone || '',
    line1: saved.line1 || '',
    line2: saved.line2 || '',
    city: saved.city || '',
    region: saved.region || '',
    country: saved.country || 'Madagascar',
    postal_code: saved.postal_code || '',
  });
}

function applyDeliveryPlace(selection) {
  const selectedAddress = selection?.address;
  if (!selectedAddress) {
    address.city = '';
    address.region = '';
    address.postal_code = '';
    return;
  }
  address.line1 = selectedAddress.line1 || selectedAddress.formatted_address || selection.value || address.line1;
  if (selectedAddress.line2 && !address.line2) {
    address.line2 = selectedAddress.line2;
  }
  address.city = selectedAddress.city || '';
  address.region = selectedAddress.region || '';
  address.country = selectedAddress.country || 'Madagascar';
  address.postal_code = selectedAddress.postal_code || '';
}

async function loadSavedAddress() {
  if (!auth.isAuthenticated) {
    savedAddress.value = null;
    resetDeliveryAddress();
    return;
  }
  try {
    const addresses = await listAddresses();
    const preferred = addresses.find((item) => item.is_default) || addresses[0] || null;
    savedAddress.value = preferred;
    fillDeliveryAddress(preferred);
  } catch {
    savedAddress.value = null;
    resetDeliveryAddress();
  }
}

async function loadCart() {
  loading.value = true;
  error.value = '';
  try {
    await cart.sync();
  } catch (err) {
    error.value = err?.message || t('Could not load cart');
  } finally {
    loading.value = false;
  }
  if (auth.isAuthenticated) {
    await loadSavedAddress();
  } else {
    savedAddress.value = null;
    resetDeliveryAddress();
  }
}

async function updateQuantity(item, quantity) {
  const next = Number(quantity || 1);
  if (next === item.quantity || next < 1) {
    return;
  }
  try {
    await cart.updateItem(item.id, next);
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Quantity not updated'), detail: err?.message || t('Request failed'), life: 3600 });
  }
}

async function removeItem(item) {
  try {
    await cart.removeItem(item.id);
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Item not removed'), detail: err?.message || t('Request failed'), life: 3600 });
  }
}

async function clearCart() {
  try {
    await cart.clear();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Cart not cleared'), detail: err?.message || t('Request failed'), life: 3600 });
  }
}

function cleanAddress() {
  return {
    recipient_name: address.recipient_name.trim(),
    phone: address.phone.trim(),
    line1: address.line1.trim(),
    line2: address.line2.trim() || null,
    city: address.city.trim(),
    region: address.region.trim() || null,
    country: address.country.trim(),
    postal_code: address.postal_code.trim() || null,
  };
}

async function submitCheckout() {
  if (!canCheckout.value) {
    return;
  }
  checkingOut.value = true;
  checkoutErrors.value = {};
  try {
    const body = {
      fulfillment_type: checkout.fulfillment_type,
    };
    if (checkout.note.trim()) {
      body.note = checkout.note.trim();
    }
    if (isDelivery.value) {
      body.shipping_address = cleanAddress();
    }
    const order = await cart.checkout(body);
    toast.add({ severity: 'success', summary: t('Order placed'), detail: order?.order_number || '', life: 3200 });
    if (order?.id) {
      router.push({ name: 'order-confirmation', params: { id: order.id } });
    } else {
      router.push({ name: 'orders' });
    }
  } catch (err) {
    checkoutErrors.value = err?.details || {};
    toast.add({ severity: 'error', summary: t('Checkout failed'), detail: err?.message || t('Request failed'), life: 4600 });
  } finally {
    checkingOut.value = false;
  }
}

watch(
  () => auth.isAuthenticated,
  () => loadCart(),
);

onMounted(loadCart);
</script>

<template>
  <section class="cart-page">
    <div class="app-container">
      <header class="cart-hero">
        <div>
          <p class="eyebrow">{{ t('Checkout') }}</p>
          <h1>{{ t('Your cart') }}</h1>
          <p>{{ t('Review live prices, choose pickup or delivery, then place an assisted-payment order.') }}</p>
        </div>
        <div class="cart-total soft-panel">
          <span>{{ cart.itemCount }}</span>
          <strong>{{ cart.itemCount === 1 ? t('item') : t('items') }}</strong>
        </div>
      </header>

      <div class="cart-layout">
        <section class="cart-lines">
          <div v-if="loading" class="line-list" aria-hidden="true">
            <Skeleton v-for="n in 2" :key="n" height="78px" borderRadius="8px" />
          </div>

          <div v-else-if="error" class="cart-state cart-state--error">
            <i class="pi pi-exclamation-triangle" />
            <span>{{ error }}</span>
          </div>

          <div v-else-if="cart.items.length" class="line-list">
            <article v-for="item in cart.items" :key="item.id" class="line-item">
              <div class="line-item__main">
                <strong>{{ item.product_name }}</strong>
                <span>{{ item.variant_label || item.sku }}</span>
                <small>{{ item.in_stock }} {{ t('in stock') }}</small>
              </div>
              <span class="line-item__price">{{ formatMGA(Number(item.unit_price || 0)) }}</span>
              <InputNumber
                :modelValue="item.quantity"
                :min="1"
                :max="item.in_stock || undefined"
                showButtons
                fluid
                @update:modelValue="updateQuantity(item, $event)"
              />
              <strong class="line-item__total">{{ formatMGA(Number(item.line_total || 0)) }}</strong>
              <Button icon="pi pi-trash" severity="danger" text rounded :aria-label="t('Remove item')" @click="removeItem(item)" />
            </article>
            <Button :label="t('Clear cart')" icon="pi pi-trash" severity="secondary" outlined @click="clearCart" />
          </div>

          <div v-else class="cart-state">
            <i class="pi pi-shopping-bag" />
            <span>{{ t('Your cart is empty.') }}</span>
            <Button as="router-link" to="/phones" :label="t('Browse products')" icon="pi pi-mobile" />
          </div>
        </section>

        <aside class="checkout-panel soft-panel">
          <h2>{{ t('Order summary') }}</h2>
          <div class="summary-row">
            <span>{{ t('Subtotal') }}</span>
            <strong>{{ formatMGA(cart.subtotal) }}</strong>
          </div>
          <div class="summary-row">
            <span>{{ t('Payment') }}</span>
            <strong>{{ t('Assisted confirmation') }}</strong>
          </div>

          <div v-if="!auth.isAuthenticated" class="cart-auth">
            <i class="pi pi-lock" />
            <div>
              <h3>{{ t('Sign in to place your order') }}</h3>
              <p>{{ t('Your cart stays in this browser and moves to your account when you sign in.') }}</p>
            </div>
            <Button as="router-link" :to="{ name: 'account', query: { redirect: '/cart' } }" :label="t('Sign in')" icon="pi pi-user" fluid />
          </div>

          <template v-else>
          <label>
            <span>{{ t('Fulfillment') }}</span>
            <Select v-model="checkout.fulfillment_type" :options="fulfillmentOptions" optionLabel="label" optionValue="value" fluid />
          </label>

          <div v-if="isDelivery" class="address-grid">
            <p v-if="savedAddress" class="checkout-panel__hint address-grid__wide">
              {{ t('Using saved address: {address}', { address: savedAddress.label || savedAddress.city }) }}
            </p>
            <label>
              <span>{{ t('Recipient name*') }}</span>
              <InputText v-model="address.recipient_name" />
              <small v-if="checkoutErrors['shipping_address.recipient_name']">{{ checkoutErrors['shipping_address.recipient_name'] }}</small>
            </label>
            <label>
              <span>{{ t('Phone') }}*</span>
              <InputText v-model="address.phone" />
              <small v-if="checkoutErrors['shipping_address.phone']">{{ checkoutErrors['shipping_address.phone'] }}</small>
            </label>
            <label class="address-grid__wide">
              <span>{{ t('Address line 1*') }}</span>
              <GooglePlaceInput v-model="address.line1" @place-select="applyDeliveryPlace" />
              <small v-if="checkoutErrors['shipping_address.line1']">{{ checkoutErrors['shipping_address.line1'] }}</small>
            </label>
            <label class="address-grid__wide">
              <span>{{ t('Address line 2') }}</span>
              <InputText v-model="address.line2" />
            </label>
            <label>
              <span>{{ t('City*') }}</span>
              <InputText v-model="address.city" />
              <small v-if="checkoutErrors['shipping_address.city']">{{ checkoutErrors['shipping_address.city'] }}</small>
            </label>
            <label>
              <span>{{ t('Region') }}</span>
              <InputText v-model="address.region" />
            </label>
            <label>
              <span>{{ t('Country*') }}</span>
              <InputText v-model="address.country" />
            </label>
            <label>
              <span>{{ t('Postal code') }}</span>
              <InputText v-model="address.postal_code" />
            </label>
          </div>

          <label>
            <span>{{ t('Note') }}</span>
            <Textarea v-model="checkout.note" rows="3" autoResize />
          </label>

          <Button
            :label="t('Place order')"
            icon="pi pi-check"
            :loading="checkingOut"
            :disabled="!canCheckout"
            @click="submitCheckout"
          />
          </template>
        </aside>
      </div>
    </div>
  </section>
</template>

<style scoped>
.cart-page {
  padding: 48px 0 64px;
}

.cart-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 22px;
}

.cart-hero h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.6rem, 7vw, 5.6rem);
  line-height: 0.92;
}

.cart-hero p:not(.eyebrow) {
  max-width: 640px;
  color: var(--tm-muted);
  line-height: 1.65;
}

.cart-total {
  display: grid;
  min-width: 154px;
  gap: 4px;
  padding: 18px;
}

.cart-total span {
  color: var(--tm-heading);
  font-size: 2rem;
  font-weight: 950;
}

.cart-total strong {
  color: var(--tm-muted);
  text-transform: uppercase;
}

.cart-auth {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
}

.cart-auth i {
  color: var(--tm-gold);
  font-size: 1.4rem;
}

.cart-auth h3,
.checkout-panel h2 {
  margin: 0;
  color: var(--tm-heading);
}

.cart-auth p {
  margin: 5px 0 0;
  color: var(--tm-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.cart-layout {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) minmax(330px, 0.42fr);
}

.cart-lines,
.checkout-panel {
  display: grid;
  gap: 14px;
}

.line-list {
  display: grid;
  gap: 12px;
}

.line-item {
  display: grid;
  align-items: center;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto 132px auto auto;
  padding: 14px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.line-item__main {
  display: grid;
  gap: 4px;
}

.line-item__main strong,
.line-item__total {
  color: var(--tm-heading);
}

.line-item__main span,
.line-item__main small,
.line-item__price,
.summary-row span,
.checkout-panel label > span {
  color: var(--tm-muted);
  font-weight: 800;
}

.line-item__main small {
  font-size: 0.78rem;
}

.checkout-panel {
  position: sticky;
  top: 96px;
  padding: 18px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--tm-border);
}

.summary-row strong {
  color: var(--tm-heading);
  text-align: right;
}

.checkout-panel label,
.address-grid label {
  display: grid;
  gap: 7px;
}

.checkout-panel label > span,
.address-grid label > span {
  font-size: 0.82rem;
}

.address-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.address-grid__wide {
  grid-column: 1 / -1;
}

.checkout-panel__hint {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 800;
}

.address-grid small {
  color: var(--tm-coral);
  font-weight: 700;
}

.checkout-panel :deep(.p-inputtext),
.checkout-panel :deep(.p-select),
.checkout-panel :deep(.p-textarea) {
  width: 100%;
}

.cart-state {
  display: grid;
  min-height: 300px;
  place-items: center;
  gap: 10px;
  padding: 28px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  color: var(--tm-muted);
  font-weight: 850;
}

.cart-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.cart-state--error i {
  color: var(--tm-coral);
}

@media (max-width: 980px) {
  .cart-layout {
    grid-template-columns: 1fr;
  }

  .checkout-panel {
    position: static;
  }
}

@media (max-width: 740px) {
  .cart-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .line-item,
  .address-grid {
    grid-template-columns: 1fr;
  }

  .line-item :deep(.p-inputnumber) {
    width: 100%;
  }
}
</style>
