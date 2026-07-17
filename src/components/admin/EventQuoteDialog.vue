<script setup>
import { computed, ref, watch } from 'vue';

import { useAdminI18n } from '@/i18n/admin';
import { formatMGA } from '@/utils/format';

// Per-line quote editor for an event request: the admin prices each selected
// service and artist, and the quoted total is their sum. Emits a body the
// event-requests /quote endpoint understands ({ services:[{id,price}], ... }).
const props = defineProps({
  visible: { type: Boolean, required: true },
  request: { type: Object, default: null },
  loading: { type: Boolean, default: false },
});

const emit = defineEmits(['update:visible', 'submit']);

const { t } = useAdminI18n();

const isOpen = computed({
  get: () => props.visible,
  set: (v) => emit('update:visible', v),
});

const services = ref([]);
const artists = ref([]);
const lumpTotal = ref(0);
const adminNote = ref('');

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Seed the editor from the request: prefill each price with the agreed amount if
// already quoted, otherwise the indicative catalog price.
function seed() {
  const req = props.request || {};
  services.value = (Array.isArray(req.services) ? req.services : []).map((s) => ({
    id: s.id,
    name: s.service_name,
    category: s.category_name,
    quantity: s.quantity > 0 ? s.quantity : 1,
    from: s.from_price_snapshot != null ? num(s.from_price_snapshot) : null,
    price: num(s.quoted_unit_price != null ? s.quoted_unit_price : s.from_price_snapshot),
  }));
  artists.value = (Array.isArray(req.artists) ? req.artists : []).map((a) => ({
    id: a.id,
    name: a.artist_name,
    from: a.fee_snapshot != null ? num(a.fee_snapshot) : null,
    price: num(a.quoted_fee != null ? a.quoted_fee : a.fee_snapshot),
  }));
  lumpTotal.value = num(req.quoted_price);
  adminNote.value = req.admin_note || '';
}

watch(
  () => [props.visible, props.request],
  () => {
    if (props.visible) seed();
  },
  { immediate: true },
);

const hasLines = computed(() => services.value.length > 0 || artists.value.length > 0);

function serviceTotal(s) {
  return num(s.price) * (s.quantity > 0 ? s.quantity : 1);
}

const grandTotal = computed(() => {
  if (!hasLines.value) return num(lumpTotal.value);
  return (
    services.value.reduce((sum, s) => sum + serviceTotal(s), 0) +
    artists.value.reduce((sum, a) => sum + num(a.price), 0)
  );
});

function submit() {
  if (props.loading) return;
  let body;
  if (hasLines.value) {
    body = {
      services: services.value.map((s) => ({ id: s.id, price: String(num(s.price)) })),
      artists: artists.value.map((a) => ({ id: a.id, price: String(num(a.price)) })),
    };
  } else {
    body = { quoted_price: String(num(lumpTotal.value)) };
  }
  const note = adminNote.value.trim();
  if (note) body.admin_note = note;
  emit('submit', body);
}
</script>

<template>
  <Dialog v-model:visible="isOpen" modal :header="t('Set quote')" :style="{ width: '660px', maxWidth: '96vw' }">
    <div class="quote-dialog">
      <p class="quote-hint">{{ t('Price each service and artist — the quoted total is their sum.') }}</p>

      <template v-if="hasLines">
        <div v-if="services.length" class="quote-group">
          <div class="quote-group__title">{{ t('Services') }}</div>
          <div v-for="s in services" :key="`s-${s.id}`" class="quote-row">
            <div class="quote-row__name">
              <span class="quote-row__label">{{ s.name }}</span>
              <span class="quote-row__meta">
                <span v-if="s.category">{{ s.category }}</span>
                <span>{{ t('Qty') }} {{ s.quantity }}</span>
                <span v-if="s.from != null">{{ t('From') }} {{ formatMGA(s.from) }}</span>
              </span>
            </div>
            <InputNumber
              v-model="s.price"
              :min="0"
              mode="decimal"
              :maxFractionDigits="2"
              :useGrouping="true"
              suffix=" MGA"
              class="quote-row__price"
            />
            <div class="quote-row__total">{{ formatMGA(serviceTotal(s)) }}</div>
          </div>
        </div>

        <div v-if="artists.length" class="quote-group">
          <div class="quote-group__title">{{ t('Artists') }}</div>
          <div v-for="a in artists" :key="`a-${a.id}`" class="quote-row">
            <div class="quote-row__name">
              <span class="quote-row__label">{{ a.name }}</span>
              <span class="quote-row__meta">
                <span v-if="a.from != null">{{ t('From') }} {{ formatMGA(a.from) }}</span>
              </span>
            </div>
            <InputNumber
              v-model="a.price"
              :min="0"
              mode="decimal"
              :maxFractionDigits="2"
              :useGrouping="true"
              suffix=" MGA"
              class="quote-row__price"
            />
            <div class="quote-row__total">{{ formatMGA(num(a.price)) }}</div>
          </div>
        </div>
      </template>

      <!-- Fallback: a request with no service/artist lines still needs a total. -->
      <div v-else class="quote-group">
        <div class="quote-row">
          <div class="quote-row__name"><span class="quote-row__label">{{ t('Quote amount') }}</span></div>
          <InputNumber
            v-model="lumpTotal"
            :min="0"
            mode="decimal"
            :maxFractionDigits="2"
            :useGrouping="true"
            suffix=" MGA"
            class="quote-row__price"
          />
          <div class="quote-row__total" />
        </div>
      </div>

      <div class="quote-total">
        <span>{{ t('Quoted total') }}</span>
        <strong>{{ formatMGA(grandTotal) }}</strong>
      </div>

      <label class="quote-note">
        <span>{{ t('Internal note') }}</span>
        <Textarea v-model="adminNote" rows="2" autoResize />
      </label>
    </div>

    <template #footer>
      <Button type="button" :label="t('Cancel')" icon="pi pi-times" severity="secondary" outlined @click="isOpen = false" />
      <Button type="button" :label="t('Save quote')" icon="pi pi-check" :loading="loading" :disabled="loading" @click="submit" />
    </template>
  </Dialog>
</template>

<style scoped>
.quote-dialog { display: grid; gap: 16px; }
.quote-hint { margin: 0; color: var(--tm-muted); font-size: .86rem; }
.quote-group { display: grid; gap: 8px; }
.quote-group__title { font-size: .72rem; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; color: var(--tm-muted); }
.quote-row { display: grid; grid-template-columns: minmax(0, 1fr) 190px 120px; gap: 12px; align-items: center; }
.quote-row__name { display: grid; gap: 2px; min-width: 0; }
.quote-row__label { font-weight: 700; }
.quote-row__meta { display: flex; flex-wrap: wrap; gap: 10px; color: var(--tm-muted); font-size: .76rem; }
.quote-row__price { width: 100%; }
.quote-row__total { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.quote-total { display: flex; align-items: center; justify-content: space-between; padding-top: 12px; border-top: 1px solid var(--tm-border); font-size: 1.05rem; }
.quote-total strong { font-size: 1.2rem; font-variant-numeric: tabular-nums; }
.quote-note { display: grid; gap: 6px; font-size: .82rem; font-weight: 700; color: var(--tm-muted); }
@media (max-width: 560px) {
  .quote-row { grid-template-columns: 1fr; }
  .quote-row__total { text-align: left; }
}
</style>
