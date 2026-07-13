<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import CarCard from '@/components/CarCard.vue';
import ProductCard from '@/components/ProductCard.vue';
import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import { listArtists, listCarCategories, listCars, listCategories, listProducts } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';
import { homepageOffers } from '@/data/trimobe';

const router = useRouter();
const { content, t } = usePublicI18n();

const searchTerm = ref('');
const products = ref([]);
const productCategories = ref([]);
const cars = ref([]);
const carCategories = ref([]);
const artists = ref([]);
const productMeta = ref({ total: 0 });
const carMeta = ref({ total: 0 });
const loadingProducts = ref(false);
const loadingCars = ref(false);
const loadingArtists = ref(false);
const productError = ref('');
const carError = ref('');

const eventOffer = computed(() => homepageOffers.find((offer) => offer.id === 'events'));
const coffeeOffer = computed(() => homepageOffers.find((offer) => offer.id === 'coffee'));

// The four service "doors" — the primary way into each domain.
const serviceDoors = [
  { n: '01', title: 'Phones & accessories', detail: 'Devices, audio, and chargers with clear stock and Ariary pricing.', to: '/tech', icon: 'pi pi-mobile' },
  { n: '02', title: 'Cars with driver', detail: 'Chauffeured vehicles by the day, booked around your dates.', to: '/cars', icon: 'pi pi-car' },
  { n: '03', title: 'Event planning', detail: 'Sound, light, catering, and gospel artists in one request.', to: '/events', icon: 'pi pi-calendar' },
  { n: '04', title: 'Healthcare', detail: 'Home consultations and care packages with doctors and nurses.', to: '/healthcare', icon: 'pi pi-heart' },
];

const howItWorks = [
  { n: '01', title: 'Browse freely', detail: 'Explore phones, cars, event services, and artists — no account needed to look.' },
  { n: '02', title: 'Request or reserve', detail: 'Add to cart, book a car by date, or send an event request. Sign in at checkout.' },
  { n: '03', title: 'Pay with the team', detail: 'Settle by cash, transfer, or mobile money; we confirm it against your order.' },
];

const proofPoints = [
  { label: 'Payment', value: 'Cash · transfer · mobile money' },
  { label: 'Cars', value: 'Driver included' },
  { label: 'Pricing', value: 'Ariary (MGA)' },
  { label: 'Coverage', value: 'Across Madagascar' },
];

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

const featuredArtists = computed(() => artists.value.slice(0, 5));

// Hero carousel: one slide per service, using live inventory imagery where
// available and falling back to the brand visual placeholder otherwise.
const heroSlides = computed(() => [
  {
    key: 'phones',
    eyebrow: 'Phones & accessories',
    caption: products.value[0] ? content(products.value[0], 'name') || products.value[0].name : t('Premium devices'),
    image: products.value[0]?.primary_image_url || '',
    visualKind: 'phone',
    to: '/tech',
  },
  {
    key: 'cars',
    eyebrow: 'Cars with driver',
    caption: cars.value[0] ? content(cars.value[0], 'name') || cars.value[0].name : t('Chauffeured fleet'),
    image: cars.value[0]?.primary_image_url || '',
    visualKind: 'car',
    to: '/cars',
  },
  {
    key: 'events',
    eyebrow: 'Event planning',
    caption: t('Sound, light, catering & artists'),
    image: eventOffer.value?.image || '',
    visualKind: 'event',
    to: '/events',
  },
  {
    key: 'coffee',
    eyebrow: 'Kafe Misiona',
    caption: t('Coffee for service & gifts'),
    image: coffeeOffer.value?.image || '',
    visualKind: 'coffee',
    to: '/coffee',
  },
]);

const activeSlide = ref(0);
let slideTimer = null;

function startCarousel() {
  stopCarousel();
  slideTimer = window.setInterval(() => {
    activeSlide.value = (activeSlide.value + 1) % heroSlides.value.length;
  }, 4500);
}

function stopCarousel() {
  if (slideTimer) {
    window.clearInterval(slideTimer);
    slideTimer = null;
  }
}

// Manual dot: jump to a slide and restart the auto-advance timer.
function goToSlide(index) {
  activeSlide.value = index;
  startCarousel();
}

function submitSearch() {
  const q = searchTerm.value.trim();
  router.push({ name: 'tech', query: q ? { q } : {} });
}

function productCategoryName(id) {
  const category = productCategories.value.find((item) => item.id === id);
  return category ? content(category, 'name') || category.name : 'Catalog';
}

function carCategoryName(id) {
  const category = carCategories.value.find((item) => item.id === id);
  return category ? content(category, 'name') || category.name : 'Car';
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

function artistGenre(artist) {
  const first = String(artist.genres || '').split(',')[0]?.trim();
  return first || t('Gospel artist');
}

function artistInitial(artist) {
  return String(artist.stage_name || '?').trim().charAt(0).toUpperCase();
}

async function loadFeaturedProducts() {
  loadingProducts.value = true;
  productError.value = '';
  try {
    // Featured store products are the Tech department only — coffee has its own
    // section/slide, so it must not leak into "Phones & accessories".
    const [categoryList, productList] = await Promise.all([listCategories(), listProducts({ department: 'tech', limit: 3 })]);
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
    const [categoryList, carList] = await Promise.all([listCarCategories(), listCars({ limit: 2 })]);
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

async function loadFeaturedArtists() {
  loadingArtists.value = true;
  try {
    artists.value = await listArtists();
  } catch {
    artists.value = [];
  } finally {
    loadingArtists.value = false;
  }
}

onMounted(() => {
  loadFeaturedProducts();
  loadFeaturedCars();
  loadFeaturedArtists();
  startCarousel();
});

onBeforeUnmount(stopCarousel);
</script>

<template>
  <!-- ============ HERO ============ -->
  <section class="hero">
    <div class="app-container hero__grid">
      <div class="hero__copy">
        <p class="kicker">{{ t('Trimobe — Madagascar') }}</p>
        <h1>{{ t('One platform for phones, cars, events, and coffee.') }}</h1>
        <p class="hero__lead">
          {{ t('Browse premium devices, reserve chauffeured cars, plan a full event with gospel artists, and shop Kafe Misiona — with a team that handles payment personally.') }}
        </p>

        <form class="hero__search" @submit.prevent="submitSearch">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="searchTerm" :placeholder="t('Search phones, coffee, accessories, or cars')" :aria-label="t('Search')" />
          </IconField>
          <Button type="submit" :label="t('Search')" icon="pi pi-arrow-right" />
        </form>

        <nav class="hero__index" :aria-label="t('Trimobe services')">
          <RouterLink v-for="door in serviceDoors" :key="door.to" :to="door.to">
            <span class="hero__index-n">{{ door.n }}</span>
            <span>{{ t(door.title) }}</span>
          </RouterLink>
        </nav>
      </div>

      <div class="hero__visual">
        <div class="hero-carousel" @mouseenter="stopCarousel" @mouseleave="startCarousel">
          <div class="hero-carousel__track" :style="{ transform: `translateX(-${activeSlide * 100}%)` }">
            <RouterLink v-for="slide in heroSlides" :key="slide.key" class="hero-carousel__slide" :to="slide.to">
              <img v-if="slide.image" :src="slide.image" :alt="slide.caption" />
              <VisualPlaceholder v-else :kind="slide.visualKind" />
              <div class="hero-carousel__caption">
                <span>{{ t(slide.eyebrow) }}</span>
                <strong>{{ slide.caption }}</strong>
              </div>
            </RouterLink>
          </div>

          <div class="hero-carousel__dots">
            <button
              v-for="(slide, index) in heroSlides"
              :key="slide.key"
              type="button"
              :class="{ 'is-active': index === activeSlide }"
              :aria-label="t(slide.eyebrow)"
              @click="goToSlide(index)"
            />
          </div>
        </div>

        <!-- <div class="hero__badge">
          <span>{{ t('Assisted payment') }}</span>
          <strong>{{ t('Cash · transfer · mobile money') }}</strong>
        </div> -->
      </div>
    </div>
  </section>

  <!-- ============ SERVICE INDEX ============ -->
  <section class="doors">
    <div class="app-container">
      <div class="editorial-head">
        <p class="kicker">{{ t('The services') }}</p>
        <h2>{{ t('Four ways Trimobe works for you.') }}</h2>
      </div>
      <div class="doors__grid">
        <RouterLink v-for="door in serviceDoors" :key="door.to" class="door" :to="door.to">
          <span class="door__n">{{ door.n }}</span>
          <i :class="door.icon" />
          <h3>{{ t(door.title) }}</h3>
          <p>{{ t(door.detail) }}</p>
          <span class="door__go"><i class="pi pi-arrow-up-right" /></span>
        </RouterLink>
      </div>
    </div>
  </section>

  <!-- ============ PHONES (live) ============ -->
  <section class="feature">
    <div class="app-container">
      <div class="editorial-head editorial-head--row">
        <div>
          <p class="kicker">{{ t('01 — Store') }}</p>
          <h2>{{ t('Featured phones and accessories') }}</h2>
        </div>
        <Button as="router-link" to="/tech" :label="t('All products')" icon="pi pi-arrow-up-right" outlined />
      </div>

      <div v-if="loadingProducts" class="state">
        <i class="pi pi-spin pi-spinner" /><span>{{ t('Loading featured products...') }}</span>
      </div>
      <div v-else-if="productError" class="state state--error">
        <i class="pi pi-exclamation-triangle" /><span>{{ productError }}</span>
      </div>
      <div v-else-if="liveProducts.length" class="grid-3">
        <ProductCard v-for="product in liveProducts" :key="product.id" :product="product" />
      </div>
      <div v-else class="state">
        <i class="pi pi-inbox" /><span>{{ t('Our latest product selection is being updated.') }}</span>
      </div>
    </div>
  </section>

  <!-- ============ CARS (live) ============ -->
  <section class="feature feature--tinted">
    <div class="app-container">
      <div class="editorial-head editorial-head--row">
        <div>
          <p class="kicker">{{ t('02 — Mobility') }}</p>
          <h2>{{ t('Cars with driver') }}</h2>
          <p class="editorial-copy">{{ t('Daily rates shown up front. Bookings keep their price snapshot.') }}</p>
        </div>
        <Button as="router-link" to="/cars" :label="t('Reserve a car')" icon="pi pi-car" />
      </div>

      <div v-if="loadingCars" class="state">
        <i class="pi pi-spin pi-spinner" /><span>{{ t('Loading featured cars...') }}</span>
      </div>
      <div v-else-if="carError" class="state state--error">
        <i class="pi pi-exclamation-triangle" /><span>{{ carError }}</span>
      </div>
      <div v-else-if="liveCars.length" class="grid-2">
        <CarCard v-for="car in liveCars" :key="car.id" :car="car" />
      </div>
      <div v-else class="state">
        <i class="pi pi-car" /><span>{{ t('Our featured fleet selection is being updated.') }}</span>
      </div>
    </div>
  </section>

  <!-- ============ EVENTS × GOSPEL ARTISTS (dark signature band) ============ -->
  <section class="signature">
    <div class="app-container signature__grid">
      <div class="signature__copy">
        <p class="kicker kicker--gold">{{ t('03 — Events') }}</p>
        <h2>{{ t('One team plans your event — artists included.') }}</h2>
        <p>
          {{ t('Sound, lighting, catering, decor, and the gospel artists we partner with, brought together for weddings, crusades, concerts, and conferences.') }}
        </p>
        <div class="signature__actions">
          <Button as="router-link" to="/events/plan" :label="t('Plan your event')" icon="pi pi-calendar-plus" />
          <Button as="router-link" to="/events/artists" :label="t('Meet the artists')" icon="pi pi-microphone" outlined />
        </div>
      </div>

      <figure v-if="eventOffer?.image" class="signature__image">
        <img :src="eventOffer.image" :alt="eventOffer.imageAlt" />
      </figure>
    </div>

    <div v-if="featuredArtists.length" class="app-container signature__artists">
      <p class="kicker kicker--gold">{{ t('Gospel artists') }}</p>
      <div class="artist-strip">
        <RouterLink
          v-for="artist in featuredArtists"
          :key="artist.id"
          class="artist-chip"
          :to="{ name: 'artist-detail', params: { slug: artist.slug } }"
        >
          <span class="artist-chip__avatar">
            <img v-if="artist.photo_url" :src="artist.photo_url" :alt="artist.stage_name" loading="lazy" />
            <span v-else>{{ artistInitial(artist) }}</span>
          </span>
          <span class="artist-chip__name">{{ artist.stage_name }}</span>
          <span class="artist-chip__genre">{{ artistGenre(artist) }}</span>
        </RouterLink>
      </div>
    </div>
  </section>

  <!-- ============ COFFEE (brand teaser) ============ -->
  <section class="coffee">
    <div class="app-container coffee__grid">
      <figure v-if="coffeeOffer?.image" class="coffee__image">
        <img :src="coffeeOffer.image" :alt="coffeeOffer.imageAlt" />
      </figure>
      <div class="coffee__copy">
        <p class="kicker">{{ t('04 — Kafe Misiona') }}</p>
        <h2>{{ t('Trimobe’s coffee, for daily service and gifting.') }}</h2>
        <p>{{ t('Rich, gift-ready coffee for homes, offices, meetings, and thoughtful customer welcomes across Madagascar.') }}</p>
        <Button as="router-link" to="/coffee" :label="t('View Kafe Misiona')" icon="pi pi-shopping-bag" />
      </div>
    </div>
  </section>

  <!-- ============ HOW IT WORKS ============ -->
  <section class="feature">
    <div class="app-container">
      <div class="editorial-head">
        <p class="kicker">{{ t('How it works') }}</p>
        <h2>{{ t('Browse, request, and settle in person.') }}</h2>
      </div>
      <div class="steps">
        <article v-for="step in howItWorks" :key="step.n" class="step">
          <span class="step__n">{{ step.n }}</span>
          <h3>{{ t(step.title) }}</h3>
          <p>{{ t(step.detail) }}</p>
        </article>
      </div>
    </div>
  </section>

  <!-- ============ PROOF POINTS ============ -->
  <section class="proof">
    <div class="app-container proof__grid">
      <div v-for="point in proofPoints" :key="point.label" class="proof__item">
        <span>{{ t(point.label) }}</span>
        <strong>{{ t(point.value) }}</strong>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ---------- shared editorial primitives ---------- */
.kicker {
  margin: 0;
  color: var(--tm-gold);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.kicker--gold {
  color: var(--tm-gold);
}

.editorial-head {
  display: grid;
  gap: 10px;
  margin-bottom: 30px;
}

.editorial-head h2,
.doors h2,
.signature h2,
.coffee h2,
.feature h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2rem, 4.6vw, 3.6rem);
  line-height: 1.02;
  letter-spacing: -0.01em;
}

.editorial-head--row {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
}

.editorial-copy {
  max-width: 520px;
  margin: 12px 0 0;
  color: var(--tm-muted);
  line-height: 1.6;
}

.state {
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

.state i {
  color: var(--tm-gold);
  font-size: 1.5rem;
}

.state--error i {
  color: var(--tm-coral);
}

.grid-3 {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.grid-2 {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* ---------- hero ---------- */
.hero {
  padding: clamp(36px, 6vw, 76px) 0 clamp(30px, 5vw, 60px);
  background: var(--tm-body-bg);
}

.hero__grid {
  display: grid;
  align-items: center;
  gap: clamp(28px, 5vw, 56px);
  grid-template-columns: minmax(0, 1.15fr) minmax(320px, 0.85fr);
}

.hero__copy {
  min-width: 0;
}

.hero h1 {
  margin: 16px 0 0;
  color: var(--tm-heading);
  font-size: 4rem;
  line-height: 0.98;
  letter-spacing: -0.02em;
}

.hero__lead {
  max-width: 56ch;
  margin: 22px 0 0;
  color: var(--tm-muted);
  font-size: clamp(1.02rem, 1.6vw, 1.24rem);
  line-height: 1.62;
}

.hero__search {
  display: grid;
  width: min(100%, 640px);
  grid-template-columns: 1fr auto;
  gap: 10px;
  margin-top: 28px;
  padding: 8px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.hero__search :deep(.p-iconfield) {
  width: 100%;
}

.hero__search :deep(.p-inputtext) {
  width: 100%;
  min-height: 46px;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.hero__search :deep(.p-button) {
  border-radius: 999px;
}

.hero__index {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 26px;
  margin-top: 26px;
}

.hero__index a {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  color: var(--tm-nav-text);
  font-weight: 820;
}

.hero__index a:hover {
  color: var(--tm-heading);
}

.hero__index-n {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
}

.hero__visual {
  position: relative;
  min-width: 0;
}

.hero-carousel {
  position: relative;
  aspect-ratio: 4 / 5;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background: var(--tm-charcoal);
  box-shadow: var(--tm-shadow);
}

.hero-carousel__track {
  display: flex;
  height: 100%;
  transition: transform 620ms cubic-bezier(0.4, 0, 0.2, 1);
}

.hero-carousel__slide {
  position: relative;
  display: block;
  flex: 0 0 100%;
  height: 100%;
  color: #fff;
}

.hero-carousel__slide img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-carousel__slide :deep(.visual) {
  width: 100%;
  height: 100%;
  min-height: 0;
  border-radius: 0;
}

.hero-carousel__caption {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  gap: 3px;
  padding: 46px 22px 20px;
  background: linear-gradient(180deg, transparent, rgba(17, 19, 21, 0.72));
}

.hero-carousel__caption span {
  color: var(--tm-gold);
  font-size: 0.74rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.hero-carousel__caption strong {
  color: #fff;
  font-size: 1.12rem;
  line-height: 1.2;
}

.hero-carousel__dots {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  gap: 6px;
}

.hero-carousel__dots button {
  width: 22px;
  height: 4px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: background 200ms ease, width 200ms ease;
}

.hero-carousel__dots button.is-active {
  width: 30px;
  background: var(--tm-gold);
}

.hero__badge {
  position: absolute;
  left: -14px;
  bottom: 24px;
  display: grid;
  gap: 2px;
  padding: 14px 18px;
  border: 1px solid var(--tm-border);
  border-radius: 12px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.hero__badge span {
  color: var(--tm-gold);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero__badge strong {
  color: var(--tm-heading);
  font-size: 0.95rem;
}

/* ---------- service doors ---------- */
.doors {
  padding: clamp(48px, 6vw, 80px) 0;
}

.doors__grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.door {
  display: grid;
  align-content: start;
  gap: 12px;
  position: relative;
  min-height: 226px;
  padding: 24px;
  border: 1px solid var(--tm-border);
  border-radius: 14px;
  background: var(--tm-surface);
  color: inherit;
  overflow: hidden;
  transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.door:hover {
  border-color: rgba(8, 124, 104, 0.34);
  transform: translateY(-3px);
  box-shadow: var(--tm-shadow);
}

.door__n {
  color: var(--tm-gold);
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.08em;
}

.door i:not(.pi-arrow-up-right) {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border-radius: 12px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  font-size: 1.2rem;
}

.door h3 {
  margin: 4px 0 0;
  color: var(--tm-heading);
  font-size: 1.24rem;
  line-height: 1.15;
}

.door p {
  margin: 0;
  color: var(--tm-muted);
  font-size: 0.92rem;
  line-height: 1.5;
}

.door__go {
  position: absolute;
  top: 22px;
  right: 22px;
  color: var(--tm-muted);
  transition: color 160ms ease, transform 160ms ease;
}

.door:hover .door__go {
  color: var(--tm-emerald);
  transform: translate(2px, -2px);
}

/* ---------- feature sections ---------- */
.feature {
  padding: clamp(48px, 6vw, 84px) 0;
}

.feature--tinted {
  background: var(--tm-surface-muted);
  border-block: 1px solid var(--tm-border);
}

/* ---------- signature (dark) events × artists ---------- */
.signature {
  padding: clamp(52px, 7vw, 92px) 0;
  background:
    radial-gradient(1200px 400px at 80% -10%, rgba(185, 138, 46, 0.18), transparent 60%),
    var(--tm-charcoal);
  color: #fff;
}

.signature__grid {
  display: grid;
  align-items: center;
  gap: clamp(28px, 5vw, 56px);
  grid-template-columns: minmax(0, 1.05fr) minmax(300px, 0.8fr);
}

.signature h2 {
  color: #fff;
  max-width: 18ch;
}

.signature__copy > p:not(.kicker) {
  max-width: 54ch;
  margin: 20px 0 0;
  color: rgba(255, 255, 255, 0.74);
  font-size: clamp(1rem, 1.6vw, 1.16rem);
  line-height: 1.62;
}

.signature__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 26px;
}

.signature__actions :deep(.p-button-outlined) {
  border-color: rgba(255, 255, 255, 0.34);
  color: #fff;
}

.signature__image {
  margin: 0;
  aspect-ratio: 16 / 11;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 16px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4);
}

.signature__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.signature__artists {
  margin-top: clamp(36px, 5vw, 60px);
}

.artist-strip {
  display: flex;
  gap: 14px;
  margin-top: 16px;
  padding-bottom: 6px;
  overflow-x: auto;
  scrollbar-width: none;
}

.artist-strip::-webkit-scrollbar {
  display: none;
}

.artist-chip {
  display: grid;
  flex: 0 0 auto;
  justify-items: center;
  gap: 8px;
  width: 132px;
  padding: 18px 12px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  color: #fff;
  text-align: center;
  transition: border-color 160ms ease, background 160ms ease, transform 160ms ease;
}

.artist-chip:hover {
  border-color: rgba(215, 171, 84, 0.5);
  background: rgba(255, 255, 255, 0.07);
  transform: translateY(-2px);
}

.artist-chip__avatar {
  display: grid;
  width: 72px;
  height: 72px;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(185, 138, 46, 0.4), rgba(28, 32, 34, 0.9));
  color: var(--tm-gold);
  font-size: 1.7rem;
  font-weight: 900;
}

.artist-chip__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artist-chip__name {
  color: #fff;
  font-weight: 850;
  font-size: 0.95rem;
  line-height: 1.2;
}

.artist-chip__genre {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.78rem;
  font-weight: 700;
}

/* ---------- coffee teaser ---------- */
.coffee {
  padding: clamp(48px, 6vw, 84px) 0;
  background: linear-gradient(180deg, var(--tm-gold-soft), transparent 70%), var(--tm-surface-muted);
}

.coffee__grid {
  display: grid;
  align-items: center;
  gap: clamp(24px, 5vw, 52px);
  grid-template-columns: minmax(300px, 0.9fr) minmax(0, 1.1fr);
}

.coffee__image {
  margin: 0;
  aspect-ratio: 5 / 4;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: var(--tm-stone);
  box-shadow: var(--tm-shadow);
}

.coffee__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.coffee__copy > p:not(.kicker) {
  max-width: 52ch;
  margin: 18px 0 24px;
  color: var(--tm-muted);
  font-size: clamp(1rem, 1.5vw, 1.14rem);
  line-height: 1.6;
}

/* ---------- how it works ---------- */
.steps {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.step {
  padding: 26px 24px;
  border-top: 2px solid var(--tm-gold);
  background: var(--tm-surface);
  border-radius: 0 0 12px 12px;
}

.step__n {
  color: var(--tm-gold);
  font-size: 2.2rem;
  font-weight: 950;
  line-height: 1;
}

.step h3 {
  margin: 14px 0 8px;
  color: var(--tm-heading);
  font-size: 1.3rem;
}

.step p {
  margin: 0;
  color: var(--tm-muted);
  line-height: 1.6;
}

/* ---------- proof ---------- */
.proof {
  padding: 26px 0;
  border-top: 1px solid var(--tm-border);
  background: var(--tm-charcoal);
}

.proof__grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.proof__item {
  display: grid;
  gap: 4px;
  padding: 6px 18px;
  border-left: 3px solid var(--tm-gold);
}

.proof__item span {
  color: rgba(255, 255, 255, 0.56);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.proof__item strong {
  color: #fff;
  font-size: 1rem;
}

/* ---------- responsive ---------- */
@media (max-width: 980px) {
  .hero__grid,
  .signature__grid,
  .coffee__grid {
    grid-template-columns: 1fr;
  }

  .hero__visual {
    order: -1;
  }

  .hero-carousel {
    aspect-ratio: 16 / 10;
  }

  .coffee__image {
    order: -1;
  }

  .doors__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grid-3 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .editorial-head--row {
    align-items: stretch;
    flex-direction: column;
  }

  .steps,
  .proof__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .grid-2,
  .grid-3 {
    grid-template-columns: 1fr;
  }

  .hero__search .p-button :deep(.p-button-label) {
    display: inline;
  }
}

@media (max-width: 520px) {
  .doors__grid,
  .steps,
  .proof__grid {
    grid-template-columns: 1fr;
  }

  .hero__badge {
    left: 12px;
  }
}
</style>
