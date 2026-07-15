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
const activeCategory = ref('all');
const activeType = ref('all');

const emergencyHours = computed(() => (
  emergency.value ? content(emergency.value, 'emergency_hours') || emergency.value.emergency_hours : ''
));
const emergencyNote = computed(() => (
  emergency.value ? content(emergency.value, 'emergency_note') || emergency.value.emergency_note : ''
));

const categoryOptions = computed(() => [
  { id: 'all', name: t('All care'), icon: 'pi pi-th-large', count: services.value.length },
  ...categories.value.map((category) => ({
    ...category,
    count: services.value.filter((service) => Number(service.category_id) === Number(category.id)).length,
  })).filter((category) => category.count),
]);

const filteredServices = computed(() => services.value.filter((service) => {
  const categoryMatch = activeCategory.value === 'all'
    || Number(service.category_id) === Number(activeCategory.value);
  const typeMatch = activeType.value === 'all' || service.service_type === activeType.value;
  return categoryMatch && typeMatch;
}));

const sections = computed(() => {
  const grouped = new Map();
  for (const service of filteredServices.value) {
    const key = Number(service.category_id || 0);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(service);
  }

  const known = categories.value.map((category) => ({
    category,
    services: grouped.get(Number(category.id)) || [],
  }));
  const knownIds = new Set(categories.value.map((category) => Number(category.id)));
  const uncategorized = filteredServices.value.filter(
    (service) => !knownIds.has(Number(service.category_id || 0)),
  );
  if (uncategorized.length) {
    known.push({
      category: { id: 'more', name: 'More services', icon: 'pi pi-plus-circle' },
      services: uncategorized,
    });
  }
  return known.filter((section) => section.services.length);
});

const careSteps = computed(() => [
  {
    number: '01', icon: 'pi pi-heart', title: t('Choose the care you need'),
    copy: t('Compare consultations and packages with clear starting prices.'),
  },
  {
    number: '02', icon: 'pi pi-file-edit', title: t('Tell us about the patient'),
    copy: t('Share the location, preferred time, and relevant care details.'),
  },
  {
    number: '03', icon: 'pi pi-users', title: t('We prepare the care team'),
    copy: t('Our team reviews the request, confirms pricing, and assigns practitioners.'),
  },
]);

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
      getHealthcareEmergency().catch(() => null),
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
        <div class="care-hero__copy">
          <p class="care-kicker"><span /> {{ t('Care at home, made clearer') }}</p>
          <h1>{{ t('Trusted care, brought to your door.') }}</h1>
          <p class="care-hero__lead">
            {{ t('Book a home consultation or choose an ongoing care package. We help you understand the service, the price, and what happens next.') }}
          </p>
          <div class="care-hero__actions">
            <Button as="router-link" to="/healthcare/request" :label="t('Request care at home')" icon="pi pi-calendar-plus" />
            <Button as="router-link" to="/orders?tab=healthcare" :label="t('Track my requests')" icon="pi pi-arrow-right" severity="secondary" outlined />
          </div>
          <ul class="care-hero__proof">
            <li><i class="pi pi-verified" /><span>{{ t('Trusted practitioners') }}</span></li>
            <li><i class="pi pi-home" /><span>{{ t('Home visits') }}</span></li>
            <li><i class="pi pi-comments" /><span>{{ t('Human follow-up') }}</span></li>
          </ul>
        </div>

        <div class="care-hero__visual">
          <img :src="homeCareVisit" alt="Doctor visiting a patient at home" />
          <div class="care-hero__visual-card">
            <span><i class="pi pi-shield" /></span>
            <div>
              <small>{{ t('Coordinated home care') }}</small>
              <strong>{{ t('One request. A prepared care team.') }}</strong>
            </div>
          </div>
        </div>
      </header>

      <aside v-if="emergency?.emergency_phone" class="care-emergency">
        <span class="care-emergency__icon"><i class="pi pi-phone" /></span>
        <div class="care-emergency__copy">
          <p>{{ t('Need urgent help?') }}</p>
          <span v-if="emergencyNote">{{ emergencyNote }}</span>
          <span v-else>{{ t('Call the emergency line for urgent situations.') }}</span>
        </div>
        <div class="care-emergency__contact">
          <small v-if="emergencyHours">{{ emergencyHours }}</small>
          <a :href="`tel:${emergency.emergency_phone.replace(/\s+/g, '')}`">{{ emergency.emergency_phone }}</a>
        </div>
      </aside>

      <section class="care-process" :aria-label="t('How home care works')">
        <article v-for="step in careSteps" :key="step.number">
          <span class="care-process__number">{{ step.number }}</span>
          <i :class="step.icon" />
          <div>
            <h2>{{ step.title }}</h2>
            <p>{{ step.copy }}</p>
          </div>
        </article>
      </section>

      <section class="care-catalog">
        <header class="care-catalog__head">
          <div>
            <p class="eyebrow">{{ t('Care services') }}</p>
            <h2>{{ t('Find the right care for today and tomorrow.') }}</h2>
          </div>
          <p>{{ t('Start with a single home consultation or choose a package for continued support.') }}</p>
        </header>

        <div class="care-toolbar soft-panel">
          <div class="care-toolbar__categories" role="list" :aria-label="t('Care categories')">
            <button
              v-for="category in categoryOptions"
              :key="category.id"
              type="button"
              :class="{ 'is-active': String(activeCategory) === String(category.id) }"
              @click="activeCategory = category.id"
            >
              <i :class="category.icon || 'pi pi-heart'" />
              <span>{{ category.id === 'all' ? category.name : categoryName(category) }}</span>
              <small>{{ category.count }}</small>
            </button>
          </div>
          <div class="care-toolbar__types">
            <button type="button" :class="{ 'is-active': activeType === 'all' }" @click="activeType = 'all'">{{ t('All') }}</button>
            <button type="button" :class="{ 'is-active': activeType === 'consultation' }" @click="activeType = 'consultation'">{{ t('Consultations') }}</button>
            <button type="button" :class="{ 'is-active': activeType === 'package' }" @click="activeType = 'package'">{{ t('Care packages') }}</button>
          </div>
        </div>

        <div v-if="error" class="care-state care-state--error">
          <i class="pi pi-exclamation-triangle" />
          <span>{{ error }}</span>
          <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
        </div>

        <div v-else-if="loading" class="care-grid" aria-hidden="true">
          <CardSkeleton v-for="n in 6" :key="n" />
        </div>

        <template v-else-if="sections.length">
          <section v-for="section in sections" :key="section.category.id" class="care-category">
            <header class="care-category__head">
              <span><i :class="section.category.icon || 'pi pi-heart'" /></span>
              <div>
                <p>{{ section.services.length }} {{ t('available') }}</p>
                <h3>{{ categoryName(section.category) }}</h3>
                <small v-if="categoryDescription(section.category)">{{ categoryDescription(section.category) }}</small>
              </div>
            </header>

            <div class="care-grid">
              <article v-for="service in section.services" :key="service.id" class="care-card">
                <div class="care-card__media" :class="{ 'has-image': service.image_url }">
                  <img v-if="service.image_url" :src="service.image_url" :alt="serviceName(service)" />
                  <i v-else :class="isPackage(service) ? 'pi pi-users' : 'pi pi-heart-fill'" />
                  <span>{{ isPackage(service) ? t('Care package') : t('Home consultation') }}</span>
                </div>
                <div class="care-card__body">
                  <div class="care-card__heading">
                    <div>
                      <p>{{ section.category.id === 'more' ? t('Healthcare') : categoryName(section.category) }}</p>
                      <h3>{{ serviceName(service) }}</h3>
                    </div>
                    <span class="care-card__arrow"><i class="pi pi-arrow-up-right" /></span>
                  </div>
                  <p class="care-card__description">{{ serviceDescription(service) }}</p>
                  <ul class="care-card__meta">
                    <li v-if="isPackage(service) && staffLabel(service)"><i class="pi pi-users" /> {{ staffLabel(service) }}</li>
                    <li v-if="isPackage(service) && service.duration_days"><i class="pi pi-calendar" /> {{ service.duration_days }} {{ t('days') }}</li>
                    <li v-if="!isPackage(service)"><i class="pi pi-file-check" /> {{ t('Final quote after review') }}</li>
                  </ul>
                  <footer class="care-card__footer">
                    <div>
                      <small>{{ isPackage(service) ? t('Package price') : t('Indicative price') }}</small>
                      <strong>{{ priceLabel(service) }}</strong>
                    </div>
                    <Button
                      as="router-link"
                      :to="{ name: 'healthcare-request', query: { service: service.slug } }"
                      :label="t('Choose this care')"
                      icon="pi pi-arrow-right"
                      size="small"
                    />
                  </footer>
                </div>
              </article>
            </div>
          </section>
        </template>

        <div v-else class="care-state">
          <i class="pi pi-heart" />
          <span>{{ services.length ? t('No care matches these filters.') : t('Healthcare services are being prepared for publication.') }}</span>
          <Button v-if="services.length" :label="t('Clear filters')" icon="pi pi-filter-slash" severity="secondary" outlined @click="activeCategory = 'all'; activeType = 'all'" />
        </div>
      </section>

      <section class="care-cta">
        <div>
          <p class="care-kicker"><span /> {{ t('Not sure where to start?') }}</p>
          <h2>{{ t('Describe the need. We will help choose the care.') }}</h2>
        </div>
        <Button as="router-link" :to="{ name: 'healthcare-request' }" :label="t('Start a general request')" icon="pi pi-arrow-right" />
      </section>
    </div>
  </section>
</template>

<style scoped>
.care-page { --care-rose: #c05a7d; --care-rose-dark: #873751; --care-rose-soft: rgba(192, 90, 125, .12); padding: 24px 0 84px; }
.care-hero { display: grid; min-height: 610px; overflow: hidden; border-radius: 34px; background: radial-gradient(circle at 14% 8%, rgba(192,90,125,.35), transparent 31%), linear-gradient(135deg, #15191b 0%, #22292a 100%); box-shadow: var(--tm-shadow); grid-template-columns: minmax(0, .95fr) minmax(420px, 1.05fr); }
.care-hero__copy { display: flex; flex-direction: column; justify-content: center; padding: clamp(34px, 6vw, 76px); }
.care-kicker { display: flex; align-items: center; gap: 9px; margin: 0 0 14px; color: #ef9db8; font-size: .73rem; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; }
.care-kicker span { width: 24px; height: 2px; background: currentColor; }
.care-hero h1 { max-width: 720px; margin: 0; color: #fff9f1; font-size: clamp(3.15rem, 6.5vw, 6rem); line-height: .91; letter-spacing: -.065em; }
.care-hero__lead { max-width: 650px; margin: 22px 0 0; color: rgba(255,255,255,.68); font-size: 1.02rem; line-height: 1.72; }
.care-hero__actions { display: flex; flex-wrap: wrap; gap: 11px; margin-top: 28px; }
.care-hero__actions :deep(.p-button:first-child) { border-color: var(--care-rose); background: var(--care-rose); }
.care-hero__actions :deep(.p-button-outlined) { border-color: rgba(255,255,255,.24); color: #fff; }
.care-hero__proof { display: flex; flex-wrap: wrap; gap: 11px 22px; margin: 34px 0 0; padding: 0; list-style: none; }
.care-hero__proof li { display: inline-flex; align-items: center; gap: 7px; color: rgba(255,255,255,.72); font-size: .78rem; font-weight: 800; }
.care-hero__proof i { color: #ef9db8; }
.care-hero__visual { position: relative; min-height: 610px; overflow: hidden; }
.care-hero__visual::after { position: absolute; inset: 0; background: linear-gradient(90deg, #202628 0%, transparent 32%), linear-gradient(0deg, rgba(16,20,22,.28), transparent 55%); content: ''; }
.care-hero__visual > img { width: 100%; height: 100%; object-fit: cover; }
.care-hero__visual-card { position: absolute; z-index: 1; right: 24px; bottom: 24px; left: 24px; display: grid; align-items: center; gap: 12px; grid-template-columns: auto minmax(0,1fr); padding: 16px; border: 1px solid rgba(255,255,255,.2); border-radius: 18px; background: rgba(16,20,22,.78); backdrop-filter: blur(14px); }
.care-hero__visual-card > span { display: grid; width: 44px; height: 44px; border-radius: 14px; background: var(--care-rose); color: #fff; place-items: center; }
.care-hero__visual-card div { display: grid; gap: 2px; }
.care-hero__visual-card small { color: #ef9db8; font-size: .68rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.care-hero__visual-card strong { color: #fff; font-size: .9rem; }
.care-emergency { display: grid; align-items: center; gap: 15px; grid-template-columns: auto minmax(0,1fr) auto; margin-top: 14px; padding: 16px 19px; border: 1px solid rgba(206,107,85,.24); border-radius: 18px; background: rgba(206,107,85,.09); }
.care-emergency__icon { display: grid; width: 44px; height: 44px; border-radius: 14px; background: var(--tm-coral); color: #fff; place-items: center; }
.care-emergency__copy { display: grid; gap: 2px; }
.care-emergency__copy p { margin: 0; color: var(--tm-heading); font-size: .9rem; font-weight: 900; }
.care-emergency__copy span { color: var(--tm-muted); font-size: .8rem; line-height: 1.45; }
.care-emergency__contact { display: grid; justify-items: end; gap: 2px; }
.care-emergency__contact small { color: var(--tm-muted); font-size: .7rem; font-weight: 780; }
.care-emergency__contact a { color: var(--tm-coral); font-size: 1.18rem; font-weight: 950; text-decoration: none; }
.care-process { display: grid; gap: 0; margin: 38px 0 80px; grid-template-columns: repeat(3,minmax(0,1fr)); }
.care-process article { position: relative; display: grid; align-items: start; gap: 13px; grid-template-columns: auto minmax(0,1fr); padding: 24px; border-top: 1px solid var(--tm-border); border-bottom: 1px solid var(--tm-border); }
.care-process article + article { border-left: 1px solid var(--tm-border); }
.care-process__number { position: absolute; top: -12px; left: 20px; padding: 3px 7px; background: var(--tm-page-bg); color: var(--care-rose); font-size: .68rem; font-weight: 950; }
.care-process article > i { display: grid; width: 42px; height: 42px; border-radius: 13px; background: var(--care-rose-soft); color: var(--care-rose); place-items: center; }
.care-process h2 { margin: 0; color: var(--tm-heading); font-size: .95rem; }
.care-process p { margin: 5px 0 0; color: var(--tm-muted); font-size: .8rem; line-height: 1.55; }
.care-catalog { display: grid; gap: 24px; }
.care-catalog__head { display: grid; align-items: end; gap: 26px; grid-template-columns: minmax(0,1.25fr) minmax(260px,.75fr); }
.care-catalog__head h2 { max-width: 780px; margin: 0; color: var(--tm-heading); font-size: clamp(2.4rem,5vw,4.6rem); line-height: .96; letter-spacing: -.055em; }
.care-catalog__head > p { margin: 0; color: var(--tm-muted); line-height: 1.65; }
.care-toolbar { display: grid; gap: 12px; padding: 14px; }
.care-toolbar__categories { display: grid; gap: 8px; grid-template-columns: repeat(4,minmax(0,1fr)); }
.care-toolbar button { border: 0; font: inherit; cursor: pointer; }
.care-toolbar__categories button { display: grid; align-items: center; gap: 8px; grid-template-columns: auto minmax(0,1fr) auto; min-height: 48px; padding: 9px 11px; border: 1px solid var(--tm-border); border-radius: 13px; background: var(--tm-surface); color: var(--tm-muted); font-size: .76rem; font-weight: 840; text-align: left; }
.care-toolbar__categories button i { color: var(--care-rose); }
.care-toolbar__categories button small { display: grid; min-width: 23px; height: 23px; border-radius: 999px; background: var(--tm-surface-muted); font-size: .67rem; place-items: center; }
.care-toolbar__categories button.is-active { border-color: var(--care-rose); background: var(--care-rose-soft); color: var(--tm-heading); box-shadow: 0 0 0 1px rgba(192,90,125,.12); }
.care-toolbar__types { display: flex; gap: 7px; padding-top: 12px; border-top: 1px solid var(--tm-border); }
.care-toolbar__types button { padding: 8px 12px; border-radius: 999px; background: transparent; color: var(--tm-muted); font-size: .74rem; font-weight: 850; }
.care-toolbar__types button.is-active { background: var(--tm-charcoal); color: #fff; }
.care-category { display: grid; gap: 16px; padding: 22px 0; }
.care-category__head { display: grid; align-items: start; gap: 12px; grid-template-columns: auto minmax(0,1fr); }
.care-category__head > span { display: grid; width: 48px; height: 48px; border-radius: 15px; background: var(--care-rose-soft); color: var(--care-rose); place-items: center; }
.care-category__head div { display: grid; gap: 3px; }
.care-category__head p { margin: 0; color: var(--care-rose); font-size: .67rem; font-weight: 900; letter-spacing: .09em; text-transform: uppercase; }
.care-category__head h3 { margin: 0; color: var(--tm-heading); font-size: 1.5rem; letter-spacing: -.03em; }
.care-category__head small { max-width: 720px; color: var(--tm-muted); line-height: 1.55; }
.care-grid { display: grid; gap: 18px; grid-template-columns: repeat(3,minmax(0,1fr)); }
.care-card { display: grid; min-width: 0; overflow: hidden; border: 1px solid var(--tm-border); border-radius: 22px; background: var(--tm-surface); box-shadow: var(--tm-shadow); transition: transform 180ms ease,box-shadow 180ms ease; }
.care-card:hover { transform: translateY(-3px); box-shadow: var(--tm-shadow-hover); }
.care-card__media { position: relative; display: grid; min-height: 170px; overflow: hidden; background: radial-gradient(circle at 75% 22%, rgba(255,255,255,.55), transparent 28%), linear-gradient(135deg, rgba(192,90,125,.24), rgba(192,90,125,.06)); color: var(--care-rose); font-size: 2.2rem; place-items: center; }
.care-card__media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.care-card__media.has-image::after { position: absolute; inset: 0; background: linear-gradient(0deg, rgba(16,20,22,.48), transparent 52%); content: ''; }
.care-card__media > span { position: absolute; z-index: 1; bottom: 12px; left: 12px; padding: 6px 9px; border-radius: 999px; background: rgba(16,20,22,.82); color: #fff; font-size: .64rem; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; backdrop-filter: blur(8px); }
.care-card__body { display: grid; align-content: start; gap: 15px; padding: 18px; }
.care-card__heading { display: grid; align-items: start; gap: 10px; grid-template-columns: minmax(0,1fr) auto; }
.care-card__heading p { margin: 0 0 4px; color: var(--care-rose); font-size: .65rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.care-card h3 { margin: 0; color: var(--tm-heading); font-size: 1.12rem; line-height: 1.25; }
.care-card__arrow { display: grid; width: 34px; height: 34px; border: 1px solid var(--tm-border); border-radius: 999px; color: var(--tm-muted); place-items: center; }
.care-card__description { margin: 0; color: var(--tm-muted); font-size: .83rem; line-height: 1.6; }
.care-card__meta { display: flex; flex-wrap: wrap; gap: 7px 12px; min-height: 20px; margin: 0; padding: 0; list-style: none; }
.care-card__meta li { display: inline-flex; align-items: center; gap: 6px; color: var(--tm-muted); font-size: .73rem; font-weight: 760; }
.care-card__meta i { color: var(--care-rose); }
.care-card__footer { display: grid; align-items: center; gap: 10px; grid-template-columns: minmax(0,1fr) auto; padding-top: 15px; border-top: 1px solid var(--tm-border); }
.care-card__footer div { display: grid; gap: 2px; }
.care-card__footer small { color: var(--tm-muted); font-size: .65rem; font-weight: 800; }
.care-card__footer strong { color: var(--tm-heading); font-size: .9rem; }
.care-card__footer :deep(.p-button) { border-color: var(--care-rose); background: var(--care-rose); }
.care-state { display: grid; min-height: 300px; place-items: center; gap: 10px; padding: 34px; border: 1px solid var(--tm-border); border-radius: 22px; background: var(--tm-surface); color: var(--tm-muted); font-weight: 850; text-align: center; }
.care-state i { color: var(--care-rose); font-size: 1.6rem; }
.care-state--error i { color: var(--tm-coral); }
.care-cta { display: grid; align-items: center; gap: 24px; grid-template-columns: minmax(0,1fr) auto; margin-top: 70px; padding: clamp(26px,4vw,46px); border-radius: 26px; background: radial-gradient(circle at 86% 0%, rgba(192,90,125,.32), transparent 32%), var(--tm-charcoal); }
.care-cta h2 { max-width: 780px; margin: 0; color: #fff; font-size: clamp(2rem,4vw,3.6rem); line-height: 1; letter-spacing: -.05em; }
.care-cta :deep(.p-button) { border-color: var(--care-rose); background: var(--care-rose); }
@media (max-width: 1040px) { .care-hero { grid-template-columns: 1fr; } .care-hero__visual { min-height: 470px; } .care-hero__visual::after { background: linear-gradient(0deg, rgba(16,20,22,.25), transparent 52%); } .care-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } .care-toolbar__categories { grid-template-columns: repeat(3,minmax(0,1fr)); } }
@media (max-width: 760px) { .care-page { padding-top: 12px; } .care-hero { min-height: 0; border-radius: 24px; } .care-hero__copy { padding: 30px 22px; } .care-hero h1 { font-size: clamp(2.75rem,14vw,4.4rem); } .care-hero__visual { min-height: 370px; } .care-hero__actions { align-items: stretch; flex-direction: column; } .care-hero__actions :deep(.p-button) { width: 100%; } .care-emergency { grid-template-columns: auto minmax(0,1fr); } .care-emergency__contact { grid-column: 2; justify-items: start; } .care-process { grid-template-columns: 1fr; } .care-process article + article { border-left: 0; } .care-process article:not(:last-child) { border-bottom: 0; } .care-catalog__head { grid-template-columns: 1fr; } .care-toolbar__categories { grid-template-columns: repeat(2,minmax(0,1fr)); } .care-grid { grid-template-columns: 1fr; } .care-cta { align-items: stretch; grid-template-columns: 1fr; } .care-cta :deep(.p-button) { width: 100%; } }
@media (max-width: 480px) { .care-toolbar__categories { grid-template-columns: 1fr; } .care-toolbar__types { overflow-x: auto; } .care-toolbar__types button { flex: 0 0 auto; } .care-card__footer { align-items: stretch; grid-template-columns: 1fr; } .care-card__footer :deep(.p-button) { width: 100%; } }
</style>
