<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import {
  createContractDocument,
  deleteContractDocument,
  listHrLookup,
  listHrResource,
  previewContractDocument,
  updateContractDocument,
} from '@/api/hr';
import { canMutateHrResource } from '@/data/hrAccess';
import { getHrResource } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

// Issue a contract or agreement from a template. A draft can be edited freely;
// issuing freezes the rendered text and assigns the reference, after which the
// document is read-only and only printing, signing or voiding remain.
const { enumLabel, localeCode, t } = useAdminI18n();
const auth = useAuthStore();
const router = useRouter();
const resource = getHrResource('contract-documents');
const templatesResource = getHrResource('contract-templates');

const documents = ref([]);
const templates = ref([]);
const employees = ref([]);
const contracts = ref([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');

const editorOpen = ref(false);
const draft = ref(null);
const preview = ref({ rendered: '', blanks: [], unknown: [], unfilled: [] });
const previewing = ref(false);

const canCreate = computed(() => canMutateHrResource(auth, resource, 'create'));
const selectedTemplate = computed(() => templates.value.find((tpl) => tpl.id === draft.value?.template_id) || null);
// Only an employment document links to the structured hr_contracts terms.
const showContractLink = computed(() => selectedTemplate.value?.kind === 'employment' && draft.value?.employee_id);
const employeeContracts = computed(() => contracts.value.filter((row) => row.employee_id === draft.value?.employee_id));

const STATUS_SEVERITY = { draft: 'secondary', issued: 'info', signed: 'success', void: 'danger' };

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(String(value).length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(parsed.getTime())
    ? value
    : new Intl.DateTimeFormat(localeCode.value, { dateStyle: 'medium' }).format(parsed);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [docs, tpls] = await Promise.all([
      listHrResource(resource, { limit: 100 }),
      listHrResource(templatesResource, { limit: 100, params: { is_active: 1 } }),
    ]);
    documents.value = docs.items || [];
    templates.value = tpls.items || [];
  } catch (err) {
    error.value = err.message || t('Could not load contract documents');
  } finally {
    loading.value = false;
  }
}

async function loadPickers() {
  try {
    const [people, contractRows] = await Promise.all([
      listHrLookup('employees'),
      listHrResource(getHrResource('contracts'), { limit: 200 }),
    ]);
    employees.value = people;
    contracts.value = contractRows.items || [];
  } catch {
    // Pickers are a convenience; an external-party memo needs neither.
    employees.value = employees.value || [];
  }
}

function startNew() {
  draft.value = {
    id: null,
    template_id: templates.value[0]?.id || null,
    employee_id: null,
    contract_id: null,
    party_name: '',
    party_address: '',
    party_id_number: '',
    party_phone: '',
    party_email: '',
    place: '',
    issue_date: new Date().toISOString().slice(0, 10),
    values: {},
  };
  preview.value = { rendered: '', blanks: [], unknown: [], unfilled: [] };
  editorOpen.value = true;
  loadPickers();
  refreshPreview();
}

function editDraft(row) {
  const stored = row.token_values && typeof row.token_values === 'object' ? row.token_values : {};
  draft.value = {
    id: row.id,
    template_id: row.template_id,
    employee_id: row.employee_id || null,
    contract_id: row.contract_id || null,
    party_name: row.party_name || '',
    party_address: row.party_address || '',
    party_id_number: row.party_id_number || '',
    party_phone: row.party_phone || '',
    party_email: row.party_email || '',
    place: row.place || '',
    issue_date: row.issue_date ? String(row.issue_date).slice(0, 10) : '',
    values: { ...(stored.custom || {}) },
  };
  editorOpen.value = true;
  loadPickers();
  refreshPreview();
}

function payload() {
  return {
    template_id: draft.value.template_id,
    employee_id: draft.value.employee_id || null,
    contract_id: showContractLink.value ? draft.value.contract_id || null : null,
    party_name: draft.value.party_name,
    party_address: draft.value.party_address,
    party_id_number: draft.value.party_id_number,
    party_phone: draft.value.party_phone,
    party_email: draft.value.party_email,
    place: draft.value.place,
    issue_date: draft.value.issue_date,
    values: draft.value.values,
  };
}

async function refreshPreview() {
  if (!draft.value?.template_id) return;
  previewing.value = true;
  try {
    preview.value = await previewContractDocument(payload());
    // Keep a value slot for every blank the body asks for.
    for (const blank of preview.value.blanks) {
      if (draft.value.values[blank] === undefined) draft.value.values[blank] = '';
    }
  } catch (err) {
    error.value = err.message || t('Could not render the document');
  } finally {
    previewing.value = false;
  }
}

let timer = null;
watch(
  () => [draft.value?.template_id, draft.value?.employee_id, draft.value?.contract_id, draft.value?.place, draft.value?.issue_date, JSON.stringify(draft.value?.values || {}), draft.value?.party_name],
  () => {
    if (!editorOpen.value) return;
    clearTimeout(timer);
    timer = setTimeout(refreshPreview, 400);
  },
);

async function saveDraft() {
  saving.value = true;
  error.value = '';
  try {
    const saved = draft.value.id
      ? await updateContractDocument(draft.value.id, payload())
      : await createContractDocument(payload());
    editorOpen.value = false;
    await load();
    if (saved?.id) router.push(`/admin/hr/contract-documents/${saved.id}`);
  } catch (err) {
    error.value = err.message || t('Could not save the document');
  } finally {
    saving.value = false;
  }
}

async function removeDraft(row) {
  saving.value = true;
  try {
    await deleteContractDocument(row.id);
    await load();
  } catch (err) {
    error.value = err.message || t('Could not delete the document');
  } finally {
    saving.value = false;
  }
}

function openDocument(row) {
  router.push(`/admin/hr/contract-documents/${row.id}`);
}

onMounted(load);
</script>

<template>
  <section class="hr-doc">
    <header class="hr-doc__head">
      <div>
        <p>{{ t('Contract documents') }}</p>
        <h3>{{ t('Issued contracts and agreements') }}</h3>
        <span>{{ t('Fill in the blanks, issue to freeze the text, then print it as a PDF.') }}</span>
      </div>
      <Button v-if="canCreate" :label="t('New document')" icon="pi pi-plus" :disabled="loading || !templates.length" @click="startNew" />
    </header>

    <div v-if="error" class="hr-doc__error">
      <i class="pi pi-exclamation-circle" /> <strong>{{ error }}</strong>
      <Button :label="t('Try again')" severity="secondary" outlined size="small" @click="load" />
    </div>
    <div v-if="!templates.length && !loading" class="hr-doc__error">
      <i class="pi pi-info-circle" /> <strong>{{ t('Create a contract template first.') }}</strong>
    </div>

    <DataTable :value="documents" :loading="loading" data-key="id" removable-sort>
      <Column :header="t('Reference')">
        <template #body="{ data }">
          <strong>{{ data.reference || t('Draft') }}</strong>
        </template>
      </Column>
      <Column field="party_name" :header="t('Party')" />
      <Column field="template_name" :header="t('Template')" />
      <Column :header="t('Kind')">
        <template #body="{ data }">{{ enumLabel(data.kind) }}</template>
      </Column>
      <Column :header="t('Issued')">
        <template #body="{ data }">{{ formatDate(data.issue_date) }}</template>
      </Column>
      <Column :header="t('Status')">
        <template #body="{ data }">
          <Tag :value="enumLabel(data.status)" :severity="STATUS_SEVERITY[data.status] || 'secondary'" />
        </template>
      </Column>
      <Column>
        <template #body="{ data }">
          <div class="hr-doc__row-actions">
            <Button icon="pi pi-eye" text rounded :aria-label="t('Open')" @click="openDocument(data)" />
            <Button v-if="data.status === 'draft' && canCreate" icon="pi pi-pencil" text rounded :aria-label="t('Edit')" @click="editDraft(data)" />
            <Button v-if="data.status === 'draft' && canCreate" icon="pi pi-trash" text rounded severity="danger" :aria-label="t('Delete')" @click="removeDraft(data)" />
          </div>
        </template>
      </Column>
      <template #empty><span class="hr-doc__empty">{{ t('No documents yet.') }}</span></template>
    </DataTable>

    <!-- draft editor -->
    <Dialog v-model:visible="editorOpen" modal :header="draft?.id ? t('Edit draft') : t('New document')" :style="{ width: 'min(1100px, 96vw)' }">
      <div v-if="draft" class="hr-doc__editor">
        <div class="hr-doc__form">
          <label>
            <span>{{ t('Template') }} *</span>
            <Select v-model="draft.template_id" :options="templates" option-label="name" option-value="id" />
          </label>
          <label>
            <span>{{ t('Employee (leave empty for an external party)') }}</span>
            <Select v-model="draft.employee_id" :options="employees" option-label="full_name" option-value="id" show-clear filter />
          </label>
          <label v-if="showContractLink">
            <span>{{ t('Linked contract') }}</span>
            <Select v-model="draft.contract_id" :options="employeeContracts" option-value="id" show-clear
                    :option-label="(row) => `${enumLabel(row.contract_type)} · ${formatDate(row.start_date)}`" />
          </label>
          <label>
            <span>{{ t('Party name') }}{{ draft.employee_id ? '' : ' *' }}</span>
            <InputText v-model="draft.party_name" :placeholder="draft.employee_id ? t('Taken from the employee record') : ''" />
          </label>
          <label>
            <span>{{ t('Party address') }}</span>
            <InputText v-model="draft.party_address" />
          </label>
          <label>
            <span>{{ t('Party ID number') }}</span>
            <InputText v-model="draft.party_id_number" />
          </label>
          <label>
            <span>{{ t('Place of signing') }}</span>
            <InputText v-model="draft.place" />
          </label>
          <label>
            <span>{{ t('Issue date') }}</span>
            <InputText v-model="draft.issue_date" type="date" />
          </label>
        </div>

        <div v-if="preview.blanks.length" class="hr-doc__blanks">
          <p>{{ t('Fill in the blanks') }}</p>
          <label v-for="blank in preview.blanks" :key="blank">
            <span>{{ blank }}</span>
            <InputText v-model="draft.values[blank]" :invalid="preview.unfilled.includes(blank)" />
          </label>
        </div>

        <div v-if="preview.unknown.length" class="hr-doc__warn">
          <i class="pi pi-times-circle" />
          <span>{{ t('The template has unknown placeholders and cannot be issued:') }} {{ preview.unknown.join(', ') }}</span>
        </div>

        <div class="hr-doc__preview">
          <header>
            <strong>{{ t('Preview') }}</strong>
            <small v-if="previewing">{{ t('Rendering…') }}</small>
          </header>
          <pre>{{ preview.rendered || t('Nothing to preview yet.') }}</pre>
        </div>
      </div>

      <template #footer>
        <Button :label="t('Cancel')" severity="secondary" outlined @click="editorOpen = false" />
        <Button :label="t('Save draft')" icon="pi pi-check" :loading="saving" :disabled="!draft?.template_id" @click="saveDraft" />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.hr-doc { display: grid; gap: 14px; min-width: 0; }
.hr-doc__head { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 18px 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); }
.hr-doc__head p { margin: 0 0 4px; color: var(--tm-gold); font-size: .66rem; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; }
.hr-doc__head h3 { margin: 0; color: var(--tm-heading); font-size: 1.1rem; letter-spacing: -.03em; }
.hr-doc__head span { display: block; margin-top: 5px; color: var(--tm-muted); font-size: .82rem; }
.hr-doc__error { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--tm-border); border-radius: 12px; background: var(--tm-surface-soft); }
.hr-doc__error i { color: var(--tm-coral); }
.hr-doc__empty { color: var(--tm-muted); font-size: .84rem; }
.hr-doc__row-actions { display: flex; gap: 2px; }
.hr-doc__editor { display: grid; gap: 14px; }
.hr-doc__form, .hr-doc__blanks { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
.hr-doc__blanks { padding: 12px; border: 1px dashed var(--tm-border); border-radius: 12px; }
.hr-doc__blanks > p { grid-column: 1 / -1; margin: 0; color: var(--tm-heading); font-size: .78rem; font-weight: 850; }
.hr-doc__form label, .hr-doc__blanks label { display: grid; gap: 5px; min-width: 0; }
.hr-doc__form span, .hr-doc__blanks span { color: var(--tm-heading); font-size: .76rem; font-weight: 800; }
.hr-doc__form :deep(.p-inputtext), .hr-doc__form :deep(.p-select), .hr-doc__blanks :deep(.p-inputtext) { width: 100%; }
.hr-doc__warn { display: flex; align-items: center; gap: 9px; padding: 10px 12px; border: 1px solid var(--tm-coral); border-radius: 11px; color: var(--tm-heading); font-size: .78rem; }
.hr-doc__warn i { color: var(--tm-coral); }
.hr-doc__preview header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
.hr-doc__preview strong { color: var(--tm-heading); }
.hr-doc__preview small { color: var(--tm-muted); }
.hr-doc__preview pre { max-height: 340px; margin: 0; overflow: auto; padding: 16px; border-radius: 10px; background: var(--tm-surface-soft); color: var(--tm-heading); font-family: ui-serif, Georgia, serif; font-size: .8rem; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
</style>
