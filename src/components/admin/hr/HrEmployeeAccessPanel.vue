<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'primevue/usetoast';

import { loadEmployeeAccess, provisionEmployeeAccount, updateEmployeeAccount } from '@/api/hr';
import { scopeLabel } from '@/data/hrAccess';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const props = defineProps({
  employee: { type: Object, required: true },
});

const auth = useAuthStore();
const toast = useToast();
const { enumLabel, t } = useAdminI18n();
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const access = ref({});
const accountDialog = ref(false);
const temporaryPassword = ref('');

const account = computed(() => access.value.account || null);
const hasAccount = computed(() => Boolean(account.value?.user_id));
const assignment = computed(() => access.value.organizational_assignment || access.value.assignment || access.value.employee || {
  department_name: props.employee.department_name,
  position_title: props.employee.position_title,
  manager_name: props.employee.manager_name,
});
const businessCapabilities = computed(() => access.value.effective_business_capabilities || access.value.business_capabilities || []);
const hrPolicies = computed(() => access.value.effective_hr_policies || access.value.hr_policies || []);
const canManageAccount = computed(() => auth.isSuperAdmin);
const accountIsActive = computed(() => Boolean(account.value?.is_active));
const accountStatus = computed(() => account.value?.status || (accountIsActive.value ? 'active' : hasAccount.value ? 'disabled' : 'not_provisioned'));

const groupedCapabilities = computed(() => {
  const groups = {};
  for (const item of businessCapabilities.value) {
    const key = typeof item === 'string' ? item : item.key;
    const module = String(key || '').split('.')[0] || 'other';
    (groups[module] ||= []).push(typeof item === 'string' ? { key: item, access_level: 'manage' } : item);
  }
  return groups;
});

function policyActions(policy) {
  return (policy.actions || (policy.action ? [policy.action] : [])).map((action) => enumLabel(action)).join(', ');
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const data = await loadEmployeeAccess(props.employee.id);
    access.value = data?.access || data?.employee_access || data || {};
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function openProvision() {
  temporaryPassword.value = '';
  accountDialog.value = true;
}

async function provision() {
  busy.value = true;
  try {
    const payload = { is_active: true };
    if (temporaryPassword.value) payload.temporary_password = temporaryPassword.value;
    await provisionEmployeeAccount(props.employee.id, payload);
    toast.add({ severity: 'success', summary: t('Account ready'), detail: t('The employee can now sign in to the admin workspace.'), life: 3000 });
    accountDialog.value = false;
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not provision account'), detail: err.message, life: 5000 });
  } finally {
    busy.value = false;
  }
}

async function setActive(is_active) {
  busy.value = true;
  try {
    await updateEmployeeAccount(props.employee.id, { is_active });
    toast.add({
      severity: 'success',
      summary: t(is_active ? 'Account enabled' : 'Account suspended'),
      detail: t(is_active ? 'The employee can sign in again.' : 'The employee has been signed out and can no longer sign in.'),
      life: 3000,
    });
    await load();
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not update account'), detail: err.message, life: 5000 });
  } finally {
    busy.value = false;
  }
}

watch(() => props.employee.id, load);
onMounted(load);
</script>

<template>
  <section class="hr-employee-access">
    <div v-if="loading" class="hr-employee-access__loading"><Skeleton height="150px" /><Skeleton height="240px" /></div>
    <div v-else-if="error" class="hr-employee-access__state is-error">
      <i class="pi pi-exclamation-circle" /><strong>{{ t('Could not load employee access') }}</strong><span>{{ error }}</span>
      <Button :label="t('Try again')" severity="secondary" outlined @click="load" />
    </div>
    <template v-else>
      <section class="hr-employee-access__account">
        <div class="hr-employee-access__account-icon"><i class="pi pi-user" /></div>
        <div>
          <p>{{ t('Admin workspace account') }}</p>
          <h3>{{ account?.email || employee.work_email }}</h3>
          <span>{{ t(hasAccount ? 'This login is linked to the employee HR record.' : 'No login account has been provisioned yet.') }}</span>
          <div>
            <Tag :value="enumLabel(accountStatus)" :severity="accountIsActive ? 'success' : hasAccount ? 'danger' : 'secondary'" />
            <Tag v-if="account?.user_id" :value="t('Account #{id}', { id: account.user_id })" severity="secondary" />
          </div>
        </div>
        <div v-if="canManageAccount" class="hr-employee-access__account-actions">
          <Button v-if="!hasAccount" :label="t('Enable employee login')" icon="pi pi-user-plus" @click="openProvision" />
          <Button v-else-if="accountIsActive" :label="t('Suspend login')" icon="pi pi-ban" severity="danger" outlined :loading="busy" @click="setActive(false)" />
          <Button v-else :label="t('Enable login')" icon="pi pi-check" :loading="busy" @click="setActive(true)" />
        </div>
      </section>

      <section class="hr-employee-access__assignment">
        <header><p>{{ t('Access sources') }}</p><h3>{{ t('Organizational assignment') }}</h3></header>
        <div>
          <article><i class="pi pi-sitemap" /><span>{{ t('Department') }}</span><strong>{{ assignment.department_name || employee.department_name || t('Not assigned') }}</strong></article>
          <article><i class="pi pi-briefcase" /><span>{{ t('Position') }}</span><strong>{{ assignment.position_title || employee.position_title || t('Not assigned') }}</strong></article>
          <article><i class="pi pi-user" /><span>{{ t('Manager') }}</span><strong>{{ assignment.manager_name || employee.manager_name || t('Not assigned') }}</strong></article>
          <article><i class="pi pi-users" /><span>{{ t('Responsibility') }}</span><strong>{{ access.is_department_head ? t('Department head') : access.is_manager ? t('Manager') : t('Employee self-service') }}</strong></article>
        </div>
      </section>

      <section class="hr-employee-access__effective">
        <header>
          <div><p>{{ t('Effective access') }}</p><h3>{{ t('Business workspaces') }}</h3><span>{{ t('The final result after department boundaries and position access are combined.') }}</span></div>
          <Tag :value="t('{n} permissions', { n: businessCapabilities.length })" severity="secondary" />
        </header>
        <div v-if="businessCapabilities.length" class="hr-employee-access__business">
          <article v-for="(items, module) in groupedCapabilities" :key="module">
            <header><i class="pi pi-th-large" /><strong>{{ enumLabel(module) }}</strong></header>
            <div v-for="item in items" :key="item.key"><span>{{ t(item.label || item.key) }}</span><Tag :value="enumLabel(item.access_level || 'read')" :severity="item.access_level === 'manage' ? 'success' : 'secondary'" /></div>
          </article>
        </div>
        <div v-else class="hr-employee-access__empty"><i class="pi pi-lock" /><span>{{ t('No operational workspace is assigned. HR self-service remains available.') }}</span></div>
      </section>

      <section class="hr-employee-access__effective">
        <header>
          <div><p>{{ t('Effective access') }}</p><h3>{{ t('HR permissions and employee scope') }}</h3><span>{{ t('Scope is enforced by the backend for lists, detail pages, exports, notifications, and changes.') }}</span></div>
          <Tag :value="t('{n} HR policies', { n: hrPolicies.length })" severity="secondary" />
        </header>
        <div v-if="hrPolicies.length" class="hr-employee-access__policies">
          <article v-for="policy in hrPolicies" :key="`${policy.feature}-${policy.scope}-${policy.action || (policy.actions || []).join('-')}`">
            <i class="pi pi-shield" />
            <div><strong>{{ enumLabel(policy.label || policy.feature) }}</strong><span>{{ policyActions(policy) }}</span></div>
            <Tag :value="t(scopeLabel(policy.scope))" severity="info" />
            <small v-if="policy.source">{{ t('From {source}', { source: enumLabel(policy.source) }) }}</small>
          </article>
        </div>
        <div v-else class="hr-employee-access__empty"><i class="pi pi-id-card" /><span>{{ t('Only the protected employee self-service baseline is available.') }}</span></div>
      </section>
    </template>

    <Dialog v-model:visible="accountDialog" modal :header="t('Enable employee login')" :style="{ width: 'min(540px, 94vw)' }">
      <div class="hr-employee-access__dialog">
        <i class="pi pi-key" />
        <div><strong>{{ employee.work_email }}</strong><span>{{ t('If an active account with this exact email exists, it will be linked. Otherwise provide a temporary password for the new account.') }}</span></div>
        <label><span>{{ t('Temporary password') }}</span><Password v-model="temporaryPassword" toggle-mask :feedback="false" autocomplete="new-password" /></label>
        <small>{{ t('Leave blank when linking an existing account. New accounts require a temporary password.') }}</small>
      </div>
      <template #footer>
        <Button :label="t('Cancel')" severity="secondary" text :disabled="busy" @click="accountDialog = false" />
        <Button :label="t('Enable login')" icon="pi pi-check" :loading="busy" @click="provision" />
      </template>
    </Dialog>
  </section>
</template>

<style scoped>
.hr-employee-access,.hr-employee-access__loading { display: grid; gap: 14px; }.hr-employee-access__account,.hr-employee-access__assignment,.hr-employee-access__effective { overflow: hidden; border: 1px solid var(--tm-border); border-radius: 17px; background: var(--tm-surface); box-shadow: 0 9px 25px rgba(37,31,20,.04); }
.hr-employee-access__account { display: flex; align-items: center; gap: 13px; padding: 17px; }.hr-employee-access__account-icon { display: grid; width: 45px; height: 45px; flex: 0 0 auto; border-radius: 13px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }.hr-employee-access__account > div:nth-child(2) { display: grid; gap: 4px; min-width: 0; }.hr-employee-access__account p,.hr-employee-access__assignment header p,.hr-employee-access__effective header p { margin: 0; color: var(--tm-gold); font-size: .66rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }.hr-employee-access__account h3,.hr-employee-access__assignment h3,.hr-employee-access__effective h3 { margin: 0; color: var(--tm-heading); font-size: 1rem; }.hr-employee-access__account > div:nth-child(2) > span,.hr-employee-access__effective header span { color: var(--tm-muted); font-size: .76rem; line-height: 1.45; }.hr-employee-access__account > div:nth-child(2) > div { display: flex; gap: 6px; margin-top: 4px; }.hr-employee-access__account-actions { display: flex; gap: 7px; margin-left: auto; }
.hr-employee-access__assignment > header,.hr-employee-access__effective > header { padding: 14px 16px; border-bottom: 1px solid var(--tm-border); }.hr-employee-access__assignment > div { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 1px; background: var(--tm-border); }.hr-employee-access__assignment article { display: grid; grid-template-columns: auto 1fr; gap: 3px 9px; padding: 14px; background: var(--tm-surface); }.hr-employee-access__assignment article i { grid-row: 1 / 3; color: var(--tm-gold); }.hr-employee-access__assignment article span { color: var(--tm-muted); font-size: .67rem; }.hr-employee-access__assignment article strong { overflow: hidden; color: var(--tm-heading); font-size: .77rem; text-overflow: ellipsis; white-space: nowrap; }
.hr-employee-access__effective > header { display: flex; align-items: center; justify-content: space-between; gap: 14px; }.hr-employee-access__effective > header > div { display: grid; gap: 4px; }.hr-employee-access__business { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; padding: 13px; }.hr-employee-access__business article { overflow: hidden; border: 1px solid var(--tm-border); border-radius: 12px; }.hr-employee-access__business article header { display: flex; align-items: center; gap: 8px; padding: 9px 11px; background: var(--tm-surface-soft); color: var(--tm-heading); font-size: .78rem; }.hr-employee-access__business article header i { color: var(--tm-gold); }.hr-employee-access__business article > div { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 11px; border-top: 1px solid var(--tm-border); color: var(--tm-text); font-size: .73rem; }
.hr-employee-access__policies { display: grid; gap: 7px; padding: 12px; }.hr-employee-access__policies article { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--tm-border); border-radius: 11px; }.hr-employee-access__policies article > i { color: var(--tm-gold); }.hr-employee-access__policies article > div { display: grid; gap: 3px; }.hr-employee-access__policies strong { color: var(--tm-heading); font-size: .78rem; }.hr-employee-access__policies span,.hr-employee-access__policies small { color: var(--tm-muted); font-size: .68rem; }.hr-employee-access__policies small { grid-column: 2 / -1; }
.hr-employee-access__empty,.hr-employee-access__state { display: grid; min-height: 130px; align-content: center; justify-items: center; gap: 7px; padding: 22px; color: var(--tm-muted); text-align: center; }.hr-employee-access__empty i,.hr-employee-access__state i { color: var(--tm-gold); font-size: 1.4rem; }.hr-employee-access__state strong { color: var(--tm-heading); }.hr-employee-access__state.is-error i { color: var(--tm-coral); }
.hr-employee-access__dialog { display: grid; grid-template-columns: auto 1fr; gap: 11px; }.hr-employee-access__dialog > i { color: var(--tm-gold); font-size: 1.2rem; }.hr-employee-access__dialog > div { display: grid; gap: 4px; }.hr-employee-access__dialog strong { color: var(--tm-heading); }.hr-employee-access__dialog span,.hr-employee-access__dialog small { color: var(--tm-muted); font-size: .78rem; line-height: 1.45; }.hr-employee-access__dialog label,.hr-employee-access__dialog > small { display: grid; grid-column: 1 / -1; gap: 6px; }.hr-employee-access__dialog label > span { color: var(--tm-heading); font-weight: 800; }.hr-employee-access__dialog :deep(.p-password),.hr-employee-access__dialog :deep(.p-password-input) { width: 100%; }
@media (max-width: 900px) { .hr-employee-access__assignment > div { grid-template-columns: repeat(2,minmax(0,1fr)); }.hr-employee-access__business { grid-template-columns: 1fr; } }
@media (max-width: 620px) { .hr-employee-access__account,.hr-employee-access__effective > header { align-items: flex-start; flex-direction: column; }.hr-employee-access__account-actions { width: 100%; margin-left: 0; }.hr-employee-access__account-actions :deep(.p-button) { width: 100%; }.hr-employee-access__assignment > div { grid-template-columns: 1fr; }.hr-employee-access__policies article { grid-template-columns: auto 1fr; }.hr-employee-access__policies article :deep(.p-tag) { grid-column: 2; justify-self: start; } }
</style>
