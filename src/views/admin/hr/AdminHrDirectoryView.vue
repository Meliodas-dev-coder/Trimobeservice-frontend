<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import HrResourceTable from '@/components/admin/hr/HrResourceTable.vue';
import HrWorkspaceNav from '@/components/admin/hr/HrWorkspaceNav.vue';
import { hrResources } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';

const { t } = useAdminI18n();
const route = useRoute();
const accountsMode = computed(() => route.query.accounts === '1');
const directoryResource = computed(() => ({
  ...hrResources.employees,
  title: accountsMode.value ? 'Employee accounts' : hrResources.employees.title,
  description: accountsMode.value
    ? 'Open an employee profile to provision, suspend, or review their admin workspace access.'
    : hrResources.employees.description,
}));
</script>

<template>
  <section class="hr-page">
    <HrWorkspaceNav />
    <header class="hr-page__hero">
      <div class="hr-page__icon"><i class="pi pi-users" /></div>
      <div>
        <p>{{ t(accountsMode ? 'Identity and access' : 'People foundation') }}</p>
        <h2>{{ t(accountsMode ? 'Employee accounts' : 'Employee directory') }}</h2>
        <span>{{ t(accountsMode ? 'Team members are now employees with a linked login. Open a profile and use its Access tab to manage the account and preview effective permissions.' : 'One secure record for identity, work, reporting lines, contracts, documents, contacts, and the complete employee journey.') }}</span>
      </div>
    </header>
    <HrResourceTable :resource="directoryResource" />
  </section>
</template>

<style scoped>
.hr-page { display: grid; gap: 17px; }
.hr-page__hero { display: flex; align-items: center; gap: 15px; padding: 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: radial-gradient(circle at 100% 0%,rgba(12,155,128,.1),transparent 48%),var(--tm-surface); box-shadow: 0 10px 28px rgba(37,31,20,.045); }
.hr-page__icon { display: grid; width: 48px; height: 48px; flex: 0 0 auto; border-radius: 14px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.hr-page__hero p { margin: 0 0 4px; color: var(--tm-gold); font-size: .68rem; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; }
.hr-page__hero h2 { margin: 0; color: var(--tm-heading); font-size: 1.5rem; letter-spacing: -.035em; }.hr-page__hero span { display: block; max-width: 860px; margin-top: 6px; color: var(--tm-muted); font-size: .86rem; line-height: 1.5; }
</style>
