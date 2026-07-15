<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';

import HealthcareWorkspaceNav from '@/components/admin/HealthcareWorkspaceNav.vue';
import LocalizedFieldControl from '@/components/admin/LocalizedFieldControl.vue';
import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';
import { formatDateTime } from '@/utils/format';
import { cleanTranslations, cloneTranslations, ensureTranslationBucket } from '@/utils/localized';

const toast = useToast();
const { localeCode, t } = useAdminI18n();

const loading = ref(false);
const saving = ref(false);
const updatedAt = ref(null);

const form = reactive({
  emergency_phone: '',
  emergency_hours: '',
  emergency_note: '',
  translations: {},
});

const emergencyHoursField = {
  key: 'emergency_hours',
  label: 'Availability hours',
  type: 'text',
  placeholder: '24/7',
};
const emergencyNoteField = {
  key: 'emergency_note',
  label: 'Guidance note',
  type: 'textarea',
  placeholder: 'Short guidance shown next to the number.',
};

const updatedLabel = computed(() => (
  updatedAt.value ? formatDateTime(updatedAt.value, localeCode.value) : t('Not saved yet')
));

const isConfigured = computed(() => Boolean(form.emergency_phone.trim()));

function resetTranslations(raw) {
  form.translations = cloneTranslations(raw);
  ensureTranslationBucket(form.translations, 'emergency_hours');
  ensureTranslationBucket(form.translations, 'emergency_note');
}

function setTranslation({ field, locale, value }) {
  ensureTranslationBucket(form.translations, field)[locale] = value;
}

async function load() {
  loading.value = true;
  try {
    const data = await api.get('/admin/healthcare/settings');
    const settings = data?.emergency || {};
    form.emergency_phone = settings.emergency_phone || '';
    form.emergency_hours = settings.emergency_hours || '';
    form.emergency_note = settings.emergency_note || '';
    resetTranslations(settings.translations);
    updatedAt.value = settings.updated_at || null;
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Could not load'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const data = await api.put('/admin/healthcare/settings', {
      emergency_phone: form.emergency_phone.trim() || null,
      emergency_hours: form.emergency_hours.trim() || null,
      emergency_note: form.emergency_note.trim() || null,
      translations: cleanTranslations(form.translations, ['emergency_hours', 'emergency_note']),
    });
    const settings = data?.emergency || {};
    updatedAt.value = settings.updated_at || null;
    toast.add({ severity: 'success', summary: t('Changes saved'), life: 2500 });
  } catch (err) {
    toast.add({ severity: 'error', summary: t('Save failed'), detail: t(err?.message || 'Request failed'), life: 4000 });
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="care-settings">
    <HealthcareWorkspaceNav />

    <header class="settings-hero">
      <div class="settings-hero__copy">
        <p>{{ t('Patient safety') }}</p>
        <h2>{{ t('Keep the emergency line impossible to miss.') }}</h2>
        <span>{{ t('Maintain the phone number, availability, and urgent-care guidance shown at the top of the client healthcare page.') }}</span>
      </div>
      <div class="settings-hero__actions">
        <Button as="router-link" to="/healthcare" :label="t('View healthcare page')" icon="pi pi-external-link" severity="secondary" outlined />
        <Button :label="t('Reload')" icon="pi pi-refresh" severity="secondary" outlined :loading="loading" :disabled="saving" @click="load" />
      </div>
    </header>

    <div class="settings-layout">
      <aside class="emergency-preview">
        <div class="emergency-preview__head">
          <span><i class="pi pi-phone" /></span>
          <div><p>{{ t('Client preview') }}</p><h3>{{ t('Emergency contact') }}</h3></div>
          <Tag :value="isConfigured ? t('Configured') : t('Needs setup')" :severity="isConfigured ? 'success' : 'warn'" />
        </div>
        <div class="emergency-preview__line">
          <small>{{ t('Emergency phone') }}</small>
          <strong>{{ form.emergency_phone || t('No phone configured') }}</strong>
          <span>{{ form.emergency_hours || t('Hours not configured') }}</span>
        </div>
        <p class="emergency-preview__note">{{ form.emergency_note || t('Your urgent-care guidance will appear here.') }}</p>
        <div class="safety-note">
          <i class="pi pi-info-circle" />
          <span>{{ t('This contact is for urgent situations outside the normal request workflow. Keep the wording short and actionable.') }}</span>
        </div>
      </aside>

      <form class="settings-card" @submit.prevent="save">
        <div class="settings-card__head">
          <span><i class="pi pi-file-edit" /></span>
          <div><p>{{ t('Client-facing details') }}</p><h3>{{ t('Emergency line content') }}</h3></div>
        </div>

        <label>
          <span>{{ t('Emergency phone') }}</span>
          <InputText v-model="form.emergency_phone" placeholder="+261 ..." :disabled="loading" />
          <small>{{ t('Use the complete number clients should call immediately.') }}</small>
        </label>
        <label>
          <span>{{ t('Availability hours') }}</span>
          <LocalizedFieldControl
            v-model="form.emergency_hours"
            :field="emergencyHoursField"
            :translations="form.translations"
            @update:translation="setTranslation"
          />
        </label>
        <label>
          <span>{{ t('Guidance note') }}</span>
          <LocalizedFieldControl
            v-model="form.emergency_note"
            :field="emergencyNoteField"
            :translations="form.translations"
            @update:translation="setTranslation"
          />
        </label>

        <div class="settings-actions">
          <span>{{ t('Last saved') }} · {{ updatedLabel }}</span>
          <Button type="submit" :label="t('Save emergency contact')" icon="pi pi-check" :loading="saving" :disabled="loading" />
        </div>
      </form>
    </div>
  </section>
</template>

<style scoped>
.care-settings { display: grid; gap: 18px; }
.settings-hero { position: relative; display: grid; grid-template-columns: minmax(0,1fr) auto; align-items: end; gap: 24px; overflow: hidden; padding: clamp(24px,4vw,36px); border: 1px solid rgba(255,255,255,.08); border-radius: 24px; background: radial-gradient(circle at 90% -20%, rgba(192,90,125,.48), transparent 40%), linear-gradient(135deg,var(--tm-charcoal),#302126); box-shadow: var(--tm-shadow); }
.settings-hero::after { position: absolute; right: -80px; bottom: -160px; width: 300px; height: 300px; border: 1px solid rgba(239,157,184,.25); border-radius: 50%; content: ''; }
.settings-hero__copy, .settings-hero__actions { position: relative; z-index: 1; }
.settings-hero p, .emergency-preview__head p, .settings-card__head p { margin: 0; color: #ef9db8; font-size: .72rem; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
.settings-hero h2 { max-width: 720px; margin: 8px 0 9px; color: #fff8ed; font-size: clamp(2rem,4vw,3.45rem); letter-spacing: -.045em; line-height: .98; }
.settings-hero__copy > span { display: block; max-width: 760px; color: rgba(255,255,255,.66); line-height: 1.55; }
.settings-hero__actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 9px; } .settings-hero__actions :deep(.p-button) { border-color: rgba(255,255,255,.2); color: #fff; }
.settings-layout { display: grid; align-items: start; gap: 16px; grid-template-columns: minmax(290px,.72fr) minmax(0,1.28fr); }
.emergency-preview, .settings-card { display: grid; gap: 18px; padding: 20px; border: 1px solid var(--tm-border); border-radius: 18px; background: var(--tm-surface); box-shadow: 0 12px 34px rgba(37,31,20,.055); }
.emergency-preview { position: sticky; top: 18px; background: radial-gradient(circle at 100% 0%,rgba(192,90,125,.12),transparent 46%),var(--tm-surface); }
.emergency-preview__head, .settings-card__head { display: flex; align-items: center; gap: 12px; } .emergency-preview__head > span, .settings-card__head > span { display: grid; width: 42px; height: 42px; flex: 0 0 auto; border-radius: 13px; background: #c05a7d; color: #fff; place-items: center; } .emergency-preview__head > div, .settings-card__head > div { min-width: 0; flex: 1; } .emergency-preview__head h3, .settings-card__head h3 { margin: 3px 0 0; color: var(--tm-heading); font-size: 1.08rem; }
.emergency-preview__line { display: grid; gap: 5px; padding: 18px; border: 1px solid rgba(192,90,125,.22); border-radius: 16px; background: rgba(192,90,125,.07); } .emergency-preview__line small { color: #a74466; font-weight: 850; } .emergency-preview__line strong { color: var(--tm-heading); font-size: clamp(1.5rem,3vw,2.2rem); letter-spacing: -.035em; overflow-wrap: anywhere; } .emergency-preview__line span { color: var(--tm-muted); font-weight: 760; }
.emergency-preview__note { min-height: 72px; margin: 0; color: var(--tm-heading); line-height: 1.6; white-space: pre-wrap; }
.safety-note { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: 13px; background: var(--tm-surface-soft); color: var(--tm-muted); font-size: .8rem; font-weight: 720; line-height: 1.5; } .safety-note i { margin-top: 2px; color: var(--tm-gold); }
.settings-card label { display: grid; gap: 7px; } .settings-card label > span { color: var(--tm-heading); font-size: .84rem; font-weight: 850; } .settings-card label > small { color: var(--tm-muted); font-size: .75rem; line-height: 1.45; } .settings-card :deep(.p-inputtext), .settings-card :deep(.p-textarea) { width: 100%; }
.settings-actions { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding-top: 16px; border-top: 1px solid var(--tm-border); } .settings-actions > span { color: var(--tm-muted); font-size: .78rem; font-weight: 750; }
@media (max-width: 920px) { .settings-hero, .settings-layout { grid-template-columns: 1fr; } .settings-hero__actions { justify-content: flex-start; } .emergency-preview { position: static; } }
@media (max-width: 640px) { .settings-hero__actions, .settings-actions { align-items: stretch; flex-direction: column; } }
</style>
