<template>
  <RouterLink class="brand-mark" to="/" aria-label="Trimobe home">
    <span class="brand-mark__symbol" aria-hidden="true">
      <span />
    </span>
    <span class="brand-mark__text">
      <strong>Trimobe</strong>
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
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(185, 138, 46, 0.42);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(185, 138, 46, 0.2), transparent 48%),
    var(--tm-charcoal);
  box-shadow: 0 12px 28px rgba(17, 19, 21, 0.16);
}

.brand-mark__symbol span {
  width: 20px;
  height: 20px;
  border: 2px solid var(--tm-gold);
  border-left-color: var(--tm-emerald);
  border-radius: 6px;
  transform: rotate(45deg);
}

.brand-mark__text {
  display: grid;
  gap: 1px;
}

.brand-mark__text strong {
  color: var(--tm-heading);
  font-size: 1.05rem;
  letter-spacing: 0;
  line-height: 1;
}

.brand-mark__text small {
  color: var(--tm-muted);
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.brand-mark--light .brand-mark__text strong,
:deep(.brand-mark--light) .brand-mark__text strong {
  color: #fff;
}
</style>
