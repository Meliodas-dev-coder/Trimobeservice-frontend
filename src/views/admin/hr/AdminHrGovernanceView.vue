<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import HrResourceTable from '@/components/admin/hr/HrResourceTable.vue';
import HrWorkspaceNav from '@/components/admin/hr/HrWorkspaceNav.vue';
import { getHrResource } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const { t } = useAdminI18n();
const auth = useAuthStore();
const resource = computed(() => getHrResource(route.meta.hrResource));
const canOpenReports = computed(() => auth.can(['hr', 'hr_reports']));
</script>

<template>
  <section class="hr-governance">
    <HrWorkspaceNav />
    <header>
      <i :class="resource.icon" />
      <div><p>{{ t('HR governance') }}</p><h2>{{ t(resource.title) }}</h2><span>{{ t(resource.description) }}</span></div>
      <RouterLink v-if="canOpenReports" to="/admin/hr/reports"><Button :label="t('Back to reports')" icon="pi pi-arrow-left" severity="secondary" outlined /></RouterLink>
    </header>
    <HrResourceTable :resource="resource" :show-header="false" />
  </section>
</template>

<style scoped>
.hr-governance { display: grid; gap: 16px; }.hr-governance > header { display: flex; align-items: center; gap: 13px; padding: 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); }.hr-governance > header > i { display: grid; width: 44px; height: 44px; flex: 0 0 auto; border-radius: 13px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }.hr-governance header p { margin: 0 0 3px; color: var(--tm-gold); font-size: .67rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }.hr-governance h2 { margin: 0; color: var(--tm-heading); font-size: 1.4rem; }.hr-governance header span { display: block; margin-top: 4px; color: var(--tm-muted); font-size: .82rem; }.hr-governance header a { margin-left: auto; text-decoration: none; }
@media (max-width: 640px) { .hr-governance > header { flex-wrap: wrap; }.hr-governance header a { width: 100%; margin-left: 0; }.hr-governance header a :deep(.p-button) { width: 100%; } }
</style>
