<script setup>
import { computed, onMounted, ref } from 'vue';

import CardSkeleton from '@/components/CardSkeleton.vue';
import { getHealthcareEmergency, listHealthcareCategories, listHealthcareServices } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';

const { t } = usePublicI18n();

const emergency = ref(null);
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
      category: { id: 'more', name: 'More services', icon: 'pi pi-plus-circle' },
      services: uncategorized,
    });
  }
  return known.filter((section) => section.services.length);
});

function isPackage(service) {
  return service.service_type === 'package';
}

function priceLabel(service) {
  if (isPackage(service)) {
    const unit = service.price_unit ? ` ${service.price_unit}` : '';
    return `${formatMGA(Number(service.price || 0))}${unit}`;
  }
  if (service.from_price === null || service.from_price === undefined || service.from_price === '') {
    return t('Quote after review');
  }
  const unit = service.price_unit ? ` ${service.price_unit}` : '';
  return `${t('From')} ${formatMGA(Number(service.from_price || 0))}${unit}`;
}

function staffLabel(service) {
  const parts = [];
  if (service.staff_doctors > 0) {
    parts.push(`${service.staff_doctors} ${service.staff_doctors > 1 ? t('doctors') : t('doctor')}`);
  }
  if (service.staff_nurses > 0) {
    parts.push(`${service.staff_nurses} ${service.staff_nurses > 1 ? t('nurses') : t('nurse')}`);
  }
  return parts.join(' · ');
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [emergencyInfo, categoryList, serviceList] = await Promise.all([
      getHealthcareEmergency(),
      listHealthcareCategories(),
      listHealthcareServices(),
    ]);
    emergency.value = emergencyInfo;
    categories.value = categoryList;
    services.value = serviceList;
  } catch (err) {
    emergency.value = null;
    categories.value = [];
    services.value = [];
    error.value = err?.message || t('Could not load healthcare services');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="care-page">
    <div class="app-container">
      <header class="care-hero">
        <div>
          <p class="eyebrow">{{ t('Healthcare') }}</p>
          <h1>{{ t('Doctors and nurses, at home.') }}</h1>
          <p>
            {{ t('Request a home consultation with a doctor or nurse, or subscribe to an ongoing care package. We work with a trusted network of practitioners.') }}
          </p>
          <div class="care-hero__actions">
            <Button as="router-link" to="/healthcare/request" :label="t('Request a home consultation')" icon="pi pi-calendar-plus" />
            <Button as="router-link" to="/orders?tab=healthcare" :label="t('My requests')" icon="pi pi-list" severity="secondary" outlined />
          </div>
        </div>

        <aside v-if="emergency && emergency.emergency_phone" class="care-emergency">
          <p class="care-emergency__label"><i class="pi pi-phone" /> {{ t('Emergency') }}</p>
          <a class="care-emergency__phone" :href="`tel:${emergency.emergency_phone.replace(/\s+/g, '')}`">
            {{ emergency.emergency_phone }}
          </a>
          <span v-if="emergency.emergency_hours" class="care-emergency__hours">{{ emergency.emergency_hours }}</span>
          <p v-if="emergency.emergency_note" class="care-emergency__note">{{ emergency.emergency_note }}</p>
        </aside>
      </header>

      <div v-if="error" class="care-state care-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
      </div>

      <div v-else-if="loading" class="care-grid" aria-hidden="true">
        <CardSkeleton v-for="n in 6" :key="n" />
      </div>

      <template v-else-if="sections.length">
        <p class="care-count">{{ serviceCount }} {{ t('services and packages available') }}</p>
        <section v-for="section in sections" :key="section.category.id" class="care-category">
          <div class="section-header">
            <p class="eyebrow">{{ t(section.category.name) }}</p>
            <h2 class="section-title">
              <i :class="section.category.icon || 'pi pi-heart'" />
              {{ t(section.category.name) }}
            </h2>
            <p v-if="section.category.description" class="section-copy">{{ t(section.category.description) }}</p>
          </div>

          <div class="care-grid">
            <article v-for="service in section.services" :key="service.id" class="care-card">
              <div class="care-card__body">
                <div>
                  <p class="care-card__kind">
                    <Tag
                      :value="isPackage(service) ? t('Package') : t('Consultation')"
                      :severity="isPackage(service) ? 'success' : 'info'"
                    />
                  </p>
                  <h3>{{ service.name }}</h3>
                  <span>{{ service.description || t('Home healthcare from the Trimobe network.') }}</span>
                  <ul v-if="isPackage(service)" class="care-card__meta">
                    <li v-if="staffLabel(service)"><i class="pi pi-users" /> {{ staffLabel(service) }}</li>
                    <li v-if="service.duration_days"><i class="pi pi-calendar" /> {{ service.duration_days }} {{ t('days') }}</li>
                  </ul>
                </div>
                <div class="care-card__footer">
                  <strong>{{ priceLabel(service) }}</strong>
                  <Button
                    as="router-link"
                    :to="{ name: 'healthcare-request', query: { service: service.slug } }"
                    :label="t('Request')"
                    icon="pi pi-arrow-right"
                    size="small"
                    outlined
                  />
                </div>
              </div>
            </article>
          </div>
        </section>
      </template>

      <div v-else class="care-state">
        <i class="pi pi-heart" />
        <span>{{ t('Healthcare services are being prepared for publication.') }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.care-page {
  padding: 48px 0 72px;
}

.care-hero {
  display: grid;
  align-items: stretch;
  gap: 30px;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 0.55fr);
  margin-bottom: 26px;
}

.care-hero h1 {
  max-width: 700px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.4rem, 6vw, 4.6rem);
  line-height: 0.96;
}

.care-hero p:not(.eyebrow) {
  max-width: 640px;
  color: var(--tm-muted);
  line-height: 1.65;
}

.care-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 22px;
}

/* Emergency call-out — deliberately loud (coral) and always above the fold. */
.care-emergency {
  display: grid;
  align-content: center;
  gap: 6px;
  padding: 22px;
  border: 1px solid var(--tm-coral, #d9534f);
  border-radius: 8px;
  background: rgba(217, 83, 79, 0.1);
  box-shadow: var(--tm-shadow);
}

.care-emergency__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tm-coral, #d9534f);
  font-size: 0.8rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.care-emergency__phone {
  color: var(--tm-heading);
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  font-weight: 950;
  letter-spacing: 0.01em;
}

.care-emergency__hours {
  color: var(--tm-emerald);
  font-weight: 850;
}

.care-emergency__note {
  margin: 6px 0 0;
  color: var(--tm-muted);
  font-size: 0.9rem;
  line-height: 1.55;
}

.care-count {
  margin: 0 0 8px;
  color: var(--tm-muted);
  font-weight: 800;
}

.care-category {
  padding: 22px 0;
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

.section-copy {
  color: var(--tm-muted);
  line-height: 1.6;
}

.care-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.care-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.care-card__body {
  display: grid;
  gap: 18px;
  padding: 18px;
}

.care-card__kind {
  margin: 0 0 8px;
}

.care-card h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.15rem;
  line-height: 1.2;
}

.care-card span {
  display: block;
  margin-top: 8px;
  color: var(--tm-muted);
  line-height: 1.6;
}

.care-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.care-card__meta li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 780;
}

.care-card__meta i {
  color: var(--tm-gold);
}

.care-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.care-card__footer strong {
  color: var(--tm-heading);
  font-size: 0.98rem;
}

.care-state {
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

.care-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.care-state--error i {
  color: var(--tm-coral);
}

@media (max-width: 980px) {
  .care-hero {
    grid-template-columns: 1fr;
  }

  .care-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .care-grid {
    grid-template-columns: 1fr;
  }

  .care-hero__actions .p-button,
  .care-card__footer .p-button {
    width: 100%;
  }

  .care-card__footer {
    align-items: start;
    flex-direction: column;
  }
}
</style>
