<script setup>
import { computed, onMounted, ref } from 'vue';

import CardSkeleton from '@/components/CardSkeleton.vue';
import { getHealthcareEmergency, listHealthcareCategories, listHealthcareServices } from '@/api/public';
import homeCareVisit from '@/assets/redesign/service-healthcare.webp';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';

const { content, t } = usePublicI18n();

const emergency = ref(null);
const categories = ref([]);
const services = ref([]);
const loading = ref(false);
const error = ref('');

const serviceCount = computed(() => services.value.length);
const emergencyHours = computed(() => (
  emergency.value ? content(emergency.value, 'emergency_hours') || emergency.value.emergency_hours : ''
));
const emergencyNote = computed(() => (
  emergency.value ? content(emergency.value, 'emergency_note') || emergency.value.emergency_note : ''
));

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
  const unit = content(service, 'price_unit') || service.price_unit || '';
  if (isPackage(service)) {
    return `${formatMGA(Number(service.price || 0))}${unit ? ` ${unit}` : ''}`;
  }
  if (service.from_price === null || service.from_price === undefined || service.from_price === '') {
    return t('Quote after review');
  }
  return `${t('From')} ${formatMGA(Number(service.from_price || 0))}${unit ? ` ${unit}` : ''}`;
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
  return content(service, 'description') || service.description || t('Home healthcare from the Trimobe network.');
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

        <div class="care-hero__visual">
          <img :src="homeCareVisit" alt="Doctor visiting a patient at home" />
          <aside v-if="emergency && emergency.emergency_phone" class="care-emergency">
            <p class="care-emergency__label"><i class="pi pi-phone" /> {{ t('Emergency') }}</p>
            <a class="care-emergency__phone" :href="`tel:${emergency.emergency_phone.replace(/\s+/g, '')}`">
              {{ emergency.emergency_phone }}
            </a>
            <span v-if="emergencyHours" class="care-emergency__hours">{{ emergencyHours }}</span>
            <p v-if="emergencyNote" class="care-emergency__note">{{ emergencyNote }}</p>
          </aside>
        </div>
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
            <!-- <p class="eyebrow">{{ categoryName(section.category) }}</p> -->
            <h3 class="section-title">
              <i :class="section.category.icon || 'pi pi-heart'" />
              {{ categoryName(section.category) }}
            </h3>
            <p v-if="categoryDescription(section.category)" class="section-copy">{{ categoryDescription(section.category) }}</p>
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
                  <h3>{{ serviceName(service) }}</h3>
                  <span>{{ serviceDescription(service) }}</span>
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
  align-items: center;
  gap: clamp(32px, 6vw, 76px);
  grid-template-columns: minmax(0, 0.82fr) minmax(420px, 1.18fr);
  margin-bottom: 42px;
}

.care-hero h1 {
  max-width: 700px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(3rem, 6vw, 5.5rem);
  line-height: 0.92;
}

.care-hero p:not(.eyebrow) {
  max-width: 640px;
  /* color: var(--tm-muted); */
  line-height: 1.65;
}

.care-hero__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 22px;
}

.care-hero__visual {
  position: relative;
  min-height: 520px;
  overflow: hidden;
  border-radius: 32px;
  background: var(--tm-stone);
  box-shadow: var(--tm-shadow);
}

.care-hero__visual > img {
  width: 100%;
  height: 100%;
  min-height: 520px;
  object-fit: cover;
}

/* Emergency call-out — deliberately loud (coral) and always above the fold. */
.care-emergency {
  display: grid;
  position: absolute;
  right: 22px;
  bottom: 22px;
  left: 22px;
  align-content: center;
  gap: 6px;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 20px;
  background: rgba(16, 20, 22, 0.88);
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(14px);
}

.care-emergency__label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #ff9d89;
  font-size: 0.8rem;
  font-weight: 950;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.care-emergency__phone {
  color: #fff;
  font-size: clamp(1.6rem, 4vw, 2.2rem);
  font-weight: 950;
  letter-spacing: 0.01em;
}

.care-emergency__hours {
  color: #58d7bd;
  font-weight: 850;
}

.care-emergency__note {
  margin: 6px 0 0;
  color: rgb(255, 255, 255);
  font-size: 0.9rem;
  line-height: 1.55;
}

.care-count {
  margin: 0 0 8px;
  color: var(--tm-muted);
  font-weight: 800;
}

.care-category {
  padding: 38px 0;
}

.section-title {
  display: flex !important;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.section-header {
  display: flex;
  flex-direction: column;
  align-items: start;
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
  border-radius: var(--tm-radius);
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.care-card__body {
  display: grid;
  gap: 22px;
  padding: 24px;
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
  padding-top: 18px;
  border-top: 1px solid var(--tm-border);
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
  border-radius: var(--tm-radius);
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

  .care-hero__visual,
  .care-hero__visual > img {
    min-height: 460px;
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

  .care-hero__visual,
  .care-hero__visual > img {
    min-height: 420px;
  }

  .care-emergency {
    right: 12px;
    bottom: 12px;
    left: 12px;
    padding: 18px;
  }

  .care-emergency__phone {
    font-size: 1.45rem;
  }
}
</style>
