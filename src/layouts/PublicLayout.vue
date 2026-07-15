<script setup>
import AppHeader from '@/components/AppHeader.vue';
import BrandMark from '@/components/BrandMark.vue';
import { usePublicI18n } from '@/i18n/public';

const { t } = usePublicI18n();
const year = new Date().getFullYear();
</script>

<template>
  <div class="app-shell public-ui">
    <AppHeader />
    <main>
      <RouterView />
    </main>
    <footer class="public-footer">
      <div class="app-container public-footer__main">
        <div class="public-footer__brand">
          <BrandMark />
          <p>{{ t('Shop, move, celebrate, and care — across Madagascar.') }}</p>
          <div class="public-footer__payments">
            <span><i class="pi pi-money-bill" /> {{ t('Cash') }}</span>
            <span><i class="pi pi-building-columns" /> {{ t('Bank transfer') }}</span>
            <span><i class="pi pi-mobile" /> {{ t('Mobile money') }}</span>
          </div>
        </div>

        <nav class="public-footer__links" :aria-label="t('Shop')">
          <strong>{{ t('Shop') }}</strong>
          <RouterLink to="/shop">{{ t('All products') }}</RouterLink>
          <RouterLink to="/tech">{{ t('Tech') }}</RouterLink>
          <RouterLink to="/fashion">{{ t('Fashion') }}</RouterLink>
          <RouterLink to="/coffee">{{ t('Coffee') }}</RouterLink>
        </nav>

        <nav class="public-footer__links" :aria-label="t('The services')">
          <strong>{{ t('The services') }}</strong>
          <RouterLink to="/cars">{{ t('Cars with driver') }}</RouterLink>
          <RouterLink to="/events">{{ t('Event planning') }}</RouterLink>
          <RouterLink to="/healthcare">{{ t('Healthcare') }}</RouterLink>
        </nav>

        <nav class="public-footer__links" :aria-label="t('Account')">
          <strong>{{ t('Account') }}</strong>
          <RouterLink to="/orders">{{ t('Orders') }}</RouterLink>
          <RouterLink to="/cart">{{ t('Cart') }}</RouterLink>
          <RouterLink to="/account">{{ t('Sign in') }}</RouterLink>
        </nav>
      </div>

      <div class="app-container public-footer__bottom">
        <span>© {{ year }} Trimobe Madagascar.</span>
        <span>{{ t('Prices in Ariary') }}</span>
      </div>
    </footer>
    <Toast position="bottom-right" />
    <ConfirmDialog />
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
  flex-direction: column;
}

.app-shell main {
  flex: 1 0 auto;
}

.public-footer {
  margin-top: auto;
  border-top: 1px solid rgba(201, 146, 44, 0.2);
  background: var(--tm-footer-bg, #101416);
  color: rgba(255, 255, 255, 0.72);
}

.public-footer__main {
  display: grid;
  gap: clamp(32px, 6vw, 80px);
  grid-template-columns: minmax(260px, 1.5fr) repeat(3, minmax(120px, 0.6fr));
  padding-block: clamp(48px, 7vw, 78px);
}

.public-footer__brand :deep(.brand-mark__text strong) {
  color: #fff8ed;
}

.public-footer__brand :deep(.brand-mark__text small) {
  color: rgba(255, 255, 255, 0.55);
}

.public-footer__brand p {
  max-width: 370px;
  margin: 22px 0 0;
  line-height: 1.65;
}

.public-footer__payments {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 22px;
}

.public-footer__payments span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 8px 11px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.78rem;
}

.public-footer__payments i {
  color: #e0ad4c;
}

.public-footer__links {
  display: grid;
  align-content: start;
  gap: 13px;
}

.public-footer__links strong {
  margin-bottom: 5px;
  color: #fff8ed;
  font-size: 0.82rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.public-footer__links a {
  font-size: 0.92rem;
  transition: color 160ms ease;
}

.public-footer__links a:hover {
  color: #e0ad4c;
}

.public-footer__bottom {
  display: flex;
  min-height: 68px;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.09);
  color: rgba(255, 255, 255, 0.48);
  font-size: 0.82rem;
}

@media (max-width: 820px) {
  .public-footer__main {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .public-footer__brand {
    grid-column: 1 / -1;
  }
}

@media (max-width: 520px) {
  .public-footer__main {
    grid-template-columns: 1fr;
  }

  .public-footer__brand {
    grid-column: auto;
  }

  .public-footer__bottom {
    align-items: flex-start;
    flex-direction: column;
    justify-content: center;
    padding-block: 18px;
  }
}
</style>
