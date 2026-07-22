<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useToast } from 'primevue/usetoast';

import { clockInAttendance, clockOutAttendance, getMyAttendanceToday } from '@/api/hr';
import { useAdminI18n } from '@/i18n/admin';

const emit = defineEmits(['changed']);
const toast = useToast();
const { localeCode, t } = useAdminI18n();

const record = ref(null);
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const nowTick = ref(Date.now());
let timer = null;

const clockedIn = computed(() => Boolean(record.value?.clock_in));
const clockedOut = computed(() => Boolean(record.value?.clock_out));
// out = nothing recorded yet, in = clocked in and running, done = clocked out.
const state = computed(() => (clockedOut.value ? 'done' : clockedIn.value ? 'in' : 'out'));

const today = computed(() => new Intl.DateTimeFormat(localeCode.value, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()));

const elapsedSeconds = computed(() => {
  if (state.value !== 'in' || !record.value?.clock_in) return 0;
  const start = new Date(record.value.clock_in).getTime();
  return Math.max(0, Math.floor((nowTick.value - start) / 1000));
});

const elapsedLabel = computed(() => {
  const total = elapsedSeconds.value;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
});

const summary = computed(() => {
  if (state.value !== 'done') return [];
  return [
    { label: 'Worked', value: formatDuration(record.value?.worked_minutes), tone: 'emerald' },
    { label: 'Late', value: formatDuration(record.value?.late_minutes), tone: 'coral' },
    { label: 'Overtime', value: formatDuration(record.value?.overtime_minutes), tone: 'blue' },
  ];
});

function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(localeCode.value, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatDuration(value) {
  const minutes = Number(value || 0);
  if (minutes <= 0) return '0m';
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    record.value = await getMyAttendanceToday();
  } catch (err) {
    error.value = err.message || t('Could not load your attendance.');
  } finally {
    loading.value = false;
  }
}

async function clockIn() {
  busy.value = true;
  try {
    record.value = await clockInAttendance();
    toast.add({ severity: 'success', summary: t('Clocked in'), detail: t('Your working time is now being recorded.'), life: 2600 });
    emit('changed');
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not clock in'), detail: err.message, life: 5000 });
  } finally {
    busy.value = false;
  }
}

async function clockOut() {
  busy.value = true;
  try {
    record.value = await clockOutAttendance();
    const late = Number(record.value?.late_minutes || 0);
    const overtime = Number(record.value?.overtime_minutes || 0);
    const parts = [];
    if (late > 0) parts.push(`${formatDuration(late)} ${t('late')}`);
    if (overtime > 0) parts.push(`${formatDuration(overtime)} ${t('overtime')}`);
    toast.add({
      severity: 'success',
      summary: t('Clocked out'),
      detail: parts.length ? parts.join(' · ') : t('On time — have a good day!'),
      life: 4200,
    });
    emit('changed');
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not clock out'), detail: err.message, life: 5000 });
  } finally {
    busy.value = false;
  }
}

onMounted(() => {
  load();
  timer = window.setInterval(() => { nowTick.value = Date.now(); }, 1000);
});
onUnmounted(() => { if (timer) window.clearInterval(timer); });
</script>

<template>
  <section class="hr-clock" :class="`is-${state}`">
    <div class="hr-clock__intro">
      <span class="hr-clock__icon"><i class="pi pi-clock" /></span>
      <div>
        <p>{{ t('My working time') }}</p>
        <h3>{{ today }}</h3>
      </div>
    </div>

    <div v-if="loading" class="hr-clock__body is-muted">
      <i class="pi pi-spin pi-spinner" /> {{ t('Loading…') }}
    </div>

    <div v-else-if="error" class="hr-clock__body is-muted">
      <i class="pi pi-exclamation-circle" /> {{ error }}
    </div>

    <template v-else>
      <!-- Not clocked in yet -->
      <div v-if="state === 'out'" class="hr-clock__body">
        <div class="hr-clock__status">
          <span>{{ t('Not clocked in') }}</span>
          <strong>--:--:--</strong>
        </div>
        <Button :label="t('Clock in')" icon="pi pi-play" :loading="busy" @click="clockIn" />
      </div>

      <!-- Clocked in, timer running -->
      <div v-else-if="state === 'in'" class="hr-clock__body">
        <div class="hr-clock__status">
          <span>{{ t('Clocked in at {time}', { time: formatTime(record.clock_in) }) }}</span>
          <strong class="hr-clock__timer">{{ elapsedLabel }}</strong>
        </div>
        <Button :label="t('Clock out')" icon="pi pi-stop" severity="warn" :loading="busy" @click="clockOut" />
      </div>

      <!-- Completed for today -->
      <div v-else class="hr-clock__body is-done">
        <div class="hr-clock__status">
          <span>{{ t('{start} → {end}', { start: formatTime(record.clock_in), end: formatTime(record.clock_out) }) }}</span>
          <strong>{{ t('Completed for today') }}</strong>
        </div>
        <div class="hr-clock__summary">
          <article v-for="stat in summary" :key="stat.label" :class="`is-${stat.tone}`">
            <span>{{ t(stat.label) }}</span>
            <strong>{{ stat.value }}</strong>
          </article>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.hr-clock { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: radial-gradient(circle at 0% 0%, color-mix(in srgb, var(--accent, var(--tm-gold)) 12%, transparent), transparent 45%), var(--tm-surface); box-shadow: 0 10px 28px rgba(37, 31, 20, .05); }
.hr-clock.is-in { --accent: var(--tm-emerald); }
.hr-clock.is-done { --accent: var(--tm-blue); }
.hr-clock__intro { display: flex; align-items: center; gap: 13px; min-width: 0; }
.hr-clock__icon { display: grid; width: 44px; height: 44px; flex: 0 0 auto; border-radius: 13px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.hr-clock__intro p { margin: 0 0 3px; color: var(--tm-gold); font-size: .67rem; font-weight: 950; letter-spacing: .11em; text-transform: uppercase; }
.hr-clock__intro h3 { margin: 0; color: var(--tm-heading); font-size: 1.15rem; letter-spacing: -.02em; text-transform: capitalize; }
.hr-clock__body { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; }
.hr-clock__body.is-muted { color: var(--tm-muted); font-size: .86rem; }
.hr-clock__status { display: grid; gap: 3px; }
.hr-clock__status span { color: var(--tm-muted); font-size: .74rem; font-weight: 800; }
.hr-clock__status strong { color: var(--tm-heading); font-size: 1.3rem; letter-spacing: -.02em; }
.hr-clock__timer { font-variant-numeric: tabular-nums; color: var(--tm-emerald) !important; }
.hr-clock__summary { display: flex; gap: 8px; }
.hr-clock__summary article { --tone: var(--tm-gold); display: grid; gap: 2px; padding: 8px 12px; border: 1px solid var(--tm-border); border-radius: 11px; background: var(--tm-surface); }
.hr-clock__summary article.is-emerald { --tone: var(--tm-emerald); } .hr-clock__summary article.is-coral { --tone: var(--tm-coral); } .hr-clock__summary article.is-blue { --tone: var(--tm-blue); }
.hr-clock__summary span { color: var(--tm-muted); font-size: .66rem; font-weight: 850; text-transform: uppercase; letter-spacing: .05em; }
.hr-clock__summary strong { color: var(--tone); font-size: 1rem; }
@media (max-width: 620px) {
  .hr-clock { flex-direction: column; align-items: stretch; }
  .hr-clock__body { justify-content: space-between; }
  .hr-clock__body :deep(.p-button) { flex: 1; }
}
</style>
