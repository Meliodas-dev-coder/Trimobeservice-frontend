<script setup>
import { computed, onMounted, ref } from 'vue';

import { listHrResource } from '@/api/hr';
import { hrResources } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';

const { enumLabel, t } = useAdminI18n();
const stages = ['applied', 'screening', 'interview', 'offer', 'hired'];
const candidates = ref([]);
const loading = ref(false);
const error = ref('');
const grouped = computed(() => Object.fromEntries(stages.map((stage) => [stage, candidates.value.filter((item) => item.status === stage)])));

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await listHrResource(hrResources.candidates, { limit: 100 });
    candidates.value = result.items;
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="hr-pipeline">
    <header>
      <div><p>{{ t('Live funnel') }}</p><h3>{{ t('Candidate pipeline') }}</h3></div>
      <Button icon="pi pi-refresh" severity="secondary" text rounded :loading="loading" :aria-label="t('Refresh')" @click="load" />
    </header>
    <div v-if="error" class="hr-pipeline__error"><i class="pi pi-exclamation-circle" /> {{ error }}</div>
    <div v-else class="hr-pipeline__lanes" :class="{ 'is-loading': loading }">
      <section v-for="stage in stages" :key="stage">
        <header><strong>{{ enumLabel(stage) }}</strong><span>{{ grouped[stage].length }}</span></header>
        <article v-for="candidate in grouped[stage].slice(0, 8)" :key="candidate.id">
          <span>{{ candidate.full_name || `${candidate.first_name} ${candidate.last_name}` }}</span>
          <small>{{ candidate.vacancy_title || candidate.email }}</small>
          <Tag v-if="candidate.rating" :value="`${candidate.rating}/5`" severity="secondary" />
        </article>
        <p v-if="!grouped[stage].length">{{ t('No candidates') }}</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.hr-pipeline { padding: 17px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 10px 28px rgba(37,31,20,.05); }
.hr-pipeline > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 13px; }
.hr-pipeline > header p { margin: 0 0 3px; color: var(--tm-gold); font-size: .67rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
.hr-pipeline h3 { margin: 0; color: var(--tm-heading); font-size: 1.15rem; }
.hr-pipeline__lanes { display: grid; grid-template-columns: repeat(5, minmax(180px, 1fr)); gap: 8px; overflow-x: auto; transition: opacity .15s; }
.hr-pipeline__lanes.is-loading { opacity: .5; }
.hr-pipeline__lanes > section { min-height: 210px; padding: 9px; border: 1px solid var(--tm-border); border-radius: 12px; background: var(--tm-surface-soft); }
.hr-pipeline__lanes section > header { display: flex; align-items: center; justify-content: space-between; padding: 2px 3px 9px; color: var(--tm-heading); font-size: .76rem; }
.hr-pipeline__lanes section > header span { display: grid; min-width: 23px; height: 23px; padding: 0 5px; border-radius: 50%; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.hr-pipeline article { display: grid; gap: 4px; margin-bottom: 6px; padding: 9px; border: 1px solid var(--tm-border); border-radius: 9px; background: var(--tm-surface); }
.hr-pipeline article > span { color: var(--tm-heading); font-size: .79rem; font-weight: 850; }
.hr-pipeline article small { overflow: hidden; color: var(--tm-muted); font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }
.hr-pipeline article :deep(.p-tag) { justify-self: start; font-size: .62rem; }
.hr-pipeline section > p { padding: 22px 4px; color: var(--tm-muted); font-size: .73rem; text-align: center; }
.hr-pipeline__error { color: var(--tm-coral); }
</style>
