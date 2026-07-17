<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import GooglePlaceInput from '@/components/GooglePlaceInput.vue';
import { geocodeAddress, hasGoogleMapsKey, loadGoogleMaps, reverseGeocodePosition } from '@/utils/googleMaps';
import { usePublicI18n } from '@/i18n/public';

const props = defineProps({
  modelValue: { type: String, default: '' },
  latitude: { type: Number, default: null },
  longitude: { type: Number, default: null },
  locationReference: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits([
  'update:modelValue',
  'update:latitude',
  'update:longitude',
  'update:locationReference',
  'place-select',
  'place-clear',
  'pin-change',
]);

const { t } = usePublicI18n();
const mapElement = ref(null);
const locating = ref(false);
const mapError = ref('');
const pinAddress = ref('');

const MADAGASCAR_CENTER = { lat: -18.8792, lng: 47.5079 };
let map = null;
let marker = null;
let mapsApi = null;
let reverseSequence = 0;

const hasPin = computed(() => Number.isFinite(Number(props.latitude)) && Number.isFinite(Number(props.longitude)));
const mapsLink = computed(() => {
  const query = hasPin.value ? `${props.latitude},${props.longitude}` : props.modelValue;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'Madagascar')}`;
});

function pinPosition() {
  return hasPin.value
    ? { lat: Number(props.latitude), lng: Number(props.longitude) }
    : null;
}

function emitPin(position) {
  const pin = {
    lat: Number(position.lat.toFixed(7)),
    lng: Number(position.lng.toFixed(7)),
  };
  emit('update:latitude', pin.lat);
  emit('update:longitude', pin.lng);
  emit('pin-change', pin);
}

function showPin(position, zoom = 16) {
  if (!map || !mapsApi) {
    return;
  }
  if (!marker) {
    marker = new mapsApi.Marker({ map, draggable: true, title: t('Exact meeting point') });
    marker.addListener('dragend', () => selectPosition(marker.getPosition()));
  }
  marker.setPosition(position);
  marker.setMap(map);
  map.panTo(position);
  map.setZoom(zoom);
}

async function identifyPosition(position) {
  const sequence = ++reverseSequence;
  try {
    const result = await reverseGeocodePosition(position);
    if (sequence === reverseSequence) {
      pinAddress.value = result.formattedAddress || '';
    }
  } catch {
    if (sequence === reverseSequence) {
      pinAddress.value = '';
    }
  }
}

function selectPosition(rawPosition) {
  const position = {
    lat: typeof rawPosition.lat === 'function' ? rawPosition.lat() : Number(rawPosition.lat),
    lng: typeof rawPosition.lng === 'function' ? rawPosition.lng() : Number(rawPosition.lng),
  };
  emitPin(position);
  showPin(position);
  identifyPosition(position);
}

async function initializeMap() {
  if (!hasGoogleMapsKey()) {
    mapError.value = t('The interactive map is temporarily unavailable. Keep the address and reference for our team.');
    return;
  }
  try {
    mapsApi = await loadGoogleMaps();
    await nextTick();
    if (!mapElement.value) {
      return;
    }
    const initialPin = pinPosition();
    map = new mapsApi.Map(mapElement.value, {
      center: initialPin || MADAGASCAR_CENTER,
      zoom: initialPin ? 16 : 6,
      clickableIcons: false,
      streetViewControl: false,
      mapTypeControl: false,
      fullscreenControl: false,
      gestureHandling: 'cooperative',
    });
    map.addListener('click', (event) => selectPosition(event.latLng));
    if (initialPin) {
      showPin(initialPin);
      identifyPosition(initialPin);
    }
  } catch {
    mapError.value = t('The interactive map is temporarily unavailable. Keep the address and reference for our team.');
  }
}

async function locateTypedAddress() {
  const query = String(props.modelValue || '').trim();
  if (!query) {
    mapError.value = t('Type a city or address first.');
    return;
  }
  locating.value = true;
  mapError.value = '';
  try {
    const result = await geocodeAddress(query);
    emitPin(result.position);
    pinAddress.value = result.formattedAddress || query;
    showPin(result.position, 14);
  } catch {
    mapError.value = t('We could not locate that city. Try a nearby town or pin the map manually.');
  } finally {
    locating.value = false;
  }
}

function handlePlaceSelect(selection) {
  emit('place-select', selection);
  const location = selection?.details?.geometry?.location;
  if (!location) {
    locateTypedAddress();
    return;
  }
  const position = { lat: location.lat(), lng: location.lng() };
  emitPin(position);
  pinAddress.value = selection.value || '';
  showPin(position, 16);
}

function updateAddress(value) {
  emit('update:modelValue', value || '');
  emit('update:latitude', null);
  emit('update:longitude', null);
  emit('place-clear');
  pinAddress.value = '';
  if (marker) {
    marker.setMap(null);
  }
}

function updateReference(value) {
  emit('update:locationReference', value || '');
}

watch(
  () => [props.latitude, props.longitude],
  () => {
    const position = pinPosition();
    if (position && map) {
      showPin(position);
    } else if (!position && marker) {
      marker.setMap(null);
    }
  },
);

onMounted(initializeMap);
onBeforeUnmount(() => {
  reverseSequence += 1;
  if (marker) {
    marker.setMap(null);
  }
  marker = null;
  map = null;
});
</script>

<template>
  <section class="client-location-picker" :aria-label="label || t('Location')">
    <span v-if="label" class="client-location-picker__label">{{ label }}</span>
    <div class="client-location-picker__search">
      <GooglePlaceInput
        :modelValue="modelValue"
        :placeholder="placeholder || t('Type a city, neighbourhood, or address')"
        :disabled="disabled"
        allowFreeText
        @update:modelValue="updateAddress"
        @place-select="handlePlaceSelect"
      />
      <Button
        type="button"
        icon="pi pi-search"
        :label="t('Show on map')"
        :loading="locating"
        :disabled="disabled"
        outlined
        @click="locateTypedAddress"
      />
    </div>

    <p class="client-location-picker__instruction">
      <i class="pi pi-map-marker" />
      {{ t('Click the map to place the exact pin. You can drag it to adjust the meeting point.') }}
    </p>

    <div v-if="hasGoogleMapsKey()" ref="mapElement" class="client-location-picker__map" />
    <div v-else class="client-location-picker__fallback">
      <i class="pi pi-map" />
      <span>{{ mapError }}</span>
      <a :href="mapsLink" target="_blank" rel="noopener noreferrer">{{ t('Open map') }}</a>
    </div>

    <div v-if="hasPin" class="client-location-picker__pin-status">
      <i class="pi pi-check-circle" />
      <span>
        <strong>{{ t('Exact location pinned') }}</strong>
        {{ pinAddress || `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}` }}
      </span>
      <a :href="mapsLink" target="_blank" rel="noopener noreferrer" :aria-label="t('Open map')">
        <i class="pi pi-external-link" />
      </a>
    </div>
    <small v-if="mapError && hasGoogleMapsKey()" class="client-location-picker__error">{{ mapError }}</small>

    <label class="client-location-picker__reference">
      <span>
        {{ t('Nearby landmark or meeting reference') }}
        <span class="client-location-picker__tooltip" tabindex="0" :aria-label="t('Location reference help')">
          <i class="pi pi-info-circle" />
          <span role="tooltip">{{ t('If your house is hard to find, enter a nearby landmark or easy meeting point and meet our team there.') }}</span>
        </span>
      </span>
      <InputText
        :modelValue="locationReference"
        :disabled="disabled"
        :placeholder="t('Example: church, school, market, or known junction')"
        @update:modelValue="updateReference"
      />
    </label>
  </section>
</template>

<style scoped>
.client-location-picker {
  display: grid;
  gap: 10px;
  width: 100%;
}

.client-location-picker__label {
  color: var(--tm-heading);
  font-size: 0.78rem;
  font-weight: 800;
}

.client-location-picker__search {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 9px;
}

.client-location-picker__instruction {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--tm-muted);
  font-size: 0.77rem;
  line-height: 1.45;
}

.client-location-picker__instruction i {
  color: var(--tm-gold);
}

.client-location-picker__map {
  width: 100%;
  min-height: 280px;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 15px;
  background: var(--tm-surface-soft);
}

.client-location-picker__fallback {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 92px;
  padding: 15px;
  border: 1px dashed var(--tm-border);
  border-radius: 15px;
  color: var(--tm-muted);
  background: var(--tm-surface-soft);
  font-size: 0.8rem;
}

.client-location-picker__fallback span {
  flex: 1;
}

.client-location-picker__fallback a,
.client-location-picker__pin-status a {
  color: var(--tm-accent);
  font-weight: 800;
  text-decoration: none;
}

.client-location-picker__pin-status {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 10px 12px;
  border-radius: 12px;
  color: #166534;
  background: #dcfce7;
  font-size: 0.75rem;
}

.client-location-picker__pin-status > i {
  font-size: 1rem;
}

.client-location-picker__pin-status > span {
  display: grid;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.client-location-picker__pin-status strong {
  font-size: 0.78rem;
}

.client-location-picker__pin-status span:not(strong) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.client-location-picker__error {
  color: var(--tm-danger, #b42318);
}

.client-location-picker__reference {
  display: grid;
  gap: 6px;
}

.client-location-picker__reference > span {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tm-heading);
  font-size: 0.78rem;
  font-weight: 800;
}

.client-location-picker__tooltip {
  position: relative;
  display: inline-flex;
  color: var(--tm-muted);
  cursor: help;
}

.client-location-picker__tooltip [role='tooltip'] {
  position: absolute;
  z-index: 5;
  bottom: calc(100% + 8px);
  left: 50%;
  width: min(290px, 76vw);
  padding: 9px 11px;
  border-radius: 9px;
  color: #fff;
  background: var(--tm-charcoal);
  box-shadow: 0 8px 24px rgba(20, 29, 31, 0.2);
  font-size: 0.72rem;
  font-weight: 650;
  line-height: 1.45;
  opacity: 0;
  pointer-events: none;
  transform: translate(-50%, 4px);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.client-location-picker__tooltip:hover [role='tooltip'],
.client-location-picker__tooltip:focus [role='tooltip'] {
  opacity: 1;
  transform: translate(-50%, 0);
}

@media (max-width: 620px) {
  .client-location-picker__search {
    grid-template-columns: 1fr;
  }

  .client-location-picker__search :deep(.p-button) {
    justify-content: center;
  }

  .client-location-picker__map {
    min-height: 240px;
  }
}
</style>
