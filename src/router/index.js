import { createRouter, createWebHistory } from 'vue-router';

import { useAuthStore } from '@/stores/auth';
import { hrFeatureForResource } from '@/data/hrAccess';
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
import AdminDepartmentOverviewView from '@/views/admin/AdminDepartmentOverviewView.vue';
import AdminMobilityOverviewView from '@/views/admin/AdminMobilityOverviewView.vue';
import AdminEventOverviewView from '@/views/admin/AdminEventOverviewView.vue';
import AdminHealthcareOverviewView from '@/views/admin/AdminHealthcareOverviewView.vue';
import AdminHrDashboardView from '@/views/admin/hr/AdminHrDashboardView.vue';
import AdminHrPortalView from '@/views/admin/hr/AdminHrPortalView.vue';
import AdminHrDirectoryView from '@/views/admin/hr/AdminHrDirectoryView.vue';
import AdminHrEmployeeDetailView from '@/views/admin/hr/AdminHrEmployeeDetailView.vue';
import AdminHrAreaView from '@/views/admin/hr/AdminHrAreaView.vue';
import AdminHrReportsView from '@/views/admin/hr/AdminHrReportsView.vue';
import AdminHrGovernanceView from '@/views/admin/hr/AdminHrGovernanceView.vue';
import AdminHrAccessView from '@/views/admin/hr/AdminHrAccessView.vue';
import AdminHrContractDocumentView from '@/views/admin/hr/AdminHrContractDocumentView.vue';
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
        {
          path: 'tech/orders',
          name: 'admin-tech-orders',
          component: AdminResourceView,
          meta: { title: 'Tech orders', resource: 'department-orders', department: 'tech', description: 'Orders containing Tech products, and this department’s share of them.' },
        },
        {
          path: 'tech/stock',
          name: 'admin-tech-stock',
          component: AdminResourceView,
          meta: { title: 'Tech stock', resource: 'stock', department: 'tech', description: 'On-hand quantities, reorder points, and movement history for Tech SKUs.' },
        },
        {
          path: 'fashion/orders',
          name: 'admin-fashion-orders',
          component: AdminResourceView,
          meta: { title: 'Fashion orders', resource: 'department-orders', department: 'fashion', description: 'Orders containing Fashion products, and this department’s share of them.' },
        },
        {
          path: 'fashion/stock',
          name: 'admin-fashion-stock',
          component: AdminResourceView,
          meta: { title: 'Fashion stock', resource: 'stock', department: 'fashion', description: 'On-hand quantities, reorder points, and movement history for Fashion SKUs.' },
        },
        // Coffee (Kafe Misiona) is sold like phones — product → variants (SKUs)
        // → cart → order — and runs a full back office: its own overview, its
        // slice of the shared order book, and its own shelf.
        {
          path: 'coffee',
          redirect: { name: 'admin-coffee-overview' },
        },
        {
          path: 'coffee/overview',
          name: 'admin-coffee-overview',
          component: AdminDepartmentOverviewView,
          meta: { title: 'Coffee overview', department: 'coffee', description: 'Kafe Misiona sales, orders, stock, and what needs attention.' },
        },
        {
          path: 'coffee/categories',
          name: 'admin-coffee-categories',
          component: AdminResourceView,
          meta: { title: 'Coffee categories', resource: 'categories', department: 'coffee', defaultView: 'card', description: 'How the Kafe Misiona range is organised.' },
        },
        {
          path: 'coffee/brands',
          name: 'admin-coffee-brands',
          component: AdminResourceView,
          meta: { title: 'Coffee brands', resource: 'brands', department: 'coffee', defaultView: 'card', description: 'Coffee labels, starting with Kafe Misiona.' },
        },
        {
          path: 'coffee/products',
          name: 'admin-coffee-products',
          component: AdminResourceView,
          meta: { title: 'Coffee products', resource: 'products', department: 'coffee', defaultView: 'card', description: 'Kafe Misiona coffee packs — variants, prices, stock, and images.' },
        },
        {
          path: 'coffee/products/new',
          name: 'admin-coffee-product-new',
          component: AdminProductDetailView,
          meta: { title: 'New coffee product', department: 'coffee', description: 'Create a coffee product, then add its pack sizes and images.' },
        },
        {
          path: 'coffee/products/:id',
          name: 'admin-coffee-product-detail',
          component: AdminProductDetailView,
          meta: { title: 'Coffee product detail', department: 'coffee', description: 'Edit a coffee product, its pack sizes, and images.' },
        },
        {
          path: 'coffee/orders',
          name: 'admin-coffee-orders',
          component: AdminResourceView,
          meta: { title: 'Coffee orders', resource: 'department-orders', department: 'coffee', description: 'Orders containing coffee, followed from placement to hand-over.' },
        },
        {
          path: 'coffee/stock',
          name: 'admin-coffee-stock',
          component: AdminResourceView,
          meta: { title: 'Coffee stock', resource: 'stock', department: 'coffee', description: 'Pack-size stock levels, reorder points, and every movement behind them.' },
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
          path: 'hr',
          redirect: { name: 'admin-hr-overview' },
        },
        {
          path: 'hr/overview',
          name: 'admin-hr-overview',
          component: AdminHrDashboardView,
          meta: { title: 'HR overview', description: 'Manage the complete employee lifecycle from one workspace.' },
        },
        {
          path: 'hr/portal',
          name: 'admin-hr-portal',
          component: AdminHrPortalView,
          meta: { title: 'My HR', description: 'Your leave, working time, and personal HR details.' },
        },
        {
          path: 'hr/employees',
          name: 'admin-hr-employees',
          component: AdminHrDirectoryView,
          meta: { title: 'Employee directory', description: 'Manage employee identity and work records.' },
        },
        {
          path: 'hr/me',
          name: 'admin-hr-self',
          component: AdminHrEmployeeDetailView,
          meta: { title: 'My employee profile', description: 'Your HR record, documents, requests, time, performance, and access.' },
        },
        {
          path: 'hr/employees/:id',
          name: 'admin-hr-employee-detail',
          component: AdminHrEmployeeDetailView,
          meta: { title: 'Employee profile', description: 'Employee record, documents, lifecycle, leave, and compensation.' },
        },
        {
          path: 'hr/reports',
          name: 'admin-hr-reports',
          component: AdminHrReportsView,
          meta: { title: 'HR reports', description: 'Operational HR reports and CSV exports.' },
        },
        {
          path: 'hr/notifications',
          name: 'admin-hr-notifications',
          component: AdminHrGovernanceView,
          meta: { title: 'HR notifications', hrResource: 'notifications', description: 'HR deadlines, approvals, and employee changes.' },
        },
        {
          path: 'hr/audit-history',
          name: 'admin-hr-audit-history',
          component: AdminHrGovernanceView,
          meta: { title: 'HR audit history', hrResource: 'audit-history', description: 'Complete audit trail for HR data and workflows.' },
        },
        {
          path: 'hr/access',
          name: 'admin-hr-access',
          component: AdminHrAccessView,
          meta: { title: 'Organization access control', description: 'Department modules, position capabilities, and scoped HR responsibilities.' },
        },
        {
          path: 'hr/contract-documents/:id',
          name: 'admin-hr-contract-document',
          component: AdminHrContractDocumentView,
          meta: { title: 'Contract document', hrResource: 'contract-documents', description: 'The issued contract, ready to print.' },
        },
        {
          path: 'hr/:area(organization|lifecycle|leave|time|performance|recruitment|finance)',
          name: 'admin-hr-area',
          component: AdminHrAreaView,
          meta: { title: 'HR workspace', description: 'Manage connected HR workflows.' },
        },
        {
          path: 'hr/:area(organization|lifecycle|leave|time|performance|recruitment|finance)/:resource',
          name: 'admin-hr-area-resource',
          component: AdminHrAreaView,
          meta: { title: 'HR workspace', description: 'Manage connected HR workflows.' },
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
          redirect: { name: 'admin-hr-employees', query: { accounts: '1' } },
        },
        {
          path: 'roles',
          name: 'admin-roles',
          redirect: { name: 'admin-hr-access' },
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
const ROUTE_ACCESS = {
  'admin-dashboard': { business: 'dashboard.overview' },
  'admin-categories': { permission: ['tech', 'fashion', 'coffee'] },
  'admin-brands': { permission: ['tech', 'fashion', 'coffee'] },
  'admin-products': { permission: ['tech', 'fashion', 'coffee'] },
  'admin-product-new': { permission: ['tech', 'fashion', 'coffee'] },
  'admin-product-detail': { permission: ['tech', 'fashion', 'coffee'] },
  'admin-tech-overview': { business: ['tech.overview', 'tech.categories', 'tech.brands', 'tech.products'] },
  'admin-tech-categories': { business: 'tech.categories' },
  'admin-tech-brands': { business: 'tech.brands' },
  'admin-tech-products': { business: 'tech.products' },
  'admin-tech-product-new': { business: 'tech.products', level: 'manage' },
  'admin-tech-product-detail': { business: 'tech.products' },
  'admin-tech-orders': { business: 'tech.orders' },
  'admin-tech-stock': { business: 'tech.stock' },
  'admin-fashion-categories': { business: 'fashion.categories' },
  'admin-fashion-brands': { business: 'fashion.brands' },
  'admin-fashion-products': { business: 'fashion.products' },
  'admin-fashion-orders': { business: 'fashion.orders' },
  'admin-fashion-stock': { business: 'fashion.stock' },
  'admin-coffee-overview': { business: 'coffee.overview' },
  'admin-coffee-categories': { business: 'coffee.categories' },
  'admin-coffee-brands': { business: 'coffee.brands' },
  'admin-coffee-products': { business: 'coffee.products' },
  'admin-coffee-product-new': { business: 'coffee.products', level: 'manage' },
  'admin-coffee-product-detail': { business: 'coffee.products' },
  'admin-coffee-orders': { business: 'coffee.orders' },
  'admin-coffee-stock': { business: 'coffee.stock' },
  'admin-mobility-overview': { business: 'mobility.overview' },
  'admin-cars': { business: 'mobility.cars' },
  'admin-car-detail': { business: 'mobility.cars' },
  'admin-car-categories': { business: 'mobility.categories' },
  'admin-drivers': { business: 'mobility.drivers' },
  'admin-bookings': { business: 'mobility.bookings' },
  'admin-orders': { business: 'orders.orders' },
  'admin-order-new': { business: 'orders.orders', level: 'manage' },
  'admin-events-overview': { business: 'events.overview' },
  'admin-event-service-categories': { business: 'events.categories' },
  'admin-event-services': { business: 'events.services' },
  'admin-artists': { business: 'events.artists' },
  'admin-event-requests': { business: 'events.requests' },
  'admin-event-request-new': { business: 'events.requests', level: 'manage' },
  'admin-healthcare-overview': { business: 'healthcare.overview' },
  'admin-practitioners': { business: 'healthcare.practitioners' },
  'admin-healthcare-categories': { business: 'healthcare.categories' },
  'admin-healthcare-services': { business: 'healthcare.services' },
  'admin-healthcare-requests': { business: 'healthcare.requests' },
  'admin-healthcare-settings': { business: 'healthcare.settings' },
  'admin-hr-overview': (auth) => auth.isHrManager,
  'admin-hr-portal': { employee: true },
  'admin-hr-self': { hr: true, employee: true },
  'admin-hr-employees': { hrFeature: 'employees' },
  'admin-hr-employee-detail': (auth, to) => Number(to.params.id) === Number(auth.employee?.id) || auth.canHr('employees', 'view'),
  'admin-hr-area': (auth, to) => auth.canHrArea(to.params.area, 'view'),
  'admin-hr-area-resource': (auth, to) => auth.canHr(hrFeatureForResource(to.params.resource), 'view'),
  'admin-hr-reports': { hrFeature: 'reports' },
  'admin-hr-notifications': { hr: true },
  'admin-hr-audit-history': (auth) => auth.canHr('audit', 'view') && auth.hrScope('audit', 'view') === 'all',
  'admin-hr-access': { superAdmin: true },
  'admin-payments': { business: 'payments.payments' },
  'admin-invoices': { business: 'invoices.documents' },
  'admin-invoice-detail': { business: 'invoices.documents' },
  'admin-org-settings': { business: 'invoices.settings' },
  'admin-customers': { business: 'customers.directory' },
  'admin-audit-logs': { business: 'audit_logs.history' },
};

function routeAccessAllowed(auth, rule, to) {
  if (!rule) return true;
  if (typeof rule === 'function') return Boolean(rule(auth, to));
  if (rule.superAdmin) return auth.isSuperAdmin;
  if (rule.employee && !auth.hasEmployee) return false;
  if (rule.hr && !auth.hasHrAccess) return false;
  if (rule.business && !auth.canBusiness(rule.business, rule.level || 'read')) return false;
  if (rule.hrFeature && !auth.canHr(rule.hrFeature, rule.action || 'view')) return false;
  if (rule.permission && !auth.can(rule.permission)) return false;
  return true;
}

// Ordered landing candidates: the first screen the signed-in admin can reach.
// Used for the post-login redirect and to bounce off a forbidden screen.
const PERMISSION_LANDING = [
  { allowed: (auth) => auth.canBusiness('dashboard.overview'), to: { name: 'admin-dashboard' } },
  { allowed: (auth) => auth.canBusiness(['tech.overview', 'tech.categories', 'tech.brands', 'tech.products']), to: { name: 'admin-tech-overview' } },
  { allowed: (auth) => auth.canBusiness('tech.products'), to: { name: 'admin-tech-products' } },
  { allowed: (auth) => auth.canBusiness('tech.orders'), to: { name: 'admin-tech-orders' } },
  { allowed: (auth) => auth.canBusiness('fashion.products'), to: { name: 'admin-fashion-products' } },
  { allowed: (auth) => auth.canBusiness('fashion.orders'), to: { name: 'admin-fashion-orders' } },
  { allowed: (auth) => auth.canBusiness('coffee.overview'), to: { name: 'admin-coffee-overview' } },
  { allowed: (auth) => auth.canBusiness('coffee.products'), to: { name: 'admin-coffee-products' } },
  { allowed: (auth) => auth.canBusiness('coffee.orders'), to: { name: 'admin-coffee-orders' } },
  { allowed: (auth) => auth.canBusiness('coffee.stock'), to: { name: 'admin-coffee-stock' } },
  { allowed: (auth) => auth.canBusiness('mobility.overview'), to: { name: 'admin-mobility-overview' } },
  { allowed: (auth) => auth.canBusiness('mobility.bookings'), to: { name: 'admin-bookings' } },
  { allowed: (auth) => auth.canBusiness('events.overview'), to: { name: 'admin-events-overview' } },
  { allowed: (auth) => auth.canBusiness('events.requests'), to: { name: 'admin-event-requests' } },
  { allowed: (auth) => auth.canBusiness('healthcare.overview'), to: { name: 'admin-healthcare-overview' } },
  { allowed: (auth) => auth.canBusiness('healthcare.requests'), to: { name: 'admin-healthcare-requests' } },
  { allowed: (auth) => auth.isHrManager, to: { name: 'admin-hr-overview' } },
  { allowed: (auth) => auth.hasEmployee, to: { name: 'admin-hr-portal' } },
  { allowed: (auth) => auth.canBusiness('orders.orders'), to: { name: 'admin-orders' } },
  { allowed: (auth) => auth.canBusiness('payments.payments'), to: { name: 'admin-payments' } },
  { allowed: (auth) => auth.canBusiness('invoices.documents'), to: { name: 'admin-invoices' } },
  { allowed: (auth) => auth.canBusiness('customers.directory'), to: { name: 'admin-customers' } },
  { allowed: (auth) => auth.canBusiness('audit_logs.history'), to: { name: 'admin-audit-logs' } },
];

function firstPermittedRoute(auth) {
  const match = PERMISSION_LANDING.find((entry) => entry.allowed(auth));
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
    const rule = ROUTE_ACCESS[to.name];
    if (rule && !routeAccessAllowed(auth, rule, to)) {
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
