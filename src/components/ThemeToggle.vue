<script setup>
import { computed } from 'vue';

import { useTheme } from '@/composables/useTheme';

const { isDark, toggleTheme } = useTheme();

const label = computed(() => (isDark.value ? 'Switch to light mode' : 'Switch to dark mode'));
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
