<script setup>
import { useRoute } from 'vue-router';

import { useAdminI18n } from '@/i18n/admin';

const route = useRoute();
const { t } = useAdminI18n();

const links = [
  { label: 'Overview', icon: 'pi pi-th-large', to: '/admin/tech/overview', match: '/admin/tech/overview' },
  { label: 'Categories', icon: 'pi pi-tags', to: '/admin/tech/categories', match: '/admin/tech/categories' },
  { label: 'Brands', icon: 'pi pi-bookmark', to: '/admin/tech/brands', match: '/admin/tech/brands' },
  { label: 'Products', icon: 'pi pi-mobile', to: '/admin/tech/products', match: '/admin/tech/products' },
];

function active(link) {
  return route.path === link.match || route.path.startsWith(`${link.match}/`);
}
</script>

<template>
  <nav class="tech-workspace-nav" :aria-label="t('Tech workspace')">
    <RouterLink
      v-for="link in links"
      :key="link.to"
      :to="link.to"
      :class="{ 'is-active': active(link) }"
    >
      <i :class="link.icon" />
      <span>{{ t(link.label) }}</span>
    </RouterLink>
  </nav>
</template>

<style scoped>
.tech-workspace-nav {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 7px;
  padding: 7px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--tm-surface-soft) 88%, transparent);
}

.tech-workspace-nav a {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 12px;
  border: 1px solid transparent;
  border-radius: 11px;
  color: var(--tm-muted);
  font-size: 0.84rem;
  font-weight: 850;
  text-decoration: none;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.tech-workspace-nav a:hover,
.tech-workspace-nav a:focus-visible {
  border-color: var(--tm-border);
  background: var(--tm-surface);
  color: var(--tm-heading);
  outline: none;
  transform: translateY(-1px);
}

.tech-workspace-nav a.is-active {
  border-color: rgba(201, 146, 44, 0.3);
  background: var(--tm-charcoal);
  color: #fff8ed;
  box-shadow: 0 8px 22px rgba(20, 29, 31, 0.14);
}

.tech-workspace-nav a.is-active i {
  color: var(--tm-gold);
}

@media (max-width: 620px) {
  .tech-workspace-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
