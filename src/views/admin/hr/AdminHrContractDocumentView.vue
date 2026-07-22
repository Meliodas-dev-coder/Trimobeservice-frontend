<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import {
  getContractDocument,
  issueContractDocument,
  signContractDocument,
  voidContractDocument,
} from '@/api/hr';
import { canMutateHrResource } from '@/data/hrAccess';
import { getHrResource } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

// The printed contract. Like the invoice, the document itself is French
// regardless of the console language, and the PDF comes from the browser's own
// print dialog rather than a server-side renderer.
//
// What prints is `body_rendered` — the text frozen at issue time. The template is
// never consulted here, so editing a template cannot alter a signed contract.
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { enumLabel, t } = useAdminI18n();

// An employee reaches this page to read and print a contract addressed to them.
// Issuing, signing and voiding stay with HR (the backend enforces all scope);
// hiding the buttons keeps the page honest rather than offering a 403.
const canManage = computed(() => canMutateHrResource(auth, getHrResource('contract-documents'), 'update'));
const backTarget = computed(() => (canManage.value ? '/admin/hr/organization/contract-documents' : '/admin/hr/me'));

const doc = ref(null);
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const voidOpen = ref(false);
const voidReason = ref('');

// Split on blank lines so each article becomes a block that print CSS can keep
// off a page boundary. Single newlines inside a block are preserved by CSS.
const blocks = computed(() => String(doc.value?.body_rendered || '')
  .split(/\n{2,}/)
  .map((block) => block.replace(/\s+$/, ''))
  .filter(Boolean));

const isFinal = computed(() => doc.value?.status === 'issued' || doc.value?.status === 'signed');
const banner = computed(() => {
  if (!doc.value) return '';
  if (doc.value.status === 'draft') return t('DRAFT — NOT VALID');
  if (doc.value.status === 'void') return t('VOID');
  return '';
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    doc.value = await getContractDocument(route.params.id);
  } catch (err) {
    error.value = err.message || t('Could not load the document');
  } finally {
    loading.value = false;
  }
}

async function run(action) {
  busy.value = true;
  error.value = '';
  try {
    doc.value = await action();
  } catch (err) {
    error.value = err.message || t('The action could not be completed');
  } finally {
    busy.value = false;
  }
}

const issue = () => run(() => issueContractDocument(doc.value.id));
const sign = () => run(() => signContractDocument(doc.value.id));

async function confirmVoid() {
  voidOpen.value = false;
  await run(() => voidContractDocument(doc.value.id, voidReason.value));
  voidReason.value = '';
}

function printDoc() { window.print(); }

onMounted(load);
</script>

<template>
  <section class="cdoc">
    <!-- toolbar: never printed -->
    <div class="cdoc-toolbar">
      <Button icon="pi pi-arrow-left" severity="secondary" text :label="t('Back')" @click="router.push(backTarget)" />
      <div class="cdoc-toolbar__spacer" />
      <template v-if="doc">
        <Tag :value="enumLabel(doc.status)" :severity="{ draft: 'secondary', issued: 'info', signed: 'success', void: 'danger' }[doc.status] || 'secondary'" />
        <Button v-if="canManage && doc.status === 'draft'" :label="t('Issue')" icon="pi pi-verified" :disabled="busy" @click="issue" />
        <Button v-if="canManage && doc.status === 'issued'" :label="t('Mark as signed')" icon="pi pi-check-circle" severity="success" :disabled="busy" @click="sign" />
        <Button v-if="canManage && isFinal" :label="t('Void')" icon="pi pi-ban" severity="danger" outlined :disabled="busy" @click="voidOpen = true" />
        <Button :label="t('Print / PDF')" icon="pi pi-print" :disabled="busy" @click="printDoc" />
      </template>
    </div>

    <div v-if="error" class="cdoc-error"><i class="pi pi-exclamation-circle" /> {{ error }}</div>
    <div v-if="loading" class="cdoc-error">{{ t('Loading…') }}</div>

    <!-- the printable paper -->
    <article v-if="doc" class="paper">
      <div v-if="banner" class="paper__banner">{{ banner }}</div>

      <header class="paper__head">
        <h1>{{ doc.template_name }}</h1>
        <dl>
          <div v-if="doc.reference"><dt>{{ t('Reference') }}</dt><dd>{{ doc.reference }}</dd></div>
          <div v-if="doc.place"><dt>{{ t('Place') }}</dt><dd>{{ doc.place }}</dd></div>
        </dl>
      </header>

      <div class="paper__body">
        <p v-for="(block, index) in blocks" :key="index">{{ block }}</p>
      </div>

      <p v-if="doc.status === 'void' && doc.void_reason" class="paper__void">
        {{ t('Void reason') }}: {{ doc.void_reason }}
      </p>
    </article>

    <Dialog v-model:visible="voidOpen" modal :header="t('Void this document')" :style="{ width: 'min(480px, 94vw)' }">
      <p class="cdoc-void-note">{{ t('An issued document is never deleted. Voiding keeps it on record and marks it as cancelled.') }}</p>
      <InputText v-model="voidReason" class="cdoc-void-input" :placeholder="t('Reason')" />
      <template #footer>
        <Button :label="t('Cancel')" severity="secondary" outlined @click="voidOpen = false" />
        <Button :label="t('Void')" severity="danger" @click="confirmVoid" />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.cdoc { display: grid; gap: 14px; min-width: 0; }
.cdoc-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 12px; border: 1px solid var(--tm-border); border-radius: 14px; background: var(--tm-surface); }
.cdoc-toolbar__spacer { flex: 1 1 auto; }
.cdoc-error { padding: 12px 14px; border: 1px solid var(--tm-border); border-radius: 12px; background: var(--tm-surface-soft); color: var(--tm-heading); font-size: .85rem; }
.cdoc-error i { color: var(--tm-coral); }
.cdoc-void-note { margin: 0 0 10px; color: var(--tm-muted); font-size: .82rem; line-height: 1.5; }
.cdoc-void-input { width: 100%; }

.paper { max-width: 210mm; margin: 0 auto; padding: 18mm 16mm; border-radius: 6px; background: #fff; box-shadow: 0 12px 40px rgba(37, 31, 20, .12); color: #1a1a1a; font-family: ui-serif, Georgia, "Times New Roman", serif; }
.paper__banner { margin-bottom: 10mm; padding: 8px 12px; border: 2px solid #b3261e; border-radius: 4px; color: #b3261e; font-family: system-ui, sans-serif; font-size: .8rem; font-weight: 900; letter-spacing: .18em; text-align: center; text-transform: uppercase; }
.paper__head { margin-bottom: 9mm; padding-bottom: 5mm; border-bottom: 1px solid #d9d3c7; }
.paper__head h1 { margin: 0 0 4mm; font-size: 1.15rem; letter-spacing: .01em; text-align: center; text-transform: uppercase; }
.paper__head dl { display: flex; justify-content: center; gap: 18px; margin: 0; font-family: system-ui, sans-serif; font-size: .72rem; }
.paper__head dl > div { display: flex; gap: 6px; }
.paper__head dt { color: #6b6355; font-weight: 700; }
.paper__head dt::after { content: ':'; }
.paper__head dd { margin: 0; font-weight: 700; }
.paper__body p { margin: 0 0 4.5mm; font-size: .84rem; line-height: 1.72; text-align: justify; white-space: pre-wrap; }
.paper__void { margin-top: 8mm; color: #b3261e; font-family: system-ui, sans-serif; font-size: .75rem; font-weight: 700; }
</style>

<!-- Print rules are global so they can reach the admin shell. Same approach as
     the invoice: `@page { margin: 0 }` removes the browser's own header/footer,
     and the paper owns the A4 margins.

     A contract differs from an invoice in one important way: it runs to several
     pages. So each article block is kept off a page boundary, the signature
     block (the last block) must never split, and orphan/widow control stops a
     single line stranded alone at a page edge. -->
<style>
@media print {
  @page { size: A4; margin: 0; }
  .admin-sidebar, .admin-topbar, .admin-sidebar-backdrop, .cdoc-toolbar, .cdoc-error { display: none !important; }
  .admin-shell { display: block !important; }
  .admin-content { padding: 0 !important; }
  html, body { background: #fff !important; }

  .paper {
    box-shadow: none !important;
    max-width: none !important;
    width: 210mm !important;
    margin: 0 !important;
    border-radius: 0 !important;
    padding: 18mm 16mm !important;
    box-sizing: border-box !important;
  }

  /* Keep each article whole, and never strand one line across a page break. */
  .paper__body p {
    break-inside: avoid;
    page-break-inside: avoid;
    orphans: 3;
    widows: 3;
  }
  /* The signature block closes the document and must stay intact. */
  .paper__body p:last-child {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-top: 6mm;
  }
  .paper__head { break-after: avoid; page-break-after: avoid; }
  .paper__banner { break-after: avoid; }
}
</style>
