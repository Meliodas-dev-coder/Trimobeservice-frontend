<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import BrandMark from '@/components/BrandMark.vue';
import ThemeToggle from '@/components/ThemeToggle.vue';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';

const route = useRoute();
const auth = useAuthStore();
const cart = useCartStore();
const { languageLabel, t, toggleLanguage } = usePublicI18n();

const navItems = [
  { label: 'Tech', to: '/tech' },
  { label: 'Fashion', to: '/fashion' },
  { label: 'Coffee', to: '/coffee' },
  { label: 'Cars', to: '/cars' },
  { label: 'Events', to: '/events' },
  { label: 'Orders', to: '/orders' },
];

const menuOpen = ref(false);
const activePath = computed(() => route.path);
const accountLabel = computed(() => (auth.isAuthenticated ? auth.displayName : t('Sign in')));

function isActive(to) {
  return activePath.value === to || activePath.value.startsWith(`${to}/`);
}

// sync() merges any guest cart into the account on login, and falls back to
// the local guest cart when signed out.
async function syncCart() {
  await cart.sync().catch(() => {});
}

watch(
  () => auth.isAuthenticated,
  () => syncCart(),
);

// Close the mobile menu whenever the route changes.
watch(() => route.fullPath, () => {
  menuOpen.value = false;
});

onMounted(syncCart);
</script>

<template>
  <header class="site-header">
    <div class="app-container site-header__inner">
      <div class="site-header__lead">
        <button
          class="nav-toggle"
          type="button"
          :aria-expanded="menuOpen"
          :aria-label="t('Primary navigation')"
          @click="menuOpen = !menuOpen"
        >
          <i :class="menuOpen ? 'pi pi-times' : 'pi pi-bars'" />
        </button>
        <BrandMark />
      </div>

      <nav class="site-header__nav" :aria-label="t('Primary navigation')">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :class="{ 'is-active': isActive(item.to) }"
          :to="item.to"
        >
          {{ t(item.label) }}
        </RouterLink>
      </nav>

      <div class="site-header__actions">
        <ThemeToggle :lightLabel="t('Switch to light mode')" :darkLabel="t('Switch to dark mode')" />
        <Button
          class="language-toggle"
          icon="pi pi-language"
          :label="languageLabel"
          severity="secondary"
          outlined
          :aria-label="languageLabel === 'FR' ? t('Switch to French') : t('Switch to English')"
          @click="toggleLanguage"
        />
        <!-- <RouterLink class="admin-link" to="/admin/login">{{ t('Admin') }}</RouterLink> -->
        <RouterLink class="cart-action" to="/cart" :aria-label="t('Cart')">
          <i class="pi pi-shopping-bag" />
          <span v-if="cart.itemCount">{{ cart.itemCount }}</span>
        </RouterLink>
        <Button as="router-link" to="/account" class="account-btn" :label="accountLabel" icon="pi pi-user" />
      </div>
    </div>

    <transition name="menu">
      <nav v-if="menuOpen" class="site-header__mobile" :aria-label="t('Primary navigation')">
        <div class="app-container site-header__mobile-inner">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :class="{ 'is-active': isActive(item.to) }"
            :to="item.to"
          >
            {{ t(item.label) }}
          </RouterLink>
          <RouterLink :class="{ 'is-active': isActive('/account') }" to="/account">{{ t('Account') }}</RouterLink>
          <RouterLink class="site-header__mobile-admin" to="/admin/login">{{ t('Admin') }}</RouterLink>
        </div>
      </nav>
    </transition>
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
  display: flex;
  min-height: 74px;
  align-items: center;
  gap: 18px;
}

.site-header__lead {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.nav-toggle {
  display: none;
  width: 42px;
  height: 42px;
  place-items: center;
  border: 1px solid var(--tm-border-strong);
  border-radius: var(--tm-radius-sm);
  background: var(--tm-surface-soft);
  color: var(--tm-heading);
  cursor: pointer;
  font-size: 1.05rem;
}

/* Nav takes the free space between brand and actions and clips/scrolls its own
   content, so it can never overlap the brand or the action cluster. */
.site-header__nav {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.site-header__nav::-webkit-scrollbar {
  display: none;
}

.site-header__nav a {
  display: inline-flex;
  align-items: center;
  min-height: 38px;
  padding: 0 14px;
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
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.language-toggle {
  height: 42px;
  flex: 0 0 auto;
}

.admin-link {
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 760;
  white-space: nowrap;
}

.admin-link:hover {
  color: var(--tm-heading);
}

.cart-action {
  display: grid;
  position: relative;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--tm-border-strong);
  border-radius: var(--tm-radius-sm);
  background: var(--tm-surface-soft);
  color: var(--tm-heading);
}

.cart-action span {
  position: absolute;
  top: -7px;
  right: -7px;
  display: grid;
  min-width: 20px;
  height: 20px;
  place-items: center;
  padding: 0 5px;
  border: 2px solid var(--tm-header-bg);
  border-radius: 999px;
  background: var(--tm-emerald);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 900;
}

/* Keep the account name from ballooning the action cluster. */
.account-btn {
  flex: 0 0 auto;
  max-width: 190px;
}

.account-btn :deep(.p-button-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* --- mobile dropdown --- */
.site-header__mobile {
  border-top: 1px solid var(--tm-border);
  background: var(--tm-header-bg);
  backdrop-filter: blur(18px);
}

.site-header__mobile-inner {
  display: grid;
  gap: 4px;
  padding: 12px 0 16px;
}

.site-header__mobile a {
  display: flex;
  align-items: center;
  min-height: 46px;
  padding: 0 14px;
  border-radius: 10px;
  color: var(--tm-nav-text);
  font-weight: 780;
}

.site-header__mobile a:hover,
.site-header__mobile a.is-active {
  color: var(--tm-heading);
  background: rgba(185, 138, 46, 0.13);
}

.site-header__mobile-admin {
  margin-top: 6px;
  border-top: 1px solid var(--tm-border);
  color: var(--tm-muted) !important;
  font-size: 0.9rem;
}

.menu-enter-active,
.menu-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Tablet / mobile: collapse the inline nav into the hamburger. */
@media (max-width: 900px) {
  .nav-toggle {
    display: grid;
  }

  .site-header__nav,
  .admin-link {
    display: none;
  }

  .site-header__actions {
    margin-left: auto;
  }
}

/* Small phones: trim the action cluster to icons. */
@media (max-width: 560px) {
  .site-header__inner {
    min-height: 64px;
    gap: 10px;
  }

  .language-toggle {
    width: 42px;
    padding-inline: 0;
  }

  .language-toggle :deep(.p-button-label) {
    display: none;
  }

  .account-btn {
    width: 42px;
    padding-inline: 0;
  }

  .account-btn :deep(.p-button-label) {
    display: none;
  }
}

@media (max-width: 380px) {
  .site-header__lead :deep(.brand-mark__text) {
    display: none;
  }
}
</style>
