import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import AdminDashboardView from '@/views/admin/AdminDashboardView.vue';
import AdminLoginView from '@/views/admin/AdminLoginView.vue';
import AdminResourceView from '@/views/admin/AdminResourceView.vue';
import HomeView from '@/views/public/HomeView.vue';
import PublicPlaceholderView from '@/views/public/PublicPlaceholderView.vue';
import AdminLayout from '@/layouts/AdminLayout.vue';
import PublicLayout from '@/layouts/PublicLayout.vue';

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior() {
    return { top: 0 };
  },
  routes: [
    {
      path: '/',
      component: PublicLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: HomeView,
        },
        {
          path: 'phones',
          name: 'phones',
          component: PublicPlaceholderView,
          meta: {
            title: 'Phones',
            eyebrow: 'Shop',
            description: 'Product catalog with variants, storage, colors, stock, and MGA prices.',
          },
        },
        {
          path: 'accessories',
          name: 'accessories',
          component: PublicPlaceholderView,
          meta: {
            title: 'Accessories',
            eyebrow: 'Shop',
            description: 'Accessories catalog for chargers, cases, audio, and everyday phone needs.',
          },
        },
        {
          path: 'coffee',
          name: 'coffee',
          component: PublicPlaceholderView,
          meta: {
            title: 'Coffee',
            eyebrow: 'Shop',
            description:
              'Coffee catalog for roasted selections, ground packs, beans, and gift bundles in MGA.',
          },
        },
        {
          path: 'cars',
          name: 'cars',
          component: PublicPlaceholderView,
          meta: {
            title: 'Cars with driver',
            eyebrow: 'Hire',
            description: 'Date-based car booking with daily rates, driver assignment, and status tracking.',
          },
        },
        {
          path: 'cart',
          name: 'cart',
          component: PublicPlaceholderView,
          meta: {
            title: 'Cart',
            eyebrow: 'Checkout',
            description: 'Guest carts will live locally and merge into the customer account on login.',
          },
        },
        {
          path: 'orders',
          name: 'orders',
          component: PublicPlaceholderView,
          meta: {
            title: 'Orders',
            eyebrow: 'Account',
            description: 'Customer order history with price snapshots and payment status.',
          },
        },
        {
          path: 'account',
          name: 'account',
          component: PublicPlaceholderView,
          meta: {
            title: 'Account',
            eyebrow: 'Profile',
            description: 'Customer profile, addresses, orders, bookings, and saved contact details.',
          },
        },
      ],
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: AdminLoginView,
    },
    {
      path: '/admin',
      component: AdminLayout,
      children: [
        {
          path: '',
          name: 'admin-dashboard',
          component: AdminDashboardView,
        },
        {
          path: 'categories',
          name: 'admin-categories',
          component: AdminResourceView,
          meta: { title: 'Categories', resource: 'categories', description: 'Manage phone & accessory categories.' },
        },
        {
          path: 'brands',
          name: 'admin-brands',
          component: AdminResourceView,
          meta: { title: 'Brands', resource: 'brands', description: 'Manage product brands.' },
        },
        {
          path: 'products',
          name: 'admin-products',
          component: AdminResourceView,
          meta: { title: 'Products', resource: 'products', description: 'Manage products; variants and images live per product.' },
        },
        {
          path: 'cars',
          name: 'admin-cars',
          component: AdminResourceView,
          meta: { title: 'Cars', resource: 'cars', description: 'Manage fleet cars, rates, and status.' },
        },
        {
          path: 'car-categories',
          name: 'admin-car-categories',
          component: AdminResourceView,
          meta: { title: 'Car categories', resource: 'car-categories', description: 'Car categories and their default daily rates.' },
        },
        {
          path: 'drivers',
          name: 'admin-drivers',
          component: AdminResourceView,
          meta: { title: 'Drivers', resource: 'drivers', description: 'Manage the driver roster.' },
        },
        {
          path: 'orders',
          name: 'admin-orders',
          component: AdminResourceView,
          meta: { title: 'Orders', resource: 'orders', description: 'Review orders, fulfillment, and payment state.' },
        },
        {
          path: 'bookings',
          name: 'admin-bookings',
          component: AdminResourceView,
          meta: { title: 'Bookings', resource: 'bookings', description: 'Manage bookings, assign drivers, advance status.' },
        },
        {
          path: 'payments',
          name: 'admin-payments',
          component: AdminResourceView,
          meta: { title: 'Payments', resource: 'payments', description: 'Record manual payments and refunds.' },
        },
        {
          path: 'customers',
          name: 'admin-customers',
          component: AdminResourceView,
          meta: { title: 'Customers', resource: 'customers', description: 'View customer accounts (read-only).' },
        },
      ],
    },
  ],
});

// Guard the admin area: only an authenticated admin may enter. Everything under
// /admin (except the login page) requires role=admin.
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.ensureReady(); // wait for session restore before deciding

  const isAdminArea = to.path.startsWith('/admin') && to.name !== 'admin-login';

  if (isAdminArea && !(auth.isAuthenticated && auth.isAdmin)) {
    return { name: 'admin-login', query: { redirect: to.fullPath } };
  }

  // Already-signed-in admins skip the login page.
  if (to.name === 'admin-login' && auth.isAuthenticated && auth.isAdmin) {
    return { name: 'admin-dashboard' };
  }

  return true;
});

export default router;
