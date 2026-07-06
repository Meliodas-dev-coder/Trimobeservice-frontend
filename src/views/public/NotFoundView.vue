<script setup>
import { useRoute } from 'vue-router';
import { usePublicI18n } from '@/i18n/public';

const route = useRoute();
const { t } = usePublicI18n();
</script>

<template>
  <section class="notfound-page">
    <div class="app-container notfound-page__inner">
      <p class="eyebrow">404</p>
      <h1>{{ t('Page not found') }}</h1>
      <p class="notfound-page__text">
        <template v-for="(part, index) in t('Nothing lives at {path}. It may have been moved, renamed, or never existed.', { path: route.fullPath }).split(route.fullPath)" :key="index">
          {{ part }}<code v-if="index === 0">{{ route.fullPath }}</code>
        </template>
      </p>
      <div class="notfound-page__actions">
        <Button as="router-link" to="/" :label="t('Back to home')" icon="pi pi-home" />
        <Button as="router-link" to="/phones" :label="t('Browse phones')" icon="pi pi-mobile" severity="secondary" outlined />
        <Button as="router-link" to="/cars" :label="t('Hire a car')" icon="pi pi-car" severity="secondary" outlined />
      </div>
    </div>
  </section>
</template>

<style scoped>
.notfound-page {
  padding: 90px 0 110px;
}

.notfound-page__inner {
  display: grid;
  max-width: 640px;
  gap: 14px;
  justify-items: start;
}

.notfound-page h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.6rem, 7vw, 5.2rem);
  line-height: 0.95;
}

.notfound-page__text {
  margin: 0;
  color: var(--tm-muted);
  line-height: 1.7;
}

.notfound-page__text code {
  padding: 2px 7px;
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  background: var(--tm-surface);
  color: var(--tm-heading);
  font-size: 0.9em;
  word-break: break-all;
}

.notfound-page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 8px;
}
</style>
