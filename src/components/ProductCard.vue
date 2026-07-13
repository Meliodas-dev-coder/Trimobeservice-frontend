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
        <strong class="price">{{ priceText }}</strong>
        <span>{{ stockText }}</span>
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
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
  color: inherit;
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

a.product-card:hover {
  border-color: rgba(8, 124, 104, 0.32);
  box-shadow: 0 24px 58px rgba(17, 19, 21, 0.15);
  transform: translateY(-2px);
}

.product-card__image {
  position: relative;
  min-height: 206px;
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
  min-height: 206px;
  object-fit: cover;
}

.product-card__body {
  display: grid;
  gap: 18px;
  padding: 18px;
}

.product-card p {
  margin: 0 0 6px;
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 850;
  text-transform: uppercase;
}

.product-card h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.12rem;
  line-height: 1.2;
}

.product-card span {
  display: inline-block;
  margin-top: 7px;
  color: var(--tm-muted);
  font-size: 0.9rem;
}

.product-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.product-card__footer span {
  margin: 0;
  white-space: nowrap;
}
</style>
