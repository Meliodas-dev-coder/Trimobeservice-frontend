<script setup>
import { computed, onMounted, ref } from 'vue';

import CardSkeleton from '@/components/CardSkeleton.vue';
import { listEventServiceCategories, listEventServices } from '@/api/public';
import eventPlanningShowcase from '@/assets/events/event-planning-showcase.png';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';

const { content, t } = usePublicI18n();
const categories = ref([]);
const services = ref([]);
const loading = ref(false);
const error = ref('');

const serviceCount = computed(() => services.value.length);
const sections = computed(() => {
  const grouped = new Map();
  for (const service of services.value) {
    const key = Number(service.category_id || 0);
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(service);
  }

  const known = categories.value.map((category) => ({
    category,
    services: grouped.get(Number(category.id)) || [],
  }));

  const knownIds = new Set(categories.value.map((category) => Number(category.id)));
  const uncategorized = services.value.filter((service) => !knownIds.has(Number(service.category_id || 0)));
  if (uncategorized.length) {
    known.push({
      category: {
        id: 'more',
        name: 'More services',
        icon: 'pi pi-sparkles',
        description: 'Additional services available for custom events.',
      },
      services: uncategorized,
    });
  }

  return known.filter((section) => section.services.length);
});

function priceLabel(service) {
  if (service.from_price === null || service.from_price === undefined || service.from_price === '') {
    return t('Quote by request');
  }
  const unit = content(service, 'price_unit') || service.price_unit || '';
  return `${t('From')} ${formatMGA(Number(service.from_price || 0))}${unit ? ` ${unit}` : ''}`;
}

function serviceImage(service) {
  return service.image_url || eventPlanningShowcase;
}

function serviceImageAlt(service, category) {
  const serviceName = content(service, 'name') || service.name;
  const categoryName = content(category, 'name') || category.name;
  return service.image_url
    ? serviceName
    : `${categoryName} event service setup with stage, lighting, catering, and decor`;
}

function categoryName(category) {
  return t(content(category, 'name') || category.name);
}

function categoryDescription(category) {
  return t(content(category, 'description') || category.description || '');
}

function serviceName(service) {
  return t(content(service, 'name') || service.name);
}

function serviceDescription(service) {
  return content(service, 'description') || service.description || t('Custom event support from the Trimobe planning team.');
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [categoryList, serviceList] = await Promise.all([
      listEventServiceCategories(),
      listEventServices(),
    ]);
    categories.value = categoryList;
    services.value = serviceList;
  } catch (err) {
    categories.value = [];
    services.value = [];
    error.value = err?.message || t('Could not load event services');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="events-page">
    <div class="app-container">
      <header class="events-hero">
        <div>
          <p class="eyebrow">{{ t('Plan') }}</p>
          <h1>{{ t('Events planned with one coordinated team.') }}</h1>
          <p>
            {{ t('Sound, lighting, catering, artists, decor, staging, and structure brought together for weddings, business events, birthdays, concerts, and conferences.') }}
          </p>
          <div class="events-hero__actions">
            <Button as="router-link" to="/events/plan" :label="t('Plan your event')" icon="pi pi-calendar-plus" />
            <Button as="router-link" to="/events/artists" :label="t('Meet the artists')" icon="pi pi-microphone" severity="secondary" outlined />
            <Button as="router-link" to="/orders?tab=events" :label="t('My requests')" icon="pi pi-list" outlined />
          </div>
        </div>
        <figure class="events-hero__media">
          <img :src="eventPlanningShowcase" alt="Event setup with stage, lighting, speakers, catering, and decor" />
          <figcaption class="events-hero__stat soft-panel">
            <span>{{ serviceCount }}</span>
            <strong>{{ t('event services') }}</strong>
          </figcaption>
        </figure>
      </header>

      <div v-if="error" class="events-state events-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
      </div>

      <div v-else-if="loading" class="events-grid" aria-hidden="true">
        <CardSkeleton v-for="n in 6" :key="n" />
      </div>

      <template v-else-if="sections.length">
        <section v-for="section in sections" :key="section.category.id" class="event-category">
          <div class="section-header">
            <div>
              <p class="eyebrow">{{ categoryName(section.category) }}</p>
              <h2 class="section-title">
                <i :class="section.category.icon || 'pi pi-calendar'" />
                {{ categoryName(section.category) }}
              </h2>
              <p v-if="categoryDescription(section.category)" class="section-copy">{{ categoryDescription(section.category) }}</p>
            </div>
          </div>

          <div class="events-grid">
            <article v-for="service in section.services" :key="service.id" class="event-card">
              <figure class="event-card__image">
                <img :src="serviceImage(service)" :alt="serviceImageAlt(service, section.category)" loading="lazy" />
              </figure>

              <div class="event-card__body">
                <div>
                  <p>{{ categoryName(section.category) }}</p>
                  <h3>{{ serviceName(service) }}</h3>
                  <span>{{ serviceDescription(service) }}</span>
                </div>
                <div class="event-card__footer">
                  <strong>{{ priceLabel(service) }}</strong>
                  <Button as="router-link" to="/events/plan" :label="t('Request')" icon="pi pi-arrow-right" size="small" outlined />
                </div>
              </div>
            </article>
          </div>
        </section>
      </template>

      <div v-else class="events-state">
        <i class="pi pi-calendar" />
        <span>{{ t('Event services are being prepared for publication.') }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.events-page {
  padding: 48px 0 72px;
}

.events-hero {
  display: grid;
  align-items: center;
  gap: 30px;
  grid-template-columns: minmax(0, 0.86fr) minmax(360px, 1fr);
  margin-bottom: 26px;
}

.events-hero h1 {
  max-width: 820px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.5rem, 7vw, 5.6rem);
  line-height: 0.92;
}

.events-hero p:not(.eyebrow) {
  max-width: 720px;
  color: var(--tm-muted);
  line-height: 1.65;
}

.events-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 22px;
}

.events-hero__media {
  position: relative;
  min-height: 390px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-charcoal);
  box-shadow: var(--tm-shadow);
}

.events-hero__media::after {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, transparent 50%, rgba(17, 19, 21, 0.35)),
    linear-gradient(90deg, rgba(17, 19, 21, 0.12), transparent 42%);
  content: "";
  pointer-events: none;
}

.events-hero__media img {
  width: 100%;
  height: 100%;
  min-height: 390px;
  object-fit: cover;
}

.events-hero__stat {
  display: grid;
  position: absolute;
  right: 16px;
  bottom: 16px;
  z-index: 1;
  min-width: 172px;
  gap: 4px;
  padding: 16px;
}

.events-hero__stat span {
  color: var(--tm-heading);
  font-size: 2rem;
  font-weight: 950;
}

.events-hero__stat strong {
  color: var(--tm-muted);
  text-transform: uppercase;
}

.event-category {
  padding: 28px 0;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.section-title i {
  color: var(--tm-gold);
  font-size: 0.82em;
}

.events-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.event-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.event-card__image {
  margin: 0;
  min-height: 196px;
  overflow: hidden;
  background: var(--tm-stone);
}

.event-card__image img {
  width: 100%;
  height: 100%;
  min-height: 196px;
  object-fit: cover;
}

.event-card__body {
  display: grid;
  gap: 18px;
  padding: 18px;
}

.event-card p {
  margin: 0 0 6px;
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 850;
  text-transform: uppercase;
}

.event-card h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.15rem;
  line-height: 1.2;
}

.event-card span {
  display: block;
  margin-top: 8px;
  color: var(--tm-muted);
  line-height: 1.6;
}

.event-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.event-card__footer strong {
  color: var(--tm-heading);
  font-size: 0.94rem;
}

.events-state {
  display: grid;
  min-height: 300px;
  place-items: center;
  gap: 10px;
  padding: 34px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  color: var(--tm-muted);
  font-weight: 850;
  text-align: center;
}

.events-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.events-state--error i {
  color: var(--tm-coral);
}

@media (max-width: 980px) {
  .events-hero {
    grid-template-columns: 1fr;
  }

  .events-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .events-hero__media,
  .events-hero__media img {
    min-height: 280px;
  }

  .events-grid {
    grid-template-columns: 1fr;
  }

  .events-hero__actions .p-button,
  .event-card__footer .p-button {
    width: 100%;
  }

  .event-card__footer {
    align-items: start;
    flex-direction: column;
  }
}
</style>
