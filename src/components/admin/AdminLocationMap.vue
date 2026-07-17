<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { geocodeAddress, hasGoogleMapsKey, loadGoogleMaps } from '@/utils/googleMaps';
import { useAdminI18n } from '@/i18n/admin';

const props = defineProps({
  address: { type: String, default: '' },
  label: { type: String, default: 'Location' },
  latitude: { type: [Number, String], default: null },
  longitude: { type: [Number, String], default: null },
  reference: { type: String, default: '' },
});

const { t } = useAdminI18n();

const mapElement = ref(null);
const loading = ref(false);
const useEmbedFallback = ref(!hasGoogleMapsKey());
const locatedAddress = ref('');

let map = null;
let marker = null;
let loadSequence = 0;

const cleanAddress = computed(() => String(props.address || '').trim());
const exactPosition = computed(() => {
  if (props.latitude === null || props.latitude === undefined || props.latitude === ''
    || props.longitude === null || props.longitude === undefined || props.longitude === '') {
    return null;
  }
  const lat = Number(props.latitude);
  const lng = Number(props.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
});
const mapQuery = computed(() => (
  exactPosition.value ? `${exactPosition.value.lat},${exactPosition.value.lng}` : cleanAddress.value
));
const mapsLink = computed(() => (
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery.value)}`
));
const embedLink = computed(() => (
  `https://www.google.com/maps?q=${encodeURIComponent(mapQuery.value)}&output=embed`
));

function clearMap() {
  if (marker) {
    marker.setMap(null);
  }
  marker = null;
  map = null;
}

async function renderMap() {
  const sequence = ++loadSequence;
  clearMap();
  locatedAddress.value = '';
  if (!cleanAddress.value && !exactPosition.value) {
    return;
  }
  if (!hasGoogleMapsKey()) {
    useEmbedFallback.value = true;
    return;
  }

  useEmbedFallback.value = false;
  loading.value = true;
  try {
    const maps = await loadGoogleMaps();
    const result = exactPosition.value
      ? { position: exactPosition.value, formattedAddress: cleanAddress.value }
      : await geocodeAddress(cleanAddress.value);
    if (sequence !== loadSequence) {
      return;
    }
    locatedAddress.value = result.formattedAddress;
    await nextTick();
    if (!mapElement.value || sequence !== loadSequence) {
      return;
    }
    map = new maps.Map(mapElement.value, {
      center: result.position,
      zoom: 15,
      clickableIcons: false,
      disableDefaultUI: true,
      gestureHandling: 'cooperative',
      zoomControl: true,
    });
    marker = new maps.Marker({
      map,
      position: result.position,
      title: props.label,
    });
  } catch {
    if (sequence === loadSequence) {
      useEmbedFallback.value = true;
    }
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
    }
  }
}

watch(() => [cleanAddress.value, props.latitude, props.longitude], renderMap, { immediate: true });

onBeforeUnmount(() => {
  loadSequence += 1;
  clearMap();
});
</script>

<template>
  <article v-if="cleanAddress || exactPosition" class="location-map">
    <header class="location-map__header">
      <div>
        <span>{{ label }}</span>
        <strong>{{ locatedAddress || cleanAddress }}</strong>
        <small v-if="reference" class="location-map__reference">
          <i class="pi pi-info-circle" />
          {{ reference }}
        </small>
      </div>
      <a :href="mapsLink" target="_blank" rel="noopener noreferrer">
        <i class="pi pi-external-link" />
        {{ t('Open map') }}
      </a>
    </header>

    <div class="location-map__canvas">
      <iframe
        v-if="useEmbedFallback"
        :src="embedLink"
        :title="`${label}: ${cleanAddress || mapQuery}`"
        loading="lazy"
        referrerpolicy="no-referrer-when-downgrade"
      />
      <div v-else ref="mapElement" class="location-map__interactive" :aria-label="`${label}: ${cleanAddress || mapQuery}`" />
      <div v-if="loading" class="location-map__loading">
        <i class="pi pi-spin pi-spinner" />
        <span>{{ t('Locating address…') }}</span>
      </div>
    </div>
  </article>
</template>

<style scoped>
.location-map {
  display: grid;
  gap: 11px;
  overflow: hidden;
  padding: 13px;
  border: 1px solid var(--tm-border);
  border-radius: 16px;
  background: var(--tm-surface);
  box-shadow: 0 10px 28px rgba(20, 29, 31, 0.06);
}

.location-map__header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 14px;
}

.location-map__header > div {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.location-map__header span {
  color: var(--tm-muted);
  font-size: 0.68rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.location-map__header strong {
  overflow: hidden;
  color: var(--tm-heading);
  font-size: 0.84rem;
  line-height: 1.45;
  text-overflow: ellipsis;
}

.location-map__reference {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  color: var(--tm-muted);
  font-size: 0.74rem;
  line-height: 1.4;
}

.location-map__reference i {
  margin-top: 2px;
  color: var(--tm-gold);
}

.location-map__header a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
  padding: 7px 9px;
  border-radius: 9px;
  background: var(--tm-charcoal);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 850;
  text-decoration: none;
}

.location-map__canvas {
  position: relative;
  min-height: 210px;
  overflow: hidden;
  border-radius: 12px;
  background: var(--tm-surface-soft);
}

.location-map__interactive,
.location-map__canvas iframe {
  width: 100%;
  height: 210px;
  border: 0;
}

.location-map__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  background: color-mix(in srgb, var(--tm-surface) 88%, transparent);
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 800;
}

@media (max-width: 620px) {
  .location-map__header {
    align-items: stretch;
    flex-direction: column;
  }

  .location-map__header a {
    justify-content: center;
  }
}
</style>
