<script setup>
import { computed, onMounted, ref } from 'vue';

import CardSkeleton from '@/components/CardSkeleton.vue';
import { listArtists } from '@/api/public';
import { usePublicI18n } from '@/i18n/public';
import { formatMGA } from '@/utils/format';

const { content, t } = usePublicI18n();

const artists = ref([]);
const loading = ref(false);
const error = ref('');
const activeGenre = ref('');

function splitTags(value) {
  return (value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

const genreOptions = computed(() => {
  const set = new Set();
  for (const artist of artists.value) {
    for (const genre of splitTags(artist.genres)) {
      set.add(genre);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
});

const visibleArtists = computed(() => {
  if (!activeGenre.value) {
    return artists.value;
  }
  const wanted = activeGenre.value.toLowerCase();
  return artists.value.filter((artist) => splitTags(artist.genres).some((genre) => genre.toLowerCase() === wanted));
});

function feeLabel(artist) {
  if (artist.from_fee === null || artist.from_fee === undefined || artist.from_fee === '') {
    return t('Fee on request');
  }
  return `${t('From')} ${formatMGA(Number(artist.from_fee || 0))}`;
}

function artistTagline(artist) {
  return content(artist, 'tagline') || artist.tagline || '';
}

function setGenre(genre) {
  activeGenre.value = activeGenre.value === genre ? '' : genre;
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    artists.value = await listArtists();
  } catch (err) {
    artists.value = [];
    error.value = err?.message || t('Could not load artists');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="artists-page">
    <div class="app-container">
      <Button as="router-link" to="/events" icon="pi pi-arrow-left" :label="t('Back to events')" severity="secondary" outlined />

      <header class="artists-hero">
        <div>
          <p class="eyebrow">{{ t('Events') }}</p>
          <h1>{{ t('Gospel artists we work with') }}</h1>
          <p>
            {{ t('Meet the Christian artists, worship leaders, choirs, and bands Trimobe partners with — then request them for your event.') }}
          </p>
          <div class="artists-hero__actions">
            <Button as="router-link" to="/events/plan" :label="t('Plan your event')" icon="pi pi-calendar-plus" />
          </div>
        </div>
        <div class="artists-hero__stat soft-panel">
          <span>{{ artists.length }}</span>
          <strong>{{ t('artists') }}</strong>
        </div>
      </header>

      <div v-if="genreOptions.length" class="genre-filter">
        <button type="button" :class="{ 'is-active': !activeGenre }" @click="activeGenre = ''">{{ t('All') }}</button>
        <button
          v-for="genre in genreOptions"
          :key="genre"
          type="button"
          :class="{ 'is-active': activeGenre === genre }"
          @click="setGenre(genre)"
        >
          {{ genre }}
        </button>
      </div>

      <div v-if="error" class="artists-state artists-state--error">
        <i class="pi pi-exclamation-triangle" />
        <span>{{ error }}</span>
        <Button :label="t('Retry')" icon="pi pi-refresh" severity="secondary" outlined @click="load" />
      </div>

      <div v-else-if="loading" class="artists-grid" aria-hidden="true">
        <CardSkeleton v-for="n in 6" :key="n" />
      </div>

      <div v-else-if="visibleArtists.length" class="artists-grid">
        <article v-for="artist in visibleArtists" :key="artist.id" class="artist-card">
          <RouterLink class="artist-card__media" :to="{ name: 'artist-detail', params: { slug: artist.slug } }">
            <img v-if="artist.photo_url" :src="artist.photo_url" :alt="artist.stage_name" loading="lazy" />
            <span v-else class="artist-card__placeholder"><i class="pi pi-microphone" /></span>
            <span v-if="artist.is_featured" class="artist-card__ribbon">{{ t('Featured') }}</span>
          </RouterLink>

          <div class="artist-card__body">
            <div>
              <h3>{{ artist.stage_name }}</h3>
              <p v-if="artistTagline(artist)">{{ artistTagline(artist) }}</p>
              <div v-if="splitTags(artist.genres).length" class="artist-card__tags">
                <span v-for="genre in splitTags(artist.genres).slice(0, 3)" :key="genre">{{ genre }}</span>
              </div>
              <ul class="artist-card__meta">
                <li v-if="artist.group_size"><i class="pi pi-users" />{{ artist.group_size }}</li>
                <li v-if="artist.languages"><i class="pi pi-comments" />{{ splitTags(artist.languages).join(', ') }}</li>
                <li v-if="artist.home_base"><i class="pi pi-map-marker" />{{ artist.home_base }}</li>
              </ul>
            </div>
            <div class="artist-card__footer">
              <strong>{{ feeLabel(artist) }}</strong>
              <Button
                as="router-link"
                :to="{ name: 'artist-detail', params: { slug: artist.slug } }"
                :label="t('View')"
                icon="pi pi-arrow-right"
                size="small"
                outlined
              />
            </div>
          </div>
        </article>
      </div>

      <div v-else class="artists-state">
        <i class="pi pi-microphone" />
        <span>{{ t('No artists to show yet.') }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.artists-page {
  padding: 34px 0 72px;
}

.artists-hero {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 28px;
  margin: 26px 0 20px;
}

.artists-hero h1 {
  max-width: 820px;
  margin: 0;
  color: var(--tm-heading);
  font-size: clamp(2.3rem, 6vw, 5rem);
  line-height: 0.94;
}

.artists-hero p:not(.eyebrow) {
  max-width: 700px;
  color: var(--tm-muted);
  line-height: 1.65;
}

.artists-hero__actions {
  margin-top: 22px;
}

.artists-hero__stat {
  display: grid;
  min-width: 180px;
  gap: 4px;
  padding: 18px;
}

.artists-hero__stat span {
  color: var(--tm-heading);
  font-size: 2rem;
  font-weight: 950;
}

.artists-hero__stat strong {
  color: var(--tm-muted);
  text-transform: uppercase;
}

.genre-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 22px;
}

.genre-filter button {
  padding: 8px 14px;
  border: 1px solid var(--tm-border);
  border-radius: 999px;
  background: var(--tm-surface);
  color: var(--tm-muted);
  cursor: pointer;
  font-weight: 800;
  font-size: 0.86rem;
}

.genre-filter button.is-active {
  border-color: var(--tm-emerald);
  background: rgba(8, 124, 104, 0.1);
  color: var(--tm-heading);
}

.artists-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.artist-card {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  box-shadow: var(--tm-shadow);
}

.artist-card__media {
  position: relative;
  display: block;
  min-height: 220px;
  background: var(--tm-surface-soft);
}

.artist-card__media img {
  width: 100%;
  height: 100%;
  min-height: 220px;
  object-fit: cover;
}

.artist-card__placeholder {
  display: grid;
  min-height: 220px;
  place-items: center;
  background:
    linear-gradient(135deg, rgba(49, 92, 112, 0.16), rgba(185, 138, 46, 0.12)),
    var(--tm-surface-soft);
}

.artist-card__placeholder i {
  display: grid;
  width: 72px;
  height: 72px;
  place-items: center;
  border-radius: 999px;
  background: var(--tm-charcoal);
  color: var(--tm-gold);
  font-size: 1.9rem;
}

.artist-card__ribbon {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--tm-gold);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.artist-card__body {
  display: grid;
  gap: 16px;
  padding: 18px;
}

.artist-card h3 {
  margin: 0;
  color: var(--tm-heading);
  font-size: 1.2rem;
}

.artist-card__body p {
  margin: 6px 0 0;
  color: var(--tm-muted);
  line-height: 1.5;
}

.artist-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.artist-card__tags span {
  padding: 3px 9px;
  border-radius: 999px;
  background: rgba(185, 138, 46, 0.12);
  color: var(--tm-gold);
  font-size: 0.74rem;
  font-weight: 850;
}

.artist-card__meta {
  display: grid;
  gap: 6px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
}

.artist-card__meta li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tm-muted);
  font-size: 0.86rem;
  font-weight: 720;
}

.artist-card__meta i {
  color: var(--tm-gold);
}

.artist-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.artist-card__footer strong {
  color: var(--tm-heading);
  font-size: 0.94rem;
}

.artists-state {
  display: grid;
  min-height: 300px;
  place-items: center;
  gap: 10px;
  padding: 34px;
  border: 1px solid var(--tm-border);
  border-radius: 8px;
  background: var(--tm-surface);
  color: var(--tm-muted);
  font-weight: 850;
  text-align: center;
}

.artists-state i {
  color: var(--tm-gold);
  font-size: 1.6rem;
}

.artists-state--error i {
  color: var(--tm-coral);
}

@media (max-width: 980px) {
  .artists-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .artists-hero {
    align-items: stretch;
    flex-direction: column;
  }

  .artists-grid {
    grid-template-columns: 1fr;
  }

  .artists-hero__actions .p-button {
    width: 100%;
  }
}
</style>
