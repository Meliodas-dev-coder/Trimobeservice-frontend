<template>
  <article class="card-skeleton" aria-hidden="true">
    <Skeleton height="210px" borderRadius="8px" />
    <div class="card-skeleton__body">
      <Skeleton width="38%" height="0.8rem" />
      <Skeleton width="85%" height="1.25rem" />
      <div class="card-skeleton__footer">
        <Skeleton width="34%" height="1rem" />
        <Skeleton width="24%" height="1rem" />
      </div>
    </div>
  </article>
</template>

<style scoped>
.card-skeleton {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
}

.card-skeleton__body {
  display: grid;
  gap: 10px;
}

.card-skeleton__footer {
  display: flex;
  justify-content: space-between;
  margin-top: 4px;
}
</style>
