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
const isCargo = computed(() => Boolean(props.car.is_cargo_transport));
const displayRate = computed(() => Number(
  isCargo.value
    ? props.car.cargo_minimum_rate ?? 0
    : props.car.dailyRate ?? props.car.daily_rate ?? 0,
));
const transmission = computed(() => props.car.transmission ? t(titleize(props.car.transmission)) : '');
const availability = computed(() => {
  if (typeof props.car.dateAvailability === 'boolean') {
    return props.car.dateAvailability ? t('Available for your dates') : t('Not available for your dates');
  }
  return t(props.car.availability || (props.car.status === 'available' ? 'Available' : props.car.status));
});
const serviceLabel = computed(() => t(props.car.serviceLabel || (props.car.is_cargo_transport ? 'Cargo transport' : 'Driver included')));

function titleize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}
</script>

<template>
  <component :is="cardTag" class="car-card" :to="car.to || undefined">
    <figure v-if="image" class="car-card__image">
      <img :src="image" :alt="name" loading="lazy" />
    </figure>
    <VisualPlaceholder v-else kind="car" :tone="car.tone" />
    <div class="car-card__body">
      <div class="car-card__availability" :class="{ 'is-unavailable': car.dateAvailability === false }"><i class="pi pi-circle-fill" />{{ availability }}</div>
      <div class="car-card__heading">
        <div>
          <p>{{ category }}</p>
          <h3>{{ name }}</h3>
        </div>
      </div>
      <div class="car-card__features">
        <span><i class="pi pi-users" />{{ seats }} {{ t('seats') }}</span>
        <span v-if="transmission"><i class="pi pi-cog" />{{ transmission }}</span>
        <span><i :class="car.is_cargo_transport ? 'pi pi-truck' : 'pi pi-user'" />{{ serviceLabel }}</span>
      </div>
      <div class="car-card__footer">
        <div>
          <span v-if="isCargo">{{ t('From') }}</span>
          <strong class="price">{{ formatMGA(displayRate) }}</strong>
          <span v-if="!isCargo">{{ t('/ day') }}</span>
        </div>
        <span class="car-card__go"><i class="pi pi-arrow-right" /></span>
      </div>
    </div>
  </component>
</template>

<style scoped>
.car-card {
  position: relative;
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 20px;
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
  aspect-ratio: 16 / 10;
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
  gap: 15px;
  padding: 18px;
}

.car-card__availability {
  position: absolute;
  top: 16px;
  right: 16px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid rgba(255,255,255,.35);
  border-radius: 999px;
  background: rgba(255,255,255,.91);
  box-shadow: 0 7px 20px rgba(20,29,31,.1);
  color: var(--tm-emerald);
  font-size: .75rem;
  font-weight: 880;
  backdrop-filter: blur(8px);
}

.car-card__availability i { font-size: .5rem; }
.car-card__availability.is-unavailable { color: var(--tm-coral); }

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

.car-card__features {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
}

.car-card__features span {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  background: var(--tm-surface-soft);
  color: var(--tm-muted);
  font-size: .73rem;
  font-weight: 780;
}

.car-card__features i { color: var(--tm-heading); }

.car-card__footer span {
  color: var(--tm-muted);
}

.car-card__footer {
  align-items: center;
  padding-top: 18px;
  border-top: 1px solid var(--tm-border);
}

.car-card__go {
  display: grid;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: var(--tm-emerald);
  color: #fff !important;
  place-items: center;
  transition: transform 160ms ease;
}

a.car-card:hover .car-card__go { transform: translateX(3px); }

@media (max-width: 520px) {
  .car-card__footer {
    flex-direction: column;
  }

  .car-card__availability { max-width: calc(100% - 32px); }
}
</style>
