<script setup>
import { computed } from 'vue';
import Paginator from 'primevue/paginator';

import { useAdminI18n } from '@/i18n/admin';
import { formatDate, formatMGA } from '@/utils/format';
import { localizedValue } from '@/utils/localized';
import { statusSeverity } from '@/utils/status';

const props = defineProps({
  rows: { type: Array, default: () => [] },
  resource: { type: Object, required: true },
  rowKey: { type: String, default: 'id' },
  loading: { type: Boolean, default: false },
  totalRecords: { type: Number, default: 0 },
  first: { type: Number, default: 0 },
  rowsPerPage: { type: Number, default: 20 },
  rowsPerPageOptions: { type: Array, default: () => [10, 20, 50] },
  hasManage: { type: Boolean, default: false },
  canDuplicate: { type: Boolean, default: false },
  canEdit: { type: Boolean, default: false },
  canRemove: { type: Boolean, default: false },
});

const emit = defineEmits(['manage', 'duplicate', 'edit', 'remove', 'page']);
const { enumLabel, language, localeCode, t } = useAdminI18n();

const spec = computed(() => props.resource.cardView || {});
const layout = computed(() => spec.value.layout || 'list');
const imageField = computed(() => spec.value.imageField || 'primary_image_url');
const imageFit = computed(() => spec.value.imageFit || 'cover');
const placeholderIcon = computed(() => spec.value.placeholderIcon || 'pi pi-image');
const titleField = computed(() => spec.value.titleField || 'name');
const subtitleField = computed(() => spec.value.subtitleField || 'slug');
const badgeField = computed(() => spec.value.badgeField || 'status');
const badgeType = computed(() => spec.value.badgeType || 'enum');
const details = computed(() => spec.value.details || props.resource.columns || []);
const total = computed(() => props.totalRecords || props.rows.length);
const showActions = computed(() => props.hasManage || props.canDuplicate || props.canEdit || props.canRemove);

function rowID(row) {
  return row[props.rowKey];
}

function canRemoveRow(row) {
  return props.canRemove && (!props.resource.removeWhen || props.resource.removeWhen(row));
}

function rawValue(row, field) {
  const fieldName = field.field || field.key;
  return field.localized || isLocalizedField(fieldName)
    ? localizedValue(row, fieldName, language.value)
    : row[fieldName];
}

function title(row) {
  return displayField(row, titleField.value) || props.resource.singular;
}

function subtitle(row) {
  const value = displayField(row, subtitleField.value);
  return value || `#${rowID(row)}`;
}

function imageSrc(row) {
  return row[imageField.value] || '';
}

function imageAlt(row) {
  return row[spec.value.imageAltField] || title(row);
}

function isLocalizedField(fieldName) {
  return Boolean((props.resource.formFields || []).find((field) => field.key === fieldName && field.localized));
}

function displayField(row, fieldName) {
  return isLocalizedField(fieldName) ? localizedValue(row, fieldName, language.value) : row[fieldName];
}

function badgeVisible(row) {
  const value = row[badgeField.value];
  if (badgeType.value === 'boolean') {
    return typeof value === 'boolean';
  }
  return value !== null && value !== undefined && value !== '';
}

function badgeLabel(row) {
  if (badgeType.value === 'boolean') {
    return row[badgeField.value]
      ? t(spec.value.badgeTrueLabel || 'Available')
      : t(spec.value.badgeFalseLabel || 'Unavailable');
  }
  return enumLabel(row[badgeField.value]);
}

function displayValue(row, field) {
  if (typeof field.format === 'function') {
    return field.format(row);
  }
  const value = rawValue(row, field);
  if (field.type === 'money') {
    return formatMGA(Number(value || 0));
  }
  if (field.type === 'date') {
    return formatDate(value, localeCode.value);
  }
  if (field.type === 'boolean') {
    return value ? field.trueLabel || t('Yes') : field.falseLabel || t('No');
  }
  if (field.type === 'status' || field.type === 'enum') {
    return value ? enumLabel(value) : '-';
  }
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  return value;
}
</script>

<template>
  <div class="card-view" :class="`card-view--${layout}`">
    <div v-if="loading" class="card-view__empty">
      <i class="pi pi-spin pi-spinner" />
      <span>{{ t('Loading...') }}</span>
    </div>

    <div v-else-if="!rows.length" class="card-view__empty">
      <i class="pi pi-inbox" />
      <span>{{ t('No records found.') }}</span>
    </div>

    <div v-else class="card-view__list">
      <article v-for="row in rows" :key="rowID(row)" class="card-view__item">
        <figure class="card-view__media">
          <img
            v-if="imageSrc(row)"
            :src="imageSrc(row)"
            :alt="imageAlt(row)"
            :class="{ 'is-contain': imageFit === 'contain' }"
            loading="lazy"
          />
          <span v-else class="card-view__placeholder">
            <i :class="placeholderIcon" />
          </span>
        </figure>

        <div class="card-view__content">
          <div class="card-view__head">
            <div>
              <p>{{ subtitle(row) }}</p>
              <h3>{{ title(row) }}</h3>
            </div>
            <Tag
              v-if="badgeVisible(row)"
              :value="badgeLabel(row)"
              :severity="statusSeverity(row[badgeField])"
            />
          </div>

          <dl class="card-view__details">
            <div v-for="field in details" :key="field.field || field.key">
              <dt>{{ field.label || field.header }}</dt>
              <dd>{{ displayValue(row, field) }}</dd>
            </div>
          </dl>

          <div v-if="showActions" class="card-view__actions">
            <Button
              v-if="hasManage"
              :label="t('Manage')"
              icon="pi pi-window-maximize"
              severity="secondary"
              size="small"
              @click="emit('manage', row)"
            />
            <Button
              v-if="canDuplicate"
              :label="t(resource.duplicate?.actionLabel || 'Duplicate')"
              icon="pi pi-copy"
              severity="secondary"
              outlined
              size="small"
              @click="emit('duplicate', row)"
            />
            <Button
              v-if="canEdit"
              :label="t('Edit')"
              icon="pi pi-pencil"
              severity="secondary"
              outlined
              size="small"
              @click="emit('edit', row)"
            />
            <Button
              v-if="canRemove"
              :label="t('Delete')"
              icon="pi pi-trash"
              severity="danger"
              outlined
              size="small"
              :disabled="!canRemoveRow(row)"
              :title="canRemoveRow(row) ? t('Delete') : t(resource.removeDisabledHelp || 'This record cannot be deleted.')"
              @click="emit('remove', row)"
            />
          </div>
        </div>
      </article>
    </div>

    <Paginator
      v-if="total > rowsPerPage"
      :first="first"
      :rows="rowsPerPage"
      :totalRecords="total"
      :rowsPerPageOptions="rowsPerPageOptions"
      @page="emit('page', $event)"
    />
  </div>
</template>

<style scoped>
.card-view {
  display: grid;
  gap: 0;
}

.card-view__list {
  display: grid;
  gap: 0;
}

.card-view__item {
  display: flex;
  gap: 16px;
  padding: 16px;
  border-bottom: 1px solid var(--tm-border);
  background: var(--tm-surface);
}

.card-view--grid .card-view__list {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  padding: 16px;
}

.card-view--grid .card-view__item {
  min-width: 0;
  overflow: hidden;
  flex-direction: column;
  gap: 0;
  padding: 0;
  border: 1px solid var(--tm-border);
  border-radius: 17px;
  background: var(--tm-surface);
  box-shadow: 0 10px 28px rgba(37, 31, 20, 0.05);
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}

.card-view--grid .card-view__item:last-child {
  border-bottom: 1px solid var(--tm-border);
}

.card-view--grid .card-view__item:hover {
  border-color: rgba(12, 155, 128, 0.38);
  box-shadow: var(--tm-shadow-hover);
  transform: translateY(-3px);
}

.card-view__item:last-child {
  border-bottom: 0;
}

.card-view__media {
  display: grid;
  flex: 0 0 190px;
  width: 190px;
  height: 132px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.card-view__media img,
.card-view__placeholder {
  width: 100%;
  height: 100%;
}

.card-view__media img {
  display: block;
  object-fit: cover;
}

.card-view__media img.is-contain {
  padding: 12px;
  object-fit: contain;
}

.card-view--grid .card-view__media {
  width: 100%;
  height: 190px;
  flex-basis: auto;
  border: 0;
  border-bottom: 1px solid var(--tm-border);
  border-radius: 0;
  background:
    radial-gradient(circle at 85% 0%, rgba(201, 146, 44, 0.1), transparent 44%),
    var(--tm-surface-soft);
}

.card-view__placeholder {
  display: grid;
  place-items: center;
  color: var(--tm-muted);
  font-size: 1.4rem;
}

.card-view__content {
  display: grid;
  flex: 1;
  gap: 12px;
  min-width: 0;
}

.card-view--grid .card-view__content {
  flex: 1;
  padding: 16px;
}

.card-view__head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.card-view__head p,
.card-view__head h3 {
  margin: 0;
}

.card-view__head p {
  color: var(--tm-muted);
  font-size: 0.76rem;
  font-weight: 820;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.card-view__head h3 {
  margin-top: 4px;
  color: var(--tm-heading);
  font-size: 1.1rem;
  line-height: 1.2;
}

.card-view__details {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  margin: 0;
}

.card-view__details div {
  min-width: 0;
}

.card-view__details dt {
  color: var(--tm-muted);
  font-size: 0.74rem;
  font-weight: 800;
}

.card-view__details dd {
  margin: 3px 0 0;
  color: var(--tm-heading);
  font-weight: 850;
  overflow-wrap: anywhere;
}

.card-view__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.card-view--grid .card-view__actions {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--tm-border);
}

.card-view__empty {
  display: grid;
  gap: 8px;
  place-items: center;
  padding: 36px;
  color: var(--tm-muted);
  font-weight: 800;
}

.card-view__empty i {
  color: var(--tm-gold);
  font-size: 1.5rem;
}

.card-view :deep(.p-paginator) {
  border-color: var(--tm-border);
  background: var(--tm-surface);
}

@media (max-width: 640px) {
  .card-view__item {
    flex-direction: column;
  }

  .card-view__media {
    flex-basis: auto;
    width: 100%;
    height: 180px;
  }

  .card-view--grid .card-view__list {
    grid-template-columns: 1fr;
    padding: 12px;
  }
}
</style>
