<script setup>
import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import { formatMGA } from '@/utils/format';

defineProps({
  product: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <article class="product-card">
    <figure v-if="product.image" class="product-card__image">
      <img :src="product.image" :alt="product.imageAlt || product.name" loading="lazy" />
    </figure>
    <VisualPlaceholder v-else :kind="product.visualKind || 'phone'" :tone="product.tone" />
    <div class="product-card__body">
      <div>
        <p>{{ product.category }}</p>
        <h3>{{ product.name }}</h3>
        <span>{{ product.variant }}</span>
      </div>
      <div class="product-card__footer">
        <strong class="price">{{ formatMGA(product.price) }}</strong>
        <span>{{ product.stock }} in stock</span>
      </div>
    </div>
  </article>
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
