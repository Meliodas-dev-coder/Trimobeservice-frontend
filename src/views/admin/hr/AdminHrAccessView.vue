<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

import {
  listHrLookup,
  loadDepartmentAccess,
  loadHrAccessCatalog,
  loadPositionAccess,
  saveDepartmentAccess,
  savePositionAccess,
} from '@/api/hr';
import HrWorkspaceNav from '@/components/admin/hr/HrWorkspaceNav.vue';
import { scopeLabel } from '@/data/hrAccess';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const toast = useToast();
const { enumLabel, t } = useAdminI18n();

const loading = ref(true);
const loadingDepartment = ref(false);
const loadingPosition = ref(false);
const savingDepartment = ref(false);
const savingPosition = ref(false);
const error = ref('');
const catalog = ref({ modules: [], access_levels: ['read', 'manage'], hr_features: [], hr_actions: [], scopes: [] });
const departments = ref([]);
const positions = ref([]);
const selectedDepartmentId = ref(null);
const selectedPositionId = ref(null);
const departmentModules = ref([]);
const positionCapabilities = ref({});
const positionPolicies = ref({});

const departmentOptions = computed(() => departments.value.map((item) => ({
  ...item,
  label: item.name || item.label,
  value: Number(item.id ?? item.value),
})));
const selectedDepartment = computed(() => departmentOptions.value.find((item) => item.value === selectedDepartmentId.value));
const positionOptions = computed(() => positions.value
  .filter((item) => !selectedDepartmentId.value || Number(item.department_id) === selectedDepartmentId.value)
  .map((item) => ({ ...item, label: item.title || item.label, value: Number(item.id ?? item.value) })));
const selectedPosition = computed(() => positionOptions.value.find((item) => item.value === selectedPositionId.value));
const allowedModules = computed(() => catalog.value.modules.filter((module) => departmentModules.value.includes(module.key)));

function featureKey(feature) {
  return typeof feature === 'string' ? feature : feature?.key;
}

function featureLabel(feature) {
  return typeof feature === 'string' ? enumLabel(feature) : t(feature?.label || feature?.key);
}

function actionOptions(feature) {
  const actions = (typeof feature === 'object' && feature?.actions?.length)
    ? feature.actions
    : catalog.value.hr_actions || ['view', 'create', 'edit', 'download', 'submit', 'approve', 'reject', 'cancel', 'export'];
  return actions.map((action) => ({
    label: typeof action === 'string' ? enumLabel(action) : t(action.label || action.key),
    value: typeof action === 'string' ? action : action.key,
  }));
}

function scopeOptions() {
  return (catalog.value.scopes || []).map((scope) => ({
    label: t(scopeLabel(typeof scope === 'string' ? scope : scope.key)),
    value: typeof scope === 'string' ? scope : scope.key,
  }));
}

function normalizePolicies(policies = []) {
  const next = {};
  for (const feature of catalog.value.hr_features || []) {
    const key = featureKey(feature);
    const current = policies.find((policy) => policy.feature === key);
    next[key] = {
      enabled: Boolean(current),
      actions: [...(current?.actions || [])],
      scope: current?.scope || 'self',
    };
  }
  positionPolicies.value = next;
}

function toggleDepartmentModule(key, enabled) {
  departmentModules.value = enabled
    ? [...new Set([...departmentModules.value, key])]
    : departmentModules.value.filter((module) => module !== key);
}

function capabilityLevel(key) {
  return positionCapabilities.value[key] || 'read';
}

function toggleCapability(key, enabled) {
  const next = { ...positionCapabilities.value };
  if (enabled) next[key] = next[key] || 'read';
  else delete next[key];
  positionCapabilities.value = next;
}

function setCapabilityLevel(key, level) {
  positionCapabilities.value = { ...positionCapabilities.value, [key]: level };
}

async function loadDepartment() {
  if (!selectedDepartmentId.value) return;
  loadingDepartment.value = true;
  try {
    const data = await loadDepartmentAccess(selectedDepartmentId.value);
    departmentModules.value = [...(data?.modules || data?.department_access?.modules || data?.access?.modules || [])];
  } catch (err) {
    error.value = err.message;
  } finally {
    loadingDepartment.value = false;
  }
}

async function loadPosition() {
  if (!selectedPositionId.value) {
    positionCapabilities.value = {};
    normalizePolicies();
    return;
  }
  loadingPosition.value = true;
  try {
    const data = await loadPositionAccess(selectedPositionId.value);
    const access = data?.position_access || data?.access || data || {};
    positionCapabilities.value = Object.fromEntries((access.capabilities || []).map((item) => [item.key, item.access_level || 'read']));
    normalizePolicies(access.hr_policies || []);
  } catch (err) {
    error.value = err.message;
  } finally {
    loadingPosition.value = false;
  }
}

async function saveDepartment() {
  savingDepartment.value = true;
  try {
    await saveDepartmentAccess(selectedDepartmentId.value, departmentModules.value);
    toast.add({ severity: 'success', summary: t('Access saved'), detail: t('Department module access has been updated.'), life: 2800 });
    // A narrower department boundary may remove capabilities from its positions.
    if (selectedPositionId.value) await loadPosition();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not save access'), detail: err.message, life: 5000 });
  } finally {
    savingDepartment.value = false;
  }
}

async function savePosition() {
  savingPosition.value = true;
  try {
    const capabilities = Object.entries(positionCapabilities.value).map(([key, access_level]) => ({ key, access_level }));
    const hr_policies = Object.entries(positionPolicies.value)
      .filter(([, policy]) => policy.enabled && policy.actions.length)
      .map(([feature, policy]) => ({ feature, actions: policy.actions, scope: policy.scope }));
    await savePositionAccess(selectedPositionId.value, { capabilities, hr_policies });
    toast.add({ severity: 'success', summary: t('Access saved'), detail: t('Position access has been updated.'), life: 2800 });
    await loadPosition();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not save access'), detail: err.message, life: 5000 });
  } finally {
    savingPosition.value = false;
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [catalogData, departmentData, positionData] = await Promise.all([
      loadHrAccessCatalog(),
      listHrLookup('departments'),
      listHrLookup('positions'),
    ]);
    catalog.value = { ...catalog.value, ...(catalogData?.access_catalog || catalogData?.catalog || catalogData || {}) };
    normalizePolicies();
    departments.value = departmentData;
    positions.value = positionData;
    selectedDepartmentId.value = departmentOptions.value[0]?.value || null;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

watch(selectedDepartmentId, async () => {
  selectedPositionId.value = null;
  await loadDepartment();
  selectedPositionId.value = positionOptions.value[0]?.value || null;
});
watch(selectedPositionId, loadPosition);
onMounted(load);
</script>

<template>
  <section class="hr-access">
    <HrWorkspaceNav />

    <header class="hr-access__hero">
      <span><i class="pi pi-shield" /></span>
      <div>
        <p>{{ t('Super administrator') }}</p>
        <h2>{{ t('Organization access control') }}</h2>
        <div>{{ t('Departments set the maximum business modules. Positions choose the visible submenus, read or manage level, and scoped HR responsibilities.') }}</div>
      </div>
    </header>

    <div v-if="!auth.isSuperAdmin" class="hr-access__state">
      <i class="pi pi-lock" />
      <h3>{{ t('Super-admin access required') }}</h3>
      <p>{{ t('Only the protected super-admin account can change organization access rules.') }}</p>
    </div>
    <div v-else-if="error && !catalog.modules.length" class="hr-access__state is-error">
      <i class="pi pi-exclamation-circle" />
      <h3>{{ t('Access control is not available yet') }}</h3>
      <p>{{ error }}</p>
      <Button :label="t('Try again')" severity="secondary" outlined @click="load" />
    </div>
    <template v-else>
      <section class="hr-access__selectors">
        <label>
          <span>{{ t('Department') }}</span>
          <Select v-model="selectedDepartmentId" :options="departmentOptions" option-label="label" option-value="value" filter :loading="loading" />
        </label>
        <label>
          <span>{{ t('Position') }}</span>
          <Select v-model="selectedPositionId" :options="positionOptions" option-label="label" option-value="value" filter :disabled="!selectedDepartmentId" :loading="loading" />
        </label>
        <div>
          <Tag :value="selectedDepartment?.label || t('No department selected')" severity="secondary" />
          <Tag v-if="selectedPosition" :value="selectedPosition.label" severity="info" />
        </div>
      </section>

      <section class="hr-access__panel">
        <header>
          <div><p>{{ t('Department boundary') }}</p><h3>{{ t('Allowed business modules') }}</h3><span>{{ t('Positions in this department cannot receive a submenu outside this boundary.') }}</span></div>
          <Button :label="t('Save department access')" icon="pi pi-check" :disabled="!selectedDepartmentId" :loading="savingDepartment" @click="saveDepartment" />
        </header>
        <div v-if="loadingDepartment" class="hr-access__skeleton"><Skeleton v-for="index in 4" :key="index" height="76px" /></div>
        <div v-else class="hr-access__modules">
          <label v-for="module in catalog.modules" :key="module.key" :class="{ 'is-selected': departmentModules.includes(module.key) }">
            <Checkbox :model-value="departmentModules.includes(module.key)" binary @update:model-value="toggleDepartmentModule(module.key, $event)" />
            <i :class="module.icon || 'pi pi-th-large'" />
            <span><strong>{{ t(module.label || module.key) }}</strong><small>{{ t('{n} submenus available', { n: module.capabilities?.length || 0 }) }}</small></span>
          </label>
        </div>
      </section>

      <section class="hr-access__panel">
        <header>
          <div><p>{{ t('Position defaults') }}</p><h3>{{ t('Business submenu access') }}</h3><span>{{ t('Read shows the submenu without modification controls. Manage allows changes permitted by the backend workflow.') }}</span></div>
          <Button :label="t('Save position access')" icon="pi pi-check" :disabled="!selectedPositionId" :loading="savingPosition" @click="savePosition" />
        </header>
        <div v-if="!selectedPositionId" class="hr-access__empty"><i class="pi pi-briefcase" /><span>{{ t('Choose a position to configure its access.') }}</span></div>
        <div v-else-if="loadingPosition" class="hr-access__skeleton"><Skeleton v-for="index in 5" :key="index" height="62px" /></div>
        <div v-else class="hr-access__capability-groups">
          <article v-for="module in allowedModules" :key="module.key">
            <header><i :class="module.icon || 'pi pi-th-large'" /><strong>{{ t(module.label || module.key) }}</strong></header>
            <label v-for="capability in module.capabilities || []" :key="capability.key">
              <Checkbox :model-value="Boolean(positionCapabilities[capability.key])" binary @update:model-value="toggleCapability(capability.key, $event)" />
              <span><strong>{{ t(capability.label || capability.key) }}</strong><small>{{ capability.key }}</small></span>
              <Select
                :model-value="capabilityLevel(capability.key)"
                :options="catalog.access_levels"
                :option-label="(value) => enumLabel(value)"
                :disabled="!positionCapabilities[capability.key]"
                @update:model-value="setCapabilityLevel(capability.key, $event)"
              />
            </label>
          </article>
          <div v-if="!allowedModules.length" class="hr-access__empty"><i class="pi pi-lock" /><span>{{ t('Grant at least one department module before configuring this position.') }}</span></div>
        </div>
      </section>

      <section class="hr-access__panel">
        <header>
          <div><p>{{ t('Scoped HR responsibility') }}</p><h3>{{ t('What this position can do in HR') }}</h3><span>{{ t('Every employee keeps self-service access. These rules add manager, department-tree, or organization-wide responsibilities.') }}</span></div>
        </header>
        <div v-if="!selectedPositionId" class="hr-access__empty"><i class="pi pi-users" /><span>{{ t('Choose a position to configure its HR responsibilities.') }}</span></div>
        <div v-else class="hr-access__policies">
          <div class="hr-access__policy-head"><span>{{ t('Feature') }}</span><span>{{ t('Allowed actions') }}</span><span>{{ t('Employee scope') }}</span></div>
          <div v-for="feature in catalog.hr_features" :key="featureKey(feature)" class="hr-access__policy">
            <label><Checkbox v-model="positionPolicies[featureKey(feature)].enabled" binary /><strong>{{ featureLabel(feature) }}</strong></label>
            <MultiSelect
              v-model="positionPolicies[featureKey(feature)].actions"
              :options="actionOptions(feature)"
              option-label="label"
              option-value="value"
              display="chip"
              :placeholder="t('Choose actions')"
              :disabled="!positionPolicies[featureKey(feature)].enabled"
            />
            <Select
              v-model="positionPolicies[featureKey(feature)].scope"
              :options="scopeOptions()"
              option-label="label"
              option-value="value"
              :disabled="!positionPolicies[featureKey(feature)].enabled"
            />
          </div>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.hr-access { display: grid; gap: 16px; min-width: 0; }
.hr-access__hero { display: flex; align-items: center; gap: 14px; padding: 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: radial-gradient(circle at 100% 0%,rgba(201,146,44,.12),transparent 46%),var(--tm-surface); box-shadow: 0 10px 28px rgba(37,31,20,.045); }
.hr-access__hero > span { display: grid; width: 48px; height: 48px; flex: 0 0 auto; border-radius: 14px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.hr-access__hero p,.hr-access__panel > header p { margin: 0 0 4px; color: var(--tm-gold); font-size: .68rem; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; }
.hr-access__hero h2,.hr-access__panel h3 { margin: 0; color: var(--tm-heading); letter-spacing: -.035em; }.hr-access__hero h2 { font-size: 1.55rem; }.hr-access__hero div > div,.hr-access__panel header span { display: block; max-width: 900px; margin-top: 6px; color: var(--tm-muted); font-size: .84rem; line-height: 1.5; }
.hr-access__selectors { display: grid; grid-template-columns: repeat(2,minmax(220px,1fr)) auto; align-items: end; gap: 12px; padding: 14px; border: 1px solid var(--tm-border); border-radius: 15px; background: var(--tm-surface-soft); }.hr-access__selectors label { display: grid; gap: 6px; color: var(--tm-heading); font-size: .76rem; font-weight: 850; }.hr-access__selectors :deep(.p-select) { width: 100%; }.hr-access__selectors > div { display: flex; flex-wrap: wrap; gap: 6px; padding-bottom: 7px; }
.hr-access__panel { overflow: hidden; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 10px 28px rgba(37,31,20,.045); }.hr-access__panel > header { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 16px 18px; border-bottom: 1px solid var(--tm-border); }.hr-access__panel h3 { font-size: 1.12rem; }
.hr-access__modules { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 9px; padding: 14px; }.hr-access__modules > label { display: flex; align-items: center; gap: 10px; min-height: 76px; padding: 12px; border: 1px solid var(--tm-border); border-radius: 13px; background: var(--tm-surface-soft); cursor: pointer; }.hr-access__modules > label.is-selected { border-color: color-mix(in srgb,var(--tm-emerald) 42%,var(--tm-border)); background: color-mix(in srgb,var(--tm-emerald) 7%,var(--tm-surface)); }.hr-access__modules label > i { color: var(--tm-gold); font-size: 1.15rem; }.hr-access__modules span,.hr-access__capability-groups label span { display: grid; gap: 3px; min-width: 0; }.hr-access__modules strong,.hr-access__capability-groups strong { color: var(--tm-heading); font-size: .8rem; }.hr-access__modules small,.hr-access__capability-groups small { color: var(--tm-muted); font-size: .66rem; }
.hr-access__capability-groups { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; padding: 14px; }.hr-access__capability-groups article { overflow: hidden; border: 1px solid var(--tm-border); border-radius: 14px; }.hr-access__capability-groups article > header { display: flex; align-items: center; gap: 8px; padding: 11px 13px; background: var(--tm-charcoal); color: #fff8ed; }.hr-access__capability-groups article > header i { color: var(--tm-gold); }.hr-access__capability-groups article > header strong { color: inherit; }.hr-access__capability-groups article > label { display: grid; grid-template-columns: auto 1fr 120px; align-items: center; gap: 9px; padding: 10px 12px; border-bottom: 1px solid var(--tm-border); }.hr-access__capability-groups article > label:last-child { border: 0; }.hr-access__capability-groups :deep(.p-select) { width: 100%; }
.hr-access__policies { overflow-x: auto; padding: 12px 14px 16px; }.hr-access__policy-head,.hr-access__policy { display: grid; grid-template-columns: minmax(180px,.8fr) minmax(300px,1.4fr) minmax(220px,1fr); align-items: center; gap: 10px; min-width: 760px; }.hr-access__policy-head { padding: 7px 10px; color: var(--tm-muted); font-size: .67rem; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }.hr-access__policy { padding: 9px 10px; border-top: 1px solid var(--tm-border); }.hr-access__policy > label { display: flex; align-items: center; gap: 9px; color: var(--tm-heading); font-size: .79rem; }.hr-access__policy :deep(.p-multiselect),.hr-access__policy :deep(.p-select) { width: 100%; }
.hr-access__empty,.hr-access__state { display: grid; min-height: 180px; align-content: center; justify-items: center; gap: 8px; padding: 24px; color: var(--tm-muted); text-align: center; }.hr-access__empty i,.hr-access__state i { color: var(--tm-gold); font-size: 1.5rem; }.hr-access__state h3 { margin: 4px 0 0; color: var(--tm-heading); }.hr-access__state p { max-width: 620px; margin: 0; }.hr-access__state.is-error i { color: var(--tm-coral); }.hr-access__skeleton { display: grid; gap: 8px; padding: 14px; }
@media (max-width: 920px) { .hr-access__modules { grid-template-columns: repeat(2,minmax(0,1fr)); }.hr-access__capability-groups { grid-template-columns: 1fr; }.hr-access__selectors { grid-template-columns: 1fr 1fr; }.hr-access__selectors > div { grid-column: 1 / -1; } }
@media (max-width: 620px) { .hr-access__hero,.hr-access__panel > header { align-items: flex-start; flex-direction: column; }.hr-access__panel > header :deep(.p-button) { width: 100%; }.hr-access__modules,.hr-access__selectors { grid-template-columns: 1fr; }.hr-access__selectors > div { grid-column: auto; }.hr-access__capability-groups article > label { grid-template-columns: auto 1fr; }.hr-access__capability-groups article > label :deep(.p-select) { grid-column: 2; } }
</style>
