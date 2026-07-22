<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

// The in-page switcher for a catalog department's back office. It is driven by
// the department key so Coffee, Tech, and Fashion share one component — the
// screens behind every link are the same generic ones, scoped by route meta.
const props = defineProps({
  department: { type: String, required: true },
});

const route = useRoute();
const auth = useAuthStore();
const { t } = useAdminI18n();

// Each department exposes the same six areas; only the icon for "products"
// changes so the nav still reads like the shop it belongs to.
const PRODUCT_ICONS = {
  tech: 'pi pi-mobile',
  fashion: 'pi pi-shopping-bag',
  coffee: 'pi pi-inbox',
};

const links = computed(() => {
  const base = `/admin/${props.department}`;
  return [
    { label: 'Overview', icon: 'pi pi-th-large', to: `${base}/overview`, capability: `${props.department}.overview` },
    { label: 'Categories', icon: 'pi pi-tags', to: `${base}/categories`, capability: `${props.department}.categories` },
    { label: 'Brands', icon: 'pi pi-bookmark', to: `${base}/brands`, capability: `${props.department}.brands` },
    { label: 'Products', icon: PRODUCT_ICONS[props.department] || 'pi pi-box', to: `${base}/products`, capability: `${props.department}.products` },
    { label: 'Orders', icon: 'pi pi-shopping-cart', to: `${base}/orders`, capability: `${props.department}.orders` },
    { label: 'Stock', icon: 'pi pi-box', to: `${base}/stock`, capability: `${props.department}.stock` },
  ];
});

const visibleLinks = computed(() => links.value.filter((link) => auth.canBusiness(link.capability)));

function active(link) {
  return route.path === link.to || route.path.startsWith(`${link.to}/`);
}
</script>

<template>
  <nav
    v-if="visibleLinks.length > 1"
    class="department-workspace-nav"
    :style="{ '--nav-columns': visibleLinks.length }"
    :aria-label="t('Department workspace')"
  >
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
.department-workspace-nav {
  display: grid;
  grid-template-columns: repeat(var(--nav-columns, 6), minmax(0, 1fr));
  gap: 7px;
  padding: 7px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: color-mix(in srgb, var(--tm-surface-soft) 88%, transparent);
}

.department-workspace-nav a {
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
  transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
}

.department-workspace-nav a:hover,
.department-workspace-nav a:focus-visible {
  border-color: var(--tm-border);
  background: var(--tm-surface);
  color: var(--tm-heading);
  outline: none;
}

.department-workspace-nav a.is-active {
  border-color: transparent;
  background: var(--tm-charcoal);
  color: #fff;
}

@media (max-width: 900px) {
  .department-workspace-nav {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .department-workspace-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .department-workspace-nav a span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}
</style>
