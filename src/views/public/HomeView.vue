<script setup>
import { ref } from 'vue';

import CarCard from '@/components/CarCard.vue';
import ProductCard from '@/components/ProductCard.vue';
import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import {
  carCategories,
  featuredCoffee,
  featuredCars,
  featuredProducts,
  homepageOffers,
  services,
  trustSignals,
} from '@/data/trimobe';

const selectedService = ref('phones');
const startDate = ref(new Date());
const endDate = ref(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
</script>

<template>
  <section class="home-hero">
    <div class="app-container">
      <Carousel
        class="offer-carousel"
        :value="homepageOffers"
        :numVisible="1"
        :numScroll="1"
        circular
        :autoplayInterval="5600"
        :showNavigators="false"
      >
        <template #item="{ data }">
          <article class="offer-slide" :class="`offer-slide--${data.tone}`">
            <div class="offer-slide__copy">
              <p class="eyebrow">{{ data.eyebrow }}</p>
              <h1>{{ data.title }}</h1>
              <p>{{ data.description }}</p>
              <div class="offer-slide__actions">
                <Button as="router-link" :to="data.actionTo" :label="data.actionLabel" :icon="data.icon" />
                <Button
                  as="router-link"
                  :to="data.secondaryTo"
                  :label="data.secondaryLabel"
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
                <span>{{ data.priceNote }}</span>
                <strong>Manual payment ready</strong>
              </div>
            </div>
          </article>
        </template>
      </Carousel>
    </div>

    <div class="app-container home-hero__grid">
      <div class="home-hero__content">
        <p class="eyebrow">Premium service, local operations</p>
        <h2>Shop, reserve, and discover Trimobe offers</h2>
        <p class="home-hero__copy">
          Phones, accessories, coffee, and chauffeured cars for customers across Madagascar.
        </p>

        <div class="home-search soft-panel">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText placeholder="Search phones, coffee, accessories, or cars" aria-label="Search Trimobe" />
          </IconField>
          <Button label="Search" icon="pi pi-arrow-right" />
        </div>

        <div class="service-switch" aria-label="Trimobe services">
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
              <strong>{{ service.label }}</strong>
              <small>{{ service.detail }}</small>
            </span>
          </RouterLink>
        </div>

        <div class="home-hero__actions">
          <Button as="router-link" to="/phones" label="Browse phones" icon="pi pi-mobile" />
          <Button as="router-link" to="/coffee" label="Shop coffee" icon="pi pi-shopping-bag" outlined />
          <Button as="router-link" to="/cars" label="Reserve car" icon="pi pi-car" outlined />
        </div>
      </div>

      <aside class="booking-panel soft-panel" aria-label="Quick car booking">
        <div class="booking-panel__header">
          <span class="status-dot" />
          <div>
            <p>Car hire</p>
            <h2>Check dates</h2>
          </div>
        </div>

        <div class="booking-panel__fields">
          <label>
            <span>Start</span>
            <DatePicker v-model="startDate" showIcon fluid dateFormat="dd M yy" />
          </label>
          <label>
            <span>End</span>
            <DatePicker v-model="endDate" showIcon fluid dateFormat="dd M yy" />
          </label>
        </div>

        <div class="category-row">
          <RouterLink v-for="category in carCategories" :key="category.label" to="/cars">
            <i :class="category.icon" />
            {{ category.label }}
          </RouterLink>
        </div>

        <Button as="router-link" to="/cars" label="View available cars" icon="pi pi-calendar" />
      </aside>
    </div>
  </section>

  <section class="trust-band">
    <div class="app-container trust-band__grid">
      <div v-for="signal in trustSignals" :key="signal.label" class="trust-item">
        <span>{{ signal.label }}</span>
        <strong>{{ signal.value }}</strong>
      </div>
    </div>
  </section>

  <section class="home-section">
    <div class="app-container">
      <div class="section-header">
        <div>
          <p class="eyebrow">Shop</p>
          <h2 class="section-title">Featured phones and accessories</h2>
        </div>
        <Button as="router-link" to="/phones" label="All products" icon="pi pi-arrow-up-right" outlined />
      </div>

      <div class="product-grid">
        <ProductCard v-for="product in featuredProducts" :key="product.id" :product="product" />
      </div>
    </div>
  </section>

  <section class="home-section home-section--coffee">
    <div class="app-container">
      <div class="section-header">
        <div>
          <p class="eyebrow">Coffee</p>
          <h2 class="section-title">Trimobe coffee selections</h2>
          <p class="section-copy">
            A new shopping category for everyday coffee, office supplies, and premium gift packs.
          </p>
        </div>
        <Button as="router-link" to="/coffee" label="Shop coffee" icon="pi pi-shopping-bag" outlined />
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
          <p class="eyebrow">Hire</p>
          <h2 class="section-title">Cars with driver</h2>
          <p class="section-copy">
            Daily rates are shown up front. Final bookings keep their price snapshot.
          </p>
        </div>
        <Button as="router-link" to="/cars" label="Book car" icon="pi pi-car" />
      </div>

      <div class="car-grid">
        <CarCard v-for="car in featuredCars" :key="car.id" :car="car" />
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
  .service-switch,
  .trust-band__grid,
  .product-grid,
  .car-grid {
    grid-template-columns: 1fr;
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
  .category-row {
    grid-template-columns: 1fr;
  }
}
</style>
