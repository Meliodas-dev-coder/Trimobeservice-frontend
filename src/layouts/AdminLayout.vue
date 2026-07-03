<script setup>
import { useRoute, useRouter } from 'vue-router';

import BrandMark from '@/components/BrandMark.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

async function handleLogout() {
  await auth.logout();
  router.replace({ name: 'admin-login' });
}

const nav = [
  { label: 'Dashboard', icon: 'pi pi-chart-line', to: '/admin' },
  { label: 'Categories', icon: 'pi pi-tags', to: '/admin/categories' },
  { label: 'Brands', icon: 'pi pi-bookmark', to: '/admin/brands' },
  { label: 'Products', icon: 'pi pi-mobile', to: '/admin/products' },
  { label: 'Cars', icon: 'pi pi-car', to: '/admin/cars' },
  { label: 'Car categories', icon: 'pi pi-sitemap', to: '/admin/car-categories' },
  { label: 'Drivers', icon: 'pi pi-id-card', to: '/admin/drivers' },
  { label: 'Orders', icon: 'pi pi-shopping-bag', to: '/admin/orders' },
  { label: 'Bookings', icon: 'pi pi-calendar-clock', to: '/admin/bookings' },
  { label: 'Payments', icon: 'pi pi-wallet', to: '/admin/payments' },
  { label: 'Customers', icon: 'pi pi-users', to: '/admin/customers' },
];

function isActive(to) {
  if (to === '/admin') {
    return route.path === '/admin';
  }
  // exact segment match so /admin/cars doesn't also light up for /admin/car-categories
  return route.path === to || route.path.startsWith(`${to}/`);
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-sidebar">
      <BrandMark class="admin-brand" />
      <nav aria-label="Admin navigation">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :class="{ 'is-active': isActive(item.to) }"
          :to="item.to"
        >
          <i :class="item.icon" />
          <span>{{ item.label }}</span>
        </RouterLink>
      </nav>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar">
        <div>
          <p>Admin console</p>
          <h1>{{ route.meta.title || 'Dashboard' }}</h1>
        </div>
        <div class="admin-topbar__actions">
          <ThemeToggle />
          <Button as="router-link" to="/" icon="pi pi-external-link" label="Client app" outlined />
          <Button icon="pi pi-user" :label="auth.displayName" severity="secondary" outlined />
          <Button icon="pi pi-sign-out" label="Sign out" severity="secondary" text @click="handleLogout" />
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

.admin-sidebar a {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  padding: 0 12px;
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.72);
  font-weight: 760;
}

.admin-sidebar a:hover,
.admin-sidebar a.is-active {
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
}

.admin-sidebar i {
  color: var(--tm-gold);
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
    display: flex;
    overflow-x: auto;
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
