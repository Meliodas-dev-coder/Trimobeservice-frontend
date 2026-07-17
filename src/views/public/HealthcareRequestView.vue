<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useToast } from 'primevue/usetoast';

import ClientLocationPicker from '@/components/ClientLocationPicker.vue';
import {
  createHealthcareRequest,
  getHealthcareEmergency,
  listHealthcareCategories,
  listHealthcareServices,
} from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatDateTime, formatMGA } from '@/utils/format';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const auth = useAuthStore();
const { content, t } = usePublicI18n();

const categories = ref([]);
const services = ref([]);
const emergency = ref(null);
const loading = ref(false);
const submitting = ref(false);
const error = ref('');
const currentStep = ref(1);

const today = startOfToday();
const selectedServiceId = ref(null);
const preferredAt = ref(null);
const startAt = ref(defaultStartDate());

const form = reactive({
  patient_name: '',
  patient_age: null,
  patient_gender: '',
  address: '',
  location_latitude: null,
  location_longitude: null,
  location_reference: '',
  symptoms: '',
  contact_phone: '',
  contact_email: '',
});

const steps = computed(() => [
  { number: 1, label: t('Choose care'), short: t('Care'), icon: 'pi pi-heart' },
  { number: 2, label: t('Patient details'), short: t('Patient'), icon: 'pi pi-user' },
  { number: 3, label: t('Visit details'), short: t('Visit'), icon: 'pi pi-map-marker' },
  { number: 4, label: t('Review request'), short: t('Review'), icon: 'pi pi-check-circle' },
]);

const genderOptions = computed(() => [
  { label: t('Male'), value: 'male' },
  { label: t('Female'), value: 'female' },
  { label: t('Other'), value: 'other' },
]);

const categorySections = computed(() => {
  const grouped = new Map();
  for (const service of services.value) {
    const key = Number(service.category_id || 0);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(service);
  }
  const sections = categories.value.map((category) => ({
    category,
    services: grouped.get(Number(category.id)) || [],
  }));
  const knownIds = new Set(categories.value.map((category) => Number(category.id)));
  const uncategorized = services.value.filter(
    (service) => !knownIds.has(Number(service.category_id || 0)),
  );
  if (uncategorized.length) {
    sections.push({ category: { id: 'more', name: 'More services', icon: 'pi pi-plus-circle' }, services: uncategorized });
  }
  return sections.filter((section) => section.services.length);
});

const selectedService = computed(
  () => services.value.find((service) => Number(service.id) === Number(selectedServiceId.value)) || null,
);
const isPackage = computed(() => selectedService.value?.service_type === 'package');
const selectedServiceName = computed(() => (
  selectedService.value ? serviceName(selectedService.value) : t('General home consultation')
));

const priceHint = computed(() => servicePrice(selectedService.value));
const visitDateLabel = computed(() => {
  if (isPackage.value) {
    return startAt.value instanceof Date ? formatDate(startAt.value) : t('Not selected');
  }
  return preferredAt.value instanceof Date ? formatDateTime(preferredAt.value) : t('Flexible timing');
});

const patientStepReady = computed(() => Boolean(form.patient_name.trim()));
const visitStepReady = computed(() => Boolean(
  form.address.trim()
  && form.contact_phone.trim()
  && (!isPackage.value || startAt.value instanceof Date)
));
const canSubmit = computed(() => Boolean(
  auth.isAuthenticated
  && !loading.value
  && !submitting.value
  && patientStepReady.value
  && visitStepReady.value
));

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function defaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() + 3);
  date.setHours(9, 0, 0, 0);
  return date;
}

function categoryName(category) {
  return t(content(category, 'name') || category.name);
}

function categoryDescription(category) {
  return content(category, 'description') || category.description || '';
}

function serviceName(service) {
  return t(content(service, 'name') || service.name);
}

function serviceDescription(service) {
  return content(service, 'description') || service.description || t('Home healthcare from the Trimobe network.');
}

function serviceUnit(service) {
  return content(service, 'price_unit') || service.price_unit || '';
}

function servicePrice(service) {
  if (!service) return t('Quote prepared after review');
  const unit = serviceUnit(service);
  if (service.service_type === 'package') {
    return `${formatMGA(Number(service.price || 0))}${unit ? ` ${unit}` : ''}`;
  }
  if (service.from_price) {
    return `${t('From')} ${formatMGA(Number(service.from_price || 0))}${unit ? ` ${unit}` : ''}`;
  }
  return t('Quote after review');
}

function staffLabel(service) {
  if (!service || service.service_type !== 'package') return '';
  const parts = [];
  if (Number(service.staff_doctors) > 0) {
    parts.push(`${service.staff_doctors} ${Number(service.staff_doctors) > 1 ? t('doctors') : t('doctor')}`);
  }
  if (Number(service.staff_nurses) > 0) {
    parts.push(`${service.staff_nurses} ${Number(service.staff_nurses) > 1 ? t('nurses') : t('nurse')}`);
  }
  return parts.join(' · ');
}

function canOpenStep(step) {
  if (step <= currentStep.value) return true;
  if (step === 2) return true;
  if (step === 3) return patientStepReady.value;
  return patientStepReady.value && visitStepReady.value;
}

function goToStep(step) {
  if (canOpenStep(step)) currentStep.value = step;
}

function nextStep() {
  if (currentStep.value === 1) currentStep.value = 2;
  else if (currentStep.value === 2 && patientStepReady.value) currentStep.value = 3;
  else if (currentStep.value === 3 && visitStepReady.value) currentStep.value = 4;
}

function previousStep() {
  currentStep.value = Math.max(1, currentStep.value - 1);
}

function preselectService() {
  const slug = route.query.service;
  if (!slug) return;
  const match = services.value.find((service) => service.slug === slug);
  if (match) selectedServiceId.value = match.id;
}

function prefillContact() {
  if (!form.contact_email && auth.user?.email) form.contact_email = auth.user.email;
  if (!form.contact_phone && auth.user?.phone) form.contact_phone = auth.user.phone;
  if (!form.patient_name && auth.user?.full_name) form.patient_name = auth.user.full_name;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [categoryList, serviceList, emergencyInfo] = await Promise.all([
      listHealthcareCategories(),
      listHealthcareServices(),
      getHealthcareEmergency().catch(() => null),
    ]);
    categories.value = categoryList;
    services.value = serviceList;
    emergency.value = emergencyInfo;
    preselectService();
  } catch (err) {
    categories.value = [];
    services.value = [];
    error.value = err?.message || t('Could not load healthcare services');
  } finally {
    loading.value = false;
  }
}

async function submitRequest() {
  if (!auth.isAuthenticated) {
    router.push({ name: 'account', query: { redirect: route.fullPath } });
    return;
  }
  if (!canSubmit.value) return;

  submitting.value = true;
  try {
    const body = {
      patient_name: form.patient_name.trim(),
      address: form.address.trim(),
      contact_phone: form.contact_phone.trim(),
    };
    if (Number.isFinite(form.location_latitude) && Number.isFinite(form.location_longitude)) {
      body.location_latitude = form.location_latitude;
      body.location_longitude = form.location_longitude;
    }
    if (form.location_reference.trim()) body.location_reference = form.location_reference.trim();
    if (selectedServiceId.value) body.service_id = Number(selectedServiceId.value);
    if (isPackage.value && startAt.value instanceof Date) body.start_at = startAt.value.toISOString();
    if (!isPackage.value && preferredAt.value instanceof Date) body.preferred_at = preferredAt.value.toISOString();
    if (form.patient_age !== null && form.patient_age !== '') body.patient_age = Number(form.patient_age);
    if (form.patient_gender) body.patient_gender = form.patient_gender;
    if (form.symptoms.trim()) body.symptoms = form.symptoms.trim();
    if (form.contact_email.trim()) body.contact_email = form.contact_email.trim();

    const created = await createHealthcareRequest(body);
    toast.add({ severity: 'success', summary: t('Request sent'), detail: created?.request_number || t('Healthcare request received'), life: 3200 });
    if (created?.id) router.push({ name: 'healthcare-request-confirmation', params: { id: created.id } });
    else router.push({ name: 'healthcare' });
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Request failed'), detail: err?.message || t('Request failed'), life: 4600 });
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await auth.ensureReady();
  if (!auth.isAuthenticated) {
    router.replace({ name: 'account', query: { redirect: route.fullPath } });
    return;
  }
  prefillContact();
  load();
});
</script>

<template>
  <section class="care-request-page">
    <div class="app-container">
      <RouterLink class="request-back" to="/healthcare"><i class="pi pi-arrow-left" /> {{ t('Back to healthcare') }}</RouterLink>

      <header class="request-hero">
        <div>
          <p class="request-kicker"><span /> {{ t('Home healthcare request') }}</p>
          <h1>{{ t('Let us prepare the right care.') }}</h1>
          <p>{{ t('Choose the service, share the patient and visit details, then review everything before sending.') }}</p>
        </div>
        <aside>
          <span><i class="pi pi-lock" /></span>
          <div><small>{{ t('Private request') }}</small><strong>{{ t('Your care details go directly to our team.') }}</strong></div>
        </aside>
      </header>

      <nav class="request-stepper" :aria-label="t('Request progress')">
        <button
          v-for="step in steps"
          :key="step.number"
          type="button"
          :class="{ 'is-active': currentStep === step.number, 'is-complete': currentStep > step.number, 'is-locked': !canOpenStep(step.number) }"
          :disabled="!canOpenStep(step.number)"
          @click="goToStep(step.number)"
        >
          <span><i v-if="currentStep > step.number" class="pi pi-check" /><b v-else>{{ step.number }}</b></span>
          <div><small>{{ t('Step') }} {{ step.number }}</small><strong>{{ step.label }}</strong></div>
        </button>
      </nav>

      <div v-if="error" class="request-state request-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
      </div>

      <form v-else class="request-layout" @submit.prevent="currentStep === 4 ? submitRequest() : nextStep()">
        <main class="request-content">
          <section v-if="currentStep === 1" class="request-panel soft-panel">
            <header class="panel-head">
              <span><i class="pi pi-heart" /></span>
              <div><p>{{ t('Step 1 of 4') }}</p><h2>{{ t('Choose the care you need') }}</h2><small>{{ t('Select a service, or leave it general if you need our guidance.') }}</small></div>
            </header>

            <div v-if="loading" class="service-loading">
              <Skeleton v-for="n in 6" :key="n" height="148px" borderRadius="16px" />
            </div>

            <div v-else class="service-sections">
              <label class="service-option service-option--general" :class="{ 'is-selected': selectedServiceId === null }">
                <RadioButton v-model="selectedServiceId" :value="null" inputId="care-service-general" />
                <span class="service-option__icon"><i class="pi pi-comments" /></span>
                <div>
                  <small>{{ t('Help me choose') }}</small>
                  <strong>{{ t('General home consultation') }}</strong>
                  <p>{{ t('Describe the need and our team will recommend the right care.') }}</p>
                </div>
                <b>{{ t('Quote after review') }}</b>
              </label>

              <section v-for="section in categorySections" :key="section.category.id" class="service-section">
                <header>
                  <span><i :class="section.category.icon || 'pi pi-heart'" /></span>
                  <div>
                    <h3>{{ categoryName(section.category) }}</h3>
                    <p v-if="categoryDescription(section.category)">{{ categoryDescription(section.category) }}</p>
                  </div>
                </header>
                <div class="service-grid">
                  <label
                    v-for="service in section.services"
                    :key="service.id"
                    class="service-option"
                    :class="{ 'is-selected': Number(selectedServiceId) === Number(service.id) }"
                  >
                    <RadioButton v-model="selectedServiceId" :value="service.id" :inputId="`care-service-${service.id}`" />
                    <span class="service-option__icon" :class="{ 'has-image': service.image_url }">
                      <img v-if="service.image_url" :src="service.image_url" :alt="serviceName(service)" />
                      <i v-else :class="service.service_type === 'package' ? 'pi pi-users' : 'pi pi-heart-fill'" />
                    </span>
                    <div>
                      <small>{{ service.service_type === 'package' ? t('Care package') : t('Consultation') }}</small>
                      <strong>{{ serviceName(service) }}</strong>
                      <p>{{ serviceDescription(service) }}</p>
                      <em v-if="staffLabel(service)"><i class="pi pi-users" /> {{ staffLabel(service) }}</em>
                    </div>
                    <b>{{ servicePrice(service) }}</b>
                  </label>
                </div>
              </section>
            </div>
          </section>

          <section v-if="currentStep === 2" class="request-panel soft-panel">
            <header class="panel-head">
              <span><i class="pi pi-user" /></span>
              <div><p>{{ t('Step 2 of 4') }}</p><h2>{{ t('Tell us about the patient') }}</h2><small>{{ t('Only the patient name is required. Add any details that will help the care team prepare.') }}</small></div>
            </header>
            <div class="form-grid">
              <label class="is-wide"><span>{{ t('Patient name*') }}</span><InputText v-model="form.patient_name" :placeholder="t('Who is the care for?')" /></label>
              <label><span>{{ t('Age') }}</span><InputNumber v-model="form.patient_age" :min="0" :max="130" fluid /></label>
              <label><span>{{ t('Gender') }}</span><Select v-model="form.patient_gender" :options="genderOptions" optionLabel="label" optionValue="value" showClear fluid :placeholder="t('Unspecified')" /></label>
              <label class="is-wide"><span>{{ t('Reason / symptoms') }}</span><Textarea v-model="form.symptoms" rows="6" autoResize :placeholder="t('Describe the symptoms, condition, or care needed...')" /></label>
            </div>
            <div class="privacy-note"><i class="pi pi-shield" /><span>{{ t('Share only what is useful for preparing the visit. The team may contact you for clarification.') }}</span></div>
          </section>

          <section v-if="currentStep === 3" class="request-panel soft-panel">
            <header class="panel-head">
              <span><i class="pi pi-map-marker" /></span>
              <div><p>{{ t('Step 3 of 4') }}</p><h2>{{ t('Where and when should care happen?') }}</h2><small>{{ t('Give us the home address and the best contact details for coordination.') }}</small></div>
            </header>
            <div class="form-grid">
              <label v-if="isPackage" class="is-wide"><span>{{ t('Coverage start*') }}</span><DatePicker v-model="startAt" showIcon fluid dateFormat="dd M yy" :minDate="today" /></label>
              <label v-else class="is-wide"><span>{{ t('Preferred visit time') }}</span><DatePicker v-model="preferredAt" showIcon showTime hourFormat="24" fluid dateFormat="dd M yy" :minDate="today" /></label>
              <ClientLocationPicker
                v-model="form.address"
                v-model:latitude="form.location_latitude"
                v-model:longitude="form.location_longitude"
                v-model:locationReference="form.location_reference"
                class="is-wide"
                :label="t('Home address or city*')"
                :placeholder="t('Street, neighbourhood, city')"
              />
              <label><span>{{ t('Contact phone*') }}</span><InputText v-model="form.contact_phone" placeholder="+261..." /></label>
              <label><span>{{ t('Contact email') }}</span><InputText v-model="form.contact_email" placeholder="name@example.com" /></label>
            </div>
            <div class="visit-note"><i class="pi pi-info-circle" /><span>{{ isPackage ? t('The start date helps us organize the package care team.') : t('The preferred time is a request. Our team confirms availability with you.') }}</span></div>
          </section>

          <section v-if="currentStep === 4" class="request-panel soft-panel">
            <header class="panel-head">
              <span><i class="pi pi-check-circle" /></span>
              <div><p>{{ t('Step 4 of 4') }}</p><h2>{{ t('Review before sending') }}</h2><small>{{ t('Check the care, patient, and visit information. You can return to any step to edit it.') }}</small></div>
            </header>
            <div class="review-grid">
              <section>
                <header><span><i class="pi pi-heart" /></span><div><small>{{ t('Selected care') }}</small><strong>{{ selectedServiceName }}</strong></div><button type="button" @click="goToStep(1)">{{ t('Edit') }}</button></header>
                <dl><div><dt>{{ t('Type') }}</dt><dd>{{ isPackage ? t('Care package') : t('Consultation') }}</dd></div><div><dt>{{ t('Price') }}</dt><dd>{{ priceHint }}</dd></div></dl>
              </section>
              <section>
                <header><span><i class="pi pi-user" /></span><div><small>{{ t('Patient') }}</small><strong>{{ form.patient_name }}</strong></div><button type="button" @click="goToStep(2)">{{ t('Edit') }}</button></header>
                <dl><div><dt>{{ t('Age') }}</dt><dd>{{ form.patient_age ?? t('Not provided') }}</dd></div><div><dt>{{ t('Gender') }}</dt><dd>{{ form.patient_gender ? t(form.patient_gender.charAt(0).toUpperCase() + form.patient_gender.slice(1)) : t('Not provided') }}</dd></div></dl>
              </section>
              <section class="is-wide">
                <header><span><i class="pi pi-map-marker" /></span><div><small>{{ t('Visit') }}</small><strong>{{ visitDateLabel }}</strong></div><button type="button" @click="goToStep(3)">{{ t('Edit') }}</button></header>
                <dl><div><dt>{{ t('Address') }}</dt><dd>{{ form.address }}</dd></div><div><dt>{{ t('Contact') }}</dt><dd>{{ form.contact_phone }}</dd></div></dl>
              </section>
              <section v-if="form.symptoms" class="is-wide review-note"><small>{{ t('Reason / symptoms') }}</small><p>{{ form.symptoms }}</p></section>
            </div>
            <div class="review-consent"><i class="pi pi-file-check" /><span>{{ t('By sending this request, you allow the Trimobe team to contact you to review, quote, and coordinate the care.') }}</span></div>
          </section>
        </main>

        <aside class="request-summary soft-panel">
          <div class="request-summary__head">
            <p>{{ t('Your care request') }}</p>
            <Tag :value="isPackage ? t('Package') : t('Consultation')" :severity="isPackage ? 'success' : 'info'" />
          </div>
          <div class="request-summary__service">
            <span><i :class="isPackage ? 'pi pi-users' : 'pi pi-heart-fill'" /></span>
            <div><small>{{ t('Selected care') }}</small><strong>{{ selectedServiceName }}</strong></div>
          </div>
          <dl class="summary-facts">
            <div><dt>{{ t('Price') }}</dt><dd>{{ priceHint }}</dd></div>
            <div><dt>{{ t('Patient') }}</dt><dd>{{ form.patient_name || t('Not added yet') }}</dd></div>
            <div><dt>{{ t('Visit') }}</dt><dd>{{ visitDateLabel }}</dd></div>
            <div><dt>{{ t('Address') }}</dt><dd>{{ form.address || t('Not added yet') }}</dd></div>
          </dl>
          <div class="summary-pricing">
            <i class="pi pi-info-circle" />
            <span>{{ isPackage ? t('This package has a fixed price. The team confirms staffing and timing.') : t('Consultation prices are finalized after the team reviews your request.') }}</span>
          </div>
          <div v-if="emergency?.emergency_phone" class="summary-emergency">
            <i class="pi pi-phone" />
            <div><small>{{ t('This is urgent?') }}</small><a :href="`tel:${emergency.emergency_phone.replace(/\s+/g, '')}`">{{ emergency.emergency_phone }}</a></div>
          </div>
          <div class="request-actions">
            <Button v-if="currentStep > 1" type="button" :label="t('Back')" icon="pi pi-arrow-left" severity="secondary" outlined @click="previousStep" />
            <Button v-if="currentStep < 4" type="submit" :label="t('Continue')" icon="pi pi-arrow-right" iconPos="right" :disabled="currentStep === 2 ? !patientStepReady : currentStep === 3 ? !visitStepReady : false" />
            <Button v-else type="submit" :label="t('Send care request')" icon="pi pi-send" :loading="submitting" :disabled="!canSubmit" />
          </div>
          <p class="summary-safe"><i class="pi pi-lock" /> {{ t('Your information is sent securely to the care coordination team.') }}</p>
        </aside>
      </form>
    </div>
  </section>
</template>

<style scoped>
.care-request-page { --care-rose: #c05a7d; --care-rose-soft: rgba(192,90,125,.12); padding: 24px 0 84px; }
.request-back { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 14px; color: var(--tm-muted); font-size: .8rem; font-weight: 820; text-decoration: none; }
.request-back:hover { color: var(--care-rose); }
.request-hero { display: grid; align-items: end; gap: 28px; grid-template-columns: minmax(0,1fr) minmax(250px,.38fr); overflow: hidden; padding: clamp(28px,5vw,54px); border-radius: 28px; background: radial-gradient(circle at 86% 0%, rgba(192,90,125,.34), transparent 34%), linear-gradient(135deg,#15191b,#22292a); box-shadow: var(--tm-shadow); }
.request-kicker { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; color: #ef9db8; font-size: .7rem; font-weight: 900; letter-spacing: .13em; text-transform: uppercase; }
.request-kicker span { width: 22px; height: 2px; background: currentColor; }
.request-hero h1 { max-width: 850px; margin: 0; color: #fff9f1; font-size: clamp(2.8rem,6vw,5.2rem); line-height: .92; letter-spacing: -.06em; }
.request-hero > div > p:last-child { max-width: 700px; margin: 18px 0 0; color: rgba(255,255,255,.65); line-height: 1.65; }
.request-hero > aside { display: grid; align-items: center; gap: 11px; grid-template-columns: auto minmax(0,1fr); padding: 15px; border: 1px solid rgba(255,255,255,.15); border-radius: 16px; background: rgba(255,255,255,.06); }
.request-hero > aside > span { display: grid; width: 40px; height: 40px; border-radius: 12px; background: var(--care-rose); color: #fff; place-items: center; }
.request-hero > aside div { display: grid; gap: 2px; }
.request-hero > aside small { color: #ef9db8; font-size: .65rem; font-weight: 900; text-transform: uppercase; }
.request-hero > aside strong { color: #fff; font-size: .78rem; line-height: 1.4; }
.request-stepper { display: grid; gap: 8px; grid-template-columns: repeat(4,minmax(0,1fr)); margin: 16px 0 22px; }
.request-stepper button { display: grid; align-items: center; gap: 9px; grid-template-columns: auto minmax(0,1fr); min-height: 62px; padding: 9px 11px; border: 1px solid var(--tm-border); border-radius: 15px; background: var(--tm-surface); color: var(--tm-muted); font: inherit; text-align: left; cursor: pointer; }
.request-stepper button > span { display: grid; width: 34px; height: 34px; border-radius: 11px; background: var(--tm-surface-muted); color: var(--tm-muted); font-size: .75rem; place-items: center; }
.request-stepper button div { display: grid; gap: 1px; }
.request-stepper small { font-size: .62rem; font-weight: 800; text-transform: uppercase; }
.request-stepper strong { color: var(--tm-heading); font-size: .77rem; }
.request-stepper button.is-active { border-color: var(--care-rose); background: var(--care-rose-soft); }
.request-stepper button.is-active > span { background: var(--care-rose); color: #fff; }
.request-stepper button.is-complete > span { background: var(--tm-emerald); color: #fff; }
.request-stepper button.is-locked { opacity: .55; cursor: not-allowed; }
.request-layout { display: grid; align-items: start; gap: 18px; grid-template-columns: minmax(0,1.28fr) minmax(300px,.52fr); }
.request-content { min-width: 0; }
.request-panel { display: grid; gap: 22px; padding: clamp(18px,3vw,28px); }
.panel-head { display: grid; align-items: start; gap: 12px; grid-template-columns: auto minmax(0,1fr); padding-bottom: 18px; border-bottom: 1px solid var(--tm-border); }
.panel-head > span { display: grid; width: 44px; height: 44px; border-radius: 14px; background: var(--care-rose-soft); color: var(--care-rose); place-items: center; }
.panel-head div { display: grid; gap: 3px; }
.panel-head p { margin: 0; color: var(--care-rose); font-size: .65rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.panel-head h2 { margin: 0; color: var(--tm-heading); font-size: 1.45rem; letter-spacing: -.03em; }
.panel-head small { color: var(--tm-muted); line-height: 1.5; }
.service-loading,.service-sections { display: grid; gap: 19px; }
.service-section { display: grid; gap: 12px; }
.service-section > header { display: grid; align-items: start; gap: 10px; grid-template-columns: auto minmax(0,1fr); }
.service-section > header > span { display: grid; width: 36px; height: 36px; border-radius: 11px; background: var(--tm-surface-muted); color: var(--care-rose); place-items: center; }
.service-section h3 { margin: 0; color: var(--tm-heading); font-size: 1rem; }
.service-section header p { margin: 3px 0 0; color: var(--tm-muted); font-size: .75rem; line-height: 1.45; }
.service-grid { display: grid; gap: 10px; grid-template-columns: repeat(2,minmax(0,1fr)); }
.service-option { position: relative; display: grid; align-items: start; gap: 10px; grid-template-columns: auto auto minmax(0,1fr); min-width: 0; padding: 12px; border: 1px solid var(--tm-border); border-radius: 16px; background: var(--tm-surface); cursor: pointer; transition: border-color 150ms ease,box-shadow 150ms ease,transform 150ms ease; }
.service-option:hover { transform: translateY(-2px); }
.service-option.is-selected { border-color: var(--care-rose); background: var(--care-rose-soft); box-shadow: 0 0 0 2px rgba(192,90,125,.1); }
.service-option :deep(.p-radiobutton) { margin-top: 9px; }
.service-option__icon { display: grid; width: 58px; height: 58px; overflow: hidden; border-radius: 14px; background: var(--care-rose-soft); color: var(--care-rose); place-items: center; }
.service-option__icon img { width: 100%; height: 100%; object-fit: cover; }
.service-option > div { display: grid; min-width: 0; gap: 3px; }
.service-option small { color: var(--care-rose); font-size: .62rem; font-weight: 900; letter-spacing: .07em; text-transform: uppercase; }
.service-option strong { color: var(--tm-heading); font-size: .86rem; line-height: 1.3; }
.service-option p { display: -webkit-box; overflow: hidden; margin: 2px 0 0; color: var(--tm-muted); font-size: .72rem; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
.service-option em { display: inline-flex; align-items: center; gap: 5px; color: var(--tm-muted); font-size: .67rem; font-style: normal; font-weight: 760; }
.service-option > b { grid-column: 2/-1; color: var(--tm-heading); font-size: .75rem; }
.service-option--general { align-items: center; grid-template-columns: auto auto minmax(0,1fr) auto; }
.service-option--general > b { grid-column: auto; }
.form-grid { display: grid; gap: 16px; grid-template-columns: repeat(2,minmax(0,1fr)); }
.form-grid label { display: grid; gap: 7px; min-width: 0; }
.form-grid > .is-wide,.form-grid label.is-wide { grid-column: 1/-1; }
.form-grid label > span { color: var(--tm-heading); font-size: .78rem; font-weight: 840; }
.form-grid :deep(.p-select),.form-grid :deep(.p-datepicker),.form-grid :deep(.p-datepicker-input),.form-grid :deep(.p-inputnumber),.form-grid :deep(.p-inputnumber-input),.form-grid :deep(.p-inputtext),.form-grid :deep(.p-textarea) { width: 100%; }
.privacy-note,.visit-note,.review-consent { display: flex; align-items: flex-start; gap: 9px; padding: 12px; border-radius: 13px; background: rgba(49,92,112,.08); color: var(--tm-blue); font-size: .78rem; font-weight: 760; line-height: 1.5; }
.review-grid { display: grid; gap: 12px; grid-template-columns: repeat(2,minmax(0,1fr)); }
.review-grid > section { display: grid; align-content: start; gap: 14px; padding: 15px; border: 1px solid var(--tm-border); border-radius: 15px; background: var(--tm-surface-soft); }
.review-grid > section.is-wide { grid-column: 1/-1; }
.review-grid header { display: grid; align-items: center; gap: 9px; grid-template-columns: auto minmax(0,1fr) auto; }
.review-grid header > span { display: grid; width: 36px; height: 36px; border-radius: 11px; background: var(--tm-charcoal); color: #ef9db8; place-items: center; }
.review-grid header > div { display: grid; }
.review-grid header small,.review-note > small { color: var(--care-rose); font-size: .65rem; font-weight: 900; text-transform: uppercase; }
.review-grid header strong { color: var(--tm-heading); }
.review-grid header button { border: 0; background: transparent; color: var(--care-rose); font: inherit; font-size: .72rem; font-weight: 850; cursor: pointer; }
.review-grid dl { display: grid; gap: 8px; margin: 0; }
.review-grid dl div { display: flex; justify-content: space-between; gap: 12px; }
.review-grid dt { color: var(--tm-muted); font-size: .74rem; }
.review-grid dd { margin: 0; color: var(--tm-heading); font-size: .76rem; font-weight: 800; text-align: right; }
.review-note p { margin: 0; color: var(--tm-muted); line-height: 1.6; white-space: pre-wrap; }
.request-summary { position: sticky; top: 102px; display: grid; gap: 16px; padding: 20px; }
.request-summary__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding-bottom: 14px; border-bottom: 1px solid var(--tm-border); }
.request-summary__head p { margin: 0; color: var(--tm-heading); font-weight: 900; }
.request-summary__service { display: grid; align-items: center; gap: 10px; grid-template-columns: auto minmax(0,1fr); }
.request-summary__service > span { display: grid; width: 43px; height: 43px; border-radius: 13px; background: var(--care-rose-soft); color: var(--care-rose); place-items: center; }
.request-summary__service div { display: grid; gap: 2px; }
.request-summary__service small { color: var(--tm-muted); font-size: .67rem; }
.request-summary__service strong { color: var(--tm-heading); font-size: .86rem; }
.summary-facts { display: grid; gap: 9px; margin: 0; padding: 14px; border-radius: 14px; background: var(--tm-surface-muted); }
.summary-facts div { display: flex; justify-content: space-between; gap: 10px; }
.summary-facts dt { color: var(--tm-muted); font-size: .72rem; font-weight: 760; }
.summary-facts dd { max-width: 58%; margin: 0; overflow: hidden; color: var(--tm-heading); font-size: .73rem; font-weight: 830; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.summary-pricing { display: flex; align-items: flex-start; gap: 8px; padding: 12px; border-radius: 13px; background: var(--tm-charcoal); color: rgba(255,255,255,.68); font-size: .73rem; font-weight: 740; line-height: 1.5; }
.summary-pricing i { margin-top: 2px; color: #ef9db8; }
.summary-emergency { display: grid; align-items: center; gap: 9px; grid-template-columns: auto minmax(0,1fr); padding: 11px; border: 1px solid rgba(206,107,85,.2); border-radius: 13px; background: rgba(206,107,85,.08); }
.summary-emergency > i { color: var(--tm-coral); }
.summary-emergency div { display: grid; }
.summary-emergency small { color: var(--tm-muted); font-size: .65rem; }
.summary-emergency a { color: var(--tm-coral); font-size: .85rem; font-weight: 900; text-decoration: none; }
.request-actions { display: grid; gap: 8px; grid-template-columns: repeat(2,minmax(0,1fr)); }
.request-actions :deep(.p-button:only-child) { grid-column: 1/-1; }
.request-actions :deep(.p-button:not(.p-button-outlined)) { border-color: var(--care-rose); background: var(--care-rose); }
.summary-safe { display: flex; align-items: flex-start; gap: 7px; margin: 0; color: var(--tm-muted); font-size: .66rem; line-height: 1.45; }
.summary-safe i { color: var(--tm-emerald); }
.request-state { display: grid; min-height: 300px; place-items: center; gap: 10px; padding: 34px; border: 1px solid var(--tm-border); border-radius: 22px; background: var(--tm-surface); color: var(--tm-muted); font-weight: 850; text-align: center; }
.request-state--error i { color: var(--tm-coral); }
@media (max-width: 1000px) { .request-layout { grid-template-columns: 1fr; } .request-summary { position: static; } }
@media (max-width: 760px) { .care-request-page { padding-top: 12px; } .request-hero { grid-template-columns: 1fr; border-radius: 22px; } .request-stepper button { justify-content: center; } .request-stepper button div { display: none; } .service-grid,.review-grid { grid-template-columns: 1fr; } .review-grid > section.is-wide { grid-column: auto; } }
@media (max-width: 540px) { .form-grid { grid-template-columns: 1fr; } .form-grid > .is-wide,.form-grid label.is-wide { grid-column: auto; } .service-option { grid-template-columns: auto minmax(0,1fr); } .service-option :deep(.p-radiobutton) { position: absolute; top: 11px; right: 11px; } .service-option__icon { grid-row: span 2; } .service-option > b { grid-column: 2; } .service-option--general { grid-template-columns: auto minmax(0,1fr); } .service-option--general > b { grid-column: 2; } .request-actions { grid-template-columns: 1fr; } .request-actions :deep(.p-button:only-child) { grid-column: auto; } }
</style>
