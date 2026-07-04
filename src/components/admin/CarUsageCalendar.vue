<script setup>
import { computed, ref } from 'vue';

import { useAdminI18n } from '@/i18n/admin';

const props = defineProps({
  bookings: { type: Array, default: () => [] },
  title: { type: String, default: 'Usage calendar' },
  loading: { type: Boolean, default: false },
});

const { localeCode, t } = useAdminI18n();

const today = new Date();
const visibleMonth = ref(new Date(today.getFullYear(), today.getMonth(), 1));

const monthLabel = computed(() =>
  new Intl.DateTimeFormat(localeCode.value, { month: 'long', year: 'numeric' }).format(visibleMonth.value),
);

const weekdays = computed(() => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => t(day)));

const calendarDays = computed(() => {
  const month = visibleMonth.value;
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < firstDay.getDay(); i += 1) {
    cells.push({ key: `blank-${i}`, blank: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day);
    cells.push({
      key: date.toISOString(),
      date,
      day,
      bookings: bookingsForDate(date),
      today: isSameDay(date, today),
    });
  }

  return cells;
});

function previousMonth() {
  const base = visibleMonth.value;
  visibleMonth.value = new Date(base.getFullYear(), base.getMonth() - 1, 1);
}

function nextMonth() {
  const base = visibleMonth.value;
  visibleMonth.value = new Date(base.getFullYear(), base.getMonth() + 1, 1);
}

function bookingsForDate(date) {
  return props.bookings.filter((booking) => {
    if (booking.status === 'cancelled') {
      return false;
    }
    const start = startOfDay(new Date(booking.start_at));
    const end = startOfDay(new Date(booking.end_at));
    return date >= start && date <= end;
  });
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
</script>

<template>
  <section class="usage-calendar">
    <div class="usage-calendar__head">
      <div>
        <h3>{{ title }}</h3>
        <p>
          {{ monthLabel }}
          <span v-if="loading" class="usage-calendar__loading">· {{ t('Loading…') }}</span>
        </p>
      </div>
      <div class="calendar-actions">
        <Button icon="pi pi-chevron-left" severity="secondary" outlined :aria-label="t('Previous month')" @click="previousMonth" />
        <Button icon="pi pi-chevron-right" severity="secondary" outlined :aria-label="t('Next month')" @click="nextMonth" />
      </div>
    </div>

    <div class="calendar-grid calendar-grid--head">
      <span v-for="day in weekdays" :key="day">{{ day }}</span>
    </div>
    <div class="calendar-grid">
      <div
        v-for="cell in calendarDays"
        :key="cell.key"
        class="calendar-day"
        :class="{ 'calendar-day--blank': cell.blank, 'calendar-day--today': cell.today }"
      >
        <template v-if="!cell.blank">
          <span class="calendar-day__number">{{ cell.day }}</span>
          <div class="calendar-day__bookings">
            <span
              v-for="booking in cell.bookings.slice(0, 2)"
              :key="booking.id"
              class="booking-pill"
              :class="`booking-pill--${booking.status}`"
            >
              {{ booking.booking_number }}
            </span>
            <span v-if="cell.bookings.length > 2" class="booking-pill booking-pill--more">
              +{{ cell.bookings.length - 2 }}
            </span>
          </div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
.usage-calendar {
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.usage-calendar__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 16px;
  border-bottom: 1px solid var(--tm-border);
}

.usage-calendar__head h3,
.usage-calendar__head p {
  margin: 0;
}

.usage-calendar__head h3 {
  color: var(--tm-heading);
  font-size: 1.05rem;
}

.usage-calendar__head p {
  margin-top: 4px;
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 700;
}

.usage-calendar__loading {
  color: var(--tm-gold);
}

.calendar-actions {
  display: flex;
  gap: 8px;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.calendar-grid--head {
  border-bottom: 1px solid var(--tm-border);
  background: var(--tm-surface-soft);
}

.calendar-grid--head span {
  padding: 10px;
  color: var(--tm-muted);
  font-size: 0.75rem;
  font-weight: 900;
  text-align: center;
  text-transform: uppercase;
}

.calendar-day {
  min-height: 118px;
  padding: 8px;
  border-right: 1px solid var(--tm-border);
  border-bottom: 1px solid var(--tm-border);
  background: var(--tm-surface);
}

.calendar-day:nth-child(7n) {
  border-right: 0;
}

.calendar-day--blank {
  background: var(--tm-surface-soft);
}

.calendar-day--today {
  box-shadow: inset 0 0 0 2px var(--tm-emerald);
}

.calendar-day__number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  color: var(--tm-heading);
  font-weight: 900;
}

.calendar-day__bookings {
  display: grid;
  gap: 4px;
  margin-top: 6px;
}

.booking-pill {
  overflow: hidden;
  padding: 4px 6px;
  border-radius: 6px;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 850;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--tm-blue);
}

.booking-pill--requested,
.booking-pill--more {
  background: var(--tm-gold);
}

.booking-pill--active,
.booking-pill--confirmed,
.booking-pill--driver_assigned,
.booking-pill--completed {
  background: var(--tm-emerald);
}

.booking-pill--cancelled {
  background: var(--tm-coral);
}

@media (max-width: 680px) {
  .usage-calendar {
    overflow-x: auto;
  }

  .calendar-grid {
    min-width: 720px;
  }
}
</style>
