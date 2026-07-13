export const CONTENT_LOCALES = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
];

export function parseTranslations(raw) {
  if (!raw) {
    return {};
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? raw : {};
}

export function cloneTranslations(raw) {
  return JSON.parse(JSON.stringify(parseTranslations(raw)));
}

export function ensureTranslationBucket(translations, fieldKey) {
  if (!translations[fieldKey] || typeof translations[fieldKey] !== 'object') {
    translations[fieldKey] = {};
  }
  return translations[fieldKey];
}

export function cleanTranslations(raw, allowedKeys = null) {
  const parsed = parseTranslations(raw);
  const allowed = Array.isArray(allowedKeys) && allowedKeys.length ? new Set(allowedKeys) : null;
  const out = {};

  for (const [fieldKey, bucket] of Object.entries(parsed)) {
    if (allowed && !allowed.has(fieldKey)) {
      continue;
    }
    if (!bucket || typeof bucket !== 'object') {
      continue;
    }

    const cleanBucket = {};
    for (const locale of CONTENT_LOCALES) {
      const value = bucket[locale.code];
      const trimmed = typeof value === 'string' ? value.trim() : '';
      if (trimmed) {
        cleanBucket[locale.code] = trimmed;
      }
    }
    if (Object.keys(cleanBucket).length) {
      out[fieldKey] = cleanBucket;
    }
  }

  return out;
}

export function localizedValue(record, fieldKey, language = 'en', fallbackLanguage = 'en') {
  const translations = parseTranslations(record?.translations);
  const bucket = translations[fieldKey] || {};
  const current = typeof bucket[language] === 'string' ? bucket[language].trim() : '';
  if (current) {
    return current;
  }

  const fallback = typeof bucket[fallbackLanguage] === 'string' ? bucket[fallbackLanguage].trim() : '';
  if (fallback) {
    return fallback;
  }

  const base = record?.[fieldKey];
  if (base !== null && base !== undefined && base !== '') {
    return base;
  }

  for (const locale of CONTENT_LOCALES) {
    const value = typeof bucket[locale.code] === 'string' ? bucket[locale.code].trim() : '';
    if (value) {
      return value;
    }
  }
  return '';
}
