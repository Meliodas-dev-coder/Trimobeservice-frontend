<script setup>
import { computed, onMounted, ref } from 'vue';

import TechWorkspaceNav from '@/components/admin/TechWorkspaceNav.vue';
import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { formatMGA } from '@/utils/format';

const { t } = useAdminI18n();

const loading = ref(true);
const error = ref('');
const categories = ref([]);
const brands = ref([]);
const products = ref([]);
const productTotal = ref(0);

const activeCategories = computed(() => categories.value.filter((item) => item.is_active).length);
const activeBrands = computed(() => brands.value.filter((item) => item.is_active).length);
const activeProducts = computed(() => products.value.filter((item) => item.is_active).length);
const readyProducts = computed(() =>
  products.value.filter((item) => item.is_active && item.primary_image_url && Number(item.variant_count || 0) > 0).length,
);
const productsNeedingSetup = computed(() =>
  products.value.filter((item) => !item.primary_image_url || Number(item.variant_count || 0) === 0).length,
);

const workspaceCards = computed(() => [
  {
    key: 'categories',
    icon: 'pi pi-tags',
    tone: 'gold',
    eyebrow: t('Catalog structure'),
    title: t('Categories'),
    value: categories.value.length,
    note: t('{n} available', { n: activeCategories.value }),
    to: '/admin/tech/categories',
  },
  {
    key: 'brands',
    icon: 'pi pi-bookmark',
    tone: 'blue',
    eyebrow: t('Manufacturers'),
    title: t('Brands'),
    value: brands.value.length,
    note: t('{n} available', { n: activeBrands.value }),
    to: '/admin/tech/brands',
  },
  {
    key: 'products',
    icon: 'pi pi-mobile',
    tone: 'emerald',
    eyebrow: t('Sellable catalog'),
    title: t('Products'),
    value: productTotal.value,
    note: productsNeedingSetup.value
      ? t('{n} need setup', { n: productsNeedingSetup.value })
      : t('Everything is ready to sell'),
    to: '/admin/tech/products',
  },
]);

const healthRows = computed(() => [
  {
    label: t('Available categories'),
    value: activeCategories.value,
    total: categories.value.length,
    icon: 'pi pi-tags',
  },
  {
    label: t('Available brands'),
    value: activeBrands.value,
    total: brands.value.length,
    icon: 'pi pi-bookmark',
  },
  {
    label: t('Available products'),
    value: activeProducts.value,
    total: products.value.length,
    icon: 'pi pi-mobile',
  },
  {
    label: t('Ready to sell'),
    value: readyProducts.value,
    total: products.value.length,
    icon: 'pi pi-check-circle',
  },
]);

const recentProducts = computed(() =>
  [...products.value]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5),
);

function percent(row) {
  return row.total ? Math.round((row.value / row.total) * 100) : 0;
}

function priceLabel(product) {
  const min = product.price_min != null ? Number(product.price_min) : null;
  const max = product.price_max != null ? Number(product.price_max) : null;
  if (min == null) {
    return t('Price not set');
  }
  return max != null && max !== min ? `${formatMGA(min)} – ${formatMGA(max)}` : formatMGA(min);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [categoryData, brandData, productData] = await Promise.all([
      api.get('/admin/categories', { params: { department: 'tech' } }),
      api.get('/admin/brands', { params: { department: 'tech' } }),
      api.get('/admin/products', { params: { department: 'tech', limit: 100, page: 1 } }),
    ]);
    categories.value = categoryData?.categories || [];
    brands.value = brandData?.brands || [];
    products.value = productData?.products || [];
    productTotal.value = Number(productData?.meta?.total ?? products.value.length);
  } catch (err) {
    categories.value = [];
    brands.value = [];
    products.value = [];
    productTotal.value = 0;
    error.value = err?.message || t('Could not load the Tech catalog');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="tech-overview">
    <TechWorkspaceNav />

    <header class="tech-hero">
      <div class="tech-hero__copy">
        <p>{{ t('Tech catalog') }}</p>
        <h2>{{ t('Build a catalog customers can trust.') }}</h2>
        <span>{{ t('Organize product types, connect brands, then publish sellable variants with clear stock and imagery.') }}</span>
      </div>
      <div class="tech-hero__actions">
        <Button as="router-link" to="/admin/tech/products/new" :label="t('Add product')" icon="pi pi-plus" />
        <Button as="router-link" to="/tech" :label="t('View storefront')" icon="pi pi-external-link" severity="secondary" outlined />
      </div>
    </header>

    <div v-if="error" class="tech-error">
      <span><i class="pi pi-exclamation-circle" />{{ t(error) }}</span>
      <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
    </div>

    <div v-if="loading" class="tech-skeleton-grid">
      <Skeleton v-for="index in 3" :key="index" height="11rem" borderRadius="18px" />
    </div>

    <template v-else>
      <section class="workspace-grid" :aria-label="t('Tech workspace')">
        <RouterLink
          v-for="card in workspaceCards"
          :key="card.key"
          :to="card.to"
          class="workspace-card"
          :class="`workspace-card--${card.tone}`"
        >
          <div class="workspace-card__top">
            <span><i :class="card.icon" /></span>
            <i class="pi pi-arrow-up-right" />
          </div>
          <p>{{ card.eyebrow }}</p>
          <div class="workspace-card__value">
            <h3>{{ card.title }}</h3>
            <strong>{{ card.value }}</strong>
          </div>
          <small>{{ card.note }}</small>
        </RouterLink>
      </section>

      <div class="tech-overview__grid">
        <section class="tech-panel">
          <div class="tech-panel__head">
            <div>
              <p>{{ t('Catalog health') }}</p>
              <h3>{{ t('What is ready for customers') }}</h3>
            </div>
            <span class="tech-panel__count">{{ readyProducts }}/{{ products.length }}</span>
          </div>

          <div class="health-list">
            <article v-for="row in healthRows" :key="row.label">
              <span class="health-list__icon"><i :class="row.icon" /></span>
              <div>
                <div class="health-list__label">
                  <strong>{{ row.label }}</strong>
                  <span>{{ row.value }}/{{ row.total }}</span>
                </div>
                <div class="health-list__track"><span :style="{ width: `${percent(row)}%` }" /></div>
              </div>
            </article>
          </div>
        </section>

        <section class="tech-panel tech-panel--products">
          <div class="tech-panel__head">
            <div>
              <p>{{ t('Recently updated') }}</p>
              <h3>{{ t('Latest Tech products') }}</h3>
            </div>
            <Button as="router-link" to="/admin/tech/products" icon="pi pi-arrow-right" severity="secondary" text rounded :aria-label="t('View products')" />
          </div>

          <div v-if="recentProducts.length" class="recent-products">
            <RouterLink
              v-for="product in recentProducts"
              :key="product.id"
              :to="{ name: 'admin-tech-product-detail', params: { id: product.id } }"
            >
              <span class="recent-products__image">
                <img v-if="product.primary_image_url" :src="product.primary_image_url" :alt="product.name" />
                <i v-else class="pi pi-image" />
              </span>
              <span class="recent-products__copy">
                <strong>{{ product.name }}</strong>
                <small>{{ priceLabel(product) }} · {{ t('{n} variants', { n: product.variant_count || 0 }) }}</small>
              </span>
              <Tag :value="product.is_active ? t('Available') : t('Unavailable')" :severity="product.is_active ? 'success' : 'secondary'" />
            </RouterLink>
          </div>
          <div v-else class="tech-empty">
            <i class="pi pi-mobile" />
            <span>{{ t('No Tech products yet.') }}</span>
            <Button as="router-link" to="/admin/tech/products/new" :label="t('Create the first product')" icon="pi pi-plus" />
          </div>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.tech-overview {
  display: grid;
  gap: 18px;
}

.tech-hero {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 24px;
  overflow: hidden;
  padding: clamp(24px, 4vw, 38px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  background:
    radial-gradient(circle at 88% -10%, rgba(12, 155, 128, 0.3), transparent 35%),
    linear-gradient(135deg, var(--tm-charcoal) 0%, #17282a 100%);
  box-shadow: var(--tm-shadow);
}

.tech-hero::after {
  position: absolute;
  right: -70px;
  bottom: -130px;
  width: 270px;
  height: 270px;
  border: 1px solid rgba(201, 146, 44, 0.22);
  border-radius: 50%;
  content: '';
}

.tech-hero__copy,
.tech-hero__actions {
  position: relative;
  z-index: 1;
}

.tech-hero p,
.tech-panel__head p,
.workspace-card > p {
  margin: 0;
  color: var(--tm-gold);
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.tech-hero h2 {
  max-width: 720px;
  margin: 8px 0 9px;
  color: #fff8ed;
  font-size: clamp(2rem, 4vw, 3.7rem);
  letter-spacing: -0.048em;
  line-height: 0.98;
}

.tech-hero__copy > span {
  display: block;
  max-width: 700px;
  color: rgba(255, 255, 255, 0.62);
  line-height: 1.55;
}

.tech-hero__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 9px;
}

.tech-hero__actions :deep(.p-button-secondary) {
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.tech-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(206, 107, 85, 0.28);
  border-radius: 14px;
  background: rgba(206, 107, 85, 0.08);
  color: var(--tm-coral);
  font-weight: 800;
}

.tech-error span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tech-skeleton-grid,
.workspace-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.workspace-card {
  --card-accent: var(--tm-gold);
  --card-wash: rgba(201, 146, 44, 0.12);
  display: grid;
  min-height: 176px;
  gap: 9px;
  padding: 18px;
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background:
    radial-gradient(circle at 100% 0%, var(--card-wash), transparent 48%),
    var(--tm-surface);
  box-shadow: 0 12px 34px rgba(37, 31, 20, 0.055);
  color: inherit;
  text-decoration: none;
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.workspace-card--blue { --card-accent: var(--tm-blue); --card-wash: rgba(49, 92, 112, 0.12); }
.workspace-card--emerald { --card-accent: var(--tm-emerald); --card-wash: rgba(12, 155, 128, 0.12); }

.workspace-card:hover,
.workspace-card:focus-visible {
  border-color: var(--card-accent);
  box-shadow: var(--tm-shadow-hover);
  outline: none;
  transform: translateY(-3px);
}

.workspace-card__top,
.workspace-card__value,
.tech-panel__head,
.health-list__label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.workspace-card__top > span {
  display: grid;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  background: var(--card-accent);
  color: #fff;
  place-items: center;
}

.workspace-card__top > i {
  color: var(--card-accent);
}

.workspace-card__value h3,
.workspace-card__value strong {
  margin: 0;
  color: var(--tm-heading);
}

.workspace-card__value h3 {
  font-size: 1.18rem;
}

.workspace-card__value strong {
  font-size: 2rem;
  letter-spacing: -0.05em;
}

.workspace-card small {
  margin-top: auto;
  color: var(--tm-muted);
  font-weight: 760;
}

.tech-overview__grid {
  display: grid;
  align-items: start;
  gap: 16px;
  grid-template-columns: minmax(300px, 0.78fr) minmax(0, 1.22fr);
}

.tech-panel {
  display: grid;
  gap: 18px;
  padding: 20px;
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background: var(--tm-surface);
  box-shadow: 0 12px 34px rgba(37, 31, 20, 0.055);
}

.tech-panel__head {
  align-items: flex-start;
}

.tech-panel__head h3 {
  margin: 4px 0 0;
  color: var(--tm-heading);
  font-size: 1.15rem;
  letter-spacing: -0.025em;
}

.tech-panel__count {
  display: grid;
  min-width: 44px;
  height: 38px;
  padding: 0 10px;
  border-radius: 12px;
  background: var(--tm-charcoal);
  color: #fff;
  font-weight: 900;
  place-items: center;
}

.health-list {
  display: grid;
  gap: 16px;
}

.health-list article {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 11px;
}

.health-list__icon {
  display: grid;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: var(--tm-surface-soft);
  color: var(--tm-emerald);
  place-items: center;
}

.health-list__label strong {
  color: var(--tm-heading);
  font-size: 0.84rem;
}

.health-list__label span {
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 800;
}

.health-list__track {
  height: 7px;
  margin-top: 7px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--tm-surface-soft);
}

.health-list__track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--tm-emerald), var(--tm-gold));
}

.recent-products {
  display: grid;
}

.recent-products a {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px solid var(--tm-border);
  color: inherit;
  text-decoration: none;
}

.recent-products a:last-child {
  border-bottom: 0;
}

.recent-products a:hover .recent-products__copy strong {
  color: var(--tm-emerald);
}

.recent-products__image {
  display: grid;
  width: 58px;
  height: 48px;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 11px;
  background: var(--tm-surface-soft);
  color: var(--tm-muted);
  place-items: center;
}

.recent-products__image img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.recent-products__copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.recent-products__copy strong {
  overflow: hidden;
  color: var(--tm-heading);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent-products__copy small {
  color: var(--tm-muted);
  font-weight: 720;
}

.tech-empty {
  display: grid;
  gap: 10px;
  place-items: center;
  padding: 28px;
  color: var(--tm-muted);
  text-align: center;
  font-weight: 800;
}

.tech-empty > i {
  color: var(--tm-gold);
  font-size: 1.7rem;
}

@media (max-width: 980px) {
  .tech-hero,
  .tech-overview__grid {
    grid-template-columns: 1fr;
  }

  .tech-hero__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  .tech-skeleton-grid,
  .workspace-grid {
    grid-template-columns: 1fr;
  }

  .tech-hero__actions,
  .tech-error {
    align-items: stretch;
    flex-direction: column;
  }

  .tech-hero__actions :deep(.p-button),
  .tech-error :deep(.p-button) {
    width: 100%;
  }
}

@media (max-width: 540px) {
  .recent-products a {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .recent-products :deep(.p-tag) {
    grid-column: 2;
    width: fit-content;
  }
}
</style>
