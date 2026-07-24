// A product with no photo falls back to a drawn placeholder (VisualPlaceholder).
// Which drawing appears is picked from the product's category, so a case, a
// headset, a controller and a charger no longer all show the same phone sketch.
//
// The drawings are CSS, not image files: they cost no request, cannot 404, work
// offline, and stay on-brand in both light and dark. Real product photography
// still belongs in product_images, uploaded through the admin image flow — this
// is only what shows until then.

// Categories seeded from the inventory sheets. The slug is the stable key.
const BY_CATEGORY_SLUG = {
  'phone-cases': 'case',
  'screen-protectors': 'screen',
  audio: 'audio',
  gaming: 'gaming',
  'chargers-cables': 'cable',
  'phone-accessories': 'accessory',
  computing: 'mouse',
  wearables: 'watch',
  phones: 'phone',
  coffee: 'coffee',
};

// Fallback for any category the sheets did not create, using the product-type
// template that already drives the department split.
const BY_TEMPLATE_KEY = {
  audio: 'audio',
  accessory: 'accessory',
  screen_protector: 'screen',
  coffee: 'coffee',
  clothing: 'event',
  footwear: 'event',
};

export function visualKindFor(category) {
  if (!category) return 'phone';
  return BY_CATEGORY_SLUG[category.slug]
    || BY_TEMPLATE_KEY[category.template_key]
    || 'phone';
}

export default visualKindFor;
