<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';

const props = defineProps({
  product: {
    type: Object,
    required: true,
  },
});

const { content, t } = usePublicI18n();

const cardTag = computed(() => (props.product.to ? RouterLink : 'article'));
const image = computed(() => props.product.image || props.product.primary_image_url || '');
const name = computed(() => content(props.product, 'name') || props.product.name);
const category = computed(() => t(props.product.category || props.product.categoryLabel || 'Product'));
const variant = computed(() => props.product.variant || props.product.variantLabel || '');
const priceText = computed(() => {
  if (props.product.priceLabel) {
    return t(props.product.priceLabel);
  }
  const value = props.product.price ?? props.product.price_min;
  return value == null ? '-' : formatMGA(Number(value || 0));
});
const stockText = computed(() => {
  if (props.product.stockLabel) {
    return t(props.product.stockLabel);
  }
  if (props.product.stock !== undefined && props.product.stock !== null) {
    return `${props.product.stock} ${t('in stock')}`;
  }
  if (props.product.variant_count !== undefined) {
    return `${props.product.variant_count} ${t('variants')}`;
  }
  return t('Available');
});
</script>

<template>
  <component :is="cardTag" class="product-card" :to="product.to || undefined">
    <figure v-if="image" class="product-card__image">
      <img :src="image" :alt="product.imageAlt || name" loading="lazy" />
    </figure>
    <VisualPlaceholder v-else :kind="product.visualKind || 'phone'" :tone="product.tone" />
    <div class="product-card__body">
      <div>
        <p>{{ category }}</p>
        <h3>{{ name }}</h3>
        <span>{{ variant }}</span>
      </div>
      <div class="product-card__footer">
        <div>
          <strong class="price">{{ priceText }}</strong>
          <span>{{ stockText }}</span>
        </div>
        <span class="product-card__arrow"><i class="pi pi-arrow-right" /></span>
      </div>
    </div>
  </component>
</template>

<style scoped>
.product-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: var(--tm-radius);
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
  color: inherit;
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

a.product-card:hover {
  border-color: rgba(12, 155, 128, 0.34);
  box-shadow: var(--tm-shadow-hover, 0 24px 58px rgba(17, 19, 21, 0.15));
  transform: translateY(-5px);
}

.product-card__image {
  position: relative;
  aspect-ratio: 4 / 3;
  margin: 0;
  overflow: hidden;
  background: var(--tm-stone);
}

.product-card__image::after {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 58%, rgba(17, 19, 21, 0.18));
  content: "";
  pointer-events: none;
}

.product-card__image img {
  width: 100%;
  height: 100%;
  min-height: 100%;
  object-fit: cover;
}

.product-card__body {
  display: grid;
  gap: 22px;
  padding: 22px;
}

.product-card p {
  margin: 0 0 6px;
  color: var(--tm-gold);
  font-size: 0.74rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.product-card h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.28rem;
  line-height: 1.15;
}

.product-card span {
  /* display: inline-block; */
  margin-top: 7px;
  color: var(--tm-muted);
  font-size: 0.9rem;
}

.product-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 18px;
  border-top: 1px solid var(--tm-border);
}

.product-card__footer > div > span {
  display: block;
  margin: 0;
  font-size: 0.8rem;
}

.product-card__arrow {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  margin: 0;
  border: 1px solid var(--tm-border-strong);
  border-radius: 50%;
  color: var(--tm-heading) !important;
}
</style>
