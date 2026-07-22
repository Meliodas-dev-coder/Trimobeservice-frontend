<script setup>
import { computed, onMounted, ref, watch } from 'vue';

import { loadHrAttendanceCalendar, toDateOnly } from '@/api/hr';
import { useAdminI18n } from '@/i18n/admin';

const { enumLabel, localeCode, t } = useAdminI18n();

const MODES = ['fortnight', 'month'];
const mode = ref('fortnight');
// Anchor of the visible window: the Monday starting the fortnight, or the first
// day of the month. Kept as a Date so month arithmetic stays trivial.
const anchor = ref(defaultAnchor('fortnight'));
// 0 is the "all departments" sentinel: PrimeVue's Select renders the
// placeholder instead of the option label when the bound value is null.
const departmentId = ref(0);
const calendar = ref({ days: [], employees: [] });
const loading = ref(false);
const error = ref('');
const selected = ref(null);

function mondayOf(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7));
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Attendance is read backwards, so the default fortnight is last week plus this
// week — today lands in the second column block rather than at the far left.
function defaultAnchor(view) {
  const today = new Date();
  if (view === 'month') return startOfMonth(today);
  const monday = mondayOf(today);
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7);
}

const range = computed(() => {
  const start = anchor.value;
  const end = mode.value === 'month'
    ? new Date(start.getFullYear(), start.getMonth() + 1, 0)
    : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 13);
  return { start: toDateOnly(start), end: toDateOnly(end) };
});

const today = computed(() => toDateOnly(new Date()));

const title = computed(() => {
  const format = new Intl.DateTimeFormat(localeCode.value, { day: 'numeric', month: 'short', year: 'numeric' });
  if (mode.value === 'month') {
    return new Intl.DateTimeFormat(localeCode.value, { month: 'long', year: 'numeric' }).format(anchor.value);
  }
  // Parse as local midnight: "YYYY-MM-DD" alone is read as UTC and would shift a
  // day west of Greenwich.
  return `${format.format(anchor.value)} — ${format.format(new Date(`${range.value.end}T00:00:00`))}`;
});

// The header repeats the weekday initial above each day number, exactly like a
// paper attendance sheet.
const columns = computed(() => (calendar.value.days || []).map((key) => {
  const date = new Date(`${key}T00:00:00`);
  return {
    key,
    day: date.getDate(),
    weekday: new Intl.DateTimeFormat(localeCode.value, { weekday: 'short' }).format(date),
    weekend: [0, 6].includes(date.getDay()),
    today: key === today.value,
    future: key > today.value,
  };
}));

// The department filter is derived from the rows the server returned, so it can
// only ever offer departments this admin is already allowed to see.
const departments = computed(() => {
  const seen = new Map();
  for (const row of calendar.value.employees || []) {
    if (row.department_id && !seen.has(row.department_id)) seen.set(row.department_id, row.department_name || `#${row.department_id}`);
  }
  return [{ id: 0, name: t('All departments') }, ...[...seen].map(([id, name]) => ({ id, name }))];
});

const rows = computed(() => (calendar.value.employees || [])
  .filter((row) => !departmentId.value || row.department_id === departmentId.value)
  .map((row) => {
    // Approved leave leaves the denominator: a booked absence is not a day the
    // employee failed to show up for.
    const expected = row.days.filter((cell) => cell.scheduled && cell.leave?.status !== 'approved').length;
    const attended = row.days.filter((cell) => ['present', 'remote'].includes(cell.status)).length;
    return {
      ...row,
      expected,
      attended,
      late: Number(row.totals?.late || 0),
      leave: Number(row.totals?.leave_approved || 0),
    };
  }));

// A cell is one of: a recorded status, booked leave, a rest day, a day still to
// come, or a scheduled past day with nothing at all (a gap worth chasing). What
// was actually recorded outranks what was planned, and a rest day inside a leave
// span stays a rest day — it consumes no leave.
function tone(cell, column) {
  if (cell.status) return Number(cell.late_minutes) > 0 && cell.status === 'present' ? 'late' : cell.status;
  if (!cell.scheduled) return 'rest';
  if (cell.leave) return cell.leave.status === 'approved' ? 'leave' : 'leave_pending';
  if (column?.future ?? cell.date > today.value) return 'upcoming';
  return 'missing';
}

function toneLabel(value) {
  return value === 'late' ? t('Late')
    : value === 'rest' ? t('Rest day')
      : value === 'missing' ? t('No record')
        : value === 'upcoming' ? t('Upcoming')
          : value === 'leave_pending' ? t('Leave requested')
            : enumLabel(value);
}

function clockLabel(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(localeCode.value, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function durationLabel(minutes) {
  const total = Number(minutes || 0);
  if (!total) return '—';
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}

function initials(name) {
  return String(name || '').split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function cellTitle(row, cell, column) {
  const parts = [row.full_name, cell.date, toneLabel(tone(cell, column))];
  if (cell.leave?.policy) parts.push(cell.leave.policy);
  if (cell.leave?.portion === 'half') parts.push(t('Half day'));
  return parts.join(' · ');
}

function openCell(row, cell, column) {
  selected.value = { row, cell, column, tone: tone(cell, column) };
}

function move(delta) {
  const current = anchor.value;
  anchor.value = mode.value === 'month'
    ? new Date(current.getFullYear(), current.getMonth() + delta, 1)
    : new Date(current.getFullYear(), current.getMonth(), current.getDate() + delta * 14);
}

function goToday() {
  anchor.value = defaultAnchor(mode.value);
}

// Switching views keeps the period being browsed: a month becomes the fortnight
// that starts it, a fortnight becomes the month it falls in.
function switchMode(value) {
  if (!MODES.includes(value) || value === mode.value) return;
  const current = anchor.value;
  mode.value = value;
  anchor.value = value === 'month' ? startOfMonth(current) : mondayOf(current);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    calendar.value = await loadHrAttendanceCalendar(range.value);
  } catch (err) {
    error.value = err.message;
    calendar.value = { days: [], employees: [] };
  } finally {
    loading.value = false;
  }
}

watch(range, load);
onMounted(load);
defineExpose({ load });
</script>

<template>
  <section class="hr-attendance">
    <header>
      <div>
        <p>{{ t('Attendance calendar') }}</p>
        <h3>{{ title }}</h3>
      </div>
      <div class="hr-attendance__controls">
        <Select
          v-model="departmentId"
          :options="departments"
          option-label="name"
          option-value="id"
          :aria-label="t('Department')"
          class="hr-attendance__department"
        />
        <div class="hr-attendance__modes" role="group" :aria-label="t('View')">
          <button type="button" :class="{ 'is-active': mode === 'fortnight' }" @click="switchMode('fortnight')">{{ t('2 weeks') }}</button>
          <button type="button" :class="{ 'is-active': mode === 'month' }" @click="switchMode('month')">{{ t('Month') }}</button>
        </div>
        <Button icon="pi pi-angle-left" severity="secondary" outlined :aria-label="t('Previous')" @click="move(-1)" />
        <Button :label="t('Today')" severity="secondary" text @click="goToday" />
        <Button icon="pi pi-angle-right" severity="secondary" outlined :aria-label="t('Next')" @click="move(1)" />
      </div>
    </header>

    <div v-if="error" class="hr-attendance__error">
      <i class="pi pi-exclamation-circle" /> {{ error }}
      <Button :label="t('Try again')" severity="secondary" text @click="load" />
    </div>

    <div class="hr-attendance__scroll" :class="{ 'is-loading': loading }">
      <table>
        <thead>
          <tr>
            <th class="hr-attendance__who">{{ t('Employee') }}</th>
            <th
              v-for="column in columns"
              :key="column.key"
              :class="{ 'is-weekend': column.weekend, 'is-today': column.today }"
              :abbr="column.key"
            >
              <span>{{ column.weekday }}</span>
              <strong>{{ column.day }}</strong>
            </th>
            <th class="hr-attendance__total">{{ t('Present') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.employee_id">
            <th class="hr-attendance__who" scope="row">
              <div class="hr-attendance__person">
                <span class="hr-attendance__avatar">
                  <img v-if="row.photo_url" :src="row.photo_url" :alt="row.full_name">
                  <em v-else>{{ initials(row.full_name) }}</em>
                </span>
                <span class="hr-attendance__name">
                  <strong>{{ row.full_name }}</strong>
                  <small>{{ row.position_title || row.department_name || '—' }}</small>
                </span>
              </div>
            </th>
            <td
              v-for="(cell, index) in row.days"
              :key="cell.date"
              :class="[
                `is-${tone(cell, columns[index])}`,
                { 'is-weekend': columns[index]?.weekend, 'is-today': columns[index]?.today, 'is-half': cell.leave?.portion === 'half' },
              ]"
            >
              <button
                type="button"
                :title="cellTitle(row, cell, columns[index])"
                @click="openCell(row, cell, columns[index])"
              >
                {{ columns[index]?.day }}
              </button>
            </td>
            <td class="hr-attendance__total">
              <div>
                <strong>{{ row.attended }}/{{ row.expected }}</strong>
                <small v-if="row.late">{{ t('{count} late', { count: row.late }) }}</small>
                <small v-if="row.leave" class="is-leave">{{ t('{count} on leave', { count: row.leave }) }}</small>
              </div>
            </td>
          </tr>
          <tr v-if="!rows.length && !loading">
            <td :colspan="columns.length + 2" class="hr-attendance__empty">{{ t('No employees to show for this period.') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <footer>
      <span><i class="is-present" /> {{ enumLabel('present') }}</span>
      <span><i class="is-late" /> {{ t('Late') }}</span>
      <span><i class="is-remote" /> {{ enumLabel('remote') }}</span>
      <span><i class="is-absent" /> {{ enumLabel('absent') }}</span>
      <span><i class="is-leave" /> {{ enumLabel('leave') }}</span>
      <span><i class="is-leave_pending" /> {{ t('Leave requested') }}</span>
      <span><i class="is-missing" /> {{ t('No record') }}</span>
      <span><i class="is-rest" /> {{ t('Rest day') }}</span>
    </footer>

    <Dialog
      :visible="!!selected"
      modal
      :header="selected ? selected.row.full_name : ''"
      :style="{ width: '26rem' }"
      @update:visible="selected = null"
    >
      <dl v-if="selected" class="hr-attendance__detail">
        <div><dt>{{ t('Date') }}</dt><dd>{{ selected.cell.date }}</dd></div>
        <div><dt>{{ t('Status') }}</dt><dd>{{ toneLabel(selected.tone) }}</dd></div>
        <div v-if="selected.cell.leave">
          <dt>{{ t('Leave') }}</dt>
          <dd>
            {{ selected.cell.leave.policy || enumLabel(selected.cell.leave.status) }}
            <template v-if="selected.cell.leave.portion === 'half'"> · {{ t('Half day') }}</template>
          </dd>
        </div>
        <template v-if="selected.cell.attendance_id">
          <div><dt>{{ t('Clock in') }}</dt><dd>{{ clockLabel(selected.cell.clock_in) }}</dd></div>
          <div><dt>{{ t('Clock out') }}</dt><dd>{{ clockLabel(selected.cell.clock_out) }}</dd></div>
          <div><dt>{{ t('Worked') }}</dt><dd>{{ durationLabel(selected.cell.worked_minutes) }}</dd></div>
        </template>
        <div v-if="selected.cell.late_minutes"><dt>{{ t('Late') }}</dt><dd>{{ durationLabel(selected.cell.late_minutes) }}</dd></div>
        <div v-if="selected.cell.overtime_minutes"><dt>{{ t('Overtime') }}</dt><dd>{{ durationLabel(selected.cell.overtime_minutes) }}</dd></div>
        <div v-if="selected.cell.shift_name"><dt>{{ t('Shift') }}</dt><dd>{{ selected.cell.shift_name }}</dd></div>
      </dl>
    </Dialog>
  </section>
</template>

<style scoped>
.hr-attendance { overflow: hidden; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); }
.hr-attendance > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 15px 18px; border-bottom: 1px solid var(--tm-border); }
.hr-attendance header p { margin: 0 0 4px; color: var(--tm-gold); font-size: .68rem; font-weight: 950; letter-spacing: .1em; text-transform: uppercase; }
.hr-attendance h3 { margin: 0; color: var(--tm-heading); font-size: 1.2rem; text-transform: capitalize; }
.hr-attendance__controls { display: flex; align-items: center; gap: 6px; }
.hr-attendance__department { min-width: 12rem; }
.hr-attendance__modes { display: flex; overflow: hidden; border: 1px solid var(--tm-border); border-radius: 9px; }
.hr-attendance__modes button { padding: 8px 12px; border: 0; background: var(--tm-surface); color: var(--tm-muted); cursor: pointer; font-size: .74rem; font-weight: 850; }
.hr-attendance__modes button.is-active { background: var(--tm-charcoal); color: #fff8ed; }

.hr-attendance__scroll { overflow-x: auto; transition: opacity .15s; }
.hr-attendance__scroll.is-loading { opacity: .52; pointer-events: none; }
.hr-attendance table { width: 100%; border-collapse: separate; border-spacing: 0; }
.hr-attendance th, .hr-attendance td { border-bottom: 1px solid var(--tm-border); text-align: center; }
.hr-attendance thead th { padding: 8px 4px; background: var(--tm-surface-soft); color: var(--tm-muted); font-size: .68rem; font-weight: 850; }
.hr-attendance thead th span { display: block; text-transform: capitalize; }
.hr-attendance thead th strong { display: block; margin-top: 2px; color: var(--tm-heading); font-size: .8rem; }
.hr-attendance th.is-weekend, .hr-attendance td.is-weekend { background: color-mix(in srgb, var(--tm-surface-soft) 70%, transparent); }
.hr-attendance th.is-today, .hr-attendance td.is-today { background: color-mix(in srgb, var(--tm-gold) 10%, transparent); }

/* The employee column stays put while the days scroll under it. */
.hr-attendance__who { position: sticky; left: 0; z-index: 2; min-width: 240px; max-width: 240px; padding: 8px 12px; background: var(--tm-surface); text-align: left; }
.hr-attendance__person { display: flex; align-items: center; gap: 10px; }
.hr-attendance thead .hr-attendance__who { background: var(--tm-surface-soft); }
.hr-attendance__avatar { display: grid; overflow: hidden; width: 36px; height: 36px; flex: 0 0 auto; border-radius: 50%; background: var(--tm-surface-soft); place-items: center; }
.hr-attendance__avatar img { width: 100%; height: 100%; object-fit: cover; }
.hr-attendance__avatar em { color: var(--tm-muted); font-size: .74rem; font-style: normal; font-weight: 900; }
.hr-attendance__name { display: grid; min-width: 0; gap: 1px; }
.hr-attendance__name strong { overflow: hidden; color: var(--tm-heading); font-size: .82rem; text-overflow: ellipsis; white-space: nowrap; }
.hr-attendance__name small { overflow: hidden; color: var(--tm-muted); font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }

.hr-attendance tbody td { padding: 5px 2px; }
.hr-attendance tbody td button { display: grid; width: 28px; height: 28px; border: 1px solid transparent; border-radius: 50%; margin: 0 auto; background: transparent; color: var(--tm-muted); cursor: pointer; font-size: .76rem; font-weight: 800; place-items: center; }
.hr-attendance tbody td button:hover { border-color: var(--tm-charcoal); }
.hr-attendance td.is-present button { background: var(--tm-emerald); color: #fff; }
.hr-attendance td.is-remote button { background: var(--tm-blue); color: #fff; }
.hr-attendance td.is-late button { border-color: var(--tm-gold); background: color-mix(in srgb, var(--tm-gold) 22%, transparent); color: #7a5410; }
.hr-attendance td.is-absent button { background: var(--tm-coral); color: #fff; }
.hr-attendance td.is-leave button { background: color-mix(in srgb, var(--tm-blue) 20%, transparent); color: var(--tm-blue); }
/* A request still in review is drawn as an outline: planned, not settled. */
.hr-attendance td.is-leave_pending button { border-style: dashed; border-color: var(--tm-blue); color: var(--tm-blue); }
/* Half a day taken: the cell is filled from the diagonal only. */
.hr-attendance td.is-half button { background-image: linear-gradient(135deg, transparent 50%, var(--tm-surface) 50%); }
.hr-attendance td.is-holiday button { background: var(--tm-surface-soft); color: var(--tm-muted); }
.hr-attendance td.is-missing button { border-color: color-mix(in srgb, var(--tm-coral) 45%, transparent); color: var(--tm-coral); }
.hr-attendance td.is-rest button, .hr-attendance td.is-upcoming button { color: color-mix(in srgb, var(--tm-muted) 70%, transparent); }

.hr-attendance__total { min-width: 92px; padding: 6px 12px; }
.hr-attendance tbody .hr-attendance__total div { display: grid; gap: 1px; }
.hr-attendance__total strong { color: var(--tm-heading); font-size: .8rem; }
.hr-attendance__total small { color: var(--tm-gold); font-size: .66rem; font-weight: 800; }
.hr-attendance__total small.is-leave { color: var(--tm-blue); }
.hr-attendance__empty { padding: 26px; color: var(--tm-muted); font-size: .85rem; }

.hr-attendance > footer { display: flex; flex-wrap: wrap; gap: 14px; padding: 11px 18px; color: var(--tm-muted); font-size: .73rem; }
.hr-attendance > footer span { display: flex; align-items: center; gap: 6px; }
.hr-attendance > footer i { width: 10px; height: 10px; border-radius: 50%; }
.hr-attendance > footer i.is-present { background: var(--tm-emerald); }
.hr-attendance > footer i.is-late { border: 1px solid var(--tm-gold); background: color-mix(in srgb, var(--tm-gold) 22%, transparent); }
.hr-attendance > footer i.is-remote { background: var(--tm-blue); }
.hr-attendance > footer i.is-absent { background: var(--tm-coral); }
.hr-attendance > footer i.is-leave { background: color-mix(in srgb, var(--tm-blue) 25%, transparent); }
.hr-attendance > footer i.is-leave_pending { border: 1px dashed var(--tm-blue); }
.hr-attendance > footer i.is-missing { border: 1px solid color-mix(in srgb, var(--tm-coral) 45%, transparent); }
.hr-attendance > footer i.is-rest { background: var(--tm-surface-soft); border: 1px solid var(--tm-border); }

.hr-attendance__error { display: flex; align-items: center; gap: 8px; padding: 12px 18px; color: var(--tm-coral); }
.hr-attendance__detail { display: grid; gap: 8px; margin: 0; }
.hr-attendance__detail > div { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
.hr-attendance__detail dt { color: var(--tm-muted); font-size: .76rem; }
.hr-attendance__detail dd { margin: 0; color: var(--tm-heading); font-size: .84rem; font-weight: 800; }

@media (max-width: 900px) {
  .hr-attendance > header { align-items: stretch; flex-direction: column; }
  .hr-attendance__controls { flex-wrap: wrap; }
  .hr-attendance__who { min-width: 180px; max-width: 180px; }
}
</style>
