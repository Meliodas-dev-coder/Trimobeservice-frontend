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
