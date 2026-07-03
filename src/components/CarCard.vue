<script setup>
import VisualPlaceholder from '@/components/VisualPlaceholder.vue';
import { formatMGA } from '@/utils/format';

defineProps({
  car: {
    type: Object,
    required: true,
  },
});
</script>

<template>
  <article class="car-card">
    <VisualPlaceholder kind="car" :tone="car.tone" />
    <div class="car-card__body">
      <div class="car-card__heading">
        <div>
          <p>{{ car.category }}</p>
          <h3>{{ car.name }}</h3>
        </div>
        <Tag :value="`${car.seats} seats`" severity="secondary" />
      </div>
      <div class="car-card__footer">
        <div>
          <strong class="price">{{ formatMGA(car.dailyRate) }}</strong>
          <span>/ day</span>
        </div>
        <span class="availability">
          <i class="pi pi-check-circle" />
          {{ car.availability }}
        </span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.car-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.car-card__body {
  display: grid;
  gap: 18px;
  padding: 18px;
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
  font-size: 0.78rem;
  font-weight: 850;
  text-transform: uppercase;
}

.car-card h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.12rem;
}

.car-card__footer span {
  color: var(--tm-muted);
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
