<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { useAdminI18n } from '@/i18n/admin';
import { useNotificationsStore } from '@/stores/notifications';
import { formatMGA } from '@/utils/format';

const { enumLabel, t } = useAdminI18n();
const store = useNotificationsStore();
const router = useRouter();

const open = ref(false);
const rootEl = ref(null);

const items = computed(() => store.items);
const unread = computed(() => store.unread);
const connected = computed(() => store.connected);
const badge = computed(() => (unread.value > 9 ? '9+' : String(unread.value)));

function toggle() {
  open.value = !open.value;
  if (open.value) {
    store.markAllRead();
  }
}

function openItem(n) {
  open.value = false;
  router.push(n.to);
}

function amountLabel(n) {
  return n.amount != null && n.amount !== '' ? formatMGA(Number(n.amount)) : '';
}

// Compact relative time; the feed on the dashboard shows the fuller timestamp.
function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return t('just now');
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function onDocClick(e) {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target)) {
    open.value = false;
  }
}

function onKey(e) {
  if (e.key === 'Escape') {
    open.value = false;
  }
}

// The bell lives in the always-present admin shell, so its mount/unmount is the
// natural lifetime for the SSE stream.
onMounted(() => {
  store.start();
  document.addEventListener('click', onDocClick);
  document.addEventListener('keydown', onKey);
});

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocClick);
  document.removeEventListener('keydown', onKey);
  store.stop();
});
</script>

<template>
  <div ref="rootEl" class="notif">
    <button
      type="button"
      class="notif__bell"
      :class="{ 'is-open': open }"
      :aria-label="t('Notifications')"
      :aria-expanded="open"
      @click="toggle"
    >
      <i class="pi pi-bell" />
      <span v-if="unread > 0" class="notif__badge">{{ badge }}</span>
    </button>

    <div v-if="open" class="notif__panel" role="menu">
      <header class="notif__head">
        <div class="notif__title">
          <span>{{ t('Notifications') }}</span>
          <span class="notif__dot" :class="{ 'is-live': connected }" :title="connected ? t('Live') : t('Reconnecting…')" />
        </div>
        <button v-if="items.length" type="button" class="notif__clear" @click="store.clear()">
          {{ t('Clear') }}
        </button>
      </header>

      <ul v-if="items.length" class="notif__list">
        <li v-for="n in items" :key="n.id">
          <button type="button" class="notif__item" @click="openItem(n)">
            <i :class="['notif__icon', n.icon]" />
            <span class="notif__body">
              <span class="notif__line">
                <strong>{{ t(n.title) }}</strong>
                <span class="notif__time">{{ timeAgo(n.at) }}</span>
              </span>
              <span class="notif__meta">
                <span v-if="n.number" class="notif__num">{{ n.number }}</span>
                <span v-if="n.customer" class="notif__cust">· {{ n.customer }}</span>
                <span v-else-if="n.method" class="notif__cust">· {{ enumLabel(n.method) }}</span>
                <span v-if="amountLabel(n)" class="notif__amt">· {{ amountLabel(n) }}</span>
                <span v-if="n.showStatus && n.status" class="notif__chip">{{ enumLabel(n.status) }}</span>
              </span>
            </span>
            <i class="pi pi-angle-right notif__go" />
          </button>
        </li>
      </ul>

      <p v-else class="notif__empty">{{ t('No new activity yet.') }}</p>
    </div>
  </div>
</template>

<style scoped>
.notif {
  position: relative;
}

.notif__bell {
  position: relative;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface, transparent);
  color: var(--tm-heading);
  cursor: pointer;
}

.notif__bell:hover,
.notif__bell.is-open {
  border-color: var(--tm-gold);
  color: var(--tm-gold);
}

.notif__badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: #e5484d;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 18px;
  text-align: center;
}

.notif__panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 60;
  width: min(360px, calc(100vw - 32px));
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 10px;
  background: var(--tm-surface, var(--tm-page-bg));
  box-shadow: var(--tm-shadow, 0 12px 32px rgba(0, 0, 0, 0.28));
}

.notif__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid var(--tm-border);
}

.notif__title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tm-heading);
  font-weight: 800;
}

.notif__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--tm-muted);
}

.notif__dot.is-live {
  background: #2fbf71;
  box-shadow: 0 0 0 3px rgba(47, 191, 113, 0.18);
}

.notif__clear {
  border: 0;
  background: transparent;
  color: var(--tm-gold);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 700;
}

.notif__list {
  max-height: min(420px, 60vh);
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  list-style: none;
}

.notif__item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  padding: 10px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--tm-heading);
  cursor: pointer;
  text-align: left;
}

.notif__item:hover {
  background: var(--tm-surface-muted, rgba(125, 125, 125, 0.12));
}

.notif__icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 8px;
  background: var(--tm-charcoal, rgba(0, 0, 0, 0.35));
  color: var(--tm-gold);
}

.notif__body {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.notif__line {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}

.notif__time {
  flex: 0 0 auto;
  color: var(--tm-muted);
  font-size: 0.74rem;
}

.notif__meta {
  overflow: hidden;
  color: var(--tm-muted);
  font-size: 0.84rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notif__num {
  color: var(--tm-heading);
  font-weight: 700;
}

.notif__chip {
  margin-left: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--tm-surface-muted, rgba(125, 125, 125, 0.18));
  color: var(--tm-heading);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.notif__go {
  flex: 0 0 auto;
  color: var(--tm-muted);
  font-size: 0.8rem;
}

.notif__empty {
  margin: 0;
  padding: 26px 14px;
  color: var(--tm-muted);
  text-align: center;
}
</style>
