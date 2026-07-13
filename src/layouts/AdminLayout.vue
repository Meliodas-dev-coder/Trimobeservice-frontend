<script setup>
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import BrandMark from '@/components/BrandMark.vue';
import NotificationBell from '@/components/admin/NotificationBell.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { languageLabel, t, toggleLanguage } = useAdminI18n();

async function handleLogout() {
  await auth.logout();
  router.replace({ name: 'admin-login' });
}

const primaryNav = [
  { label: 'Dashboard', icon: 'pi pi-chart-line', to: '/admin' },
];

const groupedNav = [
  {
    key: 'tech',
    label: 'Tech',
    icon: 'pi pi-mobile',
    items: [
      { label: 'Categories', icon: 'pi pi-tags', to: '/admin/tech/categories' },
      { label: 'Brands', icon: 'pi pi-bookmark', to: '/admin/tech/brands' },
      { label: 'Products', icon: 'pi pi-mobile', to: '/admin/tech/products' },
    ],
  },
  {
    key: 'fashion',
    label: 'Fashion',
    icon: 'pi pi-shopping-bag',
    items: [
      { label: 'Categories', icon: 'pi pi-tags', to: '/admin/fashion/categories' },
      { label: 'Brands', icon: 'pi pi-bookmark', to: '/admin/fashion/brands' },
      { label: 'Products', icon: 'pi pi-shopping-bag', to: '/admin/fashion/products' },
    ],
  },
  {
    key: 'coffee',
    label: 'Coffee',
    icon: 'pi pi-inbox',
    items: [
      { label: 'Products', icon: 'pi pi-inbox', to: '/admin/coffee/products' },
    ],
  },
  {
    key: 'mobility',
    label: 'Mobility',
    icon: 'pi pi-car',
    items: [
      { label: 'Car categories', icon: 'pi pi-sitemap', to: '/admin/car-categories' },
      { label: 'Cars', icon: 'pi pi-car', to: '/admin/cars' },
      { label: 'Drivers', icon: 'pi pi-id-card', to: '/admin/drivers' },
      { label: 'Bookings', icon: 'pi pi-calendar-clock', to: '/admin/bookings' },
    ],
  },
  {
    key: 'events',
    label: 'Events',
    icon: 'pi pi-calendar',
    items: [
      { label: 'Service categories', icon: 'pi pi-sitemap', to: '/admin/event-service-categories' },
      { label: 'Event services', icon: 'pi pi-star', to: '/admin/event-services' },
      { label: 'Gospel artists', icon: 'pi pi-microphone', to: '/admin/artists' },
      { label: 'Event requests', icon: 'pi pi-calendar-plus', to: '/admin/event-requests' },
    ],
  },
  {
    key: 'healthcare',
    label: 'Healthcare',
    icon: 'pi pi-heart',
    items: [
      { label: 'Practitioners', icon: 'pi pi-id-card', to: '/admin/practitioners' },
      { label: 'Care categories', icon: 'pi pi-sitemap', to: '/admin/healthcare/categories' },
      { label: 'Care services', icon: 'pi pi-plus-circle', to: '/admin/healthcare/services' },
      { label: 'Care requests', icon: 'pi pi-calendar-plus', to: '/admin/healthcare/requests' },
      { label: 'Emergency contact', icon: 'pi pi-phone', to: '/admin/healthcare/settings' },
    ],
  },
];

const secondaryNav = [
  { label: 'Orders', icon: 'pi pi-receipt', to: '/admin/orders' },
  { label: 'Payments', icon: 'pi pi-wallet', to: '/admin/payments' },
  { label: 'Customers', icon: 'pi pi-users', to: '/admin/customers' },
  { label: 'Activity log', icon: 'pi pi-history', to: '/admin/audit-logs' },
];

const openGroups = ref({
  tech: false,
  fashion: false,
  coffee: false,
  mobility: false,
  events: false,
  healthcare: false,
});

function isActive(to) {
  if (to === '/admin') {
    return route.path === '/admin';
  }
  // exact segment match so /admin/cars doesn't also light up for /admin/car-categories
  return route.path === to || route.path.startsWith(`${to}/`);
}

function groupIsActive(group) {
  return group.items.some((item) => isActive(item.to));
}

function toggleGroup(key) {
  openGroups.value = {
    ...openGroups.value,
    [key]: !openGroups.value[key],
  };
}

watch(
  () => route.path,
  () => {
    groupedNav.forEach((group) => {
      if (groupIsActive(group)) {
        openGroups.value[group.key] = true;
      }
    });
  },
  { immediate: true },
);
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <BrandMark class="admin-brand" />
      <nav :aria-label="t('Admin navigation')">
        <RouterLink
          v-for="item in primaryNav"
          :key="item.to"
          :class="{ 'is-active': isActive(item.to) }"
          :to="item.to"
        >
          <i :class="item.icon" />
          <span>{{ t(item.label) }}</span>
        </RouterLink>

        <div
          v-for="group in groupedNav"
          :key="group.key"
          class="admin-nav-group"
          :class="{ 'is-active': groupIsActive(group), 'is-open': openGroups[group.key] }"
        >
          <button
            class="admin-nav-group__trigger"
            type="button"
            :aria-expanded="openGroups[group.key]"
            @click="toggleGroup(group.key)"
          >
            <i :class="group.icon" />
            <span>{{ t(group.label) }}</span>
            <i class="pi pi-chevron-down admin-nav-group__chevron" />
          </button>

          <div v-if="openGroups[group.key]" class="admin-nav-group__items">
            <RouterLink
              v-for="item in group.items"
              :key="item.to"
              class="admin-nav-subitem"
              :class="{ 'is-active': isActive(item.to) }"
              :to="item.to"
            >
              <i :class="item.icon" />
              <span>{{ t(item.label) }}</span>
            </RouterLink>
          </div>
        </div>

        <RouterLink
          v-for="item in secondaryNav"
          :key="item.to"
          :class="{ 'is-active': isActive(item.to) }"
          :to="item.to"
        >
          <i :class="item.icon" />
          <span>{{ t(item.label) }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <div>
          <!-- <p>Admin console</p>
          <h1>{{ route.meta.title || 'Dashboard' }}</h1> -->
        </div>
        <div class="admin-topbar__actions">
          <NotificationBell />
          <ThemeToggle />
          <Button icon="pi pi-language" :label="languageLabel" severity="secondary" outlined @click="toggleLanguage" />
          <!-- <Button as="router-link" to="/" icon="pi pi-external-link" :label="t('Client app')" outlined /> -->
          <Button icon="pi pi-user" :label="auth.displayName" severity="secondary" outlined />
          <Button icon="pi pi-sign-out" :label="t('Sign out')" severity="secondary" text @click="handleLogout" />
        </div>
      </header>

      <main class="admin-content">
        <RouterView />
      </main>
    </div>

    <Toast position="bottom-right" />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.admin-shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: 280px minmax(0, 1fr);
  background: var(--tm-page-bg);
}

.admin-sidebar {
  position: sticky;
  top: 0;
  display: flex;
  height: 100vh;
  flex-direction: column;
  gap: 28px;
  overflow-y: auto;
  padding: 24px;
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(180deg, rgba(185, 138, 46, 0.12), transparent 34%),
    var(--tm-charcoal);
}

.admin-brand :deep(.brand-mark__text strong) {
  color: #fff;
}

.admin-brand :deep(.brand-mark__text small) {
  color: rgba(255, 255, 255, 0.58);
}

.admin-sidebar nav {
  display: grid;
  gap: 6px;
}

.admin-sidebar a,
.admin-nav-group__trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 42px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  font-weight: 760;
  text-align: left;
}

.admin-sidebar a:hover,
.admin-sidebar a.is-active,
.admin-nav-group__trigger:hover,
.admin-nav-group.is-active > .admin-nav-group__trigger {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.admin-sidebar i,
.admin-nav-group__trigger i {
  color: var(--tm-gold);
}

.admin-nav-group {
  display: grid;
  gap: 4px;
}

.admin-nav-group__chevron {
  margin-left: auto;
  color: rgba(255, 255, 255, 0.54) !important;
  font-size: 0.72rem;
  transition: transform 160ms ease;
}

.admin-nav-group.is-open .admin-nav-group__chevron {
  transform: rotate(180deg);
}

.admin-nav-group__items {
  display: grid;
  gap: 4px;
  margin: 2px 0 8px 20px;
  padding-left: 10px;
  border-left: 1px solid rgba(255, 255, 255, 0.14);
}

.admin-sidebar .admin-nav-subitem {
  min-height: 36px;
  padding: 0 10px;
  font-size: 0.92rem;
}

.admin-sidebar .admin-nav-subitem i {
  font-size: 0.9rem;
}

.admin-main {
  min-width: 0;
}

.admin-topbar {
  display: flex;
  min-height: 92px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 22px 32px;
  border-bottom: 1px solid var(--tm-border);
  background: var(--tm-header-bg);
  backdrop-filter: blur(14px);
}

.admin-topbar p {
  margin: 0 0 5px;
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-topbar h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.55rem;
}

.admin-topbar__actions {
  display: flex;
  gap: 10px;
}

.admin-content {
  padding: 30px 32px 42px;
}

@media (max-width: 980px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    position: static;
    height: auto;
  }

  .admin-sidebar nav {
    display: grid;
  }

  .admin-sidebar a {
    white-space: nowrap;
  }
}

@media (max-width: 680px) {
  .admin-topbar {
    align-items: start;
    flex-direction: column;
    padding: 18px;
  }

  .admin-topbar__actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .admin-content {
    padding: 18px;
  }
}
</style>
