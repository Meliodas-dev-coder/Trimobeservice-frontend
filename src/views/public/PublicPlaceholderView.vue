<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const title = computed(() => route.meta.title || 'Trimobe');
const eyebrow = computed(() => route.meta.eyebrow || 'Trimobe');
const description = computed(() => route.meta.description || 'This workspace is ready for the next screen.');
</script>

<template>
  <section class="placeholder-page">
    <div class="app-container placeholder-page__grid">
      <div>
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
        <p>{{ description }}</p>
        <div class="placeholder-page__actions">
          <Button as="router-link" to="/" label="Home" icon="pi pi-home" />
          <Button as="router-link" to="/admin/login" label="Admin login" icon="pi pi-lock" outlined />
        </div>
      </div>

      <div class="placeholder-panel soft-panel">
        <span class="status-dot" />
        <strong>Next build step</strong>
        <p>Route, shell, and visual identity are in place for this section.</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.placeholder-page {
  min-height: calc(100vh - 158px);
  padding: 72px 0;
}

.placeholder-page__grid {
  display: grid;
  align-items: center;
  gap: 32px;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 420px);
}

.placeholder-page h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(3rem, 7vw, 6rem);
  line-height: 0.92;
}

.placeholder-page p {
  max-width: 640px;
  color: var(--tm-muted);
  line-height: 1.65;
}

.placeholder-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.placeholder-panel {
  display: grid;
  gap: 12px;
  padding: 24px;
}

.placeholder-panel strong {
  color: var(--tm-heading);
  font-size: 1.2rem;
}

.placeholder-panel p {
  margin: 0;
}

@media (max-width: 760px) {
  .placeholder-page__grid {
    grid-template-columns: 1fr;
  }
}
</style>
