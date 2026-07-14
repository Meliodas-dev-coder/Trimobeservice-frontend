<script setup>
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';

const props = defineProps({
  car: {
    type: Object,
    required: true,
  },
});

const { content, t } = usePublicI18n();
const cardTag = computed(() => (props.car.to ? RouterLink : 'article'));
const image = computed(() => props.car.image || props.car.primary_image_url || '');
const name = computed(() => content(props.car, 'name') || props.car.name);
const category = computed(() => t(props.car.category || props.car.categoryLabel || props.car.car_category || 'Car'));
const seats = computed(() => props.car.seats || 4);
const dailyRate = computed(() => Number(props.car.dailyRate ?? props.car.daily_rate ?? 0));
const availability = computed(() => t(props.car.availability || (props.car.status === 'available' ? 'Available' : props.car.status)));
</script>

<template>
  <component :is="cardTag" class="car-card" :to="car.to || undefined">
    <figure v-if="image" class="car-card__image">
      <img :src="image" :alt="name" loading="lazy" />
    </figure>
    <VisualPlaceholder v-else kind="car" :tone="car.tone" />
    <div class="car-card__body">
      <div class="car-card__heading">
        <div>
          <p>{{ category }}</p>
          <h3>{{ name }}</h3>
        </div>
        <Tag :value="`${seats} ${t('seats')}`" severity="secondary" />
      </div>
      <div class="car-card__footer">
        <div>
          <strong class="price">{{ formatMGA(dailyRate) }}</strong>
          <span>{{ t('/ day') }}</span>
        </div>
        <span class="availability">
          <i class="pi pi-check-circle" />
          {{ availability }}
        </span>
      </div>
    </div>
  </component>
</template>

<style scoped>
.car-card {
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

a.car-card:hover {
  border-color: rgba(12, 155, 128, 0.34);
  box-shadow: var(--tm-shadow-hover, 0 24px 58px rgba(17, 19, 21, 0.15));
  transform: translateY(-5px);
}

.car-card__image {
  aspect-ratio: 16 / 9;
  margin: 0;
  overflow: hidden;
  background: var(--tm-stone);
}

.car-card__image img {
  width: 100%;
  height: 100%;
  min-height: 100%;
  object-fit: cover;
}

.car-card__body {
  display: grid;
  gap: 22px;
  padding: 22px;
}

.car-card__heading,
.car-card__footer {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.car-card p {
  margin: 0 0 6px;
  color: var(--tm-gold);
  font-size: 0.74rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.car-card h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.28rem;
  line-height: 1.15;
}

.car-card__footer span {
  color: var(--tm-muted);
}

.car-card__footer {
  padding-top: 18px;
  border-top: 1px solid var(--tm-border);
}

.availability {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tm-emerald) !important;
  font-size: 0.88rem;
  font-weight: 800;
  text-align: right;
}

@media (max-width: 520px) {
  .car-card__footer {
    flex-direction: column;
  }

  .availability {
    text-align: left;
  }
}
</style>
