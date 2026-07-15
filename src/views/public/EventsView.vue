<script setup>
import { computed, onMounted, ref } from 'vue';

import CardSkeleton from '@/components/CardSkeleton.vue';
import { listEventServiceCategories, listEventServices } from '@/api/public';
import eventPlanningShowcase from '@/assets/redesign/service-event.webp';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';

const { content, t } = usePublicI18n();
const categories = ref([]);
const services = ref([]);
const loading = ref(false);
const error = ref('');
const activeCategory = ref(null);

const eventTypes = [
  { value: 'wedding', label: 'Wedding', icon: 'pi pi-heart', note: 'Ceremony, reception, sound, decor, and catering.' },
  { value: 'corporate', label: 'Corporate', icon: 'pi pi-briefcase', note: 'Conferences, launches, workshops, and company celebrations.' },
  { value: 'birthday', label: 'Celebration', icon: 'pi pi-sparkles', note: 'Birthdays, family moments, and private celebrations.' },
  { value: 'concert', label: 'Concert', icon: 'pi pi-microphone', note: 'Stage, artists, sound, lighting, and audience experience.' },
];

const categoryOptions = computed(() => [
  { id: null, name: t('All services'), icon: 'pi pi-th-large' },
  ...categories.value,
]);
const visibleServices = computed(() => (
  activeCategory.value == null
    ? services.value
    : services.value.filter((service) => Number(service.category_id) === Number(activeCategory.value))
));
const activeCategoryName = computed(() => {
  const category = categories.value.find((item) => Number(item.id) === Number(activeCategory.value));
  return category ? categoryName(category) : t('All services');
});

function categoryFor(service) {
  return categories.value.find((category) => Number(category.id) === Number(service.category_id));
}

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

function categoryName(category) {
  return t(content(category, 'name') || category?.name || t('Event service'));
}

function serviceName(service) {
  return t(content(service, 'name') || service.name);
}

function serviceDescription(service) {
  return content(service, 'description') || service.description || t('Custom event support from the Trimobe planning team.');
}

function planRoute(service = null) {
  return {
    name: 'event-plan',
    query: service?.slug ? { service: service.slug } : {},
  };
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
    <div class="app-container events-page__inner">
      <header class="events-hero">
        <div class="events-hero__copy">
          <p class="eyebrow">{{ t('Event planning') }}</p>
          <h1>{{ t('One vision. One team. Every detail connected.') }}</h1>
          <p>{{ t('Build your event from trusted services and artists, then send one clear request for a tailored Trimobe quote.') }}</p>
          <div class="events-hero__actions">
            <Button as="router-link" :to="planRoute()" :label="t('Start planning')" icon="pi pi-arrow-right" iconPos="right" />
            <Button as="router-link" to="/events/artists" :label="t('Explore artists')" icon="pi pi-microphone" severity="secondary" outlined />
          </div>
          <div class="events-hero__trust">
            <span><i class="pi pi-check-circle" />{{ t('One coordinated request') }}</span>
            <span><i class="pi pi-tag" />{{ t('Tailored final quote') }}</span>
            <span><i class="pi pi-comments" />{{ t('Personal planning support') }}</span>
          </div>
        </div>

        <figure class="events-hero__media">
          <img :src="eventPlanningShowcase" :alt="t('Event stage, lighting, catering, and decor')" />
          <figcaption>
            <span><i class="pi pi-sparkles" /></span>
            <div><small>{{ t('Everything in one plan') }}</small><strong>{{ services.length }} {{ t('services ready to combine') }}</strong></div>
          </figcaption>
        </figure>
      </header>

      <section class="event-types" :aria-label="t('Start with your event type')">
        <div class="event-types__head">
          <div><p class="eyebrow">{{ t('Start with the occasion') }}</p><h2>{{ t('What are you planning?') }}</h2></div>
          <span>{{ t('Choose a starting point. You can adjust every detail next.') }}</span>
        </div>
        <div class="event-types__grid">
          <RouterLink v-for="type in eventTypes" :key="type.value" :to="{ name: 'event-plan', query: { type: type.value } }">
            <span><i :class="type.icon" /></span>
            <div><strong>{{ t(type.label) }}</strong><small>{{ t(type.note) }}</small></div>
            <i class="pi pi-arrow-up-right" />
          </RouterLink>
        </div>
      </section>

      <section class="services-catalog">
        <div class="services-catalog__head">
          <div>
            <p class="eyebrow">{{ t('Build your event') }}</p>
            <h2>{{ t('Services that work better together.') }}</h2>
            <span>{{ t('{count} services in {category}', { count: visibleServices.length, category: activeCategoryName }) }}</span>
          </div>
          <Button as="router-link" :to="planRoute()" :label="t('Create my request')" icon="pi pi-calendar-plus" />
        </div>

        <nav class="category-pills" :aria-label="t('Event service categories')">
          <button
            v-for="category in categoryOptions"
            :key="category.id ?? 'all'"
            type="button"
            :class="{ 'is-active': activeCategory === category.id }"
            @click="activeCategory = category.id"
          >
            <i :class="category.icon || 'pi pi-star'" />
            <span>{{ categoryName(category) }}</span>
          </button>
        </nav>

        <div v-if="error" class="events-state events-state--error">
          <i class="pi pi-exclamation-triangle" /><span>{{ error }}</span>
          <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
        </div>
        <div v-else-if="loading" class="events-grid" aria-hidden="true"><CardSkeleton v-for="n in 6" :key="n" /></div>
        <div v-else-if="visibleServices.length" class="events-grid">
          <article v-for="service in visibleServices" :key="service.id" class="event-card">
            <figure class="event-card__image">
              <img :src="serviceImage(service)" :alt="serviceName(service)" loading="lazy" />
              <span>{{ categoryName(categoryFor(service)) }}</span>
            </figure>
            <div class="event-card__body">
              <div><h3>{{ serviceName(service) }}</h3><p>{{ serviceDescription(service) }}</p></div>
              <div class="event-card__footer">
                <div><small>{{ t('Indicative price') }}</small><strong>{{ priceLabel(service) }}</strong></div>
                <Button as="router-link" :to="planRoute(service)" icon="pi pi-arrow-right" rounded :aria-label="t('Add {service} to a request', { service: serviceName(service) })" />
              </div>
            </div>
          </article>
        </div>
        <div v-else class="events-state"><i class="pi pi-calendar" /><span>{{ t('No services in this category yet.') }}</span></div>
      </section>

      <section class="artists-cta">
        <div>
          <span><i class="pi pi-microphone" /></span>
          <div><p class="eyebrow">{{ t('Live talent') }}</p><h2>{{ t('Bring the right voice to the moment.') }}</h2><small>{{ t('Browse gospel artists, worship leaders, choirs, and bands, then add them to the same planning request.') }}</small></div>
        </div>
        <Button as="router-link" to="/events/artists" :label="t('Meet the artists')" icon="pi pi-arrow-right" iconPos="right" />
      </section>
    </div>
  </section>
</template>

<style scoped>
.events-page { padding: 22px 0 90px; }
.events-page__inner { display: grid; gap: 54px; }
.events-hero { position: relative; display: grid; min-height: 540px; grid-template-columns: minmax(0,.92fr) minmax(430px,1.08fr); align-items: center; gap: clamp(30px,5vw,70px); overflow: hidden; padding: clamp(30px,5vw,66px); border-radius: 30px; background: radial-gradient(circle at 12% 8%, rgba(201,146,44,.18), transparent 27%), linear-gradient(130deg,#11191b,#242022); box-shadow: var(--tm-shadow); }
.events-hero::after { position: absolute; right: -170px; bottom: -290px; width: 560px; height: 560px; border: 1px solid rgba(206,107,85,.2); border-radius: 50%; content: ''; }
.events-hero__copy, .events-hero__media { position: relative; z-index: 1; }
.events-hero .eyebrow { color: var(--tm-gold); }
.events-hero h1 { max-width: 760px; margin: 9px 0 16px; color: #fff9ef; font-size: clamp(3rem,6.2vw,6.1rem); letter-spacing: -.06em; line-height: .91; }
.events-hero__copy > p:not(.eyebrow) { max-width: 660px; margin: 0; color: rgba(255,255,255,.67); font-size: 1.04rem; line-height: 1.67; }
.events-hero__actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 25px; }
.events-hero__actions :deep(.p-button-secondary) { border-color: rgba(255,255,255,.22); color: #fff; }
.events-hero__trust { display: flex; flex-wrap: wrap; gap: 12px 19px; margin-top: 27px; }
.events-hero__trust span { display: inline-flex; align-items: center; gap: 7px; color: rgba(255,255,255,.68); font-size: .8rem; font-weight: 780; }
.events-hero__trust i { color: var(--tm-gold); }
.events-hero__media { min-height: 410px; margin: 0; overflow: hidden; border-radius: 24px; box-shadow: 0 26px 58px rgba(0,0,0,.28); }
.events-hero__media::after { position: absolute; inset: 0; background: linear-gradient(180deg,transparent 45%,rgba(9,13,14,.72)); content: ''; }
.events-hero__media img { position: absolute; width: 100%; height: 100%; object-fit: cover; }
.events-hero__media figcaption { position: absolute; z-index: 1; right: 18px; bottom: 18px; left: 18px; display: flex; align-items: center; gap: 12px; padding: 14px; border: 1px solid rgba(255,255,255,.18); border-radius: 16px; background: rgba(17,25,27,.75); color: #fff; backdrop-filter: blur(10px); }
.events-hero__media figcaption > span { display: grid; width: 40px; height: 40px; flex: 0 0 auto; border-radius: 13px; background: var(--tm-gold); color: var(--tm-charcoal); place-items: center; }
.events-hero__media figcaption div { display: grid; gap: 2px; } .events-hero__media figcaption small { color: rgba(255,255,255,.62); font-weight: 760; } .events-hero__media figcaption strong { color: #fff; }
.event-types, .services-catalog { display: grid; gap: 22px; }
.event-types__head, .services-catalog__head { display: flex; align-items: end; justify-content: space-between; gap: 24px; }
.event-types__head h2, .services-catalog__head h2, .artists-cta h2 { margin: 5px 0 0; color: var(--tm-heading); font-size: clamp(2rem,4vw,3.35rem); letter-spacing: -.045em; line-height: 1; }
.event-types__head > span, .services-catalog__head > div > span { max-width: 500px; color: var(--tm-muted); font-weight: 740; line-height: 1.55; }
.event-types__grid { display: grid; gap: 12px; grid-template-columns: repeat(4,minmax(0,1fr)); }
.event-types__grid a { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 12px; min-height: 126px; padding: 17px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 12px 30px rgba(37,31,20,.05); color: inherit; text-decoration: none; transition: transform 160ms ease,border-color 160ms ease,box-shadow 160ms ease; }
.event-types__grid a:hover { border-color: var(--tm-gold); box-shadow: var(--tm-shadow-hover); transform: translateY(-3px); }
.event-types__grid a > span { display: grid; width: 44px; height: 44px; border-radius: 14px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; }
.event-types__grid a > div { display: grid; gap: 5px; } .event-types__grid strong { color: var(--tm-heading); } .event-types__grid small { color: var(--tm-muted); font-size: .76rem; line-height: 1.4; } .event-types__grid a > i { color: var(--tm-gold); font-size: .8rem; }
.category-pills { display: flex; flex-wrap: wrap; gap: 9px; }
.category-pills button { display: inline-flex; min-height: 42px; align-items: center; gap: 8px; padding: 9px 15px; border: 1px solid var(--tm-border); border-radius: 999px; background: var(--tm-surface); color: var(--tm-muted); font: inherit; font-size: .85rem; font-weight: 820; cursor: pointer; transition: transform 150ms ease,border-color 150ms ease,background 150ms ease,color 150ms ease; }
.category-pills button:hover { border-color: var(--tm-gold); color: var(--tm-heading); transform: translateY(-1px); }
.category-pills button.is-active { border-color: var(--tm-charcoal); background: var(--tm-charcoal); color: #fff; box-shadow: 0 8px 22px rgba(20,29,31,.14); } .category-pills button.is-active i { color: var(--tm-gold); }
.events-grid { display: grid; gap: 20px; grid-template-columns: repeat(3,minmax(0,1fr)); }
.event-card { display: grid; min-width: 0; overflow: hidden; border: 1px solid var(--tm-border); border-radius: 20px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); transition: transform 160ms ease,box-shadow 160ms ease; } .event-card:hover { box-shadow: var(--tm-shadow-hover); transform: translateY(-3px); }
.event-card__image { position: relative; aspect-ratio: 16/10; margin: 0; overflow: hidden; background: var(--tm-stone); } .event-card__image::after { position: absolute; inset: 0; background: linear-gradient(180deg,transparent 55%,rgba(10,14,15,.55)); content: ''; } .event-card__image img { width: 100%; height: 100%; object-fit: cover; transition: transform 250ms ease; } .event-card:hover img { transform: scale(1.035); }
.event-card__image span { position: absolute; z-index: 1; left: 14px; bottom: 12px; padding: 6px 9px; border-radius: 999px; background: rgba(255,255,255,.91); color: var(--tm-heading); font-size: .7rem; font-weight: 880; }
.event-card__body { display: grid; gap: 18px; padding: 18px; } .event-card h3 { margin: 0; color: var(--tm-heading); font-size: 1.22rem; } .event-card p { display: -webkit-box; min-height: 3.1em; margin: 7px 0 0; overflow: hidden; color: var(--tm-muted); font-size: .88rem; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.event-card__footer { display: flex; align-items: end; justify-content: space-between; gap: 12px; padding-top: 16px; border-top: 1px solid var(--tm-border); } .event-card__footer > div { display: grid; gap: 4px; } .event-card__footer small { color: var(--tm-muted); font-size: .7rem; font-weight: 820; text-transform: uppercase; } .event-card__footer strong { color: var(--tm-heading); font-size: .9rem; }
.events-state { display: grid; min-height: 290px; align-content: center; place-items: center; gap: 10px; padding: 34px; border: 1px solid var(--tm-border); border-radius: 20px; background: var(--tm-surface); color: var(--tm-muted); font-weight: 850; text-align: center; } .events-state i { color: var(--tm-gold); font-size: 1.6rem; } .events-state--error i { color: var(--tm-coral); }
.artists-cta { display: flex; align-items: center; justify-content: space-between; gap: 24px; overflow: hidden; padding: clamp(24px,4vw,38px); border-radius: 24px; background: radial-gradient(circle at 88% 0%,rgba(201,146,44,.2),transparent 35%),var(--tm-charcoal); box-shadow: var(--tm-shadow); }
.artists-cta > div { display: flex; align-items: center; gap: 18px; } .artists-cta > div > span { display: grid; width: 58px; height: 58px; flex: 0 0 auto; border: 1px solid rgba(201,146,44,.45); border-radius: 18px; color: var(--tm-gold); font-size: 1.3rem; place-items: center; } .artists-cta h2 { color: #fff8ed; } .artists-cta small { display: block; max-width: 700px; margin-top: 8px; color: rgba(255,255,255,.62); line-height: 1.55; }
@media (max-width: 1080px) { .events-hero { grid-template-columns: 1fr 1fr; } .event-types__grid,.events-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 780px) { .events-page { padding-top: 12px; } .events-page__inner { gap: 42px; } .events-hero { min-height: auto; grid-template-columns: 1fr; padding: 28px 24px; border-radius: 22px; } .events-hero h1 { font-size: clamp(2.7rem,13vw,4.4rem); } .events-hero__media { min-height: 300px; } .event-types__head,.services-catalog__head,.artists-cta { align-items: stretch; flex-direction: column; } .event-types__grid,.events-grid { grid-template-columns: 1fr; } .artists-cta > div { align-items: flex-start; } }
@media (max-width: 520px) { .events-hero__actions { align-items: stretch; flex-direction: column; } .events-hero__actions :deep(.p-button),.services-catalog__head :deep(.p-button),.artists-cta :deep(.p-button) { width: 100%; } .artists-cta > div > span { display: none; } }
</style>
