<script setup>
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import GooglePlaceInput from '@/components/GooglePlaceInput.vue';
import { createEventRequest, listArtists, listEventServiceCategories, listEventServices } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatDateTime, formatMGA } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const { content, t } = usePublicI18n();

const categories = ref([]);
const services = ref([]);
const artists = ref([]);
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
const selectedServiceIds = ref([]);
const selectedArtistIds = ref([]);
const activeServiceCategory = ref(null);
const plannerStep = ref(1);
const confirmedDetails = ref(false);
const restoringDraft = ref(false);

const today = startOfToday();
const startDate = ref(defaultStartDate());
const endDate = ref(null);
const draftKey = 'trimobe-event-planner';

const form = reactive({
  event_type: 'wedding',
  location: '',
  guest_count: null,
  budget: null,
  contact_phone: '',
  contact_email: '',
  note: '',
});

const eventTypeOptions = [
  { label: 'Wedding', value: 'wedding', icon: 'pi pi-heart' },
  { label: 'Corporate', value: 'corporate', icon: 'pi pi-briefcase' },
  { label: 'Birthday', value: 'birthday', icon: 'pi pi-sparkles' },
  { label: 'Concert', value: 'concert', icon: 'pi pi-microphone' },
  { label: 'Conference', value: 'conference', icon: 'pi pi-users' },
  { label: 'Other', value: 'other', icon: 'pi pi-ellipsis-h' },
];
const translatedEventTypeOptions = computed(() => eventTypeOptions.map((option) => ({ ...option, label: t(option.label) })));
const selectedType = computed(() => eventTypeOptions.find((option) => option.value === form.event_type));
const categoryOptions = computed(() => [
  { id: null, name: t('All services'), icon: 'pi pi-th-large' },
  ...categories.value,
]);
const filteredServices = computed(() => (
  activeServiceCategory.value == null
    ? services.value
    : services.value.filter((service) => Number(service.category_id) === Number(activeServiceCategory.value))
));
const selectedServices = computed(() => {
  const selected = new Set(selectedServiceIds.value.map(Number));
  return services.value.filter((service) => selected.has(Number(service.id)));
});
const selectedArtists = computed(() => {
  const selected = new Set(selectedArtistIds.value.map(Number));
  return artists.value.filter((artist) => selected.has(Number(artist.id)));
});
const selectionCount = computed(() => selectedServiceIds.value.length + selectedArtistIds.value.length);
const indicativeTotal = computed(() => (
  selectedServices.value.reduce((sum, service) => sum + Number(service.from_price || 0), 0)
  + selectedArtists.value.reduce((sum, artist) => sum + Number(artist.from_fee || 0), 0)
));
const budgetComparison = computed(() => {
  const budget = Number(form.budget || 0);
  if (!budget || !indicativeTotal.value) {
    return null;
  }
  const difference = budget - indicativeTotal.value;
  return {
    within: difference >= 0,
    amount: Math.abs(difference),
  };
});
const invalidEndDate = computed(() => endDate.value instanceof Date && startDate.value instanceof Date && endDate.value < startDate.value);
const detailsReady = computed(() => (
  Boolean(form.event_type)
  && startDate.value instanceof Date
  && !invalidEndDate.value
  && Boolean(form.location.trim())
));
const selectionReady = computed(() => selectionCount.value > 0);
const contactReady = computed(() => Boolean(form.contact_phone.trim()));
const canSubmit = computed(() => (
  auth.isAuthenticated
  && detailsReady.value
  && selectionReady.value
  && contactReady.value
  && confirmedDetails.value
  && !submitting.value
));
const stepHeading = computed(() => ({
  1: t('Set the event foundation'),
  2: t('Build the experience'),
  3: t('Review and send'),
})[plannerStep.value]);

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(18, 0, 0, 0);
  return date;
}

function categoryFor(service) {
  return categories.value.find((category) => Number(category.id) === Number(service.category_id));
}

function categoryName(category) {
  return t(content(category, 'name') || category?.name || t('Event service'));
}

function serviceName(service) {
  return t(content(service, 'name') || service.name);
}

function priceLabel(service) {
  if (service.from_price === null || service.from_price === undefined || service.from_price === '') {
    return t('Quote by request');
  }
  const unit = content(service, 'price_unit') || service.price_unit || '';
  return `${formatMGA(Number(service.from_price || 0))}${unit ? ` ${unit}` : ''}`;
}

function artistPrice(artist) {
  return artist.from_fee ? `${t('From')} ${formatMGA(Number(artist.from_fee))}` : t('Fee on request');
}

function prefillContact() {
  if (!form.contact_email && auth.user?.email) form.contact_email = auth.user.email;
  if (!form.contact_phone && auth.user?.phone) form.contact_phone = auth.user.phone;
}

function preselectFromRoute() {
  const requestedType = String(route.query.type || '');
  if (eventTypeOptions.some((option) => option.value === requestedType)) {
    form.event_type = requestedType;
  }
  const service = services.value.find((item) => item.slug === route.query.service);
  if (service && !selectedServiceIds.value.includes(service.id)) {
    selectedServiceIds.value = [...selectedServiceIds.value, service.id];
  }
  const artist = artists.value.find((item) => item.slug === route.query.artist);
  if (artist && !selectedArtistIds.value.includes(artist.id)) {
    selectedArtistIds.value = [...selectedArtistIds.value, artist.id];
  }
}

function saveDraft() {
  try {
    sessionStorage.setItem(draftKey, JSON.stringify({
      form: { ...form },
      start_at: startDate.value?.toISOString?.() || null,
      end_at: endDate.value?.toISOString?.() || null,
      service_ids: selectedServiceIds.value,
      artist_ids: selectedArtistIds.value,
    }));
  } catch {
    // The planner still works; this only preserves progress around sign-in.
  }
}

function restoreDraft() {
  if (route.query.resume_request !== '1') {
    preselectFromRoute();
    return;
  }
  try {
    const saved = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
    if (!saved) {
      preselectFromRoute();
      return;
    }
    restoringDraft.value = true;
    Object.assign(form, saved.form || {});
    if (saved.start_at) startDate.value = new Date(saved.start_at);
    if (saved.end_at) endDate.value = new Date(saved.end_at);
    selectedServiceIds.value = saved.service_ids || [];
    selectedArtistIds.value = saved.artist_ids || [];
    prefillContact();
    nextTick(() => {
      plannerStep.value = 3;
      restoringDraft.value = false;
    });
  } catch {
    preselectFromRoute();
  }
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [categoryList, serviceList, artistList] = await Promise.all([
      listEventServiceCategories(),
      listEventServices(),
      listArtists(),
    ]);
    categories.value = categoryList;
    services.value = serviceList;
    artists.value = artistList;
    restoreDraft();
  } catch (err) {
    categories.value = [];
    services.value = [];
    artists.value = [];
    error.value = err?.message || t('Could not load event services');
  } finally {
    loading.value = false;
  }
}

function continueFromDetails() {
  if (detailsReady.value) plannerStep.value = 2;
}

function continueFromServices() {
  if (selectionReady.value) {
    confirmedDetails.value = false;
    plannerStep.value = 3;
  }
}

function goBackStep() {
  plannerStep.value = Math.max(1, plannerStep.value - 1);
}

function goToStep(step) {
  if (step === 1 || (step === 2 && detailsReady.value) || (step === 3 && detailsReady.value && selectionReady.value)) {
    plannerStep.value = step;
  }
}

async function submitRequest() {
  if (!auth.isAuthenticated) {
    saveDraft();
    const resume = router.resolve({
      name: 'event-plan',
      query: { ...route.query, resume_request: '1' },
    }).fullPath;
    router.push({ name: 'account', query: { redirect: resume } });
    return;
  }
  if (!canSubmit.value) return;

  submitting.value = true;
  try {
    const body = {
      event_type: form.event_type,
      event_start: startDate.value.toISOString(),
      location: form.location.trim(),
      contact_phone: form.contact_phone.trim(),
      services: selectedServiceIds.value.map((id) => ({ service_id: id, quantity: 1 })),
      artists: selectedArtistIds.value.map((id) => ({ artist_id: id })),
    };
    if (endDate.value instanceof Date) body.event_end = endDate.value.toISOString();
    if (form.guest_count) body.guest_count = Number(form.guest_count);
    if (form.budget) body.budget = Number(form.budget).toFixed(2);
    if (form.contact_email.trim()) body.contact_email = form.contact_email.trim();
    if (form.note.trim()) body.note = form.note.trim();

    const created = await createEventRequest(body);
    sessionStorage.removeItem(draftKey);
    toast.add({ severity: 'success', summary: t('Request sent'), detail: created?.request_number || t('Event request received'), life: 3200 });
    if (created?.id) {
      router.push({ name: 'event-request-confirmation', params: { id: created.id } });
    } else {
      router.push({ name: 'orders', query: { tab: 'events' } });
    }
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Request failed'), detail: err?.message || t('Request failed'), life: 4600 });
  } finally {
    submitting.value = false;
  }
}

watch(startDate, () => {
  if (endDate.value instanceof Date && endDate.value < startDate.value) endDate.value = null;
  confirmedDetails.value = false;
});
watch([endDate, selectedServiceIds, selectedArtistIds], () => {
  if (!restoringDraft.value) confirmedDetails.value = false;
}, { deep: true });

onMounted(async () => {
  await auth.ensureReady();
  if (auth.isAuthenticated) prefillContact();
  load();
});
</script>

<template>
  <section class="planner-page">
    <div class="app-container planner-page__inner">
      <header class="planner-hero">
        <div class="planner-hero__copy">
          <RouterLink to="/events"><i class="pi pi-arrow-left" />{{ t('Back to events') }}</RouterLink>
          <p class="eyebrow">{{ t('Event request') }}</p>
          <h1>{{ t('Let’s build the event together.') }}</h1>
          <span>{{ t('Three clear steps turn your ideas into one request the Trimobe planning team can review and quote.') }}</span>
        </div>
        <div class="planner-hero__status">
          <span><i :class="selectedType?.icon || 'pi pi-calendar'" /></span>
          <div><small>{{ t('Your plan') }}</small><strong>{{ t(selectedType?.label || 'Event') }}</strong><b>{{ selectionCount }} {{ t('selections') }}</b></div>
        </div>
      </header>

      <ol class="planner-stepper" :aria-label="t('Event planning progress')">
        <li
          v-for="step in [{ n: 1, label: 'Details', icon: 'pi pi-calendar' }, { n: 2, label: 'Services', icon: 'pi pi-star' }, { n: 3, label: 'Review', icon: 'pi pi-check' }]"
          :key="step.n"
          :class="{ 'is-active': plannerStep === step.n, 'is-complete': plannerStep > step.n }"
        >
          <button type="button" @click="goToStep(step.n)">
            <span><i v-if="plannerStep > step.n" class="pi pi-check" /><i v-else :class="step.icon" /></span>
            <div><small>{{ t('Step {number}', { number: step.n }) }}</small><strong>{{ t(step.label) }}</strong></div>
          </button>
        </li>
      </ol>

      <div v-if="error" class="planner-state planner-state--error">
        <i class="pi pi-exclamation-triangle" /><span>{{ error }}</span>
        <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
      </div>

      <form v-else class="planner-layout" @submit.prevent="submitRequest">
        <main class="planner-main">
          <section class="planner-panel">
            <header class="planner-panel__head">
              <span><i :class="plannerStep === 1 ? 'pi pi-calendar' : plannerStep === 2 ? 'pi pi-star' : 'pi pi-check-circle'" /></span>
              <div><p class="eyebrow">{{ t('Step {number}', { number: plannerStep }) }}</p><h2>{{ stepHeading }}</h2></div>
            </header>

            <template v-if="plannerStep === 1">
              <div class="event-type-grid">
                <button v-for="type in translatedEventTypeOptions" :key="type.value" type="button" :class="{ 'is-selected': form.event_type === type.value }" @click="form.event_type = type.value">
                  <i :class="type.icon" /><span>{{ type.label }}</span><i v-if="form.event_type === type.value" class="pi pi-check-circle" />
                </button>
              </div>

              <div class="form-grid">
                <label><span>{{ t('Event start*') }}</span><DatePicker v-model="startDate" showIcon showTime hourFormat="24" fluid dateFormat="dd M yy" :minDate="today" /></label>
                <label><span>{{ t('Event end') }}</span><DatePicker v-model="endDate" showIcon showTime hourFormat="24" fluid dateFormat="dd M yy" :minDate="startDate" /></label>
                <label class="is-wide"><span>{{ t('Location*') }}</span><GooglePlaceInput v-model="form.location" :placeholder="t('Venue, hotel, city, or address')" /></label>
                <label><span>{{ t('Guests') }}</span><InputNumber v-model="form.guest_count" :min="0" fluid /></label>
              </div>
              <p v-if="invalidEndDate" class="form-hint is-error"><i class="pi pi-exclamation-circle" />{{ t('Event end must be after the start date.') }}</p>
            </template>

            <template v-else-if="plannerStep === 2">
              <div class="selection-intro">
                <div><strong>{{ t('Choose services and artists') }}</strong><small>{{ t('Select at least one. The amounts shown are starting estimates, not the final quote.') }}</small></div>
                <span>{{ selectionCount }} {{ t('selected') }}</span>
              </div>

              <nav class="service-pills" :aria-label="t('Event service categories')">
                <button v-for="category in categoryOptions" :key="category.id ?? 'all'" type="button" :class="{ 'is-active': activeServiceCategory === category.id }" @click="activeServiceCategory = category.id">
                  <i :class="category.icon || 'pi pi-star'" />{{ categoryName(category) }}
                </button>
              </nav>

              <div v-if="loading" class="service-grid"><Skeleton v-for="n in 6" :key="n" height="12rem" borderRadius="16px" /></div>
              <div v-else class="service-grid">
                <label v-for="service in filteredServices" :key="service.id" class="service-option" :class="{ 'is-selected': selectedServiceIds.includes(service.id) }">
                  <span class="service-option__media">
                    <img v-if="service.image_url" :src="service.image_url" :alt="serviceName(service)" />
                    <i v-else :class="categoryFor(service)?.icon || 'pi pi-star'" />
                    <Checkbox v-model="selectedServiceIds" :inputId="`event-service-${service.id}`" :value="service.id" />
                  </span>
                  <span class="service-option__copy"><small>{{ categoryName(categoryFor(service)) }}</small><strong>{{ serviceName(service) }}</strong><b>{{ priceLabel(service) }}</b></span>
                </label>
              </div>

              <section v-if="artists.length" class="artist-selector">
                <header><div><p class="eyebrow">{{ t('Live talent') }}</p><h3>{{ t('Add an artist to the same request') }}</h3></div><RouterLink to="/events/artists">{{ t('View profiles') }} <i class="pi pi-arrow-right" /></RouterLink></header>
                <div class="artist-grid">
                  <label v-for="artist in artists" :key="artist.id" :class="{ 'is-selected': selectedArtistIds.includes(artist.id) }">
                    <Checkbox v-model="selectedArtistIds" :inputId="`event-artist-${artist.id}`" :value="artist.id" />
                    <img v-if="artist.photo_url" :src="artist.photo_url" :alt="artist.stage_name" />
                    <span v-else><i class="pi pi-microphone" /></span>
                    <div><strong>{{ artist.stage_name }}</strong><small>{{ artist.genres || t('Gospel artist') }}</small><b>{{ artistPrice(artist) }}</b></div>
                  </label>
                </div>
              </section>
            </template>

            <template v-else>
              <div class="review-grid">
                <section>
                  <header><span><i class="pi pi-calendar" /></span><div><small>{{ t('Event') }}</small><strong>{{ t(selectedType?.label || 'Event') }}</strong></div><Button type="button" :label="t('Edit')" severity="secondary" text size="small" @click="plannerStep = 1" /></header>
                  <dl><div><dt>{{ t('Start') }}</dt><dd>{{ formatDateTime(startDate) }}</dd></div><div><dt>{{ t('Location') }}</dt><dd>{{ form.location }}</dd></div><div v-if="form.guest_count"><dt>{{ t('Guests') }}</dt><dd>{{ form.guest_count }}</dd></div></dl>
                </section>
                <section>
                  <header><span><i class="pi pi-star" /></span><div><small>{{ t('Experience') }}</small><strong>{{ selectionCount }} {{ t('selections') }}</strong></div><Button type="button" :label="t('Edit')" severity="secondary" text size="small" @click="plannerStep = 2" /></header>
                  <ul><li v-for="service in selectedServices" :key="`s-${service.id}`"><span>{{ serviceName(service) }}</span><b>{{ priceLabel(service) }}</b></li><li v-for="artist in selectedArtists" :key="`a-${artist.id}`"><span>{{ artist.stage_name }}</span><b>{{ artistPrice(artist) }}</b></li></ul>
                </section>
              </div>

              <section class="contact-panel">
                <div class="form-grid">
                  <label><span>{{ t('Client budget') }}</span><InputNumber v-model="form.budget" :min="0" suffix=" MGA" fluid /></label>
                  <label><span>{{ t('Contact phone*') }}</span><InputText v-model="form.contact_phone" placeholder="+261..." /></label>
                  <label class="is-wide"><span>{{ t('Contact email') }}</span><InputText v-model="form.contact_email" placeholder="name@example.com" /></label>
                  <label class="is-wide"><span>{{ t('Notes') }}</span><Textarea v-model="form.note" rows="4" autoResize :placeholder="t('Theme, timing, venue rules, preferred artists, menu ideas...')" /></label>
                </div>
              </section>

              <div class="planner-info"><i class="pi pi-info-circle" /><span>{{ t('The displayed total is indicative. The Trimobe team reviews availability and sends the final quote before payment.') }}</span></div>
              <label class="planner-consent"><Checkbox v-model="confirmedDetails" binary /><span>{{ t('I confirm these event details and selections.') }}</span></label>
            </template>
          </section>
        </main>

        <aside class="planner-summary">
          <header><p class="eyebrow">{{ t('Your request') }}</p><h2>{{ t('Planning summary') }}</h2></header>
          <dl class="summary-facts">
            <div><dt>{{ t('Event') }}</dt><dd>{{ t(selectedType?.label || 'Event') }}</dd></div>
            <div><dt>{{ t('Date') }}</dt><dd>{{ formatDateTime(startDate) }}</dd></div>
            <div><dt>{{ t('Selections') }}</dt><dd>{{ selectionCount }}</dd></div>
          </dl>
          <div class="summary-pricing">
            <div><span>{{ t('Starting estimate') }}</span><strong>{{ indicativeTotal ? formatMGA(indicativeTotal) : t('Quote by request') }}</strong></div>
            <div><span>{{ t('Client budget') }}</span><strong>{{ form.budget ? formatMGA(Number(form.budget)) : '—' }}</strong></div>
            <p v-if="budgetComparison" :class="budgetComparison.within ? 'is-within' : 'is-over'">
              <i :class="budgetComparison.within ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'" />
              {{ budgetComparison.within ? t('{amount} below your budget', { amount: formatMGA(budgetComparison.amount) }) : t('{amount} above your budget', { amount: formatMGA(budgetComparison.amount) }) }}
            </p>
          </div>
          <div class="summary-note"><i class="pi pi-comments" /><span>{{ t('Nothing is charged now. The team confirms the final scope and price with you.') }}</span></div>
          <div class="planner-actions">
            <Button v-if="plannerStep === 1" type="button" :label="t('Choose services')" icon="pi pi-arrow-right" iconPos="right" :disabled="!detailsReady" @click="continueFromDetails" />
            <template v-else-if="plannerStep === 2">
              <Button type="button" :label="t('Back')" icon="pi pi-arrow-left" severity="secondary" outlined @click="goBackStep" />
              <Button type="button" :label="t('Review request')" icon="pi pi-arrow-right" iconPos="right" :disabled="!selectionReady" @click="continueFromServices" />
            </template>
            <template v-else>
              <Button type="button" :label="t('Back')" icon="pi pi-arrow-left" severity="secondary" outlined @click="goBackStep" />
              <Button type="submit" :label="auth.isAuthenticated ? t('Send request') : t('Sign in to send request')" icon="pi pi-send" :loading="submitting" :disabled="!confirmedDetails || !contactReady" />
            </template>
          </div>
        </aside>
      </form>
    </div>
  </section>
</template>

<style scoped>
.planner-page { padding: 22px 0 82px; }
.planner-page__inner { display: grid; gap: 20px; }
.planner-hero { position: relative; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: end; gap: 24px; overflow: hidden; padding: clamp(26px,4vw,42px); border-radius: 26px; background: radial-gradient(circle at 88% 0%,rgba(201,146,44,.26),transparent 38%),linear-gradient(135deg,#11191b,#292123); box-shadow: var(--tm-shadow); }
.planner-hero::after { position: absolute; right: -80px; bottom: -170px; width: 310px; height: 310px; border: 1px solid rgba(206,107,85,.25); border-radius: 50%; content: ''; }
.planner-hero__copy,.planner-hero__status { position: relative; z-index: 1; }
.planner-hero__copy > a { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 24px; color: rgba(255,255,255,.72); font-size: .82rem; font-weight: 800; text-decoration: none; } .planner-hero__copy > a:hover { color: #fff; }
.planner-hero .eyebrow { color: var(--tm-gold); }
.planner-hero h1 { max-width: 780px; margin: 7px 0 10px; color: #fff8ed; font-size: clamp(2.5rem,5.5vw,5rem); letter-spacing: -.055em; line-height: .93; }
.planner-hero__copy > span { display: block; max-width: 720px; color: rgba(255,255,255,.63); line-height: 1.6; }
.planner-hero__status { display: flex; min-width: 230px; align-items: center; gap: 12px; padding: 16px; border: 1px solid rgba(255,255,255,.16); border-radius: 17px; background: rgba(255,255,255,.07); color: #fff; backdrop-filter: blur(8px); }
.planner-hero__status > span { display: grid; width: 44px; height: 44px; flex: 0 0 auto; border-radius: 14px; background: var(--tm-gold); color: var(--tm-charcoal); place-items: center; } .planner-hero__status div { display: grid; gap: 2px; } .planner-hero__status small { color: rgba(255,255,255,.56); } .planner-hero__status strong { color: #fff; } .planner-hero__status b { color: var(--tm-gold); font-size: .76rem; }
.planner-stepper { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; margin: 0; padding: 8px; border: 1px solid var(--tm-border); border-radius: 17px; background: var(--tm-surface); list-style: none; box-shadow: 0 10px 30px rgba(37,31,20,.05); }
.planner-stepper button { display: flex; width: 100%; min-height: 54px; align-items: center; gap: 10px; padding: 8px 12px; border: 0; border-radius: 12px; background: transparent; color: var(--tm-muted); font: inherit; text-align: left; cursor: pointer; }
.planner-stepper li.is-active button { background: var(--tm-charcoal); color: #fff; } .planner-stepper li.is-complete button { color: var(--tm-emerald); }
.planner-stepper button > span { display: grid; width: 34px; height: 34px; flex: 0 0 auto; border-radius: 11px; background: var(--tm-surface-soft); color: var(--tm-muted); place-items: center; } .planner-stepper li.is-active button > span { background: var(--tm-gold); color: var(--tm-charcoal); } .planner-stepper li.is-complete button > span { background: rgba(12,155,128,.12); color: var(--tm-emerald); }
.planner-stepper button > div { display: grid; gap: 1px; } .planner-stepper small { color: inherit; font-size: .66rem; font-weight: 780; text-transform: uppercase; } .planner-stepper strong { color: inherit; font-size: .88rem; }
.planner-layout { display: grid; align-items: start; gap: 18px; grid-template-columns: minmax(0,1fr) minmax(310px,.38fr); }
.planner-panel,.planner-summary { border: 1px solid var(--tm-border); border-radius: 20px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); }
.planner-panel { display: grid; gap: 22px; padding: clamp(18px,3vw,26px); }
.planner-panel__head { display: flex; align-items: center; gap: 13px; padding-bottom: 18px; border-bottom: 1px solid var(--tm-border); } .planner-panel__head > span { display: grid; width: 46px; height: 46px; flex: 0 0 auto; border-radius: 14px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; } .planner-panel__head h2 { margin: 4px 0 0; color: var(--tm-heading); font-size: clamp(1.5rem,3vw,2.15rem); letter-spacing: -.035em; }
.event-type-grid { display: grid; gap: 9px; grid-template-columns: repeat(3,minmax(0,1fr)); }
.event-type-grid button { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 9px; min-height: 54px; padding: 10px 12px; border: 1px solid var(--tm-border); border-radius: 13px; background: var(--tm-surface-soft); color: var(--tm-muted); font: inherit; font-weight: 820; text-align: left; cursor: pointer; } .event-type-grid button > i:first-child { color: var(--tm-gold); } .event-type-grid button.is-selected { border-color: var(--tm-emerald); background: rgba(12,155,128,.08); color: var(--tm-heading); } .event-type-grid button > i:last-child { color: var(--tm-emerald); }
.form-grid { display: grid; gap: 14px; grid-template-columns: repeat(2,minmax(0,1fr)); } .form-grid label { display: grid; gap: 7px; min-width: 0; } .form-grid label.is-wide { grid-column: 1/-1; } .form-grid label > span { color: var(--tm-heading); font-size: .8rem; font-weight: 840; } .form-grid :deep(.p-select),.form-grid :deep(.p-datepicker),.form-grid :deep(.p-datepicker-input),.form-grid :deep(.p-inputnumber),.form-grid :deep(.p-inputnumber-input),.form-grid :deep(.p-inputtext),.form-grid :deep(.p-textarea) { width: 100%; }
.form-hint { display: flex; align-items: center; gap: 7px; margin: 0; color: var(--tm-muted); font-size: .82rem; font-weight: 780; } .form-hint.is-error { color: var(--tm-coral); }
.selection-intro { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px; border-radius: 14px; background: var(--tm-surface-soft); } .selection-intro > div { display: grid; gap: 3px; } .selection-intro strong { color: var(--tm-heading); } .selection-intro small { color: var(--tm-muted); line-height: 1.45; } .selection-intro > span { flex: 0 0 auto; padding: 7px 10px; border-radius: 999px; background: var(--tm-charcoal); color: #fff; font-size: .75rem; font-weight: 850; }
.service-pills { display: flex; flex-wrap: wrap; gap: 8px; } .service-pills button { display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border: 1px solid var(--tm-border); border-radius: 999px; background: var(--tm-surface); color: var(--tm-muted); font: inherit; font-size: .78rem; font-weight: 820; cursor: pointer; } .service-pills button.is-active { border-color: var(--tm-charcoal); background: var(--tm-charcoal); color: #fff; } .service-pills button.is-active i { color: var(--tm-gold); }
.service-grid { display: grid; gap: 12px; grid-template-columns: repeat(2,minmax(0,1fr)); }
.service-option { display: grid; min-width: 0; overflow: hidden; border: 1px solid var(--tm-border); border-radius: 16px; background: var(--tm-surface); cursor: pointer; transition: border-color 150ms ease,box-shadow 150ms ease,transform 150ms ease; } .service-option:hover { transform: translateY(-2px); } .service-option.is-selected { border-color: var(--tm-emerald); box-shadow: 0 0 0 2px rgba(12,155,128,.12); }
.service-option__media { position: relative; display: grid; height: 126px; overflow: hidden; background: var(--tm-surface-soft); color: var(--tm-gold); font-size: 1.5rem; place-items: center; } .service-option__media img { width: 100%; height: 100%; object-fit: cover; } .service-option__media :deep(.p-checkbox) { position: absolute; top: 10px; right: 10px; padding: 4px; border-radius: 8px; background: rgba(255,255,255,.9); }
.service-option__copy { display: grid; gap: 4px; padding: 13px; } .service-option__copy small { color: var(--tm-gold); font-size: .67rem; font-weight: 900; text-transform: uppercase; } .service-option__copy strong { color: var(--tm-heading); } .service-option__copy b { color: var(--tm-muted); font-size: .78rem; }
.artist-selector { display: grid; gap: 13px; padding-top: 20px; border-top: 1px solid var(--tm-border); } .artist-selector > header { display: flex; align-items: end; justify-content: space-between; gap: 16px; } .artist-selector h3 { margin: 4px 0 0; color: var(--tm-heading); font-size: 1.2rem; } .artist-selector header a { color: var(--tm-emerald); font-size: .8rem; font-weight: 830; text-decoration: none; }
.artist-grid { display: grid; gap: 10px; grid-template-columns: repeat(2,minmax(0,1fr)); } .artist-grid > label { display: grid; grid-template-columns: auto auto minmax(0,1fr); align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--tm-border); border-radius: 14px; cursor: pointer; } .artist-grid > label.is-selected { border-color: var(--tm-emerald); background: rgba(12,155,128,.06); } .artist-grid img,.artist-grid > label > span { display: grid; width: 50px; height: 50px; border-radius: 13px; background: var(--tm-surface-soft); object-fit: cover; color: var(--tm-gold); place-items: center; } .artist-grid div { display: grid; min-width: 0; gap: 2px; } .artist-grid strong { overflow: hidden; color: var(--tm-heading); text-overflow: ellipsis; white-space: nowrap; } .artist-grid small { color: var(--tm-muted); font-size: .72rem; } .artist-grid b { color: var(--tm-gold); font-size: .72rem; }
.review-grid { display: grid; gap: 12px; grid-template-columns: repeat(2,minmax(0,1fr)); } .review-grid > section { display: grid; align-content: start; gap: 14px; padding: 15px; border: 1px solid var(--tm-border); border-radius: 15px; background: var(--tm-surface-soft); } .review-grid header { display: grid; grid-template-columns: auto minmax(0,1fr) auto; align-items: center; gap: 9px; } .review-grid header > span { display: grid; width: 36px; height: 36px; border-radius: 11px; background: var(--tm-charcoal); color: var(--tm-gold); place-items: center; } .review-grid header > div { display: grid; } .review-grid header small { color: var(--tm-muted); } .review-grid header strong { color: var(--tm-heading); } .review-grid dl { display: grid; gap: 8px; margin: 0; } .review-grid dl div { display: flex; justify-content: space-between; gap: 10px; } .review-grid dt { color: var(--tm-muted); font-size: .75rem; font-weight: 760; } .review-grid dd { margin: 0; color: var(--tm-heading); font-size: .78rem; font-weight: 800; text-align: right; } .review-grid ul { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; } .review-grid li { display: flex; justify-content: space-between; gap: 10px; color: var(--tm-heading); font-size: .78rem; } .review-grid li b { color: var(--tm-muted); text-align: right; }
.contact-panel { padding-top: 20px; border-top: 1px solid var(--tm-border); }
.planner-info { display: flex; align-items: flex-start; gap: 9px; padding: 12px; border-radius: 12px; background: rgba(49,92,112,.09); color: var(--tm-blue); font-size: .8rem; font-weight: 760; line-height: 1.5; }
.planner-consent { display: flex !important; align-items: center; gap: 9px; color: var(--tm-heading); font-size: .83rem; font-weight: 820; }
.planner-summary { position: sticky; top: 102px; display: grid; gap: 16px; padding: 20px; } .planner-summary h2 { margin: 4px 0 0; color: var(--tm-heading); font-size: 1.35rem; }
.summary-facts { display: grid; gap: 9px; margin: 0; } .summary-facts div { display: flex; justify-content: space-between; gap: 10px; } .summary-facts dt { color: var(--tm-muted); font-size: .78rem; font-weight: 780; } .summary-facts dd { margin: 0; color: var(--tm-heading); font-size: .78rem; font-weight: 840; text-align: right; }
.summary-pricing { display: grid; gap: 10px; padding: 14px; border-radius: 14px; background: var(--tm-charcoal); } .summary-pricing > div { display: flex; justify-content: space-between; gap: 10px; } .summary-pricing span { color: rgba(255,255,255,.6); font-size: .75rem; font-weight: 760; } .summary-pricing strong { color: #fff; font-size: .84rem; text-align: right; } .summary-pricing p { display: flex; align-items: center; gap: 7px; margin: 2px 0 0; padding-top: 9px; border-top: 1px solid rgba(255,255,255,.12); font-size: .72rem; font-weight: 800; } .summary-pricing p.is-within { color: #6ee7c8; } .summary-pricing p.is-over { color: #f3a18e; }
.summary-note { display: flex; align-items: flex-start; gap: 9px; color: var(--tm-muted); font-size: .78rem; font-weight: 740; line-height: 1.5; } .summary-note i { margin-top: 2px; color: var(--tm-gold); }
.planner-actions { display: grid; gap: 8px; } .planner-actions :deep(.p-button) { width: 100%; }
.planner-state { display: grid; min-height: 300px; align-content: center; place-items: center; gap: 10px; padding: 34px; border: 1px solid var(--tm-border); border-radius: 20px; background: var(--tm-surface); color: var(--tm-muted); font-weight: 850; text-align: center; } .planner-state i { color: var(--tm-gold); font-size: 1.6rem; } .planner-state--error i { color: var(--tm-coral); }
@media (max-width: 980px) { .planner-layout { grid-template-columns: 1fr; } .planner-summary { position: static; } }
@media (max-width: 760px) { .planner-page { padding-top: 12px; } .planner-hero { grid-template-columns: 1fr; border-radius: 22px; } .planner-hero__status { min-width: 0; } .planner-stepper button > div { display: none; } .planner-stepper button { justify-content: center; } .event-type-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } .service-grid,.artist-grid,.review-grid { grid-template-columns: 1fr; } }
@media (max-width: 520px) { .form-grid { grid-template-columns: 1fr; } .form-grid label.is-wide { grid-column: auto; } .selection-intro,.artist-selector > header { align-items: flex-start; flex-direction: column; } }
</style>
