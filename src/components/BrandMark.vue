<script setup>
import baobabMark from '@/assets/brand/trimobe-baobab-mark.svg';

defineProps({
  to: { type: [String, Object], default: '/' },
  ariaLabel: { type: String, default: 'Trimobe home' },
});
</script>

<template>
  <RouterLink class="brand-mark" :to="to" :aria-label="ariaLabel">
    <span class="brand-mark__symbol" aria-hidden="true">
      <img :src="baobabMark" alt="" />
    </span>
    <span class="brand-mark__text">
      <strong>TRIMOBE</strong>
      <small>Madagascar</small>
    </span>
  </RouterLink>
</template>

<style scoped>
.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-mark__symbol {
  display: grid;
  width: 50px;
  height: 50px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(185, 138, 46, 0.42);
  border-radius: 15px;
  background:
    linear-gradient(135deg, rgba(185, 138, 46, 0.2), transparent 48%),
    var(--tm-charcoal);
  box-shadow: 0 12px 28px rgba(17, 19, 21, 0.16);
}

.brand-mark__symbol img {
  width: 37px;
  height: 37px;
  object-fit: contain;
}

.brand-mark__text {
  display: grid;
  gap: 1px;
}

.brand-mark__text strong {
  color: var(--tm-heading);
  font-size: 1.15rem;
  letter-spacing: -0.02em;
  line-height: 1;
}

.brand-mark__text small {
  color: var(--tm-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0;
}

.brand-mark--light .brand-mark__text strong,
:deep(.brand-mark--light) .brand-mark__text strong {
  color: #fff;
}
</style>
