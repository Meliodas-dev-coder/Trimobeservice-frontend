<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import { createAddress, deleteAddress, listAddresses, updateAddress } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const cart = useCartStore();
const { t } = usePublicI18n();

const mode = ref('login');
const loading = ref(false);
const error = ref('');
const fieldErrors = ref({});
const addresses = ref([]);
const addressLoading = ref(false);
const addressSaving = ref(false);
const addressDeleting = ref(false);
const addressError = ref('');
const addressErrors = ref({});

const login = reactive({
  email: '',
  password: '',
});

const register = reactive({
  full_name: '',
  email: '',
  phone: '',
  password: '',
});

const redirectTarget = computed(() => String(route.query.redirect || '/account'));
const defaultAddress = computed(() => addresses.value.find((address) => address.is_default) || addresses.value[0] || null);
const accountDetails = computed(() => [
  { label: t('Customer ID'), value: auth.user?.id || '-' },
  { label: t('Full name'), value: auth.user?.full_name || '-' },
  { label: t('Email'), value: auth.user?.email || '-' },
  { label: t('Phone'), value: auth.user?.phone || '-' },
]);

const address = reactive(defaultAddressForm());

function defaultAddressForm() {
  return {
    label: 'Home',
    recipient_name: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    region: '',
    country: 'Madagascar',
    postal_code: '',
  };
}

function resetAddressForm(source = null) {
  Object.assign(address, defaultAddressForm(), {
    recipient_name: auth.user?.full_name || '',
    phone: auth.user?.phone || '',
  });
  if (!source) {
    return;
  }
  Object.assign(address, {
    label: source.label || 'Home',
    recipient_name: source.recipient_name || auth.user?.full_name || '',
    phone: source.phone || auth.user?.phone || '',
    line1: source.line1 || '',
    line2: source.line2 || '',
    city: source.city || '',
    region: source.region || '',
    country: source.country || 'Madagascar',
    postal_code: source.postal_code || '',
  });
}

function addressPayload() {
  return {
    label: address.label.trim() || null,
    recipient_name: address.recipient_name.trim(),
    phone: address.phone.trim(),
    line1: address.line1.trim(),
    line2: address.line2.trim() || null,
    city: address.city.trim(),
    region: address.region.trim() || null,
    country: address.country.trim(),
    postal_code: address.postal_code.trim() || null,
    is_default: true,
  };
}

async function loadAddresses() {
  if (!auth.isAuthenticated) {
    addresses.value = [];
    resetAddressForm();
    return;
  }
  addressLoading.value = true;
  addressError.value = '';
  try {
    addresses.value = await listAddresses();
    resetAddressForm(defaultAddress.value);
  } catch (err) {
    addressError.value = err?.message || t('Could not load delivery address');
  } finally {
    addressLoading.value = false;
  }
}

async function submitLogin() {
  loading.value = true;
  error.value = '';
  fieldErrors.value = {};
  try {
    await auth.login(login.email, login.password);
    await cart.sync().catch(() => {});
    await loadAddresses().catch(() => {});
    router.replace(redirectTarget.value);
  } catch (err) {
    fieldErrors.value = err?.details || {};
    error.value = err?.message || t('Sign in failed');
  } finally {
    loading.value = false;
  }
}

async function submitRegister() {
  loading.value = true;
  error.value = '';
  fieldErrors.value = {};
  try {
    await auth.register({
      email: register.email,
      password: register.password,
      full_name: register.full_name,
      phone: register.phone,
    });
    await cart.sync().catch(() => {});
    await loadAddresses().catch(() => {});
    router.replace(redirectTarget.value);
  } catch (err) {
    fieldErrors.value = err?.details || {};
    error.value = err?.message || t('Registration failed');
  } finally {
    loading.value = false;
  }
}

async function logout() {
  await auth.logout();
  cart.loadGuest();
  addresses.value = [];
  router.replace({ name: 'home' });
}

async function saveAddress() {
  addressSaving.value = true;
  addressError.value = '';
  addressErrors.value = {};
  try {
    const saved = defaultAddress.value
      ? await updateAddress(defaultAddress.value.id, addressPayload())
      : await createAddress(addressPayload());
    toast.add({ severity: 'success', summary: t('Delivery address saved'), detail: saved?.label || t('Default address'), life: 2800 });
    await loadAddresses();
  } catch (err) {
    addressErrors.value = err?.details || {};
    addressError.value = err?.message || t('Could not save delivery address');
  } finally {
    addressSaving.value = false;
  }
}

async function removeAddress() {
  if (!defaultAddress.value) {
    return;
  }
  addressDeleting.value = true;
  addressError.value = '';
  try {
    await deleteAddress(defaultAddress.value.id);
    toast.add({ severity: 'success', summary: t('Delivery address removed'), life: 2600 });
    await loadAddresses();
  } catch (err) {
    addressError.value = err?.message || t('Could not remove delivery address');
  } finally {
    addressDeleting.value = false;
  }
}

watch(
  () => auth.isAuthenticated,
  (isAuthenticated) => {
    if (isAuthenticated) {
      loadAddresses();
    } else {
      addresses.value = [];
      resetAddressForm();
    }
  },
);

onMounted(() => {
  if (auth.isAuthenticated) {
    loadAddresses();
  } else {
    resetAddressForm();
  }
});
</script>

<template>
  <section class="account-page">
    <div class="app-container account-grid">
      <div class="account-copy">
        <p class="eyebrow">{{ t('Account') }}</p>
        <h1>{{ auth.isAuthenticated ? t('Your Trimobe account') : t('Sign in to continue') }}</h1>
        <p>
          {{ t('Keep your profile, delivery details, product orders, and car bookings connected to one customer account.') }}
        </p>
      </div>

      <div v-if="auth.isAuthenticated" class="account-stack">
        <section class="account-panel soft-panel">
          <div class="profile-card">
            <span class="profile-card__avatar"><i class="pi pi-user" /></span>
            <div>
              <strong>{{ auth.user.full_name }}</strong>
              <span>{{ auth.user.email }}</span>
              <span v-if="auth.user.phone">{{ auth.user.phone }}</span>
            </div>
          </div>

          <div class="detail-grid">
            <article v-for="item in accountDetails" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>

          <div class="account-links">
            <Button as="router-link" to="/cart" :label="t('Cart')" icon="pi pi-shopping-bag" />
            <Button as="router-link" to="/orders" :label="t('Orders and bookings')" icon="pi pi-receipt" outlined />
            <Button v-if="auth.isAdmin" as="router-link" to="/admin" :label="t('Admin console')" icon="pi pi-lock" outlined />
          </div>

          <Button :label="t('Sign out')" icon="pi pi-sign-out" severity="secondary" text @click="logout" />
        </section>

        <section class="account-panel soft-panel">
          <div class="panel-head">
            <div>
              <p class="eyebrow">{{ t('Delivery') }}</p>
              <h2>{{ t('Saved address') }}</h2>
            </div>
            <Tag v-if="defaultAddress" :value="t('Default')" severity="success" />
          </div>

          <div v-if="addressLoading" class="address-state">
            <i class="pi pi-spin pi-spinner" />
            <span>{{ t('Loading address...') }}</span>
          </div>

          <form v-else class="account-form address-form" @submit.prevent="saveAddress">
            <p v-if="addressError" class="form-error">{{ addressError }}</p>

            <label>
              <span>{{ t('Label') }}</span>
              <InputText v-model="address.label" :placeholder="t('Home, office...')" autocomplete="address-level4" />
            </label>

            <div class="address-grid">
              <label>
                <span>{{ t('Recipient name*') }}</span>
                <InputText v-model="address.recipient_name" autocomplete="name" required />
                <small v-if="addressErrors.recipient_name">{{ addressErrors.recipient_name }}</small>
              </label>
              <label>
                <span>{{ t('Phone') }}*</span>
                <InputText v-model="address.phone" autocomplete="tel" required />
                <small v-if="addressErrors.phone">{{ addressErrors.phone }}</small>
              </label>
            </div>

            <label>
              <span>{{ t('Address line 1*') }}</span>
              <InputText v-model="address.line1" autocomplete="address-line1" required />
              <small v-if="addressErrors.line1">{{ addressErrors.line1 }}</small>
            </label>

            <label>
              <span>{{ t('Address line 2') }}</span>
              <InputText v-model="address.line2" autocomplete="address-line2" />
            </label>

            <div class="address-grid">
              <label>
                <span>{{ t('City*') }}</span>
                <InputText v-model="address.city" autocomplete="address-level2" required />
                <small v-if="addressErrors.city">{{ addressErrors.city }}</small>
              </label>
              <label>
                <span>{{ t('Region') }}</span>
                <InputText v-model="address.region" autocomplete="address-level1" />
              </label>
              <label>
                <span>{{ t('Country*') }}</span>
                <InputText v-model="address.country" autocomplete="country-name" required />
                <small v-if="addressErrors.country">{{ addressErrors.country }}</small>
              </label>
              <label>
                <span>{{ t('Postal code') }}</span>
                <InputText v-model="address.postal_code" autocomplete="postal-code" />
              </label>
            </div>

            <div class="address-actions">
              <Button type="submit" :label="t('Save delivery address')" icon="pi pi-save" :loading="addressSaving" />
              <Button
                v-if="defaultAddress"
                type="button"
                :label="t('Remove')"
                icon="pi pi-trash"
                severity="secondary"
                outlined
                :loading="addressDeleting"
                @click="removeAddress"
              />
            </div>
          </form>
        </section>
      </div>

      <section v-else class="account-panel soft-panel">
        <div class="mode-switch" :aria-label="t('Account mode')">
          <button type="button" :class="{ 'is-active': mode === 'login' }" @click="mode = 'login'">{{ t('Sign in') }}</button>
          <button type="button" :class="{ 'is-active': mode === 'register' }" @click="mode = 'register'">{{ t('Create account') }}</button>
        </div>

        <p v-if="error" class="form-error">{{ error }}</p>

        <form v-if="mode === 'login'" class="account-form" @submit.prevent="submitLogin">
          <label>
            <span>{{ t('Email') }}</span>
            <InputText v-model="login.email" type="email" autocomplete="email" required />
            <small v-if="fieldErrors.email">{{ fieldErrors.email }}</small>
          </label>
          <label>
            <span>{{ t('Password') }}</span>
            <Password v-model="login.password" :feedback="false" toggleMask autocomplete="current-password" required fluid />
            <small v-if="fieldErrors.password">{{ fieldErrors.password }}</small>
          </label>
          <Button type="submit" :label="t('Sign in')" icon="pi pi-user" :loading="loading" />
        </form>

        <form v-else class="account-form" @submit.prevent="submitRegister">
          <label>
            <span>{{ t('Full name') }}</span>
            <InputText v-model="register.full_name" autocomplete="name" required />
            <small v-if="fieldErrors.full_name">{{ fieldErrors.full_name }}</small>
          </label>
          <label>
            <span>{{ t('Email') }}</span>
            <InputText v-model="register.email" type="email" autocomplete="email" required />
            <small v-if="fieldErrors.email">{{ fieldErrors.email }}</small>
          </label>
          <label>
            <span>{{ t('Phone') }}</span>
            <InputText v-model="register.phone" autocomplete="tel" />
            <small v-if="fieldErrors.phone">{{ fieldErrors.phone }}</small>
          </label>
          <label>
            <span>{{ t('Password') }}</span>
            <Password v-model="register.password" toggleMask autocomplete="new-password" required fluid />
            <small v-if="fieldErrors.password">{{ fieldErrors.password }}</small>
          </label>
          <Button type="submit" :label="t('Create account')" icon="pi pi-check" :loading="loading" />
        </form>
      </section>
    </div>
  </section>
</template>

<style scoped>
.account-page {
  min-height: calc(100vh - 158px);
  padding: 62px 0;
}

.account-grid {
  gap: 36px;
  grid-template-columns: minmax(0, 1fr) minmax(340px, 460px);
}

.account-copy h1 {
  max-width: 760px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.8rem, 7vw, 6rem);
  line-height: 0.92;
}

.account-copy p:not(.eyebrow) {
  max-width: 640px;
  color: var(--tm-muted);
  font-size: 1.05rem;
  line-height: 1.7;
}

.account-panel {
  display: grid;
  gap: 18px;
  padding: 22px;
}

.account-stack {
  display: grid;
  gap: 16px;
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 5px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
}

.mode-switch button {
  min-height: 42px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--tm-muted);
  cursor: pointer;
  font-weight: 850;
}

.mode-switch button.is-active {
  background: var(--tm-emerald);
  color: #fff;
}

.account-form {
  display: grid;
  gap: 15px;
}

.account-form label {
  display: grid;
  gap: 7px;
}

.account-form span {
  color: var(--tm-muted);
  font-size: 0.84rem;
  font-weight: 850;
}

.account-form small,
.form-error {
  color: var(--tm-coral);
  font-weight: 750;
}

.account-form :deep(.p-inputtext),
.account-form :deep(.p-password),
.account-form :deep(.p-password-input) {
  width: 100%;
}

.panel-head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.panel-head h2 {
  margin: 2px 0 0;
  color: var(--tm-heading);
  font-size: 1.35rem;
}

.detail-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.detail-grid article {
  display: grid;
  gap: 4px;
  min-height: 74px;
  align-content: center;
  padding: 12px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
}

.detail-grid span {
  color: var(--tm-muted);
  font-size: 0.76rem;
  font-weight: 850;
}

.detail-grid strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--tm-heading);
}

.address-state {
  display: grid;
  min-height: 180px;
  place-items: center;
  gap: 8px;
  color: var(--tm-muted);
  font-weight: 820;
}

.address-state i {
  color: var(--tm-gold);
  font-size: 1.25rem;
}

.address-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.address-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.profile-card {
  display: flex;
  align-items: center;
  gap: 14px;
}

.profile-card__avatar {
  display: grid;
  width: 54px;
  height: 54px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
}

.profile-card div {
  display: grid;
  gap: 3px;
}

.profile-card strong {
  color: var(--tm-heading);
  font-size: 1.1rem;
}

.profile-card span {
  color: var(--tm-muted);
}

.account-links {
  display: grid;
  gap: 10px;
}

@media (max-width: 860px) {
  .account-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .detail-grid,
  .address-grid {
    grid-template-columns: 1fr;
  }

  .address-actions .p-button {
    width: 100%;
  }
}
</style>
