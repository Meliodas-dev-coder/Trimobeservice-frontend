import { ref, watch } from 'vue';

const STORAGE_KEY = 'trimobe-theme';
const isDark = ref(false);
let initialized = false;

function getInitialTheme() {
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark') {
    return true;
  }
  if (saved === 'light') {
    return false;
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

function applyTheme(value) {
  const root = document.documentElement;
  root.classList.toggle('trimobe-dark', value);
  root.dataset.theme = value ? 'dark' : 'light';
  root.style.colorScheme = value ? 'dark' : 'light';
}

function ensureTheme() {
  if (initialized) {
    return;
  }
  initialized = true;
  isDark.value = getInitialTheme();
  applyTheme(isDark.value);
  watch(isDark, (value) => {
    applyTheme(value);
    window.localStorage.setItem(STORAGE_KEY, value ? 'dark' : 'light');
  });
}

export function useTheme() {
  ensureTheme();

  function setTheme(value) {
    isDark.value = value;
  }

  function toggleTheme() {
    setTheme(!isDark.value);
  }

  return {
    isDark,
    setTheme,
    toggleTheme,
  };
}
