<script setup>
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const { t } = useAdminI18n();
const auth = useAuthStore();
</script>

<template>
  <section class="admin-no-access">
    <i class="pi pi-lock" />
    <h2>{{ t('No screens assigned yet') }}</h2>
    <p>
      {{ t('Your account does not have access to any admin screens yet. Ask a super-admin to assign you a role.') }}
    </p>
    <RouterLink to="/" class="admin-no-access__link">
      <i class="pi pi-external-link" />
      {{ t('Open client app') }}
    </RouterLink>
    <span class="admin-no-access__who">{{ auth.displayName }}</span>
  </section>
</template>

<style scoped>
.admin-no-access {
  display: grid;
  min-height: 320px;
  place-items: center;
  gap: 12px;
  padding: 48px 26px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
  text-align: center;
}

.admin-no-access i {
  font-size: 2.2rem;
  color: var(--tm-gold);
}

.admin-no-access h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.6rem;
}

.admin-no-access p {
  max-width: 460px;
  margin: 0;
  color: var(--tm-muted);
  line-height: 1.6;
}

.admin-no-access__link {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
  color: var(--tm-gold);
  font-weight: 800;
}

.admin-no-access__who {
  color: var(--tm-muted);
  font-size: 0.82rem;
}
</style>
