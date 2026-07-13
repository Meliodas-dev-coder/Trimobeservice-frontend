<script setup>
import { computed, onMounted, ref } from 'vue';

import ProductCard from '@/components/ProductCard.vue';
import kafeMisionaPremiumRed from '@/assets/coffee/kafe-misiona-premium-red.jpeg';
import kafeMisionaRange from '@/assets/coffee/kafe-misiona-range.jpeg';
import { listProducts } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';

const { t } = usePublicI18n();

// Live coffee catalog: coffee is a real store department, so these are the same
// products admins manage — clicking a card opens the product page where a weight
// variant is picked and added to the cart, exactly like ordering a phone.
const liveProducts = ref([]);
const loaded = ref(false);

function coffeePrice(product) {
  const min = product.price_min != null ? Number(product.price_min) : null;
  const max = product.price_max != null ? Number(product.price_max) : null;
  if (min == null) {
    return '';
  }
  if (max != null && max !== min) {
    return `${formatMGA(min)} – ${formatMGA(max)}`;
  }
  return formatMGA(min);
}

// Live products mapped to ProductCard's shape; falls back to the static
// marketing selection until the first coffee product is published.
const coffeeCards = computed(() =>
  liveProducts.value.map((product) => ({
    ...product,
    visualKind: 'coffee',
    image: product.primary_image_url,
    priceLabel: coffeePrice(product),
    stockLabel: product.variant_count
      ? `${product.variant_count} ${t('options')}`
      : t('Available'),
    to: { name: 'product-detail', params: { slug: product.slug } },
  })),
);

const isLive = computed(() => coffeeCards.value.length > 0);

// Copy adapts to load state so an empty catalog never advertises packs that
// aren't actually purchasable (the static fallback cards used to imply that).
const sectionCopy = computed(() => {
  if (!loaded.value) {
    return t('Loading the latest Kafe Misiona packs…');
  }
  return isLive.value
    ? t('Pick a pack, choose your size, and add it to your cart — checkout and delivery work just like the rest of the shop.')
    : t('Kafe Misiona packs are being prepared — they will appear here as soon as they are published.');
});

onMounted(async () => {
  try {
    const res = await listProducts({ department: 'coffee', limit: 12 });
    liveProducts.value = res.items || [];
  } catch {
    liveProducts.value = [];
  } finally {
    loaded.value = true;
  }
});

const coffeeHighlights = [
  {
    icon: 'pi pi-sparkles',
    label: 'Premium finish',
    copy: 'Rich aroma, smooth body, and a polished pack made for everyday coffee moments.',
  },
  {
    icon: 'pi pi-briefcase',
    label: 'Gift ready',
    copy: 'A clean coffee selection for offices, hotel welcomes, meetings, and thoughtful gifts.',
  },
  {
    icon: 'pi pi-map-marker',
    label: 'Madagascar focused',
    copy: 'A warm local offer for homes, workdays, travel days, and shared tables.',
  },
];

const coffeeMoments = [
  'Office reception',
  'Client gifts',
  'Travel packs',
  'Home routine',
];
</script>

<template>
  <section class="coffee-page">
    <div class="coffee-hero-band">
      <div class="app-container coffee-hero">
        <div class="coffee-hero__copy">
          <p class="eyebrow">{{ t('Kafe Misiona') }}</p>
          <h1>{{ t('Kafe Misiona, ready for daily service.') }}</h1>
          <p>
            {{ t('Bring a rich coffee moment to mornings, meetings, receptions, and gifts with Kafe Misiona packs made to look good and taste memorable.') }}
          </p>
          <div class="coffee-hero__actions">
            <Button as="a" href="#selection" :label="t('View selection')" icon="pi pi-shopping-bag" />
            <Button as="router-link" to="/cart" :label="t('View cart')" icon="pi pi-shopping-cart" outlined />
          </div>
        </div>

        <figure class="coffee-hero__image">
          <img :src="kafeMisionaRange" alt="Kafe Misiona coffee range" />
        </figure>
      </div>
    </div>

    <div class="coffee-highlight-band">
      <div class="app-container coffee-highlights">
        <article v-for="item in coffeeHighlights" :key="item.label" class="coffee-highlight">
          <i :class="item.icon" />
          <div>
            <h2>{{ t(item.label) }}</h2>
            <p>{{ t(item.copy) }}</p>
          </div>
        </article>
      </div>
    </div>

    <section id="selection" class="coffee-section">
      <div class="app-container">
        <div class="section-header">
          <div>
            <p class="eyebrow">{{ t('Selection') }}</p>
            <h2 class="section-title">{{ t('Kafe Misiona packs') }}</h2>
            <p class="section-copy">{{ sectionCopy }}</p>
          </div>
          <Button v-if="isLive" as="router-link" to="/cart" :label="t('View cart')" icon="pi pi-shopping-cart" outlined />
        </div>

        <div v-if="!loaded" class="coffee-product-grid">
          <Skeleton v-for="n in 3" :key="n" height="320px" borderRadius="8px" />
        </div>
        <div v-else-if="isLive" class="coffee-product-grid">
          <ProductCard v-for="product in coffeeCards" :key="product.id" :product="product" />
        </div>
        <div v-else class="coffee-empty">
          <i class="pi pi-inbox" />
          <h3>{{ t('Fresh packs are on the way') }}</h3>
          <p>{{ t('Our Kafe Misiona selection is being prepared. Check back soon, or browse the rest of the shop in the meantime.') }}</p>
          <Button as="router-link" to="/tech" :label="t('Continue shopping')" icon="pi pi-shopping-bag" outlined />
        </div>
      </div>
    </section>

    <section class="coffee-section coffee-section--story">
      <div class="app-container coffee-story">
        <figure class="coffee-story__image">
          <img :src="kafeMisionaPremiumRed" alt="Kafe Misiona premium red coffee pack" />
        </figure>

        <div class="coffee-story__copy">
          <p class="eyebrow">{{ t('For every setting') }}</p>
          <h2>{{ t('Coffee that sits naturally beside Trimobe service.') }}</h2>
          <p>
            {{ t('From the first cup at home to a welcome tray at the office, Kafe Misiona brings a warm aroma, elegant packaging, and a simple way to share something thoughtful.') }}
          </p>
          <div class="coffee-moments" :aria-label="t('Kafe Misiona use cases')">
            <span v-for="moment in coffeeMoments" :key="moment">{{ t(moment) }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="coffee-cta">
      <div class="app-container coffee-cta__inner">
        <div>
          <p class="eyebrow">{{ t('Order coffee') }}</p>
          <h2>{{ t('Interested in Kafe Misiona?') }}</h2>
        </div>
        <div class="coffee-cta__actions">
          <Button as="a" href="#selection" :label="t('View selection')" icon="pi pi-shopping-bag" />
          <Button as="router-link" to="/tech" :label="t('Continue shopping')" icon="pi pi-mobile" outlined />
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.coffee-page {
  background: var(--tm-body-bg);
}

.coffee-hero-band {
  padding: 34px 0 44px;
}

.coffee-hero {
  display: grid;
  align-items: center;
  gap: 34px;
  grid-template-columns: minmax(0, 0.92fr) minmax(360px, 1fr);
}

.coffee-hero__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  align-items: start;
  justify-content: center;
}

.coffee-hero__copy h1 {
  max-width: 680px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.55rem, 6.8vw, 6.1rem);
  line-height: 0.92;
}

.coffee-hero__copy p:not(.eyebrow) {
  max-width: 560px;
  margin: 20px 0 0;
  color: var(--tm-muted);
  font-size: 1.08rem;
  line-height: 1.65;
}

.coffee-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.coffee-hero__image {
  position: relative;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-charcoal);
  box-shadow: var(--tm-shadow);
}

.coffee-hero__image::after {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, transparent 52%, rgba(17, 19, 21, 0.22)),
    linear-gradient(90deg, rgba(17, 19, 21, 0.12), transparent 40%);
  content: "";
  pointer-events: none;
}

.coffee-hero__image img {
  width: 100%;
  height: min(64vh, 620px);
  min-height: 420px;
  object-fit: cover;
}

.coffee-highlight-band {
  padding: 18px 0;
  border-block: 1px solid var(--tm-border);
  background: var(--tm-surface-muted);
}

.coffee-highlights {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.coffee-highlight {
  display: flex;
  min-width: 0;
  align-items: start;
  gap: 14px;
  min-height: 116px;
  padding: 18px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.coffee-highlight i {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
}

.coffee-highlight h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1rem;
}

.coffee-highlight p {
  margin: 6px 0 0;
  color: var(--tm-muted);
  line-height: 1.55;
}

.coffee-section {
  padding: 54px 0;
}

.coffee-product-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.coffee-empty {
  display: grid;
  place-items: center;
  gap: 12px;
  padding: 56px 24px;
  border: 1px dashed var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
  text-align: center;
}

.coffee-empty i {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  border-radius: 999px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  font-size: 1.4rem;
}

.coffee-empty h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.2rem;
}

.coffee-empty p {
  max-width: 440px;
  margin: 0;
  color: var(--tm-muted);
  line-height: 1.6;
}

.coffee-section--story {
  background:
    linear-gradient(180deg, var(--tm-surface-muted), rgba(8, 124, 104, 0.07)),
    var(--tm-stone);
}

.coffee-story {
  display: grid;
  align-items: center;
  gap: 34px;
  grid-template-columns: minmax(320px, 0.72fr) minmax(0, 1fr);
}

.coffee-story__image {
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.coffee-story__image img {
  width: 100%;
  height: 440px;
  object-fit: cover;
}

.coffee-story__copy h2 {
  max-width: 700px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(1.9rem, 4vw, 3.4rem);
  line-height: 1.02;
}

.coffee-story__copy p:not(.eyebrow) {
  max-width: 650px;
  margin: 18px 0 0;
  color: var(--tm-muted);
  font-size: 1.04rem;
  line-height: 1.7;
}

.coffee-moments {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.coffee-moments span {
  display: inline-flex;
  min-height: 38px;
  align-items: center;
  padding: 0 13px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  background: var(--tm-surface-soft);
  color: var(--tm-heading);
  font-size: 0.9rem;
  font-weight: 800;
}

.coffee-cta {
  padding: 36px 0 64px;
}

.coffee-cta__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background:
    linear-gradient(120deg, rgba(8, 124, 104, 0.1), transparent 46%),
    var(--tm-surface-soft);
  box-shadow: var(--tm-shadow);
}

.coffee-cta h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(1.45rem, 3vw, 2.35rem);
  line-height: 1.08;
}

.coffee-cta__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: end;
  gap: 12px;
}

@media (max-width: 920px) {
  .coffee-hero,
  .coffee-highlights,
  .coffee-product-grid,
  .coffee-story {
    grid-template-columns: 1fr;
  }

  .coffee-story {
    gap: 26px;
  }

  .coffee-story__image {
    order: 2;
  }

  .coffee-cta__inner {
    align-items: start;
    flex-direction: column;
  }

  .coffee-cta__actions {
    justify-content: start;
  }
}

@media (max-width: 560px) {
  .coffee-hero-band {
    padding-top: 26px;
  }

  .coffee-hero__image img {
    min-height: 0;
    height: 320px;
  }

  .coffee-story__image img {
    min-height: 0;
    height: 280px;
  }

  .coffee-highlight {
    flex-direction: column;
  }

  .coffee-cta__actions,
  .coffee-cta__actions .p-button,
  .coffee-hero__actions,
  .coffee-hero__actions .p-button {
    width: 100%;
  }
}
</style>
