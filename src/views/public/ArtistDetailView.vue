<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { getArtist } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA, setPageTitle } from '@/utils/format';

const route = useRoute();
const { t } = usePublicI18n();

const artist = ref(null);
const loading = ref(false);
const error = ref('');

function splitTags(value) {
  return (value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitLinks(value) {
  return (value || '')
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter((part) => /^https?:\/\//i.test(part));
}

function linkLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('youtu')) return 'YouTube';
    if (host.includes('spotify')) return 'Spotify';
    if (host.includes('facebook') || host.includes('fb.')) return 'Facebook';
    if (host.includes('instagram')) return 'Instagram';
    return host;
  } catch {
    return t('Open link');
  }
}

const tagGroups = computed(() => {
  const a = artist.value;
  if (!a) {
    return [];
  }
  return [
    { label: t('Genres'), items: splitTags(a.genres) },
    { label: t('Formats'), items: splitTags(a.formats) },
    { label: t('Languages'), items: splitTags(a.languages) },
    { label: t('Best for'), items: splitTags(a.occasions) },
  ].filter((group) => group.items.length);
});

const sampleLinks = computed(() => splitLinks(artist.value?.sample_links));
const socialLinks = computed(() => splitLinks(artist.value?.social_links));

const feeLabel = computed(() => {
  const fee = artist.value?.from_fee;
  if (fee === null || fee === undefined || fee === '') {
    return t('Fee on request');
  }
  return `${t('From')} ${formatMGA(Number(fee || 0))}`;
});

const requestTo = computed(() => ({ name: 'event-plan', query: { artist: artist.value?.slug } }));

async function load() {
  loading.value = true;
  error.value = '';
  try {
    artist.value = await getArtist(route.params.slug);
    setPageTitle(artist.value?.stage_name);
  } catch (err) {
    artist.value = null;
    error.value = err?.message || t('Could not load artist');
  } finally {
    loading.value = false;
  }
}

watch(() => route.params.slug, load);
onMounted(load);
</script>

<template>
  <section class="artist-page">
    <div class="app-container">
      <div v-if="loading" class="artist-detail" aria-hidden="true">
        <Skeleton height="460px" borderRadius="8px" />
        <div class="detail-skeleton">
          <Skeleton width="30%" height="0.9rem" />
          <Skeleton width="80%" height="2.8rem" />
          <Skeleton width="100%" height="4rem" />
          <Skeleton width="100%" height="200px" borderRadius="8px" />
        </div>
      </div>

      <div v-else-if="error" class="artist-state artist-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button as="router-link" to="/events/artists" :label="t('Back to artists')" icon="pi pi-arrow-left" severity="secondary" outlined />
      </div>

      <template v-else-if="artist">
        <Button as="router-link" to="/events/artists" icon="pi pi-arrow-left" :label="t('Back to artists')" severity="secondary" outlined />

        <section class="artist-detail">
          <div class="artist-media">
            <figure v-if="artist.photo_url" class="artist-media__hero">
              <img :src="artist.photo_url" :alt="artist.stage_name" />
            </figure>
            <div v-else class="artist-media__placeholder">
              <i class="pi pi-microphone" />
            </div>
          </div>

          <div class="artist-info">
            <p class="eyebrow">{{ artist.is_featured ? t('Featured artist') : t('Gospel artist') }}</p>
            <h1>{{ artist.stage_name }}</h1>
            <p v-if="artist.tagline" class="artist-info__tagline">{{ artist.tagline }}</p>

            <ul class="artist-info__facts">
              <li v-if="artist.group_size"><i class="pi pi-users" />{{ artist.group_size }}</li>
              <li v-if="artist.home_base"><i class="pi pi-map-marker" />{{ artist.home_base }}</li>
              <li><i class="pi pi-wallet" />{{ feeLabel }}</li>
            </ul>

            <section class="request-panel soft-panel">
              <div>
                <strong>{{ t('Want this artist at your event?') }}</strong>
                <small>{{ t('Add them to a planning request and our team sends a tailored quote.') }}</small>
              </div>
              <Button as="router-link" :to="requestTo" :label="t('Request this artist')" icon="pi pi-calendar-plus" />
            </section>

            <div v-if="tagGroups.length" class="artist-tags">
              <div v-for="group in tagGroups" :key="group.label" class="artist-tags__group">
                <span class="artist-tags__label">{{ group.label }}</span>
                <div class="artist-tags__items">
                  <span v-for="item in group.items" :key="item">{{ item }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="artist.bio" class="artist-block">
          <h2 class="section-title">{{ t('About') }}</h2>
          <p class="artist-bio">{{ artist.bio }}</p>
        </section>

        <section v-if="sampleLinks.length" class="artist-block">
          <h2 class="section-title">{{ t('Listen & watch') }}</h2>
          <div class="link-row">
            <a v-for="url in sampleLinks" :key="url" :href="url" target="_blank" rel="noopener noreferrer" class="link-chip">
              <i class="pi pi-play-circle" />{{ linkLabel(url) }}
            </a>
          </div>
        </section>

        <section v-if="socialLinks.length" class="artist-block">
          <h2 class="section-title">{{ t('Follow') }}</h2>
          <div class="link-row">
            <a v-for="url in socialLinks" :key="url" :href="url" target="_blank" rel="noopener noreferrer" class="link-chip">
              <i class="pi pi-external-link" />{{ linkLabel(url) }}
            </a>
          </div>
        </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.artist-page {
  padding: 34px 0 64px;
}

.artist-state {
  display: grid;
  min-height: 360px;
  place-items: center;
  gap: 10px;
  color: var(--tm-muted);
  font-weight: 850;
}

.artist-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.artist-state--error i {
  color: var(--tm-coral);
}

.detail-skeleton {
  display: grid;
  align-content: start;
  gap: 16px;
}

.artist-detail {
  display: grid;
  gap: 28px;
  margin-top: 18px;
  grid-template-columns: minmax(0, 0.9fr) minmax(360px, 1fr);
  align-items: start;
}

.artist-media__hero {
  min-height: 460px;
  margin: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface-soft);
  box-shadow: var(--tm-shadow);
}

.artist-media__hero img {
  width: 100%;
  height: 100%;
  min-height: 460px;
  object-fit: cover;
}

.artist-media__placeholder {
  display: grid;
  min-height: 460px;
  place-items: center;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background:
    linear-gradient(135deg, rgba(49, 92, 112, 0.16), rgba(185, 138, 46, 0.12)),
    var(--tm-surface-soft);
}

.artist-media__placeholder i {
  display: grid;
  width: 96px;
  height: 96px;
  place-items: center;
  border-radius: 999px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  font-size: 2.6rem;
}

.artist-info {
  display: grid;
  gap: 16px;
}

.artist-info h1 {
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.2rem, 5vw, 4rem);
  line-height: 0.98;
}

.artist-info__tagline {
  margin: 0;
  color: var(--tm-muted);
  font-size: 1.05rem;
  line-height: 1.6;
}

.artist-info__facts {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.artist-info__facts li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tm-heading);
  font-weight: 800;
}

.artist-info__facts i {
  color: var(--tm-gold);
}

.request-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px;
}

.request-panel strong {
  display: block;
  color: var(--tm-heading);
  font-size: 1.05rem;
}

.request-panel small {
  display: block;
  margin-top: 4px;
  color: var(--tm-muted);
  font-weight: 720;
}

.artist-tags {
  display: grid;
  gap: 14px;
}

.artist-tags__label {
  display: block;
  margin-bottom: 6px;
  color: var(--tm-muted);
  font-size: 0.78rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.artist-tags__items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.artist-tags__items span {
  padding: 5px 11px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  background: var(--tm-surface);
  color: var(--tm-heading);
  font-size: 0.84rem;
  font-weight: 780;
}

.artist-block {
  margin-top: 44px;
}

.artist-bio {
  max-width: 820px;
  color: var(--tm-muted);
  line-height: 1.75;
}

.link-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.link-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 1px solid var(--tm-border-strong);
  border-radius: 999px;
  background: var(--tm-surface-soft);
  color: var(--tm-heading);
  font-weight: 820;
}

.link-chip:hover {
  border-color: var(--tm-emerald);
}

.link-chip i {
  color: var(--tm-gold);
}

@media (max-width: 980px) {
  .artist-detail {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .artist-media__hero,
  .artist-media__hero img,
  .artist-media__placeholder {
    min-height: 320px;
  }

  .request-panel {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
