<script setup>
import { computed, onMounted, ref, watch } from 'vue';

import {
  applyPositionTemplate,
  listHrLookup,
  loadPositionHierarchy,
  updatePositionHierarchy,
} from '@/api/hr';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';
import { localizedValue } from '@/utils/localized';

// Editor for a department's base position hierarchy: the parent chain + rank
// that seeds onboarding managers and drives the "Next position up" leave
// approval step. The backend enforces same-department parents and cycle rules;
// this screen just makes the ladder visible and quick to wire, and can scaffold
// a canonical ladder with one click.
const { language, t } = useAdminI18n();

// Position titles carry per-locale copy (the base ladder seeds both languages),
// so every rendering of a title goes through the console language.
function nodeTitle(node) {
  return node ? localizedValue(node, 'title', language.value) : '';
}
const auth = useAuthStore();

const departments = ref([]);
const selectedDept = ref(null);
const nodes = ref([]);
const drafts = ref({});
const loading = ref(false);
const applying = ref(false);
const saving = ref(null);
const confirmApply = ref(false);
const error = ref('');

// Positions require all-scope organization access to mutate; anything narrower
// is view-only here (the backend is the real gate, this only hides controls).
const canManage = computed(() => auth.hrScope('organization', 'view') === 'all');
const departmentOptions = computed(() => departments.value.map((d) => ({ label: d.name || d.title || `#${d.id}`, value: d.id })));

function sortNodes(a, b) {
  return (a.hierarchy_rank || 0) - (b.hierarchy_rank || 0) || nodeTitle(a).localeCompare(nodeTitle(b));
}

const byId = computed(() => {
  const map = new Map();
  nodes.value.forEach((node) => map.set(node.id, node));
  return map;
});

// Parents are always in the same department, so the localized title is resolved
// from the loaded tree; the server-joined title is only a fallback.
function parentTitle(node) {
  const parent = byId.value.get(node.parent_position_id);
  return parent ? nodeTitle(parent) : (node.parent_position_title || '');
}

const childrenMap = computed(() => {
  const map = new Map();
  for (const node of nodes.value) {
    const parent = node.parent_position_id;
    if (parent != null && byId.value.has(parent)) {
      if (!map.has(parent)) map.set(parent, []);
      map.get(parent).push(node);
    }
  }
  return map;
});

// Depth-first ordered rows so parents render directly above their reports.
const rows = computed(() => {
  const roots = nodes.value.filter((node) => node.parent_position_id == null || !byId.value.has(node.parent_position_id));
  roots.sort(sortNodes);
  const out = [];
  const seen = new Set();
  const walk = (node, depth) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    out.push({ node, depth });
    [...(childrenMap.value.get(node.id) || [])].sort(sortNodes).forEach((child) => walk(child, depth + 1));
  };
  roots.forEach((root) => walk(root, 0));
  // Cycle safety: never drop a node just because it forms a loop.
  nodes.value.forEach((node) => {
    if (!seen.has(node.id)) {
      seen.add(node.id);
      out.push({ node, depth: 0 });
    }
  });
  return out;
});

function descendantIds(id) {
  const blocked = new Set();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop();
    for (const child of childrenMap.value.get(current) || []) {
      if (!blocked.has(child.id)) {
        blocked.add(child.id);
        stack.push(child.id);
      }
    }
  }
  return blocked;
}

function parentOptions(node) {
  const blocked = descendantIds(node.id);
  blocked.add(node.id);
  const options = nodes.value
    .filter((candidate) => !blocked.has(candidate.id))
    .sort(sortNodes)
    .map((candidate) => ({ label: `${nodeTitle(candidate)} · ${t('rank')} ${candidate.hierarchy_rank || 0}`, value: candidate.id }));
  return [{ label: t('— Top of ladder —'), value: null }, ...options];
}

function draftFor(id) {
  return drafts.value[id] || { parent: null, rank: 0 };
}

function dirty(node) {
  const draft = draftFor(node.id);
  return (draft.parent ?? null) !== (node.parent_position_id ?? null) || Number(draft.rank || 0) !== Number(node.hierarchy_rank || 0);
}

function rebuildDrafts() {
  const next = {};
  nodes.value.forEach((node) => {
    next[node.id] = { parent: node.parent_position_id ?? null, rank: node.hierarchy_rank ?? 0 };
  });
  drafts.value = next;
}

async function load() {
  if (!selectedDept.value) {
    nodes.value = [];
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    nodes.value = await loadPositionHierarchy(selectedDept.value);
    rebuildDrafts();
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function save(node) {
  const draft = draftFor(node.id);
  saving.value = node.id;
  error.value = '';
  try {
    await updatePositionHierarchy(node.id, {
      parent_position_id: draft.parent ?? null,
      hierarchy_rank: Number(draft.rank) || 0,
    });
    await load();
  } catch (err) {
    error.value = err.message;
  } finally {
    saving.value = null;
  }
}

async function applyTemplate() {
  if (!selectedDept.value) return;
  applying.value = true;
  error.value = '';
  try {
    nodes.value = await applyPositionTemplate(selectedDept.value);
    rebuildDrafts();
    confirmApply.value = false;
  } catch (err) {
    error.value = err.message;
  } finally {
    applying.value = false;
  }
}

watch(selectedDept, load);

onMounted(async () => {
  try {
    departments.value = await listHrLookup('departments');
    if (departments.value.length) selectedDept.value = departments.value[0].id;
  } catch (err) {
    error.value = err.message;
  }
});
</script>

<template>
  <section class="hr-ladder">
    <header class="hr-ladder__head">
      <div class="hr-ladder__intro">
        <p>{{ t('Base position hierarchy') }}</p>
        <h3>{{ t('Reporting ladder per department') }}</h3>
        <span>{{ t('Set which position each role reports to. This seeds a new hire\'s manager at onboarding and powers the "Next position up" leave-approval step.') }}</span>
      </div>
      <div class="hr-ladder__controls">
        <Select
          v-model="selectedDept"
          :options="departmentOptions"
          option-label="label"
          option-value="value"
          :placeholder="t('Select a department')"
          class="hr-ladder__dept"
        />
        <Button
          v-if="canManage"
          :label="t('Apply base template')"
          icon="pi pi-bolt"
          severity="secondary"
          outlined
          :disabled="!selectedDept || applying"
          @click="confirmApply = true"
        />
      </div>
    </header>

    <div v-if="confirmApply" class="hr-ladder__confirm">
      <i class="pi pi-info-circle" />
      <div>
        <strong>{{ t('Apply the canonical ladder to this department?') }}</strong>
        <p>{{ t('Missing rungs (Department Head → Manager → Team Lead → Senior Officer → Officer → Junior Officer) are created and re-linked in order. Existing positions with matching codes are re-wired, not duplicated.') }}</p>
      </div>
      <div class="hr-ladder__confirm-actions">
        <Button :label="t('Cancel')" severity="secondary" text :disabled="applying" @click="confirmApply = false" />
        <Button :label="t('Apply template')" icon="pi pi-check" :loading="applying" @click="applyTemplate" />
      </div>
    </div>

    <div v-if="error" class="hr-ladder__error">
      <i class="pi pi-exclamation-circle" /> {{ error }}
      <Button :label="t('Try again')" severity="secondary" text @click="load" />
    </div>

    <div v-if="loading" class="hr-ladder__muted">{{ t('Loading…') }}</div>

    <div v-else-if="!nodes.length" class="hr-ladder__empty">
      <i class="pi pi-sitemap" />
      <h4>{{ t('No positions in this department yet') }}</h4>
      <p>{{ t('Create positions in the Positions tab, or apply the base template to scaffold a standard ladder.') }}</p>
      <Button v-if="canManage" :label="t('Apply base template')" icon="pi pi-bolt" :disabled="!selectedDept" @click="confirmApply = true" />
    </div>

    <ul v-else class="hr-ladder__tree" :class="{ 'is-busy': saving !== null }">
      <li v-for="{ node, depth } in rows" :key="node.id" class="hr-ladder__row" :style="{ '--depth': depth }">
        <div class="hr-ladder__marker"><span class="hr-ladder__rank">{{ node.hierarchy_rank || 0 }}</span></div>
        <div class="hr-ladder__body">
          <div class="hr-ladder__title">
            <strong>{{ nodeTitle(node) }}</strong>
            <code>{{ node.code }}</code>
            <Tag v-if="node.grade" :value="node.grade" severity="secondary" />
            <Tag v-if="!node.is_active" :value="t('Inactive')" severity="warn" />
          </div>
          <div class="hr-ladder__holders">
            <template v-if="node.holders && node.holders.length">
              <span v-for="holder in node.holders" :key="holder.id" class="hr-ladder__holder">{{ holder.name }}</span>
            </template>
            <span v-else class="hr-ladder__vacant">{{ t('Vacant') }}</span>
          </div>
        </div>
        <div v-if="canManage" class="hr-ladder__edit">
          <label>
            <span>{{ t('Reports to') }}</span>
            <Select
              v-model="draftFor(node.id).parent"
              :options="parentOptions(node)"
              option-label="label"
              option-value="value"
              class="hr-ladder__parent"
            />
          </label>
          <label class="hr-ladder__rank-field">
            <span>{{ t('Rank') }}</span>
            <input v-model.number="draftFor(node.id).rank" type="number" min="0" />
          </label>
          <Button
            icon="pi pi-check"
            :label="t('Save')"
            size="small"
            :disabled="!dirty(node)"
            :loading="saving === node.id"
            @click="save(node)"
          />
        </div>
        <div v-else class="hr-ladder__readonly">
          <span>{{ t('Reports to') }}: {{ parentTitle(node) || t('— Top of ladder —') }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.hr-ladder { display: grid; gap: 14px; overflow: hidden; padding: 18px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); }
.hr-ladder__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.hr-ladder__intro p { margin: 0 0 4px; color: var(--tm-gold); font-size: .68rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
.hr-ladder__intro h3 { margin: 0; color: var(--tm-heading); font-size: 1.25rem; letter-spacing: -.02em; }
.hr-ladder__intro span { display: block; max-width: 60ch; margin-top: 6px; color: var(--tm-muted); font-size: .82rem; line-height: 1.45; }
.hr-ladder__controls { display: flex; gap: 8px; flex-wrap: wrap; }
.hr-ladder__dept { min-width: 220px; }
.hr-ladder__confirm { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border: 1px solid var(--tm-border); border-radius: 12px; background: var(--tm-surface-soft); }
.hr-ladder__confirm i { color: var(--tm-gold); font-size: 1.1rem; }
.hr-ladder__confirm strong { color: var(--tm-heading); }
.hr-ladder__confirm p { margin: 4px 0 0; color: var(--tm-muted); font-size: .8rem; line-height: 1.4; }
.hr-ladder__confirm-actions { display: flex; gap: 6px; margin-left: auto; flex: 0 0 auto; }
.hr-ladder__error { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 11px; background: rgba(214,69,69,.08); color: var(--tm-coral); }
.hr-ladder__muted { padding: 24px; color: var(--tm-muted); text-align: center; }
.hr-ladder__empty { display: grid; justify-items: center; gap: 8px; padding: 40px 16px; text-align: center; }
.hr-ladder__empty i { color: var(--tm-gold); font-size: 2rem; }
.hr-ladder__empty h4 { margin: 0; color: var(--tm-heading); }
.hr-ladder__empty p { margin: 0; max-width: 46ch; color: var(--tm-muted); font-size: .82rem; }
.hr-ladder__tree { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; transition: opacity .15s; }
.hr-ladder__tree.is-busy { opacity: .6; pointer-events: none; }
.hr-ladder__row { display: flex; align-items: center; gap: 12px; padding: 10px 12px; margin-left: calc(var(--depth) * 26px); border: 1px solid var(--tm-border); border-radius: 12px; background: var(--tm-surface); }
.hr-ladder__row[style*="--depth: 0"] { border-left: 3px solid var(--tm-gold); }
.hr-ladder__marker { flex: 0 0 auto; }
.hr-ladder__rank { display: grid; width: 28px; height: 28px; border-radius: 8px; background: var(--tm-charcoal); color: var(--tm-gold); font-size: .8rem; font-weight: 900; place-items: center; }
.hr-ladder__body { flex: 1 1 auto; min-width: 0; }
.hr-ladder__title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.hr-ladder__title strong { color: var(--tm-heading); }
.hr-ladder__title code { color: var(--tm-muted); font-size: .74rem; }
.hr-ladder__holders { display: flex; gap: 5px; margin-top: 4px; flex-wrap: wrap; }
.hr-ladder__holder { padding: 2px 8px; border-radius: 20px; background: rgba(12,155,128,.12); color: var(--tm-emerald); font-size: .7rem; font-weight: 700; }
.hr-ladder__vacant { color: var(--tm-muted); font-size: .72rem; font-style: italic; }
.hr-ladder__edit { display: flex; align-items: flex-end; gap: 8px; flex: 0 0 auto; flex-wrap: wrap; }
.hr-ladder__edit label { display: grid; gap: 3px; }
.hr-ladder__edit label span { color: var(--tm-muted); font-size: .66rem; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; }
.hr-ladder__parent { min-width: 200px; }
.hr-ladder__rank-field input { width: 66px; padding: 7px 8px; border: 1px solid var(--tm-border); border-radius: 8px; background: var(--tm-surface); color: var(--tm-heading); font: inherit; }
.hr-ladder__readonly { flex: 0 0 auto; color: var(--tm-muted); font-size: .78rem; }

@media (max-width: 860px) {
  .hr-ladder__row { align-items: stretch; flex-direction: column; }
  .hr-ladder__edit { justify-content: flex-start; }
}
</style>
