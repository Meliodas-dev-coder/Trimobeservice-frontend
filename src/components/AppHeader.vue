<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import BrandMark from '@/components/BrandMark.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';

const route = useRoute();

const navItems = [
  { label: 'Phones', to: '/phones' },
  { label: 'Accessories', to: '/accessories' },
  { label: 'Coffee', to: '/coffee' },
  { label: 'Cars with driver', to: '/cars' },
  { label: 'Orders', to: '/orders' },
  { label: 'Account', to: '/account' },
];

const activePath = computed(() => route.path);
</script>

<template>
  <header class="site-header">
    <div class="app-container site-header__inner">
      <BrandMark />

      <nav class="site-header__nav" aria-label="Primary navigation">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :class="{ 'is-active': activePath.startsWith(item.to) }"
          :to="item.to"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="site-header__actions">
        <ThemeToggle />
        <RouterLink class="admin-link" to="/admin/login">Admin</RouterLink>
        <Button as="router-link" to="/cart" icon="pi pi-shopping-bag" severity="secondary" outlined aria-label="Cart" />
        <Button as="router-link" to="/account" label="Sign in" icon="pi pi-user" />
      </div>
    </div>
  </header>
</template>

<style scoped>
.site-header {
  position: sticky;
  z-index: 20;
  top: 0;
  border-bottom: 1px solid var(--tm-border);
  background: var(--tm-header-bg);
  backdrop-filter: blur(18px);
}

.site-header__inner {
  display: grid;
  min-height: 76px;
  align-items: center;
  gap: 22px;
  grid-template-columns: auto 1fr auto;
}

.site-header__nav {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.site-header__nav a {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 13px;
  border-radius: 999px;
  color: var(--tm-nav-text);
  font-size: 0.92rem;
  font-weight: 750;
  white-space: nowrap;
}

.site-header__nav a:hover,
.site-header__nav a.is-active {
  color: var(--tm-heading);
  background: rgba(185, 138, 46, 0.13);
}

.site-header__actions {
  display: flex;
  align-items: center;
  justify-content: end;
  gap: 10px;
}

.admin-link {
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 760;
}

.admin-link:hover {
  color: var(--tm-heading);
}

@media (max-width: 1010px) {
  .site-header__inner {
    grid-template-columns: 1fr auto;
  }

  .site-header__nav {
    order: 3;
    grid-column: 1 / -1;
    justify-content: start;
    padding-bottom: 14px;
    overflow-x: auto;
  }
}

@media (max-width: 640px) {
  .site-header__inner {
    min-height: auto;
    padding: 12px 0;
  }

  .site-header__actions .p-button:last-child {
    display: none;
  }
}
</style>
