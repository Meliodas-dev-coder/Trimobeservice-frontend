<script setup>
defineProps({
  kind: {
    type: String,
    default: 'phone',
  },
  tone: {
    type: String,
    default: 'emerald',
  },
});
</script>

<template>
  <div class="visual" :class="[`visual--${kind}`, `visual--${tone}`]" aria-hidden="true">
    <div v-if="kind === 'phone'" class="phone-stack">
      <span class="phone phone--back" />
      <span class="phone phone--front" />
      <span class="accessory-dot" />
    </div>
    <div v-else-if="kind === 'coffee'" class="coffee-shape">
      <span class="coffee-bag" />
      <span class="coffee-label" />
      <span class="coffee-cup" />
      <span class="coffee-bean coffee-bean--one" />
      <span class="coffee-bean coffee-bean--two" />
    </div>
    <div v-else-if="kind === 'event'" class="event-shape">
      <span class="event-stage" />
      <span class="event-light event-light--left" />
      <span class="event-light event-light--right" />
      <span class="event-speaker event-speaker--left" />
      <span class="event-speaker event-speaker--right" />
      <span class="event-star" />
    </div>
    <div v-else-if="kind === 'case'" class="case-shape">
      <span class="case-shell" />
      <span class="case-phone" />
      <span class="case-lens" />
    </div>
    <div v-else-if="kind === 'screen'" class="screen-shape">
      <span class="screen-phone" />
      <span class="screen-film" />
      <span class="screen-shine" />
    </div>
    <div v-else-if="kind === 'audio'" class="audio-shape">
      <span class="audio-band" />
      <span class="audio-cup audio-cup--left" />
      <span class="audio-cup audio-cup--right" />
    </div>
    <div v-else-if="kind === 'gaming'" class="pad-shape">
      <span class="pad-body" />
      <span class="pad-stick pad-stick--left" />
      <span class="pad-stick pad-stick--right" />
      <span class="pad-dot" />
    </div>
    <div v-else-if="kind === 'cable'" class="plug-shape">
      <span class="plug-brick" />
      <span class="plug-pins" />
      <span class="plug-cable" />
      <span class="plug-tip" />
    </div>
    <div v-else-if="kind === 'accessory'" class="ring-shape">
      <span class="ring-plate" />
      <span class="ring-loop" />
      <span class="ring-strap" />
    </div>
    <div v-else-if="kind === 'mouse'" class="mouse-shape">
      <span class="mouse-body" />
      <span class="mouse-split" />
      <span class="mouse-wheel" />
    </div>
    <div v-else-if="kind === 'watch'" class="watch-shape">
      <span class="watch-strap watch-strap--top" />
      <span class="watch-strap watch-strap--bottom" />
      <span class="watch-case" />
      <span class="watch-crown" />
    </div>
    <div v-else class="car-shape">
      <span class="car-body" />
      <span class="car-cabin" />
      <span class="wheel wheel--left" />
      <span class="wheel wheel--right" />
    </div>
  </div>
</template>

<style scoped>
.visual {
  position: relative;
  display: grid;
  min-height: 156px;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background:
    radial-gradient(circle at 78% 18%, rgba(255, 255, 255, 0.7), transparent 24%),
    linear-gradient(135deg, rgba(17, 19, 21, 0.08), rgba(17, 19, 21, 0.02));
}

.visual::before {
  position: absolute;
  inset: 18px;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 8px;
  content: "";
}

.visual--emerald {
  background-color: rgba(8, 124, 104, 0.16);
}

.visual--gold {
  background-color: rgba(185, 138, 46, 0.18);
}

.visual--blue {
  background-color: rgba(49, 92, 112, 0.16);
}

.visual--charcoal {
  background-color: rgba(17, 19, 21, 0.14);
}

.coffee-shape {
  position: relative;
  width: 170px;
  height: 122px;
}

.coffee-bag {
  position: absolute;
  left: 24px;
  bottom: 10px;
  width: 76px;
  height: 104px;
  border-radius: 12px 12px 18px 18px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0)),
    #7b4f2a;
  box-shadow: 0 18px 32px rgba(17, 19, 21, 0.2);
}

.coffee-bag::before {
  position: absolute;
  top: 0;
  left: 14px;
  width: 48px;
  height: 15px;
  border-radius: 0 0 10px 10px;
  background: rgba(17, 19, 21, 0.22);
  content: "";
}

.coffee-label {
  position: absolute;
  left: 40px;
  bottom: 38px;
  width: 44px;
  height: 34px;
  border: 2px solid rgba(255, 255, 255, 0.72);
  border-radius: 8px;
  background: rgba(250, 248, 242, 0.82);
}

.coffee-cup {
  position: absolute;
  right: 24px;
  bottom: 12px;
  width: 62px;
  height: 48px;
  border-radius: 8px 8px 20px 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(255, 255, 255, 0.58)),
    var(--tm-ivory);
  box-shadow: 0 14px 28px rgba(17, 19, 21, 0.15);
}

.coffee-cup::after {
  position: absolute;
  top: 11px;
  right: -16px;
  width: 20px;
  height: 20px;
  border: 6px solid rgba(250, 248, 242, 0.84);
  border-left: 0;
  border-radius: 0 16px 16px 0;
  content: "";
}

.coffee-bean {
  position: absolute;
  width: 24px;
  height: 15px;
  border-radius: 50%;
  background: var(--tm-charcoal);
  transform: rotate(-24deg);
}

.coffee-bean::after {
  position: absolute;
  top: 3px;
  left: 10px;
  width: 2px;
  height: 9px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.45);
  content: "";
}

.coffee-bean--one {
  right: 54px;
  top: 18px;
}

.coffee-bean--two {
  right: 86px;
  top: 34px;
  transform: rotate(18deg);
}

.event-shape {
  position: relative;
  width: 184px;
  height: 126px;
}

.event-stage {
  position: absolute;
  left: 24px;
  right: 24px;
  bottom: 14px;
  height: 34px;
  border-radius: 10px 10px 16px 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0)),
    var(--tm-charcoal);
  box-shadow: 0 18px 34px rgba(17, 19, 21, 0.22);
}

.event-light {
  position: absolute;
  top: 18px;
  width: 46px;
  height: 74px;
  border-radius: 999px 999px 12px 12px;
  background: rgba(185, 138, 46, 0.38);
  clip-path: polygon(38% 0, 62% 0, 100% 100%, 0 100%);
}

.event-light--left {
  left: 34px;
  transform: rotate(14deg);
}

.event-light--right {
  right: 34px;
  transform: rotate(-14deg);
}

.event-speaker {
  position: absolute;
  bottom: 18px;
  width: 28px;
  height: 58px;
  border: 3px solid rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  background: var(--tm-charcoal);
}

.event-speaker::before,
.event-speaker::after {
  position: absolute;
  left: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--tm-gold);
  content: "";
  transform: translateX(-50%);
}

.event-speaker::before {
  top: 9px;
}

.event-speaker::after {
  bottom: 9px;
}

.event-speaker--left {
  left: 18px;
}

.event-speaker--right {
  right: 18px;
}

.event-star {
  position: absolute;
  top: 24px;
  left: 50%;
  width: 40px;
  height: 40px;
  background: var(--tm-gold);
  clip-path: polygon(50% 0, 62% 35%, 100% 35%, 69% 57%, 81% 94%, 50% 72%, 19% 94%, 31% 57%, 0 35%, 38% 35%);
  transform: translateX(-50%);
}

.phone-stack {
  position: relative;
  width: 132px;
  height: 112px;
}

.phone {
  position: absolute;
  width: 54px;
  height: 96px;
  border: 3px solid rgba(255, 255, 255, 0.82);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.06)),
    var(--tm-charcoal);
  box-shadow: 0 18px 30px rgba(17, 19, 21, 0.18);
}

.phone--back {
  left: 28px;
  top: 12px;
  transform: rotate(-12deg);
}

.phone--front {
  right: 28px;
  top: 2px;
  border-color: rgba(185, 138, 46, 0.74);
  transform: rotate(10deg);
}

.accessory-dot {
  position: absolute;
  right: 12px;
  bottom: 10px;
  width: 32px;
  height: 32px;
  border: 6px solid rgba(8, 124, 104, 0.84);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
}

/* --- Catalog kinds seeded from the inventory sheets ---------------------- */

/* Phone case: the shell sits behind the handset, with the camera cut-out. */
.case-shape {
  position: relative;
  width: 132px;
  height: 118px;
}

.case-shell {
  position: absolute;
  left: 32px;
  top: 4px;
  width: 68px;
  height: 110px;
  border: 3px solid rgba(255, 255, 255, 0.82);
  border-radius: 18px;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.04)),
    var(--tm-charcoal);
  box-shadow: 0 18px 30px rgba(17, 19, 21, 0.2);
}

.case-phone {
  position: absolute;
  left: 44px;
  top: 16px;
  width: 44px;
  height: 86px;
  border-radius: 11px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.55));
}

.case-lens {
  position: absolute;
  left: 40px;
  top: 12px;
  width: 22px;
  height: 22px;
  border: 3px solid rgba(185, 138, 46, 0.9);
  border-radius: 7px;
  background: rgba(17, 19, 21, 0.55);
}

/* Screen protector: a glass sheet lifting off the handset, with a highlight. */
.screen-shape {
  position: relative;
  width: 128px;
  height: 118px;
}

.screen-phone {
  position: absolute;
  left: 20px;
  top: 10px;
  width: 62px;
  height: 100px;
  border: 3px solid rgba(255, 255, 255, 0.8);
  border-radius: 13px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0.04)),
    var(--tm-charcoal);
  box-shadow: 0 18px 30px rgba(17, 19, 21, 0.2);
}

.screen-film {
  position: absolute;
  right: 14px;
  top: 2px;
  width: 62px;
  height: 100px;
  border: 3px solid rgba(185, 138, 46, 0.92);
  border-radius: 13px;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0.24));
  transform: rotate(8deg);
}

.screen-shine {
  position: absolute;
  right: 30px;
  top: 18px;
  width: 14px;
  height: 68px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  transform: rotate(8deg);
}

/* Headphones: a band arc over two ear cups. */
.audio-shape {
  position: relative;
  width: 150px;
  height: 112px;
}

.audio-band {
  position: absolute;
  left: 24px;
  top: 8px;
  width: 102px;
  height: 74px;
  border: 11px solid var(--tm-charcoal);
  border-bottom-color: transparent;
  border-radius: 999px 999px 0 0;
}

.audio-cup {
  position: absolute;
  bottom: 12px;
  width: 34px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.8);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0)),
    var(--tm-charcoal);
  box-shadow: 0 14px 26px rgba(17, 19, 21, 0.2);
}

.audio-cup::after {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--tm-gold);
  content: "";
  transform: translate(-50%, -50%);
}

.audio-cup--left {
  left: 14px;
}

.audio-cup--right {
  right: 14px;
}

/* Game controller: a wide body with two sticks. */
.pad-shape {
  position: relative;
  width: 168px;
  height: 96px;
}

.pad-body {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 22px;
  height: 58px;
  border: 3px solid rgba(255, 255, 255, 0.78);
  border-radius: 34px 34px 44px 44px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.24), rgba(255, 255, 255, 0)),
    var(--tm-charcoal);
  box-shadow: 0 18px 32px rgba(17, 19, 21, 0.22);
}

.pad-stick {
  position: absolute;
  top: 44px;
  width: 24px;
  height: 24px;
  border: 4px solid rgba(255, 255, 255, 0.86);
  border-radius: 50%;
  background: var(--tm-gold);
}

.pad-stick--left {
  left: 38px;
}

.pad-stick--right {
  right: 38px;
}

.pad-dot {
  position: absolute;
  left: 50%;
  top: 34px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.72);
  transform: translateX(-50%);
}

/* Charger: a plug brick with a cable curling to a connector tip. */
.plug-shape {
  position: relative;
  width: 168px;
  height: 108px;
}

.plug-brick {
  position: absolute;
  left: 18px;
  top: 26px;
  width: 58px;
  height: 58px;
  border: 3px solid rgba(255, 255, 255, 0.8);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0)),
    var(--tm-charcoal);
  box-shadow: 0 16px 28px rgba(17, 19, 21, 0.2);
}

.plug-pins {
  position: absolute;
  left: 34px;
  top: 8px;
  width: 26px;
  height: 20px;
  border-radius: 4px 4px 0 0;
  background: var(--tm-gold);
}

.plug-cable {
  position: absolute;
  left: 70px;
  top: 52px;
  width: 68px;
  height: 42px;
  border: 6px solid var(--tm-charcoal);
  border-top-color: transparent;
  border-left-color: transparent;
  border-radius: 0 0 999px 0;
}

.plug-tip {
  position: absolute;
  right: 14px;
  top: 34px;
  width: 18px;
  height: 26px;
  border-radius: 5px;
  background: var(--tm-gold);
}

/* Phone ring / strap: a ring plate with a hanging loop. */
.ring-shape {
  position: relative;
  width: 140px;
  height: 116px;
}

.ring-plate {
  position: absolute;
  left: 22px;
  top: 20px;
  width: 62px;
  height: 62px;
  border: 3px solid rgba(255, 255, 255, 0.8);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0)),
    var(--tm-charcoal);
  box-shadow: 0 16px 28px rgba(17, 19, 21, 0.2);
}

.ring-loop {
  position: absolute;
  left: 38px;
  top: 36px;
  width: 46px;
  height: 46px;
  border: 7px solid var(--tm-gold);
  border-radius: 50%;
}

.ring-strap {
  position: absolute;
  right: 18px;
  top: 24px;
  width: 46px;
  height: 74px;
  border: 6px solid rgba(255, 255, 255, 0.76);
  border-radius: 999px;
}

/* Mouse: an oval body split by the button seam. */
.mouse-shape {
  position: relative;
  width: 100px;
  height: 118px;
}

.mouse-body {
  position: absolute;
  inset: 4px 18px;
  border: 3px solid rgba(255, 255, 255, 0.82);
  border-radius: 999px 999px 44px 44px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0)),
    var(--tm-charcoal);
  box-shadow: 0 18px 30px rgba(17, 19, 21, 0.2);
}

.mouse-split {
  position: absolute;
  left: 50%;
  top: 8px;
  width: 3px;
  height: 42px;
  background: rgba(255, 255, 255, 0.62);
  transform: translateX(-50%);
}

.mouse-wheel {
  position: absolute;
  left: 50%;
  top: 20px;
  width: 10px;
  height: 20px;
  border-radius: 999px;
  background: var(--tm-gold);
  transform: translateX(-50%);
}

/* Smart watch: a case between two straps. */
.watch-shape {
  position: relative;
  width: 96px;
  height: 126px;
}

.watch-strap {
  position: absolute;
  left: 50%;
  width: 44px;
  height: 34px;
  background: rgba(17, 19, 21, 0.55);
  transform: translateX(-50%);
}

.watch-strap--top {
  top: 2px;
  border-radius: 12px 12px 4px 4px;
}

.watch-strap--bottom {
  bottom: 2px;
  border-radius: 4px 4px 12px 12px;
}

.watch-case {
  position: absolute;
  left: 50%;
  top: 28px;
  width: 66px;
  height: 70px;
  border: 3px solid rgba(255, 255, 255, 0.82);
  border-radius: 18px;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.04)),
    var(--tm-charcoal);
  box-shadow: 0 16px 28px rgba(17, 19, 21, 0.2);
  transform: translateX(-50%);
}

.watch-case::after {
  position: absolute;
  inset: 12px;
  border-radius: 9px;
  background: rgba(8, 124, 104, 0.5);
  content: "";
}

.watch-crown {
  position: absolute;
  right: 8px;
  top: 52px;
  width: 9px;
  height: 20px;
  border-radius: 3px;
  background: var(--tm-gold);
}

.car-shape {
  position: relative;
  width: 178px;
  height: 94px;
}

.car-body {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: 22px;
  height: 42px;
  border-radius: 16px 28px 12px 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0)),
    var(--tm-charcoal);
  box-shadow: 0 18px 34px rgba(17, 19, 21, 0.22);
}

.car-cabin {
  position: absolute;
  left: 56px;
  bottom: 58px;
  width: 72px;
  height: 30px;
  border-radius: 28px 28px 5px 5px;
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.82), rgba(255, 255, 255, 0.42)),
    rgba(8, 124, 104, 0.44);
}

.wheel {
  position: absolute;
  bottom: 12px;
  width: 28px;
  height: 28px;
  border: 6px solid var(--tm-charcoal);
  border-radius: 50%;
  background: var(--tm-gold);
}

.wheel--left {
  left: 42px;
}

.wheel--right {
  right: 42px;
}
</style>
