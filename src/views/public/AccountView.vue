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

const firstName = computed(() => {
  const source = auth.user?.full_name || auth.user?.email || '';
  return source.split(/[\s@]/)[0] || t('there');
});
const initial = computed(() => (auth.user?.full_name || auth.user?.email || 'T').trim().charAt(0).toUpperCase());

const quickLinks = computed(() => {
  const links = [
    { title: 'Cart', detail: 'Review items and check out.', to: '/cart', icon: 'pi pi-shopping-bag' },
    { title: 'Orders and bookings', detail: 'Track orders, car bookings, and event requests.', to: '/orders', icon: 'pi pi-receipt' },
    { title: 'Plan an event', detail: 'Send a request with services and artists.', to: '/events/plan', icon: 'pi pi-calendar-plus' },
  ];
  if (auth.isAdmin) {
    links.push({ title: 'Admin console', detail: 'Manage the storefront and operations.', to: '/admin', icon: 'pi pi-lock' });
  }
  return links;
});

const benefits = [
  { icon: 'pi pi-receipt', text: 'Track orders and car bookings in one place.' },
  { icon: 'pi pi-calendar-plus', text: 'Send event requests and hand-pick gospel artists.' },
  { icon: 'pi pi-map-marker', text: 'Save your delivery address for faster checkout.' },
  { icon: 'pi pi-wallet', text: 'Settle by cash, transfer, or mobile money with the team.' },
];

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
  <!-- ============ SIGNED IN: editorial dashboard ============ -->
  <section v-if="auth.isAuthenticated" class="account">
    <div class="app-container">
      <header class="account-head">
        <div>
          <p class="kicker">{{ t('Account') }}</p>
          <h1>{{ t('Welcome back') }}, {{ firstName }}.</h1>
          <p class="account-head__sub">{{ t('Your profile, delivery details, orders, bookings, and event requests — all in one place.') }}</p>
        </div>
        <Button :label="t('Sign out')" icon="pi pi-sign-out" severity="secondary" outlined @click="logout" />
      </header>

      <nav class="quick-links" :aria-label="t('Account')">
        <RouterLink v-for="link in quickLinks" :key="link.to" class="qlink" :to="link.to">
          <i class="qlink__icon" :class="link.icon" />
          <span class="qlink__body">
            <strong>{{ t(link.title) }}</strong>
            <small>{{ t(link.detail) }}</small>
          </span>
          <i class="pi pi-arrow-up-right qlink__go" />
        </RouterLink>
      </nav>

      <div class="account-cols">
        <section class="card">
          <div class="profile">
            <span class="profile__avatar">{{ initial }}</span>
            <div class="profile__id">
              <strong>{{ auth.user.full_name || auth.user.email }}</strong>
              <span>{{ auth.user.email }}</span>
              <span v-if="auth.user.phone">{{ auth.user.phone }}</span>
            </div>
            <Tag v-if="auth.isAdmin" :value="t('Admin')" severity="warn" />
          </div>

          <div class="detail-grid">
            <article v-for="item in accountDetails" :key="item.label">
              <span>{{ item.label }}</span>
              <strong>{{ item.value }}</strong>
            </article>
          </div>
        </section>

        <section class="card">
          <div class="card__head">
            <div>
              <p class="kicker">{{ t('Delivery') }}</p>
              <h2>{{ t('Saved address') }}</h2>
            </div>
            <Tag v-if="defaultAddress" :value="t('Default')" severity="success" />
          </div>

          <div v-if="addressLoading" class="state">
            <i class="pi pi-spin pi-spinner" />
            <span>{{ t('Loading address...') }}</span>
          </div>

          <form v-else class="form address-form" @submit.prevent="saveAddress">
            <p v-if="addressError" class="form-error">{{ addressError }}</p>

            <label>
              <span>{{ t('Label') }}</span>
              <InputText v-model="address.label" :placeholder="t('Home, office...')" autocomplete="address-level4" />
            </label>

            <div class="field-grid">
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

            <div class="field-grid">
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

            <div class="form-actions">
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
    </div>
  </section>

  <!-- ============ SIGNED OUT: split brand + auth ============ -->
  <section v-else class="account account--auth">
    <div class="app-container auth-split">
      <aside class="auth-brand">
        <div class="auth-brand__inner">
          <p class="kicker kicker--gold">{{ t('Trimobe account') }}</p>
          <h1>{{ t('Sign in to shop, book, and plan.') }}</h1>
          <p class="auth-brand__lead">
            {{ t('One account for phones, cars, event requests, and Kafe Misiona — with payment handled personally.') }}
          </p>
          <ul class="benefits">
            <li v-for="benefit in benefits" :key="benefit.text">
              <i :class="benefit.icon" />
              <span>{{ t(benefit.text) }}</span>
            </li>
          </ul>
        </div>
      </aside>

      <section class="auth-card">
        <div class="mode-switch" :aria-label="t('Account mode')">
          <button type="button" :class="{ 'is-active': mode === 'login' }" @click="mode = 'login'">{{ t('Sign in') }}</button>
          <button type="button" :class="{ 'is-active': mode === 'register' }" @click="mode = 'register'">{{ t('Create account') }}</button>
        </div>

        <p v-if="error" class="form-error">{{ error }}</p>

        <form v-if="mode === 'login'" class="form" @submit.prevent="submitLogin">
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

        <form v-else class="form" @submit.prevent="submitRegister">
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
.kicker {
  margin: 0;
  color: var(--tm-gold);
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.account {
  min-height: calc(100vh - 158px);
  padding: clamp(34px, 5vw, 64px) 0;
}

/* ---------- signed-in dashboard ---------- */
.account-head {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
}

.account-head h1 {
  margin: 14px 0 0;
  color: var(--tm-heading);
  font-size: clamp(2.2rem, 5.4vw, 4.4rem);
  line-height: 0.98;
  letter-spacing: -0.02em;
}

.account-head__sub {
  max-width: 60ch;
  margin: 14px 0 0;
  color: var(--tm-muted);
  line-height: 1.6;
}

.quick-links {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-bottom: 24px;
}

.qlink {
  display: flex;
  align-items: center;
  gap: 14px;
  position: relative;
  padding: 18px 20px;
  border: 1px solid var(--tm-border);
  border-radius: 14px;
  background: var(--tm-surface);
  color: inherit;
  transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}

.qlink:hover {
  border-color: rgba(8, 124, 104, 0.34);
  transform: translateY(-3px);
  box-shadow: var(--tm-shadow);
}

.qlink__icon {
  display: grid;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  font-size: 1.15rem;
}

.qlink__body {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.qlink__body strong {
  color: var(--tm-heading);
  font-size: 1.02rem;
}

.qlink__body small {
  color: var(--tm-muted);
  font-size: 0.86rem;
  line-height: 1.4;
}

.qlink__go {
  margin-left: auto;
  color: var(--tm-muted);
  transition: color 160ms ease, transform 160ms ease;
}

.qlink:hover .qlink__go {
  color: var(--tm-emerald);
  transform: translate(2px, -2px);
}

.account-cols {
  display: grid;
  align-items: start;
  gap: 18px;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
}

.card {
  display: grid;
  gap: 18px;
  padding: 24px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.card__head {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 12px;
}

.card__head h2 {
  margin: 6px 0 0;
  color: var(--tm-heading);
  font-size: 1.4rem;
}

.profile {
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile__avatar {
  display: grid;
  width: 60px;
  height: 60px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(185, 138, 46, 0.9), var(--tm-charcoal));
  color: #fff;
  font-size: 1.5rem;
  font-weight: 950;
}

.profile__id {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.profile__id strong {
  color: var(--tm-heading);
  font-size: 1.14rem;
  overflow-wrap: anywhere;
}

.profile__id span {
  color: var(--tm-muted);
  overflow-wrap: anywhere;
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
  padding: 14px;
  border: 1px solid var(--tm-border);
  border-radius: 10px;
  background: var(--tm-surface-soft);
}

.detail-grid span {
  color: var(--tm-muted);
  font-size: 0.76rem;
  font-weight: 850;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.detail-grid strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--tm-heading);
}

/* ---------- forms ---------- */
.form {
  display: grid;
  gap: 15px;
}

.form label {
  display: grid;
  gap: 7px;
}

.form label > span {
  color: var(--tm-muted);
  font-size: 0.84rem;
  font-weight: 850;
}

.form small,
.form-error {
  color: var(--tm-coral);
  font-weight: 750;
}

.form :deep(.p-inputtext),
.form :deep(.p-password),
.form :deep(.p-password-input) {
  width: 100%;
}

.field-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 4px;
}

.state {
  display: grid;
  min-height: 180px;
  place-items: center;
  gap: 8px;
  color: var(--tm-muted);
  font-weight: 820;
}

.state i {
  color: var(--tm-gold);
  font-size: 1.25rem;
}

/* ---------- signed-out split ---------- */
.account--auth {
  display: grid;
  align-items: center;
}

.auth-split {
  display: grid;
  align-items: stretch;
  gap: clamp(20px, 4vw, 40px);
  grid-template-columns: minmax(0, 1.05fr) minmax(340px, 0.95fr);
}

.auth-brand {
  display: grid;
  align-items: center;
  overflow: hidden;
  padding: clamp(28px, 4vw, 52px);
  border-radius: 20px;
  background:
    radial-gradient(900px 300px at 85% -10%, rgba(185, 138, 46, 0.22), transparent 60%),
    var(--tm-charcoal);
  color: #fff;
}

.auth-brand h1 {
  max-width: 15ch;
  margin: 16px 0 0;
  color: #fff;
  font-size: clamp(2.1rem, 4.4vw, 3.4rem);
  line-height: 1.02;
  letter-spacing: -0.02em;
}

.auth-brand__lead {
  max-width: 46ch;
  margin: 18px 0 0;
  color: rgba(255, 255, 255, 0.74);
  line-height: 1.6;
}

.benefits {
  display: grid;
  gap: 14px;
  margin: 28px 0 0;
  padding: 0;
  list-style: none;
}

.benefits li {
  display: flex;
  align-items: start;
  gap: 12px;
  color: rgba(255, 255, 255, 0.9);
  font-weight: 720;
  line-height: 1.45;
}

.benefits i {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--tm-gold);
}

.auth-card {
  display: grid;
  align-content: start;
  gap: 18px;
  padding: clamp(24px, 3vw, 34px);
  border: 1px solid var(--tm-border);
  border-radius: 20px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  padding: 5px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  background: var(--tm-surface-soft);
}

.mode-switch button {
  min-height: 44px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--tm-muted);
  cursor: pointer;
  font-weight: 850;
}

.mode-switch button.is-active {
  background: var(--tm-emerald);
  color: #fff;
}

@media (max-width: 900px) {
  .quick-links {
    grid-template-columns: 1fr;
  }

  .account-cols,
  .auth-split {
    grid-template-columns: 1fr;
  }

  .account-head {
    align-items: stretch;
    flex-direction: column;
  }
}

@media (max-width: 560px) {
  .detail-grid,
  .field-grid {
    grid-template-columns: 1fr;
  }

  .form-actions .p-button {
    width: 100%;
  }
}
</style>
