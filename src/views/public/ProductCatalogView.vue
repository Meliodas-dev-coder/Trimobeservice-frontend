<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import CardSkeleton from '@/components/CardSkeleton.vue';
import ProductCard from '@/components/ProductCard.vue';
import { listBrands, listCategories, listProducts } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';
import { queryInt, sameQuery } from '@/utils/query';

const route = useRoute();
const router = useRouter();
const { t } = usePublicI18n();

const QUERY_KEYS = ['q', 'category_id', 'brand_id', 'page'];

const categories = ref([]);
const brands = ref([]);
const products = ref([]);
const meta = ref({ total: 0, page: 1, limit: 12 });
const loading = ref(false);
const taxonomyLoading = ref(false);
const error = ref('');
const q = ref('');
const categoryId = ref(null);
const brandId = ref(null);
const page = ref(1);
const limit = 12;
const phoneTemplateKey = 'phone';

const mode = computed(() => route.meta.catalogMode || 'products');

const pageConfig = computed(() => {
  const configs = {
    phones: {
      eyebrow: 'Shop',
      title: 'Smartphones',
      description: 'Browse smartphone products with live prices, stock-aware variants, and admin-managed images.',
      visualKind: 'phone',
    },
    accessories: {
      eyebrow: 'Shop',
      title: 'Accessories',
      description: 'Browse the active Trimobe catalog excluding smartphone products.',
      visualKind: 'phone',
    },
    coffee: {
      eyebrow: 'Coffee',
      title: 'Trimobe coffee',
      description: 'Coffee products can use the same catalog, cart, and order flow as the tech store.',
      visualKind: 'coffee',
    },
  };
  return configs[mode.value] || configs.phones;
});

const modeCategories = computed(() => categories.value.filter((category) => categoryMatchesMode(category)));
const categoryScoped = computed(() => ['phones', 'accessories'].includes(mode.value));
const categoryLocked = computed(() => mode.value === 'phones' && modeCategories.value.length > 0);
const categoryOptions = computed(() => {
  const source = categoryScoped.value ? modeCategories.value : categories.value;
  return source.map((category) => ({ label: category.name, value: category.id }));
});
const categoryDisabled = computed(() => categoryLocked.value && categoryOptions.value.length <= 1);
const brandOptions = computed(() => brands.value.map((brand) => ({ label: brand.name, value: brand.id })));
const totalPages = computed(() => Math.max(1, Math.ceil(Number(meta.value.total || 0) / limit)));
const productTemplateFilters = computed(() => {
  if (mode.value === 'phones') {
    return { template_key: phoneTemplateKey };
  }
  if (mode.value === 'accessories') {
    return { exclude_template_key: phoneTemplateKey };
  }
  return {};
});

const productCards = computed(() =>
  products.value.map((product) => ({
    ...product,
    categoryLabel: categoryName(product.category_id),
    visualKind: pageConfig.value.visualKind,
    priceLabel: priceRange(product),
    stockLabel: product.variant_count ? `${product.variant_count} ${t('variants')}` : t('Variant details available soon'),
    image: product.primary_image_url,
    to: { name: 'product-detail', params: { slug: product.slug } },
  })),
);

function categoryMatchesMode(category) {
  if (mode.value === 'coffee') {
    const name = String(category.name || '').toLowerCase();
    return /coffee|cafe|kafe|cafe/.test(name);
  }
  if (mode.value === 'accessories') {
    return !isSmartphoneCategory(category);
  }
  return isSmartphoneCategory(category);
}

function isSmartphoneCategory(category) {
  const name = String(category.name || '').toLowerCase();
  const template = String(category.template_key || '').toLowerCase();
  if (template && template !== 'generic') {
    return template === phoneTemplateKey;
  }
  return /smartphone|smart phone|mobile phone|^phones?$|telephone/.test(name);
}

function categoryName(id) {
  return categories.value.find((category) => category.id === id)?.name || t('Catalog');
}

function priceRange(product) {
  const min = product.price_min != null ? Number(product.price_min) : null;
  const max = product.price_max != null ? Number(product.price_max) : null;
  if (min == null) {
    return t('Price on request');
  }
  if (max != null && max !== min) {
    return `${formatMGA(min)} - ${formatMGA(max)}`;
  }
  return formatMGA(min);
}

function applyModeDefaultCategory() {
  if (!categoryScoped.value) {
    return;
  }
  const allowed = new Set(modeCategories.value.map((category) => category.id));

  if (mode.value === 'phones') {
    if (!allowed.size) {
      categoryId.value = null;
      return;
    }
    if (!allowed.has(categoryId.value)) {
      categoryId.value = modeCategories.value[0]?.id || null;
    }
    return;
  }

  if (categoryId.value && !allowed.has(categoryId.value)) {
    categoryId.value = null;
  }
}

async function loadTaxonomy() {
  taxonomyLoading.value = true;
  try {
    const [categoryList, brandList] = await Promise.all([listCategories(), listBrands()]);
    categories.value = categoryList;
    brands.value = brandList;
    applyModeDefaultCategory();
  } finally {
    taxonomyLoading.value = false;
  }
}

async function fetchProducts() {
  loading.value = true;
  error.value = '';
  try {
    const res = await listProducts({
      page: page.value,
      limit,
      q: q.value.trim(),
      category_id: categoryId.value || '',
      brand_id: brandId.value || '',
      ...productTemplateFilters.value,
    });
    products.value = res.items;
    meta.value = res.meta;
  } catch (err) {
    products.value = [];
    meta.value = { total: 0, page: 1, limit };
    error.value = err?.message || t('Could not load products');
  } finally {
    loading.value = false;
  }
}

function readRouteState() {
  q.value = String(route.query.q || '');
  categoryId.value = queryInt(route.query.category_id);
  brandId.value = queryInt(route.query.brand_id);
  page.value = queryInt(route.query.page, 1);
}

function buildQuery() {
  const query = {};
  if (q.value.trim()) {
    query.q = q.value.trim();
  }
  if (categoryId.value) {
    query.category_id = String(categoryId.value);
  }
  if (brandId.value) {
    query.brand_id = String(brandId.value);
  }
  if (page.value > 1) {
    query.page = String(page.value);
  }
  return query;
}

// Push the filters into the URL; the route watcher does the fetching, so
// filtered views are shareable and the back button restores them.
function syncToRoute() {
  const query = buildQuery();
  if (sameQuery(route.query, query, QUERY_KEYS)) {
    fetchProducts();
  } else {
    router.push({ query });
  }
}

function submitSearch() {
  page.value = 1;
  syncToRoute();
}

function applyFilters() {
  applyModeDefaultCategory();
  page.value = 1;
  syncToRoute();
}

function resetFilters() {
  q.value = '';
  brandId.value = null;
  page.value = 1;
  categoryId.value = null;
  applyModeDefaultCategory();
  syncToRoute();
}

function setPage(nextPage) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) {
    return;
  }
  page.value = nextPage;
  syncToRoute();
}

// The URL is the source of truth. This also covers switching between the
// phones and accessories routes (same component, different meta).
watch(
  () => route.fullPath,
  () => {
    if (!route.meta.catalogMode) {
      return; // navigated away from the catalog
    }
    readRouteState();
    applyModeDefaultCategory();
    fetchProducts();
  },
);

onMounted(async () => {
  readRouteState();
  await loadTaxonomy();
  await fetchProducts();
});
</script>

<template>
  <section class="catalog-page">
    <div class="app-container">
      <header class="catalog-hero">
        <div>
          <p class="eyebrow">{{ t(pageConfig.eyebrow) }}</p>
          <h1>{{ t(pageConfig.title) }}</h1>
          <p>{{ t(pageConfig.description) }}</p>
        </div>
        <div class="catalog-hero__stat soft-panel">
          <span>{{ meta.total || productCards.length }}</span>
          <strong>{{ t('active items') }}</strong>
        </div>
      </header>

      <form class="catalog-toolbar soft-panel" @submit.prevent="submitSearch">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="q" :placeholder="t('Search the catalog')" :aria-label="t('Search catalog')" />
        </IconField>
        <Select
          v-model="categoryId"
          :options="categoryOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="t('Category')"
          :showClear="!categoryLocked"
          :disabled="categoryDisabled"
          :loading="taxonomyLoading"
          @update:modelValue="applyFilters"
        />
        <Select
          v-model="brandId"
          :options="brandOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="t('Brand')"
          showClear
          :loading="taxonomyLoading"
          @update:modelValue="applyFilters"
        />
        <Button type="submit" :label="t('Search')" icon="pi pi-arrow-right" />
        <Button type="button" :label="t('Reset')" icon="pi pi-refresh" severity="secondary" outlined @click="resetFilters" />
      </form>

      <div v-if="error" class="catalog-state catalog-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
      </div>

      <div v-else-if="loading" class="catalog-grid">
        <CardSkeleton v-for="n in 6" :key="n" />
      </div>

      <div v-else-if="productCards.length" class="catalog-grid">
        <ProductCard v-for="product in productCards" :key="product.id" :product="product" />
      </div>

      <div v-else class="catalog-state">
        <i class="pi pi-inbox" />
        <span>{{ t('No products found.') }}</span>
      </div>

      <div class="catalog-pagination" :aria-label="t('Product pagination')">
        <Button
          icon="pi pi-chevron-left"
          :label="t('Previous')"
          severity="secondary"
          outlined
          :disabled="page <= 1 || loading"
          @click="setPage(page - 1)"
        />
        <span>{{ t('Page {page} of {total}', { page, total: totalPages }) }}</span>
        <Button
          :label="t('Next')"
          icon="pi pi-chevron-right"
          iconPos="right"
          severity="secondary"
          outlined
          :disabled="page >= totalPages || loading"
          @click="setPage(page + 1)"
        />
      </div>
    </div>
  </section>
</template>

<style scoped>
.catalog-page {
  padding: 48px 0 64px;
}

.catalog-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 20px;
}

.catalog-hero h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.4rem, 6vw, 5rem);
  line-height: 0.95;
}

.catalog-hero p:not(.eyebrow) {
  max-width: 700px;
  margin: 16px 0 0;
  color: var(--tm-muted);
  font-size: 1.05rem;
  line-height: 1.6;
}

.catalog-hero__stat {
  display: grid;
  min-width: 180px;
  gap: 4px;
  padding: 18px;
}

.catalog-hero__stat span {
  color: var(--tm-heading);
  font-size: 2rem;
  font-weight: 950;
  line-height: 1;
}

.catalog-hero__stat strong {
  color: var(--tm-muted);
  font-size: 0.82rem;
  text-transform: uppercase;
}

.catalog-toolbar {
  display: grid;
  grid-template-columns: minmax(220px, 1fr) minmax(160px, 0.35fr) minmax(160px, 0.35fr) auto auto;
  gap: 10px;
  margin-bottom: 20px;
  padding: 12px;
}

.catalog-toolbar :deep(.p-iconfield),
.catalog-toolbar :deep(.p-inputtext),
.catalog-toolbar :deep(.p-select) {
  width: 100%;
}

.catalog-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.catalog-state {
  display: grid;
  min-height: 260px;
  place-items: center;
  gap: 10px;
  padding: 36px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  color: var(--tm-muted);
  font-weight: 850;
}

.catalog-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.catalog-state--error i {
  color: var(--tm-coral);
}

.catalog-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 24px;
  color: var(--tm-muted);
  font-weight: 850;
}

@media (max-width: 980px) {
  .catalog-toolbar,
  .catalog-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .catalog-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .catalog-toolbar,
  .catalog-grid {
    grid-template-columns: 1fr;
  }

  .catalog-toolbar .p-button,
  .catalog-pagination .p-button {
    width: 100%;
  }

  .catalog-pagination {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
