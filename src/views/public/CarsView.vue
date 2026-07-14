<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import CarCard from '@/components/CarCard.vue';
import CardSkeleton from '@/components/CardSkeleton.vue';
import { listCarCategories, listCars } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { queryInt, sameQuery } from '@/utils/query';

const route = useRoute();
const router = useRouter();
const { content, t } = usePublicI18n();

const QUERY_KEYS = ['q', 'category_id', 'page'];

const categories = ref([]);
const cars = ref([]);
const meta = ref({ total: 0, page: 1, limit: 12 });
const loading = ref(false);
const error = ref('');
const q = ref('');
const categoryId = ref(null);
const page = ref(1);
const limit = 12;

const categoryOptions = computed(() => categories.value.map((category) => ({ label: content(category, 'name') || category.name, value: category.id })));
const totalPages = computed(() => Math.max(1, Math.ceil(Number(meta.value.total || 0) / limit)));
const carCards = computed(() =>
  cars.value.map((car) => ({
    ...car,
    categoryLabel: categoryName(car.category_id),
    availability: car.is_cargo_transport ? t('Cargo transport') : t('Driver included'),
    to: { name: 'car-detail', params: { slug: car.slug } },
  })),
);

function categoryName(id) {
  const category = categories.value.find((item) => item.id === id);
  return category ? content(category, 'name') || category.name : t('Car');
}

function readRouteState() {
  q.value = String(route.query.q || '');
  categoryId.value = queryInt(route.query.category_id);
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
    fetchCars();
  } else {
    router.push({ query });
  }
}

async function loadCategories() {
  categories.value = await listCarCategories();
}

async function fetchCars() {
  loading.value = true;
  error.value = '';
  try {
    const res = await listCars({
      page: page.value,
      limit,
      q: q.value.trim(),
      category_id: categoryId.value || '',
    });
    cars.value = res.items;
    meta.value = res.meta;
  } catch (err) {
    cars.value = [];
    meta.value = { total: 0, page: 1, limit };
    error.value = err?.message || t('Could not load cars');
  } finally {
    loading.value = false;
  }
}

function submitSearch() {
  page.value = 1;
  syncToRoute();
}

function applyCategory() {
  page.value = 1;
  syncToRoute();
}

function resetFilters() {
  q.value = '';
  categoryId.value = null;
  page.value = 1;
  syncToRoute();
}

function setPage(nextPage) {
  if (nextPage < 1 || nextPage > totalPages.value || nextPage === page.value) {
    return;
  }
  page.value = nextPage;
  syncToRoute();
}

// The URL is the source of truth: back/forward and shared links re-drive the
// list through this watcher.
watch(
  () => route.fullPath,
  () => {
    if (route.name !== 'cars') {
      return;
    }
    readRouteState();
    fetchCars();
  },
);

onMounted(async () => {
  readRouteState();
  await loadCategories();
  await fetchCars();
});
</script>

<template>
  <section class="cars-page">
    <div class="app-container">
      <header class="cars-hero">
        <div>
          <p class="eyebrow">{{ t('Hire') }}</p>
          <h1>{{ t('Cars with driver') }}</h1>
          <p>{{ t('Browse available fleet cars, compare daily rates, and book a date range from your customer account.') }}</p>
        </div>
        <div class="cars-hero__stat soft-panel">
          <span>{{ meta.total || carCards.length }}</span>
          <strong>{{ t('available cars') }}</strong>
        </div>
      </header>

      <form class="cars-toolbar soft-panel" @submit.prevent="submitSearch">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="q" :placeholder="t('Search cars, make, model, or plate')" :aria-label="t('Search cars')" />
        </IconField>
        <Select
          v-model="categoryId"
          :options="categoryOptions"
          optionLabel="label"
          optionValue="value"
          :placeholder="t('Category')"
          showClear
          @update:modelValue="applyCategory"
        />
        <Button type="submit" :label="t('Search')" icon="pi pi-arrow-right" />
        <Button type="button" :label="t('Reset')" icon="pi pi-refresh" severity="secondary" outlined @click="resetFilters" />
      </form>

      <div v-if="error" class="cars-state cars-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
      </div>

      <div v-else-if="loading" class="cars-grid">
        <CardSkeleton v-for="n in 6" :key="n" />
      </div>

      <div v-else-if="carCards.length" class="cars-grid">
        <CarCard v-for="car in carCards" :key="car.id" :car="car" />
      </div>

      <div v-else class="cars-state">
        <i class="pi pi-car" />
        <span>{{ t('No cars found.') }}</span>
      </div>

      <div class="cars-pagination" :aria-label="t('Cars pagination')">
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
.cars-page {
  padding: 64px 0 92px;
}

.cars-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
  margin-bottom: 30px;
}

.cars-hero h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(3rem, 7vw, 6.2rem);
  line-height: 0.92;
}

.cars-hero p:not(.eyebrow) {
  max-width: 700px;
  color: var(--tm-muted);
  line-height: 1.65;
}

.cars-hero__stat {
  display: grid;
  min-width: 196px;
  gap: 4px;
  padding: 22px;
}

.cars-hero__stat span {
  color: var(--tm-heading);
  font-size: 2rem;
  font-weight: 950;
}

.cars-hero__stat strong {
  color: var(--tm-muted);
  text-transform: uppercase;
}

.cars-toolbar {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) minmax(170px, 0.36fr) auto auto;
  gap: 10px;
  margin-bottom: 28px;
  padding: 14px;
}

.cars-toolbar :deep(.p-iconfield),
.cars-toolbar :deep(.p-inputtext),
.cars-toolbar :deep(.p-select) {
  width: 100%;
}

.cars-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.cars-state {
  display: grid;
  min-height: 280px;
  place-items: center;
  gap: 10px;
  padding: 34px;
  border: 1px solid var(--tm-border);
  border-radius: var(--tm-radius);
  background: var(--tm-surface);
  color: var(--tm-muted);
  font-weight: 850;
}

.cars-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.cars-state--error i {
  color: var(--tm-coral);
}

.cars-pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 24px;
  color: var(--tm-muted);
  font-weight: 850;
}

@media (max-width: 980px) {
  .cars-toolbar,
  .cars-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .cars-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .cars-toolbar,
  .cars-grid {
    grid-template-columns: 1fr;
  }

  .cars-toolbar .p-button,
  .cars-pagination .p-button {
    width: 100%;
  }

  .cars-pagination {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
