<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { getMyHealthcareRequest } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatDateTime, formatMGA } from '@/utils/format';
import { statusSeverity } from '@/utils/status';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { t } = usePublicI18n();

const request = ref(null);
const loading = ref(false);
const error = ref('');

const isPackage = computed(() => request.value?.request_type === 'package');
const assignments = computed(() => request.value?.assignments || []);
const staff = computed(() => request.value?.staff || []);
const scheduleLabel = computed(() => {
  const req = request.value;
  if (!req) return '-';
  if (isPackage.value) return req.start_at ? formatDate(req.start_at) : t('To be confirmed');
  return req.preferred_at ? formatDateTime(req.preferred_at) : t('Flexible timing');
});

const facts = computed(() => {
  const req = request.value;
  if (!req) return [];
  const rows = [
    { icon: 'pi pi-user', label: 'Patient', value: req.patient_name },
    { icon: 'pi pi-map-marker', label: 'Address', value: req.address },
    { icon: 'pi pi-calendar', label: isPackage.value ? 'Coverage start' : 'Preferred time', value: scheduleLabel.value },
    { icon: 'pi pi-phone', label: 'Contact', value: req.contact_phone },
  ];
  if (req.patient_age !== null && req.patient_age !== undefined) {
    rows.push({ icon: 'pi pi-id-card', label: 'Age', value: req.patient_age });
  }
  if (req.patient_gender) {
    rows.push({ icon: 'pi pi-user', label: 'Gender', value: t(titleize(req.patient_gender)) });
  }
  if (req.contact_email) {
    rows.push({ icon: 'pi pi-envelope', label: 'Email', value: req.contact_email });
  }
  if (isPackage.value && req.end_at) {
    rows.push({ icon: 'pi pi-calendar-times', label: 'Coverage end', value: formatDate(req.end_at) });
  }
  return rows;
});

const priceLabel = computed(() => {
  const req = request.value;
  if (req?.quoted_price) return formatMGA(Number(req.quoted_price || 0));
  if (req?.price_snapshot) return `${t('From')} ${formatMGA(Number(req.price_snapshot || 0))}`;
  return t('Pending team review');
});

const nextSteps = computed(() => [
  {
    icon: 'pi pi-search',
    title: t('Request review'),
    text: t('The team checks the care details, location, and preferred timing.'),
  },
  {
    icon: 'pi pi-tag',
    title: t('Price confirmation'),
    text: isPackage.value
      ? t('The package price is recorded and the team confirms the care schedule.')
      : t('The team prepares the final consultation quote after review.'),
  },
  {
    icon: 'pi pi-users',
    title: t('Care team assignment'),
    text: t('The right doctor or nurse is assigned and the visit is coordinated with you.'),
  },
  {
    icon: 'pi pi-wallet',
    title: t('Payment and care'),
    text: t('The team confirms payment options and keeps your request updated in your account.'),
  },
]);

function titleize(value) {
  return String(value || '').replace(/_/g, ' ').replace(/^\w/, (char) => char.toUpperCase());
}

async function load() {
  await auth.ensureReady();
  if (!auth.isAuthenticated) {
    router.replace({ name: 'account', query: { redirect: route.fullPath } });
    return;
  }
  loading.value = true;
  error.value = '';
  try {
    request.value = await getMyHealthcareRequest(route.params.id);
  } catch (err) {
    request.value = null;
    error.value = err?.message || t('Could not load healthcare request');
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.id, load);
onMounted(load);
</script>

<template>
  <section class="confirm-page care-confirm-page">
    <div class="app-container confirm-page__inner">
      <div v-if="loading" class="confirm-state">
        <i class="pi pi-spin pi-spinner" />
        <span>{{ t('Loading request...') }}</span>
      </div>

      <div v-else-if="error" class="confirm-state confirm-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button as="router-link" to="/healthcare" :label="t('Back to healthcare')" icon="pi pi-heart" severity="secondary" outlined />
      </div>

      <template v-else-if="request">
        <header class="confirm-hero">
          <div class="confirm-hero__copy">
            <span class="confirm-hero__badge"><i class="pi pi-check" /></span>
            <p class="confirm-kicker"><span /> {{ t('Care request received') }}</p>
            <h1>{{ t('Your request is safely with our care team.') }}</h1>
            <p>{{ t('We will review the details, confirm the price, and contact you to coordinate the care.') }}</p>
            <div class="confirm-hero__tags">
              <Tag :value="t(titleize(request.status))" :severity="statusSeverity(request.status)" />
              <Tag :value="t(titleize(request.payment_status))" :severity="statusSeverity(request.payment_status)" />
              <Tag :value="isPackage ? t('Care package') : t('Consultation')" severity="info" />
            </div>
          </div>
          <aside class="confirm-reference">
            <small>{{ t('Request reference') }}</small>
            <strong>{{ request.request_number }}</strong>
            <span>{{ t('Keep this number for follow-up.') }}</span>
          </aside>
        </header>

        <section class="confirmation-glance">
          <article>
            <span><i class="pi pi-heart" /></span>
            <div><small>{{ t('Care selected') }}</small><strong>{{ request.service_name || t('General home consultation') }}</strong></div>
          </article>
          <article>
            <span><i class="pi pi-calendar" /></span>
            <div><small>{{ isPackage ? t('Coverage start') : t('Preferred time') }}</small><strong>{{ scheduleLabel }}</strong></div>
          </article>
          <article>
            <span><i class="pi pi-wallet" /></span>
            <div><small>{{ isPackage ? t('Package price') : t('Current quote') }}</small><strong>{{ priceLabel }}</strong></div>
          </article>
        </section>

        <div class="confirm-grid">
          <section class="confirm-card soft-panel">
            <header class="confirm-card__head">
              <span><i class="pi pi-file-check" /></span>
              <div><p>{{ t('Request details') }}</p><h2>{{ t('Patient and visit') }}</h2></div>
            </header>
            <dl class="confirm-facts">
              <div v-for="fact in facts" :key="fact.label">
                <dt><i :class="fact.icon" /> {{ t(fact.label) }}</dt>
                <dd>{{ fact.value }}</dd>
              </div>
            </dl>
            <div v-if="request.symptoms" class="confirm-note">
              <small>{{ t('Reason / symptoms') }}</small>
              <p>{{ request.symptoms }}</p>
            </div>
          </section>

          <section class="confirm-card soft-panel">
            <header class="confirm-card__head">
              <span><i class="pi pi-users" /></span>
              <div><p>{{ t('Care coordination') }}</p><h2>{{ t('Your care team') }}</h2></div>
            </header>
            <div v-if="assignments.length" class="team-list">
              <article v-for="assignment in assignments" :key="assignment.id">
                <span><i :class="assignment.practitioner_type === 'doctor' ? 'pi pi-user' : 'pi pi-heart'" /></span>
                <div><small>{{ t(titleize(assignment.practitioner_type)) }}</small><strong>{{ assignment.practitioner_name }}</strong></div>
                <Tag :value="t('Assigned')" severity="success" />
              </article>
            </div>
            <div v-else class="team-empty">
              <span><i class="pi pi-clock" /></span>
              <div><strong>{{ t('Assignment comes after review') }}</strong><p>{{ t('A doctor or nurse will be assigned after the team confirms your request.') }}</p></div>
            </div>

            <template v-if="isPackage && staff.length">
              <div class="team-includes">
                <p>{{ t('This package includes') }}</p>
                <ul>
                  <li v-for="line in staff" :key="line.practitioner_type">
                    <i class="pi pi-check" />
                    <span>{{ line.quantity }} × {{ t(titleize(line.practitioner_type)) }}</span>
                  </li>
                </ul>
              </div>
            </template>

            <div class="price-panel">
              <div><small>{{ isPackage ? t('Package price') : t('Quote status') }}</small><strong>{{ priceLabel }}</strong></div>
              <p>{{ request.quoted_price ? t('The confirmed price is now attached to this request.') : t('We will notify you when the price is confirmed.') }}</p>
            </div>
          </section>
        </div>

        <section class="next-panel soft-panel">
          <header>
            <p class="eyebrow">{{ t('Next steps') }}</p>
            <h2>{{ t('What happens from here') }}</h2>
          </header>
          <ol class="confirm-steps">
            <li v-for="(step, index) in nextSteps" :key="step.title">
              <span>{{ String(index + 1).padStart(2, '0') }}</span>
              <i :class="step.icon" />
              <div><strong>{{ step.title }}</strong><p>{{ step.text }}</p></div>
            </li>
          </ol>
        </section>

        <footer class="confirm-actions">
          <div>
            <strong>{{ t('Everything stays in your account.') }}</strong>
            <span>{{ t('Track status, payment, and assigned practitioners from My requests.') }}</span>
          </div>
          <div>
            <Button as="router-link" :to="{ name: 'orders', query: { tab: 'healthcare' } }" :label="t('Track this request')" icon="pi pi-list" />
            <Button as="router-link" :to="{ name: 'healthcare-request' }" :label="t('New care request')" icon="pi pi-plus" severity="secondary" outlined />
          </div>
        </footer>
      </template>
    </div>
  </section>
</template>

<style scoped>
.care-confirm-page { --care-rose: #c05a7d; --care-rose-soft: rgba(192,90,125,.12); padding: 24px 0 84px; }
.confirm-page__inner { display: grid; gap: 18px; }
.confirm-state { display: grid; min-height: 360px; place-items: center; gap: 12px; padding: 34px; border: 1px solid var(--tm-border); border-radius: 24px; background: var(--tm-surface); color: var(--tm-muted); font-weight: 850; text-align: center; }
.confirm-state i { color: var(--care-rose); font-size: 1.6rem; }
.confirm-state--error i { color: var(--tm-coral); }
.confirm-hero { position: relative; display: grid; align-items: end; gap: 30px; grid-template-columns: minmax(0,1fr) minmax(260px,.35fr); overflow: hidden; padding: clamp(30px,5vw,58px); border-radius: 30px; background: radial-gradient(circle at 88% 0%, rgba(192,90,125,.36), transparent 34%), linear-gradient(135deg,#15191b,#22292a); box-shadow: var(--tm-shadow); }
.confirm-hero::after { position: absolute; right: -130px; bottom: -250px; width: 420px; height: 420px; border: 1px solid rgba(239,157,184,.18); border-radius: 50%; content: ''; }
.confirm-hero > * { position: relative; z-index: 1; }
.confirm-hero__copy { display: grid; justify-items: start; gap: 9px; }
.confirm-hero__badge { display: grid; width: 54px; height: 54px; margin-bottom: 5px; border-radius: 999px; background: var(--care-rose); color: #fff; font-size: 1.35rem; box-shadow: 0 10px 26px rgba(192,90,125,.3); place-items: center; }
.confirm-kicker { display: flex; align-items: center; gap: 8px; margin: 0; color: #ef9db8; font-size: .7rem; font-weight: 900; letter-spacing: .13em; text-transform: uppercase; }
.confirm-kicker span { width: 22px; height: 2px; background: currentColor; }
.confirm-hero h1 { max-width: 850px; margin: 0; color: #fff9f1; font-size: clamp(2.8rem,6vw,5.3rem); line-height: .92; letter-spacing: -.06em; }
.confirm-hero__copy > p:not(.confirm-kicker) { max-width: 690px; margin: 9px 0 0; color: rgba(255,255,255,.64); line-height: 1.65; }
.confirm-hero__tags { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
.confirm-reference { display: grid; gap: 5px; padding: 18px; border: 1px solid rgba(255,255,255,.16); border-radius: 17px; background: rgba(255,255,255,.06); backdrop-filter: blur(8px); }
.confirm-reference small { color: #ef9db8; font-size: .67rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.confirm-reference strong { overflow-wrap: anywhere; color: #fff; font-size: 1.05rem; }
.confirm-reference span { color: rgba(255,255,255,.58); font-size: .74rem; }
.confirmation-glance { display: grid; gap: 10px; grid-template-columns: repeat(3,minmax(0,1fr)); }
.confirmation-glance article { display: grid; align-items: center; gap: 10px; grid-template-columns: auto minmax(0,1fr); padding: 15px; border: 1px solid var(--tm-border); border-radius: 17px; background: var(--tm-surface); }
.confirmation-glance article > span { display: grid; width: 42px; height: 42px; border-radius: 13px; background: var(--care-rose-soft); color: var(--care-rose); place-items: center; }
.confirmation-glance article div { display: grid; min-width: 0; gap: 2px; }
.confirmation-glance small { color: var(--tm-muted); font-size: .66rem; font-weight: 780; }
.confirmation-glance strong { overflow: hidden; color: var(--tm-heading); font-size: .82rem; text-overflow: ellipsis; white-space: nowrap; }
.confirm-grid { display: grid; align-items: start; gap: 18px; grid-template-columns: repeat(2,minmax(0,1fr)); }
.confirm-card { display: grid; gap: 17px; padding: 22px; }
.confirm-card__head { display: grid; align-items: center; gap: 11px; grid-template-columns: auto minmax(0,1fr); padding-bottom: 14px; border-bottom: 1px solid var(--tm-border); }
.confirm-card__head > span { display: grid; width: 42px; height: 42px; border-radius: 13px; background: var(--tm-charcoal); color: #ef9db8; place-items: center; }
.confirm-card__head div { display: grid; gap: 2px; }
.confirm-card__head p { margin: 0; color: var(--care-rose); font-size: .64rem; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
.confirm-card__head h2 { margin: 0; color: var(--tm-heading); font-size: 1.22rem; letter-spacing: -.025em; }
.confirm-facts { display: grid; gap: 0; margin: 0; }
.confirm-facts > div { display: flex; justify-content: space-between; gap: 16px; padding: 11px 0; border-bottom: 1px solid var(--tm-border); }
.confirm-facts dt { display: inline-flex; align-items: center; gap: 7px; color: var(--tm-muted); font-size: .77rem; font-weight: 780; }
.confirm-facts dt i { color: var(--care-rose); }
.confirm-facts dd { max-width: 62%; margin: 0; color: var(--tm-heading); font-size: .8rem; font-weight: 820; text-align: right; overflow-wrap: anywhere; }
.confirm-note { display: grid; gap: 5px; padding: 13px; border-radius: 13px; background: var(--tm-surface-muted); }
.confirm-note small { color: var(--care-rose); font-size: .65rem; font-weight: 900; text-transform: uppercase; }
.confirm-note p { margin: 0; color: var(--tm-muted); font-size: .8rem; line-height: 1.55; white-space: pre-wrap; }
.team-list { display: grid; gap: 9px; }
.team-list article { display: grid; align-items: center; gap: 10px; grid-template-columns: auto minmax(0,1fr) auto; padding: 11px; border: 1px solid var(--tm-border); border-radius: 14px; background: var(--tm-surface-muted); }
.team-list article > span { display: grid; width: 38px; height: 38px; border-radius: 12px; background: var(--care-rose-soft); color: var(--care-rose); place-items: center; }
.team-list article div { display: grid; gap: 1px; }
.team-list small { color: var(--care-rose); font-size: .63rem; font-weight: 900; text-transform: uppercase; }
.team-list strong { color: var(--tm-heading); font-size: .82rem; }
.team-empty { display: grid; align-items: center; gap: 11px; grid-template-columns: auto minmax(0,1fr); padding: 14px; border: 1px dashed var(--tm-border-strong); border-radius: 14px; }
.team-empty > span { display: grid; width: 40px; height: 40px; border-radius: 13px; background: var(--care-rose-soft); color: var(--care-rose); place-items: center; }
.team-empty strong { color: var(--tm-heading); font-size: .84rem; }
.team-empty p { margin: 3px 0 0; color: var(--tm-muted); font-size: .75rem; line-height: 1.45; }
.team-includes { display: grid; gap: 9px; padding-top: 3px; }
.team-includes > p { margin: 0; color: var(--tm-heading); font-size: .78rem; font-weight: 900; }
.team-includes ul { display: flex; flex-wrap: wrap; gap: 7px; margin: 0; padding: 0; list-style: none; }
.team-includes li { display: inline-flex; align-items: center; gap: 6px; padding: 7px 9px; border-radius: 999px; background: var(--care-rose-soft); color: var(--tm-heading); font-size: .7rem; font-weight: 800; }
.team-includes i { color: var(--care-rose); }
.price-panel { display: grid; gap: 9px; margin-top: auto; padding: 15px; border-radius: 15px; background: var(--tm-charcoal); }
.price-panel div { display: flex; align-items: end; justify-content: space-between; gap: 12px; }
.price-panel small { color: #ef9db8; font-size: .66rem; font-weight: 900; text-transform: uppercase; }
.price-panel strong { color: #fff; font-size: 1.2rem; text-align: right; }
.price-panel p { margin: 0; padding-top: 9px; border-top: 1px solid rgba(255,255,255,.11); color: rgba(255,255,255,.58); font-size: .7rem; line-height: 1.45; }
.next-panel { display: grid; gap: 20px; padding: 22px; }
.next-panel header { display: flex; align-items: end; justify-content: space-between; gap: 18px; }
.next-panel header p { margin: 0 0 5px; }
.next-panel h2 { margin: 0; color: var(--tm-heading); font-size: clamp(1.5rem,3vw,2.2rem); letter-spacing: -.04em; }
.confirm-steps { display: grid; gap: 0; grid-template-columns: repeat(4,minmax(0,1fr)); margin: 0; padding: 0; list-style: none; }
.confirm-steps li { position: relative; display: grid; align-content: start; gap: 10px; padding: 18px; border-top: 1px solid var(--tm-border); }
.confirm-steps li + li { border-left: 1px solid var(--tm-border); }
.confirm-steps li > span { position: absolute; top: -10px; left: 16px; padding: 2px 6px; background: var(--tm-surface); color: var(--care-rose); font-size: .63rem; font-weight: 950; }
.confirm-steps li > i { display: grid; width: 40px; height: 40px; border-radius: 13px; background: var(--care-rose-soft); color: var(--care-rose); place-items: center; }
.confirm-steps strong { color: var(--tm-heading); font-size: .84rem; }
.confirm-steps p { margin: 4px 0 0; color: var(--tm-muted); font-size: .73rem; line-height: 1.5; }
.confirm-actions { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 17px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); }
.confirm-actions > div:first-child { display: grid; gap: 2px; }
.confirm-actions > div:first-child strong { color: var(--tm-heading); font-size: .88rem; }
.confirm-actions > div:first-child span { color: var(--tm-muted); font-size: .75rem; }
.confirm-actions > div:last-child { display: flex; flex-wrap: wrap; gap: 8px; }
.confirm-actions :deep(.p-button:not(.p-button-outlined)) { border-color: var(--care-rose); background: var(--care-rose); }
@media (max-width: 940px) { .confirm-hero { grid-template-columns: 1fr; } .confirmation-glance { grid-template-columns: 1fr; } .confirm-grid { grid-template-columns: 1fr; } .confirm-steps { grid-template-columns: repeat(2,minmax(0,1fr)); } .confirm-steps li:nth-child(3) { border-left: 0; } }
@media (max-width: 680px) { .care-confirm-page { padding-top: 12px; } .confirm-hero { border-radius: 22px; } .confirm-steps { grid-template-columns: 1fr; } .confirm-steps li + li { border-left: 0; } .confirm-actions { align-items: stretch; flex-direction: column; } .confirm-actions > div:last-child { flex-direction: column; } .confirm-actions :deep(.p-button) { width: 100%; } }
</style>
