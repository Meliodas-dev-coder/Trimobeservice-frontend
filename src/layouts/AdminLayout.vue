<script setup>
import { computed, ref, watch } from 'vue';
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
const sidebarCollapsed = ref(false);
const mobileNavOpen = ref(false);

const navSections = [
  { label: 'Catalog', groups: groupedNav.slice(0, 3) },
  { label: 'Operations', groups: groupedNav.slice(3) },
];

const pageTitle = computed(() => route.meta.title || 'Dashboard');
const adminInitial = computed(() => String(auth.displayName || 'A').trim().charAt(0).toUpperCase());
const pageEyebrow = computed(() => {
  const activeGroup = groupedNav.find((group) => groupIsActive(group));
  if (activeGroup) {
    return activeGroup.label;
  }
  if (secondaryNav.some((item) => isActive(item.to))) {
    return 'Finance & people';
  }
  return 'Operations console';
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
  if (sidebarCollapsed.value) {
    sidebarCollapsed.value = false;
  }
  openGroups.value = {
    ...openGroups.value,
    [key]: !openGroups.value[key],
  };
}

watch(
  () => route.path,
  () => {
    mobileNavOpen.value = false;
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
  <div class="admin-shell" :class="{ 'is-collapsed': sidebarCollapsed }">
    <button
      v-if="mobileNavOpen"
      type="button"
      class="admin-sidebar-backdrop"
      :aria-label="t('Close navigation')"
      @click="mobileNavOpen = false"
    />

    <aside id="admin-navigation" class="admin-sidebar" :class="{ 'is-mobile-open': mobileNavOpen }">
      <div class="admin-sidebar__head">
        <BrandMark class="admin-brand" to="/admin" :aria-label="t('Dashboard')" />
        <button
          type="button"
          class="admin-sidebar__collapse"
          :aria-label="t(sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar')"
          @click="sidebarCollapsed = !sidebarCollapsed"
        >
          <i :class="sidebarCollapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'" />
        </button>
      </div>

      <div class="admin-sidebar__body">
        <nav :aria-label="t('Admin navigation')">
          <section class="admin-nav-section">
            <p class="admin-nav-section__label">{{ t('Overview') }}</p>
            <RouterLink
              v-for="item in primaryNav"
              :key="item.to"
              :class="{ 'is-active': isActive(item.to) }"
              :title="sidebarCollapsed ? t(item.label) : undefined"
              :to="item.to"
            >
              <i :class="item.icon" />
              <span>{{ t(item.label) }}</span>
            </RouterLink>
          </section>

          <section v-for="section in navSections" :key="section.label" class="admin-nav-section">
            <p class="admin-nav-section__label">{{ t(section.label) }}</p>
            <div
              v-for="group in section.groups"
              :key="group.key"
              class="admin-nav-group"
              :class="{ 'is-active': groupIsActive(group), 'is-open': openGroups[group.key] }"
            >
              <button
                class="admin-nav-group__trigger"
                type="button"
                :title="sidebarCollapsed ? t(group.label) : undefined"
                :aria-expanded="openGroups[group.key]"
                @click="toggleGroup(group.key)"
              >
                <i :class="group.icon" />
                <span>{{ t(group.label) }}</span>
                <i class="pi pi-chevron-down admin-nav-group__chevron" />
              </button>

              <div v-if="openGroups[group.key] && !sidebarCollapsed" class="admin-nav-group__items">
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
          </section>

          <section class="admin-nav-section">
            <p class="admin-nav-section__label">{{ t('Finance & people') }}</p>
            <RouterLink
              v-for="item in secondaryNav"
              :key="item.to"
              :class="{ 'is-active': isActive(item.to) }"
              :title="sidebarCollapsed ? t(item.label) : undefined"
              :to="item.to"
            >
              <i :class="item.icon" />
              <span>{{ t(item.label) }}</span>
            </RouterLink>
          </section>
        </nav>
      </div>

      <footer class="admin-sidebar__footer">
        <RouterLink to="/" class="admin-client-link" :title="sidebarCollapsed ? t('Client app') : undefined">
          <i class="pi pi-external-link" />
          <span>{{ t('Open client app') }}</span>
        </RouterLink>
      </footer>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <div class="admin-topbar__title">
          <Button
            class="admin-mobile-menu"
            icon="pi pi-bars"
            severity="secondary"
            text
            rounded
            :aria-label="t('Open navigation')"
            aria-controls="admin-navigation"
            :aria-expanded="mobileNavOpen"
            @click="mobileNavOpen = true"
          />
          <div>
            <p>{{ t(pageEyebrow) }}</p>
            <h1>{{ t(pageTitle) }}</h1>
          </div>
        </div>
        <div class="admin-topbar__actions">
          <NotificationBell />
          <ThemeToggle />
          <Button class="admin-language" icon="pi pi-language" :label="languageLabel" severity="secondary" outlined @click="toggleLanguage" />
          <span class="admin-user-chip" :title="auth.displayName">
            <span>{{ adminInitial }}</span>
            <strong>{{ auth.displayName }}</strong>
          </span>
          <Button icon="pi pi-sign-out" :aria-label="t('Sign out')" severity="secondary" text rounded @click="handleLogout" />
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
  --admin-sidebar-width: 268px;
  display: grid;
  min-height: 100vh;
  grid-template-columns: var(--admin-sidebar-width) minmax(0, 1fr);
  background:
    radial-gradient(circle at 88% 0%, rgba(201, 146, 44, 0.07), transparent 24%),
    var(--tm-page-bg);
  transition: grid-template-columns 180ms ease;
}

.admin-shell.is-collapsed {
  --admin-sidebar-width: 84px;
}

.admin-sidebar {
  position: sticky;
  top: 0;
  display: flex;
  height: 100vh;
  flex-direction: column;
  overflow: hidden;
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  background:
    radial-gradient(circle at 50% -5%, rgba(201, 146, 44, 0.2), transparent 26%),
    linear-gradient(180deg, var(--tm-charcoal) 0%, #141d1f 100%);
  z-index: 30;
}

.admin-sidebar__head {
  display: flex;
  min-height: 86px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 20px 18px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.09);
}

.admin-sidebar__collapse {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  place-items: center;
}

.admin-sidebar__collapse:hover,
.admin-sidebar__collapse:focus-visible {
  border-color: rgba(201, 146, 44, 0.5);
  color: #fff;
  outline: none;
}

.admin-sidebar__body {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 18px 14px 22px;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  scrollbar-width: thin;
}

.admin-brand :deep(.brand-mark__text strong) {
  color: #fff;
}

.admin-brand :deep(.brand-mark__text small) {
  color: rgba(255, 255, 255, 0.58);
}

.admin-shell.is-collapsed .admin-brand :deep(.brand-mark__text),
.admin-shell.is-collapsed .admin-nav-section__label,
.admin-shell.is-collapsed .admin-sidebar a span,
.admin-shell.is-collapsed .admin-nav-group__trigger span,
.admin-shell.is-collapsed .admin-nav-group__chevron {
  display: none;
}

.admin-shell.is-collapsed .admin-sidebar__head {
  min-height: 112px;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding-inline: 12px;
}

.admin-shell.is-collapsed .admin-brand :deep(.brand-mark__symbol) {
  width: 44px;
  height: 44px;
}

.admin-sidebar nav {
  display: grid;
  gap: 20px;
}

.admin-nav-section {
  display: grid;
  gap: 5px;
}

.admin-nav-section__label {
  margin: 0 10px 4px;
  color: rgba(255, 255, 255, 0.34);
  font-size: 0.65rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.admin-sidebar a,
.admin-nav-group__trigger {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 44px;
  padding: 0 11px;
  border: 0;
  border-radius: 11px;
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
  background: rgba(255, 255, 255, 0.09);
}

.admin-sidebar a.is-active,
.admin-nav-group.is-active > .admin-nav-group__trigger {
  box-shadow: inset 3px 0 0 var(--tm-gold);
  background: linear-gradient(90deg, rgba(201, 146, 44, 0.18), rgba(255, 255, 255, 0.06));
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
  margin: 2px 0 8px 21px;
  padding-left: 11px;
  border-left: 1px solid rgba(255, 255, 255, 0.14);
}

.admin-sidebar .admin-nav-subitem {
  min-height: 37px;
  padding: 0 10px;
  font-size: 0.92rem;
}

.admin-shell.is-collapsed .admin-sidebar a,
.admin-shell.is-collapsed .admin-nav-group__trigger {
  justify-content: center;
  padding: 0;
}

.admin-shell.is-collapsed .admin-sidebar i,
.admin-shell.is-collapsed .admin-nav-group__trigger i {
  font-size: 1.08rem;
}

.admin-sidebar__footer {
  padding: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
}

.admin-sidebar .admin-client-link {
  border: 1px solid rgba(255, 255, 255, 0.11);
  background: rgba(255, 255, 255, 0.05);
}

.admin-sidebar-backdrop {
  display: none;
}

.admin-sidebar .admin-nav-subitem i {
  font-size: 0.9rem;
}

.admin-main {
  min-width: 0;
}

.admin-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  min-height: 82px;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 16px clamp(20px, 3vw, 36px);
  border-bottom: 1px solid var(--tm-border);
  background: var(--tm-header-bg);
  backdrop-filter: blur(14px);
}

.admin-topbar__title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
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
  font-size: clamp(1.25rem, 2vw, 1.65rem);
  letter-spacing: -0.025em;
}

.admin-topbar__actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.admin-user-chip {
  display: flex;
  max-width: 210px;
  min-height: 42px;
  align-items: center;
  gap: 9px;
  padding: 5px 12px 5px 6px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  background: var(--tm-surface-soft);
}

.admin-user-chip > span {
  display: grid;
  width: 30px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--tm-gold), var(--tm-charcoal));
  color: #fff;
  font-size: 0.8rem;
  font-weight: 950;
  place-items: center;
}

.admin-user-chip strong {
  overflow: hidden;
  color: var(--tm-heading);
  font-size: 0.82rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-mobile-menu {
  display: none;
}

.admin-content {
  padding: clamp(22px, 3vw, 36px) clamp(20px, 3vw, 36px) 52px;
}

@media (max-width: 980px) {
  .admin-shell {
    grid-template-columns: 1fr;
  }

  .admin-sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(88vw, 300px);
    height: 100vh;
    box-shadow: 24px 0 60px rgba(0, 0, 0, 0.28);
    transform: translateX(-105%);
    transition: transform 180ms ease;
  }

  .admin-sidebar.is-mobile-open {
    transform: translateX(0);
  }

  .admin-sidebar-backdrop {
    position: fixed;
    inset: 0;
    z-index: 25;
    display: block;
    border: 0;
    background: rgba(8, 12, 13, 0.54);
    backdrop-filter: blur(3px);
  }

  .admin-sidebar__collapse {
    display: none;
  }

  .admin-shell.is-collapsed .admin-sidebar__head {
    min-height: 86px;
    flex-direction: row;
    justify-content: flex-start;
  }

  .admin-shell.is-collapsed .admin-brand :deep(.brand-mark__text),
  .admin-shell.is-collapsed .admin-nav-section__label,
  .admin-shell.is-collapsed .admin-sidebar a span,
  .admin-shell.is-collapsed .admin-nav-group__trigger span,
  .admin-shell.is-collapsed .admin-nav-group__chevron {
    display: initial;
  }

  .admin-shell.is-collapsed .admin-sidebar a,
  .admin-shell.is-collapsed .admin-nav-group__trigger {
    justify-content: flex-start;
    padding: 0 11px;
  }

  .admin-mobile-menu {
    display: inline-flex;
  }
}

@media (max-width: 680px) {
  .admin-topbar {
    min-height: 72px;
    gap: 10px;
    padding: 12px 14px;
  }

  .admin-topbar__actions {
    gap: 4px;
  }

  .admin-language :deep(.p-button-label),
  .admin-user-chip strong {
    display: none;
  }

  .admin-language {
    width: 40px;
    padding-inline: 0;
  }

  .admin-user-chip {
    padding: 4px;
    border: 0;
    background: transparent;
  }

  .admin-topbar p {
    display: none;
  }

  .admin-content {
    padding: 20px 14px 42px;
  }
}
</style>
