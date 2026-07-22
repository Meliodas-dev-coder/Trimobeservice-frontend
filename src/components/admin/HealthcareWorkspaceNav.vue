<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();
const { t } = useAdminI18n();

const links = [
  { label: 'Overview', icon: 'pi pi-th-large', to: '/admin/healthcare/overview', paths: ['/admin/healthcare/overview'], capability: 'healthcare.overview' },
  { label: 'Care categories', icon: 'pi pi-sitemap', to: '/admin/healthcare/categories', paths: ['/admin/healthcare/categories'], capability: 'healthcare.categories' },
  { label: 'Care services', icon: 'pi pi-heart-fill', to: '/admin/healthcare/services', paths: ['/admin/healthcare/services'], capability: 'healthcare.services' },
  { label: 'Practitioners', icon: 'pi pi-user-plus', to: '/admin/practitioners', paths: ['/admin/practitioners'], capability: 'healthcare.practitioners' },
  { label: 'Care requests', icon: 'pi pi-calendar-plus', to: '/admin/healthcare/requests', paths: ['/admin/healthcare/requests'], capability: 'healthcare.requests' },
  { label: 'Emergency contact', icon: 'pi pi-phone', to: '/admin/healthcare/settings', paths: ['/admin/healthcare/settings'], capability: 'healthcare.settings' },
];
const visibleLinks = computed(() => links.filter((link) => auth.canBusiness(link.capability)));

function active(link) {
  return link.paths.some((path) => route.path === path || route.path.startsWith(`${path}/`));
}
</script>

<template>
  <nav class="healthcare-workspace-nav" :aria-label="t('Healthcare workspace')">
    <RouterLink
      v-for="link in visibleLinks"
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
.healthcare-workspace-nav {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 7px;
  padding: 7px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--tm-surface-soft) 88%, transparent);
}

.healthcare-workspace-nav a {
  display: flex;
  min-height: 46px;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 9px 10px;
  border: 1px solid transparent;
  border-radius: 11px;
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 850;
  text-align: center;
  text-decoration: none;
  transition: background 160ms ease, border-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.healthcare-workspace-nav a:hover,
.healthcare-workspace-nav a:focus-visible {
  border-color: var(--tm-border);
  background: var(--tm-surface);
  color: var(--tm-heading);
  outline: none;
  transform: translateY(-1px);
}

.healthcare-workspace-nav a.is-active {
  border-color: rgba(192, 90, 125, 0.32);
  background: var(--tm-charcoal);
  color: #fff8ed;
  box-shadow: 0 8px 22px rgba(20, 29, 31, 0.14);
}

.healthcare-workspace-nav a.is-active i {
  color: #ef9db8;
}

@media (max-width: 1040px) {
  .healthcare-workspace-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .healthcare-workspace-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
