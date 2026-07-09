<script setup>
import { onMounted, reactive, ref } from 'vue';
import { useToast } from 'primevue/usetoast';

import { api } from '@/api/client';
import { useAdminI18n } from '@/i18n/admin';

const toast = useToast();
const { t } = useAdminI18n();

const loading = ref(false);
const saving = ref(false);
const updatedAt = ref(null);

const form = reactive({
  emergency_phone: '',
  emergency_hours: '',
  emergency_note: '',
});

async function load() {
  loading.value = true;
  try {
    const data = await api.get('/admin/healthcare/settings');
    const settings = data?.emergency || {};
    form.emergency_phone = settings.emergency_phone || '';
    form.emergency_hours = settings.emergency_hours || '';
    form.emergency_note = settings.emergency_note || '';
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
  <section class="admin-settings">
    <div class="settings-hero">
      <div>
        <p>{{ t('Healthcare') }}</p>
        <h2>{{ t('Emergency contact') }}</h2>
        <span>{{ t('Shown at the top of the client healthcare page for urgent, non-app situations.') }}</span>
      </div>
    </div>

    <form class="settings-card" @submit.prevent="save">
      <label>
        <span>{{ t('Emergency phone') }}</span>
        <InputText v-model="form.emergency_phone" placeholder="+261 ..." :disabled="loading" />
      </label>
      <label>
        <span>{{ t('Availability hours') }}</span>
        <InputText v-model="form.emergency_hours" placeholder="24/7" :disabled="loading" />
      </label>
      <label class="full">
        <span>{{ t('Guidance note') }}</span>
        <Textarea v-model="form.emergency_note" rows="3" autoResize :disabled="loading" :placeholder="t('Short guidance shown next to the number.')" />
      </label>

      <div class="settings-actions">
        <Button type="submit" :label="t('Save changes')" icon="pi pi-check" :loading="saving" :disabled="loading" />
        <Button type="button" :label="t('Reload')" icon="pi pi-refresh" severity="secondary" outlined :disabled="loading || saving" @click="load" />
      </div>
    </form>
  </section>
</template>

<style scoped>
.admin-settings {
  display: grid;
  gap: 18px;
}

.settings-hero p {
  margin: 0;
  color: var(--tm-gold);
  font-size: 0.78rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.settings-hero h2 {
  margin: 5px 0 0;
  color: var(--tm-heading);
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1;
}

.settings-hero span {
  display: block;
  max-width: 740px;
  margin-top: 10px;
  color: var(--tm-muted);
  line-height: 1.55;
}

.settings-card {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  max-width: 720px;
  padding: 20px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.settings-card label {
  display: grid;
  gap: 7px;
}

.settings-card .full {
  grid-column: 1 / -1;
}

.settings-card label > span {
  color: var(--tm-muted);
  font-size: 0.82rem;
  font-weight: 850;
}

.settings-card :deep(.p-inputtext),
.settings-card :deep(.p-textarea) {
  width: 100%;
}

.settings-actions {
  display: flex;
  grid-column: 1 / -1;
  gap: 10px;
}

@media (max-width: 640px) {
  .settings-card {
    grid-template-columns: 1fr;
  }
}
</style>
