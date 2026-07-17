<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';

import { api } from '@/api/client';
import { uploadImage } from '@/api/resources';
import { useAdminI18n } from '@/i18n/admin';

const toast = useToast();
const { t } = useAdminI18n();

const loading = ref(false);
const saving = ref(false);

// Logo is picked locally and only uploaded on save (deferred-upload pattern):
// pick → local preview → on Save, upload first → store the returned URL.
const logoInput = ref(null);
const logoFile = ref(null);
const logoPreview = ref('');

function onLogoChange(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  logoFile.value = file;
  logoPreview.value = URL.createObjectURL(file);
}
function removeLogo() {
  logoFile.value = null;
  logoPreview.value = '';
  form.logo_url = '';
  if (logoInput.value) logoInput.value.value = '';
}

// Mirrors org_settings on the backend. These values are snapshotted onto every
// invoice at creation, so they are the seller identity that appears on the
// printed document.
const form = reactive({
  legal_name: '',
  brand_name: '',
  address: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  logo_url: '',
  nif: '',
  stat: '',
  rcs: '',
  currency: 'MGA',
  tax_label: 'TVA',
  default_tax_rate: '0.00',
  payment_terms: '',
  bank_details: '',
  mobile_money: '',
  invoice_prefix: 'FAC',
  proforma_prefix: 'PRO',
  credit_note_prefix: 'AV',
  footer_text: '',
});

function apply(s) {
  for (const key of Object.keys(form)) {
    if (s[key] !== undefined && s[key] !== null) {
      form[key] = String(s[key]);
    }
  }
}

// Blank strings become null so the backend stores SQL NULL, not "".
function payload() {
  const out = {};
  for (const [key, value] of Object.entries(form)) {
    const v = typeof value === 'string' ? value.trim() : value;
    out[key] = v === '' ? null : v;
  }
  out.legal_name = form.legal_name.trim(); // required, never null
  return out;
}

async function load() {
  loading.value = true;
  try {
    const data = await api.get('/admin/org-settings');
    apply(data?.org_settings || {});
    logoFile.value = null;
    logoPreview.value = form.logo_url || '';
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not load'), detail: err?.message || t('Request failed'), life: 4000 });
  } finally {
    loading.value = false;
  }
}

async function save() {
  if (!form.legal_name.trim()) {
    toast.add({ severity: 'warn', summary: t('Legal name is required'), life: 3000 });
    return;
  }
  saving.value = true;
  try {
    // Upload the newly-picked logo first; abort the save if it fails.
    if (logoFile.value) {
      const uploaded = await uploadImage(logoFile.value);
      form.logo_url = uploaded?.url || '';
      logoFile.value = null;
    }
    const data = await api.put('/admin/org-settings', payload());
    apply(data?.org_settings || {});
    logoPreview.value = form.logo_url || '';
    toast.add({ severity: 'success', summary: t('Changes saved'), life: 2500 });
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Save failed'), detail: err?.message || t('Request failed'), life: 4000 });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="org-settings">
    <header class="org-hero">
      <div>
        <p>{{ t('Billing') }}</p>
        <h2>{{ t('Company & invoice settings') }}</h2>
        <span>{{ t('This identity is frozen onto every invoice at the moment it is created. Update it before issuing your first documents.') }}</span>
      </div>
      <div class="org-hero__actions">
        <Button as="router-link" to="/admin/invoices" :label="t('Invoices')" icon="pi pi-file" severity="secondary" outlined />
        <Button :label="t('Reload')" icon="pi pi-refresh" severity="secondary" outlined :loading="loading" :disabled="saving" @click="load" />
      </div>
    </header>

    <form class="org-grid" @submit.prevent="save">
      <fieldset class="card">
        <legend>{{ t('Identity') }}</legend>
        <label><span>{{ t('Legal name') }} *</span><InputText v-model="form.legal_name" :disabled="loading" /></label>
        <label><span>{{ t('Brand name (if different)') }}</span><InputText v-model="form.brand_name" :disabled="loading" /></label>
        <label><span>{{ t('Address') }}</span><Textarea v-model="form.address" rows="2" auto-resize :disabled="loading" /></label>
        <label><span>{{ t('City') }}</span><InputText v-model="form.city" :disabled="loading" /></label>
        <div class="row">
          <label><span>{{ t('Phone') }}</span><InputText v-model="form.phone" :disabled="loading" /></label>
          <label><span>{{ t('Email') }}</span><InputText v-model="form.email" :disabled="loading" /></label>
        </div>
        <label><span>{{ t('Website') }}</span><InputText v-model="form.website" :disabled="loading" /></label>
        <label class="logo-field">
          <span>{{ t('Logo') }}</span>
          <div class="logo-row">
            <div class="logo-preview">
              <img v-if="logoPreview" :src="logoPreview" alt="logo" />
              <i v-else class="pi pi-image" />
            </div>
            <div class="logo-actions">
              <input ref="logoInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="logo-input" @change="onLogoChange" />
              <Button type="button" :label="t('Choose logo')" icon="pi pi-upload" severity="secondary" outlined :disabled="loading || saving" @click="logoInput?.click()" />
              <Button v-if="logoPreview" type="button" :label="t('Remove')" icon="pi pi-times" severity="danger" text :disabled="loading || saving" @click="removeLogo" />
            </div>
          </div>
          <small>{{ t('PNG, JPG, WebP, or GIF. Uploaded to storage when you save.') }}</small>
        </label>
      </fieldset>

      <fieldset class="card">
        <legend>{{ t('Fiscal identifiers') }}</legend>
        <p class="hint">{{ t('Leave blank until registered. When filled, they print on the invoice header.') }}</p>
        <label><span>NIF</span><InputText v-model="form.nif" placeholder="Numéro d'Identification Fiscale" :disabled="loading" /></label>
        <label><span>STAT</span><InputText v-model="form.stat" placeholder="Numéro statistique" :disabled="loading" /></label>
        <label><span>RCS</span><InputText v-model="form.rcs" placeholder="Registre du Commerce" :disabled="loading" /></label>
      </fieldset>

      <fieldset class="card">
        <legend>{{ t('Tax & currency') }}</legend>
        <div class="row">
          <label><span>{{ t('Currency') }}</span><InputText v-model="form.currency" :disabled="loading" /></label>
          <label><span>{{ t('Tax label') }}</span><InputText v-model="form.tax_label" placeholder="TVA" :disabled="loading" /></label>
        </div>
        <label>
          <span>{{ t('Default tax rate (%)') }}</span>
          <InputText v-model="form.default_tax_rate" inputmode="decimal" :disabled="loading" />
          <small>{{ t('Keep at 0 until TVA-registered. Set to e.g. 20.00 to add a tax line to new invoices.') }}</small>
        </label>
      </fieldset>

      <fieldset class="card">
        <legend>{{ t('Payment instructions') }}</legend>
        <p class="hint">{{ t('Shown on unpaid invoices so the customer knows how to pay.') }}</p>
        <label><span>{{ t('Payment terms') }}</span><InputText v-model="form.payment_terms" placeholder="Paiement à réception" :disabled="loading" /></label>
        <label><span>{{ t('Bank details') }}</span><Textarea v-model="form.bank_details" rows="2" auto-resize :disabled="loading" /></label>
        <label><span>{{ t('Mobile money') }}</span><Textarea v-model="form.mobile_money" rows="2" auto-resize placeholder="MVola / Orange Money…" :disabled="loading" /></label>
      </fieldset>

      <fieldset class="card">
        <legend>{{ t('Numbering & footer') }}</legend>
        <div class="row">
          <label><span>{{ t('Final prefix') }}</span><InputText v-model="form.invoice_prefix" :disabled="loading" /></label>
          <label><span>{{ t('Proforma prefix') }}</span><InputText v-model="form.proforma_prefix" :disabled="loading" /></label>
          <label><span>{{ t('Credit note prefix') }}</span><InputText v-model="form.credit_note_prefix" :disabled="loading" /></label>
        </div>
        <p class="hint">{{ t('Numbers are gapless per year, e.g.') }} <code>{{ form.invoice_prefix }}-{{ new Date().getFullYear() }}-0001</code>.</p>
        <label><span>{{ t('Footer text') }}</span><Textarea v-model="form.footer_text" rows="2" auto-resize :disabled="loading" /></label>
      </fieldset>

      <div class="org-actions">
        <Button type="submit" :label="t('Save settings')" icon="pi pi-check" :loading="saving" :disabled="loading" />
      </div>
    </form>
  </section>
</template>

<style scoped>
.org-settings { display: grid; gap: 18px; }
.org-hero { display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: end; gap: 24px; padding: clamp(22px,3.5vw,32px); border: 1px solid var(--tm-border); border-radius: 22px; background: radial-gradient(circle at 92% -20%, rgba(201,146,44,.30), transparent 42%), linear-gradient(135deg, var(--tm-charcoal), #22301f); box-shadow: var(--tm-shadow); }
.org-hero p { margin: 0; color: var(--tm-gold); font-size: .72rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
.org-hero h2 { margin: 8px 0 8px; color: #fff8ed; font-size: clamp(1.7rem,3vw,2.6rem); letter-spacing: -.04em; line-height: 1; }
.org-hero > div:first-child > span { display: block; max-width: 640px; color: rgba(255,255,255,.66); line-height: 1.55; }
.org-hero__actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 9px; }
.org-hero__actions :deep(.p-button) { border-color: rgba(255,255,255,.2); color: #fff; }
.org-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 16px; }
.card { display: grid; gap: 12px; margin: 0; padding: 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.05); }
.card legend { padding: 0 8px; color: var(--tm-heading); font-size: .95rem; font-weight: 900; }
.card label { display: grid; gap: 6px; }
.card label > span { color: var(--tm-heading); font-size: .82rem; font-weight: 850; }
.card label small { color: var(--tm-muted); font-size: .74rem; line-height: 1.4; }
.card :deep(.p-inputtext), .card :deep(.p-textarea) { width: 100%; }
.row { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.row:has(> label:nth-child(3)) { grid-template-columns: repeat(3, minmax(0,1fr)); }
.hint { margin: 0; color: var(--tm-muted); font-size: .78rem; line-height: 1.45; }
.hint code { padding: 1px 6px; border-radius: 6px; background: var(--tm-surface-soft); font-size: .78rem; }
.logo-row { display: flex; align-items: center; gap: 14px; }
.logo-preview { display: grid; width: 84px; height: 84px; flex: 0 0 auto; place-items: center; overflow: hidden; border: 1px solid var(--tm-border); border-radius: 12px; background: var(--tm-surface-soft); }
.logo-preview img { width: 100%; height: 100%; object-fit: contain; }
.logo-preview i { color: var(--tm-muted); font-size: 1.5rem; }
.logo-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.logo-input { display: none; }
.org-actions { grid-column: 1 / -1; display: flex; justify-content: flex-end; }
@media (max-width: 900px) { .org-grid, .org-hero { grid-template-columns: 1fr; } .org-hero__actions { justify-content: flex-start; } }
@media (max-width: 560px) { .row, .row:has(> label:nth-child(3)) { grid-template-columns: 1fr; } }
</style>
