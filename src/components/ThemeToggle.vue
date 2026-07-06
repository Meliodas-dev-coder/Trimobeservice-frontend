<script setup>
import { computed } from 'vue';

import { useTheme } from '@/composables/useTheme';

const props = defineProps({
  lightLabel: {
    type: String,
    default: 'Switch to light mode',
  },
  darkLabel: {
    type: String,
    default: 'Switch to dark mode',
  },
});

const { isDark, toggleTheme } = useTheme();

const label = computed(() => (isDark.value ? props.lightLabel : props.darkLabel));
const icon = computed(() => (isDark.value ? 'pi pi-sun' : 'pi pi-moon'));
</script>

<template>
  <Button
    class="theme-toggle"
    :aria-label="label"
    :icon="icon"
    :title="label"
    outlined
    severity="secondary"
    @click="toggleTheme"
  />
</template>

<style scoped>
.theme-toggle {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
}
</style>
