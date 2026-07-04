<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { formatMGA } from '@/utils/format';

const router = useRouter();
const toast = useToast();
const { enumLabel, t } = useAdminI18n();

const saving = ref(false);
const errors = ref({});

const products = ref([]);
const customers = ref([]);
const variantsByProduct = reactive({}); // productId -> [variants]

const form = reactive({
  customer_name: '',
  user_id: null,
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
  country: '',
  postal_code: '',
});
const items = ref([newItem()]);

const fulfillmentOptions = computed(() => [
  { label: enumLabel('pickup'), value: 'pickup' },
  { label: enumLabel('delivery'), value: 'delivery' },
]);
const isDelivery = computed(() => form.fulfillment_type === 'delivery');

const productOptions = computed(() =>
  products.value.map((p) => ({ label: p.name, value: p.id })),
);
const customerOptions = computed(() =>
  customers.value.map((c) => ({ label: `${c.full_name} · ${c.email}`, value: c.id })),
);

const subtotal = computed(() => items.value.reduce((sum, row) => sum + lineTotal(row), 0));

const canSubmit = computed(() => {
  if (!form.customer_name.trim()) {
    return false;
  }
  if (!validItems.value.length) {
    return false;
  }
  if (isDelivery.value) {
    return ['recipient_name', 'phone', 'line1', 'city', 'country'].every((k) => address[k].trim());
  }
  return true;
});

const validItems = computed(() => items.value.filter((row) => row.variantId && row.quantity > 0));

function newItem() {
  return { productId: null, variantId: null, quantity: 1 };
}

function addItem() {
  items.value.push(newItem());
}

function removeItem(index) {
  items.value.splice(index, 1);
  if (!items.value.length) {
    items.value.push(newItem());
  }
}

async function onProductChange(row) {
  row.variantId = null;
  if (row.productId && !variantsByProduct[row.productId]) {
    try {
      const data = await api.get(`/admin/products/${row.productId}`);
      variantsByProduct[row.productId] = data?.product?.variants || [];
    } catch {
      variantsByProduct[row.productId] = [];
    }
  }
}

function variantLabel(v) {
  const bits = [v.sku];
  if (v.label) {
    bits.push(v.label);
  }
  return `${bits.join(' · ')} — ${formatMGA(Number(v.price || 0))}`;
}

function variantOptions(row) {
  return (variantsByProduct[row.productId] || [])
    .filter((v) => v.is_active)
    .map((v) => ({ label: variantLabel(v), value: v.id }));
}

function selectedVariant(row) {
  return (variantsByProduct[row.productId] || []).find((v) => v.id === row.variantId) || null;
}

function lineTotal(row) {
  const v = selectedVariant(row);
  return v ? Number(v.price || 0) * (row.quantity || 0) : 0;
}

function stockNote(row) {
  const v = selectedVariant(row);
  if (!v) {
    return '';
  }
  if (row.quantity > v.stock_quantity) {
    return t('Only {n} in stock', { n: v.stock_quantity });
  }
  return t('{n} in stock', { n: v.stock_quantity });
}

function overStock(row) {
  const v = selectedVariant(row);
  return v ? row.quantity > v.stock_quantity : false;
}

async function submit() {
  saving.value = true;
  errors.value = {};
  try {
    const body = {
      customer_name: form.customer_name.trim(),
      fulfillment_type: form.fulfillment_type,
      items: validItems.value.map((row) => ({ product_variant_id: row.variantId, quantity: row.quantity })),
    };
    if (form.user_id) {
      body.user_id = form.user_id;
    }
    if (form.note.trim()) {
      body.note = form.note.trim();
    }
    if (isDelivery.value) {
      body.shipping_address = {
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
    await api.post('/admin/orders', body);
    toast.add({ severity: 'success', summary: t('Order created'), life: 2500 });
    router.push({ name: 'admin-orders' });
  } catch (err) {
    if (err?.details) {
      errors.value = err.details;
    }
    toast.add({ severity: 'error', summary: t('Save failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    saving.value = false;
  }
}

function goBack() {
  router.push({ name: 'admin-orders' });
}

onMounted(async () => {
  try {
    const [prod, cust] = await Promise.all([
      api.get('/admin/products', { params: { limit: 100 } }),
      api.get('/admin/customers', { params: { limit: 100 } }),
    ]);
    products.value = prod?.products || [];
    customers.value = cust?.customers || [];
  } catch {
    // form still usable; selects just stay empty
  }
});
</script>

<template>
  <section class="order-create">
    <div class="order-create__top">
      <Button icon="pi pi-arrow-left" :label="t('Orders')" severity="secondary" outlined @click="goBack" />
      <Button :label="t('Create order')" icon="pi pi-check" :loading="saving" :disabled="!canSubmit" @click="submit" />
    </div>

    <div class="order-create__head">
      <p>{{ t('Tech') }}</p>
      <h1>{{ t('New order') }}</h1>
      <span>{{ t('Create a phone or walk-in order. Stock is reserved on save; confirm payment later.') }}</span>
    </div>

    <div class="order-grid">
      <div class="order-grid__main">
        <!-- Customer -->
        <section class="panel">
          <div class="panel__head"><h3>{{ t('Customer') }}</h3></div>
          <div class="field-grid">
            <label class="field">
              <span>{{ t('Customer name') }}<small>*</small></span>
              <InputText v-model="form.customer_name" :placeholder="t('Phone caller name')" />
              <small v-if="errors.customer_name" class="field__error">{{ t(errors.customer_name) }}</small>
            </label>
            <label class="field">
              <span>{{ t('Link account (optional)') }}</span>
              <Select
                v-model="form.user_id"
                :options="customerOptions"
                optionLabel="label"
                optionValue="value"
                :placeholder="t('None')"
                showClear
                filter
                fluid
              />
            </label>
          </div>
        </section>

        <!-- Items -->
        <section class="panel">
          <div class="panel__head">
            <h3>{{ t('Items') }}</h3>
            <Button :label="t('Add item')" icon="pi pi-plus" size="small" @click="addItem" />
          </div>
          <div class="items">
            <div v-for="(row, index) in items" :key="index" class="item-row">
              <label class="item-row__product">
                <span>{{ t('Product') }}</span>
                <Select
                  v-model="row.productId"
                  :options="productOptions"
                  optionLabel="label"
                  optionValue="value"
                  :placeholder="t('Choose product')"
                  filter
                  fluid
                  @change="onProductChange(row)"
                />
              </label>
              <label class="item-row__variant">
                <span>{{ t('Variant') }}</span>
                <Select
                  v-model="row.variantId"
                  :options="variantOptions(row)"
                  optionLabel="label"
                  optionValue="value"
                  :placeholder="row.productId ? t('Choose variant') : t('Pick a product first')"
                  :disabled="!row.productId"
                  fluid
                />
                <small v-if="stockNote(row)" class="item-row__stock" :class="{ 'item-row__stock--over': overStock(row) }">
                  {{ stockNote(row) }}
                </small>
              </label>
              <label class="item-row__qty">
                <span>{{ t('Qty') }}</span>
                <InputNumber v-model="row.quantity" :min="1" showButtons fluid />
              </label>
              <div class="item-row__total">
                <span>{{ t('Line total') }}</span>
                <strong>{{ formatMGA(lineTotal(row)) }}</strong>
              </div>
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                :aria-label="t('Remove')"
                class="item-row__remove"
                @click="removeItem(index)"
              />
            </div>
          </div>
          <div class="items__foot">
            <span>{{ t('Subtotal') }}</span>
            <strong>{{ formatMGA(subtotal) }}</strong>
          </div>
        </section>

        <!-- Delivery address -->
        <section v-if="isDelivery" class="panel">
          <div class="panel__head"><h3>{{ t('Delivery address') }}</h3></div>
          <div class="field-grid">
            <label class="field">
              <span>{{ t('Recipient name') }}<small>*</small></span>
              <InputText v-model="address.recipient_name" />
              <small v-if="errors['shipping_address.recipient_name']" class="field__error">{{ t(errors['shipping_address.recipient_name']) }}</small>
            </label>
            <label class="field">
              <span>{{ t('Phone') }}<small>*</small></span>
              <InputText v-model="address.phone" />
              <small v-if="errors['shipping_address.phone']" class="field__error">{{ t(errors['shipping_address.phone']) }}</small>
            </label>
            <label class="field field--wide">
              <span>{{ t('Address line 1') }}<small>*</small></span>
              <InputText v-model="address.line1" />
              <small v-if="errors['shipping_address.line1']" class="field__error">{{ t(errors['shipping_address.line1']) }}</small>
            </label>
            <label class="field field--wide">
              <span>{{ t('Address line 2') }}</span>
              <InputText v-model="address.line2" />
            </label>
            <label class="field">
              <span>{{ t('City') }}<small>*</small></span>
              <InputText v-model="address.city" />
              <small v-if="errors['shipping_address.city']" class="field__error">{{ t(errors['shipping_address.city']) }}</small>
            </label>
            <label class="field">
              <span>{{ t('Region') }}</span>
              <InputText v-model="address.region" />
            </label>
            <label class="field">
              <span>{{ t('Country') }}<small>*</small></span>
              <InputText v-model="address.country" />
              <small v-if="errors['shipping_address.country']" class="field__error">{{ t(errors['shipping_address.country']) }}</small>
            </label>
            <label class="field">
              <span>{{ t('Postal code') }}</span>
              <InputText v-model="address.postal_code" />
            </label>
          </div>
        </section>
      </div>

      <!-- Sidebar: fulfillment + note + summary -->
      <aside class="order-grid__side">
        <section class="panel">
          <div class="panel__head"><h3>{{ t('Fulfillment') }}</h3></div>
          <div class="field-grid">
            <label class="field field--wide">
              <span>{{ t('Type') }}</span>
              <Select v-model="form.fulfillment_type" :options="fulfillmentOptions" optionLabel="label" optionValue="value" fluid />
            </label>
            <label class="field field--wide">
              <span>{{ t('Note') }}</span>
              <Textarea v-model="form.note" rows="3" autoResize />
            </label>
          </div>
        </section>

        <section class="panel summary">
          <div class="summary__row">
            <span>{{ t('Items') }}</span>
            <strong>{{ validItems.length }}</strong>
          </div>
          <div class="summary__row summary__row--total">
            <span>{{ t('Total') }}</span>
            <strong>{{ formatMGA(subtotal) }}</strong>
          </div>
          <Button :label="t('Create order')" icon="pi pi-check" :loading="saving" :disabled="!canSubmit" @click="submit" />
        </section>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.order-create {
  display: grid;
  gap: 18px;
}

.order-create__top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.order-create__head p,
.order-create__head h1 {
  margin: 0;
}

.order-create__head p {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.order-create__head h1 {
  margin-top: 5px;
  color: var(--tm-heading);
  font-size: clamp(1.6rem, 3vw, 2.2rem);
}

.order-create__head span {
  display: block;
  margin-top: 8px;
  color: var(--tm-muted);
  font-weight: 700;
}

.order-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.42fr);
  align-items: start;
}

.order-grid__main,
.order-grid__side {
  display: grid;
  gap: 18px;
}

.panel {
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--tm-border);
}

.panel__head h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.02rem;
}

.field-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 16px;
}

.field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.field--wide {
  grid-column: 1 / -1;
}

.field span {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 820;
}

.field span small {
  color: var(--tm-coral);
}

.field__error {
  color: var(--tm-coral);
  font-size: 0.78rem;
  font-weight: 700;
}

.field :deep(.p-inputtext),
.field :deep(.p-select),
.field :deep(.p-textarea) {
  width: 100%;
}

.items {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.item-row {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 1.5fr) 110px 130px auto;
  align-items: start;
  gap: 12px;
}

.item-row span {
  color: var(--tm-muted);
  font-size: 0.76rem;
  font-weight: 800;
}

.item-row label {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.item-row :deep(.p-select),
.item-row :deep(.p-inputnumber) {
  width: 100%;
}

.item-row__stock {
  color: var(--tm-muted);
  font-size: 0.74rem;
  font-weight: 700;
}

.item-row__stock--over {
  color: var(--tm-coral);
}

.item-row__total {
  display: grid;
  gap: 6px;
}

.item-row__total strong {
  color: var(--tm-heading);
  font-weight: 900;
}

.item-row__remove {
  align-self: end;
  margin-bottom: 2px;
}

.items__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
  padding: 14px 16px;
  border-top: 1px solid var(--tm-border);
  color: var(--tm-muted);
  font-weight: 800;
}

.items__foot strong {
  color: var(--tm-heading);
  font-size: 1.1rem;
}

.summary {
  display: grid;
  gap: 12px;
  padding: 16px;
}

.summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--tm-muted);
  font-weight: 800;
}

.summary__row--total {
  padding-top: 10px;
  border-top: 1px solid var(--tm-border);
}

.summary__row--total strong {
  color: var(--tm-heading);
  font-size: 1.25rem;
}

@media (max-width: 960px) {
  .order-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .field-grid,
  .item-row {
    grid-template-columns: 1fr;
  }

  .order-create__top {
    flex-direction: column;
  }

  .order-create__top .p-button {
    width: 100%;
  }
}
</style>
