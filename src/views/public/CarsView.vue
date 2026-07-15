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

const QUERY_KEYS = ['q', 'category_id', 'start_date', 'end_date', 'page'];
const limit = 12;

const categories = ref([]);
const cars = ref([]);
const meta = ref({ total: 0, page: 1, limit });
const loading = ref(false);
const error = ref('');
const q = ref('');
const categoryId = ref(null);
const startDate = ref(todayAtMidnight());
const endDate = ref(addDays(todayAtMidnight(), 1));
const page = ref(1);

const categoryOptions = computed(() => categories.value.map((category) => ({
  label: content(category, 'name') || category.name,
  value: category.id,
})));
const categoryChips = computed(() => [
  { label: t('All cars'), value: null, icon: 'pi pi-th-large' },
  ...categories.value.map((category) => ({
    label: content(category, 'name') || category.name,
    value: category.id,
    icon: category.is_cargo_transport ? 'pi pi-truck' : 'pi pi-car',
  })),
]);
const totalPages = computed(() => Math.max(1, Math.ceil(Number(meta.value.total || 0) / limit)));
const selectedCategory = computed(() => categoryOptions.value.find((option) => option.value === categoryId.value)?.label || t('All cars'));
const carCards = computed(() => cars.value.map((car) => ({
  ...car,
  categoryLabel: categoryName(car.category_id),
  dateAvailability: car.available_for_range !== false,
  serviceLabel: car.is_cargo_transport ? t('Cargo transport') : t('Driver included'),
  to: {
    name: 'car-detail',
    params: { slug: car.slug },
    query: {
      start_date: formatQueryDate(startDate.value),
      end_date: formatQueryDate(endDate.value),
      date_available: car.available_for_range === false ? '0' : '1',
    },
  },
})));
const heroCar = computed(() => carCards.value.find((car) => car.primary_image_url) || carCards.value[0] || null);

function todayAtMidnight() {
  const value = new Date();
  value.setHours(0, 0, 0, 0);
  return value;
}

function addDays(value, days) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function parseQueryDate(raw, fallback) {
  const match = String(raw || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return new Date(fallback);
  }
  const value = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  value.setHours(0, 0, 0, 0);
  return Number.isNaN(value.getTime()) ? new Date(fallback) : value;
}

function formatQueryDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return '';
  }
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function availabilityWindow() {
  const start = new Date(startDate.value);
  const end = new Date(endDate.value);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function categoryName(id) {
  const category = categories.value.find((item) => item.id === id);
  return category ? content(category, 'name') || category.name : t('Car');
}

function readRouteState() {
  const today = todayAtMidnight();
  q.value = String(route.query.q || '');
  categoryId.value = queryInt(route.query.category_id);
  startDate.value = parseQueryDate(route.query.start_date, today);
  endDate.value = parseQueryDate(route.query.end_date, addDays(startDate.value, 1));
  if (endDate.value < startDate.value) {
    endDate.value = addDays(startDate.value, 1);
  }
  page.value = queryInt(route.query.page, 1);
}

function buildQuery() {
  const query = {
    start_date: formatQueryDate(startDate.value),
    end_date: formatQueryDate(endDate.value),
  };
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
    const window = availabilityWindow();
    const res = await listCars({
      page: page.value,
      limit,
      q: q.value.trim(),
      category_id: categoryId.value || '',
      start: window.start,
      end: window.end,
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

function selectCategory(value) {
  categoryId.value = value;
  page.value = 1;
  syncToRoute();
}

function handleStartDate() {
  if (endDate.value < startDate.value) {
    endDate.value = addDays(startDate.value, 1);
  }
}

function resetFilters() {
  const today = todayAtMidnight();
  q.value = '';
  categoryId.value = null;
  startDate.value = today;
  endDate.value = addDays(today, 1);
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
    <div class="app-container cars-page__inner">
      <header class="cars-hero">
        <div class="cars-hero__copy">
          <p class="eyebrow">{{ t('Cars with driver') }}</p>
          <h1>{{ t('Your ride, already taken care of.') }}</h1>
          <p>{{ t('Choose the right car, select your dates, and travel across Madagascar with a driver included.') }}</p>
          <div class="cars-hero__trust">
            <span><i class="pi pi-user" />{{ t('Driver included') }}</span>
            <span><i class="pi pi-tag" />{{ t('Clear pricing before booking') }}</span>
          </div>
        </div>

        <RouterLink v-if="heroCar" :to="heroCar.to" class="cars-hero__vehicle">
          <img v-if="heroCar.primary_image_url" :src="heroCar.primary_image_url" :alt="heroCar.name" />
          <i v-else class="pi pi-car" />
          <span><small>{{ t('Featured ride') }}</small><strong>{{ heroCar.name }}</strong></span>
        </RouterLink>
        <div v-else class="cars-hero__vehicle cars-hero__vehicle--empty"><i class="pi pi-car" /></div>
      </header>

      <form class="cars-discovery" @submit.prevent="submitSearch">
        <label>
          <span>{{ t('Pickup date') }}</span>
          <DatePicker v-model="startDate" showIcon fluid dateFormat="dd M yy" :minDate="todayAtMidnight()" @update:modelValue="handleStartDate" />
        </label>
        <label>
          <span>{{ t('Return date') }}</span>
          <DatePicker v-model="endDate" showIcon fluid dateFormat="dd M yy" :minDate="startDate" />
        </label>
        <label>
          <span>{{ t('Vehicle type') }}</span>
          <Select v-model="categoryId" :options="categoryOptions" optionLabel="label" optionValue="value" :placeholder="t('All types')" showClear fluid />
        </label>
        <Button type="submit" :label="t('Find a car')" icon="pi pi-arrow-right" iconPos="right" :loading="loading" />
      </form>

      <section class="cars-catalog">
        <div class="cars-catalog__head">
          <div>
            <p class="eyebrow">{{ t('Available fleet') }}</p>
            <h2>{{ t('Choose how you want to travel') }}</h2>
            <span>{{ t('{count} cars match {category}', { count: meta.total || 0, category: selectedCategory }) }}</span>
          </div>
          <form class="cars-catalog__search" @submit.prevent="submitSearch">
            <IconField>
              <InputIcon class="pi pi-search" />
              <InputText v-model="q" :placeholder="t('Search make or model')" :aria-label="t('Search cars')" />
            </IconField>
            <Button v-if="q || categoryId" type="button" icon="pi pi-refresh" :label="t('Reset')" severity="secondary" text @click="resetFilters" />
          </form>
        </div>

        <nav class="category-pills" :aria-label="t('Car categories')">
          <button
            v-for="category in categoryChips"
            :key="category.value ?? 'all'"
            type="button"
            :class="{ 'is-active': categoryId === category.value }"
            @click="selectCategory(category.value)"
          >
            <i :class="category.icon" />
            <span>{{ category.label }}</span>
          </button>
        </nav>

        <div v-if="error" class="cars-state cars-state--error"><i class="pi pi-exclamation-triangle" /><span>{{ error }}</span></div>
        <div v-else-if="loading" class="cars-grid"><CardSkeleton v-for="n in 6" :key="n" /></div>
        <div v-else-if="carCards.length" class="cars-grid"><CarCard v-for="car in carCards" :key="car.id" :car="car" /></div>
        <div v-else class="cars-state">
          <i class="pi pi-calendar-times" />
          <strong>{{ t('No cars found.') }}</strong>
          <span>{{ t('Try another vehicle type or clear the filters.') }}</span>
          <Button :label="t('Reset search')" icon="pi pi-refresh" severity="secondary" outlined @click="resetFilters" />
        </div>

        <div v-if="totalPages > 1" class="cars-pagination" :aria-label="t('Cars pagination')">
          <Button icon="pi pi-chevron-left" :label="t('Previous')" severity="secondary" outlined :disabled="page <= 1 || loading" @click="setPage(page - 1)" />
          <span>{{ t('Page {page} of {total}', { page, total: totalPages }) }}</span>
          <Button :label="t('Next')" icon="pi pi-chevron-right" iconPos="right" severity="secondary" outlined :disabled="page >= totalPages || loading" @click="setPage(page + 1)" />
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.cars-page { padding: 22px 0 88px; }
.cars-page__inner { display: grid; gap: 0; }
.cars-hero { position: relative; display: grid; min-height: 405px; grid-template-columns: minmax(0, .86fr) minmax(380px, 1.14fr); align-items: center; gap: 22px; overflow: hidden; padding: clamp(30px, 5vw, 64px); padding-bottom: 86px; border-radius: 30px; background: radial-gradient(circle at 82% 18%, rgba(201,146,44,.2), transparent 28%), linear-gradient(125deg, #101719, #1d2527); box-shadow: var(--tm-shadow); }
.cars-hero::after { position: absolute; right: -120px; bottom: -220px; width: 460px; height: 460px; border: 1px solid rgba(201,146,44,.2); border-radius: 50%; content: ''; }
.cars-hero__copy, .cars-hero__vehicle { position: relative; z-index: 1; }
.cars-hero .eyebrow { color: var(--tm-gold); }
.cars-hero h1 { max-width: 670px; margin: 9px 0 13px; color: #fff9ef; font-size: clamp(2.8rem, 5.7vw, 5.7rem); letter-spacing: -.055em; line-height: .93; }
.cars-hero__copy > p:not(.eyebrow) { max-width: 640px; margin: 0; color: rgba(255,255,255,.68); font-size: 1.03rem; line-height: 1.65; }
.cars-hero__trust { display: flex; flex-wrap: wrap; gap: 12px 22px; margin-top: 24px; }
.cars-hero__trust span { display: inline-flex; align-items: center; gap: 9px; color: rgba(255,255,255,.78); font-weight: 780; }
.cars-hero__trust i { display: grid; width: 34px; height: 34px; border: 1px solid rgba(201,146,44,.5); border-radius: 50%; color: var(--tm-gold); place-items: center; }
.cars-hero__vehicle { display: grid; min-height: 280px; align-self: stretch; overflow: hidden; border-radius: 22px; color: inherit; text-decoration: none; }
.cars-hero__vehicle img { position: absolute; width: 100%; height: 100%; object-fit: cover; filter: saturate(.88) contrast(1.04); }
.cars-hero__vehicle::after { position: absolute; inset: 0; background: linear-gradient(180deg, transparent 50%, rgba(10,15,16,.8)); content: ''; }
.cars-hero__vehicle > span { position: absolute; z-index: 1; left: 18px; bottom: 16px; display: grid; gap: 2px; color: #fff; }
.cars-hero__vehicle small { color: var(--tm-gold); font-size: .68rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
.cars-hero__vehicle strong { font-size: 1.1rem; }
.cars-hero__vehicle--empty { background: rgba(255,255,255,.05); color: var(--tm-gold); font-size: 5rem; place-items: center; }
.cars-discovery { position: relative; z-index: 3; display: grid; width: min(1120px, calc(100% - 48px)); grid-template-columns: repeat(3, minmax(0, 1fr)) auto; align-items: end; gap: 10px; margin: -54px auto 0; padding: 16px; border: 1px solid var(--tm-border); border-radius: 20px; background: var(--tm-surface); box-shadow: 0 20px 48px rgba(22,28,29,.15); }
.cars-discovery label { display: grid; gap: 7px; min-width: 0; }
.cars-discovery label > span { color: var(--tm-heading); font-size: .78rem; font-weight: 850; }
.cars-discovery :deep(.p-datepicker), .cars-discovery :deep(.p-select), .cars-discovery :deep(.p-inputtext) { width: 100%; }
.cars-discovery :deep(.p-button) { min-height: 46px; padding-inline: 26px; }
.cars-catalog { display: grid; gap: 20px; padding-top: 52px; }
.cars-catalog__head { display: flex; align-items: end; justify-content: space-between; gap: 24px; }
.cars-catalog__head h2 { margin: 6px 0 5px; color: var(--tm-heading); font-size: clamp(2rem, 4vw, 3.25rem); letter-spacing: -.045em; line-height: 1; }
.cars-catalog__head > div > span { color: var(--tm-muted); font-weight: 740; }
.cars-catalog__search { display: flex; align-items: center; gap: 7px; }
.cars-catalog__search :deep(.p-inputtext) { min-width: 250px; }
.category-pills { display: flex; flex-wrap: wrap; gap: 9px; }
.category-pills button { display: inline-flex; min-height: 42px; align-items: center; gap: 8px; padding: 9px 15px; border: 1px solid var(--tm-border); border-radius: 999px; background: var(--tm-surface); color: var(--tm-muted); font: inherit; font-size: .85rem; font-weight: 820; cursor: pointer; transition: transform 150ms ease, border-color 150ms ease, background 150ms ease, color 150ms ease; }
.category-pills button:hover { border-color: var(--tm-gold); color: var(--tm-heading); transform: translateY(-1px); }
.category-pills button.is-active { border-color: var(--tm-charcoal); background: var(--tm-charcoal); color: #fff; box-shadow: 0 8px 22px rgba(20,29,31,.14); }
.category-pills button.is-active i { color: var(--tm-gold); }
.cars-grid { display: grid; gap: 20px; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.cars-state { display: grid; min-height: 290px; place-items: center; align-content: center; gap: 9px; padding: 34px; border: 1px solid var(--tm-border); border-radius: 20px; background: var(--tm-surface); color: var(--tm-muted); text-align: center; font-weight: 760; }
.cars-state > i { color: var(--tm-gold); font-size: 1.8rem; }
.cars-state strong { color: var(--tm-heading); font-size: 1.1rem; }
.cars-state :deep(.p-button) { margin-top: 7px; }
.cars-state--error i { color: var(--tm-coral); }
.cars-pagination { display: flex; align-items: center; justify-content: center; gap: 14px; margin-top: 4px; color: var(--tm-muted); font-weight: 850; }
@media (max-width: 1040px) { .cars-hero { grid-template-columns: 1fr 1fr; } .cars-discovery { grid-template-columns: repeat(2, minmax(0,1fr)); } .cars-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 760px) { .cars-page { padding-top: 12px; } .cars-hero { min-height: auto; grid-template-columns: 1fr; padding: 28px 24px 88px; border-radius: 22px; } .cars-hero h1 { font-size: clamp(2.55rem, 13vw, 4rem); } .cars-hero__vehicle { min-height: 230px; } .cars-discovery { width: calc(100% - 24px); grid-template-columns: 1fr; margin-top: -62px; } .cars-discovery :deep(.p-button) { width: 100%; } .cars-catalog { padding-top: 40px; } .cars-catalog__head { align-items: stretch; flex-direction: column; } .cars-catalog__search { width: 100%; } .cars-catalog__search :deep(.p-iconfield) { flex: 1; } .cars-catalog__search :deep(.p-inputtext) { width: 100%; min-width: 0; } .cars-grid { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .cars-hero__vehicle { min-height: 190px; } .cars-catalog__search, .cars-pagination { align-items: stretch; flex-direction: column; } .cars-pagination :deep(.p-button) { width: 100%; } }
</style>
