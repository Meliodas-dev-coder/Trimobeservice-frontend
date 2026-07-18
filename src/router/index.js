import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import AdminDashboardView from '@/views/admin/AdminDashboardView.vue';
import AdminCarDetailView from '@/views/admin/AdminCarDetailView.vue';
import AdminProductDetailView from '@/views/admin/AdminProductDetailView.vue';
import AdminOrderCreateView from '@/views/admin/AdminOrderCreateView.vue';
import AdminEventRequestCreateView from '@/views/admin/AdminEventRequestCreateView.vue';
import AdminHealthcareSettingsView from '@/views/admin/AdminHealthcareSettingsView.vue';
import AdminInvoicesView from '@/views/admin/AdminInvoicesView.vue';
import AdminInvoiceView from '@/views/admin/AdminInvoiceView.vue';
import AdminOrgSettingsView from '@/views/admin/AdminOrgSettingsView.vue';
import AdminAccountView from '@/views/admin/AdminAccountView.vue';
import AdminLoginView from '@/views/admin/AdminLoginView.vue';
import AdminNoAccessView from '@/views/admin/AdminNoAccessView.vue';
import AdminResourceView from '@/views/admin/AdminResourceView.vue';
import AdminTechOverviewView from '@/views/admin/AdminTechOverviewView.vue';
import AdminMobilityOverviewView from '@/views/admin/AdminMobilityOverviewView.vue';
import AdminEventOverviewView from '@/views/admin/AdminEventOverviewView.vue';
import AdminHealthcareOverviewView from '@/views/admin/AdminHealthcareOverviewView.vue';
import AccountView from '@/views/public/AccountView.vue';
import CartView from '@/views/public/CartView.vue';
import CarDetailView from '@/views/public/CarDetailView.vue';
import CarsView from '@/views/public/CarsView.vue';
import MultiCarBookingView from '@/views/public/MultiCarBookingView.vue';
import BookingConfirmationView from '@/views/public/BookingConfirmationView.vue';
import CoffeeMisionaView from '@/views/public/CoffeeMisionaView.vue';
import EventPlanView from '@/views/public/EventPlanView.vue';
import EventRequestConfirmationView from '@/views/public/EventRequestConfirmationView.vue';
import EventsView from '@/views/public/EventsView.vue';
import ArtistsView from '@/views/public/ArtistsView.vue';
import ArtistDetailView from '@/views/public/ArtistDetailView.vue';
import HealthcareView from '@/views/public/HealthcareView.vue';
import HealthcareRequestView from '@/views/public/HealthcareRequestView.vue';
import HealthcareRequestConfirmationView from '@/views/public/HealthcareRequestConfirmationView.vue';
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
        // The standalone Smartphones/Accessories pages were folded into the Tech
        // department. Keep the old paths as redirects so any lingering links
        // resolve to /tech instead of a removed page (search query preserved).
        { path: 'phones', redirect: (to) => ({ name: 'tech', query: to.query }) },
        { path: 'accessories', redirect: (to) => ({ name: 'tech', query: to.query }) },
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
          path: 'cars/multiple',
          name: 'multi-car-booking',
          component: MultiCarBookingView,
          meta: { title: 'Book multiple cars' },
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
          path: 'healthcare',
          name: 'healthcare',
          component: HealthcareView,
          meta: {
            title: 'Healthcare',
            eyebrow: 'Care',
            description: 'Home consultations and care packages with doctors and nurses.',
          },
        },
        {
          path: 'healthcare/request',
          name: 'healthcare-request',
          component: HealthcareRequestView,
          meta: { title: 'Request home care' },
        },
        {
          path: 'healthcare-requests/:id/confirmation',
          name: 'healthcare-request-confirmation',
          component: HealthcareRequestConfirmationView,
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
          path: 'tech',
          redirect: { name: 'admin-tech-overview' },
        },
        {
          path: 'tech/overview',
          name: 'admin-tech-overview',
          component: AdminTechOverviewView,
          meta: { title: 'Tech overview', department: 'tech', description: 'Manage the complete Tech catalog.' },
        },
        {
          path: 'tech/categories',
          name: 'admin-tech-categories',
          component: AdminResourceView,
          meta: { title: 'Tech categories', resource: 'categories', department: 'tech', defaultView: 'card', description: 'Phone, laptop & accessory categories.' },
        },
        {
          path: 'tech/brands',
          name: 'admin-tech-brands',
          component: AdminResourceView,
          meta: { title: 'Tech brands', resource: 'brands', department: 'tech', defaultView: 'card', description: 'Manufacturers for the tech catalog.' },
        },
        {
          path: 'tech/products',
          name: 'admin-tech-products',
          component: AdminResourceView,
          meta: { title: 'Tech products', resource: 'products', department: 'tech', defaultView: 'card', description: 'Phones, laptops, audio, and accessories.' },
        },
        {
          path: 'tech/products/new',
          name: 'admin-tech-product-new',
          component: AdminProductDetailView,
          meta: { title: 'New Tech product', department: 'tech', description: 'Create a Tech product, then add variants and images.' },
        },
        {
          path: 'tech/products/:id',
          name: 'admin-tech-product-detail',
          component: AdminProductDetailView,
          meta: { title: 'Tech product detail', department: 'tech', description: 'Edit a Tech product, its variants, and images.' },
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
        // Coffee is a products-only department (its category + Kafe Misiona brand
        // are seeded), sold like phones: product → variants (SKUs) → cart → order.
        {
          path: 'coffee/products',
          name: 'admin-coffee-products',
          component: AdminResourceView,
          meta: { title: 'Coffee products', resource: 'products', department: 'coffee', description: 'Kafe Misiona coffee packs — variants, prices, stock, and images.' },
        },
        {
          path: 'mobility',
          redirect: { name: 'admin-mobility-overview' },
        },
        {
          path: 'mobility/overview',
          name: 'admin-mobility-overview',
          component: AdminMobilityOverviewView,
          meta: { title: 'Mobility overview', description: 'Manage fleet readiness, drivers, and bookings.' },
        },
        {
          path: 'cars',
          name: 'admin-cars',
          component: AdminResourceView,
          meta: { title: 'Cars', resource: 'cars', defaultView: 'card', description: 'Manage fleet cars, daily rates, and real-time availability.' },
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
          meta: { title: 'Car categories', resource: 'car-categories', defaultView: 'card', description: 'Structure the fleet and define default daily or cargo pricing.' },
        },
        {
          path: 'drivers',
          name: 'admin-drivers',
          component: AdminResourceView,
          meta: { title: 'Drivers', resource: 'drivers', defaultView: 'card', description: 'Keep contact, license, and live assignment status easy to scan.' },
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
          meta: { title: 'Bookings', resource: 'bookings', defaultView: 'card', description: 'Review trips, compare payment state, assign drivers, and advance rentals.' },
        },
        {
          path: 'events',
          redirect: { name: 'admin-events-overview' },
        },
        {
          path: 'events/overview',
          name: 'admin-events-overview',
          component: AdminEventOverviewView,
          meta: { title: 'Events overview', description: 'Manage the event catalog, talent roster, and client planning pipeline.' },
        },
        {
          path: 'event-service-categories',
          name: 'admin-event-service-categories',
          component: AdminResourceView,
          meta: { title: 'Service categories', resource: 'event-service-categories', defaultView: 'card', description: 'Organize sound, lighting, catering, decoration, talent, and other event offers.' },
        },
        {
          path: 'event-services',
          name: 'admin-event-services',
          component: AdminResourceView,
          meta: { title: 'Event services', resource: 'event-services', defaultView: 'card', description: 'Keep event offers, indicative prices, imagery, and customer visibility ready.' },
        },
        {
          path: 'artists',
          name: 'admin-artists',
          component: AdminResourceView,
          meta: { title: 'Gospel artists', resource: 'artists', defaultView: 'card', description: 'Manage the artist roster clients can browse and request.' },
        },
        {
          path: 'event-requests',
          name: 'admin-event-requests',
          component: AdminResourceView,
          meta: { title: 'Event requests', resource: 'event-requests', defaultView: 'card', description: 'Review client plans, compare budgets, set quotes, collect payment, and advance each event.' },
        },
        {
          path: 'event-requests/new',
          name: 'admin-event-request-new',
          component: AdminEventRequestCreateView,
          meta: { title: 'New event request', description: 'Log a phone/walk-in event request.' },
        },
        {
          path: 'healthcare',
          redirect: { name: 'admin-healthcare-overview' },
        },
        {
          path: 'healthcare/overview',
          name: 'admin-healthcare-overview',
          component: AdminHealthcareOverviewView,
          meta: { title: 'Healthcare overview', description: 'Manage care services, clinical staffing, requests, and emergency contact information.' },
        },
        {
          path: 'practitioners',
          name: 'admin-practitioners',
          component: AdminResourceView,
          meta: { title: 'Practitioners', resource: 'practitioners', defaultView: 'card', description: 'Keep the doctor and nurse roster ready for home-care assignments.' },
        },
        {
          path: 'healthcare/categories',
          name: 'admin-healthcare-categories',
          component: AdminResourceView,
          meta: { title: 'Care categories', resource: 'healthcare-service-categories', defaultView: 'card', description: 'Structure consultations and packages into clear customer-facing care groups.' },
        },
        {
          path: 'healthcare/services',
          name: 'admin-healthcare-services',
          component: AdminResourceView,
          meta: { title: 'Care services', resource: 'healthcare-services', defaultView: 'card', description: 'Manage consultation pricing, fixed packages, staffing needs, and visibility.' },
        },
        {
          path: 'healthcare/requests',
          name: 'admin-healthcare-requests',
          component: AdminResourceView,
          meta: { title: 'Care requests', resource: 'healthcare-requests', defaultView: 'card', description: 'Review patient needs, quote care, assign practitioners, collect payment, and track progress.' },
        },
        {
          path: 'healthcare/settings',
          name: 'admin-healthcare-settings',
          component: AdminHealthcareSettingsView,
          meta: { title: 'Emergency contact', description: 'Edit the emergency number shown on the client healthcare page.' },
        },
        {
          path: 'payments',
          name: 'admin-payments',
          component: AdminResourceView,
          meta: { title: 'Payments', resource: 'payments', description: 'Record manual payments and refunds.' },
        },
        {
          path: 'invoices',
          name: 'admin-invoices',
          component: AdminInvoicesView,
          meta: { title: 'Invoices', description: 'Proforma bills, final invoices, and credit notes.' },
        },
        {
          path: 'invoices/:id',
          name: 'admin-invoice-detail',
          component: AdminInvoiceView,
          meta: { title: 'Invoice', description: 'View, issue, and print an invoice.' },
        },
        {
          path: 'org-settings',
          name: 'admin-org-settings',
          component: AdminOrgSettingsView,
          meta: { title: 'Billing settings', description: 'Company identity and invoice defaults printed on every invoice.' },
        },
        {
          path: 'customers',
          name: 'admin-customers',
          component: AdminResourceView,
          meta: { title: 'Customers', resource: 'customers', description: 'View customer accounts (read-only).' },
        },
        {
          path: 'audit-logs',
          name: 'admin-audit-logs',
          component: AdminResourceView,
          meta: { title: 'Activity log', resource: 'audit-logs', description: 'Who changed what in the dashboard, and when.' },
        },
        {
          path: 'users',
          name: 'admin-users',
          component: AdminResourceView,
          meta: { title: 'Team members', resource: 'admin-users', description: 'Create admin employees and assign each one an access role.' },
        },
        {
          path: 'roles',
          name: 'admin-roles',
          component: AdminResourceView,
          meta: { title: 'Access roles', resource: 'admin-roles', description: 'Bundle admin screens into roles you can assign to employees.' },
        },
        {
          path: 'account',
          name: 'admin-account',
          component: AdminAccountView,
          meta: { title: 'My account', description: 'Your profile and password.' },
        },
        {
          path: 'no-access',
          name: 'admin-no-access',
          component: AdminNoAccessView,
          meta: { title: 'No access' },
        },
      ],
    },
  ],
});

// Which section permission each admin route requires. Restricted employees only
// reach screens their role grants; super-admins pass everything. This mirrors
// the backend's authz keys (internal/authz) — the backend is the real gate, so a
// route missing here still has its data protected server-side. Keep new admin
// routes in sync. String or array (any-of).
const ROUTE_PERMISSIONS = {
  'admin-dashboard': 'dashboard',
  'admin-categories': ['tech', 'fashion', 'coffee'],
  'admin-brands': ['tech', 'fashion', 'coffee'],
  'admin-products': ['tech', 'fashion', 'coffee'],
  'admin-product-new': ['tech', 'fashion', 'coffee'],
  'admin-product-detail': ['tech', 'fashion', 'coffee'],
  'admin-tech-overview': 'tech',
  'admin-tech-categories': 'tech',
  'admin-tech-brands': 'tech',
  'admin-tech-products': 'tech',
  'admin-tech-product-new': 'tech',
  'admin-tech-product-detail': 'tech',
  'admin-fashion-categories': 'fashion',
  'admin-fashion-brands': 'fashion',
  'admin-fashion-products': 'fashion',
  'admin-coffee-products': 'coffee',
  'admin-mobility-overview': 'mobility',
  'admin-cars': 'mobility',
  'admin-car-detail': 'mobility',
  'admin-car-categories': 'mobility',
  'admin-drivers': 'mobility',
  'admin-bookings': 'mobility',
  'admin-orders': 'orders',
  'admin-order-new': 'orders',
  'admin-events-overview': 'events',
  'admin-event-service-categories': 'events',
  'admin-event-services': 'events',
  'admin-artists': 'events',
  'admin-event-requests': 'events',
  'admin-event-request-new': 'events',
  'admin-healthcare-overview': 'healthcare',
  'admin-practitioners': 'healthcare',
  'admin-healthcare-categories': 'healthcare',
  'admin-healthcare-services': 'healthcare',
  'admin-healthcare-requests': 'healthcare',
  'admin-healthcare-settings': 'healthcare',
  'admin-payments': 'payments',
  'admin-invoices': 'invoices',
  'admin-invoice-detail': 'invoices',
  'admin-org-settings': 'invoices',
  'admin-customers': 'customers',
  'admin-audit-logs': 'audit_logs',
  'admin-users': 'user_management',
  'admin-roles': 'user_management',
};

// Ordered landing candidates: the first screen the signed-in admin can reach.
// Used for the post-login redirect and to bounce off a forbidden screen.
const PERMISSION_LANDING = [
  { permission: 'dashboard', to: { name: 'admin-dashboard' } },
  { permission: 'tech', to: { name: 'admin-tech-overview' } },
  { permission: 'fashion', to: { name: 'admin-fashion-products' } },
  { permission: 'coffee', to: { name: 'admin-coffee-products' } },
  { permission: 'mobility', to: { name: 'admin-mobility-overview' } },
  { permission: 'events', to: { name: 'admin-events-overview' } },
  { permission: 'healthcare', to: { name: 'admin-healthcare-overview' } },
  { permission: 'orders', to: { name: 'admin-orders' } },
  { permission: 'payments', to: { name: 'admin-payments' } },
  { permission: 'invoices', to: { name: 'admin-invoices' } },
  { permission: 'customers', to: { name: 'admin-customers' } },
  { permission: 'audit_logs', to: { name: 'admin-audit-logs' } },
  { permission: 'user_management', to: { name: 'admin-users' } },
];

function firstPermittedRoute(auth) {
  const match = PERMISSION_LANDING.find((entry) => auth.can(entry.permission));
  return match ? match.to : { name: 'admin-no-access' };
}

// Guard the admin area: only an authenticated admin may enter, and only the
// screens their role permits. Everything under /admin (except login) requires
// role=admin; individual screens additionally require their section permission.
router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.ensureReady(); // wait for session restore before deciding

  const isAdminArea = to.path.startsWith('/admin') && to.name !== 'admin-login';

  if (isAdminArea && !(auth.isAuthenticated && auth.isAdmin)) {
    return { name: 'admin-login', query: { redirect: to.fullPath } };
  }

  // Already-signed-in admins skip the login page → land on their first screen.
  if (to.name === 'admin-login' && auth.isAuthenticated && auth.isAdmin) {
    return firstPermittedRoute(auth);
  }

  // Screen-level access: redirect off any admin screen the role doesn't include.
  if (isAdminArea) {
    const required = ROUTE_PERMISSIONS[to.name];
    if (required && !auth.can(required)) {
      const target = firstPermittedRoute(auth);
      if (target.name && target.name !== to.name) {
        return target;
      }
      if (to.name !== 'admin-no-access') {
        return { name: 'admin-no-access' };
      }
    }
  }

  return true;
});

// Per-page browser tab titles. Detail views overwrite this once they know the
// product/car name (see setPageTitle in utils/format.js).
router.afterEach((to) => {
  document.title = to.meta?.title ? `${to.meta.title} — Trimobe` : 'Trimobe';
});

export default router;
