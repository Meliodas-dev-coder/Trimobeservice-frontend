<script setup>
import { useRoute } from 'vue-router';

import { useAdminI18n } from '@/i18n/admin';

const route = useRoute();
const { t } = useAdminI18n();

const links = [
  { label: 'Overview', icon: 'pi pi-th-large', to: '/admin/events/overview', paths: ['/admin/events'] },
  { label: 'Service categories', icon: 'pi pi-sitemap', to: '/admin/event-service-categories', paths: ['/admin/event-service-categories'] },
  { label: 'Event services', icon: 'pi pi-star', to: '/admin/event-services', paths: ['/admin/event-services'] },
  { label: 'Gospel artists', icon: 'pi pi-microphone', to: '/admin/artists', paths: ['/admin/artists'] },
  { label: 'Event requests', icon: 'pi pi-calendar-plus', to: '/admin/event-requests', paths: ['/admin/event-requests'] },
];

function active(link) {
  return link.paths.some((path) => route.path === path || route.path.startsWith(`${path}/`));
}
</script>

<template>
  <nav class="event-workspace-nav" :aria-label="t('Events workspace')">
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
.event-workspace-nav {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 7px;
  padding: 7px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--tm-surface-soft) 88%, transparent);
}

.event-workspace-nav a {
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

.event-workspace-nav a:hover,
.event-workspace-nav a:focus-visible {
  border-color: var(--tm-border);
  background: var(--tm-surface);
  color: var(--tm-heading);
  outline: none;
  transform: translateY(-1px);
}

.event-workspace-nav a.is-active {
  border-color: rgba(201, 146, 44, 0.3);
  background: var(--tm-charcoal);
  color: #fff8ed;
  box-shadow: 0 8px 22px rgba(20, 29, 31, 0.14);
}

.event-workspace-nav a.is-active i {
  color: var(--tm-gold);
}

@media (max-width: 780px) {
  .event-workspace-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .event-workspace-nav a:first-child {
    grid-column: 1 / -1;
  }
}
</style>
