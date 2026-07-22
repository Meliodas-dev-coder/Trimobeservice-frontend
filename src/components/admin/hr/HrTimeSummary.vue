<script setup>
import { computed, onMounted, ref } from 'vue';

import { listHrResource, toDateOnly } from '@/api/hr';
import { hrResources } from '@/data/hrResources';
import { useAdminI18n } from '@/i18n/admin';

const { t } = useAdminI18n();
const records = ref([]);
const loading = ref(false);
const metrics = computed(() => [
  { label: 'Present today', value: records.value.filter((row) => ['present', 'remote'].includes(row.status)).length, icon: 'pi pi-check-circle', tone: 'emerald' },
  { label: 'Absent today', value: records.value.filter((row) => row.status === 'absent').length, icon: 'pi pi-user-minus', tone: 'coral' },
  { label: 'Late arrivals', value: records.value.filter((row) => Number(row.late_minutes) > 0).length, icon: 'pi pi-stopwatch', tone: 'gold' },
  { label: 'Overtime today', value: `${Math.round(records.value.reduce((sum, row) => sum + Number(row.overtime_minutes || 0), 0) / 60 * 10) / 10}h`, icon: 'pi pi-hourglass', tone: 'blue' },
]);

async function load() {
  loading.value = true;
  try {
    const result = await listHrResource(hrResources.attendance, { limit: 100, params: { attendance_date: toDateOnly(new Date()) } });
    records.value = result.items;
  } catch {
    records.value = [];
  } finally {
    loading.value = false;
  }
}
onMounted(load);
defineExpose({ load });
</script>

<template>
  <section class="hr-time-metrics" :class="{ 'is-loading': loading }">
    <article v-for="metric in metrics" :key="metric.label" :class="`is-${metric.tone}`">
      <i :class="metric.icon" />
      <div><span>{{ t(metric.label) }}</span><strong>{{ metric.value }}</strong></div>
    </article>
  </section>
</template>

<style scoped>
.hr-time-metrics { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; transition: opacity .15s; }
.hr-time-metrics.is-loading { opacity: .55; }
.hr-time-metrics article { --accent: var(--tm-gold); display: flex; align-items: center; gap: 11px; padding: 14px; border: 1px solid var(--tm-border); border-radius: 14px; background: var(--tm-surface); box-shadow: 0 8px 22px rgba(37,31,20,.04); }
.hr-time-metrics article.is-emerald { --accent: var(--tm-emerald); }.hr-time-metrics article.is-coral { --accent: var(--tm-coral); }.hr-time-metrics article.is-blue { --accent: var(--tm-blue); }
.hr-time-metrics article > i { display: grid; width: 36px; height: 36px; flex: 0 0 auto; border-radius: 11px; background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); place-items: center; }
.hr-time-metrics div { display: grid; gap: 3px; }.hr-time-metrics span { color: var(--tm-muted); font-size: .72rem; font-weight: 800; }.hr-time-metrics strong { color: var(--tm-heading); font-size: 1.35rem; }
@media (max-width: 920px) { .hr-time-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 500px) { .hr-time-metrics { grid-template-columns: 1fr; } }
</style>
