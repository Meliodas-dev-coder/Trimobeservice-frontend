<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import ThemeToggle from '@/components/ThemeToggle.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleSubmit() {
  if (loading.value) {
    return;
  }
  error.value = '';
  loading.value = true;
  try {
    const user = await auth.login(email.value.trim(), password.value);
    if (user.role !== 'admin') {
      await auth.logout();
      error.value = 'This account does not have admin access.';
      return;
    }
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin';
    router.replace(redirect);
  } catch (err) {
    error.value = err?.message || 'Could not sign in. Check your credentials and try again.';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="admin-login">
    <div class="admin-login__controls">
      <ThemeToggle class="admin-login__theme" />
      <RouterLink to="/" class="admin-login__back">
        <i class="pi pi-arrow-left" />
        Client app
      </RouterLink>
    </div>

    <section class="admin-login__brand">
      <div>
        <p>Trimobe admin</p>
        <h1>Operations console</h1>
        <span>Manage orders, bookings, drivers, products, and manual payments.</span>
      </div>
    </section>

    <section class="admin-login__panel" aria-label="Admin sign in">
      <div class="admin-login__card">
        <div class="admin-login__heading">
          <p>Secure access</p>
          <h2>Admin login</h2>
        </div>

        <form class="admin-login__form" @submit.prevent="handleSubmit">
          <label>
            <span>Email</span>
            <IconField>
              <InputIcon class="pi pi-envelope" />
              <InputText v-model="email" type="email" placeholder="admin@trimobe.mg" autocomplete="username" />
            </IconField>
          </label>

          <label>
            <span>Password</span>
            <Password
              v-model="password"
              placeholder="Password"
              :feedback="false"
              toggleMask
              fluid
              inputClass="w-full"
              autocomplete="current-password"
            />
          </label>

          <p v-if="error" class="admin-login__error" role="alert">
            <i class="pi pi-exclamation-circle" />
            {{ error }}
          </p>

          <Button type="submit" label="Sign in" icon="pi pi-lock-open" :loading="loading" />
        </form>
      </div>
    </section>
  </main>
</template>

<style scoped>
.admin-login {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(0, 0.95fr) minmax(360px, 0.72fr);
  background: var(--tm-charcoal);
}

.admin-login__controls {
  position: fixed;
  z-index: 5;
  top: 24px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 14px;
}

.admin-login__brand {
  display: grid;
  min-height: 100vh;
  min-width: 0;
  place-items: center;
  padding: 96px 38px 38px;
  background:
    linear-gradient(135deg, rgba(185, 138, 46, 0.14), transparent 38%),
    var(--tm-charcoal);
  color: #fff;
}

.admin-login__back {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 9px;
  color: rgba(255, 255, 255, 0.76);
  font-weight: 800;
}

.admin-login__brand > div {
  justify-self: center;
  max-width: 720px;
  text-align: center;
}

.admin-login__brand p {
  margin: 0 0 12px;
  color: var(--tm-gold);
  font-size: 0.82rem;
  font-weight: 900;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.admin-login__brand h1 {
  max-width: 680px;
  margin: 0 auto;
  font-size: clamp(3.4rem, 9vw, 7rem);
  line-height: 0.9;
}

.admin-login__brand span {
  display: block;
  max-width: 540px;
  margin: 24px auto 0;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.08rem;
  line-height: 1.6;
}

.admin-login__panel {
  display: grid;
  min-height: 100vh;
  min-width: 0;
  place-items: center;
  padding: 38px;
  background: var(--tm-paper);
}

.admin-login__card {
  display: grid;
  gap: 26px;
  width: min(100%, 460px);
  padding: 28px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.admin-login__controls :deep(.theme-toggle.p-button-outlined) {
  border-color: rgba(255, 255, 255, 0.26);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.admin-login__heading p,
.admin-login__heading h2 {
  margin: 0;
}

.admin-login__heading p {
  color: var(--tm-gold);
  font-size: 0.8rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.admin-login__heading h2 {
  margin-top: 6px;
  color: var(--tm-heading);
  font-size: 1.9rem;
}

.admin-login__form {
  display: grid;
  gap: 18px;
}

.admin-login__form label {
  display: grid;
  gap: 8px;
}

.admin-login__form label > span {
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 800;
}

.admin-login__form :deep(.p-inputtext),
.admin-login__form :deep(.p-password),
.admin-login__form :deep(.p-password-input) {
  width: 100%;
}

.admin-login__error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--tm-coral, #d9534f);
  border-radius: 8px;
  background: color-mix(in srgb, var(--tm-coral, #d9534f) 12%, transparent);
  color: var(--tm-coral, #d9534f);
  font-size: 0.86rem;
  font-weight: 700;
}

@media (max-width: 900px) {
  .admin-login {
    grid-template-columns: 1fr;
  }

  .admin-login__brand {
    min-height: auto;
    padding: 96px 24px 56px;
  }

  .admin-login__panel {
    min-height: auto;
    padding: 56px 24px;
  }

  .admin-login__brand h1 {
    font-size: clamp(2.7rem, 12vw, 4.2rem);
  }
}

@media (max-width: 560px) {
  .admin-login__controls {
    top: 18px;
    left: 18px;
    gap: 10px;
  }

  .admin-login__brand {
    padding: 92px 20px 40px;
  }

  .admin-login__panel {
    padding: 36px 20px;
  }
}
</style>
