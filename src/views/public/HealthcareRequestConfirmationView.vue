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

const facts = computed(() => {
  const req = request.value;
  if (!req) {
    return [];
  }
  const rows = [
    { label: 'Service', value: req.service_name || t('General consultation') },
    { label: 'Patient', value: req.patient_name },
    { label: 'Address', value: req.address },
    { label: 'Contact', value: req.contact_phone },
  ];
  if (isPackage.value && req.start_at) {
    rows.push({ label: 'Coverage start', value: formatDate(req.start_at) });
    if (req.end_at) {
      rows.push({ label: 'Coverage end', value: formatDate(req.end_at) });
    }
  } else if (req.preferred_at) {
    rows.push({ label: 'Preferred time', value: formatDateTime(req.preferred_at) });
  }
  if (req.patient_age !== null && req.patient_age !== undefined) {
    rows.push({ label: 'Age', value: req.patient_age });
  }
  if (req.contact_email) {
    rows.push({ label: 'Email', value: req.contact_email });
  }
  return rows;
});

const priceLabel = computed(() => {
  const req = request.value;
  if (req?.quoted_price) {
    return formatMGA(Number(req.quoted_price || 0));
  }
  if (req?.price_snapshot) {
    return `${t('From')} ${formatMGA(Number(req.price_snapshot || 0))}`;
  }
  return t('Our team will send a quote.');
});

const nextSteps = [
  {
    icon: 'pi pi-search',
    title: 'The team reviews your request',
    text: 'We check the details, timing, and which doctor or nurse fits your need.',
  },
  {
    icon: 'pi pi-tag',
    title: 'You receive a quote',
    text: 'For a consultation, an admin adds the final price. Packages already carry their fixed price.',
  },
  {
    icon: 'pi pi-users',
    title: 'We assign your practitioners',
    text: 'A doctor and/or nurse is assigned to your visit or package.',
  },
  {
    icon: 'pi pi-wallet',
    title: 'Confirm payment with the team',
    text: 'Settle by cash, bank transfer, or mobile money. Our team records the payment against your request.',
  },
];

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

watch(() => route.params.id, () => load());
onMounted(load);
</script>

<template>
  <section class="confirm-page">
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
          <span class="confirm-hero__badge"><i class="pi pi-check" /></span>
          <p class="eyebrow">{{ t('Request received') }}</p>
          <h1>{{ t('Your healthcare request is with the team.') }}</h1>
          <p class="confirm-hero__number">
            {{ t('Request') }} <strong>{{ request.request_number }}</strong>
          </p>
          <div class="confirm-hero__tags">
            <Tag :value="t(titleize(request.status))" :severity="statusSeverity(request.status)" />
            <Tag :value="t(titleize(request.payment_status))" :severity="statusSeverity(request.payment_status)" />
            <Tag :value="isPackage ? t('Package') : t('Consultation')" severity="info" />
          </div>
        </header>

        <div class="confirm-grid">
          <section class="confirm-card soft-panel">
            <h2>{{ t('Request details') }}</h2>
            <dl class="confirm-facts">
              <div v-for="fact in facts" :key="fact.label">
                <dt>{{ t(fact.label) }}</dt>
                <dd>{{ fact.value }}</dd>
              </div>
            </dl>
            <div class="confirm-totals">
              <div class="confirm-totals__grand">
                <span>{{ isPackage ? t('Price') : t('Quote') }}</span>
                <strong>{{ priceLabel }}</strong>
              </div>
            </div>
          </section>

          <section class="confirm-card soft-panel">
            <h2>{{ t('Care team') }}</h2>
            <div v-if="assignments.length" class="team-list">
              <article v-for="assignment in assignments" :key="assignment.id">
                <span>{{ t(titleize(assignment.practitioner_type)) }}</span>
                <strong>{{ assignment.practitioner_name }}</strong>
              </article>
            </div>
            <p v-else class="team-empty">{{ t('A doctor or nurse will be assigned after review.') }}</p>

            <template v-if="isPackage && request.staff && request.staff.length">
              <h3 class="team-subhead">{{ t('This package includes') }}</h3>
              <ul class="team-need">
                <li v-for="line in request.staff" :key="line.practitioner_type">
                  <i class="pi pi-user" /> {{ line.quantity }} × {{ t(titleize(line.practitioner_type)) }}
                </li>
              </ul>
            </template>
          </section>
        </div>

        <section class="confirm-card soft-panel">
          <h2>{{ t('What happens next') }}</h2>
          <ol class="confirm-steps">
            <li v-for="(step, index) in nextSteps" :key="index">
              <i :class="step.icon" />
              <div>
                <strong>{{ t(step.title) }}</strong>
                <p>{{ t(step.text) }}</p>
              </div>
            </li>
          </ol>
        </section>

        <div class="confirm-actions">
          <Button as="router-link" to="/healthcare" :label="t('Browse healthcare')" icon="pi pi-heart" />
          <Button as="router-link" :to="{ name: 'healthcare-request' }" :label="t('New request')" icon="pi pi-plus" severity="secondary" outlined />
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.confirm-page {
  padding: 48px 0 72px;
}

.confirm-page__inner {
  display: grid;
  gap: 24px;
}

.confirm-state {
  display: grid;
  min-height: 320px;
  place-items: center;
  gap: 12px;
  color: var(--tm-muted);
  font-weight: 850;
}

.confirm-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.confirm-state--error i {
  color: var(--tm-coral);
}

.confirm-hero {
  display: grid;
  gap: 8px;
  justify-items: start;
}

.confirm-hero__badge {
  display: grid;
  width: 54px;
  height: 54px;
  place-items: center;
  margin-bottom: 6px;
  border-radius: 999px;
  background: rgba(8, 124, 104, 0.12);
  color: var(--tm-emerald);
  font-size: 1.5rem;
}

.confirm-hero h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2rem, 5vw, 3.6rem);
  line-height: 1;
}

.confirm-hero__number {
  margin: 0;
  color: var(--tm-muted);
  font-weight: 780;
}

.confirm-hero__number strong {
  color: var(--tm-heading);
}

.confirm-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.confirm-grid {
  display: grid;
  align-items: start;
  gap: 20px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.confirm-card {
  display: grid;
  gap: 14px;
  padding: 20px;
}

.confirm-card h2 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.15rem;
}

.confirm-facts {
  display: grid;
  gap: 10px;
  margin: 0;
}

.confirm-facts > div {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--tm-border);
}

.confirm-facts dt {
  color: var(--tm-muted);
  font-size: 0.85rem;
  font-weight: 850;
}

.confirm-facts dd {
  margin: 0;
  color: var(--tm-heading);
  font-weight: 780;
  text-align: right;
}

.confirm-totals__grand {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 1.08rem;
}

.confirm-totals span {
  color: var(--tm-muted);
  font-weight: 800;
}

.confirm-totals strong {
  color: var(--tm-heading);
}

.team-list {
  display: grid;
  gap: 10px;
}

.team-list article {
  display: grid;
  gap: 4px;
  padding: 12px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
}

.team-list span {
  color: var(--tm-gold);
  font-size: 0.76rem;
  font-weight: 900;
  text-transform: uppercase;
}

.team-list strong {
  color: var(--tm-heading);
}

.team-empty {
  margin: 0;
  color: var(--tm-muted);
  font-weight: 760;
}

.team-subhead {
  margin: 6px 0 0;
  color: var(--tm-heading);
  font-size: 0.95rem;
}

.team-need {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.team-need li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tm-muted);
  font-weight: 780;
}

.team-need i {
  color: var(--tm-gold);
}

.confirm-steps {
  display: grid;
  gap: 14px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.confirm-steps li {
  display: grid;
  align-items: start;
  gap: 12px;
  grid-template-columns: auto 1fr;
}

.confirm-steps i {
  margin-top: 3px;
  color: var(--tm-gold);
  font-size: 1.15rem;
}

.confirm-steps strong {
  color: var(--tm-heading);
}

.confirm-steps p {
  margin: 3px 0 0;
  color: var(--tm-muted);
  font-size: 0.92rem;
  line-height: 1.6;
}

.confirm-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

@media (max-width: 880px) {
  .confirm-grid {
    grid-template-columns: 1fr;
  }
}
</style>
