<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAdminI18n } from '@/i18n/admin';

const route = useRoute();
const { t } = useAdminI18n();

const title = computed(() => t(route.meta.title || 'Admin'));
const description = computed(() => t(route.meta.description || 'Admin section ready for implementation.'));
</script>

<template>
  <section class="admin-placeholder">
    <div>
      <p>{{ t('Module') }}</p>
      <h2>{{ title }}</h2>
      <span>{{ description }}</span>
    </div>
    <Button :label="t('Create new')" icon="pi pi-plus" />
  </section>
</template>

<style scoped>
.admin-placeholder {
  display: flex;
  min-height: 360px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 26px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.admin-placeholder p,
.admin-placeholder h2 {
  margin: 0;
}

.admin-placeholder p {
  color: var(--tm-gold);
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-placeholder h2 {
  margin-top: 6px;
  color: var(--tm-heading);
  font-size: clamp(2.2rem, 6vw, 4.2rem);
  line-height: 0.96;
}

.admin-placeholder span {
  display: block;
  max-width: 620px;
  margin-top: 16px;
  color: var(--tm-muted);
  line-height: 1.65;
}

@media (max-width: 680px) {
  .admin-placeholder {
    align-items: start;
    flex-direction: column;
  }
}
</style>
