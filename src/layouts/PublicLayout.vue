<template>
  <div class="app-shell">
    <AppHeader />
    <main>
      <RouterView />
    </main>
    <footer class="public-footer">
      <div class="app-container public-footer__inner">
        <span>Trimobe</span>
        <span>Phones, accessories, and cars with driver in Madagascar</span>
      </div>
    </footer>
  </div>
</template>

<script setup>
import AppHeader from '@/components/AppHeader.vue';
</script>

<style scoped>
.public-footer {
  border-top: 1px solid var(--tm-border);
  background: var(--tm-surface-muted);
}

.public-footer__inner {
  display: flex;
  min-height: 82px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  color: var(--tm-muted);
  font-size: 0.92rem;
}

.public-footer__inner span:first-child {
  color: var(--tm-heading);
  font-weight: 900;
}

@media (max-width: 640px) {
  .public-footer__inner {
    align-items: start;
    flex-direction: column;
    justify-content: center;
  }
}
</style>
