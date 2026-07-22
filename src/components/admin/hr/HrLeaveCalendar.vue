<script setup>
import { computed, onMounted, ref } from 'vue';

import { loadHrLeaveCalendar, toDateOnly } from '@/api/hr';
import { useAdminI18n } from '@/i18n/admin';

const { enumLabel, localeCode, t } = useAdminI18n();
const cursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
const requests = ref([]);
const loading = ref(false);
const error = ref('');

const title = computed(() => new Intl.DateTimeFormat(localeCode.value, { month: 'long', year: 'numeric' }).format(cursor.value));
const weekdayLabels = computed(() => {
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(localeCode.value, { weekday: 'short' })
    .format(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)));
});

const days = computed(() => {
  const first = cursor.value;
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const key = toDateOnly(date);
    const events = requests.value.filter((request) => key >= String(request.start_date).slice(0, 10) && key <= String(request.end_date).slice(0, 10));
    return {
      date,
      key,
      current: date.getMonth() === first.getMonth(),
      today: key === toDateOnly(new Date()),
      events,
    };
  });
});

async function load() {
  loading.value = true;
  error.value = '';
  const from = toDateOnly(days.value[0].date);
  const to = toDateOnly(days.value.at(-1).date);
  try {
    const result = await loadHrLeaveCalendar(from, to);
    requests.value = result.filter((item) => ['pending', 'approved'].includes(item.status));
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function moveMonth(delta) {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + delta, 1);
  load();
}

onMounted(load);
</script>

<template>
  <section class="hr-calendar">
    <header>
      <div>
        <p>{{ t('Team availability') }}</p>
        <h3>{{ title }}</h3>
      </div>
      <div class="hr-calendar__actions">
        <Button icon="pi pi-angle-left" severity="secondary" outlined :aria-label="t('Previous month')" @click="moveMonth(-1)" />
        <Button :label="t('Today')" severity="secondary" text @click="cursor = new Date(new Date().getFullYear(), new Date().getMonth(), 1); load()" />
        <Button icon="pi pi-angle-right" severity="secondary" outlined :aria-label="t('Next month')" @click="moveMonth(1)" />
      </div>
    </header>

    <div v-if="error" class="hr-calendar__error">
      <i class="pi pi-exclamation-circle" /> {{ error }}
      <Button :label="t('Try again')" severity="secondary" text @click="load" />
    </div>
    <div class="hr-calendar__grid" :class="{ 'is-loading': loading }">
      <strong v-for="weekday in weekdayLabels" :key="weekday" class="hr-calendar__weekday">{{ weekday }}</strong>
      <article v-for="day in days" :key="day.key" :class="{ 'is-muted': !day.current, 'is-today': day.today }">
        <span class="hr-calendar__day">{{ day.date.getDate() }}</span>
        <div class="hr-calendar__events">
          <span v-for="event in day.events.slice(0, 3)" :key="event.id" :class="`is-${event.status}`" :title="event.reason || ''">
            {{ event.employee_name || `${event.first_name || ''} ${event.last_name || ''}`.trim() || `#${event.employee_id}` }}
          </span>
          <small v-if="day.events.length > 3">+{{ day.events.length - 3 }} {{ t('more') }}</small>
        </div>
      </article>
    </div>

    <footer>
      <span><i class="is-approved" /> {{ enumLabel('approved') }}</span>
      <span><i class="is-pending" /> {{ enumLabel('pending') }}</span>
    </footer>
  </section>
</template>

<style scoped>
.hr-calendar { overflow: hidden; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); }
.hr-calendar > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 17px 18px; border-bottom: 1px solid var(--tm-border); }
.hr-calendar header p { margin: 0 0 4px; color: var(--tm-gold); font-size: .68rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
.hr-calendar h3 { margin: 0; color: var(--tm-heading); font-size: 1.25rem; text-transform: capitalize; }
.hr-calendar__actions { display: flex; align-items: center; gap: 5px; }
.hr-calendar__grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); transition: opacity .15s; }
.hr-calendar__grid.is-loading { opacity: .52; pointer-events: none; }
.hr-calendar__weekday { padding: 9px; border-bottom: 1px solid var(--tm-border); background: var(--tm-surface-soft); color: var(--tm-muted); font-size: .68rem; letter-spacing: .04em; text-align: center; text-transform: uppercase; }
.hr-calendar article { min-height: 116px; padding: 8px; border-right: 1px solid var(--tm-border); border-bottom: 1px solid var(--tm-border); }
.hr-calendar article:nth-of-type(7n) { border-right: 0; }
.hr-calendar article.is-muted { background: color-mix(in srgb, var(--tm-surface-soft) 60%, transparent); opacity: .58; }
.hr-calendar__day { display: grid; width: 26px; height: 26px; margin-bottom: 5px; border-radius: 50%; color: var(--tm-heading); font-size: .78rem; font-weight: 900; place-items: center; }
.hr-calendar article.is-today .hr-calendar__day { background: var(--tm-charcoal); color: var(--tm-gold); }
.hr-calendar__events { display: grid; gap: 3px; }
.hr-calendar__events span { overflow: hidden; padding: 4px 5px; border-radius: 5px; background: rgba(12,155,128,.12); color: var(--tm-emerald); font-size: .66rem; font-weight: 800; text-overflow: ellipsis; white-space: nowrap; }
.hr-calendar__events span.is-pending { background: rgba(201,146,44,.13); color: #9a6d13; }
.hr-calendar__events small { color: var(--tm-muted); font-size: .64rem; }
.hr-calendar > footer { display: flex; gap: 18px; padding: 11px 18px; color: var(--tm-muted); font-size: .75rem; }
.hr-calendar > footer span { display: flex; align-items: center; gap: 6px; }
.hr-calendar > footer i { width: 9px; height: 9px; border-radius: 3px; background: var(--tm-emerald); }
.hr-calendar > footer i.is-pending { background: var(--tm-gold); }
.hr-calendar__error { display: flex; align-items: center; gap: 8px; padding: 12px 18px; color: var(--tm-coral); }

@media (max-width: 740px) {
  .hr-calendar > header { align-items: stretch; flex-direction: column; }
  .hr-calendar__actions { justify-content: space-between; }
  .hr-calendar__grid { min-width: 760px; }
  .hr-calendar { overflow-x: auto; }
}
</style>
