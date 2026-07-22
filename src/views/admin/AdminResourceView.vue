<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import AdminResourceDialog from '@/components/admin/AdminResourceDialog.vue';
import AdminManageDialog from '@/components/admin/AdminManageDialog.vue';
import CardView from '@/components/admin/CardView.vue';
import EventWorkspaceNav from '@/components/admin/EventWorkspaceNav.vue';
import HealthcareWorkspaceNav from '@/components/admin/HealthcareWorkspaceNav.vue';
import DepartmentWorkspaceNav from '@/components/admin/DepartmentWorkspaceNav.vue';
import MobilityWorkspaceNav from '@/components/admin/MobilityWorkspaceNav.vue';
import { api } from '@/api/client';
import { adminResources } from '@/data/adminResources';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatDateTime, formatMGA } from '@/utils/format';
import { localizedValue } from '@/utils/localized';
import { statusSeverity } from '@/utils/status';
import {
  createResource,
  deleteResource,
  getResource,
  isPaginated,
  listResource,
  loadFieldOptions,
  serializeForm,
  updateResource,
} from '@/api/resources';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const auth = useAuthStore();
const { enumLabel, language, localeCode, t, translateConfig } = useAdminI18n();

const resourceKey = computed(() => route.meta.resource || 'products');
const department = computed(() => route.meta.department || '');
// A catalog department section (Tech / Fashion / Coffee) gets the department
// workspace nav and the catalog hero treatment.
const CATALOG_DEPARTMENTS = ['tech', 'fashion', 'coffee'];
const isDepartmentSection = computed(() => CATALOG_DEPARTMENTS.includes(department.value));
const isTechDepartment = computed(() => department.value === 'tech');
// Where each department's storefront lives, for the hero's "view storefront".
const DEPARTMENT_STOREFRONTS = { tech: '/tech', fashion: '/fashion', coffee: '/coffee' };
const departmentStorefront = computed(() => DEPARTMENT_STOREFRONTS[department.value] || null);
// Departments with their own product create/detail screens. The generic
// /admin/products screens back every other department.
const DEPARTMENT_PRODUCT_ROUTES = {
  tech: { create: 'admin-tech-product-new', detail: 'admin-tech-product-detail' },
  coffee: { create: 'admin-coffee-product-new', detail: 'admin-coffee-product-detail' },
};
const productRoutes = computed(() =>
  (resourceKey.value === 'products' && DEPARTMENT_PRODUCT_ROUTES[department.value]) || null,
);
const isMobilityResource = computed(() => ['car-categories', 'cars', 'drivers', 'bookings'].includes(resourceKey.value));
const isEventResource = computed(() => ['event-service-categories', 'event-services', 'artists', 'event-requests'].includes(resourceKey.value));
const isHealthcareResource = computed(() => ['practitioners', 'healthcare-service-categories', 'healthcare-services', 'healthcare-requests'].includes(resourceKey.value));
const baseResource = computed(() => adminResources[resourceKey.value] || adminResources.products);
const resource = computed(() => translateConfig(baseResource.value));
const serverPaginated = computed(() => isPaginated(resource.value));
const preferredView = computed(() => route.meta.defaultView || resource.value.defaultView || 'table');
const pageDescription = computed(() => t(route.meta.description || resource.value.description));
const RESOURCE_BUSINESS_CAPABILITIES = {
  'admin-tech-categories': 'tech.categories', 'admin-tech-brands': 'tech.brands', 'admin-tech-products': 'tech.products',
  'admin-fashion-categories': 'fashion.categories', 'admin-fashion-brands': 'fashion.brands', 'admin-fashion-products': 'fashion.products',
  'admin-coffee-categories': 'coffee.categories', 'admin-coffee-brands': 'coffee.brands', 'admin-coffee-products': 'coffee.products',
  'admin-tech-orders': 'tech.orders', 'admin-fashion-orders': 'fashion.orders', 'admin-coffee-orders': 'coffee.orders',
  'admin-tech-stock': 'tech.stock', 'admin-fashion-stock': 'fashion.stock', 'admin-coffee-stock': 'coffee.stock',
  'admin-car-categories': 'mobility.categories', 'admin-cars': 'mobility.cars',
  'admin-drivers': 'mobility.drivers', 'admin-bookings': 'mobility.bookings',
  'admin-event-service-categories': 'events.categories', 'admin-event-services': 'events.services', 'admin-artists': 'events.artists',
  'admin-event-requests': 'events.requests', 'admin-practitioners': 'healthcare.practitioners',
  'admin-healthcare-categories': 'healthcare.categories', 'admin-healthcare-services': 'healthcare.services',
  'admin-healthcare-requests': 'healthcare.requests', 'admin-orders': 'orders.orders', 'admin-payments': 'payments.payments',
  'admin-customers': 'customers.directory', 'admin-audit-logs': 'audit_logs.history',
};
const businessCapability = computed(() => route.meta.businessCapability || RESOURCE_BUSINESS_CAPABILITIES[route.name]);
const canManageAccess = computed(() => !businessCapability.value || auth.canBusiness(businessCapability.value, 'manage'));
const resourceIcon = computed(() => ({
  categories: 'pi pi-tags',
  brands: 'pi pi-bookmark',
  products: 'pi pi-mobile',
  'car-categories': 'pi pi-sitemap',
  cars: 'pi pi-car',
  drivers: 'pi pi-id-card',
  bookings: 'pi pi-calendar-clock',
  'event-service-categories': 'pi pi-sitemap',
  'event-services': 'pi pi-star',
  artists: 'pi pi-microphone',
  'event-requests': 'pi pi-calendar-plus',
  practitioners: 'pi pi-user-plus',
  'healthcare-service-categories': 'pi pi-sitemap',
  'healthcare-services': 'pi pi-heart-fill',
  'healthcare-requests': 'pi pi-calendar-plus',
})[resourceKey.value] || 'pi pi-box');

// Merge the section's department into create defaults (e.g. new brands land in
// the current department; new items in the right section).
const dialogDefaults = computed(() => ({
  ...(resource.value.defaultRow || {}),
  ...(department.value ? { department: department.value } : {}),
}));

// "Fashion · Catalog" when scoped to a department, else the plain eyebrow.
const heroEyebrow = computed(() => {
  if (!department.value) {
    return resource.value.eyebrow;
  }
  const label = department.value.charAt(0).toUpperCase() + department.value.slice(1);
  return `${t(label)} · ${resource.value.eyebrow}`;
});

const canCreate = computed(
  () => canManageAccess.value && resource.value.capabilities?.create !== false && Boolean(resource.value.actionLabel),
);
const canEdit = computed(() => canManageAccess.value && resource.value.capabilities?.edit !== false);
const canRemove = computed(() => canManageAccess.value && resource.value.capabilities?.remove !== false);
const canDuplicate = computed(() => canCreate.value && Boolean(resource.value.duplicate));
const hasDetailRoute = computed(() => Boolean(resource.value.detailRoute));
const canEditRow = computed(() => canEdit.value && !hasDetailRoute.value);
const hasManage = computed(() => Boolean(resource.value.manage || resource.value.detailRoute));
const hasRowActions = computed(() => canEditRow.value || canRemove.value || canDuplicate.value || hasManage.value);
const hasCardView = computed(() => Boolean(resource.value.cardView));
const hasExpansion = computed(() => Boolean(resource.value.expansion));

function canRemoveRow(row) {
  return canRemove.value && (!resource.value.removeWhen || resource.value.removeWhen(row));
}

const rows = ref([]);
const total = ref(0);
const loading = ref(false);
const first = ref(0);
const limit = ref(20);
const search = ref('');
const viewMode = ref('table');
const filters = reactive({});
const filterOptionsMap = reactive({});

const dialogOpen = ref(false);
const dialogMode = ref('create');
const editing = ref(null);
const duplicating = ref(false);
const saving = ref(false);
const formErrors = ref({});

const manageOpen = ref(false);
const manageId = ref(null);

// Expandable rows (tree): rowKey -> { loading, rows }, children fetched lazily.
const expandedRows = ref({});
const expansionCache = reactive({});

const moneyColumn = computed(() => resource.value.columns.find((column) => column.type === 'money'));
const dialogFields = computed(() =>
  (resource.value.formFields || []).filter((field) => {
    if (field.createOnly && dialogMode.value !== 'create') {
      return false;
    }
    if (field.editOnly && dialogMode.value !== 'edit') {
      return false;
    }
    return true;
  }),
);

const clientFilteredRows = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) {
    return rows.value;
  }
  return rows.value.filter((row) =>
    Object.values(row).some((value) => String(value ?? '').toLowerCase().includes(query)),
  );
});

const tableRows = computed(() => (serverPaginated.value ? rows.value : clientFilteredRows.value));
const cardRows = computed(() => {
  if (serverPaginated.value) {
    return tableRows.value;
  }
  return tableRows.value.slice(first.value, first.value + limit.value);
});
const cardTotal = computed(() => (serverPaginated.value ? total.value : tableRows.value.length));

const hasActiveQuery = computed(() =>
  Boolean(search.value.trim()) || Object.values(filters).some((value) => value !== '' && value !== null && value !== undefined),
);

const metrics = computed(() => {
  if (isTechDepartment.value) {
    const visibleRows = serverPaginated.value ? rows.value : tableRows.value;
    const available = visibleRows.filter((row) => row.is_active).length;
    if (resourceKey.value === 'categories') {
      return [
        { label: t('Total categories'), value: tableRows.value.length, icon: 'pi pi-tags', tone: 'gold', note: t('Catalog structure') },
        { label: t('Available'), value: available, icon: 'pi pi-check-circle', tone: 'emerald', note: t('Ready for customers') },
        { label: t('Product types'), value: new Set(visibleRows.map((row) => row.template_key).filter(Boolean)).size, icon: 'pi pi-sitemap', tone: 'blue', note: t('Specification templates') },
      ];
    }
    if (resourceKey.value === 'brands') {
      return [
        { label: t('Total brands'), value: tableRows.value.length, icon: 'pi pi-bookmark', tone: 'gold', note: t('Tech manufacturers') },
        { label: t('Available'), value: available, icon: 'pi pi-check-circle', tone: 'emerald', note: t('Visible in filters') },
        { label: t('Logos ready'), value: visibleRows.filter((row) => row.logo_url).length, icon: 'pi pi-image', tone: 'blue', note: t('Visual identity added') },
      ];
    }
    const ready = rows.value.filter((row) => row.is_active && row.primary_image_url && Number(row.variant_count || 0) > 0).length;
    const needsSetup = rows.value.filter((row) => !row.primary_image_url || Number(row.variant_count || 0) === 0).length;
    return [
      { label: t('Total products'), value: total.value, icon: 'pi pi-mobile', tone: 'gold', note: t('Matching this search') },
      { label: t('Ready to sell'), value: ready, icon: 'pi pi-check-circle', tone: 'emerald', note: t('On this page') },
      { label: t('Needs setup'), value: needsSetup, icon: 'pi pi-exclamation-circle', tone: needsSetup ? 'coral' : 'blue', note: t('Missing image or variants') },
    ];
  }
  if (isMobilityResource.value) {
    const visibleRows = serverPaginated.value ? rows.value : tableRows.value;
    if (resourceKey.value === 'car-categories') {
      const active = visibleRows.filter((row) => row.is_active).length;
      const cargo = visibleRows.filter((row) => row.is_cargo_transport).length;
      return [
        { label: t('Total categories'), value: tableRows.value.length, icon: 'pi pi-sitemap', tone: 'gold', note: t('Fleet structure') },
        { label: t('Active categories'), value: active, icon: 'pi pi-check-circle', tone: 'emerald', note: t('Visible to customers') },
        { label: t('Cargo categories'), value: cargo, icon: 'pi pi-truck', tone: 'blue', note: t('Distance-based pricing') },
      ];
    }
    if (resourceKey.value === 'cars') {
      const available = visibleRows.filter((row) => row.status === 'available').length;
      const maintenance = visibleRows.filter((row) => row.status === 'maintenance').length;
      return [
        { label: t('Total cars'), value: total.value, icon: 'pi pi-car', tone: 'gold', note: t('Matching this search') },
        { label: t('Available now'), value: available, icon: 'pi pi-check-circle', tone: 'emerald', note: t('On this page') },
        { label: t('In maintenance'), value: maintenance, icon: 'pi pi-wrench', tone: maintenance ? 'coral' : 'blue', note: t('On this page') },
      ];
    }
    if (resourceKey.value === 'drivers') {
      const available = visibleRows.filter((row) => row.status === 'available').length;
      const assigned = visibleRows.filter((row) => row.status === 'assigned').length;
      return [
        { label: t('Total drivers'), value: tableRows.value.length, icon: 'pi pi-id-card', tone: 'gold', note: t('Driver roster') },
        { label: t('Ready to assign'), value: available, icon: 'pi pi-user-plus', tone: 'emerald', note: t('Available now') },
        { label: t('On assignment'), value: assigned, icon: 'pi pi-directions', tone: 'blue', note: t('Currently dispatched') },
      ];
    }
    const needsDriver = visibleRows.filter((row) => ['confirmed', 'active'].includes(row.status) && !row.driver_id).length;
    const unpaid = visibleRows.filter((row) => row.payment_status === 'unpaid' && row.status !== 'cancelled').length;
    return [
      { label: t('Total bookings'), value: total.value, icon: 'pi pi-calendar-clock', tone: 'gold', note: t('Matching these filters') },
      { label: t('Need a driver'), value: needsDriver, icon: 'pi pi-user-plus', tone: needsDriver ? 'coral' : 'emerald', note: t('On this page') },
      { label: t('Awaiting payment'), value: unpaid, icon: 'pi pi-wallet', tone: unpaid ? 'blue' : 'emerald', note: t('On this page') },
    ];
  }
  if (isEventResource.value) {
    const visibleRows = serverPaginated.value ? rows.value : tableRows.value;
    if (resourceKey.value === 'event-service-categories') {
      const active = visibleRows.filter((row) => row.is_active).length;
      const linkedServices = visibleRows.reduce((sum, row) => sum + Number(row.service_count || 0), 0);
      return [
        { label: t('Total categories'), value: tableRows.value.length, icon: 'pi pi-sitemap', tone: 'gold', note: t('Event offer structure') },
        { label: t('Active categories'), value: active, icon: 'pi pi-check-circle', tone: 'emerald', note: t('Visible to customers') },
        { label: t('Linked services'), value: linkedServices, icon: 'pi pi-star', tone: 'blue', note: t('Across all categories') },
      ];
    }
    if (resourceKey.value === 'event-services') {
      const available = visibleRows.filter((row) => row.is_active).length;
      const withImages = visibleRows.filter((row) => row.image_url).length;
      return [
        { label: t('Total services'), value: tableRows.value.length, icon: 'pi pi-star', tone: 'gold', note: t('Event catalog') },
        { label: t('Available'), value: available, icon: 'pi pi-check-circle', tone: 'emerald', note: t('Ready for requests') },
        { label: t('Images ready'), value: withImages, icon: 'pi pi-image', tone: 'blue', note: t('Visual offers') },
      ];
    }
    if (resourceKey.value === 'artists') {
      const active = visibleRows.filter((row) => row.is_active).length;
      const featured = visibleRows.filter((row) => row.is_active && row.is_featured).length;
      return [
        { label: t('Total artists'), value: tableRows.value.length, icon: 'pi pi-microphone', tone: 'gold', note: t('Talent roster') },
        { label: t('Available artists'), value: active, icon: 'pi pi-check-circle', tone: 'emerald', note: t('Visible to customers') },
        { label: t('Featured artists'), value: featured, icon: 'pi pi-star', tone: 'blue', note: t('Highlighted in the client app') },
      ];
    }
    const toReview = visibleRows.filter((row) => ['requested', 'reviewing'].includes(row.status)).length;
    const withoutQuote = visibleRows.filter((row) => !['cancelled', 'completed'].includes(row.status) && !Number(row.quoted_price || 0)).length;
    return [
      { label: t('Total requests'), value: total.value, icon: 'pi pi-calendar-plus', tone: 'gold', note: t('Matching these filters') },
      { label: t('To review'), value: toReview, icon: 'pi pi-inbox', tone: toReview ? 'coral' : 'emerald', note: t('On this page') },
      { label: t('Need a quote'), value: withoutQuote, icon: 'pi pi-tag', tone: withoutQuote ? 'blue' : 'emerald', note: t('On this page') },
    ];
  }
  if (isHealthcareResource.value) {
    const visibleRows = serverPaginated.value ? rows.value : tableRows.value;
    if (resourceKey.value === 'healthcare-service-categories') {
      const active = visibleRows.filter((row) => row.is_active).length;
      const linkedServices = visibleRows.reduce((sum, row) => sum + Number(row.service_count || 0), 0);
      return [
        { label: t('Total care categories'), value: tableRows.value.length, icon: 'pi pi-sitemap', tone: 'gold', note: t('Care structure') },
        { label: t('Active categories'), value: active, icon: 'pi pi-check-circle', tone: 'emerald', note: t('Visible to patients') },
        { label: t('Linked care services'), value: linkedServices, icon: 'pi pi-heart', tone: 'rose', note: t('Across all categories') },
      ];
    }
    if (resourceKey.value === 'healthcare-services') {
      const available = visibleRows.filter((row) => row.is_active).length;
      const packages = visibleRows.filter((row) => row.service_type === 'package').length;
      return [
        { label: t('Total care services'), value: total.value, icon: 'pi pi-heart', tone: 'gold', note: t('Matching this search') },
        { label: t('Available services'), value: available, icon: 'pi pi-check-circle', tone: 'emerald', note: t('On this page') },
        { label: t('Care packages'), value: packages, icon: 'pi pi-users', tone: 'rose', note: t('On this page') },
      ];
    }
    if (resourceKey.value === 'practitioners') {
      const active = visibleRows.filter((row) => row.status === 'active').length;
      const doctors = visibleRows.filter((row) => row.status === 'active' && row.type === 'doctor').length;
      const nurses = visibleRows.filter((row) => row.status === 'active' && row.type === 'nurse').length;
      return [
        { label: t('Total practitioners'), value: total.value, icon: 'pi pi-user-plus', tone: 'gold', note: t('Clinical roster') },
        { label: t('Active doctors'), value: doctors, icon: 'pi pi-user', tone: 'rose', note: t('{n} active overall', { n: active }) },
        { label: t('Active nurses'), value: nurses, icon: 'pi pi-user', tone: 'emerald', note: t('Ready for assignment') },
      ];
    }
    const toReview = visibleRows.filter((row) => ['requested', 'reviewing'].includes(row.status)).length;
    const needStaff = visibleRows.filter((row) => ['confirmed', 'assigned', 'in_progress'].includes(row.status) && Number(row.assignment_count || 0) === 0).length;
    return [
      { label: t('Total care requests'), value: total.value, icon: 'pi pi-calendar-plus', tone: 'gold', note: t('Matching these filters') },
      { label: t('To review'), value: toReview, icon: 'pi pi-inbox', tone: toReview ? 'rose' : 'emerald', note: t('On this page') },
      { label: t('Need practitioners'), value: needStaff, icon: 'pi pi-user-plus', tone: needStaff ? 'blue' : 'emerald', note: t('On this page') },
    ];
  }
  const list = [{ label: t('Records'), value: serverPaginated.value ? total.value : tableRows.value.length }];
  list.push({ label: t('Needs attention'), value: attentionCount(rows.value) });
  if (moneyColumn.value) {
    const sum = rows.value.reduce((acc, row) => acc + Number(row[moneyColumn.value.field] || 0), 0);
    list.push({ label: t('Loaded {field}', { field: moneyColumn.value.header.toLowerCase() }), value: formatMGA(sum) });
  } else {
    list.push({ label: t('Listing'), value: serverPaginated.value ? t('Paginated') : t('Full list') });
  }
  return list;
});

function activeFilters() {
  const out = {};
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      out[key] = value;
    }
  }
  return out;
}

async function fetchData() {
  loading.value = true;
  expandedRows.value = {};
  Object.keys(expansionCache).forEach((key) => delete expansionCache[key]);
  try {
    const page = Math.floor(first.value / limit.value) + 1;
    const { items, meta } = await listResource(resource.value, {
      page,
      limit: limit.value,
      q: serverPaginated.value ? search.value.trim() : '',
      filters: { ...activeFilters(), ...(department.value ? { department: department.value } : {}) },
    });
    rows.value = items;
    total.value = meta.total ?? items.length;
  } catch (err) {
    rows.value = [];
    total.value = 0;
    toast.add({ severity: 'error', summary: t('Could not load records'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    loading.value = false;
  }
}

function resetAndFetch() {
  first.value = 0;
  search.value = '';
  Object.keys(filters).forEach((key) => delete filters[key]);
  (resource.value.filters || []).forEach((filter) => {
    filters[filter.key] = '';
  });
  fetchData();
}

let searchTimer = null;
watch(search, () => {
  if (!serverPaginated.value) {
    first.value = 0;
    return; // client-side filtering handles it
  }
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    first.value = 0;
    fetchData();
  }, 350);
});

watch([resourceKey, department], async () => {
  dialogOpen.value = false;
  viewMode.value = preferredView.value;
  await loadFilterOptions();
  resetAndFetch();
  await openDuplicateFromQuery();
}, { immediate: true });

watch(
  () => route.query.duplicate,
  () => openDuplicateFromQuery(),
);

function onPage(event) {
  first.value = event.first;
  limit.value = event.rows;
  if (serverPaginated.value) {
    fetchData();
  }
}

function onFilterChange() {
  first.value = 0;
  fetchData();
}

function setViewMode(mode) {
  viewMode.value = mode;
}

function filterOptions(filter) {
  if (filterOptionsMap[filter.key]) {
    return filterOptionsMap[filter.key];
  }
  return (filter.options || []).map((option) =>
    typeof option === 'object' ? option : { label: enumLabel(option), value: option },
  );
}

async function loadFilterOptions() {
  Object.keys(filterOptionsMap).forEach((key) => delete filterOptionsMap[key]);
  for (const filter of resource.value.filters || []) {
    if (!filter.optionsEndpoint) {
      continue;
    }
    try {
      filterOptionsMap[filter.key] = await loadFieldOptions(
        filter,
        filter.scopeByDepartment && department.value ? { department: department.value } : {},
      );
    } catch {
      filterOptionsMap[filter.key] = [];
    }
  }
}

function openCreate() {
  if (productRoutes.value) {
    router.push({ name: productRoutes.value.create });
    return;
  }
  if (resource.value.createRoute) {
    const target = resource.value.createRoute();
    if (department.value) {
      target.query = { ...(target.query || {}), department: department.value };
    }
    router.push(target);
    return;
  }
  dialogMode.value = 'create';
  duplicating.value = false;
  editing.value = null;
  formErrors.value = {};
  dialogOpen.value = true;
}

function openEdit(row) {
  dialogMode.value = 'edit';
  duplicating.value = false;
  editing.value = row;
  formErrors.value = {};
  dialogOpen.value = true;
}

function duplicateInitial(row) {
  const config = resource.value.duplicate || {};
  const copy = JSON.parse(JSON.stringify(row || {}));
  delete copy.id;
  delete copy.slug;
  delete copy.created_at;
  delete copy.updated_at;
  for (const field of config.clearFields || []) {
    copy[field] = '';
  }
  const defaults = typeof config.defaults === 'function' ? config.defaults(row) : config.defaults;
  return { ...copy, ...(defaults || {}) };
}

function openDuplicate(row) {
  if (!canDuplicate.value || !row) {
    return;
  }
  dialogMode.value = 'create';
  duplicating.value = true;
  editing.value = duplicateInitial(row);
  formErrors.value = {};
  dialogOpen.value = true;
}

async function openDuplicateFromQuery() {
  const duplicateId = route.query.duplicate;
  if (!duplicateId || !canDuplicate.value) {
    return;
  }
  try {
    const source = await getResource(resource.value, duplicateId);
    if (!source) {
      throw new Error('Car not found');
    }
    openDuplicate(source);
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not duplicate car'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    const query = { ...route.query };
    delete query.duplicate;
    router.replace({ query });
  }
}

function openManage(row) {
  if (productRoutes.value) {
    router.push({ name: productRoutes.value.detail, params: { id: row.id } });
    return;
  }
  if (resource.value.detailRoute) {
    router.push(resource.value.detailRoute(row));
    return;
  }
  manageId.value = row[resource.value.rowKey];
  manageOpen.value = true;
}

async function onRowExpand(event) {
  const id = event.data[resource.value.rowKey];
  if (expansionCache[id]) {
    return; // already fetched
  }
  expansionCache[id] = { loading: true, rows: [] };
  try {
    const detail = await getResource(resource.value, id);
    expansionCache[id] = { loading: false, rows: detail?.[resource.value.expansion.collectionKey] || [] };
  } catch {
    expansionCache[id] = { loading: false, rows: [] };
  }
}

function expansionRows(row) {
  return expansionCache[row[resource.value.rowKey]]?.rows || [];
}

function expansionLoading(row) {
  return Boolean(expansionCache[row[resource.value.rowKey]]?.loading);
}

function confirmRemove(row) {
  if (!canRemoveRow(row)) {
    return;
  }
  confirm.require({
    header: t('Confirm delete'),
    message: t('Delete this {resource}? This cannot be undone.', { resource: resource.value.singular }),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('Delete'),
    rejectLabel: t('Cancel'),
    accept: async () => {
      try {
        await deleteResource(resource.value, row[resource.value.rowKey]);
        toast.add({ severity: 'success', summary: t('Deleted'), life: 2500 });
        fetchData();
      } catch (err) {
        toast.add({ severity: 'error', summary: t('Delete failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
      }
    },
  });
}

async function handleSubmit(values) {
  saving.value = true;
  formErrors.value = {};
  try {
    const mode = dialogMode.value;
    const wasDuplicate = duplicating.value;
    const body = serializeForm(dialogFields.value, values);
    let saved = null;
    if (dialogMode.value === 'edit' && editing.value) {
      saved = await updateResource(resource.value, editing.value[resource.value.rowKey], body);
      toast.add({ severity: 'success', summary: t('Changes saved'), life: 2500 });
    } else {
      saved = await createResource(resource.value, body);
      const hookFailures = await runAfterSaveHooks(saved, values, mode);
      toast.add({
        severity: 'success',
        summary: wasDuplicate
          ? t('{resource} duplicated', { resource: capitalize(resource.value.singular) })
          : t('{resource} created', { resource: capitalize(resource.value.singular) }),
        life: 2500,
      });
      showAfterSaveWarnings(hookFailures);
    }
    dialogOpen.value = false;
    duplicating.value = false;
    editing.value = null;
    fetchData();
  } catch (err) {
    if (err?.details) {
      formErrors.value = err.details;
    }
    toast.add({ severity: 'error', summary: t('Save failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    saving.value = false;
  }
}

function callHook(method, path, body) {
  switch ((method || 'post').toLowerCase()) {
    case 'patch':
      return api.patch(path, body);
    case 'put':
      return api.put(path, body);
    case 'delete':
      return api.del(path);
    default:
      return api.post(path, body);
  }
}

async function runAfterSaveHooks(saved, values, mode) {
  const failures = [];
  for (const hook of resource.value.afterSave || []) {
    if (hook.modes && !hook.modes.includes(mode)) {
      continue;
    }
    const value = values[hook.field];
    if (!saved || value === null || value === undefined || value === '') {
      continue;
    }
    try {
      await callHook(
        hook.method,
        hook.path(saved, values),
        hook.body ? hook.body(value, values, saved) : { [hook.field]: value },
      );
    } catch (err) {
      failures.push({ hook, err });
    }
  }
  return failures;
}

function showAfterSaveWarnings(failures) {
  for (const { hook, err } of failures) {
    toast.add({
      severity: 'warn',
      summary: hook.errorSummary || t('Follow-up save failed'),
      detail: t(err?.message || 'The main record was saved, but a related update failed.'),
      life: 5000,
    });
  }
}

function attentionCount(list) {
  return list.filter((row) => {
    const values = [row.status, row.payment_status].map((value) => String(value || '').toLowerCase());
    return values.some((value) => ['unpaid', 'pending', 'requested'].includes(value));
  }).length;
}

function prettify(value) {
  return enumLabel(value);
}

function capitalize(value) {
  return String(value).replace(/^\w/, (c) => c.toUpperCase());
}

function isLocalizedField(fieldName) {
  return Boolean((resource.value.formFields || []).find((field) => field.key === fieldName && field.localized));
}

function displayValue(row, column) {
  if (typeof column.format === 'function') {
    return column.format(row);
  }
  const value = column.localized || isLocalizedField(column.field)
    ? localizedValue(row, column.field, language.value)
    : row[column.field];
  if (column.type === 'money') {
    return formatMGA(Number(value || 0));
  }
  if (column.type === 'date') {
    return formatDate(value, localeCode.value);
  }
  if (column.type === 'datetime') {
    return formatDateTime(value, localeCode.value);
  }
  if (column.type === 'boolean') {
    return value ? column.trueLabel || t('Active') : column.falseLabel || t('Inactive');
  }
  if (column.type === 'status') {
    return prettify(value);
  }
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return value;
}
</script>

<template>
  <section class="admin-resource">
    <DepartmentWorkspaceNav v-if="isDepartmentSection" :department="department" />
    <MobilityWorkspaceNav v-if="isMobilityResource" />
    <EventWorkspaceNav v-if="isEventResource" />
    <HealthcareWorkspaceNav v-if="isHealthcareResource" />

    <div class="resource-hero" :class="{ 'is-catalog': isDepartmentSection, 'is-mobility': isMobilityResource, 'is-events': isEventResource, 'is-healthcare': isHealthcareResource }">
      <div class="resource-hero__copy">
        <span v-if="isDepartmentSection || isMobilityResource || isEventResource || isHealthcareResource" class="resource-hero__icon"><i :class="resourceIcon" /></span>
        <div>
          <p>{{ heroEyebrow }}</p>
          <h2>{{ resource.plural }}</h2>
          <span>{{ pageDescription }}</span>
        </div>
      </div>
      <div class="resource-hero__actions">
        <Button v-if="departmentStorefront" as="router-link" :to="departmentStorefront" :label="t('View storefront')" icon="pi pi-external-link" severity="secondary" outlined />
        <Button v-if="isMobilityResource" as="router-link" to="/cars" :label="t('View car rentals')" icon="pi pi-external-link" severity="secondary" outlined />
        <Button v-if="isEventResource" as="router-link" to="/events" :label="t('View events page')" icon="pi pi-external-link" severity="secondary" outlined />
        <Button v-if="isHealthcareResource" as="router-link" to="/healthcare" :label="t('View healthcare page')" icon="pi pi-external-link" severity="secondary" outlined />
        <Button v-if="canCreate" :label="resource.actionLabel" icon="pi pi-plus" @click="openCreate" />
      </div>
    </div>

    <div class="resource-metrics">
      <article v-for="metric in metrics" :key="metric.label" :class="metric.tone ? `is-${metric.tone}` : ''">
        <span v-if="metric.icon" class="resource-metrics__icon"><i :class="metric.icon" /></span>
        <div>
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small v-if="metric.note">{{ metric.note }}</small>
        </div>
      </article>
    </div>

    <section class="resource-table" :aria-label="resource.plural">
      <div class="resource-table__toolbar">
        <div class="resource-table__filters">
          <IconField>
            <InputIcon class="pi pi-search" />
            <InputText v-model="search" :placeholder="t('Search {resource}', { resource: resource.plural.toLowerCase() })" />
          </IconField>
          <Select
            v-for="filter in resource.filters || []"
            :key="filter.key"
            v-model="filters[filter.key]"
            :options="filterOptions(filter)"
            optionLabel="label"
            optionValue="value"
            :placeholder="filter.label"
            showClear
            class="resource-filter"
            @change="onFilterChange"
          />
        </div>
        <div class="resource-table__tools">
          <Button
            v-if="hasActiveQuery"
            icon="pi pi-filter-slash"
            :label="t('Reset')"
            severity="secondary"
            text
            @click="resetAndFetch"
          />
          <div v-if="hasCardView" class="resource-view-toggle" :aria-label="t('View style')">
            <Button
              icon="pi pi-table"
              :severity="viewMode === 'table' ? 'primary' : 'secondary'"
              :outlined="viewMode !== 'table'"
              :aria-label="t('Table view')"
              :title="t('Table view')"
              @click="setViewMode('table')"
            />
            <Button
              icon="pi pi-th-large"
              :severity="viewMode === 'card' ? 'primary' : 'secondary'"
              :outlined="viewMode !== 'card'"
              :aria-label="t('Card view')"
              :title="t('Card view')"
              @click="setViewMode('card')"
            />
          </div>
          <Button icon="pi pi-refresh" :label="t('Refresh')" severity="secondary" outlined @click="fetchData" />
        </div>
      </div>

      <DataTable
        v-if="viewMode === 'table'"
        :value="tableRows"
        :dataKey="resource.rowKey"
        :loading="loading"
        :lazy="serverPaginated"
        paginator
        v-model:first="first"
        v-model:rows="limit"
        v-model:expandedRows="expandedRows"
        :rowsPerPageOptions="[10, 20, 50]"
        :totalRecords="serverPaginated ? total : tableRows.length"
        stripedRows
        responsiveLayout="scroll"
        tableStyle="min-width: 860px"
        @page="onPage"
        @row-expand="onRowExpand"
      >
        <Column v-if="hasExpansion" expander style="width: 3.5rem" :exportable="false" />

        <Column v-for="column in resource.columns" :key="column.field" :field="column.field" :header="column.header">
          <template #body="{ data }">
            <Tag
              v-if="column.type === 'status' || column.type === 'boolean'"
              :value="displayValue(data, column)"
              :severity="statusSeverity(data[column.field])"
            />
            <span v-else :class="{ 'cell-money': column.type === 'money' }">
              {{ displayValue(data, column) }}
            </span>
          </template>
        </Column>

        <Column v-if="hasRowActions" :header="t('Actions')" :exportable="false" style="width: 11rem">
          <template #body="{ data }">
            <div class="row-actions">
              <Button
                v-if="hasManage"
                icon="pi pi-window-maximize"
                severity="secondary"
                text
                rounded
                :aria-label="t('Manage')"
                :title="t('Manage / detail')"
                @click="openManage(data)"
              />
              <Button
                v-if="canEditRow"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                :aria-label="t('Edit')"
                :title="t('Edit')"
                @click="openEdit(data)"
              />
              <Button
                v-if="canDuplicate"
                icon="pi pi-copy"
                severity="secondary"
                text
                rounded
                :aria-label="t(resource.duplicate?.actionLabel || 'Duplicate')"
                :title="t(resource.duplicate?.actionLabel || 'Duplicate')"
                @click="openDuplicate(data)"
              />
              <Button
                v-if="canRemove"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                :aria-label="t('Delete')"
                :title="canRemoveRow(data) ? t('Delete') : t(resource.removeDisabledHelp || 'This record cannot be deleted.')"
                :disabled="!canRemoveRow(data)"
                @click="confirmRemove(data)"
              />
            </div>
          </template>
        </Column>

        <template v-if="hasExpansion" #expansion="{ data }">
          <div class="row-expansion">
            <div v-if="expansionLoading(data)" class="row-expansion__state">{{ t('Loading…') }}</div>
            <table v-else-if="expansionRows(data).length" class="subtable">
              <thead>
                <tr>
                  <th v-for="col in resource.expansion.columns" :key="col.field">{{ col.header }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="child in expansionRows(data)" :key="child.id">
                  <td v-for="col in resource.expansion.columns" :key="col.field">
                    <Tag
                      v-if="col.type === 'status' || col.type === 'boolean'"
                      :value="displayValue(child, col)"
                      :severity="statusSeverity(child[col.field])"
                    />
                    <span v-else :class="{ 'cell-money': col.type === 'money' }">{{ displayValue(child, col) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <div v-else class="row-expansion__state">{{ t(resource.expansion.emptyLabel || 'None yet.') }}</div>
          </div>
        </template>

        <template #empty>
          <div class="resource-empty">
            <i class="pi pi-inbox" />
            <span>{{ loading ? t('Loading…') : t('No records found.') }}</span>
          </div>
        </template>
      </DataTable>

      <CardView
        v-else
        :rows="cardRows"
        :resource="resource"
        :rowKey="resource.rowKey"
        :loading="loading"
        :totalRecords="cardTotal"
        :first="first"
        :rowsPerPage="limit"
        :hasManage="hasManage"
        :canDuplicate="canDuplicate"
        :canEdit="canEditRow"
        :canRemove="canRemove"
        @page="onPage"
        @manage="openManage"
        @duplicate="openDuplicate"
        @edit="openEdit"
        @remove="confirmRemove"
      />
    </section>

    <AdminResourceDialog
      v-model:visible="dialogOpen"
      :title="dialogMode === 'edit' ? t('Edit {resource}', { resource: resource.singular }) : duplicating ? resource.duplicate?.title || t('Duplicate {resource}', { resource: resource.singular }) : resource.actionLabel || t('Create')"
      :notice="duplicating ? resource.duplicate?.help || '' : ''"
      :submitLabel="duplicating ? t('Create duplicate') : t('Save')"
      :fields="dialogFields"
      :initial="editing"
      :defaults="dialogDefaults"
      :department="department"
      :loading="saving"
      :errors="formErrors"
      @submit="handleSubmit"
    />

    <AdminManageDialog
      v-if="hasManage"
      v-model:visible="manageOpen"
      :resource="resource"
      :itemId="manageId"
      :readOnly="!canManageAccess"
      @changed="fetchData"
    />
  </section>
</template>

<style scoped>
.admin-resource {
  display: grid;
  gap: 18px;
}

.resource-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.resource-hero.is-catalog,
.resource-hero.is-mobility,
.resource-hero.is-events,
.resource-hero.is-healthcare {
  padding: 22px;
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background:
    radial-gradient(circle at 100% 0%, rgba(12, 155, 128, 0.12), transparent 42%),
    var(--tm-surface);
  box-shadow: 0 12px 34px rgba(37, 31, 20, 0.055);
}

.resource-hero.is-healthcare .resource-hero__icon {
  color: #ef9db8;
}

.resource-hero.is-healthcare .resource-hero__icon {
  color: #ef9db8;
}

.resource-hero.is-mobility {
  background:
    radial-gradient(circle at 100% 0%, rgba(49, 92, 112, 0.14), transparent 42%),
    var(--tm-surface);
}

.resource-hero.is-events {
  background:
    radial-gradient(circle at 100% 0%, rgba(206, 107, 85, 0.13), transparent 42%),
    var(--tm-surface);
}

.resource-hero.is-healthcare {
  background:
    radial-gradient(circle at 100% 0%, rgba(192, 90, 125, 0.14), transparent 42%),
    var(--tm-surface);
}

.resource-hero__copy,
.resource-hero__actions {
  display: flex;
  align-items: center;
  gap: 14px;
}

.resource-hero__actions {
  justify-content: flex-end;
  flex-wrap: wrap;
}

.resource-hero__icon {
  display: grid;
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
  border-radius: 16px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  font-size: 1.15rem;
  place-items: center;
}

.resource-hero p,
.resource-hero h2 {
  margin: 0;
}

.resource-hero p {
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.resource-hero h2 {
  margin-top: 5px;
  color: var(--tm-heading);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
}

.resource-hero span {
  display: block;
  max-width: 740px;
  margin-top: 10px;
  color: var(--tm-muted);
  line-height: 1.55;
}

.resource-metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.resource-metrics article {
  --metric-accent: var(--tm-gold);
  --metric-wash: rgba(201, 146, 44, 0.1);
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: 92px;
  padding: 16px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background:
    radial-gradient(circle at 100% 0%, var(--metric-wash), transparent 48%),
    var(--tm-surface);
  box-shadow: 0 10px 28px rgba(37, 31, 20, 0.05);
}

.resource-metrics article.is-emerald { --metric-accent: var(--tm-emerald); --metric-wash: rgba(12, 155, 128, 0.1); }
.resource-metrics article.is-blue { --metric-accent: var(--tm-blue); --metric-wash: rgba(49, 92, 112, 0.1); }
.resource-metrics article.is-coral { --metric-accent: var(--tm-coral); --metric-wash: rgba(206, 107, 85, 0.1); }
.resource-metrics article.is-rose { --metric-accent: #c05a7d; --metric-wash: rgba(192, 90, 125, 0.11); }

.resource-metrics article > div {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.resource-metrics__icon {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  border-radius: 13px;
  background: var(--metric-accent);
  color: #fff;
  place-items: center;
}

.resource-metrics span {
  color: var(--tm-muted);
  font-size: 0.8rem;
  font-weight: 820;
}

.resource-metrics strong {
  color: var(--tm-heading);
  font-size: clamp(1.35rem, 2vw, 1.8rem);
  line-height: 1.05;
}

.resource-metrics small {
  color: var(--tm-muted);
  font-size: 0.72rem;
  font-weight: 720;
}

.resource-table {
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 18px;
  background: var(--tm-surface);
  box-shadow: 0 12px 34px rgba(37, 31, 20, 0.055);
}

.resource-table__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--tm-border);
  background: color-mix(in srgb, var(--tm-surface-soft) 74%, transparent);
}

.resource-table__tools,
.resource-view-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.resource-table__filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.resource-table__filters :deep(.p-iconfield) {
  width: min(100%, 320px);
}

.resource-table__filters :deep(.p-inputtext) {
  width: 100%;
}

.resource-filter {
  min-width: 160px;
}

.resource-table :deep(.p-datatable-header) {
  border: 0;
}

.resource-table :deep(.p-datatable-thead > tr > th) {
  border-color: var(--tm-border);
  background: var(--tm-surface-soft);
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.resource-table :deep(.p-datatable-tbody > tr > td) {
  border-color: var(--tm-border);
  color: var(--tm-text);
  vertical-align: middle;
}

.resource-table :deep(.p-paginator) {
  border-color: var(--tm-border);
  background: var(--tm-surface);
}

.cell-money {
  color: var(--tm-heading);
  font-weight: 900;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 2px;
}

.row-expansion {
  padding: 6px 10px 10px 3.5rem;
}

.row-expansion__state {
  padding: 12px 4px;
  color: var(--tm-muted);
  font-weight: 700;
}

.subtable {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--tm-surface-soft);
}

.subtable th {
  padding: 9px 12px;
  color: var(--tm-muted);
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.04em;
  text-align: left;
  text-transform: uppercase;
  border-bottom: 1px solid var(--tm-border);
}

.subtable td {
  padding: 10px 12px;
  color: var(--tm-text);
  font-size: 0.9rem;
  border-bottom: 1px solid var(--tm-border);
}

.subtable tbody tr:last-child td {
  border-bottom: 0;
}

.resource-empty {
  display: grid;
  gap: 8px;
  place-items: center;
  padding: 36px;
  color: var(--tm-muted);
  font-weight: 800;
}

.resource-empty i {
  color: var(--tm-gold);
  font-size: 1.5rem;
}

@media (max-width: 760px) {
  .resource-hero,
  .resource-table__toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .resource-metrics {
    grid-template-columns: 1fr;
  }

  .resource-hero .p-button,
  .resource-table__toolbar .p-button {
    width: 100%;
  }

  .resource-hero__copy {
    align-items: flex-start;
  }

  .resource-hero__actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }

  .resource-table__tools,
  .resource-view-toggle {
    width: 100%;
  }

  .resource-view-toggle .p-button {
    flex: 1;
  }
}
</style>
