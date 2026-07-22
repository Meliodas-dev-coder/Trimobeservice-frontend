<script setup>
import { computed, onMounted, ref, watch } from 'vue';

import {
  createHrResource,
  deleteHrResource,
  listHrResource,
  loadContractTokens,
  previewContractTemplate,
  updateHrResource,
} from '@/api/hr';
import { canMutateHrResource } from '@/data/hrAccess';
import { getHrResource } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

// Authoring screen for contract and agreement templates. A template is the
// reusable body; issuing a document from it (and freezing the result) is a
// separate step and deliberately not part of this screen.
//
// The preview is rendered by the backend so an author sees output from the same
// renderer that will produce real documents — two renderers would drift.
const { t } = useAdminI18n();
const auth = useAuthStore();
const resource = getHrResource('contract-templates');

const templates = ref([]);
const tokens = ref([]);
const selectedId = ref(null);
const draft = ref(null);
const preview = ref({ rendered: '', blanks: [], unknown: [], conditional: [] });
const loading = ref(false);
const saving = ref(false);
const previewing = ref(false);
const error = ref('');
const bodyRef = ref(null);

const KINDS = ['employment', 'memo_deal'];
// Passed as a parameter rather than written inline: a literal {{...}} in the
// template would be parsed by Vue as an interpolation.
const CUSTOM_TOKEN_EXAMPLE = '{{custom.your_key}}';
const canManage = computed(() => canMutateHrResource(auth, resource, 'update'));
const canCreate = computed(() => canMutateHrResource(auth, resource, 'create'));
const selected = computed(() => templates.value.find((item) => item.id === selectedId.value) || null);
const isNew = computed(() => Boolean(draft.value) && !draft.value.id);
const dirty = computed(() => {
  if (!draft.value) return false;
  if (isNew.value) return true;
  const original = selected.value;
  if (!original) return false;
  return ['kind', 'code', 'name', 'description', 'body', 'is_active']
    .some((key) => String(draft.value[key] ?? '') !== String(original[key] ?? ''));
});

// Tokens grouped by namespace for the insert picker.
const tokenGroups = computed(() => {
  const groups = new Map();
  for (const token of tokens.value) {
    const namespace = token.token.split('.')[0];
    if (!groups.has(namespace)) groups.set(namespace, []);
    groups.get(namespace).push(token);
  }
  return [...groups.entries()].map(([namespace, items]) => ({ namespace, items }));
});

const blankLabels = computed(() => {
  const labels = draft.value?.field_labels;
  return labels && typeof labels === 'object' ? labels : {};
});

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [list, catalog] = await Promise.all([
      listHrResource(resource, { limit: 100 }),
      loadContractTokens(),
    ]);
    templates.value = list.items || [];
    tokens.value = catalog;
    if (!selectedId.value && templates.value.length) select(templates.value[0].id);
    else if (selectedId.value) select(selectedId.value);
  } catch (err) {
    error.value = err.message || t('Could not load contract templates');
  } finally {
    loading.value = false;
  }
}

function select(id) {
  const found = templates.value.find((item) => item.id === id);
  if (!found) return;
  selectedId.value = id;
  draft.value = { ...found };
  refreshPreview();
}

function startNew() {
  selectedId.value = null;
  draft.value = { kind: 'memo_deal', code: '', name: '', description: '', body: '', is_active: true };
  preview.value = { rendered: '', blanks: [], unknown: [], conditional: [] };
}

function cancelEdit() {
  if (selected.value) select(selected.value.id);
  else if (templates.value.length) select(templates.value[0].id);
  else draft.value = null;
}

// Insert at the caret so a token lands where the author is writing.
function insertToken(token) {
  if (!draft.value || !canManage.value) return;
  const textarea = bodyRef.value?.$el || bodyRef.value;
  const placeholder = `{{${token}}}`;
  const body = draft.value.body || '';
  const start = textarea?.selectionStart ?? body.length;
  const end = textarea?.selectionEnd ?? body.length;
  draft.value.body = body.slice(0, start) + placeholder + body.slice(end);
  requestAnimationFrame(() => {
    if (!textarea?.setSelectionRange) return;
    textarea.focus();
    const caret = start + placeholder.length;
    textarea.setSelectionRange(caret, caret);
  });
}

async function refreshPreview() {
  if (!draft.value?.body) {
    preview.value = { rendered: '', blanks: [], unknown: [], conditional: [] };
    return;
  }
  previewing.value = true;
  try {
    preview.value = await previewContractTemplate(draft.value.kind, draft.value.body);
  } catch (err) {
    error.value = err.message || t('Could not render the preview');
  } finally {
    previewing.value = false;
  }
}

let previewTimer = null;
watch(() => [draft.value?.body, draft.value?.kind], () => {
  clearTimeout(previewTimer);
  previewTimer = setTimeout(refreshPreview, 400);
});

async function save() {
  if (!draft.value || !dirty.value) return;
  saving.value = true;
  error.value = '';
  try {
    const body = {
      kind: draft.value.kind,
      code: (draft.value.code || '').trim(),
      name: (draft.value.name || '').trim(),
      description: (draft.value.description || '').trim() || null,
      body: draft.value.body || '',
      is_active: Boolean(draft.value.is_active),
    };
    const saved = draft.value.id
      ? await updateHrResource(resource, draft.value.id, body)
      : await createHrResource(resource, body);
    await load();
    if (saved?.id) select(saved.id);
  } catch (err) {
    error.value = err.message || t('Could not save the template');
  } finally {
    saving.value = false;
  }
}

async function removeTemplate() {
  if (!selected.value) return;
  saving.value = true;
  try {
    await deleteHrResource(resource, selected.value.id);
    selectedId.value = null;
    draft.value = null;
    await load();
  } catch (err) {
    error.value = err.message || t('Could not delete the template');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="hr-tpl">
    <header class="hr-tpl__head">
      <div>
        <p>{{ t('Contract templates') }}</p>
        <h3>{{ t('Reusable contract and agreement bodies') }}</h3>
        <span>{{ t('Write the document once with placeholders. Issuing fills them in and freezes the result.') }}</span>
      </div>
      <Button v-if="canCreate" :label="t('New template')" icon="pi pi-plus" :disabled="loading" @click="startNew" />
    </header>

    <div v-if="error" class="hr-tpl__error">
      <i class="pi pi-exclamation-circle" /> <strong>{{ error }}</strong>
      <Button :label="t('Try again')" severity="secondary" outlined size="small" @click="load" />
    </div>

    <div class="hr-tpl__grid">
      <!-- template list -->
      <aside class="hr-tpl__list">
        <button
          v-for="item in templates"
          :key="item.id"
          type="button"
          :class="{ 'is-active': item.id === selectedId }"
          @click="select(item.id)"
        >
          <strong>{{ item.name }}</strong>
          <span>
            <Tag :value="t(item.kind === 'employment' ? 'Employment' : 'Memo deal')" :severity="item.kind === 'employment' ? 'info' : 'warn'" />
            <code>{{ item.code }}</code>
          </span>
        </button>
        <p v-if="!templates.length && !loading" class="hr-tpl__empty">{{ t('No templates yet.') }}</p>
      </aside>

      <!-- editor -->
      <div v-if="draft" class="hr-tpl__editor">
        <div class="hr-tpl__fields">
          <label>
            <span>{{ t('Template kind') }}</span>
            <Select v-model="draft.kind" :options="KINDS" :disabled="!canManage" :option-label="(k) => t(k === 'employment' ? 'Employment' : 'Memo deal')" />
          </label>
          <label>
            <span>{{ t('Template name') }}</span>
            <InputText v-model="draft.name" :disabled="!canManage" />
          </label>
          <label>
            <span>{{ t('Code') }}</span>
            <InputText v-model="draft.code" :disabled="!canManage || !isNew" />
          </label>
          <label class="is-full">
            <span>{{ t('Description') }}</span>
            <InputText v-model="draft.description" :disabled="!canManage" />
          </label>
        </div>

        <div v-if="canManage" class="hr-tpl__tokens">
          <p>{{ t('Insert a placeholder') }}</p>
          <div v-for="group in tokenGroups" :key="group.namespace" class="hr-tpl__token-group">
            <span>{{ group.namespace }}</span>
            <button
              v-for="token in group.items"
              :key="token.token"
              type="button"
              :title="`${token.label} — ${token.token}`"
              @click="insertToken(token.token)"
            >{{ token.label }}</button>
          </div>
          <small>{{ t('For a fill-in blank, write {token} anywhere in the body.', { token: CUSTOM_TOKEN_EXAMPLE }) }}</small>
        </div>

        <label class="hr-tpl__body">
          <span>{{ t('Body') }}</span>
          <Textarea ref="bodyRef" v-model="draft.body" rows="18" :disabled="!canManage" spellcheck="false" />
        </label>

        <div class="hr-tpl__actions">
          <Button :label="t('Save template')" icon="pi pi-check" :disabled="!canManage || !dirty || saving" :loading="saving" @click="save" />
          <Button :label="t('Cancel')" severity="secondary" outlined :disabled="saving" @click="cancelEdit" />
          <Button
            v-if="canManage && !isNew"
            :label="t('Delete')"
            severity="danger"
            outlined
            :disabled="saving"
            @click="removeTemplate"
          />
        </div>
      </div>

      <!-- preview -->
      <div v-if="draft" class="hr-tpl__preview">
        <header>
          <strong>{{ t('Preview') }}</strong>
          <small v-if="previewing">{{ t('Rendering…') }}</small>
        </header>

        <div v-if="preview.unknown.length" class="hr-tpl__warn is-error">
          <i class="pi pi-times-circle" />
          <div>
            <strong>{{ t('Unknown placeholders') }}</strong>
            <p>{{ t('These are not in the catalog and will print as-is:') }} {{ preview.unknown.join(', ') }}</p>
          </div>
        </div>
        <div v-if="preview.conditional.length" class="hr-tpl__warn">
          <i class="pi pi-info-circle" />
          <div>
            <strong>{{ t('Needs an employee-backed party') }}</strong>
            <p>{{ t('A memo may be signed with an external party. These only resolve for an employee:') }} {{ preview.conditional.join(', ') }}</p>
          </div>
        </div>
        <div v-if="preview.blanks.length" class="hr-tpl__blanks">
          <strong>{{ t('Blanks to fill at issue time') }}</strong>
          <ul>
            <li v-for="blank in preview.blanks" :key="blank">
              {{ blankLabels[blank]?.label || blank }} <code>{{ blank }}</code>
            </li>
          </ul>
        </div>

        <pre>{{ preview.rendered || t('Nothing to preview yet.') }}</pre>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hr-tpl { display: grid; gap: 14px; min-width: 0; }
.hr-tpl__head { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 18px 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); }
.hr-tpl__head p { margin: 0 0 4px; color: var(--tm-gold); font-size: .66rem; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; }
.hr-tpl__head h3 { margin: 0; color: var(--tm-heading); font-size: 1.1rem; letter-spacing: -.03em; }
.hr-tpl__head span { display: block; margin-top: 5px; color: var(--tm-muted); font-size: .82rem; }
.hr-tpl__error { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--tm-coral); border-radius: 12px; background: color-mix(in srgb, var(--tm-coral) 8%, transparent); }
.hr-tpl__error i { color: var(--tm-coral); }
.hr-tpl__grid { display: grid; grid-template-columns: minmax(200px, 240px) minmax(0, 1.1fr) minmax(0, 1fr); gap: 14px; align-items: start; }
.hr-tpl__list { display: grid; gap: 7px; align-content: start; }
.hr-tpl__list button { display: grid; gap: 6px; padding: 11px 12px; border: 1px solid var(--tm-border); border-radius: 12px; background: var(--tm-surface); cursor: pointer; text-align: left; }
.hr-tpl__list button:hover { border-color: var(--tm-charcoal); }
.hr-tpl__list button.is-active { border-color: var(--tm-charcoal); background: var(--tm-surface-soft); }
.hr-tpl__list strong { color: var(--tm-heading); font-size: .84rem; }
.hr-tpl__list span { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
.hr-tpl__list code, .hr-tpl__blanks code { color: var(--tm-muted); font-size: .7rem; }
.hr-tpl__empty { color: var(--tm-muted); font-size: .82rem; }
.hr-tpl__editor, .hr-tpl__preview { display: grid; gap: 12px; min-width: 0; padding: 16px; border: 1px solid var(--tm-border); border-radius: 16px; background: var(--tm-surface); }
.hr-tpl__fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.hr-tpl__fields label, .hr-tpl__body { display: grid; gap: 5px; min-width: 0; }
.hr-tpl__fields label.is-full { grid-column: 1 / -1; }
.hr-tpl__fields span, .hr-tpl__body span { color: var(--tm-heading); font-size: .77rem; font-weight: 850; }
.hr-tpl__fields :deep(.p-inputtext), .hr-tpl__fields :deep(.p-select) { width: 100%; }
.hr-tpl__tokens { display: grid; gap: 7px; padding: 11px; border: 1px dashed var(--tm-border); border-radius: 12px; }
.hr-tpl__tokens > p { margin: 0; color: var(--tm-heading); font-size: .77rem; font-weight: 850; }
.hr-tpl__tokens small { color: var(--tm-muted); font-size: .72rem; }
.hr-tpl__token-group { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.hr-tpl__token-group > span { min-width: 66px; color: var(--tm-gold); font-size: .68rem; font-weight: 900; text-transform: uppercase; }
.hr-tpl__token-group button { padding: 3px 8px; border: 1px solid var(--tm-border); border-radius: 7px; background: var(--tm-surface-soft); color: var(--tm-heading); cursor: pointer; font-size: .71rem; }
.hr-tpl__token-group button:hover { border-color: var(--tm-charcoal); }
.hr-tpl__body :deep(.p-textarea) { width: 100%; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .78rem; line-height: 1.55; }
.hr-tpl__actions { display: flex; gap: 8px; flex-wrap: wrap; }
.hr-tpl__preview header { display: flex; align-items: center; justify-content: space-between; }
.hr-tpl__preview header strong { color: var(--tm-heading); }
.hr-tpl__preview header small { color: var(--tm-muted); }
.hr-tpl__preview pre { max-height: 620px; margin: 0; overflow: auto; padding: 16px; border-radius: 10px; background: var(--tm-surface-soft); color: var(--tm-heading); font-family: ui-serif, Georgia, serif; font-size: .8rem; line-height: 1.62; white-space: pre-wrap; word-break: break-word; }
.hr-tpl__warn { display: flex; gap: 9px; padding: 10px 12px; border: 1px solid var(--tm-border); border-radius: 11px; background: var(--tm-surface-soft); }
.hr-tpl__warn.is-error { border-color: var(--tm-coral); background: color-mix(in srgb, var(--tm-coral) 8%, transparent); }
.hr-tpl__warn.is-error i { color: var(--tm-coral); }
.hr-tpl__warn strong { display: block; color: var(--tm-heading); font-size: .78rem; }
.hr-tpl__warn p { margin: 3px 0 0; color: var(--tm-muted); font-size: .75rem; word-break: break-word; }
.hr-tpl__blanks { display: grid; gap: 5px; }
.hr-tpl__blanks strong { color: var(--tm-heading); font-size: .78rem; }
.hr-tpl__blanks ul { display: flex; gap: 6px; flex-wrap: wrap; margin: 0; padding: 0; list-style: none; }
.hr-tpl__blanks li { display: flex; align-items: center; gap: 5px; padding: 3px 8px; border: 1px solid var(--tm-border); border-radius: 7px; font-size: .73rem; }
@media (max-width: 1250px) { .hr-tpl__grid { grid-template-columns: minmax(0, 1fr); } }
</style>
