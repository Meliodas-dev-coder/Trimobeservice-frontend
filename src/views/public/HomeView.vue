<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import CarCard from '@/components/CarCard.vue';
import ProductCard from '@/components/ProductCard.vue';
import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import { listCarCategories, listCars, listCategories, listProducts } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';
import {
  featuredCoffee,
  homepageOffers,
  services,
} from '@/data/trimobe';

const router = useRouter();
const { t } = usePublicI18n();
const selectedService = ref('phones');
const searchTerm = ref('');
const startDate = ref(new Date());
const endDate = ref(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
const products = ref([]);
const productCategories = ref([]);
const cars = ref([]);
const carCategories = ref([]);
const productMeta = ref({ total: 0 });
const carMeta = ref({ total: 0 });
const loadingProducts = ref(false);
const loadingCars = ref(false);
const productError = ref('');
const carError = ref('');

const eventOffer = computed(() => homepageOffers.find((offer) => offer.id === 'events'));
const coffeeOffer = computed(() => homepageOffers.find((offer) => offer.id === 'coffee'));

const liveProducts = computed(() =>
  products.value.map((product) => ({
    ...product,
    categoryLabel: productCategoryName(product.category_id),
    visualKind: 'phone',
    priceLabel: productPriceRange(product),
    stockLabel: product.variant_count ? `${product.variant_count} ${t('variants')}` : t('Variant details available soon'),
    image: product.primary_image_url,
    to: { name: 'product-detail', params: { slug: product.slug } },
  })),
);

const liveCars = computed(() =>
  cars.value.map((car) => ({
    ...car,
    categoryLabel: carCategoryName(car.category_id),
    availability: car.is_cargo_transport ? 'Cargo transport' : 'Driver included',
    to: { name: 'car-detail', params: { slug: car.slug } },
  })),
);

const liveCarCategories = computed(() =>
  carCategories.value.slice(0, 4).map((category) => ({
    id: category.id,
    label: category.name,
    icon: carCategoryIcon(category),
    to: { name: 'cars', query: { category_id: category.id } },
  })),
);

const trustSignals = computed(() => [
  {
    label: 'Products',
    value: productMeta.value.total ? `${productMeta.value.total} live` : 'Live catalog',
  },
  {
    label: 'Cars',
    value: carMeta.value.total ? `${carMeta.value.total} ${t('available cars')}` : t('Driver included'),
  },
  {
    label: 'Categories',
    value: carCategories.value.length ? `${carCategories.value.length} fleet types` : 'Fleet',
  },
  { label: 'Payment', value: 'Assisted' },
]);

const carouselOffers = computed(() => {
  const firstProduct = products.value[0];
  const firstCar = cars.value[0];
  const fallbackPhones = homepageOffers.find((offer) => offer.id === 'phones');
  const fallbackCars = homepageOffers.find((offer) => offer.id === 'cars');

  return [
    firstProduct
      ? {
          id: `product-${firstProduct.id}`,
          eyebrow: productCategoryName(firstProduct.category_id),
          title: firstProduct.name,
          description: firstProduct.description || t('Featured from the Trimobe catalog with clear variants, availability, and Ariary pricing.'),
          actionLabel: 'View product',
          actionTo: { name: 'product-detail', params: { slug: firstProduct.slug } },
          secondaryLabel: 'All products',
          secondaryTo: '/phones',
          icon: 'pi pi-mobile',
          visualKind: 'phone',
          tone: 'emerald',
          priceNote: productPriceRange(firstProduct),
          image: firstProduct.primary_image_url,
          imageAlt: firstProduct.name,
        }
      : fallbackPhones,
    firstCar
      ? {
          id: `car-${firstCar.id}`,
          eyebrow: carCategoryName(firstCar.category_id),
          title: firstCar.name,
          description: firstCar.description || t('Chauffeured vehicle with published daily rate and a simple reservation flow.'),
          actionLabel: 'Reserve car',
          actionTo: { name: 'car-detail', params: { slug: firstCar.slug } },
          secondaryLabel: 'All cars',
          secondaryTo: '/cars',
          icon: 'pi pi-car',
          visualKind: 'car',
          tone: 'charcoal',
          priceNote: `${formatMGA(Number(firstCar.daily_rate || 0))} / day`,
          image: firstCar.primary_image_url,
          imageAlt: firstCar.name,
        }
      : fallbackCars,
    eventOffer.value,
    coffeeOffer.value,
  ].filter(Boolean);
});

function submitSearch() {
  const q = searchTerm.value.trim();
  router.push({ name: 'phones', query: q ? { q } : {} });
}

function productCategoryName(id) {
  return productCategories.value.find((category) => category.id === id)?.name || 'Catalog';
}

function carCategoryName(id) {
  return carCategories.value.find((category) => category.id === id)?.name || 'Car';
}

function productPriceRange(product) {
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

function carCategoryIcon(category) {
  const name = String(category.name || '').toLowerCase();
  if (category.is_cargo_transport || /cargo|transport|truck|camion/.test(name)) {
    return 'pi pi-box';
  }
  if (/bus|van|group|navette/.test(name)) {
    return 'pi pi-users';
  }
  if (/lux|premium|executive/.test(name)) {
    return 'pi pi-sparkles';
  }
  return 'pi pi-car';
}

async function loadFeaturedProducts() {
  loadingProducts.value = true;
  productError.value = '';
  try {
    const [categoryList, productList] = await Promise.all([
      listCategories(),
      listProducts({ limit: 3 }),
    ]);
    productCategories.value = categoryList;
    products.value = productList.items || [];
    productMeta.value = productList.meta || { total: products.value.length };
  } catch (err) {
    products.value = [];
    productMeta.value = { total: 0 };
    productError.value = err?.message || 'Unable to load featured products';
  } finally {
    loadingProducts.value = false;
  }
}

async function loadFeaturedCars() {
  loadingCars.value = true;
  carError.value = '';
  try {
    const [categoryList, carList] = await Promise.all([
      listCarCategories(),
      listCars({ limit: 2 }),
    ]);
    carCategories.value = categoryList;
    cars.value = carList.items || [];
    carMeta.value = carList.meta || { total: cars.value.length };
  } catch (err) {
    carCategories.value = [];
    cars.value = [];
    carMeta.value = { total: 0 };
    carError.value = err?.message || 'Unable to load featured cars';
  } finally {
    loadingCars.value = false;
  }
}

onMounted(() => {
  loadFeaturedProducts();
  loadFeaturedCars();
});
</script>

<template>
  <section class="home-hero">
    <div class="app-container">
      <Carousel
        class="offer-carousel"
        :value="carouselOffers"
        :numVisible="1"
        :numScroll="1"
        circular
        :autoplayInterval="5600"
        :showNavigators="false"
      >
        <template #item="{ data }">
          <article class="offer-slide" :class="`offer-slide--${data.tone}`">
            <div class="offer-slide__copy">
              <p class="eyebrow">{{ t(data.eyebrow) }}</p>
              <h1>{{ t(data.title) }}</h1>
              <p>{{ t(data.description) }}</p>
              <div class="offer-slide__actions">
                <Button as="router-link" :to="data.actionTo" :label="t(data.actionLabel)" :icon="data.icon" />
                <Button
                  as="router-link"
                  :to="data.secondaryTo"
                  :label="t(data.secondaryLabel)"
                  icon="pi pi-arrow-up-right"
                  outlined
                />
              </div>
            </div>

            <div class="offer-slide__visual">
              <figure v-if="data.image" class="offer-slide__image">
                <img :src="data.image" :alt="data.imageAlt" />
              </figure>
              <VisualPlaceholder v-else :kind="data.visualKind" :tone="data.tone" />
              <div class="offer-slide__note">
                <span>{{ t(data.priceNote) }}</span>
                <strong>{{ t('Assisted payment available') }}</strong>
              </div>
            </div>
          </article>
        </template>
      </Carousel>
    </div>

    <div class="app-container home-hero__grid">
      <div class="home-hero__content">
        <p class="eyebrow">{{ t('Premium service, local operations') }}</p>
        <h2>{{ t('Shop, reserve, and discover Trimobe offers') }}</h2>
        <p class="home-hero__copy">
          {{ t('Phones, accessories, coffee, and chauffeured cars for customers across Madagascar.') }}
        </p>

        <form class="home-search soft-panel" @submit.prevent="submitSearch">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="searchTerm" :placeholder="t('Search phones, coffee, accessories, or cars')" :aria-label="t('Search')" />
          </IconField>
          <Button type="submit" :label="t('Search')" icon="pi pi-arrow-right" />
        </form>

        <div class="service-switch" :aria-label="t('Trimobe services')">
          <RouterLink
            v-for="service in services"
            :key="service.key"
            v-ripple
            class="service-switch__item"
            :class="{ 'is-active': selectedService === service.key }"
            :to="service.to"
            @mouseenter="selectedService = service.key"
            @focus="selectedService = service.key"
          >
            <i :class="service.icon" />
            <span>
              <strong>{{ t(service.label) }}</strong>
              <small>{{ t(service.detail) }}</small>
            </span>
          </RouterLink>
        </div>

        <div class="home-hero__actions">
          <Button as="router-link" to="/phones" :label="t('Browse phones')" icon="pi pi-mobile" />
          <Button as="router-link" to="/coffee" :label="t('Shop coffee')" icon="pi pi-shopping-bag" outlined />
          <Button as="router-link" to="/cars" :label="t('Reserve car')" icon="pi pi-car" outlined />
        </div>
      </div>

      <aside class="booking-panel soft-panel" :aria-label="t('Quick car booking')">
        <div class="booking-panel__header">
          <span class="status-dot" />
          <div>
            <p>{{ t('Car hire') }}</p>
            <h2>{{ t('Check dates') }}</h2>
          </div>
        </div>

        <div class="booking-panel__fields">
          <label>
            <span>{{ t('Start') }}</span>
            <DatePicker v-model="startDate" showIcon fluid dateFormat="dd M yy" />
          </label>
          <label>
            <span>{{ t('End') }}</span>
            <DatePicker v-model="endDate" showIcon fluid dateFormat="dd M yy" />
          </label>
        </div>

        <div v-if="liveCarCategories.length" class="category-row">
          <RouterLink v-for="category in liveCarCategories" :key="category.id" :to="category.to">
            <i :class="category.icon" />
            {{ category.label }}
          </RouterLink>
        </div>
        <div v-else class="category-row category-row--empty">
          <span>{{ loadingCars ? t('Loading fleet categories...') : t('Fleet categories are being prepared.') }}</span>
        </div>

        <Button as="router-link" to="/cars" :label="t('View available cars')" icon="pi pi-calendar" />
      </aside>
    </div>
  </section>

  <section class="trust-band">
    <div class="app-container trust-band__grid">
      <div v-for="signal in trustSignals" :key="signal.label" class="trust-item">
        <span>{{ t(signal.label) }}</span>
        <strong>{{ t(signal.value) }}</strong>
      </div>
    </div>
  </section>

  <section class="home-section">
    <div class="app-container">
      <div class="section-header">
        <div>
          <p class="eyebrow">{{ t('Shop') }}</p>
          <h2 class="section-title">{{ t('Featured phones and accessories') }}</h2>
        </div>
        <Button as="router-link" to="/phones" :label="t('All products')" icon="pi pi-arrow-up-right" outlined />
      </div>

      <div v-if="loadingProducts" class="home-state">
        <i class="pi pi-spin pi-spinner" />
        <span>{{ t('Loading featured products...') }}</span>
      </div>
      <div v-else-if="productError" class="home-state home-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ productError }}</span>
      </div>
      <div v-else-if="liveProducts.length" class="product-grid">
        <ProductCard v-for="product in liveProducts" :key="product.id" :product="product" />
      </div>
      <div v-else class="home-state">
        <i class="pi pi-inbox" />
        <span>{{ t('Our latest product selection is being updated.') }}</span>
      </div>
    </div>
  </section>

  <section class="home-section home-section--coffee">
    <div class="app-container">
      <div class="section-header">
        <div>
          <p class="eyebrow">{{ t('Coffee') }}</p>
          <h2 class="section-title">{{ t('Cofee Misiona selections') }}</h2>
          <p class="section-copy">
            {{ t('Rich, gift-ready coffee selections for homes, offices, meetings, and everyday welcomes.') }}
          </p>
        </div>
        <Button as="router-link" to="/coffee" :label="t('View Cofee Misiona')" icon="pi pi-shopping-bag" outlined />
      </div>

      <div class="product-grid">
        <ProductCard v-for="product in featuredCoffee" :key="product.id" :product="product" />
      </div>
    </div>
  </section>

  <section class="home-section home-section--split">
    <div class="app-container car-section">
      <div class="section-header">
        <div>
          <p class="eyebrow">{{ t('Hire') }}</p>
          <h2 class="section-title">{{ t('Cars with driver') }}</h2>
          <p class="section-copy">
            {{ t('Daily rates are shown up front. Final bookings keep their price snapshot.') }}
          </p>
        </div>
        <Button as="router-link" to="/cars" :label="t('Book car')" icon="pi pi-car" />
      </div>

      <div v-if="loadingCars" class="home-state">
        <i class="pi pi-spin pi-spinner" />
        <span>{{ t('Loading featured cars...') }}</span>
      </div>
      <div v-else-if="carError" class="home-state home-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ carError }}</span>
      </div>
      <div v-else-if="liveCars.length" class="car-grid">
        <CarCard v-for="car in liveCars" :key="car.id" :car="car" />
      </div>
      <div v-else class="home-state">
        <i class="pi pi-car" />
        <span>{{ t('Our featured fleet selection is being updated.') }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-hero {
  padding: 30px 0 36px;
  background: var(--tm-body-bg);
}

.offer-carousel {
  margin-bottom: 28px;
}

.offer-carousel :deep(.p-carousel-content) {
  gap: 12px;
}

.offer-carousel :deep(.p-carousel-indicator-list) {
  display: flex;
  justify-content: start;
  gap: 8px;
  padding: 14px 0 0;
}

.offer-carousel :deep(.p-carousel-indicator-button) {
  width: 34px;
  height: 4px;
  border-radius: 999px;
  background: var(--tm-border-strong);
}

.offer-carousel :deep(.p-carousel-indicator-active .p-carousel-indicator-button) {
  background: var(--tm-emerald);
}

.offer-slide {
  display: grid;
  min-height: 368px;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background:
    linear-gradient(115deg, var(--tm-surface) 0%, var(--tm-surface-soft) 58%),
    var(--tm-stone);
  box-shadow: var(--tm-shadow);
  grid-template-columns: minmax(0, 1.05fr) minmax(320px, 0.72fr);
}

.offer-slide--charcoal {
  background:
    linear-gradient(115deg, rgba(17, 19, 21, 0.96) 0%, rgba(28, 32, 34, 0.86) 55%),
    var(--tm-charcoal);
}

.offer-slide__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: clamp(24px, 5vw, 52px);
}

.offer-slide h1 {
  max-width: 760px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.35rem, 5vw, 5rem);
  line-height: 0.96;
}

.offer-slide--charcoal h1 {
  color: #fff;
}

.offer-slide__copy > p:not(.eyebrow) {
  max-width: 620px;
  margin: 18px 0 0;
  color: var(--tm-muted);
  font-size: clamp(1rem, 2vw, 1.18rem);
  line-height: 1.62;
}

.offer-slide--charcoal .offer-slide__copy > p:not(.eyebrow) {
  color: rgba(255, 255, 255, 0.72);
}

.offer-slide__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.offer-slide__visual {
  display: grid;
  position: relative;
  align-content: center;
  gap: 18px;
  padding: clamp(18px, 4vw, 36px);
  background:
    linear-gradient(160deg, rgba(185, 138, 46, 0.15), transparent 48%),
    var(--tm-surface-soft);
}

.offer-slide__visual :deep(.visual) {
  min-height: 228px;
}

.offer-slide__image {
  position: relative;
  min-height: 256px;
  margin: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--tm-charcoal);
  box-shadow: 0 18px 38px rgba(17, 19, 21, 0.16);
}

.offer-slide__image::after {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, transparent 62%, rgba(17, 19, 21, 0.26)),
    linear-gradient(90deg, rgba(17, 19, 21, 0.12), transparent 38%);
  content: "";
  pointer-events: none;
}

.offer-slide__image img {
  width: 100%;
  height: 100%;
  min-height: 256px;
  object-fit: cover;
}

.offer-slide__note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 66px;
  padding: 0 16px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.offer-slide__note span {
  color: var(--tm-muted);
  font-weight: 800;
}

.offer-slide__note strong {
  color: var(--tm-heading);
  text-align: right;
}

.home-hero__grid {
  display: grid;
  align-items: stretch;
  gap: 28px;
  grid-template-columns: minmax(0, 1.4fr) minmax(340px, 0.62fr);
}

.home-hero__content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  padding: 26px 0;
}

.home-hero h2 {
  max-width: 780px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.2rem, 5vw, 4.5rem);
  line-height: 0.95;
}

.home-hero__copy {
  max-width: 640px;
  margin: 22px 0 0;
  color: var(--tm-muted);
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  line-height: 1.55;
}

.home-search {
  display: grid;
  width: min(100%, 720px);
  grid-template-columns: 1fr auto;
  gap: 10px;
  margin-top: 28px;
  padding: 10px;
}

.home-search :deep(.p-inputtext) {
  width: 100%;
  min-height: 48px;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.service-switch {
  display: grid;
  width: min(100%, 720px);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-top: 18px;
}

.service-switch__item {
  display: flex;
  position: relative;
  min-height: 84px;
  align-items: center;
  gap: 14px;
  overflow: hidden;
  padding: 16px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.service-switch__item.is-active {
  border-color: rgba(8, 124, 104, 0.32);
  background: rgba(8, 124, 104, 0.09);
}

.service-switch__item i {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  color: var(--tm-gold);
  background: var(--tm-charcoal);
}

.service-switch__item span {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.service-switch__item strong {
  color: var(--tm-heading);
  font-size: 1rem;
}

.service-switch__item small {
  color: var(--tm-muted);
  line-height: 1.35;
}

.home-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.booking-panel {
  display: grid;
  align-content: start;
  gap: 22px;
  padding: 24px;
}

.booking-panel__header {
  display: flex;
  align-items: center;
  gap: 14px;
}

.booking-panel__header p,
.booking-panel__header h2 {
  margin: 0;
}

.booking-panel__header p {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.booking-panel__header h2 {
  color: var(--tm-heading);
  font-size: 1.55rem;
}

.booking-panel__fields {
  display: grid;
  gap: 14px;
}

.booking-panel__fields label {
  display: grid;
  gap: 7px;
}

.booking-panel__fields label > span {
  color: var(--tm-muted);
  font-size: 0.84rem;
  font-weight: 800;
}

.category-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.category-row a {
  display: flex;
  min-height: 46px;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
  color: var(--tm-heading);
  font-weight: 800;
}

.category-row i {
  color: var(--tm-emerald);
}

.category-row--empty {
  display: block;
  padding: 12px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  color: var(--tm-muted);
  font-weight: 800;
}

.trust-band {
  padding: 18px 0;
  border-block: 1px solid var(--tm-border);
  background: var(--tm-surface-muted);
}

.trust-band__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.trust-item {
  display: grid;
  gap: 3px;
  min-height: 62px;
  align-content: center;
  padding: 0 16px;
  border-left: 3px solid var(--tm-gold);
}

.trust-item span {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 760;
}

.trust-item strong {
  color: var(--tm-heading);
  font-size: 1rem;
}

.home-section {
  padding: 52px 0;
}

.home-section--split {
  background:
    linear-gradient(180deg, var(--tm-surface-muted), rgba(185, 138, 46, 0.08)),
    var(--tm-stone);
}

.home-section--coffee {
  background: var(--tm-surface-muted);
}

.product-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.car-section {
  display: grid;
  gap: 8px;
}

.car-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.home-state {
  display: grid;
  min-height: 180px;
  place-items: center;
  gap: 10px;
  padding: 24px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  color: var(--tm-muted);
  font-weight: 850;
  text-align: center;
}

.home-state i {
  color: var(--tm-gold);
  font-size: 1.5rem;
}

.home-state--error i {
  color: var(--tm-coral);
}

@media (max-width: 980px) {
  .offer-slide {
    grid-template-columns: 1fr;
  }

  .home-hero__grid {
    grid-template-columns: 1fr;
  }

  .booking-panel {
    max-width: none;
  }

  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .home-hero {
    padding-top: 30px;
  }

  .home-search,
  .trust-band__grid,
  .product-grid,
  .car-grid {
    grid-template-columns: 1fr;
  }

  .service-switch {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .offer-slide {
    min-height: auto;
  }

  .offer-slide__note {
    align-items: start;
    flex-direction: column;
    justify-content: center;
    padding: 14px;
  }

  .offer-slide__note strong {
    text-align: left;
  }

  .home-search {
    gap: 8px;
  }

  .home-search .p-button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .service-switch,
  .category-row {
    grid-template-columns: 1fr;
  }
}
</style>
