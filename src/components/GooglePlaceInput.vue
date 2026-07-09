<script setup>
import { computed, ref, watch } from 'vue';

import { getPlaceDetails, getPlacePredictions, hasGoogleMapsKey, parseGoogleAddress } from '@/utils/googleMaps';

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  manualFallback: { type: Boolean, default: true },
  minLength: { type: Number, default: 3 },
  delay: { type: Number, default: 250 },
});

const emit = defineEmits(['update:modelValue', 'place-select', 'place-clear']);

const inputValue = ref(props.modelValue || '');
const suggestions = ref([]);
const loading = ref(false);
const selectedPlace = ref(null);
const mapsAvailable = computed(() => hasGoogleMapsKey());
const useManualInput = computed(() => !mapsAvailable.value && props.manualFallback);

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      selectedPlace.value = null;
      inputValue.value = '';
      return;
    }
    if (!selectedPlace.value) {
      inputValue.value = value;
    }
  },
);

function isPlacePrediction(value) {
  return Boolean(value && typeof value === 'object' && value.place_id);
}

async function searchPlaces(event) {
  if (!mapsAvailable.value) {
    suggestions.value = [];
    return;
  }
  loading.value = true;
  try {
    suggestions.value = await getPlacePredictions(event.query || '');
  } catch {
    suggestions.value = [];
  } finally {
    loading.value = false;
  }
}

function clearSelection(displayValue = '') {
  selectedPlace.value = null;
  inputValue.value = displayValue;
  emit('update:modelValue', '');
  emit('place-clear');
}

function updateValue(value) {
  if (isPlacePrediction(value)) {
    inputValue.value = value;
    return;
  }
  clearSelection(value || '');
}

async function selectPlace(place) {
  selectedPlace.value = place;
  inputValue.value = place;
  let details = null;
  let address = null;
  try {
    details = await getPlaceDetails(place.place_id);
    address = parseGoogleAddress(details);
  } catch {
    details = null;
    address = null;
  }
  const value = details?.formatted_address || place.description || '';
  emit('update:modelValue', value);
  emit('place-select', {
    value,
    prediction: place,
    details,
    address,
  });
}

function updateManualValue(value) {
  emit('update:modelValue', value || '');
  if (!value) {
    emit('place-clear');
  }
}
</script>

<template>
  <span class="google-place-input">
    <InputText
      v-if="useManualInput"
      :modelValue="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      @update:modelValue="updateManualValue"
    />
    <AutoComplete
      v-else
      :modelValue="inputValue"
      :suggestions="suggestions"
      optionLabel="description"
      dataKey="place_id"
      forceSelection
      :minLength="minLength"
      :delay="delay"
      :loading="loading"
      :placeholder="placeholder"
      :disabled="disabled"
      fluid
      @update:modelValue="updateValue"
      @option-select="selectPlace($event.value)"
      @complete="searchPlaces"
    />
  </span>
</template>

<style scoped>
.google-place-input {
  display: block;
  width: 100%;
}

.google-place-input :deep(.p-autocomplete),
.google-place-input :deep(.p-autocomplete-input),
.google-place-input :deep(.p-inputtext) {
  width: 100%;
}
</style>
