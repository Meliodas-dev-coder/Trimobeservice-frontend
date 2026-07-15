import { formatMGA } from '@/utils/format';

// Admin resource contracts — the single source of truth the generic admin
// screens are driven by. Field names, enums, and endpoints here MUST match the
// Go backend DTOs (see Trimobeservice-backend/README.md).
//
// Shape of a resource:
//   api          endpoints + response-envelope keys
//                  list          GET  (returns { [collectionKey]: [], meta })
//                  create        POST (null when admins can't create)
//                  itemBase      base for GET/PUT/DELETE `${itemBase}/${id}`
//                  collectionKey key holding the array in a list response
//                  itemKey       key holding the object in a single response
//   capabilities create/edit/remove — what the generic table exposes
//   filters      server-side filter dropdowns (Step 3/4)
//   actions      domain workflows beyond CRUD (Step 4)
//   columns      table columns; field = API response field
//   formFields   create/edit inputs; key = API request field
//                  createOnly -> only shown while creating
//                  persist: false -> uploaded/collected in the dialog, but not
//                                    included in the main resource JSON body
//                  money  → serialized to a DECIMAL string on submit (Step 3)
//                  select → static `options` OR a relation via `optionsEndpoint`
//   rows         PLACEHOLDER sample data; replaced by live fetch in Step 3
//
// Money is DECIMAL(12,2) strings on the wire ("3850000.00"); the UI displays it
// as integer MGA.

const IS_ACTIVE_OPTIONS = [
  { label: 'Active', value: true },
  { label: 'Inactive', value: false },
];

// Departments split the product catalog for separate management (see the Go
// template registry). Keep in sync with catalog.Departments() on the backend.
const DEPARTMENT_OPTIONS = [
  { label: 'Tech', value: 'tech' },
  { label: 'Fashion', value: 'fashion' },
  { label: 'Coffee', value: 'coffee' },
];

// Commerce catalog (categories, brands, products, variants) presents its is_active
// flag as availability wording. Mobility keeps IS_ACTIVE_OPTIONS.
const AVAILABILITY_OPTIONS = [
  { label: 'Available', value: true },
  { label: 'Unavailable', value: false },
];

const AVAILABILITY_COLUMN = {
  field: 'is_active',
  header: 'Availability',
  type: 'boolean',
  trueLabel: 'Available',
  falseLabel: 'Unavailable',
};

// Price range across a product's active variants: "1 200 000 – 1 500 000 MGA",
// a single price, or an em dash when it has no priced variants yet.
function productPriceLabel(row) {
  const min = row.price_min != null ? Number(row.price_min) : null;
  const max = row.price_max != null ? Number(row.price_max) : null;
  if (min == null) {
    return '—';
  }
  if (max != null && max !== min) {
    return `${formatMGA(min)} – ${formatMGA(max)}`;
  }
  return formatMGA(min);
}

// "phone" -> "Phone", "storage_type" -> "Storage type".
function titleize(value) {
  return value ? String(value).replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()) : '—';
}

// --- audit log display helpers ---
// Who performed the action (falls back to the raw id if the account was removed).
function auditActor(row) {
  return row.actor_name || (row.actor_user_id != null ? `User #${row.actor_user_id}` : 'Unknown');
}

// HTTP verb + any trailing sub-action → a plain-language action, e.g.
// PATCH /admin/orders/5/status → "Update · status"; POST /admin/products → "Create".
function auditAction(row) {
  const verb = { POST: 'Create', PUT: 'Update', PATCH: 'Update', DELETE: 'Delete' }[row.method] || row.method;
  const parts = String(row.path || '').split('/').filter(Boolean);
  const last = parts[parts.length - 1];
  const sub = last && !/^\d+$/.test(last) && last !== 'admin' && last !== row.target_type ? last : '';
  return sub ? `${verb} · ${sub.replace(/-/g, ' ')}` : verb;
}

// What was touched: "Orders #5", "Products".
function auditTarget(row) {
  if (!row.target_type) {
    return '—';
  }
  return `${titleize(row.target_type)}${row.target_id != null ? ` #${row.target_id}` : ''}`;
}

// Compact preview of the request body (what changed).
function auditChanges(row) {
  if (!row.payload || typeof row.payload !== 'object') {
    return '—';
  }
  const text = JSON.stringify(row.payload);
  return text.length > 70 ? `${text.slice(0, 67)}…` : text;
}

// Mirrors the client event planner's indicative-total calculation. Request
// snapshots keep this comparison stable even when catalog prices change later.
function eventIndicativeTotal(eventRequest) {
  const services = Array.isArray(eventRequest?.services) ? eventRequest.services : [];
  const artists = Array.isArray(eventRequest?.artists) ? eventRequest.artists : [];

  return (
    services.reduce((sum, service) => sum + Number(service.from_price_snapshot || 0), 0) +
    artists.reduce((sum, artist) => sum + Number(artist.fee_snapshot || 0), 0)
  );
}

function orderPlacedAt(order) {
  return order?.placed_at || order?.created_at;
}

function orderDeliveryAddress(order) {
  return [
    order?.ship_line1,
    order?.ship_line2,
    order?.ship_city,
    order?.ship_region,
    order?.ship_postal_code,
    order?.ship_country,
  ]
    .filter(Boolean)
    .join(', ');
}

// The dynamic-attributes control: the dialog renders the selected category's
// template fields (product specs or variant axes) into an `attributes` object.
const PRODUCT_ATTRIBUTES_FIELD = {
  key: 'attributes',
  type: 'attributes',
  scope: 'product_fields',
  categoryField: 'category_id', // template comes from the chosen category
  fullWidth: true,
};

const VARIANT_ATTRIBUTES_FIELD = {
  key: 'attributes',
  type: 'attributes',
  scope: 'variant_axes', // template comes from the managed product's category
  fullWidth: true,
};

const isCargoCategory = (draft) => Boolean(draft.is_cargo_transport);
const isStandardCategory = (draft) => !draft.is_cargo_transport;
const isStandardCar = (_draft, ctx) => !ctx.optionFor('category_id')?.item?.is_cargo_transport;
const isCargoBooking = (_draft, ctx) => Boolean(ctx.optionFor('car_id')?.item?.is_cargo_transport);
const isStandardBooking = (_draft, ctx) => !ctx.optionFor('car_id')?.item?.is_cargo_transport;
const isOrderTarget = (target) => target?.type === 'order';
const isBookingTarget = (target) => target?.type === 'booking';
const isEventTarget = (target) => target?.type === 'event';
const isHealthcareTarget = (target) => target?.type === 'healthcare';

// Healthcare service form: consultations are quote-priced; packages carry a
// fixed price plus a doctor/nurse makeup.
const isHealthcarePackage = (draft) => draft.service_type === 'package';
const isHealthcareConsultation = (draft) => draft.service_type !== 'package';

// Package staff makeup is entered as two counts (persist:false) and folded into
// the `staff` array the backend expects. Consultations send an empty array,
// which the backend ignores.
function packageStaffBody(_value, values) {
  const staff = [];
  if (values.service_type === 'package') {
    const doctors = Number(values.staff_doctors) || 0;
    const nurses = Number(values.staff_nurses) || 0;
    if (doctors > 0) {
      staff.push({ practitioner_type: 'doctor', quantity: doctors });
    }
    if (nurses > 0) {
      staff.push({ practitioner_type: 'nurse', quantity: nurses });
    }
  }
  return { staff };
}

// A healthcare service's price cell: package = fixed price, consultation = "from".
function healthcarePriceLabel(row) {
  if (row.service_type === 'package') {
    return row.price != null && row.price !== '' ? formatMGA(Number(row.price)) : '—';
  }
  return row.from_price != null && row.from_price !== '' ? formatMGA(Number(row.from_price)) : '—';
}

// A package's staff makeup as a compact cell: "1D · 2N".
function healthcareStaffLabel(row) {
  if (row.service_type !== 'package') {
    return '—';
  }
  const parts = [];
  if (row.staff_doctors) {
    parts.push(`${row.staff_doctors}D`);
  }
  if (row.staff_nurses) {
    parts.push(`${row.staff_nurses}N`);
  }
  return parts.length ? parts.join(' · ') : '—';
}

function todayStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function cargoServiceWindow(value) {
  const selected = value instanceof Date ? value : new Date(value);
  const start = new Date(selected);
  start.setHours(0, 0, 0, 0);

  const end = new Date(selected);
  end.setHours(23, 59, 59, 999);

  return {
    start_at: start.toISOString(),
    end_at: end.toISOString(),
  };
}

export const adminResources = {
  categories: {
    id: 'categories',
    singular: 'category',
    plural: 'Categories',
    eyebrow: 'Catalog',
    description: 'Phone & accessory categories. Slugs are generated by the API.',
    actionLabel: 'Add category',
    rowKey: 'id',
    api: {
      list: '/admin/categories',
      create: '/admin/categories',
      itemBase: '/admin/categories',
      collectionKey: 'categories',
      itemKey: 'category',
    },
    capabilities: { create: true, edit: true, remove: true },
    defaultRow: { is_active: true },
    columns: [
      { field: 'name', header: 'Category' },
      { field: 'slug', header: 'Slug' },
      { field: 'template_key', header: 'Type', format: (row) => titleize(row.template_key) },
      { ...AVAILABILITY_COLUMN },
    ],
    cardView: {
      layout: 'grid',
      imageField: 'image_url',
      imageFit: 'cover',
      placeholderIcon: 'pi pi-tags',
      titleField: 'name',
      subtitleField: 'slug',
      badgeField: 'is_active',
      badgeType: 'boolean',
      badgeTrueLabel: 'Available',
      badgeFalseLabel: 'Unavailable',
      details: [
        { field: 'template_key', label: 'Product type', format: (row) => titleize(row.template_key) },
        { field: 'created_at', label: 'Added', type: 'date' },
      ],
    },
    formFields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'Smartphones', required: true, localized: true, sectionLabel: 'Category identity', sectionDescription: 'Name the group and choose how its products are structured.', sectionIcon: 'pi pi-tags' },
      {
        key: 'template_key',
        label: 'Product type',
        type: 'select',
        options: [],
        optionsEndpoint: '/admin/product-templates',
        collectionKey: 'templates',
        optionLabel: 'label',
        optionValue: 'key',
        defaultValue: 'generic',
        scopeByDepartment: true, // in a Tech/Fashion section, only that department's types
        help: 'Drives which spec fields products in this category get.',
      },
      {
        key: 'parent_id',
        label: 'Parent category',
        type: 'select',
        options: [],
        optionsEndpoint: '/admin/categories',
        collectionKey: 'categories',
        optionLabel: 'name',
        optionValue: 'id',
        placeholder: 'None',
        scopeByDepartment: true,
      },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Optional summary', localized: true, sectionLabel: 'Customer-facing content', sectionDescription: 'Explain the category and add a recognizable catalog image.', sectionIcon: 'pi pi-align-left' },
      { key: 'image_url', label: 'Image', type: 'image' },
      { key: 'is_active', label: 'Availability', type: 'select', options: AVAILABILITY_OPTIONS, defaultValue: true, sectionLabel: 'Publishing', sectionDescription: 'Choose whether customers can browse this category.', sectionIcon: 'pi pi-eye' },
    ],
  },

  brands: {
    id: 'brands',
    singular: 'brand',
    plural: 'Brands',
    eyebrow: 'Catalog',
    description: 'Manufacturers/brands used to tag products.',
    actionLabel: 'Add brand',
    rowKey: 'id',
    api: {
      list: '/admin/brands',
      create: '/admin/brands',
      itemBase: '/admin/brands',
      collectionKey: 'brands',
      itemKey: 'brand',
    },
    capabilities: { create: true, edit: true, remove: true },
    defaultRow: { is_active: true, department: 'tech' },
    columns: [
      { field: 'name', header: 'Brand' },
      { field: 'slug', header: 'Slug' },
      { field: 'department', header: 'Department', format: (row) => titleize(row.department) },
      { ...AVAILABILITY_COLUMN },
    ],
    cardView: {
      layout: 'grid',
      imageField: 'logo_url',
      imageFit: 'contain',
      placeholderIcon: 'pi pi-bookmark',
      titleField: 'name',
      subtitleField: 'slug',
      badgeField: 'is_active',
      badgeType: 'boolean',
      badgeTrueLabel: 'Available',
      badgeFalseLabel: 'Unavailable',
      details: [
        { field: 'department', label: 'Department', type: 'enum' },
        { field: 'created_at', label: 'Added', type: 'date' },
      ],
    },
    formFields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'Astra', required: true, localized: true, sectionLabel: 'Brand identity', sectionDescription: 'Set the manufacturer name and its catalog department.', sectionIcon: 'pi pi-bookmark' },
      { key: 'department', label: 'Department', type: 'select', options: DEPARTMENT_OPTIONS, hideWhenScoped: true },
      { key: 'logo_url', label: 'Logo', type: 'image', sectionLabel: 'Brand mark', sectionDescription: 'Upload a clean logo that remains readable on light and dark surfaces.', sectionIcon: 'pi pi-image' },
      { key: 'is_active', label: 'Availability', type: 'select', options: AVAILABILITY_OPTIONS, defaultValue: true, sectionLabel: 'Publishing', sectionDescription: 'Choose whether this brand appears in customer filters.', sectionIcon: 'pi pi-eye' },
    ],
  },

  products: {
    id: 'products',
    singular: 'product',
    plural: 'Products',
    eyebrow: 'Catalog',
    description: 'Products carry a category and brand. Variants (SKUs) and images are managed per product.',
    actionLabel: 'Add product',
    rowKey: 'id',
    api: {
      list: '/admin/products',
      create: '/admin/products',
      itemBase: '/admin/products',
      collectionKey: 'products',
      itemKey: 'product',
    },
    // Products are created/edited on a full screen, not a modal.
    detailRoute: (row) => ({ name: 'admin-product-detail', params: { id: row.id } }),
    createRoute: () => ({ name: 'admin-product-new' }),
    capabilities: { create: true, edit: true, remove: true },
    filters: [
      {
        key: 'category_id',
        label: 'Category',
        options: [],
        optionsEndpoint: '/admin/categories',
        collectionKey: 'categories',
        optionLabel: 'name',
        optionValue: 'id',
        scopeByDepartment: true,
      },
      {
        key: 'brand_id',
        label: 'Brand',
        options: [],
        optionsEndpoint: '/admin/brands',
        collectionKey: 'brands',
        optionLabel: 'name',
        optionValue: 'id',
        scopeByDepartment: true,
      },
    ],
    // Variants + images live under /admin/products/{id}/... — surfaced in Step 4.
    defaultRow: { is_active: true },
    columns: [
      { field: 'name', header: 'Product' },
      { field: 'slug', header: 'Slug' },
      { field: 'variant_count', header: 'Variants', type: 'number' },
      { field: 'price_range', header: 'Price', format: productPriceLabel },
      { ...AVAILABILITY_COLUMN },
      { field: 'created_at', header: 'Created', type: 'date' },
    ],
    // Card view (like cars): product image, availability badge, price + variants.
    cardView: {
      layout: 'grid',
      imageField: 'primary_image_url',
      imageFit: 'contain',
      placeholderIcon: 'pi pi-mobile',
      titleField: 'name',
      subtitleField: 'slug',
      badgeField: 'is_active',
      badgeType: 'boolean',
      badgeTrueLabel: 'Available',
      badgeFalseLabel: 'Unavailable',
      details: [
        { field: 'price_range', label: 'Price', format: productPriceLabel },
        { field: 'variant_count', label: 'Variants', type: 'number' },
        { field: 'created_at', label: 'Added', type: 'date' },
      ],
    },
    // Expandable rows in the table: open a product to see its variants (SKUs),
    // fetched lazily from the product detail endpoint.
    expansion: {
      collectionKey: 'variants',
      emptyLabel: 'No variants yet.',
      columns: [
        { field: 'sku', header: 'SKU' },
        { field: 'label', header: 'Label' },
        { field: 'price', header: 'Price', type: 'money' },
        { field: 'stock_quantity', header: 'Stock', type: 'number' },
        { ...AVAILABILITY_COLUMN },
      ],
    },
    formFields: [
      { key: 'name', label: 'Product name', type: 'text', placeholder: 'Astra X10 Pro', required: true, localized: true },
      {
        key: 'category_id',
        label: 'Category',
        type: 'select',
        options: [],
        optionsEndpoint: '/admin/categories',
        collectionKey: 'categories',
        optionLabel: 'name',
        optionValue: 'id',
        required: true,
        scopeByDepartment: true,
      },
      {
        key: 'brand_id',
        label: 'Brand',
        type: 'select',
        options: [],
        optionsEndpoint: '/admin/brands',
        collectionKey: 'brands',
        optionLabel: 'name',
        optionValue: 'id',
        placeholder: 'None',
        scopeByDepartment: true,
      },
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Catalog summary', localized: true },
      { key: 'is_active', label: 'Availability', type: 'select', options: AVAILABILITY_OPTIONS, defaultValue: true },
      { ...PRODUCT_ATTRIBUTES_FIELD },
    ],
  },

  cars: {
    id: 'cars',
    singular: 'car',
    plural: 'Cars',
    eyebrow: 'Mobility',
    description: 'Manage daily-priced cars and distance-priced cargo transport from one fleet.',
    actionLabel: 'Add car',
    rowKey: 'id',
    api: {
      list: '/admin/cars',
      create: '/admin/cars',
      itemBase: '/admin/cars',
      collectionKey: 'cars',
      itemKey: 'car',
    },
    detailRoute: (row) => ({ name: 'admin-car-detail', params: { id: row.id } }),
    capabilities: { create: true, edit: true, remove: true },
    duplicate: {
      actionLabel: 'Duplicate',
      title: 'Duplicate car',
      help: 'Vehicle details, pricing, translations, description, and the primary image are copied. The registration plate is cleared because it must be unique.',
      clearFields: ['registration_plate'],
      defaults: { status: 'available' },
    },
    filters: [
      {
        key: 'category_id',
        label: 'Category',
        options: [],
        optionsEndpoint: '/admin/car-categories',
        collectionKey: 'car_categories',
        optionLabel: 'name',
        optionValue: 'id',
      },
      { key: 'status', label: 'Status', options: ['available', 'not_available', 'maintenance', 'inactive'] },
    ],
    columns: [
      { field: 'name', header: 'Car' },
      { field: 'registration_plate', header: 'Plate' },
      { field: 'seats', header: 'Seats', type: 'number' },
      {
        field: 'daily_rate',
        header: 'Public price',
        format: (row) => row.is_cargo_transport
          ? `From ${formatMGA(Number(row.cargo_minimum_rate || 0))}`
          : `${formatMGA(Number(row.daily_rate || 0))} / day`,
      },
      {
        field: 'outside_antananarivo_daily_rate',
        header: 'Outside Tana rate',
        format: (row) => row.is_cargo_transport ? '-' : `${formatMGA(Number(row.outside_antananarivo_daily_rate || 0))} / day`,
      },
      { field: 'status', header: 'Status', type: 'status' },
    ],
    cardView: {
      layout: 'grid',
      imageField: 'primary_image_url',
      imageFit: 'cover',
      placeholderIcon: 'pi pi-car',
      titleField: 'name',
      subtitleField: 'registration_plate',
      badgeField: 'status',
      details: [
        {
          field: 'daily_rate',
          label: 'Public price',
          format: (row) => row.is_cargo_transport
            ? `From ${formatMGA(Number(row.cargo_minimum_rate || 0))}`
            : `${formatMGA(Number(row.daily_rate || 0))} / day`,
        },
        {
          field: 'outside_antananarivo_daily_rate',
          label: 'Outside Antananarivo rate',
          format: (row) => row.is_cargo_transport ? '-' : `${formatMGA(Number(row.outside_antananarivo_daily_rate || 0))} / day`,
        },
        { field: 'seats', label: 'Seats', type: 'number' },
        { field: 'make', label: 'Make' },
        { field: 'model', label: 'Model' },
      ],
    },
    formFields: [
      {
        key: 'name', label: 'Display name', type: 'text', placeholder: 'Mercedes S-Class 2023', required: true, localized: true,
        sectionLabel: 'Vehicle identity', sectionDescription: 'Name the car and place it in the right fleet category.', sectionIcon: 'pi pi-car',
      },
      {
        key: 'category_id',
        label: 'Category',
        type: 'select',
        options: [],
        optionsEndpoint: '/admin/car-categories',
        collectionKey: 'car_categories',
        optionLabel: 'name',
        optionValue: 'id',
        required: true,
      },
      {
        key: 'make', label: 'Make', type: 'text', placeholder: 'Mercedes',
        sectionLabel: 'Vehicle specifications', sectionDescription: 'The practical details dispatchers and customers use to identify the car.', sectionIcon: 'pi pi-cog',
      },
      { key: 'model', label: 'Model', type: 'text', placeholder: 'S-Class' },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'registration_plate', label: 'Registration plate', type: 'text', placeholder: 'TAA 0000' },
      { key: 'color', label: 'Color', type: 'text' },
      { key: 'seats', label: 'Seats', type: 'number', defaultValue: 4 },
      {
        key: 'transmission',
        label: 'Transmission',
        type: 'select',
        options: [
          { label: 'Automatic', value: 'automatic' },
          { label: 'Manual', value: 'manual' },
        ],
        placeholder: 'Unspecified',
      },
      { key: 'fuel_type', label: 'Fuel type', type: 'text', placeholder: 'Diesel' },
      {
        key: 'daily_rate', label: 'Daily rate (blank = category default)', type: 'money',
        sectionLabel: 'Pricing and availability', sectionDescription: 'Set the public rental rate and operational state.', sectionIcon: 'pi pi-wallet',
        help: 'Leave the rate blank to use the category default.',
        showWhen: isStandardCar,
      },
      {
        key: 'outside_antananarivo_daily_rate',
        label: 'Outside-region daily rate (blank = category default)',
        type: 'money',
        min: 1,
        showWhen: isStandardCar,
        help: 'Leave blank to inherit the category outside-Antananarivo default.',
      },
      {
        key: 'primary_image_url',
        label: 'Car image',
        type: 'image',
        createOnly: true,
        persist: false,
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'available',
        options: [
          { label: 'Available', value: 'available' },
          { label: 'Maintenance', value: 'maintenance' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
      { key: 'description', label: 'Description', type: 'textarea', localized: true },
    ],
    afterSave: [
      {
        field: 'primary_image_url',
        modes: ['create'],
        method: 'post',
        path: (car) => `/admin/cars/${car.id}/images`,
        body: (url, values, car) => ({
          url,
          alt_text: values.name || car.name || null,
          is_primary: true,
        }),
        errorSummary: 'Car image not attached',
      },
    ],
  },

  'car-categories': {
    id: 'car-categories',
    singular: 'car category',
    plural: 'Car categories',
    eyebrow: 'Mobility',
    description: 'Organize the fleet by service type, with a daily default or a cargo starting price.',
    actionLabel: 'Add car category',
    rowKey: 'id',
    api: {
      list: '/admin/car-categories',
      create: '/admin/car-categories',
      itemBase: '/admin/car-categories',
      collectionKey: 'car_categories',
      itemKey: 'car_category',
    },
    capabilities: { create: true, edit: true, remove: true },
    defaultRow: { is_active: true, default_daily_rate: '0.00' },
    columns: [
      { field: 'name', header: 'Category' },
      {
        field: 'default_daily_rate',
        header: 'Public price',
        format: (row) => row.is_cargo_transport
          ? `From ${formatMGA(Number(row.cargo_minimum_rate || 0))}`
          : `${formatMGA(Number(row.default_daily_rate || 0))} / day`,
      },
      {
        field: 'default_outside_antananarivo_daily_rate',
        header: 'Outside Tana default',
        format: (row) => row.is_cargo_transport
          ? '-'
          : `${formatMGA(Number(row.default_outside_antananarivo_daily_rate || 0))} / day`,
      },
      { field: 'is_cargo_transport', header: 'Cargo', type: 'boolean', trueLabel: 'Yes', falseLabel: 'No' },
      { field: 'cargo_minimum_rate', header: 'Minimum', type: 'money' },
      { field: 'cargo_per_km_rate', header: 'Per km', type: 'money' },
      { field: 'is_active', header: 'Active', type: 'boolean' },
    ],
    cardView: {
      layout: 'grid',
      placeholderIcon: 'pi pi-sitemap',
      titleField: 'name',
      subtitleField: 'description',
      badgeField: 'is_active',
      badgeType: 'boolean',
      badgeTrueLabel: 'Active',
      badgeFalseLabel: 'Inactive',
      details: [
        {
          field: 'default_daily_rate',
          label: 'Public price',
          format: (row) => row.is_cargo_transport
            ? `From ${formatMGA(Number(row.cargo_minimum_rate || 0))}`
            : `${formatMGA(Number(row.default_daily_rate || 0))} / day`,
        },
        {
          field: 'default_outside_antananarivo_daily_rate',
          label: 'Outside Tana default',
          format: (row) => row.is_cargo_transport
            ? '-'
            : `${formatMGA(Number(row.default_outside_antananarivo_daily_rate || 0))} / day`,
        },
        { field: 'is_cargo_transport', label: 'Cargo transport', type: 'boolean', trueLabel: 'Yes', falseLabel: 'No' },
        { field: 'cargo_minimum_rate', label: 'Cargo starting price', type: 'money' },
        { field: 'cargo_per_km_rate', label: 'Per kilometer', type: 'money' },
      ],
    },
    formFields: [
      {
        key: 'name', label: 'Name', type: 'text', placeholder: 'Luxury', required: true, localized: true,
        sectionLabel: 'Category identity', sectionDescription: 'Describe how customers should recognize this fleet category.', sectionIcon: 'pi pi-sitemap',
      },
      {
        key: 'default_daily_rate', label: 'Default daily rate', type: 'money',
        sectionLabel: 'Pricing model', sectionDescription: 'Choose daily pricing or set a cargo starting price.', sectionIcon: 'pi pi-wallet',
        showWhen: isStandardCategory,
      },
      {
        key: 'default_outside_antananarivo_daily_rate',
        label: 'Default daily rate outside Antananarivo',
        type: 'money',
        min: 1,
        requiredWhen: isStandardCategory,
        showWhen: isStandardCategory,
        help: 'Used when a standard car does not define its own outside-region rate.',
      },
      {
        key: 'is_cargo_transport',
        label: 'Cargo transport only',
        type: 'checkbox',
        defaultValue: false,
        fullWidth: true,
      },
      {
        key: 'cargo_per_km_rate',
        label: 'Per kilometer rate',
        type: 'money',
        defaultValue: 10000,
        requiredWhen: isCargoCategory,
        showWhen: isCargoCategory,
        disabled: true,
        sectionLabel: 'Cargo distance pricing',
        sectionDescription: 'The first 10 km are covered by the minimum, then each additional kilometre costs 10,000 MGA.',
        sectionIcon: 'pi pi-map',
      },
      {
        key: 'cargo_minimum_rate',
        label: 'Cargo starting price',
        type: 'money',
        defaultValue: 120000,
        requiredWhen: isCargoCategory,
        showWhen: isCargoCategory,
        disabled: true,
      },
      {
        key: 'description', label: 'Description', type: 'textarea', localized: true,
        sectionLabel: 'Customer visibility', sectionDescription: 'Control the customer-facing description and availability.', sectionIcon: 'pi pi-eye',
      },
      { key: 'is_active', label: 'Status', type: 'select', options: IS_ACTIVE_OPTIONS, defaultValue: true },
    ],
  },

  drivers: {
    id: 'drivers',
    singular: 'driver',
    plural: 'Drivers',
    eyebrow: 'Mobility',
    description: 'Driver roster. Unique phone and license number.',
    actionLabel: 'Add driver',
    rowKey: 'id',
    api: {
      list: '/admin/drivers',
      create: '/admin/drivers',
      itemBase: '/admin/drivers',
      collectionKey: 'drivers',
      itemKey: 'driver',
    },
    capabilities: { create: true, edit: true, remove: true },
    defaultRow: { status: 'available' },
    filters: [
      { key: 'status', label: 'Status', options: ['available', 'assigned', 'inactive'] },
    ],
    columns: [
      { field: 'full_name', header: 'Driver' },
      { field: 'phone', header: 'Phone' },
      { field: 'license_number', header: 'License' },
      { field: 'status', header: 'Status', type: 'status' },
    ],
    cardView: {
      layout: 'grid',
      placeholderIcon: 'pi pi-id-card',
      titleField: 'full_name',
      subtitleField: 'phone',
      badgeField: 'status',
      details: [
        { field: 'license_number', label: 'License' },
        { field: 'phone', label: 'Phone' },
        { field: 'notes', label: 'Operations note' },
      ],
    },
    formFields: [
      {
        key: 'full_name', label: 'Full name', type: 'text', placeholder: 'Rado Andrian', required: true,
        sectionLabel: 'Driver identity', sectionDescription: 'Contact and license information used by dispatch.', sectionIcon: 'pi pi-id-card',
      },
      { key: 'phone', label: 'Phone', type: 'text', placeholder: '+261 …', required: true },
      { key: 'license_number', label: 'License number', type: 'text', placeholder: 'MG-A-00000', required: true },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'available',
        options: [
          { label: 'Available', value: 'available' },
          { label: 'Assigned', value: 'assigned' },
          { label: 'Inactive', value: 'inactive' },
        ],
        sectionLabel: 'Dispatch status',
        sectionDescription: 'Availability can also change automatically when the driver is assigned to an active trip.',
        sectionIcon: 'pi pi-directions',
      },
      { key: 'notes', label: 'Notes', type: 'textarea' },
    ],
  },

  'event-service-categories': {
    id: 'event-service-categories',
    singular: 'event service category',
    plural: 'Service categories',
    eyebrow: 'Events',
    description: 'Groups of event services (sound, lighting, catering, artists...).',
    actionLabel: 'Add service category',
    rowKey: 'id',
    api: {
      list: '/admin/event-service-categories',
      create: '/admin/event-service-categories',
      itemBase: '/admin/event-service-categories',
      collectionKey: 'event_service_categories',
      itemKey: 'event_service_category',
    },
    capabilities: { create: true, edit: true, remove: true },
    defaultRow: { is_active: true },
    columns: [
      { field: 'name', header: 'Category' },
      { field: 'slug', header: 'Slug' },
      { field: 'service_count', header: 'Services', type: 'number' },
      { field: 'is_active', header: 'Active', type: 'boolean' },
    ],
    cardView: {
      layout: 'grid',
      imageField: 'image_url',
      placeholderIcon: 'pi pi-sitemap',
      titleField: 'name',
      subtitleField: 'description',
      badgeField: 'is_active',
      badgeType: 'boolean',
      badgeTrueLabel: 'Active',
      badgeFalseLabel: 'Inactive',
      details: [
        { field: 'service_count', label: 'Services' },
        { field: 'slug', label: 'Slug' },
      ],
    },
    formFields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'Sound & PA', required: true, localized: true },
      { key: 'icon', label: 'Icon (PrimeIcons class)', type: 'text', placeholder: 'pi pi-volume-up' },
      { key: 'description', label: 'Description', type: 'textarea', localized: true },
      { key: 'image_url', label: 'Image', type: 'image' },
      { key: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0 },
      { key: 'is_active', label: 'Status', type: 'select', options: IS_ACTIVE_OPTIONS, defaultValue: true },
    ],
  },

  'event-services': {
    id: 'event-services',
    singular: 'event service',
    plural: 'Event services',
    eyebrow: 'Events',
    description: 'What the team offers per category. From-price is indicative; the real number is the per-request quote.',
    actionLabel: 'Add service',
    rowKey: 'id',
    api: {
      list: '/admin/event-services',
      create: '/admin/event-services',
      itemBase: '/admin/event-services',
      collectionKey: 'event_services',
      itemKey: 'event_service',
    },
    capabilities: { create: true, edit: true, remove: true },
    defaultRow: { is_active: true },
    filters: [
      {
        key: 'category_id',
        label: 'Category',
        options: [],
        optionsEndpoint: '/admin/event-service-categories',
        collectionKey: 'event_service_categories',
        optionLabel: 'name',
        optionValue: 'id',
      },
    ],
    columns: [
      { field: 'name', header: 'Service' },
      { field: 'category_name', header: 'Category' },
      { field: 'from_price', header: 'From', type: 'money' },
      { field: 'price_unit', header: 'Unit' },
      { field: 'is_active', header: 'Availability', type: 'boolean', trueLabel: 'Available', falseLabel: 'Unavailable' },
    ],
    cardView: {
      layout: 'grid',
      imageField: 'image_url',
      placeholderIcon: 'pi pi-star',
      titleField: 'name',
      subtitleField: 'category_name',
      badgeField: 'is_active',
      badgeType: 'boolean',
      badgeTrueLabel: 'Available',
      badgeFalseLabel: 'Unavailable',
      details: [
        { field: 'from_price', label: 'From', type: 'money' },
        { field: 'price_unit', label: 'Unit' },
      ],
    },
    formFields: [
      { key: 'name', label: 'Name', type: 'text', placeholder: 'Live band', required: true, localized: true },
      {
        key: 'category_id',
        label: 'Category',
        type: 'select',
        options: [],
        optionsEndpoint: '/admin/event-service-categories',
        collectionKey: 'event_service_categories',
        optionLabel: 'name',
        optionValue: 'id',
        required: true,
      },
      { key: 'from_price', label: 'From price (indicative)', type: 'money' },
      { key: 'price_unit', label: 'Price unit', type: 'text', placeholder: 'per event, per guest, per artist', localized: true },
      { key: 'description', label: 'Description', type: 'textarea', localized: true },
      { key: 'image_url', label: 'Image', type: 'image' },
      { key: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0 },
      { key: 'is_active', label: 'Availability', type: 'select', options: AVAILABILITY_OPTIONS, defaultValue: true },
    ],
  },

  artists: {
    id: 'artists',
    singular: 'artist',
    plural: 'Gospel artists',
    eyebrow: 'Events',
    description: 'Christian/gospel artists clients can browse and request. Genres, formats, languages, and occasions are comma-separated; links go one per line.',
    actionLabel: 'Add artist',
    rowKey: 'id',
    api: {
      list: '/admin/artists',
      create: '/admin/artists',
      itemBase: '/admin/artists',
      collectionKey: 'artists',
      itemKey: 'artist',
    },
    capabilities: { create: true, edit: true, remove: true },
    defaultRow: { is_active: true, is_featured: false },
    columns: [
      { field: 'stage_name', header: 'Artist' },
      { field: 'genres', header: 'Genres' },
      { field: 'group_size', header: 'Group' },
      { field: 'from_fee', header: 'From', type: 'money' },
      { field: 'is_featured', header: 'Featured', type: 'boolean', trueLabel: 'Featured', falseLabel: 'No' },
      { field: 'is_active', header: 'Active', type: 'boolean' },
    ],
    cardView: {
      layout: 'grid',
      imageField: 'photo_url',
      placeholderIcon: 'pi pi-microphone',
      titleField: 'stage_name',
      subtitleField: 'genres',
      badgeField: 'is_active',
      badgeType: 'boolean',
      badgeTrueLabel: 'Active',
      badgeFalseLabel: 'Inactive',
      details: [
        { field: 'group_size', label: 'Group' },
        { field: 'from_fee', label: 'From', type: 'money' },
        { field: 'home_base', label: 'Base' },
      ],
    },
    formFields: [
      { key: 'stage_name', label: 'Stage / ministry name', type: 'text', required: true, placeholder: 'Voninavo Praise' },
      { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'Worship leader for services and crusades', localized: true },
      { key: 'photo_url', label: 'Photo', type: 'image' },
      { key: 'home_base', label: 'Home base', type: 'place', placeholder: 'Antananarivo' },
      { key: 'group_size', label: 'Group size', type: 'text', placeholder: 'Solo, Band of 6, Choir 20+' },
      { key: 'genres', label: 'Genres (comma-separated)', type: 'text', placeholder: 'gospel, praise & worship, choir' },
      { key: 'formats', label: 'Formats (comma-separated)', type: 'text', placeholder: 'worship leader, soloist, band' },
      { key: 'languages', label: 'Languages (comma-separated)', type: 'text', placeholder: 'Malagasy, French, English' },
      { key: 'occasions', label: 'Best-fit occasions (comma-separated)', type: 'text', placeholder: 'Sunday service, crusade, wedding' },
      { key: 'from_fee', label: 'From fee (indicative)', type: 'money' },
      { key: 'sample_links', label: 'Sample links (one per line)', type: 'textarea', placeholder: 'https://youtube.com/...' },
      { key: 'social_links', label: 'Social links (one per line)', type: 'textarea', placeholder: 'https://facebook.com/...' },
      { key: 'bio', label: 'Bio', type: 'textarea', localized: true },
      { key: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0 },
      {
        key: 'is_featured',
        label: 'Featured',
        type: 'select',
        options: [
          { label: 'Featured', value: true },
          { label: 'Not featured', value: false },
        ],
        defaultValue: false,
      },
      { key: 'is_active', label: 'Status', type: 'select', options: IS_ACTIVE_OPTIONS, defaultValue: true },
    ],
  },

  orders: {
    id: 'orders',
    singular: 'order',
    plural: 'Orders',
    eyebrow: 'Tech',
    description: 'Customer orders and manual phone/walk-in orders. Fulfillment and payment are tracked separately; deliver first, then confirm payment.',
    actionLabel: 'Create order',
    rowKey: 'id',
    api: {
      list: '/admin/orders',
      create: '/admin/orders',
      itemBase: '/admin/orders',
      collectionKey: 'orders',
      itemKey: 'order',
    },
    // Created on a dedicated screen (line-item builder); still no edit/remove.
    createRoute: () => ({ name: 'admin-order-new' }),
    capabilities: { create: true, edit: false, remove: false },
    filters: [
      { key: 'status', label: 'Status', options: ['pending', 'confirmed', 'shipped', 'delivered', 'picked_up', 'cancelled', 'expired'] },
      { key: 'payment_status', label: 'Payment', options: ['unpaid', 'paid', 'refunded'] },
      { key: 'fulfillment_type', label: 'Fulfillment', options: ['delivery', 'pickup'] },
    ],
    actions: [
      { key: 'status', label: 'Advance status', method: 'PATCH', path: (id) => `/admin/orders/${id}/status` },
    ],
    columns: [
      { field: 'id', header: 'ID', type: 'number' },
      { field: 'order_number', header: 'Order' },
      { field: 'customer_name', header: 'Customer' },
      { field: 'user_id', header: 'Customer ID', type: 'number' },
      { field: 'fulfillment_type', header: 'Fulfillment' },
      { field: 'status', header: 'Status', type: 'status' },
      { field: 'payment_status', header: 'Payment', type: 'status' },
      { field: 'total', header: 'Total', type: 'money' },
      { field: 'created_at', header: 'Placed', type: 'date' },
    ],
    formFields: [],
  },

  bookings: {
    id: 'bookings',
    singular: 'booking',
    plural: 'Bookings',
    eyebrow: 'Mobility',
    description: 'Car bookings over a date range. Assign a driver and advance the rental lifecycle.',
    actionLabel: 'Create booking',
    rowKey: 'id',
    api: {
      list: '/admin/bookings',
      create: '/admin/bookings',
      itemBase: '/admin/bookings',
      collectionKey: 'bookings',
      itemKey: 'booking',
    },
    capabilities: { create: true, edit: false, remove: true },
    removeWhen: (booking) => booking.payment_status === 'unpaid',
    removeDisabledHelp: 'Bookings with payment history cannot be deleted.',
    filters: [
      { key: 'status', label: 'Status', options: ['requested', 'confirmed', 'driver_assigned', 'active', 'completed', 'cancelled'] },
      { key: 'payment_status', label: 'Payment', options: ['unpaid', 'paid', 'refunded'] },
      {
        key: 'car_id',
        label: 'Car',
        options: [],
        optionsEndpoint: '/admin/cars',
        collectionKey: 'cars',
        optionLabel: 'name',
        optionValue: 'id',
      },
    ],
    actions: [
      { key: 'assign-driver', label: 'Assign driver', method: 'POST', path: (id) => `/admin/bookings/${id}/assign-driver` },
      { key: 'status', label: 'Advance status', method: 'PATCH', path: (id) => `/admin/bookings/${id}/status` },
    ],
    columns: [
      { field: 'id', header: 'ID', type: 'number' },
      { field: 'booking_number', header: 'Booking' },
      { field: 'customer_name', header: 'Customer' },
      { field: 'user_id', header: 'Customer ID', type: 'number' },
      { field: 'car_name', header: 'Car' },
      { field: 'status', header: 'Status', type: 'status' },
      { field: 'payment_status', header: 'Payment', type: 'status' },
      { field: 'start_at', header: 'Start', type: 'date' },
      { field: 'end_at', header: 'End', type: 'date' },
      { field: 'total_price', header: 'Total', type: 'money' },
    ],
    cardView: {
      layout: 'grid',
      placeholderIcon: 'pi pi-calendar-clock',
      titleField: 'booking_number',
      subtitleField: 'customer_name',
      badgeField: 'status',
      details: [
        { field: 'car_name', label: 'Car' },
        { field: 'start_at', label: 'Starts', type: 'date' },
        { field: 'payment_status', label: 'Payment', type: 'status' },
        { field: 'total_price', label: 'Total', type: 'money' },
      ],
    },
    formFields: [
      {
        key: 'customer_name', label: 'Customer name', type: 'text', placeholder: 'Phone caller name', required: true,
        sectionLabel: 'Customer', sectionDescription: 'Identify who is booking and optionally connect their account.', sectionIcon: 'pi pi-user',
      },
      {
        key: 'user_id',
        label: 'Customer account',
        type: 'select',
        options: [],
        optionsEndpoint: '/admin/customers',
        collectionKey: 'customers',
        optionLabel: 'full_name',
        optionValue: 'id',
        placeholder: 'None',
      },
      {
        key: 'car_id',
        label: 'Car',
        type: 'select',
        options: [],
        optionsEndpoint: '/admin/cars',
        collectionKey: 'cars',
        optionLabel: 'name',
        optionValue: 'id',
        required: true,
        sectionLabel: 'Vehicle and driver',
        sectionDescription: 'Choose the vehicle first; the driver can be assigned now or later.',
        sectionIcon: 'pi pi-car',
      },
      {
        key: 'driver_id',
        label: 'Driver',
        type: 'select',
        options: [],
        optionsEndpoint: '/admin/drivers',
        collectionKey: 'drivers',
        optionLabel: 'full_name',
        optionValue: 'id',
        placeholder: 'Assign later',
      },
      {
        key: 'start_at',
        label: 'Start',
        type: 'datetime',
        requiredWhen: isStandardBooking,
        showWhen: isStandardBooking,
        sectionLabel: 'Trip schedule',
        sectionDescription: 'Set the rental window or cargo transport date.',
        sectionIcon: 'pi pi-calendar-clock',
      },
      {
        key: 'end_at',
        label: 'End',
        type: 'datetime',
        requiredWhen: isStandardBooking,
        showWhen: isStandardBooking,
      },
      {
        key: 'cargo_service_date',
        label: 'Transport date',
        type: 'date',
        requiredWhen: isCargoBooking,
        showWhen: isCargoBooking,
        minDate: todayStart,
        toBody: cargoServiceWindow,
        sectionLabel: 'Trip schedule',
        sectionDescription: 'Set the rental window or cargo transport date.',
        sectionIcon: 'pi pi-calendar-clock',
      },
      {
        key: 'pickup_location', label: 'From / pickup location', type: 'place', required: true, manualFallback: false,
        sectionLabel: 'Route and contact', sectionDescription: 'Confirm where the trip starts, where it ends, and how to reach the customer.', sectionIcon: 'pi pi-map-marker',
      },
      {
        key: 'outside_antananarivo',
        label: 'Leaves Antananarivo region?',
        type: 'select',
        options: [
          { label: 'No — local rate', value: false },
          { label: 'Yes — outside-region rate', value: true },
        ],
        requiredWhen: isStandardBooking,
        showWhen: isStandardBooking,
      },
      {
        key: 'dropoff_location',
        label: 'To / dropoff location',
        type: 'place',
        manualFallback: false,
        requiredWhen: isCargoBooking,
        showWhen: isCargoBooking,
      },
      {
        key: 'distance_km',
        label: 'Distance',
        type: 'number',
        min: 0.01,
        suffix: ' km',
        minFractionDigits: 2,
        maxFractionDigits: 2,
        serializeAs: 'string',
        readonly: true,
        requiredWhen: isCargoBooking,
        showWhen: isCargoBooking,
      },
      { key: 'contact_phone', label: 'Contact phone', type: 'text', required: true },
      { key: 'note', label: 'Note', type: 'textarea' },
    ],
  },

  'event-requests': {
    id: 'event-requests',
    singular: 'event request',
    plural: 'Event requests',
    eyebrow: 'Events',
    description: 'Client event-planning requests. Review, set a quote, advance the lifecycle, then record payment.',
    actionLabel: 'Create request',
    rowKey: 'id',
    api: {
      list: '/admin/event-requests',
      create: '/admin/event-requests',
      itemBase: '/admin/event-requests',
      collectionKey: 'event_requests',
      itemKey: 'event_request',
    },
    // Logged on a dedicated screen (form + services picker); still no edit/remove.
    createRoute: () => ({ name: 'admin-event-request-new' }),
    capabilities: { create: true, edit: false, remove: false },
    filters: [
      { key: 'status', label: 'Status', options: ['requested', 'reviewing', 'quoted', 'confirmed', 'in_progress', 'completed', 'cancelled'] },
      { key: 'payment_status', label: 'Payment', options: ['unpaid', 'paid', 'refunded'] },
      { key: 'event_type', label: 'Event type', options: ['wedding', 'corporate', 'birthday', 'concert', 'conference', 'other'] },
    ],
    columns: [
      { field: 'id', header: 'ID', type: 'number' },
      { field: 'request_number', header: 'Request' },
      { field: 'customer_name', header: 'Customer' },
      { field: 'event_type', header: 'Type' },
      { field: 'event_start', header: 'Event date', type: 'date' },
      { field: 'status', header: 'Status', type: 'status' },
      { field: 'payment_status', header: 'Payment', type: 'status' },
      { field: 'quoted_price', header: 'Quote', type: 'money' },
      { field: 'created_at', header: 'Requested', type: 'date' },
    ],
    cardView: {
      layout: 'grid',
      placeholderIcon: 'pi pi-calendar-plus',
      titleField: 'request_number',
      subtitleField: 'customer_name',
      badgeField: 'status',
      details: [
        { field: 'event_type', label: 'Event type', type: 'enum' },
        { field: 'event_start', label: 'Event date', type: 'date' },
        { field: 'budget', label: 'Client budget', format: (row) => row.budget ? formatMGA(Number(row.budget)) : '—' },
        { field: 'quoted_price', label: 'Final quote', format: (row) => row.quoted_price ? formatMGA(Number(row.quoted_price)) : '—' },
        { field: 'payment_status', label: 'Payment', type: 'status' },
      ],
    },
    formFields: [],
  },

  payments: {
    id: 'payments',
    singular: 'payment',
    plural: 'Payments',
    eyebrow: 'Finance',
    description: 'Manual payment ledger. Recording a payment confirms it and flips the target order, booking, or event to paid.',
    actionLabel: 'Record payment',
    rowKey: 'id',
    api: {
      list: '/admin/payments',
      create: '/admin/payments',
      itemBase: '/admin/payments',
      collectionKey: 'payments',
      itemKey: 'payment',
    },
    capabilities: { create: true, edit: false, remove: false },
    filters: [
      { key: 'payable_type', label: 'For', options: ['order', 'booking', 'event', 'healthcare'] },
      { key: 'status', label: 'Status', options: ['pending', 'paid', 'refunded'] },
      { key: 'method', label: 'Method', options: ['cash', 'bank_transfer', 'mobile_money', 'other'] },
    ],
    actions: [
      { key: 'refund', label: 'Refund', method: 'POST', path: (id) => `/admin/payments/${id}/refund` },
    ],
    columns: [
      { field: 'id', header: 'ID', type: 'number' },
      { field: 'payable_type', header: 'For' },
      { field: 'payable_id', header: 'Target ID', type: 'number' },
      { field: 'amount', header: 'Amount', type: 'money' },
      { field: 'method', header: 'Method' },
      { field: 'status', header: 'Status', type: 'status' },
      { field: 'marked_paid_at', header: 'Recorded', type: 'date' },
    ],
    formFields: [
      {
        key: 'payable_type',
        label: 'Target',
        type: 'select',
        defaultValue: 'order',
        required: true,
        options: [
          { label: 'Order', value: 'order' },
          { label: 'Booking', value: 'booking' },
          { label: 'Event', value: 'event' },
          { label: 'Healthcare', value: 'healthcare' },
        ],
      },
      { key: 'payable_id', label: 'Target ID', type: 'number', required: true },
      {
        key: 'method',
        label: 'Method',
        type: 'select',
        defaultValue: 'cash',
        required: true,
        options: [
          { label: 'Cash', value: 'cash' },
          { label: 'Bank transfer', value: 'bank_transfer' },
          { label: 'Mobile money', value: 'mobile_money' },
          { label: 'Other', value: 'other' },
        ],
      },
      { key: 'amount', label: 'Amount (blank = target total)', type: 'money' },
      { key: 'reference', label: 'Reference', type: 'text', placeholder: 'Receipt / transfer ref' },
      { key: 'note', label: 'Note', type: 'textarea' },
    ],
  },

  customers: {
    id: 'customers',
    singular: 'customer',
    plural: 'Customers',
    eyebrow: 'Accounts',
    description: 'Read-only view of customer accounts, with their order and booking counts.',
    actionLabel: null,
    rowKey: 'id',
    api: {
      list: '/admin/customers',
      create: null,
      itemBase: '/admin/customers',
      collectionKey: 'customers',
      itemKey: 'customer',
    },
    // View-only: customers cannot be created, edited, or deleted here.
    capabilities: { create: false, edit: false, remove: false },
    columns: [
      { field: 'full_name', header: 'Customer' },
      { field: 'email', header: 'Email' },
      { field: 'phone', header: 'Phone' },
      { field: 'order_count', header: 'Orders', type: 'number' },
      { field: 'booking_count', header: 'Bookings', type: 'number' },
      { field: 'is_active', header: 'Active', type: 'boolean' },
      { field: 'created_at', header: 'Joined', type: 'date' },
    ],
    formFields: [],
  },

  'audit-logs': {
    id: 'audit-logs',
    singular: 'log entry',
    plural: 'Activity log',
    eyebrow: 'System',
    description: 'Who changed what in the admin dashboard, and when. Every create, update, and delete is recorded with the staff member who made it.',
    actionLabel: null,
    rowKey: 'id',
    api: {
      list: '/admin/audit-logs',
      create: null,
      itemBase: '/admin/audit-logs',
      collectionKey: 'logs',
      itemKey: 'log',
    },
    // Append-only trail: never created, edited, or deleted from the UI.
    capabilities: { create: false, edit: false, remove: false },
    filters: [
      { key: 'method', label: 'Action', options: ['POST', 'PATCH', 'PUT', 'DELETE'] },
      {
        key: 'target_type',
        label: 'Target',
        options: [
          'products', 'categories', 'brands', 'cars', 'car-categories', 'drivers',
          'orders', 'bookings', 'event-services', 'event-requests', 'artists',
          'healthcare', 'practitioners', 'payments',
        ],
      },
    ],
    columns: [
      { field: 'created_at', header: 'When', type: 'datetime' },
      { field: 'actor_name', header: 'Who', format: auditActor },
      { field: 'method', header: 'Action', format: auditAction },
      { field: 'target_type', header: 'Target', format: auditTarget },
      { field: 'payload', header: 'Changes', format: auditChanges },
      { field: 'status_code', header: 'Status', type: 'number' },
    ],
    formFields: [],
  },

  practitioners: {
    id: 'practitioners',
    singular: 'practitioner',
    plural: 'Practitioners',
    eyebrow: 'Healthcare',
    description: 'Keep doctors and nurses identifiable, contactable, and ready for home-care assignments.',
    actionLabel: 'Add practitioner',
    rowKey: 'id',
    api: {
      list: '/admin/practitioners',
      create: '/admin/practitioners',
      itemBase: '/admin/practitioners',
      collectionKey: 'practitioners',
      itemKey: 'practitioner',
    },
    capabilities: { create: true, edit: true, remove: true },
    defaultRow: { status: 'active', type: 'doctor' },
    filters: [
      { key: 'type', label: 'Type', options: ['doctor', 'nurse'] },
    ],
    columns: [
      { field: 'full_name', header: 'Name' },
      { field: 'type', header: 'Type', type: 'status' },
      { field: 'specialty', header: 'Specialty' },
      { field: 'phone', header: 'Phone' },
      { field: 'status', header: 'Status', type: 'status' },
    ],
    cardView: {
      layout: 'grid',
      imageField: 'photo_url',
      imageFit: 'cover',
      placeholderIcon: 'pi pi-user-plus',
      titleField: 'full_name',
      subtitleField: 'specialty',
      badgeField: 'status',
      details: [
        { field: 'type', label: 'Role', type: 'enum' },
        { field: 'phone', label: 'Phone' },
        { field: 'email', label: 'Email' },
        { field: 'license_number', label: 'License number' },
      ],
    },
    formFields: [
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        required: true,
        defaultValue: 'doctor',
        options: [
          { label: 'Doctor', value: 'doctor' },
          { label: 'Nurse', value: 'nurse' },
        ],
        sectionLabel: 'Clinical identity', sectionDescription: 'Set the practitioner role and the name staff will use for assignments.', sectionIcon: 'pi pi-user-plus',
      },
      { key: 'full_name', label: 'Full name', type: 'text', required: true, placeholder: 'Dr. Hery Rakoto' },
      { key: 'specialty', label: 'Specialty', type: 'text', placeholder: 'General medicine, Pediatrics', localized: true },
      {
        key: 'phone', label: 'Phone', type: 'text', required: true, placeholder: '+261 …',
        sectionLabel: 'Contact & credentials', sectionDescription: 'Keep direct contact and professional identification easy to verify.', sectionIcon: 'pi pi-address-book',
      },
      { key: 'email', label: 'Email', type: 'text', placeholder: 'name@example.com' },
      { key: 'license_number', label: 'License number', type: 'text' },
      {
        key: 'photo_url', label: 'Photo', type: 'image',
        sectionLabel: 'Profile visibility', sectionDescription: 'Add a recognizable photo and a short customer-facing biography.', sectionIcon: 'pi pi-image',
      },
      { key: 'bio', label: 'Bio', type: 'textarea', localized: true },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        defaultValue: 'active',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
        sectionLabel: 'Assignment readiness', sectionDescription: 'Only active practitioners should be offered for new assignments.', sectionIcon: 'pi pi-check-circle',
      },
    ],
  },

  'healthcare-service-categories': {
    id: 'healthcare-service-categories',
    singular: 'care category',
    plural: 'Care categories',
    eyebrow: 'Healthcare',
    description: 'Organize consultations and care packages into clear groups patients can understand.',
    actionLabel: 'Add category',
    rowKey: 'id',
    api: {
      list: '/admin/healthcare/categories',
      create: '/admin/healthcare/categories',
      itemBase: '/admin/healthcare/categories',
      collectionKey: 'healthcare_service_categories',
      itemKey: 'healthcare_service_category',
    },
    capabilities: { create: true, edit: true, remove: true },
    defaultRow: { is_active: true },
    columns: [
      { field: 'name', header: 'Category' },
      { field: 'slug', header: 'Slug' },
      { field: 'service_count', header: 'Services', type: 'number' },
      { field: 'is_active', header: 'Active', type: 'boolean' },
    ],
    cardView: {
      layout: 'grid',
      imageField: 'image_url',
      imageFit: 'cover',
      placeholderIcon: 'pi pi-heart',
      titleField: 'name',
      subtitleField: 'description',
      badgeField: 'is_active',
      badgeType: 'boolean',
      badgeTrueLabel: 'Available',
      badgeFalseLabel: 'Unavailable',
      details: [
        { field: 'service_count', label: 'Linked services', type: 'number' },
        { field: 'slug', label: 'Slug' },
      ],
    },
    formFields: [
      {
        key: 'name', label: 'Name', type: 'text', placeholder: 'Home Consultation', required: true, localized: true,
        sectionLabel: 'Category identity', sectionDescription: 'Use a clear care group patients can recognize quickly.', sectionIcon: 'pi pi-sitemap',
      },
      { key: 'icon', label: 'Icon (PrimeIcons class)', type: 'text', placeholder: 'pi pi-home' },
      {
        key: 'description', label: 'Description', type: 'textarea', localized: true,
        sectionLabel: 'Customer presentation', sectionDescription: 'Explain the category and add a visual for the healthcare page.', sectionIcon: 'pi pi-image',
      },
      { key: 'image_url', label: 'Image', type: 'image' },
      {
        key: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0,
        sectionLabel: 'Visibility', sectionDescription: 'Control customer-facing order and availability.', sectionIcon: 'pi pi-eye',
      },
      { key: 'is_active', label: 'Status', type: 'select', options: IS_ACTIVE_OPTIONS, defaultValue: true },
    ],
  },

  'healthcare-services': {
    id: 'healthcare-services',
    singular: 'care service',
    plural: 'Care services',
    eyebrow: 'Healthcare',
    description: 'Define consultation guidance and fixed care packages with transparent pricing and staffing.',
    actionLabel: 'Add service',
    rowKey: 'id',
    api: {
      list: '/admin/healthcare/services',
      create: '/admin/healthcare/services',
      itemBase: '/admin/healthcare/services',
      collectionKey: 'healthcare_services',
      itemKey: 'healthcare_service',
    },
    capabilities: { create: true, edit: true, remove: true },
    defaultRow: { is_active: true, service_type: 'consultation', staff_doctors: 0, staff_nurses: 0 },
    filters: [
      { key: 'type', label: 'Type', options: ['consultation', 'package'] },
    ],
    columns: [
      { field: 'name', header: 'Service' },
      { field: 'category_name', header: 'Category' },
      { field: 'service_type', header: 'Type', type: 'status' },
      { field: 'price', header: 'Price', format: healthcarePriceLabel },
      { field: 'staff', header: 'Staff', format: healthcareStaffLabel },
      { field: 'is_active', header: 'Availability', type: 'boolean', trueLabel: 'Available', falseLabel: 'Unavailable' },
    ],
    cardView: {
      layout: 'grid',
      imageField: 'image_url',
      imageFit: 'cover',
      placeholderIcon: 'pi pi-heart-fill',
      titleField: 'name',
      subtitleField: 'category_name',
      badgeField: 'service_type',
      details: [
        { field: 'price', label: 'Price', format: healthcarePriceLabel },
        { field: 'staff', label: 'Staff', format: healthcareStaffLabel },
        { field: 'duration_days', label: 'Coverage days', type: 'number' },
        { field: 'is_active', label: 'Availability', type: 'boolean', trueLabel: 'Available', falseLabel: 'Unavailable' },
      ],
    },
    formFields: [
      {
        key: 'name', label: 'Name', type: 'text', placeholder: 'General home consultation', required: true, localized: true,
        sectionLabel: 'Service identity', sectionDescription: 'Name the offer and place it in the correct care category.', sectionIcon: 'pi pi-heart',
      },
      {
        key: 'category_id',
        label: 'Category',
        type: 'select',
        options: [],
        optionsEndpoint: '/admin/healthcare/categories',
        collectionKey: 'healthcare_service_categories',
        optionLabel: 'name',
        optionValue: 'id',
        required: true,
      },
      {
        key: 'service_type',
        label: 'Type',
        type: 'select',
        defaultValue: 'consultation',
        required: true,
        options: [
          { label: 'Consultation (quote-priced)', value: 'consultation' },
          { label: 'Package (fixed price)', value: 'package' },
        ],
        sectionLabel: 'Pricing model', sectionDescription: 'Consultations show an indicative starting point; packages carry a fixed price.', sectionIcon: 'pi pi-wallet',
      },
      { key: 'from_price', label: 'From price (indicative)', type: 'money', showWhen: isHealthcareConsultation },
      { key: 'price', label: 'Package price', type: 'money', requiredWhen: isHealthcarePackage, showWhen: isHealthcarePackage },
      { key: 'duration_days', label: 'Coverage (days)', type: 'number', showWhen: isHealthcarePackage },
      {
        key: 'staff_doctors',
        label: 'Doctors in package',
        type: 'number',
        defaultValue: 0,
        showWhen: isHealthcarePackage,
        persist: false,
        toBody: packageStaffBody,
        sectionLabel: 'Package care team', sectionDescription: 'Define the doctor and nurse capacity included in this package.', sectionIcon: 'pi pi-users',
      },
      {
        key: 'staff_nurses',
        label: 'Nurses in package',
        type: 'number',
        defaultValue: 0,
        showWhen: isHealthcarePackage,
        persist: false,
      },
      { key: 'price_unit', label: 'Price unit', type: 'text', placeholder: 'per visit, per month', localized: true },
      {
        key: 'description', label: 'Description', type: 'textarea', localized: true,
        sectionLabel: 'Patient presentation', sectionDescription: 'Explain what is included and add the visual shown on the public page.', sectionIcon: 'pi pi-image',
      },
      { key: 'image_url', label: 'Image', type: 'image' },
      {
        key: 'sort_order', label: 'Sort order', type: 'number', defaultValue: 0,
        sectionLabel: 'Publishing', sectionDescription: 'Control the display order and whether patients can request this service.', sectionIcon: 'pi pi-eye',
      },
      { key: 'is_active', label: 'Availability', type: 'select', options: AVAILABILITY_OPTIONS, defaultValue: true },
    ],
  },

  'healthcare-requests': {
    id: 'healthcare-requests',
    singular: 'care request',
    plural: 'Care requests',
    eyebrow: 'Healthcare',
    description: 'Client home-care requests. Review, quote consultations, assign practitioners, then record payment.',
    actionLabel: null,
    rowKey: 'id',
    api: {
      list: '/admin/healthcare/requests',
      create: null,
      itemBase: '/admin/healthcare/requests',
      collectionKey: 'healthcare_requests',
      itemKey: 'healthcare_request',
    },
    capabilities: { create: false, edit: false, remove: false },
    filters: [
      { key: 'status', label: 'Status', options: ['requested', 'reviewing', 'quoted', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'] },
      { key: 'payment_status', label: 'Payment', options: ['unpaid', 'paid', 'refunded'] },
      { key: 'type', label: 'Type', options: ['consultation', 'package'] },
    ],
    columns: [
      { field: 'id', header: 'ID', type: 'number' },
      { field: 'request_number', header: 'Request' },
      { field: 'customer_name', header: 'Customer' },
      { field: 'patient_name', header: 'Patient' },
      { field: 'request_type', header: 'Type' },
      { field: 'status', header: 'Status', type: 'status' },
      { field: 'payment_status', header: 'Payment', type: 'status' },
      { field: 'quoted_price', header: 'Quote', type: 'money' },
      { field: 'created_at', header: 'Requested', type: 'date' },
    ],
    cardView: {
      layout: 'grid',
      placeholderIcon: 'pi pi-heart',
      titleField: 'patient_name',
      subtitleField: 'request_number',
      badgeField: 'status',
      details: [
        { field: 'service_name', label: 'Service' },
        { field: 'customer_name', label: 'Customer' },
        { field: 'request_type', label: 'Type', type: 'enum' },
        { field: 'assignment_count', label: 'Assigned practitioners', type: 'number' },
        { field: 'quoted_price', label: 'Quote', type: 'money' },
        { field: 'payment_status', label: 'Payment', type: 'status' },
      ],
    },
    formFields: [],
  },
};

const YES_NO_OPTIONS = [
  { label: 'Yes', value: true },
  { label: 'No', value: false },
];

// --- Step 4: "manage" specs — detail fields, domain actions, and nested
// sub-collections opened from a row's manage button. ---

// Products are managed on a dedicated screen (AdminProductDetailView), not a
// dialog. These are the fields for that screen's add/edit-variant pop-up.
adminResources.products.variantForm = [
  { key: 'sku', label: 'SKU', type: 'text', required: true },
  { key: 'label', label: 'Label', type: 'text', placeholder: 'Black / 128GB' },
  // Uploaded in the dialog, attached to the variant by the product screen (persist:false).
  { key: 'variant_image_url', label: 'Variant image', type: 'image', persist: false },
  { ...VARIANT_ATTRIBUTES_FIELD },
  { key: 'price', label: 'Price', type: 'money', required: true },
  { key: 'stock_quantity', label: 'Stock', type: 'number', defaultValue: 0, required: true },
  { key: 'is_active', label: 'Availability', type: 'select', options: AVAILABILITY_OPTIONS, defaultValue: true },
];

adminResources.cars.manage = {
  fields: [
    { key: 'name', label: 'Name' },
    { key: 'registration_plate', label: 'Plate' },
    { key: 'daily_rate', label: 'Daily rate', type: 'money' },
    { key: 'outside_antananarivo_daily_rate', label: 'Outside Antananarivo rate', type: 'money' },
    { key: 'status', label: 'Status', type: 'enum' },
  ],
  nested: [
    {
      key: 'images',
      title: 'Images',
      singular: 'image',
      collectionKey: 'images',
      addLabel: 'Add image',
      addPath: (id) => `/admin/cars/${id}/images`,
      removePath: (row) => `/admin/car-images/${row.id}`,
      columns: [
        { field: 'url', header: 'Image', type: 'image' },
        { field: 'is_primary', header: 'Primary', type: 'boolean' },
      ],
      formFields: [
        { key: 'url', label: 'Image', type: 'image', required: true },
        { key: 'alt_text', label: 'Alt text', type: 'text' },
        { key: 'is_primary', label: 'Primary', type: 'select', options: YES_NO_OPTIONS, defaultValue: false },
      ],
    },
  ],
};

adminResources.orders.manage = {
  summary: {
    icon: 'pi pi-shopping-bag',
    eyebrow: 'Order overview',
    titleKey: 'order_number',
    subtitleKey: 'customer_name',
    badges: [
      { key: 'status', label: 'Status' },
      { key: 'payment_status', label: 'Payment' },
    ],
  },
  fields: [
    { key: 'id', label: 'Order ID', section: 'record', sectionLabel: 'Record & customer', sectionIcon: 'pi pi-user' },
    { key: 'user_id', label: 'Customer ID', section: 'record', emptyLabel: 'Walk-in customer' },
    { key: 'fulfillment_type', label: 'Fulfillment', type: 'enum', section: 'fulfillment', sectionLabel: 'Fulfillment & timing', sectionIcon: 'pi pi-box' },
    { key: 'placed_at', label: 'Placed', type: 'date', value: orderPlacedAt, section: 'fulfillment' },
    { key: 'reserved_until', label: 'Pickup hold until', type: 'date', section: 'fulfillment', showWhen: (order) => order.fulfillment_type === 'pickup' && Boolean(order.reserved_until) },
    { key: 'paid_at', label: 'Paid at', type: 'date', section: 'fulfillment', showWhen: (order) => Boolean(order.paid_at) },
    { key: 'subtotal', label: 'Subtotal', type: 'money', section: 'value', sectionLabel: 'Order value', sectionIcon: 'pi pi-wallet' },
    { key: 'shipping_fee', label: 'Shipping fee', type: 'money', section: 'value' },
    { key: 'total', label: 'Total', type: 'money', section: 'value', highlight: true, tone: 'emerald' },
    { key: 'ship_recipient_name', label: 'Recipient name', section: 'delivery', sectionLabel: 'Delivery details', sectionIcon: 'pi pi-map-marker', showWhen: (order) => order.fulfillment_type === 'delivery' },
    { key: 'ship_phone', label: 'Contact', section: 'delivery', showWhen: (order) => order.fulfillment_type === 'delivery' },
    { key: 'delivery_address', label: 'Delivery address', value: orderDeliveryAddress, section: 'delivery', wide: true, emptyLabel: 'No delivery address provided.', showWhen: (order) => order.fulfillment_type === 'delivery' },
    { key: 'note', label: 'Order note', type: 'note', section: 'note', sectionLabel: 'Customer instructions', sectionIcon: 'pi pi-comment', wide: true, emptyLabel: 'No order note provided.' },
  ],
  itemsTable: {
    key: 'items',
    title: 'Line items',
    columns: [
      { field: 'product_name', header: 'Product' },
      { field: 'variant_label', header: 'Variant' },
      { field: 'unit_price', header: 'Unit', type: 'money' },
      { field: 'quantity', header: 'Qty' },
      { field: 'line_total', header: 'Line total', type: 'money' },
    ],
  },
  actionsDescription: 'Record payment after handover, or update the fulfillment status.',
  actions: [
    {
      key: 'record-payment',
      label: 'Record payment',
      type: 'form',
      method: 'POST',
      path: () => '/admin/payments',
      icon: 'pi pi-wallet',
      severity: 'success',
      successSummary: 'Payment recorded',
      errorSummary: 'Payment failed',
      enabled: (order) => order.payment_status !== 'paid' && ['delivered', 'picked_up'].includes(order.status),
      body: (values, order) => ({
        payable_type: 'order',
        payable_id: order.id,
        ...values,
      }),
      formFields: [
        {
          key: 'method',
          label: 'Payment method',
          type: 'select',
          defaultValue: 'cash',
          required: true,
          options: [
            { label: 'Cash', value: 'cash' },
            { label: 'Bank transfer', value: 'bank_transfer' },
            { label: 'Mobile money', value: 'mobile_money' },
            { label: 'Other', value: 'other' },
          ],
        },
        { key: 'amount', label: 'Amount (blank = order total)', type: 'money' },
        { key: 'reference', label: 'Reference', type: 'text', placeholder: 'Receipt / transfer ref' },
        { key: 'note', label: 'Note', type: 'textarea' },
      ],
    },
    {
      key: 'status',
      label: 'Advance status',
      type: 'select-transition',
      method: 'PATCH',
      bodyKey: 'status',
      path: (id) => `/admin/orders/${id}/status`,
      next: (order) =>
        order.fulfillment_type === 'delivery'
          ? { pending: ['confirmed', 'cancelled'], confirmed: ['shipped', 'cancelled'], shipped: ['delivered'] }[order.status] || []
          : { pending: ['picked_up', 'cancelled'] }[order.status] || [],
    },
  ],
};

adminResources.bookings.manage = {
  summary: {
    icon: 'pi pi-car',
    eyebrow: 'Booking overview',
    titleKey: 'booking_number',
    subtitleKey: 'customer_name',
    badges: [
      { key: 'status', label: 'Status' },
      { key: 'payment_status', label: 'Payment' },
    ],
  },
  fields: [
    { key: 'id', label: 'Booking ID', section: 'record', sectionLabel: 'Record & customer', sectionIcon: 'pi pi-user' },
    { key: 'user_id', label: 'Customer ID', section: 'record' },
    { key: 'car_name', label: 'Car', section: 'schedule', sectionLabel: 'Schedule & pricing', sectionIcon: 'pi pi-calendar-clock' },
    { key: 'start_at', label: 'Start', type: 'date', section: 'schedule' },
    { key: 'end_at', label: 'End', type: 'date', section: 'schedule' },
    { key: 'pricing_model', label: 'Pricing', type: 'enum', section: 'schedule' },
    { key: 'outside_antananarivo', label: 'Outside Antananarivo', type: 'boolean', section: 'schedule' },
    { key: 'daily_rate_snapshot', label: 'Applied daily rate', type: 'money', section: 'schedule' },
    { key: 'total_price', label: 'Total', type: 'money', section: 'schedule' },
    { key: 'distance_km', label: 'Distance', suffix: 'km', section: 'schedule' },
    { key: 'pickup_location', label: 'Pickup', section: 'route', sectionLabel: 'Route & contact', sectionIcon: 'pi pi-map-marker', wide: true },
    { key: 'dropoff_location', label: 'Dropoff', section: 'route', wide: true },
    { key: 'contact_phone', label: 'Contact', section: 'route' },
    { key: 'note', label: 'Client note', type: 'note', section: 'note', sectionLabel: 'Client instructions', sectionIcon: 'pi pi-comment', wide: true, emptyLabel: 'No client note provided.' },
  ],
  showDriver: true,
  actions: [
    {
      key: 'record-payment',
      label: 'Record payment',
      type: 'form',
      method: 'POST',
      path: () => '/admin/payments',
      icon: 'pi pi-wallet',
      severity: 'success',
      successSummary: 'Payment recorded',
      errorSummary: 'Payment failed',
      enabled: (b) => b.payment_status !== 'paid' && b.status !== 'cancelled',
      body: (values, booking) => ({
        payable_type: 'booking',
        payable_id: booking.id,
        ...values,
      }),
      formFields: [
        {
          key: 'method',
          label: 'Payment method',
          type: 'select',
          defaultValue: 'cash',
          required: true,
          options: [
            { label: 'Cash', value: 'cash' },
            { label: 'Bank transfer', value: 'bank_transfer' },
            { label: 'Mobile money', value: 'mobile_money' },
            { label: 'Other', value: 'other' },
          ],
        },
        { key: 'amount', label: 'Amount (blank = booking total)', type: 'money' },
        { key: 'reference', label: 'Reference', type: 'text', placeholder: 'Receipt / transfer ref' },
        { key: 'note', label: 'Note', type: 'textarea' },
      ],
    },
    {
      key: 'assign-driver',
      label: 'Assign driver',
      type: 'select-endpoint',
      method: 'POST',
      bodyKey: 'driver_id',
      path: (id) => `/admin/bookings/${id}/assign-driver`,
      optionsEndpoint: '/admin/drivers',
      collectionKey: 'drivers',
      optionLabel: 'full_name',
      optionValue: 'id',
      enabled: (b) => ['confirmed', 'driver_assigned'].includes(b.status),
    },
    {
      key: 'status',
      label: 'Advance status',
      type: 'select-transition',
      method: 'PATCH',
      bodyKey: 'status',
      path: (id) => `/admin/bookings/${id}/status`,
      next: (b) => ({ confirmed: ['active', 'cancelled'], driver_assigned: ['active', 'cancelled'], active: ['completed'] }[b.status] || []),
    },
    {
      key: 'delete-booking',
      label: 'Delete booking',
      type: 'confirm',
      method: 'DELETE',
      path: (id) => `/admin/bookings/${id}`,
      icon: 'pi pi-trash',
      severity: 'danger',
      successSummary: 'Booking deleted',
      closeAfter: true,
      enabled: (b) => b.payment_status === 'unpaid',
      disabledHelp: 'Bookings with payment history cannot be deleted.',
      confirmMessage: 'Permanently delete this unpaid booking? This cannot be undone.',
    },
  ],
};

adminResources['event-requests'].manage = {
  summary: {
    icon: 'pi pi-calendar',
    eyebrow: 'Event request overview',
    titleKey: 'request_number',
    subtitleKey: 'customer_name',
    badges: [
      { key: 'status', label: 'Status' },
      { key: 'payment_status', label: 'Payment' },
    ],
  },
  fields: [
    { key: 'id', label: 'Request ID', section: 'record', sectionLabel: 'Record & customer', sectionIcon: 'pi pi-user' },
    { key: 'user_id', label: 'Customer ID', section: 'record' },
    { key: 'event_type', label: 'Event type', section: 'event', sectionLabel: 'Event details', sectionIcon: 'pi pi-calendar-clock' },
    { key: 'event_start', label: 'Event start', type: 'date', section: 'event' },
    { key: 'event_end', label: 'Event end', type: 'date', section: 'event', emptyLabel: 'Single-day event' },
    { key: 'guest_count', label: 'Guests', section: 'event' },
    { key: 'location', label: 'Location', section: 'event', wide: true },
    { key: 'budget', label: 'Client budget', type: 'money', section: 'budget', sectionLabel: 'Budget comparison', sectionIcon: 'pi pi-wallet', highlight: true, tone: 'gold' },
    { key: 'indicative_total', label: 'Indicative total', type: 'money', value: eventIndicativeTotal, section: 'budget', highlight: true, tone: 'emerald' },
    { key: 'quoted_price', label: 'Final quote', type: 'money', section: 'budget', emptyLabel: 'Not quoted yet', highlight: true, tone: 'violet' },
    { key: 'contact_phone', label: 'Contact', section: 'contact', sectionLabel: 'Contact details', sectionIcon: 'pi pi-phone' },
    { key: 'contact_email', label: 'Email', section: 'contact', wide: true },
    { key: 'note', label: 'Client note', type: 'note', section: 'client-note', sectionLabel: 'Client instructions', sectionIcon: 'pi pi-comment', wide: true, emptyLabel: 'No client note provided.' },
    { key: 'admin_note', label: 'Internal note', type: 'note', section: 'admin-note', sectionLabel: 'Internal follow-up', sectionIcon: 'pi pi-file-edit', wide: true, emptyLabel: 'No internal note yet.' },
  ],
  itemsTable: {
    key: 'services',
    title: 'Requested services',
    columns: [
      { field: 'service_name', header: 'Service' },
      { field: 'category_name', header: 'Category' },
      { field: 'from_price_snapshot', header: 'From', type: 'money' },
      { field: 'quantity', header: 'Qty' },
    ],
  },
  itemsTables: [
    {
      key: 'artists',
      title: 'Requested artists',
      columns: [
        { field: 'artist_name', header: 'Artist' },
        { field: 'fee_snapshot', header: 'From', type: 'money' },
        { field: 'note', header: 'Note' },
      ],
    },
  ],
  actions: [
    {
      key: 'quote',
      label: 'Set quote',
      type: 'form',
      method: 'PATCH',
      path: (id) => `/admin/event-requests/${id}/quote`,
      icon: 'pi pi-tag',
      successSummary: 'Quote saved',
      errorSummary: 'Quote failed',
      enabled: (eventRequest) => ['requested', 'reviewing', 'quoted'].includes(eventRequest.status),
      body: (values) => values,
      formFields: [
        { key: 'quoted_price', label: 'Quote amount', type: 'money', required: true },
        { key: 'admin_note', label: 'Internal note', type: 'textarea' },
      ],
    },
    {
      key: 'record-payment',
      label: 'Record payment',
      type: 'form',
      method: 'POST',
      path: () => '/admin/payments',
      icon: 'pi pi-wallet',
      severity: 'success',
      successSummary: 'Payment recorded',
      errorSummary: 'Payment failed',
      enabled: (eventRequest) =>
        eventRequest.payment_status !== 'paid' && eventRequest.status !== 'cancelled' && Boolean(eventRequest.quoted_price),
      body: (values, eventRequest) => ({
        payable_type: 'event',
        payable_id: eventRequest.id,
        ...values,
      }),
      formFields: [
        {
          key: 'method',
          label: 'Payment method',
          type: 'select',
          defaultValue: 'cash',
          required: true,
          options: [
            { label: 'Cash', value: 'cash' },
            { label: 'Bank transfer', value: 'bank_transfer' },
            { label: 'Mobile money', value: 'mobile_money' },
            { label: 'Other', value: 'other' },
          ],
        },
        { key: 'amount', label: 'Amount (blank = quote)', type: 'money' },
        { key: 'reference', label: 'Reference', type: 'text' },
        { key: 'note', label: 'Note', type: 'textarea' },
      ],
    },
    {
      key: 'status',
      label: 'Advance status',
      type: 'select-transition',
      method: 'PATCH',
      bodyKey: 'status',
      path: (id) => `/admin/event-requests/${id}/status`,
      next: (eventRequest) =>
        ({
          requested: ['reviewing', 'quoted', 'cancelled'],
          reviewing: ['quoted', 'cancelled'],
          quoted: ['confirmed', 'cancelled'],
          confirmed: ['in_progress', 'cancelled'],
          in_progress: ['completed'],
        })[eventRequest.status] || [],
    },
  ],
};

adminResources.payments.manage = {
  fields: [
    { key: 'id', label: 'Payment ID' },
    { key: 'payable_type', label: 'For', type: 'enum' },
    { key: 'payable_id', label: 'Order / booking ID' },
    { key: 'amount', label: 'Amount', type: 'money' },
    { key: 'method', label: 'Method', type: 'enum' },
    { key: 'status', label: 'Status', type: 'enum' },
    { key: 'reference', label: 'Reference' },
    { key: 'marked_paid_at', label: 'Recorded', type: 'date' },
  ],
  target: {
    key: 'target',
    title: 'Target detail',
    fields: [
      { key: 'type', label: 'Type', type: 'enum' },
      { key: 'id', label: 'Target ID' },
      { key: 'number', label: 'Reference' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'user_id', label: 'Customer ID' },
      { key: 'status', label: 'Status', type: 'enum' },
      { key: 'payment_status', label: 'Payment', type: 'enum' },
      { key: 'total', label: 'Total', type: 'money' },
      { key: 'fulfillment_type', label: 'Fulfillment', type: 'enum', showWhen: isOrderTarget },
      { key: 'car_name', label: 'Car', showWhen: isBookingTarget },
      { key: 'car_category', label: 'Category', showWhen: isBookingTarget },
      { key: 'start_at', label: 'Start', type: 'date', showWhen: isBookingTarget },
      { key: 'end_at', label: 'End', type: 'date', showWhen: isBookingTarget },
      { key: 'pickup_location', label: 'Pickup', showWhen: isBookingTarget },
      { key: 'dropoff_location', label: 'Dropoff', showWhen: isBookingTarget },
      { key: 'contact_phone', label: 'Contact', showWhen: isBookingTarget },
      { key: 'event_type', label: 'Event type', type: 'enum', showWhen: isEventTarget },
      { key: 'start_at', label: 'Event date', type: 'date', showWhen: isEventTarget },
      { key: 'end_at', label: 'Event end', type: 'date', showWhen: isEventTarget },
      { key: 'pickup_location', label: 'Location', showWhen: isEventTarget },
      { key: 'contact_phone', label: 'Contact', showWhen: isEventTarget },
      { key: 'car_name', label: 'Service', showWhen: isHealthcareTarget },
      { key: 'event_type', label: 'Request type', type: 'enum', showWhen: isHealthcareTarget },
      { key: 'start_at', label: 'Date', type: 'date', showWhen: isHealthcareTarget },
      { key: 'pickup_location', label: 'Address', showWhen: isHealthcareTarget },
      { key: 'contact_phone', label: 'Contact', showWhen: isHealthcareTarget },
      { key: 'created_at', label: 'Created', type: 'date' },
    ],
    itemsTable: {
      key: 'items',
      title: 'Line items',
      columns: [
        { field: 'product_name', header: 'Product' },
        { field: 'variant_label', header: 'Variant' },
        { field: 'unit_price', header: 'Unit', type: 'money' },
        { field: 'quantity', header: 'Qty' },
        { field: 'line_total', header: 'Line total', type: 'money' },
      ],
    },
  },
  actions: [
    {
      key: 'refund',
      label: 'Refund payment',
      type: 'confirm',
      method: 'POST',
      path: (id) => `/admin/payments/${id}/refund`,
      confirmMessage: 'Refund this payment? The order/booking will be marked refunded.',
      enabled: (p) => p.status === 'paid',
    },
  ],
};

adminResources.customers.manage = {
  fields: [
    { key: 'full_name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Phone' },
    { key: 'order_count', label: 'Orders' },
    { key: 'booking_count', label: 'Bookings' },
    { key: 'is_active', label: 'Active', type: 'boolean' },
    { key: 'created_at', label: 'Joined', type: 'date' },
  ],
};

adminResources['healthcare-requests'].manage = {
  summary: {
    icon: 'pi pi-heart',
    eyebrow: 'Care request overview',
    titleKey: 'request_number',
    subtitleKey: 'customer_name',
    badges: [
      { key: 'status', label: 'Status' },
      { key: 'payment_status', label: 'Payment' },
    ],
  },
  fields: [
    { key: 'id', label: 'Request ID', section: 'record', sectionLabel: 'Record & customer', sectionIcon: 'pi pi-user' },
    { key: 'user_id', label: 'Customer ID', section: 'record', emptyLabel: 'Walk-in customer' },
    { key: 'request_type', label: 'Type', type: 'enum', section: 'service', sectionLabel: 'Care service', sectionIcon: 'pi pi-heart' },
    { key: 'service_name', label: 'Service', section: 'service', wide: true },
    { key: 'category_name', label: 'Category', section: 'service' },
    { key: 'patient_name', label: 'Patient', section: 'patient', sectionLabel: 'Patient details', sectionIcon: 'pi pi-user-plus' },
    { key: 'patient_age', label: 'Age', section: 'patient', emptyLabel: 'Not provided' },
    { key: 'patient_gender', label: 'Gender', type: 'enum', section: 'patient', emptyLabel: 'Not provided' },
    { key: 'preferred_at', label: 'Preferred time', type: 'date', section: 'visit', sectionLabel: 'Visit details', sectionIcon: 'pi pi-calendar-clock', showWhen: (req) => req.request_type === 'consultation' },
    { key: 'start_at', label: 'Coverage start', type: 'date', section: 'visit', sectionLabel: 'Coverage period', sectionIcon: 'pi pi-calendar-clock', showWhen: (req) => req.request_type === 'package' },
    { key: 'end_at', label: 'Coverage end', type: 'date', section: 'visit', showWhen: (req) => req.request_type === 'package' },
    { key: 'address', label: 'Care address', section: 'visit', wide: true },
    { key: 'symptoms', label: 'Reason / symptoms', type: 'note', section: 'reason', sectionLabel: 'Care request details', sectionIcon: 'pi pi-file-edit', wide: true, emptyLabel: 'No symptoms or reason provided.' },
    { key: 'price_snapshot', label: 'Indicative price', type: 'money', section: 'pricing', sectionLabel: 'Pricing', sectionIcon: 'pi pi-wallet', highlight: true, tone: 'gold', showWhen: (req) => req.request_type === 'consultation' },
    { key: 'price_snapshot', label: 'Package price', type: 'money', section: 'pricing', sectionLabel: 'Pricing', sectionIcon: 'pi pi-wallet', highlight: true, tone: 'gold', showWhen: (req) => req.request_type === 'package' },
    { key: 'quoted_price', label: 'Final quote', type: 'money', section: 'pricing', highlight: true, tone: 'emerald', emptyLabel: 'Not quoted yet' },
    { key: 'paid_at', label: 'Paid at', type: 'date', section: 'pricing', showWhen: (req) => Boolean(req.paid_at) },
    { key: 'contact_phone', label: 'Contact', section: 'contact', sectionLabel: 'Contact details', sectionIcon: 'pi pi-phone' },
    { key: 'contact_email', label: 'Email', section: 'contact', wide: true, emptyLabel: 'No email provided' },
    { key: 'note', label: 'Client note', type: 'note', section: 'client-note', sectionLabel: 'Client instructions', sectionIcon: 'pi pi-comment', wide: true, emptyLabel: 'No client note provided.' },
    { key: 'admin_note', label: 'Internal note', type: 'note', section: 'admin-note', sectionLabel: 'Internal follow-up', sectionIcon: 'pi pi-file-edit', wide: true, emptyLabel: 'No internal note yet.' },
  ],
  itemsTable: {
    key: 'staff',
    title: 'Package staff needed',
    showWhen: (req) => req.request_type === 'package',
    columns: [
      { field: 'practitioner_type', header: 'Role', type: 'enum' },
      { field: 'quantity', header: 'Qty' },
    ],
  },
  nested: [
    {
      key: 'assignments',
      title: 'Assigned practitioners',
      singular: 'assignment',
      collectionKey: 'assignments',
      addLabel: 'Assign practitioner',
      addPath: (id) => `/admin/healthcare/requests/${id}/assignments`,
      removePath: (row) => `/admin/healthcare/assignments/${row.id}`,
      columns: [
        { field: 'practitioner_name', header: 'Practitioner' },
        { field: 'practitioner_type', header: 'Role', type: 'enum' },
        { field: 'note', header: 'Note' },
      ],
      formFields: [
        {
          key: 'practitioner_id',
          label: 'Practitioner',
          type: 'select',
          required: true,
          options: [],
          optionsEndpoint: '/admin/practitioners',
          collectionKey: 'practitioners',
          optionLabel: 'full_name',
          optionValue: 'id',
        },
        { key: 'note', label: 'Note', type: 'text' },
      ],
    },
  ],
  actionsDescription: 'Set the quote, assign care staff, record payment, or update status.',
  actions: [
    {
      key: 'quote',
      label: 'Set quote',
      type: 'form',
      method: 'PATCH',
      path: (id) => `/admin/healthcare/requests/${id}/quote`,
      icon: 'pi pi-tag',
      successSummary: 'Quote saved',
      errorSummary: 'Quote failed',
      enabled: (req) => ['requested', 'reviewing', 'quoted'].includes(req.status),
      body: (values) => values,
      formFields: [
        { key: 'quoted_price', label: 'Quote amount', type: 'money', required: true },
        { key: 'admin_note', label: 'Internal note', type: 'textarea' },
      ],
    },
    {
      key: 'record-payment',
      label: 'Record payment',
      type: 'form',
      method: 'POST',
      path: () => '/admin/payments',
      icon: 'pi pi-wallet',
      severity: 'success',
      successSummary: 'Payment recorded',
      errorSummary: 'Payment failed',
      enabled: (req) => req.payment_status !== 'paid' && req.status !== 'cancelled' && Boolean(req.quoted_price),
      body: (values, req) => ({ payable_type: 'healthcare', payable_id: req.id, ...values }),
      formFields: [
        {
          key: 'method',
          label: 'Payment method',
          type: 'select',
          defaultValue: 'cash',
          required: true,
          options: [
            { label: 'Cash', value: 'cash' },
            { label: 'Bank transfer', value: 'bank_transfer' },
            { label: 'Mobile money', value: 'mobile_money' },
            { label: 'Other', value: 'other' },
          ],
        },
        { key: 'amount', label: 'Amount (blank = quote)', type: 'money' },
        { key: 'reference', label: 'Reference', type: 'text' },
        { key: 'note', label: 'Note', type: 'textarea' },
      ],
    },
    {
      key: 'status',
      label: 'Advance status',
      type: 'select-transition',
      method: 'PATCH',
      bodyKey: 'status',
      path: (id) => `/admin/healthcare/requests/${id}/status`,
      next: (req) =>
        ({
          requested: ['reviewing', 'quoted', 'cancelled'],
          reviewing: ['quoted', 'cancelled'],
          quoted: ['confirmed', 'cancelled'],
          confirmed: ['assigned', 'in_progress', 'cancelled'],
          assigned: ['in_progress', 'cancelled'],
          in_progress: ['completed'],
        })[req.status] || [],
    },
  ],
};
