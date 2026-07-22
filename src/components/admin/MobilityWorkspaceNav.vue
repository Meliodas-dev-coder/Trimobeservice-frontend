<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();
const { t } = useAdminI18n();

const links = [
  { label: 'Overview', icon: 'pi pi-th-large', to: '/admin/mobility/overview', paths: ['/admin/mobility'], capability: 'mobility.overview' },
  { label: 'Car categories', icon: 'pi pi-sitemap', to: '/admin/car-categories', paths: ['/admin/car-categories'], capability: 'mobility.categories' },
  { label: 'Cars', icon: 'pi pi-car', to: '/admin/cars', paths: ['/admin/cars'], capability: 'mobility.cars' },
  { label: 'Drivers', icon: 'pi pi-id-card', to: '/admin/drivers', paths: ['/admin/drivers'], capability: 'mobility.drivers' },
  { label: 'Bookings', icon: 'pi pi-calendar-clock', to: '/admin/bookings', paths: ['/admin/bookings'], capability: 'mobility.bookings' },
];
const visibleLinks = computed(() => links.filter((link) => auth.canBusiness(link.capability)));

function active(link) {
  return link.paths.some((path) => route.path === path || route.path.startsWith(`${path}/`));
}
</script>

<template>
  <nav class="mobility-workspace-nav" :aria-label="t('Mobility workspace')">
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
.mobility-workspace-nav {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  padding: 7px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--tm-surface-soft) 88%, transparent);
}

.mobility-workspace-nav a {
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

.mobility-workspace-nav a:hover,
.mobility-workspace-nav a:focus-visible {
  border-color: var(--tm-border);
  background: var(--tm-surface);
  color: var(--tm-heading);
  outline: none;
  transform: translateY(-1px);
}

.mobility-workspace-nav a.is-active {
  border-color: rgba(201, 146, 44, 0.3);
  background: var(--tm-charcoal);
  color: #fff8ed;
  box-shadow: 0 8px 22px rgba(20, 29, 31, 0.14);
}

.mobility-workspace-nav a.is-active i {
  color: var(--tm-gold);
}

@media (max-width: 780px) {
  .mobility-workspace-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .mobility-workspace-nav a:first-child {
    grid-column: 1 / -1;
  }
}
</style>
