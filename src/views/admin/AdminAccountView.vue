<script setup>
import { computed, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';

import { ApiError } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';
import '@/styles/admin-account.css';

const { t } = useAdminI18n();
const auth = useAuthStore();
const toast = useToast();

const form = reactive({ current: '', next: '', confirm: '' });
const errors = reactive({ current: '', next: '', confirm: '' });
const submitting = ref(false);

const initial = computed(() => String(auth.displayName || 'A').trim().charAt(0).toUpperCase());
const permissionCount = computed(() => auth.isSuperAdmin ? t('All screens') : t('{n} screens', { n: auth.permissions.length }));

const accessLevel = computed(() => {
  if (auth.isSuperAdmin) {
    return { label: t('Super administrator'), detail: t('Full access to every admin screen.') };
  }
  const count = auth.permissions.length;
  return {
    label: t('Team member'),
    detail: count
      ? t('Your role grants access to {n} admin screens.', { n: count })
      : t('No screens assigned yet. Ask a super-admin to assign you a role.'),
  };
});

const permissionLabels = {
  dashboard: 'Dashboard',
  tech: 'Tech',
  fashion: 'Fashion',
  coffee: 'Coffee',
  mobility: 'Mobility',
  events: 'Events',
  healthcare: 'Healthcare',
  orders: 'Orders',
  payments: 'Payments',
  invoices: 'Invoices',
  customers: 'Customers',
  audit_logs: 'Activity log',
  user_management: 'Team & roles',
};

const visiblePermissions = computed(() => (
  auth.isSuperAdmin
    ? []
    : auth.permissions.map((permission) => ({
      key: permission,
      label: t(permissionLabels[permission] || titleize(permission)),
    }))
));

const passwordScore = computed(() => {
  const value = form.next;
  if (!value) return 0;
  let score = value.length >= 8 ? 1 : 0;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
});

const passwordStrength = computed(() => {
  if (!form.next) return { label: t('Add a new password'), tone: 'empty' };
  if (passwordScore.value <= 1) return { label: t('Needs improvement'), tone: 'weak' };
  if (passwordScore.value <= 2) return { label: t('Good password'), tone: 'good' };
  return { label: t('Strong password'), tone: 'strong' };
});

const passwordChecks = computed(() => [
  { label: t('At least 8 characters'), passed: form.next.length >= 8 },
  { label: t('Different from the current password'), passed: Boolean(form.next) && form.next !== form.current },
  { label: t('Both new-password fields match'), passed: Boolean(form.confirm) && form.confirm === form.next },
]);

const canSubmit = computed(() => Boolean(
  form.current
  && form.next.length >= 8
  && form.next !== form.current
  && form.confirm === form.next
  && !submitting.value
));

function titleize(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function clearErrors() {
  errors.current = '';
  errors.next = '';
  errors.confirm = '';
}

function resetForm() {
  form.current = '';
  form.next = '';
  form.confirm = '';
  clearErrors();
}

function validate() {
  clearErrors();
  let ok = true;
  if (!form.current) {
    errors.current = t('is required');
    ok = false;
  }
  if (form.next.length < 8) {
    errors.next = t('must be at least 8 characters');
    ok = false;
  } else if (form.next === form.current) {
    errors.next = t('New password must be different from the current password');
    ok = false;
  }
  if (form.confirm !== form.next) {
    errors.confirm = t('Passwords do not match');
    ok = false;
  }
  return ok;
}

async function handleSubmit() {
  if (submitting.value || !validate()) return;

  submitting.value = true;
  try {
    await auth.changePassword(form.current, form.next);
    resetForm();
    toast.add({
      severity: 'success',
      summary: t('Password changed'),
      detail: t('Use your new password next time you sign in.'),
      life: 4000,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      errors.current = t('Current password is incorrect');
    } else if (err instanceof ApiError && err.details) {
      if (err.details.current_password) errors.current = t(err.details.current_password);
      if (err.details.new_password) errors.next = t(err.details.new_password);
    } else {
      toast.add({
        severity: 'error',
        summary: t('Could not change password'),
        detail: t(err?.message || 'Please try again.'),
        life: 5000,
      });
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <section class="account-page">
    <header class="account-hero">
      <div class="account-hero__identity">
        <span class="account-avatar">{{ initial }}</span>
        <div>
          <p class="account-eyebrow">{{ t('Admin identity') }}</p>
          <h2>{{ auth.displayName }}</h2>
          <span>{{ auth.user?.email }}</span>
          <div class="account-hero__tags">
            <Tag :value="accessLevel.label" :severity="auth.isSuperAdmin ? 'warn' : 'info'" />
            <Tag :value="t('Active account')" severity="success" />
          </div>
        </div>
      </div>
      <div class="account-hero__security">
        <span><i class="pi pi-shield" /></span>
        <div>
          <small>{{ t('Account security') }}</small>
          <strong>{{ t('Keep your admin access protected.') }}</strong>
          <p>{{ t('Use a unique password and never share your administrator credentials.') }}</p>
        </div>
      </div>
    </header>

    <section class="account-metrics" :aria-label="t('Account overview')">
      <article>
        <span class="is-gold"><i class="pi pi-id-card" /></span>
        <div><small>{{ t('Role') }}</small><strong>{{ accessLevel.label }}</strong></div>
      </article>
      <article>
        <span class="is-blue"><i class="pi pi-th-large" /></span>
        <div><small>{{ t('Admin access') }}</small><strong>{{ permissionCount }}</strong></div>
      </article>
      <article>
        <span class="is-emerald"><i class="pi pi-check-circle" /></span>
        <div><small>{{ t('Account status') }}</small><strong>{{ t('Active') }}</strong></div>
      </article>
    </section>

    <div class="account-grid">
      <section class="account-card account-profile">
        <header class="account-card__head">
          <span><i class="pi pi-user" /></span>
          <div><p>{{ t('Profile & access') }}</p><h3>{{ t('Account information') }}</h3></div>
        </header>

        <dl class="account-facts">
          <div>
            <dt>{{ t('Full name') }}</dt>
            <dd>{{ auth.displayName || '-' }}</dd>
          </div>
          <div>
            <dt>{{ t('Email address') }}</dt>
            <dd>{{ auth.user?.email || '-' }}</dd>
          </div>
          <div>
            <dt>{{ t('Phone') }}</dt>
            <dd>{{ auth.user?.phone || t('Not provided') }}</dd>
          </div>
          <div>
            <dt>{{ t('Access level') }}</dt>
            <dd><strong>{{ accessLevel.label }}</strong><small>{{ accessLevel.detail }}</small></dd>
          </div>
        </dl>

        <div class="account-access">
          <div class="account-access__head">
            <div><p>{{ t('Accessible workspaces') }}</p><span>{{ t('Screens currently granted by your assigned role.') }}</span></div>
            <RouterLink v-if="auth.can('user_management')" to="/admin/roles">{{ t('Manage roles') }} <i class="pi pi-arrow-right" /></RouterLink>
          </div>
          <div v-if="auth.isSuperAdmin" class="account-access__all">
            <i class="pi pi-shield" />
            <div><strong>{{ t('All admin workspaces') }}</strong><span>{{ t('Super administrators are not restricted by role permissions.') }}</span></div>
          </div>
          <ul v-else-if="visiblePermissions.length" class="account-permissions">
            <li v-for="permission in visiblePermissions" :key="permission.key"><i class="pi pi-check" /> {{ permission.label }}</li>
          </ul>
          <div v-else class="account-access__empty"><i class="pi pi-lock" /> {{ t('No workspaces are assigned to this account.') }}</div>
        </div>
      </section>

      <section class="account-card account-security">
        <header class="account-card__head">
          <span><i class="pi pi-lock" /></span>
          <div><p>{{ t('Security') }}</p><h3>{{ t('Change password') }}</h3></div>
        </header>

        <div class="account-security__intro">
          <i class="pi pi-info-circle" />
          <span>{{ t('Changing your password does not sign you out of this session. Use the new password the next time you sign in.') }}</span>
        </div>

        <form class="account-form" @submit.prevent="handleSubmit">
          <label class="account-field">
            <span>{{ t('Current password') }}</span>
            <Password v-model="form.current" :feedback="false" toggleMask fluid inputClass="w-full" autocomplete="current-password" />
            <small v-if="errors.current" class="account-field__error"><i class="pi pi-exclamation-circle" /> {{ errors.current }}</small>
          </label>

          <label class="account-field">
            <span>{{ t('New password') }}</span>
            <Password v-model="form.next" :feedback="false" toggleMask fluid inputClass="w-full" autocomplete="new-password" />
            <small v-if="errors.next" class="account-field__error"><i class="pi pi-exclamation-circle" /> {{ errors.next }}</small>
          </label>

          <div v-if="form.next" class="password-strength" :class="`is-${passwordStrength.tone}`">
            <div class="password-strength__head"><span>{{ t('Password strength') }}</span><strong>{{ passwordStrength.label }}</strong></div>
            <div class="password-strength__bar"><i v-for="n in 4" :key="n" :class="{ 'is-filled': passwordScore >= n }" /></div>
          </div>

          <label class="account-field">
            <span>{{ t('Confirm new password') }}</span>
            <Password v-model="form.confirm" :feedback="false" toggleMask fluid inputClass="w-full" autocomplete="new-password" />
            <small v-if="errors.confirm" class="account-field__error"><i class="pi pi-exclamation-circle" /> {{ errors.confirm }}</small>
          </label>

          <ul class="password-checks">
            <li v-for="check in passwordChecks" :key="check.label" :class="{ 'is-passed': check.passed }">
              <i :class="check.passed ? 'pi pi-check-circle' : 'pi pi-circle'" /> {{ check.label }}
            </li>
          </ul>

          <div class="account-form__actions">
            <Button type="button" :label="t('Clear')" severity="secondary" outlined :disabled="submitting || (!form.current && !form.next && !form.confirm)" @click="resetForm" />
            <Button type="submit" :label="t('Update password')" icon="pi pi-lock" :loading="submitting" :disabled="!canSubmit" />
          </div>
        </form>
      </section>
    </div>

    <section class="account-guidance">
      <div>
        <span><i class="pi pi-shield" /></span>
        <div><p>{{ t('Security reminder') }}</p><h3>{{ t('Administrator accounts protect business and customer data.') }}</h3></div>
      </div>
      <ul>
        <li><i class="pi pi-check" /> {{ t('Use a password you do not use on another website.') }}</li>
        <li><i class="pi pi-check" /> {{ t('Sign out when using a shared or public computer.') }}</li>
        <li><i class="pi pi-check" /> {{ t('Ask a super-admin to update your access if your responsibilities change.') }}</li>
      </ul>
    </section>
  </section>
</template>

<style scoped>
.account-page { display: grid; max-width: 1500px; gap: 18px; margin: 0 auto; }
.account-hero { position: relative; display: grid; align-items: end; gap: 28px; grid-template-columns: minmax(0,1fr) minmax(290px,.42fr); overflow: hidden; padding: clamp(24px,3.5vw,38px); border-radius: 24px; background: radial-gradient(circle at 90% -5%, rgba(201,146,44,.31), transparent 35%), linear-gradient(135deg,var(--tm-charcoal),#172426); box-shadow: var(--tm-shadow); }
.account-hero::after { position: absolute; right: -80px; bottom: -185px; width: 310px; height: 310px; border: 1px solid rgba(201,146,44,.2); border-radius: 50%; content: ''; }
.account-hero > * { position: relative; z-index: 1; }
.account-hero__identity { display: flex; align-items: center; gap: 18px; }
.account-avatar { display: grid; width: 78px; height: 78px; flex: 0 0 auto; border: 1px solid rgba(255,255,255,.18); border-radius: 24px; background: linear-gradient(135deg,var(--tm-gold),#9a6814); box-shadow: 0 13px 30px rgba(0,0,0,.2); color: #fff; font-size: 2rem; font-weight: 950; place-items: center; }
.account-hero__identity > div { display: grid; justify-items: start; gap: 3px; min-width: 0; }
.account-eyebrow,.account-card__head p,.account-guidance p { margin: 0; color: var(--tm-gold); font-size: .68rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
.account-hero h2 { margin: 0; color: #fff8ed; font-size: clamp(2rem,4vw,3.6rem); letter-spacing: -.045em; line-height: 1; }
.account-hero__identity > div > span { max-width: 100%; overflow: hidden; color: rgba(255,255,255,.59); font-size: .86rem; text-overflow: ellipsis; white-space: nowrap; }
.account-hero__tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
.account-hero__security { display: grid; align-items: center; gap: 12px; grid-template-columns: auto minmax(0,1fr); padding: 15px; border: 1px solid rgba(255,255,255,.13); border-radius: 16px; background: rgba(255,255,255,.055); }
.account-hero__security > span { display: grid; width: 44px; height: 44px; border-radius: 14px; background: var(--tm-emerald); color: #fff; place-items: center; }
.account-hero__security div { display: grid; gap: 2px; }
.account-hero__security small { color: var(--tm-gold); font-size: .65rem; font-weight: 900; text-transform: uppercase; }
.account-hero__security strong { color: #fff; font-size: .84rem; }
.account-hero__security p { margin: 2px 0 0; color: rgba(255,255,255,.55); font-size: .72rem; line-height: 1.4; }
.account-metrics { display: grid; overflow: hidden; border: 1px solid var(--tm-border); border-radius: 17px; background: var(--tm-surface); box-shadow: 0 10px 30px rgba(37,31,20,.045); grid-template-columns: repeat(3,minmax(0,1fr)); }
.account-metrics article { display: grid; align-items: center; gap: 11px; grid-template-columns: auto minmax(0,1fr); min-height: 76px; padding: 13px 17px; }
.account-metrics article + article { border-left: 1px solid var(--tm-border); }
.account-metrics article > span { display: grid; width: 42px; height: 42px; border-radius: 13px; background: rgba(201,146,44,.12); color: var(--tm-gold); place-items: center; }
.account-metrics article > span.is-blue { background: rgba(49,92,112,.12); color: var(--tm-blue); }
.account-metrics article > span.is-emerald { background: rgba(12,155,128,.12); color: var(--tm-emerald); }
.account-metrics article div { display: grid; gap: 2px; }
.account-metrics small { color: var(--tm-muted); font-size: .68rem; font-weight: 780; }
.account-metrics strong { overflow: hidden; color: var(--tm-heading); font-size: .9rem; text-overflow: ellipsis; white-space: nowrap; }
.account-grid { display: grid; align-items: start; gap: 18px; grid-template-columns: minmax(0,.86fr) minmax(420px,1.14fr); }
.account-card { display: grid; align-content: start; gap: 19px; min-width: 0; padding: 22px; border: 1px solid var(--tm-border); border-radius: 19px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); }
.account-card__head { display: grid; align-items: center; gap: 11px; grid-template-columns: auto minmax(0,1fr); padding-bottom: 15px; border-bottom: 1px solid var(--tm-border); }
.account-card__head > span { display: grid; width: 42px; height: 42px; border-radius: 13px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.account-card__head div { display: grid; gap: 2px; }
.account-card__head h3,.account-guidance h3 { margin: 0; color: var(--tm-heading); font-size: 1.2rem; letter-spacing: -.025em; }
.account-facts { display: grid; gap: 0; margin: 0; }
.account-facts > div { display: grid; gap: 10px; grid-template-columns: minmax(110px,.34fr) minmax(0,1fr); padding: 12px 0; border-bottom: 1px solid var(--tm-border); }
.account-facts dt { color: var(--tm-muted); font-size: .72rem; font-weight: 820; }
.account-facts dd { display: grid; gap: 2px; margin: 0; overflow-wrap: anywhere; color: var(--tm-heading); font-size: .8rem; font-weight: 820; }
.account-facts dd small { color: var(--tm-muted); font-size: .72rem; font-weight: 680; line-height: 1.45; }
.account-access { display: grid; gap: 13px; }
.account-access__head { display: flex; align-items: end; justify-content: space-between; gap: 14px; }
.account-access__head > div { display: grid; gap: 2px; }
.account-access__head p { margin: 0; color: var(--tm-heading); font-size: .82rem; font-weight: 900; }
.account-access__head span { color: var(--tm-muted); font-size: .7rem; }
.account-access__head a { display: inline-flex; align-items: center; gap: 5px; color: var(--tm-emerald); font-size: .7rem; font-weight: 850; text-decoration: none; white-space: nowrap; }
.account-access__all,.account-access__empty { display: grid; align-items: center; gap: 10px; grid-template-columns: auto minmax(0,1fr); padding: 13px; border-radius: 14px; background: rgba(201,146,44,.09); }
.account-access__all > i,.account-access__empty > i { color: var(--tm-gold); }
.account-access__all div { display: grid; gap: 2px; }
.account-access__all strong { color: var(--tm-heading); font-size: .8rem; }
.account-access__all span,.account-access__empty { color: var(--tm-muted); font-size: .72rem; line-height: 1.4; }
.account-permissions { display: flex; flex-wrap: wrap; gap: 7px; margin: 0; padding: 0; list-style: none; }
.account-permissions li { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border: 1px solid var(--tm-border); border-radius: 999px; background: var(--tm-surface-muted); color: var(--tm-heading); font-size: .69rem; font-weight: 780; }
.account-permissions i { color: var(--tm-emerald); font-size: .65rem; }
.account-security__intro { display: flex; align-items: flex-start; gap: 8px; padding: 12px; border-radius: 13px; background: rgba(49,92,112,.09); color: var(--tm-blue); font-size: .74rem; font-weight: 740; line-height: 1.5; }
.account-form { display: grid; gap: 15px; }
.account-field { display: grid; gap: 7px; }
.account-field > span { color: var(--tm-heading); font-size: .76rem; font-weight: 830; }
.account-field :deep(.p-password),.account-field :deep(.p-password-input) { width: 100%; }
.account-field__error { display: inline-flex; align-items: center; gap: 5px; color: var(--tm-coral,#d9534f); font-size: .72rem; font-weight: 760; }
.password-strength { display: grid; gap: 7px; }
.password-strength__head { display: flex; justify-content: space-between; gap: 10px; color: var(--tm-muted); font-size: .69rem; }
.password-strength__head strong { color: var(--tm-coral); }
.password-strength.is-good .password-strength__head strong { color: var(--tm-gold); }
.password-strength.is-strong .password-strength__head strong { color: var(--tm-emerald); }
.password-strength__bar { display: grid; gap: 5px; grid-template-columns: repeat(4,minmax(0,1fr)); }
.password-strength__bar i { height: 4px; border-radius: 999px; background: var(--tm-border); }
.password-strength__bar i.is-filled { background: var(--tm-coral); }
.password-strength.is-good .password-strength__bar i.is-filled { background: var(--tm-gold); }
.password-strength.is-strong .password-strength__bar i.is-filled { background: var(--tm-emerald); }
.password-checks { display: grid; gap: 7px; margin: 0; padding: 12px; border-radius: 13px; background: var(--tm-surface-muted); list-style: none; }
.password-checks li { display: flex; align-items: center; gap: 7px; color: var(--tm-muted); font-size: .7rem; font-weight: 750; }
.password-checks li.is-passed { color: var(--tm-emerald); }
.password-checks i { font-size: .72rem; }
.account-form__actions { display: flex; justify-content: flex-end; gap: 9px; padding-top: 4px; }
.account-guidance { display: grid; align-items: center; gap: 22px; grid-template-columns: minmax(0,.75fr) minmax(0,1.25fr); padding: 20px 22px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); }
.account-guidance > div { display: grid; align-items: center; gap: 11px; grid-template-columns: auto minmax(0,1fr); }
.account-guidance > div > span { display: grid; width: 44px; height: 44px; border-radius: 14px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.account-guidance ul { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.account-guidance li { display: flex; align-items: flex-start; gap: 7px; color: var(--tm-muted); font-size: .75rem; font-weight: 730; line-height: 1.45; }
.account-guidance li i { margin-top: 2px; color: var(--tm-emerald); font-size: .7rem; }
@media (max-width: 1050px) { .account-hero,.account-grid,.account-guidance { grid-template-columns: 1fr; } }
@media (max-width: 680px) { .account-hero__identity { align-items: flex-start; flex-direction: column; } .account-metrics { grid-template-columns: 1fr; } .account-metrics article + article { border-top: 1px solid var(--tm-border); border-left: 0; } .account-grid { grid-template-columns: minmax(0,1fr); } .account-facts > div { grid-template-columns: 1fr; gap: 4px; } .account-access__head { align-items: flex-start; flex-direction: column; } .account-form__actions { align-items: stretch; flex-direction: column; } .account-form__actions :deep(.p-button) { width: 100%; } }
</style>
