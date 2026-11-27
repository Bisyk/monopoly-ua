<script setup lang="ts">
import { computed, onUnmounted, ref, watch, type PropType } from "vue";
import { usePreferredReducedMotion } from "@vueuse/core";
import {
  DICE_LEAD_IN_MS,
  DICE_POST_SETTLE_VISIBLE_MS,
  DIE_ONE_SPIN_MS,
  DIE_TWO_SPIN_MS,
} from "~/shared/constants/animationTimings";
import { getBotAvatarUrl } from "~/shared/constants/botNames";
import type { DiceRollEvent, Player } from "~/types";
import {
  getCartridgePlayerColor,
  getPlayerInitials,
} from "~/utils/cartridgeTheme";
import {
  createDieSpinTrajectory,
  DIE_FACE_PIP_MAP,
  FACE_TARGET_ORIENTATIONS,
  hashRollId,
  sampleDieSpinPose,
  type CubeFramePose,
} from "~/utils/diceSpinPhysics";

const props = defineProps({
  lastRoll: {
    type: Object as PropType<DiceRollEvent | null | undefined>,
    default: null,
  },
  players: {
    type: Array as PropType<Player[]>,
    default: () => [],
  },
});

const emit = defineEmits<{
  (e: "rollAnimationChange", active: boolean): void;
}>();

const preferredReducedMotion = usePreferredReducedMotion();
const isReducedMotion = computed(
  () => preferredReducedMotion.value === "reduce"
);

const CUBE_FACES: Array<{ value: number; className: string }> = [
  { value: 1, className: "cube-face--1" },
  { value: 6, className: "cube-face--6" },
  { value: 2, className: "cube-face--2" },
  { value: 5, className: "cube-face--5" },
  { value: 3, className: "cube-face--3" },
  { value: 4, className: "cube-face--4" },
];

const defaultPose = (face: number): CubeFramePose => {
  const orientation = FACE_TARGET_ORIENTATIONS[face] ?? FACE_TARGET_ORIENTATIONS[1];
  return {
    rx: orientation.rx,
    ry: orientation.ry,
    rz: 0,
    lift: 0,
    scale: 1,
    shadowScale: 1,
    shadowOpacity: 0.34,
    settled: true,
  };
};

const activeRoll = ref<DiceRollEvent | null>(null);
const isVisible = ref(false);
const isSettled = ref(false);
const dieOneSettled = ref(false);
const dieTwoSettled = ref(false);
const dieOnePose = ref<CubeFramePose>(defaultPose(5));
const dieTwoPose = ref<CubeFramePose>(defaultPose(3));

let hasHydrated = false;
let lastProcessedRollId: string | null = null;
let rafId: number | null = null;
let leadInTimer: ReturnType<typeof setTimeout> | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let runToken = 0;

const clearAnimationWork = () => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (leadInTimer !== null) {
    clearTimeout(leadInTimer);
    leadInTimer = null;
  }
  if (hideTimer !== null) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
};

const rollerColor = computed(() => {
  const username = activeRoll.value?.username;
  if (!username) return "#2667E8";
  const found = props.players.find((p) => p.username === username);
  return found ? getCartridgePlayerColor(found.color) : "#2667E8";
});

const rollerInitials = computed(() =>
  activeRoll.value?.username ? getPlayerInitials(activeRoll.value.username) : "?"
);

const rollerAvatarUrl = computed(() =>
  getBotAvatarUrl(activeRoll.value?.username)
);

const totalSum = computed(() =>
  activeRoll.value ? activeRoll.value.left + activeRoll.value.right : 0
);

const cubeTransform = (pose: CubeFramePose) =>
  `translateY(${-pose.lift.toFixed(2)}px) scale(${pose.scale.toFixed(
    3
  )}) rotateZ(${pose.rz.toFixed(2)}deg) rotateX(${pose.rx.toFixed(
    2
  )}deg) rotateY(${pose.ry.toFixed(2)}deg)`;

const shadowStyle = (pose: CubeFramePose) => ({
  transform: `scale(${pose.shadowScale.toFixed(3)})`,
  opacity: pose.shadowOpacity.toFixed(3),
});

const startSpin = (roll: DiceRollEvent) => {
  clearAnimationWork();
  runToken += 1;
  const token = runToken;

  activeRoll.value = roll;
  isVisible.value = true;
  isSettled.value = false;
  dieOneSettled.value = false;
  dieTwoSettled.value = false;

  if (isReducedMotion.value) {
    dieOnePose.value = defaultPose(roll.left);
    dieTwoPose.value = defaultPose(roll.right);
    dieOneSettled.value = true;
    dieTwoSettled.value = true;
    isSettled.value = true;
    emit("rollAnimationChange", true);

    leadInTimer = setTimeout(() => {
      if (token !== runToken) return;
      emit("rollAnimationChange", false);
    }, 300);

    hideTimer = setTimeout(() => {
      if (token !== runToken) return;
      isVisible.value = false;
    }, 1100);
    return;
  }

  emit("rollAnimationChange", true);

  const seed = hashRollId(roll.rollId);
  const trajOne = createDieSpinTrajectory(roll.left, 0, seed);
  const trajTwo = createDieSpinTrajectory(roll.right, 1, seed + 131);

  dieOnePose.value = sampleDieSpinPose(trajOne, 0);
  dieTwoPose.value = sampleDieSpinPose(trajTwo, 0);

  let startTime: number | null = null;

  const tick = (now: number) => {
    if (token !== runToken) return;

    startTime ??= now;
    const elapsed = now - startTime;

    const t1 = Math.min(1, elapsed / DIE_ONE_SPIN_MS);
    const t2 = Math.min(1, elapsed / DIE_TWO_SPIN_MS);

    dieOnePose.value = sampleDieSpinPose(trajOne, t1);
    dieTwoPose.value = sampleDieSpinPose(trajTwo, t2);

    if (t1 >= 1 && !dieOneSettled.value) {
      dieOneSettled.value = true;
    }

    if (t2 >= 1) {
      dieTwoSettled.value = true;
      isSettled.value = true;
      rafId = null;
      return;
    }

    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  leadInTimer = setTimeout(() => {
    if (token !== runToken) return;
    isSettled.value = true;
    dieOneSettled.value = true;
    dieTwoSettled.value = true;
    emit("rollAnimationChange", false);
  }, DICE_LEAD_IN_MS);

  hideTimer = setTimeout(() => {
    if (token !== runToken) return;
    isVisible.value = false;
  }, DICE_LEAD_IN_MS + DICE_POST_SETTLE_VISIBLE_MS);
};

watch(
  () => props.lastRoll,
  (incoming) => {
    if (!hasHydrated) {
      hasHydrated = true;
      if (incoming?.rollId) {
        lastProcessedRollId = incoming.rollId;
      }
      return;
    }

    if (!incoming?.rollId || incoming.rollId === lastProcessedRollId) {
      return;
    }

    lastProcessedRollId = incoming.rollId;
    startSpin(incoming);
  },
  { immediate: true }
);

onUnmounted(() => {
  runToken += 1;
  clearAnimationWork();
  emit("rollAnimationChange", false);
});
</script>

<template>
  <Transition name="dice-stage-pop">
    <div
      v-if="isVisible && activeRoll"
      class="dice-stage-overlay"
      aria-live="polite"
    >
      <div
        class="dice-stage-card"
        :class="{
          'is-settled': isSettled,
          'is-doubles': isSettled && activeRoll.isDoubles,
        }"
      >
        <div class="dice-stage-head">
          <div class="dice-stage-actor">
            <span
              class="actor-avatar"
              :style="{ backgroundColor: rollerColor }"
            >
              <img
                v-if="rollerAvatarUrl"
                :src="rollerAvatarUrl"
                :alt="activeRoll.username"
                class="actor-avatar__img"
              />
              <template v-else>{{ rollerInitials }}</template>
            </span>
            <span class="actor-name">{{ activeRoll.username }}</span>
          </div>

          <span
            class="stage-pill"
            :class="{
              'stage-pill--spinning': !isSettled,
              'stage-pill--doubles': isSettled && activeRoll.isDoubles,
            }"
          >
            <template v-if="!isSettled">ROLLING</template>
            <template v-else-if="activeRoll.isDoubles">DOUBLES!</template>
            <template v-else>ROLLED</template>
          </span>
        </div>

        <div class="cubes-arena">
          <div
            class="cube-slot"
            :class="{
              'is-landed': dieOneSettled,
              'is-doubles-hit': isSettled && activeRoll.isDoubles,
            }"
          >
            <div class="cube-burst" />
            <div class="cube-scene">
              <div
                class="cube-3d"
                :style="{ transform: cubeTransform(dieOnePose) }"
              >
                <div
                  v-for="face in CUBE_FACES"
                  :key="`d1-${face.value}`"
                  class="cube-face"
                  :class="face.className"
                >
                  <span
                    v-for="(on, pipIdx) in DIE_FACE_PIP_MAP[face.value]"
                    :key="pipIdx"
                    class="cube-pip"
                    :class="{
                      'is-on': on === 1,
                      'is-gold': isSettled && activeRoll.isDoubles,
                    }"
                  />
                </div>
              </div>
            </div>
            <div class="cube-shadow" :style="shadowStyle(dieOnePose)" />
          </div>

          <div
            class="cube-slot"
            :class="{
              'is-landed': dieTwoSettled,
              'is-doubles-hit': isSettled && activeRoll.isDoubles,
            }"
          >
            <div class="cube-burst" />
            <div class="cube-scene">
              <div
                class="cube-3d"
                :style="{ transform: cubeTransform(dieTwoPose) }"
              >
                <div
                  v-for="face in CUBE_FACES"
                  :key="`d2-${face.value}`"
                  class="cube-face"
                  :class="face.className"
                >
                  <span
                    v-for="(on, pipIdx) in DIE_FACE_PIP_MAP[face.value]"
                    :key="pipIdx"
                    class="cube-pip"
                    :class="{
                      'is-on': on === 1,
                      'is-gold': isSettled && activeRoll.isDoubles,
                    }"
                  />
                </div>
              </div>
            </div>
            <div class="cube-shadow" :style="shadowStyle(dieTwoPose)" />
          </div>
        </div>

        <div class="dice-stage-footer">
          <template v-if="isSettled">
            <span class="result-equation">
              {{ activeRoll.left }} + {{ activeRoll.right }}
            </span>
            <span class="result-equals">=</span>
            <span class="result-total">{{ totalSum }}</span>
            <span v-if="activeRoll.isDoubles" class="result-bonus">
              BONUS ROLL
            </span>
          </template>
          <span v-else class="suspense-dots">
            <span class="dot" />
            <span class="dot" />
            <span class="dot" />
          </span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped lang="scss">
$cube-size: 64px;
$cube-half: 32px;

.dice-stage-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
}

.dice-stage-card {
  width: min(304px, 92%);
  background: var(--surface);
  border: 3px solid var(--outline);
  border-radius: var(--radius-lg);
  box-shadow:
    0 8px 0 var(--outline),
    0 18px 34px rgba(30, 27, 58, 0.28);
  overflow: hidden;
  transition:
    border-color 0.18s ease,
    box-shadow 0.2s ease,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);

  &.is-settled {
    transform: scale(1.02);
  }

  &.is-doubles {
    box-shadow:
      0 8px 0 var(--outline),
      0 0 0 4px var(--gold),
      0 20px 36px rgba(217, 145, 0, 0.38);
  }
}

.dice-stage-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  background: var(--surface-alt);
  border-bottom: 2.5px solid var(--outline);
}

.dice-stage-actor {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.actor-avatar {
  width: 26px;
  height: 26px;
  border-radius: 5px;
  border: 2px solid var(--outline);
  color: #ffffff;
  font-family: var(--font-display);
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.actor-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.actor-name {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.stage-pill {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1.5px solid var(--outline);
  background: var(--accent);
  color: #ffffff;
  flex-shrink: 0;

  &--spinning {
    background: var(--ink);
    animation: pillPulse 0.65s ease-in-out infinite alternate;
  }

  &--doubles {
    background: var(--gold);
    color: var(--ink);
    animation: doublesPop 0.34s cubic-bezier(0.22, 1, 0.36, 1);
  }
}

.cubes-arena {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 34px;
  padding: 36px 20px 22px;
  background:
    radial-gradient(
      circle at 50% 62%,
      rgba(247, 210, 74, 0.22) 0%,
      rgba(255, 255, 255, 0) 68%
    ),
    repeating-linear-gradient(
      -45deg,
      rgba(30, 27, 58, 0.025) 0 6px,
      transparent 6px 12px
    ),
    var(--surface);
}

.cube-slot {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  width: 78px;
  height: 92px;
}

.cube-burst {
  position: absolute;
  bottom: 18px;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  border: 3px solid var(--gold);
  opacity: 0;
  pointer-events: none;
  transform: scale(0.5);
}

.cube-slot.is-landed .cube-burst {
  animation: impactRing 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.cube-slot.is-doubles-hit .cube-burst {
  border-color: var(--gold-dark);
}

.cube-scene {
  width: $cube-size;
  height: $cube-size;
  perspective: 760px;
  margin-bottom: 14px;
}

.cube-3d {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  will-change: transform;
}

.cube-face {
  position: absolute;
  inset: 0;
  width: $cube-size;
  height: $cube-size;
  border: 2.5px solid var(--outline);
  border-radius: 9px;
  background: #ffffff;
  box-shadow:
    inset 0 2px 0 rgba(255, 255, 255, 0.85),
    inset 0 -3px 0 rgba(30, 27, 58, 0.08);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  padding: 9px;
  gap: 4px;
  backface-visibility: hidden;
}

.cube-face--1 {
  background: #ffffff;
  transform: rotateY(0deg) translateZ($cube-half);
}

.cube-face--6 {
  background: #f8f4ea;
  transform: rotateY(180deg) translateZ($cube-half);
}

.cube-face--2 {
  background: #f4efe2;
  transform: rotateY(90deg) translateZ($cube-half);
}

.cube-face--5 {
  background: #ece5d5;
  transform: rotateY(-90deg) translateZ($cube-half);
}

.cube-face--3 {
  background: #fffdf8;
  transform: rotateX(90deg) translateZ($cube-half);
}

.cube-face--4 {
  background: #e7dfd0;
  transform: rotateX(-90deg) translateZ($cube-half);
}

.cube-pip {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: transparent;
  transition: background-color 0.16s ease;

  &.is-on {
    background: var(--accent);
    box-shadow: inset 0 1.5px 0 rgba(0, 0, 0, 0.2);
  }

  &.is-on.is-gold {
    background: var(--gold-dark);
  }
}

.cube-shadow {
  width: 58px;
  height: 12px;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(30, 27, 58, 0.72) 0%,
    rgba(30, 27, 58, 0) 75%
  );
  will-change: transform, opacity;
}

.dice-stage-footer {
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--surface-alt);
  border-top: 2px solid var(--outline);
  font-family: var(--font-display);
}

.result-equation {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-muted);
}

.result-equals {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-muted);
}

.result-total {
  font-size: 18px;
  font-weight: 800;
  color: var(--ink);
  animation: totalPop 0.28s cubic-bezier(0.22, 1, 0.36, 1);
}

.result-bonus {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--gold-light);
  border: 1.5px solid var(--outline);
  color: var(--ink);
}

.suspense-dots {
  display: inline-flex;
  align-items: center;
  gap: 6px;

  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--accent);
    border: 1.5px solid var(--outline);
    animation: dotWave 0.75s ease-in-out infinite;

    &:nth-child(2) {
      animation-delay: 0.14s;
    }

    &:nth-child(3) {
      animation-delay: 0.28s;
    }
  }
}

.dice-stage-pop-enter-active {
  transition:
    opacity 0.18s ease,
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.dice-stage-pop-leave-active {
  transition:
    opacity 0.26s ease,
    transform 0.26s ease;
}

.dice-stage-pop-enter-from {
  opacity: 0;
  transform: scale(0.88) translateY(8px);
}

.dice-stage-pop-leave-to {
  opacity: 0;
  transform: scale(0.94) translateY(-6px);
}

@keyframes impactRing {
  0% {
    opacity: 0.85;
    transform: scale(0.55);
  }
  100% {
    opacity: 0;
    transform: scale(1.42);
  }
}

@keyframes pillPulse {
  from {
    opacity: 0.82;
  }
  to {
    opacity: 1;
  }
}

@keyframes doublesPop {
  0% {
    transform: scale(0.7);
  }
  65% {
    transform: scale(1.14);
  }
  100% {
    transform: scale(1);
  }
}

@keyframes totalPop {
  0% {
    transform: scale(0.75);
    opacity: 0.4;
  }
  70% {
    transform: scale(1.16);
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}

@keyframes dotWave {
  0%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  50% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
</style>
