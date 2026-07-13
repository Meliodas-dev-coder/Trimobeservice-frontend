<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import ProductCard from '@/components/ProductCard.vue';
import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import { getProduct, listProducts } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { formatMGA, setPageTitle } from '@/utils/format';

const route = useRoute();
const toast = useToast();
const auth = useAuthStore();
const cart = useCartStore();
const { content, t } = usePublicI18n();

const product = ref(null);
const related = ref([]);
const loading = ref(false);
const adding = ref(false);
const error = ref('');
const selectedVariantId = ref(null);
const selectedImageUrl = ref('');
const quantity = ref(1);

const variants = computed(() => (product.value?.variants || []).filter((variant) => variant.is_active));
const selectedVariant = computed(() => variants.value.find((variant) => variant.id === selectedVariantId.value) || null);
const productImages = computed(() => product.value?.images || []);
const selectedVariantImage = computed(() => {
  const id = selectedVariant.value?.id;
  return productImages.value.find((image) => image.variant_id === id)?.url || '';
});
const primaryImage = computed(() => productImages.value.find((image) => image.is_primary)?.url || productImages.value[0]?.url || '');
const heroImage = computed(() => selectedImageUrl.value || selectedVariantImage.value || primaryImage.value);
const galleryImages = computed(() => {
  const seen = new Set();
  return productImages.value.filter((image) => {
    if (seen.has(image.url)) {
      return false;
    }
    seen.add(image.url);
    return true;
  });
});
const attributes = computed(() => parseAttributes(product.value?.attributes));
const selectedAttrs = computed(() => parseAttributes(selectedVariant.value?.attributes));
const canAdd = computed(() => Boolean(selectedVariant.value && selectedVariant.value.stock_quantity > 0 && quantity.value > 0));
const productName = computed(() => (product.value ? content(product.value, 'name') || product.value.name : ''));
const productDescription = computed(() => (product.value ? content(product.value, 'description') || product.value.description : ''));
const categoryName = computed(() => (
  product.value?.category ? content(product.value.category, 'name') || product.value.category.name : t('Catalog')
));
const brandName = computed(() => (
  product.value?.brand ? content(product.value.brand, 'name') || product.value.brand.name : ''
));

const relatedCards = computed(() =>
  related.value
    .filter((item) => item.slug !== product.value?.slug)
    .slice(0, 3)
    .map((item) => ({
      ...item,
      categoryLabel: categoryName.value,
      image: item.primary_image_url,
      priceLabel: priceRange(item),
      stockLabel: item.variant_count ? `${item.variant_count} ${t('variants')}` : t('Variant details available soon'),
      to: { name: 'product-detail', params: { slug: item.slug } },
    })),
);

function parseAttributes(raw) {
  if (!raw) {
    return {};
  }
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

function priceRange(item) {
  const prices = item.variants
    ? item.variants.filter((variant) => variant.is_active).map((variant) => Number(variant.price || 0))
    : [item.price_min, item.price_max].filter((value) => value != null).map(Number);
  if (!prices.length) {
    return t('Price on request');
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMGA(min) : `${formatMGA(min)} - ${formatMGA(max)}`;
}

function titleize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

function specValue(value) {
  if (typeof value === 'boolean') {
    return value ? t('Yes') : t('No');
  }
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return value;
}

function variantTitle(variant) {
  if (!variant) {
    return t('Choose variant');
  }
  if (variant.label) {
    return variant.label;
  }
  const attrs = parseAttributes(variant.attributes);
  const parts = Object.values(attrs).filter((value) => value !== null && value !== '' && value !== false);
  return parts.length ? parts.join(' / ') : variant.sku;
}

function variantOption(variant) {
  const stock = variant.stock_quantity > 0 ? `${variant.stock_quantity} ${t('in stock')}` : t('Out of stock');
  return `${variantTitle(variant)} - ${formatMGA(Number(variant.price || 0))} - ${stock}`;
}

async function load() {
  loading.value = true;
  error.value = '';
  selectedImageUrl.value = '';
  try {
    product.value = await getProduct(route.params.slug);
    setPageTitle(productName.value);
    selectedVariantId.value = variants.value[0]?.id || null;
    if (product.value?.category_id) {
      const res = await listProducts({ category_id: product.value.category_id, limit: 4 });
      related.value = res.items || [];
    }
  } catch (err) {
    product.value = null;
    error.value = err?.message || t('Could not load product');
  } finally {
    loading.value = false;
  }
}

async function addToCart() {
  if (!canAdd.value) {
    return;
  }
  adding.value = true;
  try {
    // The snapshot lets a signed-out visitor keep a local cart line; it is
    // ignored for signed-in users (the server cart snapshots prices itself).
    await cart.addItem(selectedVariant.value.id, Number(quantity.value || 1), {
      product_name: productName.value,
      product_slug: product.value.slug,
      variant_label: variantTitle(selectedVariant.value),
      sku: selectedVariant.value.sku,
      unit_price: selectedVariant.value.price,
      in_stock: selectedVariant.value.stock_quantity,
    });
    toast.add({ severity: 'success', summary: t('Added to cart'), detail: productName.value, life: 2600 });
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not add item'), detail: err?.message || t('Request failed'), life: 4200 });
  } finally {
    adding.value = false;
  }
}

watch(
  () => route.params.slug,
  () => load(),
);

watch(selectedVariantId, () => {
  selectedImageUrl.value = '';
  quantity.value = 1;
});

onMounted(load);
</script>

<template>
  <section class="product-page">
    <div class="app-container">
      <div v-if="loading" class="product-detail" aria-hidden="true">
        <Skeleton height="520px" borderRadius="8px" />
        <div class="detail-skeleton">
          <Skeleton width="30%" height="0.9rem" />
          <Skeleton width="80%" height="2.8rem" />
          <Skeleton width="100%" height="3.6rem" />
          <Skeleton width="100%" height="280px" borderRadius="8px" />
        </div>
      </div>

      <div v-else-if="error" class="detail-state detail-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
      </div>

      <template v-else-if="product">
        <Button as="router-link" to="/phones" icon="pi pi-arrow-left" :label="t('Back to catalog')" severity="secondary" outlined />

        <section class="product-detail">
          <div class="product-media">
            <figure v-if="heroImage" class="product-media__hero">
              <img :src="heroImage" :alt="productName" />
            </figure>
            <VisualPlaceholder v-else kind="phone" tone="emerald" />

            <div v-if="galleryImages.length" class="product-media__thumbs">
              <button
                v-for="image in galleryImages"
                :key="image.id"
                type="button"
                :class="{ 'is-active': heroImage === image.url }"
                @click="selectedImageUrl = image.url"
              >
                <img :src="image.url" :alt="image.alt_text || productName" />
              </button>
            </div>
          </div>

          <div class="product-info">
            <p class="eyebrow">{{ categoryName }}</p>
            <h1>{{ productName }}</h1>
            <p v-if="productDescription" class="product-info__description">{{ productDescription }}</p>

            <div class="product-info__meta">
              <Tag v-if="brandName" :value="brandName" severity="secondary" />
              <Tag :value="product.is_active ? t('Available') : t('Unavailable')" :severity="product.is_active ? 'success' : 'secondary'" />
              <Tag :value="`${variants.length} ${t('variants')}`" severity="info" />
            </div>

            <section class="buy-panel soft-panel">
              <div class="buy-panel__price">
                <span>{{ t('Selected price') }}</span>
                <strong>{{ selectedVariant ? formatMGA(Number(selectedVariant.price || 0)) : priceRange(product) }}</strong>
              </div>

              <label>
                <span>{{ t('Variant') }}</span>
                <Select
                  v-model="selectedVariantId"
                  :options="variants"
                  optionValue="id"
                  :placeholder="variants.length ? t('Choose variant') : t('No variants available')"
                  :disabled="!variants.length"
                  fluid
                >
                  <template #value="{ value }">
                    <span>{{ variantTitle(variants.find((variant) => variant.id === value)) }}</span>
                  </template>
                  <template #option="{ option }">
                    <span>{{ variantOption(option) }}</span>
                  </template>
                </Select>
              </label>

              <div v-if="selectedVariant" class="variant-facts">
                <span><i class="pi pi-box" /> {{ t('SKU') }} {{ selectedVariant.sku }}</span>
                <span><i class="pi pi-database" /> {{ selectedVariant.stock_quantity }} {{ t('in stock') }}</span>
              </div>

              <label>
                <span>{{ t('Quantity') }}</span>
                <InputNumber
                  v-model="quantity"
                  :min="1"
                  :max="selectedVariant?.stock_quantity || 1"
                  showButtons
                  fluid
                  :disabled="!selectedVariant"
                />
              </label>

              <Button
                :label="t('Add to cart')"
                icon="pi pi-shopping-bag"
                :loading="adding"
                :disabled="!canAdd"
                @click="addToCart"
              />
              <p v-if="!auth.isAuthenticated" class="buy-panel__hint">
                {{ t('You can fill your cart as a guest — it stays in this browser and moves to your account when you sign in at checkout.') }}
              </p>
            </section>
          </div>
        </section>

        <section class="detail-section">
          <div class="section-header">
            <div>
              <p class="eyebrow">{{ t('Details') }}</p>
              <h2 class="section-title">{{ t('Specifications') }}</h2>
            </div>
          </div>

          <div class="spec-grid">
            <article v-for="[key, value] in Object.entries(attributes)" :key="key">
              <span>{{ t(titleize(key)) }}</span>
              <strong>{{ specValue(value) }}</strong>
            </article>
            <article v-for="[key, value] in Object.entries(selectedAttrs)" :key="`variant-${key}`">
              <span>{{ t(titleize(key)) }}</span>
              <strong>{{ specValue(value) }}</strong>
            </article>
            <p v-if="!Object.keys(attributes).length && !Object.keys(selectedAttrs).length" class="spec-grid__empty">
              {{ t('Detailed specifications are being prepared for this item.') }}
            </p>
          </div>
        </section>

        <section v-if="relatedCards.length" class="detail-section">
          <div class="section-header">
            <div>
              <p class="eyebrow">{{ t('More') }}</p>
              <h2 class="section-title">{{ t('Related products') }}</h2>
            </div>
          </div>
          <div class="related-grid">
            <ProductCard v-for="item in relatedCards" :key="item.id" :product="item" />
          </div>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.product-page {
  padding: 34px 0 64px;
}

.detail-state {
  display: grid;
  min-height: 360px;
  place-items: center;
  gap: 10px;
  color: var(--tm-muted);
  font-weight: 850;
}

.detail-state i {
  color: var(--tm-gold);
  font-size: 1.5rem;
}

.detail-state--error i {
  color: var(--tm-coral);
}

.detail-skeleton {
  display: grid;
  align-content: start;
  gap: 16px;
}

.product-detail {
  display: grid;
  gap: 28px;
  margin-top: 18px;
  grid-template-columns: minmax(0, 0.95fr) minmax(360px, 0.72fr);
  align-items: start;
}

.product-media {
  display: grid;
  gap: 12px;
}

.product-media__hero {
  min-height: 520px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
  box-shadow: var(--tm-shadow);
}

.product-media__hero img {
  width: 100%;
  height: 100%;
  min-height: 520px;
  object-fit: cover;
}

.product-media__thumbs {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(86px, 1fr));
}

.product-media__thumbs button {
  height: 78px;
  overflow: hidden;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 8px;
  background: var(--tm-surface);
  cursor: pointer;
}

.product-media__thumbs button.is-active {
  border-color: var(--tm-emerald);
}

.product-media__thumbs img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-info {
  display: grid;
  gap: 18px;
}

.product-info h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.2rem, 5vw, 4.8rem);
  line-height: 0.95;
}

.product-info__description {
  margin: 0;
  color: var(--tm-muted);
  line-height: 1.7;
}

.product-info__meta,
.variant-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.buy-panel {
  display: grid;
  gap: 16px;
  padding: 18px;
}

.buy-panel label {
  display: grid;
  gap: 7px;
}

.buy-panel label > span,
.buy-panel__price span {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 850;
}

.buy-panel__price {
  display: grid;
  gap: 5px;
}

.buy-panel__price strong {
  color: var(--tm-heading);
  font-size: 1.8rem;
  line-height: 1;
}

.variant-facts span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 800;
}

.buy-panel__hint {
  margin: 0;
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 750;
}

.detail-section {
  margin-top: 52px;
}

.spec-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.spec-grid article {
  display: grid;
  gap: 5px;
  min-height: 86px;
  align-content: center;
  padding: 14px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
}

.spec-grid span {
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 850;
}

.spec-grid strong {
  color: var(--tm-heading);
}

.spec-grid__empty {
  grid-column: 1 / -1;
  margin: 0;
  padding: 22px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  color: var(--tm-muted);
  font-weight: 800;
}

.related-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@media (max-width: 980px) {
  .product-detail,
  .related-grid {
    grid-template-columns: 1fr;
  }

  .spec-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .product-media__hero,
  .product-media__hero img {
    min-height: 320px;
  }

  .spec-grid {
    grid-template-columns: 1fr;
  }
}
</style>
