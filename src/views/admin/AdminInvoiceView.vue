<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { useConfirm } from 'primevue/useconfirm';

import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { amountToFrenchWords } from '@/utils/amountInWords';
import { formatDate, setPageTitle } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();
const { t } = useAdminI18n();

const loading = ref(false);
const busy = ref(false);
const invoice = ref(null);

const seller = computed(() => invoice.value?.seller_snapshot || {});
const lines = computed(() => invoice.value?.lines || []);

// The printed document is French regardless of the admin UI language.
const DOC_TITLE = { proforma: 'FACTURE PROFORMA', final: 'FACTURE', credit_note: 'AVOIR' };
const docTitle = computed(() => DOC_TITLE[invoice.value?.kind] || 'FACTURE');
const currency = computed(() => invoice.value?.currency || 'MGA');
const isCreditNote = computed(() => invoice.value?.kind === 'credit_note');

function num(v) { return Number.parseFloat(v || '0'); }
function money(v) {
  return `${new Intl.NumberFormat('fr-MG', { maximumFractionDigits: 0 }).format(num(v))} ${currency.value}`;
}
function qty(v) {
  const n = num(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

const totalInWords = computed(() =>
  invoice.value ? amountToFrenchWords(invoice.value.total, currency.value) : '');

const taxRatePct = computed(() => num(invoice.value?.tax_rate));
const showTax = computed(() => num(invoice.value?.tax_amount) !== 0 || taxRatePct.value !== 0);
const showDiscount = computed(() => num(invoice.value?.discount) !== 0);

// Payment reconciliation (from the ledger; not shown for credit notes).
const paymentState = computed(() => {
  if (!invoice.value || isCreditNote.value) return null;
  const total = num(invoice.value.total);
  const paid = num(invoice.value.amount_paid);
  if (total > 0 && paid >= total) return { key: 'paid', label: 'Payée', severity: 'success' };
  if (paid > 0) return { key: 'partial', label: 'Partiellement payée', severity: 'warn' };
  return { key: 'unpaid', label: 'Impayée', severity: 'danger' };
});
const showPaymentInstructions = computed(() =>
  paymentState.value && paymentState.value.key !== 'paid'
  && invoice.value?.status === 'issued');

const statusSeverity = computed(() =>
  ({ draft: 'secondary', issued: 'info', void: 'danger', credited: 'warn' }[invoice.value?.status] || 'secondary'));

async function load() {
  loading.value = true;
  try {
    const data = await api.get(`/admin/invoices/${route.params.id}`);
    invoice.value = data?.invoice || null;
    if (invoice.value) {
      setPageTitle(invoice.value.invoice_number || t('Draft invoice'));
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not load'), detail: err?.message || t('Request failed'), life: 4000 });
  } finally {
    loading.value = false;
  }
}

async function act(fn, okMsg) {
  busy.value = true;
  try {
    const data = await fn();
    if (okMsg) toast.add({ severity: 'success', summary: t(okMsg), life: 2500 });
    return data;
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Action failed'), detail: err?.message || t('Request failed'), life: 5000 });
    return null;
  } finally {
    busy.value = false;
  }
}

async function issue() {
  const data = await act(() => api.post(`/admin/invoices/${invoice.value.id}/issue`), 'Invoice issued');
  if (data?.invoice) invoice.value = data.invoice;
}

function voidInvoice() {
  confirm.require({
    header: t('Void invoice'),
    message: t('Voiding is permanent. The document stays on record but is no longer valid. Continue?'),
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: t('Void'),
    rejectLabel: t('Cancel'),
    accept: async () => {
      const data = await act(() => api.post(`/admin/invoices/${invoice.value.id}/void`), 'Invoice voided');
      if (data?.invoice) invoice.value = data.invoice;
    },
  });
}

async function creditNote() {
  const data = await act(() => api.post(`/admin/invoices/${invoice.value.id}/credit-note`), 'Credit note created');
  if (data?.invoice?.id) router.push({ name: 'admin-invoice-detail', params: { id: data.invoice.id } });
}

function removeDraft() {
  confirm.require({
    header: t('Delete draft'),
    message: t('Delete this draft invoice? This cannot be undone.'),
    icon: 'pi pi-trash',
    acceptClass: 'p-button-danger',
    acceptLabel: t('Delete'),
    rejectLabel: t('Cancel'),
    accept: async () => {
      const ok = await act(() => api.del(`/admin/invoices/${invoice.value.id}`), 'Draft deleted');
      if (ok !== null) router.push({ name: 'admin-invoices' });
    },
  });
}

function printDoc() { window.print(); }

// --- edit draft dialog ---
const edit = reactive({ visible: false, saving: false, discount: '0', tax_rate: '0', due_date: null, notes: '', terms: '' });
function openEdit() {
  edit.discount = invoice.value.discount || '0';
  edit.tax_rate = invoice.value.tax_rate || '0';
  edit.due_date = invoice.value.due_date ? new Date(invoice.value.due_date) : null;
  edit.notes = invoice.value.notes || '';
  edit.terms = invoice.value.terms || '';
  edit.visible = true;
}
function toDateStr(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
async function saveEdit() {
  edit.saving = true;
  try {
    const data = await api.put(`/admin/invoices/${invoice.value.id}`, {
      discount: String(edit.discount ?? '0'),
      tax_rate: String(edit.tax_rate ?? '0'),
      due_date: toDateStr(edit.due_date),
      notes: edit.notes?.trim() || null,
      terms: edit.terms?.trim() || null,
    });
    if (data?.invoice) invoice.value = data.invoice;
    edit.visible = false;
    toast.add({ severity: 'success', summary: t('Changes saved'), life: 2000 });
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Save failed'), detail: err?.message || t('Request failed'), life: 4000 });
  } finally {
    edit.saving = false;
  }
}

const canEdit = computed(() => invoice.value?.status === 'draft');
const canIssue = computed(() => invoice.value?.status === 'draft');
const canVoid = computed(() => ['draft', 'issued'].includes(invoice.value?.status));
const canCredit = computed(() => invoice.value?.kind === 'final' && invoice.value?.status === 'issued');

onMounted(load);
</script>

<template>
  <section class="inv-detail">
    <div v-if="loading" class="inv-loading"><i class="pi pi-spin pi-spinner" /> {{ t('Loading…') }}</div>

    <template v-else-if="invoice">
      <!-- toolbar (not printed) -->
      <div class="inv-toolbar">
        <Button icon="pi pi-arrow-left" :label="t('Invoices')" severity="secondary" text @click="router.push({ name: 'admin-invoices' })" />
        <Tag :value="t(invoice.status)" :severity="statusSeverity" />
        <div class="inv-toolbar__spacer" />
        <Button v-if="canEdit" :label="t('Edit')" icon="pi pi-pencil" severity="secondary" outlined :disabled="busy" @click="openEdit" />
        <Button v-if="canIssue" :label="t('Issue')" icon="pi pi-verified" :disabled="busy" @click="issue" />
        <Button v-if="canCredit" :label="t('Credit note')" icon="pi pi-replay" severity="secondary" outlined :disabled="busy" @click="creditNote" />
        <Button v-if="canVoid" :label="t('Void')" icon="pi pi-ban" severity="danger" outlined :disabled="busy" @click="voidInvoice" />
        <Button v-if="invoice.status === 'draft'" :label="t('Delete')" icon="pi pi-trash" severity="danger" text :disabled="busy" @click="removeDraft" />
        <Button :label="t('Print / PDF')" icon="pi pi-print" :disabled="busy" @click="printDoc" />
      </div>

      <!-- the printable document -->
      <article class="paper">
        <header class="paper-head">
          <div class="seller">
            <img v-if="seller.logo_url" :src="seller.logo_url" alt="" class="seller-logo" />
            <h1>{{ seller.brand_name || seller.legal_name || 'Trimobe' }}</h1>
            <p v-if="seller.address" class="seller-line">{{ seller.address }}</p>
            <p v-if="seller.city" class="seller-line">{{ seller.city }}</p>
            <p v-if="seller.phone" class="seller-line">Tél : {{ seller.phone }}</p>
            <p v-if="seller.email" class="seller-line">{{ seller.email }}</p>
            <p v-if="seller.website" class="seller-line">{{ seller.website }}</p>
            <p v-if="seller.nif || seller.stat || seller.rcs" class="seller-fiscal">
              <span v-if="seller.nif">NIF : {{ seller.nif }}</span>
              <span v-if="seller.stat">STAT : {{ seller.stat }}</span>
              <span v-if="seller.rcs">RCS : {{ seller.rcs }}</span>
            </p>
          </div>
          <div class="doc-meta">
            <h2>{{ docTitle }}</h2>
            <p class="doc-number">{{ invoice.invoice_number || 'BROUILLON' }}</p>
            <dl>
              <div><dt>Date</dt><dd>{{ invoice.issue_date ? formatDate(invoice.issue_date) : '—' }}</dd></div>
              <div v-if="invoice.due_date"><dt>Échéance</dt><dd>{{ formatDate(invoice.due_date) }}</dd></div>
              <div v-if="invoice.source_number"><dt>Référence</dt><dd>{{ invoice.source_number }}</dd></div>
            </dl>
          </div>
        </header>

        <section class="bill-to">
          <p class="bill-to__label">Facturé à</p>
          <p class="bill-to__name">{{ invoice.buyer_name || '—' }}</p>
          <p v-if="invoice.buyer_address">{{ invoice.buyer_address }}</p>
          <p v-if="invoice.buyer_phone">Tél : {{ invoice.buyer_phone }}</p>
          <p v-if="invoice.buyer_email">{{ invoice.buyer_email }}</p>
        </section>

        <table class="lines">
          <thead>
            <tr><th class="c-desc">Désignation</th><th class="c-qty">Qté</th><th class="c-price">Prix unitaire</th><th class="c-amt">Montant</th></tr>
          </thead>
          <tbody>
            <tr v-for="line in lines" :key="line.id">
              <td class="c-desc">
                <span class="line-desc">{{ line.description }}</span>
                <small v-if="line.detail" class="line-detail">{{ line.detail }}</small>
              </td>
              <td class="c-qty">{{ qty(line.quantity) }}</td>
              <td class="c-price">{{ money(line.unit_price) }}</td>
              <td class="c-amt">{{ money(line.line_total) }}</td>
            </tr>
            <tr v-if="!lines.length"><td colspan="4" class="lines-empty">Aucune ligne.</td></tr>
          </tbody>
        </table>

        <div class="totals-wrap">
          <div class="pay-side">
            <div v-if="paymentState" class="pay-badge" :class="`pay-${paymentState.key}`">{{ paymentState.label }}</div>
            <div v-if="showPaymentInstructions" class="pay-instructions">
              <p v-if="seller.payment_terms"><strong>Conditions :</strong> {{ seller.payment_terms }}</p>
              <p v-if="seller.bank_details"><strong>Virement :</strong><br />{{ seller.bank_details }}</p>
              <p v-if="seller.mobile_money"><strong>Mobile money :</strong><br />{{ seller.mobile_money }}</p>
            </div>
          </div>
          <div class="totals">
            <div class="tot-row"><span>Sous-total</span><span>{{ money(invoice.subtotal) }}</span></div>
            <div v-if="showDiscount" class="tot-row"><span>Remise</span><span>− {{ money(invoice.discount) }}</span></div>
            <div v-if="showTax" class="tot-row"><span>{{ seller.tax_label || 'TVA' }} ({{ taxRatePct }} %)</span><span>{{ money(invoice.tax_amount) }}</span></div>
            <div class="tot-row tot-total"><span>Total</span><span>{{ money(invoice.total) }}</span></div>
            <div v-if="paymentState && paymentState.key !== 'unpaid'" class="tot-row tot-sub"><span>Déjà réglé</span><span>{{ money(invoice.amount_paid) }}</span></div>
            <div v-if="paymentState && paymentState.key !== 'paid'" class="tot-row tot-sub"><span>Reste à payer</span><span>{{ money(invoice.balance_due) }}</span></div>
          </div>
        </div>

        <p class="arrete">Arrêtée la présente {{ isCreditNote ? 'note d’avoir' : 'facture' }} à la somme de <strong>{{ money(invoice.total) }}</strong> <span class="arrete-words">ou <b>{{ totalInWords }}</b></span>.</p>

        <section v-if="invoice.notes || invoice.terms" class="doc-notes">
          <p v-if="invoice.notes"><strong>Note :</strong> {{ invoice.notes }}</p>
          <p v-if="invoice.terms">{{ invoice.terms }}</p>
        </section>

        <!-- spacer pushes the signature block to the bottom of the page -->
        <div class="paper-grow" />

        <section class="sign">
          <div class="sign-col">
            <span class="sign-place">Fait à {{ seller.city || 'Antananarivo' }}, le {{ invoice.issue_date ? formatDate(invoice.issue_date) : '………………' }}</span>
            <div class="sign-box"><span>Signature et cachet</span></div>
          </div>
        </section>

        <footer v-if="seller.footer_text" class="paper-foot">{{ seller.footer_text }}</footer>
      </article>
    </template>

    <div v-else class="inv-loading">{{ t('Invoice not found.') }}</div>

    <!-- edit draft dialog -->
    <Dialog v-model:visible="edit.visible" modal :header="t('Edit draft')" :style="{ width: '440px', maxWidth: '94vw' }">
      <div class="edit-form">
        <label><span>{{ t('Discount') }}</span><InputText v-model="edit.discount" inputmode="decimal" /></label>
        <label><span>{{ t('Tax rate (%)') }}</span><InputText v-model="edit.tax_rate" inputmode="decimal" /></label>
        <label><span>{{ t('Due date') }}</span><DatePicker v-model="edit.due_date" date-format="dd/mm/yy" show-icon /></label>
        <label><span>{{ t('Note') }}</span><Textarea v-model="edit.notes" rows="2" auto-resize /></label>
        <label><span>{{ t('Terms') }}</span><Textarea v-model="edit.terms" rows="2" auto-resize /></label>
      </div>
      <template #footer>
        <Button :label="t('Cancel')" severity="secondary" text @click="edit.visible = false" />
        <Button :label="t('Save')" icon="pi pi-check" :loading="edit.saving" @click="saveEdit" />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.inv-detail { display: grid; gap: 16px; }
.inv-loading { padding: 40px; color: var(--tm-muted); text-align: center; }
.inv-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 10px 14px; border: 1px solid var(--tm-border); border-radius: 14px; background: var(--tm-surface); }
.inv-toolbar__spacer { flex: 1; }

/* The document renders as white "paper" in any theme, sized like an A4 page so
   the on-screen preview matches the print output. */
.paper { display: flex; flex-direction: column; max-width: 820px; min-height: 1040px; margin: 0 auto; width: 100%; padding: clamp(24px, 4vw, 48px); border-radius: 14px; background: #fff; color: #1c1c1c; box-shadow: 0 18px 50px rgba(0,0,0,.18); font-size: 14px; line-height: 1.5; }
.paper-grow { flex: 1 1 auto; min-height: 28px; }
.sign { display: flex; justify-content: flex-end; margin-top: 22px; }
.sign-col { width: 280px; max-width: 100%; }
.sign-place { display: block; margin-bottom: 8px; color: #333; font-size: .84rem; }
.sign-box { display: flex; height: 96px; padding: 8px 10px; border: 1px dashed #bbb; border-radius: 8px; }
.sign-box span { color: #999; font-size: .78rem; font-weight: 700; }
.paper-head { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 24px; padding-bottom: 20px; border-bottom: 2px solid #1c1c1c; }
.seller-logo { max-height: 56px; margin-bottom: 8px; }
.seller h1 { margin: 0 0 6px; font-size: 1.5rem; letter-spacing: -.02em; color: #111; }
.seller-line { margin: 1px 0; color: #444; font-size: .84rem; }
.seller-fiscal { margin-top: 8px; display: flex; flex-wrap: wrap; gap: 4px 14px; color: #555; font-size: .76rem; }
.doc-meta { text-align: right; min-width: 220px; }
.doc-meta h2 { margin: 0; font-size: 1.5rem; letter-spacing: .06em; color: #b8892b; }
.doc-number { margin: 2px 0 12px; font-size: 1.05rem; font-weight: 800; color: #111; }
.doc-meta dl { display: grid; gap: 4px; margin: 0; }
.doc-meta dl > div { display: flex; justify-content: flex-end; gap: 10px; }
.doc-meta dt { color: #777; font-size: .8rem; }
.doc-meta dd { margin: 0; font-weight: 700; color: #222; font-size: .84rem; }
.bill-to { margin: 22px 0; }
.bill-to__label { margin: 0 0 4px; color: #b8892b; font-size: .72rem; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
.bill-to__name { margin: 0; font-size: 1.05rem; font-weight: 800; color: #111; }
.bill-to p { margin: 1px 0; color: #444; font-size: .86rem; }
.lines { width: 100%; border-collapse: collapse; margin-top: 10px; }
.lines thead th { padding: 9px 10px; background: #f4efe4; color: #6a5326; font-size: .74rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; text-align: left; }
.lines th.c-qty, .lines th.c-price, .lines th.c-amt, .lines td.c-qty, .lines td.c-price, .lines td.c-amt { text-align: right; white-space: nowrap; }
.lines tbody td { padding: 10px; border-bottom: 1px solid #eee; vertical-align: top; }
.line-desc { display: block; font-weight: 650; color: #1c1c1c; }
.line-detail { display: block; color: #777; font-size: .78rem; margin-top: 2px; }
.lines-empty { color: #999; text-align: center; padding: 18px; }
.totals-wrap { display: grid; grid-template-columns: minmax(0,1fr) minmax(260px, 320px); gap: 24px; margin-top: 18px; }
.pay-badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: .82rem; }
.pay-paid { background: #e4f5e9; color: #1c7a3f; }
.pay-partial { background: #fdf3e0; color: #9a6a12; }
.pay-unpaid { background: #fdeaea; color: #b23838; }
.pay-instructions { margin-top: 12px; font-size: .8rem; color: #444; }
.pay-instructions p { margin: 5px 0; }
.totals { align-self: start; display: grid; gap: 6px; }
.tot-row { display: flex; justify-content: space-between; gap: 20px; padding: 3px 0; color: #333; }
.tot-total { margin-top: 6px; padding-top: 10px; border-top: 2px solid #1c1c1c; font-size: 1.15rem; font-weight: 900; color: #111; }
.tot-sub { color: #777; font-size: .84rem; }
.arrete { margin: 20px 0 0; padding-top: 14px; border-top: 1px dashed #ccc; color: #333; font-size: .86rem; font-style: italic; }
.doc-notes { margin-top: 14px; color: #444; font-size: .84rem; }
.doc-notes p { margin: 4px 0; }
.paper-foot { margin-top: 18px; padding-top: 12px; border-top: 1px solid #eee; color: #888; font-size: .8rem; text-align: center; }
.edit-form { display: grid; gap: 12px; padding-top: 6px; }
.edit-form label { display: grid; gap: 6px; }
.edit-form label > span { color: var(--tm-heading); font-size: .82rem; font-weight: 850; }
.edit-form :deep(.p-inputtext), .edit-form :deep(.p-textarea), .edit-form :deep(.p-datepicker) { width: 100%; }
@media (max-width: 640px) {
  .paper-head { grid-template-columns: 1fr; }
  .doc-meta { text-align: left; }
  .doc-meta dl > div { justify-content: flex-start; }
  .totals-wrap { grid-template-columns: 1fr; }
}
</style>

<!-- Print rules are global on purpose: hide the admin shell so only the paper
     prints. `@page { margin: 0 }` removes the browser's own header/footer (date,
     document title, URL, page number) — those render in the page margin, so with
     no margin there is nowhere for them to go. The paper then owns the A4 margins. -->
<style>
@media print {
  @page { size: A4; margin: 0; }
  .admin-sidebar, .admin-topbar, .admin-sidebar-backdrop, .inv-toolbar { display: none !important; }
  .admin-shell { display: block !important; }
  .admin-content { padding: 0 !important; }
  html, body { background: #fff !important; }
  .paper {
    box-shadow: none !important;
    max-width: none !important;
    width: 210mm !important;
    min-height: 297mm !important;
    margin: 0 !important;
    border-radius: 0 !important;
    padding: 16mm 15mm !important;
    box-sizing: border-box !important;
  }
}
</style>
