<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import CarCard from '@/components/CarCard.vue';
import ProductCard from '@/components/ProductCard.vue';
import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import eventPlanningShowcase from '@/assets/redesign/service-event.webp';
import homeCareVisit from '@/assets/redesign/service-healthcare.webp';
import coffeeRange from '@/assets/coffee/kafe-misiona-range.jpeg';
import { listCarCategories, listCars, listCategories, listProducts } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';

const router = useRouter();
const { content, t } = usePublicI18n();

const searchTerm = ref('');
const products = ref([]);
const productCategories = ref([]);
const cars = ref([]);
const carCategories = ref([]);
const loadingProducts = ref(false);
const loadingCars = ref(false);
const productError = ref('');
const carError = ref('');

const serviceDoors = [
  {
    n: '01',
    title: 'Phones & accessories',
    short: 'Phones',
    detail: 'Devices, audio, and accessories with clear stock and Ariary pricing.',
    meta: 'Shop from 50 000 MGA',
    to: '/tech',
    icon: 'pi pi-mobile',
    tone: 'emerald',
  },
  {
    n: '02',
    title: 'Cars with driver',
    short: 'Cars',
    detail: 'Chauffeured vehicles by the day, reserved around your dates.',
    meta: 'Driver included',
    to: '/cars',
    icon: 'pi pi-car',
    tone: 'emerald',
  },
  {
    n: '03',
    title: 'Event planning',
    short: 'Events',
    detail: 'Sound, light, catering, decor, and artists in one coordinated request.',
    meta: 'Quote by request',
    to: '/events',
    icon: 'pi pi-calendar',
    tone: 'gold',
  },
  {
    n: '04',
    title: 'Healthcare at home',
    short: 'Healthcare',
    detail: 'Home consultations and care packages with trusted doctors and nurses.',
    meta: 'Emergency line 24/7',
    to: '/healthcare',
    icon: 'pi pi-heart',
    tone: 'coral',
  },
];

const howItWorks = [
  {
    n: '01',
    icon: 'pi pi-search',
    title: 'Browse freely',
    detail: 'Explore the shop, fleet, event services, and care packages without creating an account.',
  },
  {
    n: '02',
    icon: 'pi pi-file-edit',
    title: 'Request or reserve',
    detail: 'Add products to your cart, choose car dates, or send the team a service request.',
  },
  {
    n: '03',
    icon: 'pi pi-wallet',
    title: 'Pay with the team',
    detail: 'Pay by cash, bank transfer, or mobile money and track confirmation in your account.',
  },
];

const shopDepartments = [
  {
    title: 'Tech',
    detail: 'Phones, laptops, audio, and everyday accessories.',
    to: '/tech',
    icon: 'pi pi-mobile',
    tone: 'tech',
  },
  {
    title: 'Fashion',
    detail: 'Clothing and footwear with live size and color variants.',
    to: '/fashion',
    icon: 'pi pi-shopping-bag',
    tone: 'fashion',
  },
  {
    title: 'Kafe Misiona',
    detail: 'Coffee for home, office, meetings, and thoughtful gifts.',
    to: '/coffee',
    icon: 'pi pi-gift',
    tone: 'coffee',
    image: coffeeRange,
  },
];

const heroProduct = computed(() => products.value[0] || null);
const heroCar = computed(() => cars.value[0] || null);

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

function submitSearch() {
  const q = searchTerm.value.trim();
  router.push({ name: 'shop', query: q ? { q } : {} });
}

function productCategoryName(id) {
  const category = productCategories.value.find((item) => item.id === id);
  return category ? content(category, 'name') || category.name : t('Catalog');
}

function carCategoryName(id) {
  const category = carCategories.value.find((item) => item.id === id);
  return category ? content(category, 'name') || category.name : t('Car');
}

function productPriceRange(product) {
  const min = product.price_min != null ? Number(product.price_min) : null;
  const max = product.price_max != null ? Number(product.price_max) : null;
  if (min == null) {
    return t('Price on request');
  }
  if (max != null && max !== min) {
    return `${formatMGA(min)} – ${formatMGA(max)}`;
  }
  return formatMGA(min);
}

async function loadFeaturedProducts() {
  loadingProducts.value = true;
  productError.value = '';
  try {
    const [categoryList, productList] = await Promise.all([
      listCategories(),
      listProducts({ department: 'tech', limit: 3 }),
    ]);
    productCategories.value = categoryList;
    products.value = productList.items || [];
  } catch (err) {
    products.value = [];
    productError.value = err?.message || t('Unable to load featured products');
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
  } catch (err) {
    carCategories.value = [];
    cars.value = [];
    carError.value = err?.message || t('Unable to load featured cars');
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
  <div class="tm-home">
    <section class="home-hero">
      <div class="app-container home-hero__grid">
        <div class="home-hero__copy">
          <p class="home-kicker"><span /> {{ t('Trimobe — Madagascar') }}</p>
          <h1>{{ t('Everything you need, one trusted team.') }}</h1>
          <p class="home-hero__lead">{{ t('Shop, move, celebrate, and care — across Madagascar.') }}</p>

          <div class="home-hero__actions">
            <a class="home-action home-action--primary" href="#services">
              {{ t('Explore services') }} <i class="pi pi-arrow-right" />
            </a>
            <a class="home-action home-action--secondary" href="#how-it-works">
              {{ t('How it works') }} <i class="pi pi-chevron-down" />
            </a>
          </div>
        </div>

        <div class="service-collage" aria-label="Trimobe services">
          <RouterLink class="service-collage__item service-collage__item--phone" to="/tech">
            <img v-if="heroProduct?.primary_image_url" :src="heroProduct.primary_image_url" :alt="content(heroProduct, 'name') || heroProduct.name" />
            <VisualPlaceholder v-else kind="phone" tone="gold" />
            <span>{{ t('Phones') }}</span>
          </RouterLink>

          <RouterLink class="service-collage__item service-collage__item--car" to="/cars">
            <img v-if="heroCar?.primary_image_url" :src="heroCar.primary_image_url" :alt="content(heroCar, 'name') || heroCar.name" />
            <VisualPlaceholder v-else kind="car" tone="emerald" />
            <span>{{ t('Cars') }}</span>
          </RouterLink>

          <RouterLink class="service-collage__item service-collage__item--event" to="/events">
            <img :src="eventPlanningShowcase" alt="Event stage, lighting, catering, and decor" />
            <span>{{ t('Events') }}</span>
          </RouterLink>

          <RouterLink class="service-collage__item service-collage__item--care" to="/healthcare">
            <img :src="homeCareVisit" alt="Doctor visiting a patient at home" />
            <span>{{ t('Healthcare') }}</span>
          </RouterLink>

          <span class="service-collage__leaf service-collage__leaf--one" />
          <span class="service-collage__leaf service-collage__leaf--two" />
        </div>
      </div>
    </section>

    <section id="services" class="home-services">
      <div class="app-container">
        <div class="home-section-head home-section-head--row">
          <div>
            <p class="home-kicker"><span /> {{ t('Explore Trimobe') }}</p>
            <h2>{{ t('One place. Four ways we help.') }}</h2>
            <p>{{ t('What do you need today?') }}</p>
          </div>

          <form class="home-search" @submit.prevent="submitSearch">
            <i class="pi pi-search" />
            <input v-model="searchTerm" type="search" :placeholder="t('Search services and products')" :aria-label="t('Search')" />
            <button type="submit" :aria-label="t('Search')"><i class="pi pi-arrow-right" /></button>
          </form>
        </div>

        <div class="service-door-grid">
          <RouterLink
            v-for="door in serviceDoors"
            :key="door.to"
            class="service-door"
            :class="`service-door--${door.tone}`"
            :to="door.to"
          >
            <div class="service-door__top">
              <span class="service-door__number">{{ door.n }}</span>
              <span class="service-door__icon"><i :class="door.icon" /></span>
            </div>
            <h3>{{ t(door.title) }}</h3>
            <p>{{ t(door.detail) }}</p>
            <div class="service-door__footer">
              <span><i class="pi pi-check-circle" /> {{ t(door.meta) }}</span>
              <i class="pi pi-arrow-right" />
            </div>
          </RouterLink>
        </div>

        <div class="trust-strip">
          <span><i class="pi pi-shield" /> {{ t('Cash') }}</span>
          <span><i class="pi pi-building-columns" /> {{ t('Bank transfer') }}</span>
          <span><i class="pi pi-mobile" /> {{ t('Mobile money') }}</span>
          <span class="trust-strip__ariary"><strong>Ar</strong> {{ t('Prices in Ariary') }}</span>
          <span><i class="pi pi-map-marker" /> {{ t('Across Madagascar') }}</span>
        </div>
      </div>
    </section>

    <section class="home-feature">
      <div class="app-container">
        <div class="home-section-head home-section-head--row">
          <div>
            <p class="home-kicker"><span /> {{ t('Shop') }}</p>
            <h2>{{ t('Featured phones and accessories') }}</h2>
          </div>
          <Button as="router-link" to="/shop" :label="t('All products')" icon="pi pi-arrow-up-right" outlined />
        </div>

        <div v-if="loadingProducts" class="home-state">
          <i class="pi pi-spin pi-spinner" /><span>{{ t('Loading featured products...') }}</span>
        </div>
        <div v-else-if="productError" class="home-state home-state--error">
          <i class="pi pi-exclamation-triangle" /><span>{{ productError }}</span>
        </div>
        <div v-else-if="liveProducts.length" class="home-product-grid">
          <ProductCard v-for="product in liveProducts" :key="product.id" :product="product" />
        </div>
        <div v-else class="home-state">
          <i class="pi pi-inbox" /><span>{{ t('Our latest product selection is being updated.') }}</span>
        </div>
      </div>
    </section>

    <section class="home-feature home-feature--soft">
      <div class="app-container">
        <div class="home-section-head home-section-head--row">
          <div>
            <p class="home-kicker"><span /> {{ t('Mobility') }}</p>
            <h2>{{ t('Cars with driver') }}</h2>
            <p>{{ t('Daily rates shown up front. Bookings keep their price snapshot.') }}</p>
          </div>
          <Button as="router-link" to="/cars" :label="t('Reserve a car')" icon="pi pi-car" />
        </div>

        <div v-if="loadingCars" class="home-state">
          <i class="pi pi-spin pi-spinner" /><span>{{ t('Loading featured cars...') }}</span>
        </div>
        <div v-else-if="carError" class="home-state home-state--error">
          <i class="pi pi-exclamation-triangle" /><span>{{ carError }}</span>
        </div>
        <div v-else-if="liveCars.length" class="home-car-grid">
          <CarCard v-for="car in liveCars" :key="car.id" :car="car" />
        </div>
        <div v-else class="home-state">
          <i class="pi pi-car" /><span>{{ t('Our featured fleet selection is being updated.') }}</span>
        </div>
      </div>
    </section>

    <section class="home-spotlights">
      <div class="app-container home-spotlights__grid">
        <RouterLink class="home-spotlight home-spotlight--event" to="/events">
          <img :src="eventPlanningShowcase" alt="Event planning setup" />
          <div class="home-spotlight__overlay">
            <p class="home-kicker"><span /> {{ t('Event planning') }}</p>
            <h2>{{ t('One team plans every detail.') }}</h2>
            <p>{{ t('Sound, light, catering, decor, staging, and artists in one coordinated request.') }}</p>
            <span class="home-spotlight__action">{{ t('Plan your event') }} <i class="pi pi-arrow-right" /></span>
          </div>
        </RouterLink>

        <RouterLink class="home-spotlight home-spotlight--care" to="/healthcare">
          <img :src="homeCareVisit" alt="Home healthcare visit" />
          <div class="home-spotlight__overlay">
            <p class="home-kicker"><span /> {{ t('Healthcare at home') }}</p>
            <h2>{{ t('Care that comes to you.') }}</h2>
            <p>{{ t('Consultations and ongoing care packages with trusted doctors and nurses.') }}</p>
            <span class="home-spotlight__action">{{ t('Explore healthcare') }} <i class="pi pi-arrow-right" /></span>
          </div>
        </RouterLink>
      </div>
    </section>

    <section class="home-shop">
      <div class="app-container">
        <div class="home-section-head">
          <p class="home-kicker"><span /> {{ t('More from the shop') }}</p>
          <h2>{{ t('Everyday essentials, thoughtfully selected.') }}</h2>
        </div>

        <div class="shop-department-grid">
          <RouterLink
            v-for="department in shopDepartments"
            :key="department.to"
            class="shop-department"
            :class="`shop-department--${department.tone}`"
            :to="department.to"
          >
            <img v-if="department.image" :src="department.image" :alt="department.title" />
            <span class="shop-department__icon"><i :class="department.icon" /></span>
            <div>
              <h3>{{ t(department.title) }}</h3>
              <p>{{ t(department.detail) }}</p>
            </div>
            <i class="pi pi-arrow-up-right" />
          </RouterLink>
        </div>
      </div>
    </section>

    <section id="how-it-works" class="home-how">
      <div class="app-container home-how__panel">
        <div class="home-how__intro">
          <p class="home-kicker"><span /> {{ t('How Trimobe works') }}</p>
          <h2>{{ t('Simple from first look to final confirmation.') }}</h2>
        </div>

        <div class="home-steps">
          <article v-for="step in howItWorks" :key="step.n" class="home-step">
            <span class="home-step__number">{{ step.n }}</span>
            <span class="home-step__icon"><i :class="step.icon" /></span>
            <h3>{{ t(step.title) }}</h3>
            <p>{{ t(step.detail) }}</p>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tm-home {
  overflow: hidden;
}

.home-hero {
  position: relative;
  padding: clamp(56px, 7vw, 108px) 0 clamp(48px, 6vw, 88px);
}

.home-hero::before {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(45deg, rgba(201, 146, 44, 0.035) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(201, 146, 44, 0.035) 25%, transparent 25%);
  background-position: 0 0, 16px 16px;
  background-size: 32px 32px;
  content: "";
  mask-image: linear-gradient(90deg, #000 0%, transparent 54%);
  pointer-events: none;
}

.home-hero__grid {
  display: grid;
  position: relative;
  z-index: 1;
  align-items: center;
  gap: clamp(36px, 6vw, 84px);
  grid-template-columns: minmax(0, 0.92fr) minmax(480px, 1.08fr);
}

.home-kicker {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: var(--tm-gold);
  font-size: 0.74rem;
  font-weight: 950;
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.home-kicker span {
  width: 44px;
  height: 4px;
  border-radius: 999px;
  background: var(--tm-gold);
}

.home-hero h1 {
  max-width: 700px;
  margin: 24px 0 0;
  color: var(--tm-heading);
  font-size: clamp(3.5rem, 7vw, 6.9rem);
  line-height: 0.9;
  letter-spacing: -0.072em;
}

.home-hero__lead {
  max-width: 590px;
  margin: 28px 0 0;
  color: var(--tm-muted);
  font-size: clamp(1.04rem, 1.7vw, 1.3rem);
  line-height: 1.55;
}

.home-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 30px;
}

.home-action {
  display: inline-flex;
  min-height: 54px;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 0 24px;
  border: 1px solid var(--tm-gold);
  border-radius: 16px;
  font-weight: 900;
  transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
}

.home-action:hover {
  transform: translateY(-2px);
}

.home-action--primary {
  border-color: var(--tm-emerald);
  background: var(--tm-emerald);
  box-shadow: 0 16px 36px rgba(12, 155, 128, 0.22);
  color: #fff;
}

.home-action--secondary {
  color: var(--tm-gold);
}

.service-collage {
  display: grid;
  position: relative;
  min-height: 560px;
  grid-template-columns: 0.82fr 1.2fr 0.95fr;
  grid-template-rows: 0.72fr 1fr;
}

.service-collage::before {
  position: absolute;
  z-index: -1;
  inset: 8% 6% 4% 9%;
  border-radius: 48% 52% 44% 56%;
  background: linear-gradient(135deg, rgba(201, 146, 44, 0.16), rgba(12, 155, 128, 0.08));
  content: "";
  filter: blur(8px);
}

.service-collage__item {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 3px solid var(--tm-surface);
  border-radius: 34px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.service-collage__item:hover {
  z-index: 5;
  box-shadow: var(--tm-shadow-hover);
  transform: translateY(-5px) scale(1.015);
}

.service-collage__item img,
.service-collage__item :deep(.visual) {
  width: 100%;
  height: 100%;
  min-height: 100%;
  border-radius: inherit;
  object-fit: cover;
}

.service-collage__item::after {
  position: absolute;
  inset: auto 0 0;
  height: 45%;
  background: linear-gradient(180deg, transparent, rgba(8, 12, 13, 0.72));
  content: "";
  pointer-events: none;
}

.service-collage__item > span {
  position: absolute;
  z-index: 2;
  bottom: 16px;
  left: 18px;
  color: #fff;
  font-size: 0.82rem;
  font-weight: 900;
}

.service-collage__item--phone {
  z-index: 2;
  grid-column: 1 / 2;
  grid-row: 1 / 3;
  margin: 46px -10px 54px 0;
}

.service-collage__item--car {
  grid-column: 2 / 3;
  grid-row: 1 / 2;
  margin: 0 -12px -12px 0;
}

.service-collage__item--event {
  z-index: 1;
  grid-column: 3 / 4;
  grid-row: 1 / 3;
  margin: 80px 0 30px -2px;
}

.service-collage__item--care {
  z-index: 3;
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  margin: -6px -28px 0 -26px;
}

.service-collage__leaf {
  position: absolute;
  z-index: 4;
  width: 130px;
  height: 62px;
  border-radius: 100% 0 100% 0;
  background: linear-gradient(135deg, #174f45, #418372);
  opacity: 0.9;
  transform: rotate(28deg);
  pointer-events: none;
}

.service-collage__leaf--one {
  bottom: 54px;
  left: 10px;
}

.service-collage__leaf--two {
  bottom: 10px;
  left: 72px;
  width: 96px;
  height: 44px;
  background: linear-gradient(135deg, #c9922c, #e6bc67);
  transform: rotate(-16deg);
}

.home-services,
.home-feature,
.home-shop,
.home-how {
  padding: clamp(66px, 8vw, 112px) 0;
}

.home-services {
  border-block: 1px solid var(--tm-border);
  background: rgba(255, 253, 248, 0.46);
}

:global(.trimobe-dark) .home-services {
  background: rgba(23, 29, 31, 0.36);
}

.home-section-head {
  margin-bottom: 34px;
}

.home-section-head--row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
}

.home-section-head h2,
.home-how h2 {
  max-width: 820px;
  margin: 16px 0 0;
  color: var(--tm-heading);
  font-size: clamp(2.4rem, 5vw, 4.7rem);
  line-height: 0.96;
  letter-spacing: -0.055em;
}

.home-section-head > div > p:not(.home-kicker),
.home-section-head > p:not(.home-kicker) {
  margin: 14px 0 0;
  color: var(--tm-muted);
}

.home-search {
  display: grid;
  width: min(100%, 420px);
  min-height: 54px;
  align-items: center;
  grid-template-columns: auto 1fr auto;
  gap: 12px;
  padding: 6px 7px 6px 18px;
  border: 1px solid var(--tm-border-strong);
  border-radius: 17px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.home-search > i {
  color: var(--tm-muted);
}

.home-search input {
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--tm-text);
}

.home-search button {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 0;
  border-radius: 13px;
  background: var(--tm-emerald);
  color: #fff;
  cursor: pointer;
}

.service-door-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.service-door {
  display: grid;
  min-height: 280px;
  grid-template-rows: auto auto 1fr auto;
  gap: 14px;
  padding: 24px;
  border: 1px solid var(--tm-border);
  border-radius: var(--tm-radius);
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
  transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
}

.service-door:hover {
  border-color: rgba(12, 155, 128, 0.34);
  box-shadow: var(--tm-shadow-hover);
  transform: translateY(-5px);
}

.service-door__top,
.service-door__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.service-door__number {
  color: var(--tm-gold);
  font-size: 0.98rem;
  font-weight: 950;
}

.service-door__icon {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 17px;
  background: rgba(12, 155, 128, 0.11);
  color: var(--tm-emerald-dark);
  font-size: 1.25rem;
}

.service-door--gold .service-door__icon {
  background: rgba(201, 146, 44, 0.14);
  color: var(--tm-gold);
}

.service-door--coral .service-door__icon {
  background: rgba(206, 107, 85, 0.13);
  color: var(--tm-coral);
}

.service-door h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.35rem;
  line-height: 1.1;
}

.service-door > p {
  margin: 0;
  color: var(--tm-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.service-door__footer {
  padding-top: 16px;
  border-top: 1px solid var(--tm-border);
  color: var(--tm-emerald-dark);
}

.service-door--gold .service-door__footer {
  color: var(--tm-gold);
}

.service-door--coral .service-door__footer {
  color: var(--tm-coral);
}

.service-door__footer span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 0.78rem;
  font-weight: 850;
}

.trust-strip {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 6px 26px;
  margin-top: 22px;
  padding: 18px 24px;
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background: var(--tm-surface-soft);
  color: var(--tm-muted);
  font-size: 0.86rem;
}

.trust-strip span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.trust-strip i {
  color: var(--tm-gold);
}

.trust-strip__ariary {
  color: var(--tm-heading);
}

.trust-strip__ariary strong {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  background: var(--tm-gold);
  color: #fff;
}

.home-feature--soft {
  background: linear-gradient(180deg, rgba(12, 155, 128, 0.05), transparent);
}

.home-product-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.home-car-grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.home-state {
  display: grid;
  min-height: 220px;
  place-items: center;
  gap: 10px;
  padding: 30px;
  border: 1px solid var(--tm-border);
  border-radius: var(--tm-radius);
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

.home-spotlights {
  padding: clamp(36px, 6vw, 80px) 0;
}

.home-spotlights__grid {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.home-spotlight {
  position: relative;
  min-height: 570px;
  overflow: hidden;
  border-radius: 32px;
  background: var(--tm-charcoal);
  box-shadow: var(--tm-shadow);
}

.home-spotlight img {
  width: 100%;
  height: 100%;
  min-height: 570px;
  object-fit: cover;
  transition: transform 500ms ease;
}

.home-spotlight:hover img {
  transform: scale(1.035);
}

.home-spotlight::after {
  position: absolute;
  inset: 25% 0 0;
  background: linear-gradient(180deg, transparent, rgba(7, 12, 13, 0.88));
  content: "";
}

.home-spotlight__overlay {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  padding: clamp(26px, 5vw, 48px);
  color: #fff;
}

.home-spotlight__overlay h2 {
  margin: 16px 0 0;
  font-size: clamp(2rem, 4vw, 3.7rem);
  line-height: 0.96;
  letter-spacing: -0.05em;
}

.home-spotlight__overlay > p:not(.home-kicker) {
  max-width: 560px;
  margin: 16px 0 0;
  color: rgba(255, 255, 255, 0.76);
  line-height: 1.6;
}

.home-spotlight__action {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin-top: 24px;
  color: #fff;
  font-weight: 900;
}

.shop-department-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.shop-department {
  display: grid;
  position: relative;
  min-height: 240px;
  overflow: hidden;
  grid-template-columns: auto 1fr auto;
  align-items: end;
  gap: 18px;
  padding: 26px;
  border: 1px solid var(--tm-border);
  border-radius: var(--tm-radius);
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.shop-department::before {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 78% 20%, rgba(12, 155, 128, 0.17), transparent 36%);
  content: "";
}

.shop-department--fashion::before {
  background: radial-gradient(circle at 78% 20%, rgba(206, 107, 85, 0.17), transparent 36%);
}

.shop-department img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.28;
}

.shop-department > *:not(img) {
  position: relative;
  z-index: 1;
}

.shop-department__icon {
  display: grid;
  width: 56px;
  height: 56px;
  place-items: center;
  border-radius: 18px;
  background: rgba(12, 155, 128, 0.12);
  color: var(--tm-emerald-dark);
  font-size: 1.35rem;
}

.shop-department h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.5rem;
}

.shop-department p {
  margin: 8px 0 0;
  color: var(--tm-muted);
  line-height: 1.55;
}

.home-how {
  padding-top: 30px;
}

.home-how__panel {
  display: grid;
  gap: clamp(32px, 6vw, 80px);
  grid-template-columns: minmax(260px, 0.72fr) minmax(0, 1.6fr);
  padding: clamp(32px, 6vw, 62px);
  border: 1px solid var(--tm-border);
  border-radius: 32px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.home-how h2 {
  font-size: clamp(2.25rem, 4.5vw, 4.2rem);
}

.home-steps {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.home-step {
  position: relative;
  padding: 22px 18px;
  border-left: 1px solid var(--tm-border);
}

.home-step__number {
  color: var(--tm-gold);
  font-weight: 950;
}

.home-step__icon {
  display: grid;
  width: 52px;
  height: 52px;
  margin-top: 28px;
  place-items: center;
  border: 1px solid var(--tm-border);
  border-radius: 17px;
  color: var(--tm-emerald);
  font-size: 1.2rem;
}

.home-step h3 {
  margin: 18px 0 0;
  color: var(--tm-heading);
  font-size: 1.1rem;
}

.home-step p {
  margin: 10px 0 0;
  color: var(--tm-muted);
  font-size: 0.9rem;
  line-height: 1.6;
}

@media (max-width: 1120px) {
  .home-hero__grid {
    grid-template-columns: 1fr;
  }

  .home-hero__copy {
    max-width: 820px;
  }

  .service-collage {
    min-height: 520px;
  }

  .service-door-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .home-how__panel {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 820px) {
  .home-section-head--row {
    align-items: stretch;
    flex-direction: column;
  }

  .home-search {
    width: 100%;
  }

  .home-product-grid,
  .home-car-grid,
  .home-spotlights__grid,
  .shop-department-grid {
    grid-template-columns: 1fr;
  }

  .home-spotlight,
  .home-spotlight img {
    min-height: 500px;
  }

  .home-steps {
    grid-template-columns: 1fr;
  }

  .home-step {
    display: grid;
    align-items: start;
    grid-template-columns: auto 1fr;
    gap: 4px 18px;
    border-top: 1px solid var(--tm-border);
    border-left: 0;
  }

  .home-step__number,
  .home-step__icon {
    grid-column: 1;
  }

  .home-step__icon {
    grid-row: 2 / 4;
    margin-top: 8px;
  }

  .home-step h3,
  .home-step p {
    grid-column: 2;
  }
}

@media (max-width: 620px) {
  .home-hero {
    padding-top: 46px;
  }

  .home-hero h1 {
    font-size: clamp(3.3rem, 16vw, 5.1rem);
  }

  .home-hero__actions {
    display: grid;
    grid-template-columns: 1fr 0.78fr;
  }

  .home-action {
    min-height: 52px;
    padding: 0 14px;
    font-size: 0.88rem;
  }

  .service-collage {
    min-height: 420px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .service-collage__item {
    margin: 0;
    border-width: 2px;
    border-radius: 23px;
  }

  .service-collage__item--phone,
  .service-collage__item--car,
  .service-collage__item--event,
  .service-collage__item--care {
    grid-column: auto;
    grid-row: auto;
  }

  .service-collage__item--care {
    margin-top: -22px;
  }

  .service-collage__item--event {
    margin-bottom: 22px;
  }

  .service-collage__leaf {
    display: none;
  }

  .service-door-grid {
    grid-template-columns: 1fr;
  }

  .service-door {
    min-height: 0;
  }

  .trust-strip {
    justify-content: flex-start;
  }

  .home-spotlight,
  .home-spotlight img {
    min-height: 460px;
  }

  .home-how__panel {
    padding: 28px 18px;
    border-radius: 24px;
  }
}
</style>
