# Trimobe frontend redesign concepts

Generated with the built-in image generation workflow after reviewing the live Vue frontend, its routes, public service pages, brand mark, theme variables, and service content.

## Recommended concepts

- `trimobe-redesign-home-desktop-final.png` — desktop homepage, 1536 × 1024
- `trimobe-redesign-services-desktop.png` — desktop service-discovery page, 1536 × 1024
- `trimobe-redesign-home-mobile-final.png` — responsive mobile homepage, 852 × 1846

The two files without `-final` are retained first-pass iterations. The final homepage versions replace unsupported card-network logos with the platform's actual manual payment methods: cash, bank transfer, and mobile money.

## Design direction

- Keep the existing Trimobe baobab identity and brand palette, but move from a heavy dark editorial shell to a warmer, more human premium interface.
- Present Phones & accessories, Cars with driver, Event planning, and Healthcare at home as the four primary service doors.
- Treat Fashion and Coffee as shop/catalog departments rather than mixing them into the primary service story.
- Use warm ivory surfaces, deep charcoal typography, emerald actions, gold editorial accents, restrained coral for healthcare urgency, and subtle Malagasy woven geometry.
- Replace empty or low-contrast visual panels with real service imagery and clearer task-oriented calls to action.
- Keep payment language aligned with the current offline-first workflow.

## Prompt set

### Desktop homepage

```text
Use case: ui-mockup
Asset type: high-fidelity desktop website redesign concept, full homepage viewport, 16:10 landscape
Input images: the recent Trimobe homepage, Healthcare page, and Events page screenshots are reference images for the real brand, services, content density, and existing logo; redesign the interface rather than copying its layout.
Primary request: create a polished, realistic, production-ready homepage UI mockup for TRIMOBE Madagascar, a multiservice platform covering phones and accessories, cars with driver, event planning, and home healthcare. Make it significantly more attractive, welcoming, and premium while remaining credible for a real Vue ecommerce/service website.
Scene/backdrop: warm ivory editorial background with very subtle Malagasy woven-pattern geometry, generous whitespace, soft surface layers, no browser chrome.
Style/medium: realistic modern web product UI, editorial African luxury without clichés, crisp responsive grid, sophisticated but approachable, not concept art.
Composition/framing: full-width desktop page at approximately 1440px; compact sticky navigation; hero split 55/45; left side has strong message and CTAs; right side has an elegant layered visual collage showing a premium smartphone, a chauffeured SUV, a refined event stage, and a home-care doctor/nurse moment. Below the hero, show four large service cards and a slim trust/payment strip.
Color palette: charcoal #101416, warm ivory #F7F2E7, paper white, emerald #0C9B80, gold #C9922C, restrained coral accent #CE6B55.
Typography: distinctive modern grotesk display headings paired with clean sans-serif body; high contrast and excellent readability.
Text (verbatim): "TRIMOBE"; "Madagascar"; "Shop"; "Cars"; "Events"; "Healthcare"; "Orders"; "Everything you need, one trusted team."; "Shop, move, celebrate, and care — across Madagascar."; "Explore services"; "Talk to our team"; "Phones & accessories"; "Cars with driver"; "Event planning"; "Healthcare at home"; "Cash · Transfer · Mobile money"; "Prices in Ariary"
Brand details: preserve the small baobab-inspired Trimobe identity from the references in a refined way; use it only in the header brand mark.
Constraints: practical shippable interface; clear hierarchy; real usable controls; consistent 20-24px rounded cards, subtle shadows, accessible contrast; exactly four primary service cards; no fake analytics dashboard; no unrelated services; no device frame; no watermark; render all requested text accurately and do not add random copy.
Avoid: generic purple SaaS gradients, excessive glassmorphism, neon, tourist motifs, flags, clutter, illegible tiny text, dark empty hero panels, oversized heading that overwhelms the screen.
```

Final correction:

```text
Use case: precise-object-edit
Asset type: desktop website redesign mockup correction
Input images: Image 1 is the edit target.
Primary request: change only the bottom trust/payment strip. Remove the VISA, Mastercard, and MVola logos completely. Replace that logo cluster with three small neutral, original outline icons and plain labels for the supported manual payment methods: "Cash", "Bank transfer", and "Mobile money". Keep "Prices in Ariary".
Constraints: preserve every other pixel-level design decision as closely as possible: header, Trimobe brand mark, hero typography and text, photo collage, buttons, service cards, colors, spacing, shadows, and full composition must remain unchanged. Do not add any card-network logos, trademarks, or new payment methods. No watermark.
```

### Desktop service discovery

```text
Use case: ui-mockup
Asset type: high-fidelity desktop "Explore services" page for the same TRIMOBE redesign system, full webpage viewport, 16:10 landscape
Input images: Image 1 is the newly generated Trimobe homepage redesign and is the strict visual-system reference. Preserve its brand mark treatment, typography, warm ivory/charcoal/emerald/gold palette, spacing rhythm, rounded geometry, icon style, and premium editorial character.
Primary request: design the next screen users see after clicking "Explore services". It should help customers immediately choose between Trimobe's four core domains and understand the transaction type of each service.
Style/medium: realistic production-ready web UI, not concept art, no browser chrome.
Composition/framing: same compact header as Image 1. Page hero contains a small gold eyebrow, a clear heading, short body copy, and a compact search field. Main content is a sophisticated asymmetric editorial grid of exactly four large service cards. Each card combines one strong human/product image, a category number, concise title, short description, one trust/detail chip, and a clear arrow action. Make the cards visually distinct yet cohesive:
1) Phones & accessories — premium phone and audio product, "Shop from 50 000 MGA"
2) Cars with driver — clean chauffeured SUV scene in Madagascar, "Driver included"
3) Event planning — refined stage, lighting, catering, and people celebrating, "Quote by request"
4) Healthcare at home — Malagasy doctor or nurse warmly visiting a patient at home, "Emergency line 24/7"
Below the grid, include a clean horizontal "How Trimobe works" strip with three numbered steps: Browse freely, Request or reserve, Pay with the team.
Color palette: same as Image 1: charcoal #101416, warm ivory #F7F2E7, white, emerald #0C9B80, gold #C9922C, minimal coral for healthcare emergency.
Text (verbatim): "TRIMOBE"; "Madagascar"; "Shop"; "Cars"; "Events"; "Healthcare"; "Orders"; "Explore Trimobe"; "One place. Four ways we help."; "What do you need today?"; "Search services"; "01"; "Phones & accessories"; "Shop from 50 000 MGA"; "02"; "Cars with driver"; "Driver included"; "03"; "Event planning"; "Quote by request"; "04"; "Healthcare at home"; "Emergency line 24/7"; "How Trimobe works"; "Browse freely"; "Request or reserve"; "Pay with the team"
Constraints: shippable interface, accessible contrast, clear service hierarchy, exact four core service cards, real usable controls, consistent with Image 1, no extra industries, no random statistics, no fake dashboard, no unrelated logos, no watermark, render requested text accurately.
Avoid: duplicated cards, generic purple SaaS styling, excessive gradients, excessive glassmorphism, dark empty areas, clutter, tourist clichés, tiny illegible copy.
```

### Mobile homepage

```text
Use case: ui-mockup
Asset type: high-fidelity mobile homepage redesign for TRIMOBE Madagascar, portrait smartphone screen
Input images: Images 1 and 2 are the newly generated desktop homepage and service-discovery page. Use them as the strict design-system references for brand mark, typography, palette, photography, iconography, spacing, and rounded-card language.
Primary request: translate the same premium Trimobe redesign into a genuinely practical mobile homepage at approximately 390x844 proportions. It must look like a shippable responsive Vue interface, not a desktop page squeezed into a phone and not a device mockup.
Composition/framing: show the mobile web screen itself edge-to-edge with no phone hardware. Compact top bar with Trimobe mark/name, language "FR", cart icon, and menu button. Hero should be concise and immediately useful: gold eyebrow, bold headline, one-sentence value proposition, primary emerald CTA, secondary contact action. Under it place one refined editorial collage card that clearly represents smartphone shopping, chauffeured car service, event planning, and home healthcare without becoming busy. Then show a "What do you need?" heading and four tappable service tiles in a clean 2x2 grid, followed by a compact trust/payment strip at the bottom. All tap targets should look reachable and accessible.
Color palette: charcoal #101416, warm ivory #F7F2E7, white, emerald #0C9B80, gold #C9922C, restrained coral for healthcare.
Typography: same confident modern grotesk display and clean sans-serif as the references, optimized for mobile.
Text (verbatim): "TRIMOBE"; "Madagascar"; "FR"; "Everything you need. One trusted team."; "Shop, move, celebrate, and care — across Madagascar."; "Explore services"; "Call us"; "What do you need?"; "Phones"; "Cars"; "Events"; "Healthcare"; "Cash · Transfer · Mobile money"; "Prices in Ariary"
Constraints: exactly four service tiles; no horizontal overflow; no tiny desktop navigation links; no fake browser chrome; no device frame; realistic usable mobile controls; visual consistency with reference images; no unrelated services or logos; no watermark; render requested text accurately.
Avoid: cramped layout, generic app-dashboard look, bottom navigation bar unless essential, purple gradients, neon, excessive glassmorphism, tourist clichés, illegible copy, repeated imagery.
```

Final correction:

```text
Use case: precise-object-edit
Asset type: mobile website redesign mockup correction
Input images: Image 1 is the edit target.
Primary request: change only the compact payment/trust panel at the bottom. Remove the VISA, Mastercard, and MVola logos completely. Replace the logo row with three small neutral, original outline icons and plain labels: "Cash", "Bank transfer", and "Mobile money". Keep "Prices in Ariary".
Constraints: preserve every other design element as closely as possible: mobile header, Trimobe mark and name, hero text, CTAs, four-image collage, "What do you need?" title, exactly four service tiles, typography, colors, spacing, rounded corners, and portrait composition. Do not add card-network logos, trademarks, or new payment methods. No watermark.
```

## Integrated Healthcare asset

The implementation uses `src/assets/redesign/service-healthcare.webp`, generated with the built-in image workflow and optimized locally for the web. The original generation prompt was:

```text
Use case: photorealistic-natural
Asset type: responsive website hero and service-card photography for Trimobe Madagascar healthcare
Primary request: a warm, credible home healthcare visit in Madagascar
Scene/backdrop: a contemporary, tidy Malagasy home interior with warm ivory walls, subtle natural materials, and soft daylight from a nearby window
Subject: a Malagasy woman doctor in a clean white coat sitting beside an older Malagasy woman patient, speaking reassuringly and gently checking her wellbeing; both are relaxed, dignified, and naturally engaged with one another
Style/medium: premium photorealistic editorial lifestyle photography, authentic skin texture and fabric detail, sophisticated but unstaged
Composition/framing: landscape 3:2 medium shot with both people clearly visible, faces and hands natural, useful crop-safe margins for responsive website cards
Lighting/mood: soft warm morning daylight, calm, trusted, humane, optimistic
Color palette: warm ivory, natural skin tones, muted emerald detail, restrained charcoal
Constraints: no text, no logos, no watermark, no visible brand names, no emergency situation, no hospital room, no medical procedure, no extra people, no distorted hands, no exaggerated smiles
Avoid: generic stock-photo stiffness, clinical blue lighting, luxury mansion, tourist motifs, flags, stereotypes, over-retouching
```
