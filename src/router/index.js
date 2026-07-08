import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import AdminDashboardView from '@/views/admin/AdminDashboardView.vue';
import AdminCarDetailView from '@/views/admin/AdminCarDetailView.vue';
import AdminProductDetailView from '@/views/admin/AdminProductDetailView.vue';
import AdminOrderCreateView from '@/views/admin/AdminOrderCreateView.vue';
import AdminEventRequestCreateView from '@/views/admin/AdminEventRequestCreateView.vue';
import AdminLoginView from '@/views/admin/AdminLoginView.vue';
import AdminResourceView from '@/views/admin/AdminResourceView.vue';
import AccountView from '@/views/public/AccountView.vue';
import CartView from '@/views/public/CartView.vue';
import CarDetailView from '@/views/public/CarDetailView.vue';
import CarsView from '@/views/public/CarsView.vue';
import BookingConfirmationView from '@/views/public/BookingConfirmationView.vue';
import CoffeeMisionaView from '@/views/public/CoffeeMisionaView.vue';
import EventPlanView from '@/views/public/EventPlanView.vue';
import EventRequestConfirmationView from '@/views/public/EventRequestConfirmationView.vue';
import EventsView from '@/views/public/EventsView.vue';
import ArtistsView from '@/views/public/ArtistsView.vue';
import ArtistDetailView from '@/views/public/ArtistDetailView.vue';
import HomeView from '@/views/public/HomeView.vue';
import NotFoundView from '@/views/public/NotFoundView.vue';
import OrderConfirmationView from '@/views/public/OrderConfirmationView.vue';
import OrdersView from '@/views/public/OrdersView.vue';
import ProductCatalogView from '@/views/public/ProductCatalogView.vue';
import ProductDetailView from '@/views/public/ProductDetailView.vue';
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
          path: 'shop',
          name: 'shop',
          component: ProductCatalogView,
          meta: {
            title: 'Shop',
            eyebrow: 'Shop',
            catalogMode: 'shop',
            description: 'Browse the full Trimobe catalog — phones, accessories, and more.',
          },
        },
        {
          path: 'tech',
          name: 'tech',
          component: ProductCatalogView,
          meta: {
            title: 'Tech',
            eyebrow: 'Shop',
            catalogMode: 'department',
            department: 'tech',
            description: 'Phones, laptops, audio, and accessories.',
          },
        },
        {
          path: 'fashion',
          name: 'fashion',
          component: ProductCatalogView,
          meta: {
            title: 'Fashion',
            eyebrow: 'Shop',
            catalogMode: 'department',
            department: 'fashion',
            description: 'Clothing and footwear — pick your size and color.',
          },
        },
        {
          path: 'phones',
          name: 'phones',
          component: ProductCatalogView,
          meta: {
            title: 'Phones',
            eyebrow: 'Shop',
            catalogMode: 'phones',
            description: 'Product catalog with variants, storage, colors, stock, and MGA prices.',
          },
        },
        {
          path: 'accessories',
          name: 'accessories',
          component: ProductCatalogView,
          meta: {
            title: 'Accessories',
            eyebrow: 'Shop',
            catalogMode: 'accessories',
            description: 'Accessories catalog for chargers, cases, audio, and everyday phone needs.',
          },
        },
        {
          path: 'coffee',
          name: 'coffee',
          component: CoffeeMisionaView,
          meta: {
            title: 'Kafe Misiona',
            eyebrow: 'Coffee',
            description: 'Kafe Misiona coffee packs and gift-ready selections.',
          },
        },
        {
          path: 'products/:slug',
          name: 'product-detail',
          component: ProductDetailView,
          meta: { title: 'Product' },
        },
        {
          path: 'cars',
          name: 'cars',
          component: CarsView,
          meta: {
            title: 'Cars with driver',
            eyebrow: 'Hire',
            description: 'Date-based car booking with daily rates, driver assignment, and status tracking.',
          },
        },
        {
          path: 'cars/:slug',
          name: 'car-detail',
          component: CarDetailView,
          meta: { title: 'Car detail' },
        },
        {
          path: 'events',
          name: 'events',
          component: EventsView,
          meta: {
            title: 'Events',
            eyebrow: 'Plan',
            description: 'Sound, light, catering, and artists - one team plans your event.',
          },
        },
        {
          path: 'events/artists',
          name: 'artists',
          component: ArtistsView,
          meta: {
            title: 'Gospel artists',
            eyebrow: 'Events',
            description: 'Browse the Christian artists Trimobe works with and request them for your event.',
          },
        },
        {
          path: 'events/artists/:slug',
          name: 'artist-detail',
          component: ArtistDetailView,
          meta: { title: 'Artist' },
        },
        {
          path: 'events/plan',
          name: 'event-plan',
          component: EventPlanView,
          meta: { title: 'Plan your event' },
        },
        {
          path: 'event-requests/:id/confirmation',
          name: 'event-request-confirmation',
          component: EventRequestConfirmationView,
          meta: { title: 'Request received' },
        },
        {
          path: 'cart',
          name: 'cart',
          component: CartView,
          meta: {
            title: 'Cart',
            eyebrow: 'Checkout',
            description: 'Guest carts will live locally and merge into the customer account on login.',
          },
        },
        {
          path: 'orders',
          name: 'orders',
          component: OrdersView,
          meta: {
            title: 'Orders',
            eyebrow: 'Account',
            description: 'Customer order history with price snapshots and payment status.',
          },
        },
        {
          path: 'orders/:id/confirmation',
          name: 'order-confirmation',
          component: OrderConfirmationView,
          meta: { title: 'Order confirmed' },
        },
        {
          path: 'bookings/:id/confirmation',
          name: 'booking-confirmation',
          component: BookingConfirmationView,
          meta: { title: 'Booking confirmed' },
        },
        {
          path: 'account',
          name: 'account',
          component: AccountView,
          meta: {
            title: 'Account',
            eyebrow: 'Profile',
            description: 'Customer profile, addresses, orders, bookings, and saved contact details.',
          },
        },
        {
          path: ':pathMatch(.*)*',
          name: 'not-found',
          component: NotFoundView,
          meta: { title: 'Page not found' },
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
          path: 'products/new',
          name: 'admin-product-new',
          component: AdminProductDetailView,
          meta: { title: 'New product', description: 'Create a product, then add its variants and images.' },
        },
        {
          path: 'products/:id',
          name: 'admin-product-detail',
          component: AdminProductDetailView,
          meta: { title: 'Product detail', description: 'Edit a product, its specs, variants, and images.' },
        },

        // Department-scoped catalog: same generic screens, filtered to tech/fashion.
        {
          path: 'tech/categories',
          name: 'admin-tech-categories',
          component: AdminResourceView,
          meta: { title: 'Tech categories', resource: 'categories', department: 'tech', description: 'Phone, laptop & accessory categories.' },
        },
        {
          path: 'tech/brands',
          name: 'admin-tech-brands',
          component: AdminResourceView,
          meta: { title: 'Tech brands', resource: 'brands', department: 'tech', description: 'Manufacturers for the tech catalog.' },
        },
        {
          path: 'tech/products',
          name: 'admin-tech-products',
          component: AdminResourceView,
          meta: { title: 'Tech products', resource: 'products', department: 'tech', description: 'Phones, laptops, audio, and accessories.' },
        },
        {
          path: 'fashion/categories',
          name: 'admin-fashion-categories',
          component: AdminResourceView,
          meta: { title: 'Fashion categories', resource: 'categories', department: 'fashion', description: 'Clothing & footwear categories.' },
        },
        {
          path: 'fashion/brands',
          name: 'admin-fashion-brands',
          component: AdminResourceView,
          meta: { title: 'Fashion brands', resource: 'brands', department: 'fashion', description: 'Labels for the fashion catalog.' },
        },
        {
          path: 'fashion/products',
          name: 'admin-fashion-products',
          component: AdminResourceView,
          meta: { title: 'Fashion products', resource: 'products', department: 'fashion', description: 'Clothing & footwear products.' },
        },
        {
          path: 'cars',
          name: 'admin-cars',
          component: AdminResourceView,
          meta: { title: 'Cars', resource: 'cars', description: 'Manage fleet cars, rates, and status.' },
        },
        {
          path: 'cars/:id',
          name: 'admin-car-detail',
          component: AdminCarDetailView,
          meta: { title: 'Car detail', description: 'Edit car details, images, bookings, and usage.' },
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
          path: 'orders/new',
          name: 'admin-order-new',
          component: AdminOrderCreateView,
          meta: { title: 'New order', description: 'Create a phone/walk-in order.' },
        },
        {
          path: 'bookings',
          name: 'admin-bookings',
          component: AdminResourceView,
          meta: { title: 'Bookings', resource: 'bookings', description: 'Manage bookings, assign drivers, advance status.' },
        },
        {
          path: 'event-service-categories',
          name: 'admin-event-service-categories',
          component: AdminResourceView,
          meta: { title: 'Service categories', resource: 'event-service-categories', description: 'Event service categories.' },
        },
        {
          path: 'event-services',
          name: 'admin-event-services',
          component: AdminResourceView,
          meta: { title: 'Event services', resource: 'event-services', description: 'Manage the event services catalog.' },
        },
        {
          path: 'artists',
          name: 'admin-artists',
          component: AdminResourceView,
          meta: { title: 'Gospel artists', resource: 'artists', description: 'Manage the artist roster clients can browse and request.' },
        },
        {
          path: 'event-requests',
          name: 'admin-event-requests',
          component: AdminResourceView,
          meta: { title: 'Event requests', resource: 'event-requests', description: 'Review requests, set quotes, advance status.' },
        },
        {
          path: 'event-requests/new',
          name: 'admin-event-request-new',
          component: AdminEventRequestCreateView,
          meta: { title: 'New event request', description: 'Log a phone/walk-in event request.' },
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

// Per-page browser tab titles. Detail views overwrite this once they know the
// product/car name (see setPageTitle in utils/format.js).
router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} — Trimobe` : 'Trimobe';
});

export default router;
