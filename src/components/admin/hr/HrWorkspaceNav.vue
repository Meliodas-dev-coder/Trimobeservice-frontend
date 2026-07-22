<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();
const { t } = useAdminI18n();

const links = [
  { label: 'Overview', icon: 'pi pi-th-large', to: '/admin/hr/overview', visible: () => auth.hasHrAccess },
  { label: 'My profile', icon: 'pi pi-id-card', to: '/admin/hr/me', visible: () => auth.hasEmployee },
  { label: 'Employees', icon: 'pi pi-users', to: '/admin/hr/employees', visible: () => auth.canHr('employees', 'view') && auth.hrScope('employees', 'view') !== 'self' },
  { label: 'Organization', icon: 'pi pi-sitemap', to: '/admin/hr/organization', visible: () => auth.canHrArea('organization') },
  { label: 'Lifecycle', icon: 'pi pi-directions', to: '/admin/hr/lifecycle', visible: () => auth.canHrArea('lifecycle') },
  { label: 'Leave', icon: 'pi pi-calendar-plus', to: '/admin/hr/leave', visible: () => auth.canHrArea('leave') },
  { label: 'Time', icon: 'pi pi-clock', to: '/admin/hr/time', visible: () => auth.canHrArea('time') },
  { label: 'Performance', icon: 'pi pi-chart-line', to: '/admin/hr/performance', visible: () => auth.canHrArea('performance') },
  { label: 'Recruitment', icon: 'pi pi-briefcase', to: '/admin/hr/recruitment', visible: () => auth.canHrArea('recruitment') },
  { label: 'Pay & expenses', icon: 'pi pi-wallet', to: '/admin/hr/finance', visible: () => auth.canHrArea('finance') },
  { label: 'Reports', icon: 'pi pi-chart-bar', to: '/admin/hr/reports', visible: () => auth.canHr('reports', 'view') },
  { label: 'Audit history', icon: 'pi pi-history', to: '/admin/hr/audit-history', visible: () => auth.canHr('audit', 'view') && auth.hrScope('audit', 'view') === 'all' },
  { label: 'Access control', icon: 'pi pi-shield', to: '/admin/hr/access', visible: () => auth.isSuperAdmin },
];

const visibleLinks = computed(() => links.filter((link) => link.visible()));
function active(link) {
  return route.path === link.to || route.path.startsWith(`${link.to}/`);
}
</script>

<template>
  <nav class="hr-workspace-nav" :aria-label="t('HR workspace')">
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
.hr-workspace-nav {
  display: flex;
  gap: 5px;
  overflow-x: auto;
  padding: 6px;
  border: 1px solid var(--tm-border);
  border-radius: 15px;
  background: color-mix(in srgb, var(--tm-surface-soft) 90%, transparent);
  scrollbar-width: thin;
}

.hr-workspace-nav a {
  display: flex;
  min-width: max-content;
  min-height: 42px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 8px 11px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 850;
  text-decoration: none;
  transition: 150ms ease;
}

.hr-workspace-nav a:hover,
.hr-workspace-nav a:focus-visible { border-color: var(--tm-border); background: var(--tm-surface); color: var(--tm-heading); outline: 0; }
.hr-workspace-nav a.is-active { border-color: rgba(201, 146, 44, 0.28); background: var(--tm-charcoal); color: #fff8ed; }
.hr-workspace-nav a.is-active i { color: var(--tm-gold); }

@media (max-width: 700px) {
  .hr-workspace-nav { margin-inline: -14px; padding-inline: 14px; border-inline: 0; border-radius: 0; }
}
</style>
