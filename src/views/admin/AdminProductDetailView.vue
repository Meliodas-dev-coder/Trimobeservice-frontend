<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import AdminResourceDialog from '@/components/admin/AdminResourceDialog.vue';
import DynamicSpecFields from '@/components/admin/DynamicSpecFields.vue';
import LocalizedFieldControl from '@/components/admin/LocalizedFieldControl.vue';
import { api } from '@/api/client';
import { loadFieldOptions, serializeForm, uploadImage } from '@/api/resources';
import { adminResources } from '@/data/adminResources';
import { useAdminI18n } from '@/i18n/admin';
import { formatMGA } from '@/utils/format';
import { cloneTranslations, ensureTranslationBucket } from '@/utils/localized';
import { statusSeverity } from '@/utils/status';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const { enumLabel, t, translateConfig } = useAdminI18n();

const productsResource = computed(() => translateConfig(adminResources.products));

const isNew = computed(() => route.name === 'admin-product-new');
const productId = computed(() => Number(route.params.id));
// When created from a Tech/Fashion section, scope the category/brand pickers to
// that department (passed as ?department=).
const department = computed(() => route.query.department || '');

const product = ref(null);
const loading = ref(false);
const saving = ref(false);
const uploading = ref(false);
const errors = ref({});
const draft = reactive({});
const optionsMap = reactive({});
const templates = ref([]);

const variantDialogOpen = ref(false);
const editingVariant = ref(null);
const variantSaving = ref(false);
const variantErrors = ref({});

const coverInput = ref(null);
const galleryInput = ref(null);
const variantInput = ref(null);
const pendingVariant = ref(null);

// Basics = every product form field except the dynamic attributes control.
const basicsFields = computed(() =>
  (productsResource.value.formFields || []).filter(
    (field) => field.type !== 'attributes' && !field.createOnly && field.persist !== false,
  ),
);
const localizedBasicsFields = computed(() => basicsFields.value.filter((field) => field.localized));
const variantFields = computed(() => productsResource.value.variantForm || []);

const selectedCategory = computed(
  () => (optionsMap.category_id || []).find((option) => option.value === draft.category_id) || null,
);
const activeTemplate = computed(() => {
  const key = selectedCategory.value?.item?.template_key || '';
  return templates.value.find((tpl) => tpl.key === key) || null;
});
const specFields = computed(() => activeTemplate.value?.product_fields || []);

const productImages = computed(() => (product.value?.images || []).filter((img) => !img.variant_id));
const coverImage = computed(() => productImages.value.find((img) => img.is_primary) || null);
const galleryImages = computed(() => productImages.value.filter((img) => !img.is_primary));
const variants = computed(() => product.value?.variants || []);

const heroImage = computed(() => {
  if (coverImage.value) {
    return coverImage.value.url;
  }
  const variantImg = (product.value?.images || []).find((img) => img.variant_id);
  return variantImg?.url || productImages.value[0]?.url || '';
});

const priceRange = computed(() => {
  const prices = variants.value.filter((v) => v.is_active).map((v) => Number(v.price || 0));
  if (!prices.length) {
    return '—';
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMGA(min) : `${formatMGA(min)} – ${formatMGA(max)}`;
});

const canSave = computed(() => {
  if (!draft.name || !draft.category_id) {
    return false;
  }
  return specFields.value.every((field) => {
    if (!field.required) {
      return true;
    }
    const value = draft.attributes?.[field.key];
    return value !== null && value !== undefined && value !== '';
  });
});

function optionsFor(field) {
  return optionsMap[field.key] || field.options || [];
}

function fieldDefault(field) {
  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }
  if (field.type === 'number' || field.type === 'money') {
    return null;
  }
  return '';
}

function cloneAttributes(raw) {
  if (!raw) {
    return {};
  }
  if (typeof raw === 'string') {
    try {
      return { ...JSON.parse(raw) };
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? { ...raw } : {};
}

function resetDraft() {
  Object.keys(draft).forEach((key) => delete draft[key]);
  for (const field of basicsFields.value) {
    const raw = product.value ? product.value[field.key] : undefined;
    if (raw !== undefined && raw !== null) {
      draft[field.key] = field.type === 'money' || field.type === 'number' ? Number(raw) : raw;
    } else {
      draft[field.key] = fieldDefault(field);
    }
  }
  if (localizedBasicsFields.value.length) {
    draft.translations = cloneTranslations(product.value?.translations);
    localizedBasicsFields.value.forEach((field) => ensureTranslationBucket(draft.translations, field.key));
  }
  draft.attributes = cloneAttributes(product.value?.attributes);
}

function setTranslation({ field, locale, value }) {
  if (!draft.translations) {
    draft.translations = {};
  }
  ensureTranslationBucket(draft.translations, field)[locale] = value;
}

async function loadOptions() {
  for (const field of basicsFields.value) {
    if (!field.optionsEndpoint) {
      continue;
    }
    const scoped = field.scopeByDepartment && department.value;
    try {
      optionsMap[field.key] = await loadFieldOptions(field, scoped ? { department: department.value } : {});
    } catch {
      optionsMap[field.key] = [];
    }
  }
}

async function loadTemplates() {
  try {
    const data = await api.get('/admin/product-templates');
    templates.value = data?.templates || [];
  } catch {
    templates.value = [];
  }
}

async function load() {
  if (isNew.value) {
    product.value = null;
    resetDraft();
    return;
  }
  loading.value = true;
  try {
    const data = await api.get(`/admin/products/${productId.value}`);
    product.value = data?.product || null;
    resetDraft();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not load product'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  errors.value = {};
  try {
    const body = serializeForm(productsResource.value.formFields, draft);
    if (isNew.value) {
      const data = await api.post('/admin/products', body);
      const created = data?.product;
      toast.add({ severity: 'success', summary: t('Product created'), life: 2500 });
      router.replace({ name: 'admin-product-detail', params: { id: created.id } });
    } else {
      const data = await api.put(`/admin/products/${productId.value}`, body);
      product.value = data?.product || product.value;
      resetDraft();
      toast.add({ severity: 'success', summary: t('Product saved'), life: 2500 });
    }
  } catch (err) {
    if (err?.details) {
      errors.value = err.details;
    }
    toast.add({ severity: 'error', summary: t('Save failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    saving.value = false;
  }
}

// --- variants ---

function openVariantCreate() {
  editingVariant.value = null;
  variantErrors.value = {};
  variantDialogOpen.value = true;
}

function openVariantEdit(variant) {
  // Seed the dialog's image field with the variant's current image so an
  // unchanged submit doesn't re-upload/replace it.
  editingVariant.value = { ...variant, variant_image_url: variantImage(variant) };
  variantErrors.value = {};
  variantDialogOpen.value = true;
}

async function submitVariant(values) {
  variantSaving.value = true;
  variantErrors.value = {};
  try {
    const body = serializeForm(variantFields.value, values);
    let variant;
    if (editingVariant.value) {
      const data = await api.put(`/admin/variants/${editingVariant.value.id}`, body);
      variant = data?.variant;
    } else {
      const data = await api.post(`/admin/products/${productId.value}/variants`, body);
      variant = data?.variant;
    }
    await syncVariantImage(variant, values.variant_image_url);
    toast.add({ severity: 'success', summary: t('Variant saved'), life: 2500 });
    variantDialogOpen.value = false;
    await load();
  } catch (err) {
    if (err?.details) {
      variantErrors.value = err.details;
    }
    toast.add({ severity: 'error', summary: t('Save failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    variantSaving.value = false;
  }
}

// Attach/replace/remove a variant's image only when it actually changed. `newUrl`
// is the (possibly just-uploaded) URL from the dialog's image field.
async function syncVariantImage(variant, newUrl) {
  if (!variant) {
    return;
  }
  const original = editingVariant.value?.variant_image_url || '';
  const url = newUrl || '';
  if (url === original) {
    return;
  }
  const existing = (product.value?.images || []).filter((img) => img.variant_id === variant.id);
  for (const img of existing) {
    await api.del(`/admin/images/${img.id}`);
  }
  if (url) {
    await api.post(`/admin/products/${productId.value}/images`, {
      url,
      variant_id: variant.id,
      is_primary: true,
      alt_text: variant.label || product.value?.name || null,
    });
  }
}

function confirmVariantDelete(variant) {
  confirm.require({
    header: t('Delete variant'),
    message: t('Delete this variant? This cannot be undone.'),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('Delete'),
    rejectLabel: t('Cancel'),
    accept: async () => {
      try {
        await api.del(`/admin/variants/${variant.id}`);
        toast.add({ severity: 'success', summary: t('Deleted'), life: 2500 });
        await load();
      } catch (err) {
        toast.add({ severity: 'error', summary: t('Delete failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
      }
    },
  });
}

function variantImage(variant) {
  return (product.value?.images || []).find((img) => img.variant_id === variant.id)?.url || '';
}

// --- images ---

// Called from script scope where the refs are the actual <input> elements.
function pickCover() {
  coverInput.value?.click();
}

function pickGallery() {
  galleryInput.value?.click();
}

async function addImage(file, body) {
  uploading.value = true;
  try {
    const { url } = await uploadImage(file);
    await api.post(`/admin/products/${productId.value}/images`, { url, ...body });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Image failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    uploading.value = false;
  }
}

function onCoverChange(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) {
    addImage(file, { is_primary: true, alt_text: product.value?.name || null });
  }
}

function onGalleryChange(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) {
    addImage(file, { is_primary: false, alt_text: product.value?.name || null });
  }
}

async function onVariantImageChange(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  const variant = pendingVariant.value;
  pendingVariant.value = null;
  if (!file || !variant) {
    return;
  }
  uploading.value = true;
  try {
    const { url } = await uploadImage(file);
    // Replace: drop the variant's existing images, then attach the new one.
    const existing = (product.value?.images || []).filter((img) => img.variant_id === variant.id);
    for (const img of existing) {
      await api.del(`/admin/images/${img.id}`);
    }
    await api.post(`/admin/products/${productId.value}/images`, {
      url,
      variant_id: variant.id,
      is_primary: true,
      alt_text: variant.label || product.value?.name || null,
    });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Image failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    uploading.value = false;
  }
}

function pickVariantImage(variant) {
  pendingVariant.value = variant;
  variantInput.value?.click();
}

async function setAsCover(img) {
  try {
    await api.put(`/admin/images/${img.id}`, { is_primary: true });
    toast.add({ severity: 'success', summary: t('Cover updated'), life: 2500 });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Save failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  }
}

function confirmImageDelete(img) {
  confirm.require({
    header: t('Delete image'),
    message: t('Delete this image?'),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('Delete'),
    rejectLabel: t('Cancel'),
    accept: async () => {
      try {
        await api.del(`/admin/images/${img.id}`);
        toast.add({ severity: 'success', summary: t('Image deleted'), life: 2500 });
        await load();
      } catch (err) {
        toast.add({ severity: 'error', summary: t('Delete failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
      }
    },
  });
}

function variantTitle(variant) {
  if (variant.label) {
    return variant.label;
  }
  const attrs = variant.attributes || {};
  const parts = Object.values(attrs).filter((v) => v !== null && v !== '' && typeof v !== 'boolean');
  return parts.length ? parts.join(' · ') : variant.sku;
}

function goBack() {
  router.push({ name: 'admin-products' });
}

onMounted(() => {
  loadOptions();
  loadTemplates();
  load();
});

watch(
  () => [route.name, route.params.id],
  () => load(),
);
</script>

<template>
  <section class="product-detail">
    <div class="product-detail__top">
      <Button icon="pi pi-arrow-left" :label="t('Products')" severity="secondary" outlined @click="goBack" />
      <Button
        :label="isNew ? t('Create product') : t('Save changes')"
        icon="pi pi-check"
        :loading="saving"
        :disabled="!canSave"
        @click="save"
      />
    </div>

    <div v-if="loading && !product" class="product-detail__loading">{{ t('Loading product...') }}</div>

    <template v-else>
      <section v-if="!isNew && product" class="product-hero">
        <div class="product-hero__image">
          <img v-if="heroImage" :src="heroImage" :alt="product.name" />
          <i v-else class="pi pi-mobile" />
        </div>
        <div class="product-hero__content">
          <p>{{ t('Product') }}</p>
          <div class="product-hero__title">
            <h2>{{ product.name }}</h2>
            <Tag :value="product.is_active ? t('Available') : t('Unavailable')" :severity="statusSeverity(product.is_active)" />
          </div>
          <div class="product-hero__meta">
            <span>{{ product.category?.name || t('No category') }}</span>
            <span v-if="product.brand">{{ product.brand.name }}</span>
            <span>{{ priceRange }}</span>
            <span>{{ t('{n} variants', { n: variants.length }) }}</span>
          </div>
        </div>
      </section>

      <!-- Basics + specs -->
      <section class="panel">
        <div class="panel__head">
          <div>
            <h3>{{ t('Product details') }}</h3>
            <p>{{ t('Name, category, brand, and category-specific specs.') }}</p>
          </div>
        </div>

        <div class="basics-form">
          <label
            v-for="field in basicsFields"
            :key="field.key"
            class="basics-form__field"
            :class="{ 'basics-form__field--wide': field.localized || field.type === 'textarea' }"
          >
            <span>{{ field.label }}<small v-if="field.required">*</small></span>

            <LocalizedFieldControl
              v-if="field.localized"
              v-model="draft[field.key]"
              :field="field"
              :translations="draft.translations"
              @update:translation="setTranslation"
            />
            <Textarea v-else-if="field.type === 'textarea'" v-model="draft[field.key]" :placeholder="field.placeholder" rows="3" autoResize />
            <InputNumber v-else-if="field.type === 'money'" v-model="draft[field.key]" :min="0" :useGrouping="true" suffix=" MGA" fluid />
            <InputNumber v-else-if="field.type === 'number'" v-model="draft[field.key]" :useGrouping="false" fluid />
            <Select
              v-else-if="field.type === 'select'"
              v-model="draft[field.key]"
              :options="optionsFor(field)"
              optionLabel="label"
              optionValue="value"
              :placeholder="field.placeholder || t('Choose {field}', { field: field.label.toLowerCase() })"
              :showClear="!field.required"
              fluid
            />
            <InputText v-else v-model="draft[field.key]" :placeholder="field.placeholder" />

            <small v-if="errors[field.key]" class="basics-form__error">{{ t(errors[field.key]) }}</small>
          </label>
        </div>

        <div class="specs-block">
          <p class="specs-block__title">{{ t('Specifications') }}</p>
          <p v-if="!draft.category_id" class="specs-block__hint">{{ t('Pick a category to see its spec fields.') }}</p>
          <p v-else-if="!specFields.length" class="specs-block__hint">{{ t('This type has no extra specs.') }}</p>
          <DynamicSpecFields v-else :fields="specFields" :model-value="draft.attributes" :errors="errors" />
        </div>
      </section>

      <p v-if="isNew" class="product-detail__note">
        {{ t('Save the product first — then you can add its variants and images.') }}
      </p>

      <!-- Variants -->
      <section v-if="!isNew && product" class="panel">
        <div class="panel__head">
          <div>
            <h3>{{ t('Variants') }}</h3>
            <p>{{ t('Each variant is a sellable SKU with its own price, stock, and image.') }}</p>
          </div>
          <Button :label="t('Add variant')" icon="pi pi-plus" @click="openVariantCreate" />
        </div>

        <DataTable :value="variants" responsiveLayout="scroll" tableStyle="min-width: 760px">
          <Column :header="t('Image')" style="width: 92px">
            <template #body="{ data }">
              <button type="button" class="variant-thumb" :title="t('Set variant image')" @click="pickVariantImage(data)">
                <img v-if="variantImage(data)" :src="variantImage(data)" :alt="data.sku" />
                <i v-else class="pi pi-camera" />
              </button>
            </template>
          </Column>
          <Column field="sku" :header="t('SKU')" />
          <Column :header="t('Variant')">
            <template #body="{ data }">{{ variantTitle(data) }}</template>
          </Column>
          <Column :header="t('Price')">
            <template #body="{ data }"><span class="cell-money">{{ formatMGA(Number(data.price || 0)) }}</span></template>
          </Column>
          <Column field="stock_quantity" :header="t('Stock')" />
          <Column :header="t('Availability')">
            <template #body="{ data }">
              <Tag :value="data.is_active ? t('Available') : t('Unavailable')" :severity="statusSeverity(data.is_active)" />
            </template>
          </Column>
          <Column :header="t('Actions')" style="width: 7rem">
            <template #body="{ data }">
              <div class="row-actions">
                <Button icon="pi pi-pencil" severity="secondary" text rounded :aria-label="t('Edit')" @click="openVariantEdit(data)" />
                <Button icon="pi pi-trash" severity="danger" text rounded :aria-label="t('Delete')" @click="confirmVariantDelete(data)" />
              </div>
            </template>
          </Column>
          <template #empty><div class="empty-state">{{ t('No variants yet.') }}</div></template>
        </DataTable>
      </section>

      <!-- Images -->
      <section v-if="!isNew && product" class="panel">
        <div class="panel__head">
          <div>
            <h3>{{ t('Images') }}</h3>
            <p>{{ t('A cover plus gallery shots. No cover set falls back to the first variant image.') }}</p>
          </div>
          <div class="panel__head-actions">
            <Button :label="t('Upload cover')" icon="pi pi-star" severity="secondary" outlined :loading="uploading" @click="pickCover" />
            <Button :label="t('Add image')" icon="pi pi-plus" :loading="uploading" @click="pickGallery" />
          </div>
        </div>

        <div class="image-grid">
          <article v-if="coverImage" class="image-item image-item--cover">
            <img :src="coverImage.url" :alt="product.name" />
            <Tag :value="t('Cover')" severity="success" />
            <Button icon="pi pi-trash" severity="danger" text rounded :aria-label="t('Delete image')" @click="confirmImageDelete(coverImage)" />
          </article>

          <article v-for="img in galleryImages" :key="img.id" class="image-item">
            <img :src="img.url" :alt="img.alt_text || product.name" />
            <Button :label="t('Set as cover')" icon="pi pi-star" size="small" severity="secondary" text @click="setAsCover(img)" />
            <Button icon="pi pi-trash" severity="danger" text rounded :aria-label="t('Delete image')" @click="confirmImageDelete(img)" />
          </article>

          <div v-if="!productImages.length" class="empty-state">{{ t('No product images yet.') }}</div>
        </div>
      </section>
    </template>

    <input ref="coverInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden-file" @change="onCoverChange" />
    <input ref="galleryInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden-file" @change="onGalleryChange" />
    <input ref="variantInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden-file" @change="onVariantImageChange" />

    <AdminResourceDialog
      v-model:visible="variantDialogOpen"
      :title="editingVariant ? t('Edit variant') : t('Add variant')"
      :fields="variantFields"
      :initial="editingVariant"
      :templateKey="product?.category?.template_key || ''"
      :loading="variantSaving"
      :errors="variantErrors"
      @submit="submitVariant"
    />
  </section>
</template>

<style scoped>
.product-detail {
  display: grid;
  gap: 18px;
}

.product-detail__top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.product-detail__loading,
.empty-state {
  padding: 24px;
  color: var(--tm-muted);
  font-weight: 800;
}

.product-detail__note {
  margin: 0;
  padding: 14px 16px;
  border: 1px dashed var(--tm-border);
  border-radius: 8px;
  color: var(--tm-muted);
  font-weight: 700;
}

.product-hero {
  display: grid;
  grid-template-columns: minmax(200px, 300px) 1fr;
  gap: 20px;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.product-hero__image {
  min-height: 200px;
  background: var(--tm-surface-soft);
}

.product-hero__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.product-hero__image i {
  display: grid;
  min-height: 200px;
  place-items: center;
  color: var(--tm-gold);
  font-size: 3rem;
}

.product-hero__content {
  display: grid;
  align-content: center;
  gap: 12px;
  padding: 22px 20px 22px 0;
}

.product-hero__content p {
  margin: 0;
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.product-hero__title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.product-hero__title h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  line-height: 1;
}

.product-hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
}

.product-hero__meta span {
  padding: 7px 10px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  background: var(--tm-surface-soft);
  color: var(--tm-muted);
  font-size: 0.85rem;
  font-weight: 800;
}

.panel {
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  border-bottom: 1px solid var(--tm-border);
}

.panel__head-actions {
  display: flex;
  gap: 8px;
}

.panel__head h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.05rem;
}

.panel__head p {
  margin: 4px 0 0;
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 700;
}

.basics-form {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  padding: 16px;
}

.basics-form__field {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.basics-form__field--wide {
  grid-column: 1 / -1;
}

.basics-form__field span {
  color: var(--tm-muted);
  font-size: 0.84rem;
  font-weight: 820;
}

.basics-form__field span small {
  color: var(--tm-coral);
}

.basics-form__error {
  color: var(--tm-coral);
  font-size: 0.78rem;
  font-weight: 700;
}

.basics-form__field :deep(.p-inputtext),
.basics-form__field :deep(.p-inputnumber),
.basics-form__field :deep(.p-inputnumber-input),
.basics-form__field :deep(.p-select),
.basics-form__field :deep(.p-textarea) {
  width: 100%;
}

.specs-block {
  padding: 4px 16px 18px;
}

.specs-block__title {
  margin: 0 0 12px;
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.specs-block__hint {
  margin: 0;
  color: var(--tm-muted);
  font-weight: 700;
}

.variant-thumb {
  display: grid;
  place-items: center;
  width: 60px;
  height: 46px;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 6px;
  background: var(--tm-surface-soft);
  cursor: pointer;
}

.variant-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.variant-thumb i {
  color: var(--tm-muted);
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

.image-grid {
  display: grid;
  gap: 12px;
  padding: 16px;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
}

.image-item {
  position: relative;
  display: grid;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.image-item--cover {
  border-color: var(--tm-emerald);
}

.image-item img {
  width: 100%;
  height: 130px;
  object-fit: cover;
  border-radius: 6px;
}

.image-item :deep(.p-tag) {
  position: absolute;
  top: 16px;
  left: 16px;
}

.panel :deep(.p-datatable-thead > tr > th) {
  background: var(--tm-surface-soft);
  color: var(--tm-muted);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.panel :deep(.p-datatable-tbody > tr > td) {
  border-color: var(--tm-border);
}

.hidden-file {
  display: none;
}

@media (max-width: 860px) {
  .product-hero,
  .basics-form {
    grid-template-columns: 1fr;
  }

  .product-hero__content {
    padding: 0 18px 18px;
  }
}

@media (max-width: 680px) {
  .product-detail__top,
  .panel__head {
    align-items: stretch;
    flex-direction: column;
  }

  .product-detail__top .p-button,
  .panel__head-actions .p-button {
    width: 100%;
  }
}
</style>
