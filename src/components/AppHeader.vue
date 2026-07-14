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
  { label: 'Shop', to: '/shop' },
  { label: 'Cars', to: '/cars' },
  { label: 'Events', to: '/events' },
  { label: 'Healthcare', to: '/healthcare' },
  { label: 'Orders', to: '/orders' },
];

const shopItems = [
  { label: 'Tech', to: '/tech', icon: 'pi pi-mobile' },
  { label: 'Fashion', to: '/fashion', icon: 'pi pi-shopping-bag' },
  { label: 'Coffee', to: '/coffee', icon: 'pi pi-gift' },
];

const menuOpen = ref(false);
const activePath = computed(() => route.path);
const accountLabel = computed(() => (auth.isAuthenticated ? auth.displayName : t('Sign in')));

function isActive(to) {
  if (to === '/shop') {
    return ['/shop', '/tech', '/fashion', '/coffee', '/products'].some((path) => activePath.value.startsWith(path));
  }
  return activePath.value === to || activePath.value.startsWith(`${to}/`);
}

async function syncCart() {
  await cart.sync().catch(() => {});
}

watch(
  () => auth.isAuthenticated,
  () => syncCart(),
);

watch(() => route.fullPath, () => {
  menuOpen.value = false;
});

onMounted(syncCart);
</script>

<template>
  <header class="site-header">
    <div class="app-container site-header__inner">
      <BrandMark />

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
        <RouterLink class="header-icon search-action" to="/shop" :aria-label="t('Search')">
          <i class="pi pi-search" />
        </RouterLink>
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
        <RouterLink class="header-icon cart-action" to="/cart" :aria-label="t('Cart')">
          <i class="pi pi-shopping-bag" />
          <span v-if="cart.itemCount">{{ cart.itemCount }}</span>
        </RouterLink>
        <Button as="router-link" to="/account" class="account-btn" :label="accountLabel" icon="pi pi-user" />
        <button
          class="nav-toggle"
          type="button"
          :aria-expanded="menuOpen"
          :aria-label="t('Primary navigation')"
          @click="menuOpen = !menuOpen"
        >
          <i :class="menuOpen ? 'pi pi-times' : 'pi pi-bars'" />
        </button>
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

          <div class="site-header__mobile-shop">
            <span>{{ t('Shop') }}</span>
            <RouterLink v-for="item in shopItems" :key="item.to" :to="item.to">
              <i :class="item.icon" /> {{ t(item.label) }}
            </RouterLink>
          </div>

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
  border-bottom: 1px solid rgba(201, 146, 44, 0.16);
  background: var(--tm-header-bg);
  backdrop-filter: blur(20px);
}

.site-header__inner {
  display: flex;
  min-height: 86px;
  align-items: center;
  gap: 24px;
}

.site-header__nav {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}

.site-header__nav a {
  display: inline-flex;
  align-items: center;
  min-height: 42px;
  padding: 0 16px;
  border-radius: 999px;
  color: var(--tm-nav-text);
  font-size: 0.92rem;
  font-weight: 800;
  white-space: nowrap;
  transition: color 160ms ease, background 160ms ease;
}

.site-header__nav a:hover,
.site-header__nav a.is-active {
  color: var(--tm-emerald-dark);
  background: rgba(12, 155, 128, 0.1);
}

.site-header__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 9px;
}

.header-icon,
.nav-toggle {
  display: grid;
  position: relative;
  width: 46px;
  height: 46px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid var(--tm-border-strong);
  border-radius: 15px;
  background: var(--tm-surface-soft);
  color: var(--tm-heading);
  transition: border-color 160ms ease, color 160ms ease, transform 160ms ease;
}

.header-icon:hover,
.nav-toggle:hover {
  border-color: rgba(12, 155, 128, 0.42);
  color: var(--tm-emerald);
  transform: translateY(-1px);
}

.nav-toggle {
  display: none;
  cursor: pointer;
  font-size: 1.08rem;
}

.language-toggle {
  height: 46px;
  flex: 0 0 auto;
}

.cart-action span {
  position: absolute;
  top: -7px;
  right: -7px;
  display: grid;
  min-width: 21px;
  height: 21px;
  place-items: center;
  padding: 0 5px;
  border: 2px solid var(--tm-header-bg);
  border-radius: 999px;
  background: var(--tm-emerald);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 950;
}

.account-btn {
  min-height: 46px;
  flex: 0 0 auto;
  max-width: 180px;
}

.account-btn :deep(.p-button-label) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-header__mobile {
  border-top: 1px solid var(--tm-border);
  background: var(--tm-header-bg);
  backdrop-filter: blur(20px);
}

.site-header__mobile-inner {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
  padding: 16px 0 20px;
}

.site-header__mobile a {
  display: flex;
  align-items: center;
  min-height: 48px;
  padding: 0 14px;
  border-radius: 14px;
  color: var(--tm-nav-text);
  font-weight: 820;
}

.site-header__mobile a:hover,
.site-header__mobile a.is-active {
  color: var(--tm-heading);
  background: rgba(12, 155, 128, 0.1);
}

.site-header__mobile-shop {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 8px 0;
  padding: 14px 0;
  border-block: 1px solid var(--tm-border);
}

.site-header__mobile-shop > span {
  grid-column: 1 / -1;
  padding-inline: 10px;
  color: var(--tm-gold);
  font-size: 0.72rem;
  font-weight: 950;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.site-header__mobile-shop a {
  justify-content: center;
  gap: 8px;
  border: 1px solid var(--tm-border);
  background: var(--tm-surface);
  font-size: 0.84rem;
}

.site-header__mobile-admin {
  color: var(--tm-muted) !important;
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

@media (max-width: 1020px) {
  .site-header__nav {
    display: none;
  }

  .site-header__actions {
    margin-left: auto;
  }

  .nav-toggle {
    display: grid;
  }
}

@media (max-width: 620px) {
  .site-header__inner {
    min-height: 72px;
    gap: 10px;
  }

  .site-header__inner :deep(.brand-mark__symbol) {
    width: 44px;
    height: 44px;
    border-radius: 13px;
  }

  .site-header__inner :deep(.brand-mark__symbol img) {
    width: 32px;
    height: 32px;
  }

  .language-toggle {
    width: 44px;
    height: 44px;
    padding-inline: 0;
  }

  .language-toggle :deep(.p-button-icon) {
    display: none;
  }

  .search-action,
  .theme-toggle,
  .account-btn {
    display: none;
  }

  .header-icon,
  .nav-toggle {
    width: 44px;
    height: 44px;
  }

  .site-header__mobile-inner {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 400px) {
  .site-header__inner :deep(.brand-mark__text small) {
    display: none;
  }

  .site-header__inner :deep(.brand-mark__text strong) {
    font-size: 1rem;
  }

  .site-header__actions {
    gap: 6px;
  }
}
</style>
