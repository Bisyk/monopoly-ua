<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import type { BotDifficulty, BotSlot } from "~/types";
import {
  BOT_DIFFICULTIES,
  BOT_DIFFICULTY_LABELS,
  BOT_PERSONAS,
  generateBotUsername,
  getBotPersonaByUsername,
} from "~/shared/constants/botNames";

const props = withDefaults(
  defineProps<{
    creatorUsername?: string;
  }>(),
  {
    creatorUsername: "",
  }
);

const emit = defineEmits<{
  (
    e: "createGame",
    payload: {
      maxPlayers: number;
      includeCreator: boolean;
      bots: BotSlot[];
    }
  ): void;
  (e: "closeModal"): void;
}>();

const selectedOption = ref(2);
const includeCreator = ref(true);
const bots = ref<BotSlot[]>([]);
const modalContainer = ref<HTMLElement | null>(null);

const maxBotSlots = computed(() =>
  includeCreator.value ? selectedOption.value - 1 : selectedOption.value
);

const openHumanSlots = computed(() =>
  includeCreator.value
    ? Math.max(0, selectedOption.value - 1 - bots.value.length)
    : 0
);

const canAddBot = computed(() => bots.value.length < maxBotSlots.value);

const isImmediateStart = computed(
  () => !includeCreator.value || bots.value.length === maxBotSlots.value
);

const submitLabel = computed(() => {
  if (!includeCreator.value) {
    return "WATCH ALL-BOT MATCH";
  }
  if (bots.value.length > 0 && bots.value.length === maxBotSlots.value) {
    return "START SOLO VS BOTS";
  }
  return `CREATE ${selectedOption.value}P TABLE`;
});

const getReservedUsernames = () => {
  const names = bots.value.map((bot) => bot.username);
  if (includeCreator.value && props.creatorUsername) {
    names.push(props.creatorUsername);
  }
  return names;
};

const addBot = (difficulty: BotDifficulty = "MEDIUM") => {
  if (!canAddBot.value) return;
  const username = generateBotUsername(getReservedUsernames());
  bots.value = [...bots.value, { username, difficulty }];
};

const fillWithBots = () => {
  const nextBots = [...bots.value];
  const existing = getReservedUsernames();

  while (nextBots.length < maxBotSlots.value) {
    const username = generateBotUsername(existing);
    existing.push(username);
    nextBots.push({ username, difficulty: "MEDIUM" });
  }
  bots.value = nextBots;
};

const removeBot = (index: number) => {
  if (!includeCreator.value) return;
  bots.value = bots.value.filter((_, idx) => idx !== index);
};

const setBotDifficulty = (index: number, difficulty: BotDifficulty) => {
  bots.value = bots.value.map((bot, idx) =>
    idx === index ? { ...bot, difficulty } : bot
  );
};

const canCycleBotPersona = computed(
  () => bots.value.length < BOT_PERSONAS.length
);

const cycleBotPersona = (index: number) => {
  const current = bots.value[index];
  if (!current || !canCycleBotPersona.value) return;

  const taken = new Set(
    bots.value
      .filter((_, idx) => idx !== index)
      .map((bot) => bot.username.toLowerCase())
  );
  if (includeCreator.value && props.creatorUsername) {
    taken.add(props.creatorUsername.toLowerCase());
  }

  const currentPersonaIdx = BOT_PERSONAS.findIndex(
    (persona) =>
      persona.username.toLowerCase() === current.username.toLowerCase()
  );

  for (let step = 1; step <= BOT_PERSONAS.length; step += 1) {
    const candidate =
      BOT_PERSONAS[(currentPersonaIdx + step + BOT_PERSONAS.length) % BOT_PERSONAS.length];
    if (!taken.has(candidate.username.toLowerCase())) {
      bots.value = bots.value.map((bot, idx) =>
        idx === index ? { ...bot, username: candidate.username } : bot
      );
      return;
    }
  }
};

const setMode = (playInMatch: boolean) => {
  includeCreator.value = playInMatch;
};

const syncBotsToCapacity = () => {
  if (!includeCreator.value) {
    const trimmed = bots.value.slice(0, selectedOption.value);
    const existing = trimmed.map((b) => b.username);
    while (trimmed.length < selectedOption.value) {
      const username = generateBotUsername(existing);
      existing.push(username);
      trimmed.push({ username, difficulty: "MEDIUM" });
    }
    bots.value = trimmed;
    return;
  }

  if (bots.value.length > maxBotSlots.value) {
    bots.value = bots.value.slice(0, maxBotSlots.value);
  }
};

watch([selectedOption, includeCreator], () => {
  syncBotsToCapacity();
});

const handleSubmit = () => {
  emit("createGame", {
    maxPlayers: selectedOption.value,
    includeCreator: includeCreator.value,
    bots: bots.value.map((bot) => ({ ...bot })),
  });
};

onMounted(() => {
  modalContainer.value?.focus();
});
</script>

<template>
  <div
    ref="modalContainer"
    class="modal-backdrop"
    tabindex="0"
    @keydown.escape="$emit('closeModal')"
    @click.self="$emit('closeModal')"
  >
    <div class="modal-dialog" role="dialog" aria-modal="true">
      <div class="modal-header">
        <div class="modal-header__title">
          <GameIcon name="plus" :size="20" />
          <h2>CREATE GAME</h2>
        </div>
        <button
          type="button"
          class="modal-close"
          aria-label="Close modal"
          @click="$emit('closeModal')"
        >
          <GameIcon name="close" :size="18" />
        </button>
      </div>

      <div class="modal-body">
        <div class="form-section">
          <p class="modal-label">CHOOSE NUMBER OF PLAYERS</p>
          <div class="qty-grid">
            <button
              v-for="playerQuantity in [2, 3, 4, 5, 6]"
              :key="playerQuantity"
              type="button"
              class="qty-btn"
              :class="{ 'is-active': selectedOption === playerQuantity }"
              @click="selectedOption = playerQuantity"
            >
              <span class="qty-num">{{ playerQuantity }}</span>
              <span class="qty-sub">PLAYERS</span>
            </button>
          </div>
        </div>

        <div class="form-section">
          <p class="modal-label">MATCH MODE</p>
          <div class="mode-toggle">
            <button
              type="button"
              class="mode-btn"
              :class="{ 'is-active': includeCreator }"
              @click="setMode(true)"
            >
              <GameIcon name="user" :size="15" />
              <span>PLAY IN MATCH</span>
            </button>
            <button
              type="button"
              class="mode-btn"
              :class="{ 'is-active': !includeCreator }"
              @click="setMode(false)"
            >
              <GameIcon name="bolt" :size="15" />
              <span>ALL-BOT SPECTATE</span>
            </button>
          </div>
        </div>

        <div class="form-section">
          <div class="section-head">
            <div>
              <p class="modal-label section-head__label">
                {{ includeCreator ? "BOT OPPONENTS" : "ALL-BOT ROSTER" }}
              </p>
              <p class="section-meta">
                <template v-if="includeCreator">
                  1 YOU · {{ bots.length }}
                  {{ bots.length === 1 ? "BOT" : "BOTS" }} ·
                  {{ openHumanSlots }} OPEN
                </template>
                <template v-else>
                  {{ bots.length }} AI PLAYERS · SPECTATOR VIEW
                </template>
              </p>
            </div>

            <div v-if="includeCreator" class="bot-quick-actions">
              <button
                type="button"
                class="mini-action-btn"
                :disabled="!canAddBot"
                @click="addBot()"
              >
                + ADD BOT
              </button>
              <button
                type="button"
                class="mini-action-btn mini-action-btn--gold"
                :disabled="!canAddBot"
                @click="fillWithBots"
              >
                FILL WITH BOTS
              </button>
            </div>
          </div>

          <div v-if="bots.length" class="bot-list">
            <div
              v-for="(bot, index) in bots"
              :key="bot.username"
              class="bot-row"
            >
              <div class="bot-row__info">
                <button
                  type="button"
                  class="bot-row__avatar"
                  :class="{ 'is-swappable': canCycleBotPersona }"
                  :style="{
                    backgroundColor:
                      getBotPersonaByUsername(bot.username)?.bgColor ??
                      'var(--accent)',
                  }"
                  :title="
                    canCycleBotPersona
                      ? `${bot.username} — Click to swap persona`
                      : bot.username
                  "
                  :aria-label="
                    canCycleBotPersona
                      ? `Swap persona for ${bot.username}`
                      : bot.username
                  "
                  @click="cycleBotPersona(index)"
                >
                  <img
                    v-if="getBotPersonaByUsername(bot.username)?.avatarUrl"
                    :src="getBotPersonaByUsername(bot.username)!.avatarUrl"
                    :alt="bot.username"
                    class="bot-row__avatar-img"
                  />
                  <span v-else class="bot-row__index">B{{ index + 1 }}</span>
                </button>

                <div class="bot-row__meta">
                  <span class="bot-row__name" :title="bot.username">
                    {{ bot.username }}
                  </span>
                  <span
                    v-if="getBotPersonaByUsername(bot.username)?.title"
                    class="bot-row__title"
                  >
                    {{ getBotPersonaByUsername(bot.username)!.title }}
                  </span>
                </div>
              </div>

              <div class="bot-row__controls">
                <div class="diff-group" role="group" aria-label="Bot difficulty">
                  <button
                    v-for="diff in BOT_DIFFICULTIES"
                    :key="diff"
                    type="button"
                    class="diff-btn"
                    :class="[
                      `diff-btn--${diff.toLowerCase()}`,
                      { 'is-active': bot.difficulty === diff },
                    ]"
                    @click="setBotDifficulty(index, diff)"
                  >
                    {{ BOT_DIFFICULTY_LABELS[diff] }}
                  </button>
                </div>

                <button
                  v-if="includeCreator"
                  type="button"
                  class="bot-remove-btn"
                  :aria-label="`Remove ${bot.username}`"
                  @click="removeBot(index)"
                >
                  <GameIcon name="close" :size="14" />
                </button>
              </div>
            </div>
          </div>

          <div v-else class="bot-empty">
            No bots added yet. Add bots or click
            <strong>FILL WITH BOTS</strong> for an instant solo match.
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <BaseButton variant="ghost" @click="$emit('closeModal')">
          CANCEL
        </BaseButton>
        <BaseButton
          :variant="isImmediateStart ? 'primary' : 'positive'"
          @click="handleSubmit"
        >
          <GameIcon :name="includeCreator ? 'dice' : 'bolt'" :size="18" />
          <span>{{ submitLabel }}</span>
        </BaseButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background-color: rgba(30, 27, 58, 0.55);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  outline: none;
}

.modal-dialog {
  width: 100%;
  max-width: 510px;
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  background-color: var(--surface);
  border: 2.5px solid var(--outline);
  border-radius: var(--radius-lg);
  box-shadow: var(--modal-shadow);
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--accent);
  color: #ffffff;
  border-bottom: 2.5px solid var(--outline);
  flex-shrink: 0;
}

.modal-header__title {
  display: flex;
  align-items: center;
  gap: 8px;

  h2 {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
}

.modal-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  color: var(--ink);
  border: 2px solid var(--outline);
  border-radius: 6px;
  box-shadow: 0 2px 0 var(--outline);
  cursor: pointer;
  transition: transform 0.06s ease, box-shadow 0.06s ease;

  &:active {
    transform: translateY(2px);
    box-shadow: 0 0 0 var(--outline);
  }
}

.modal-body {
  padding: 18px 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow-y: auto;
}

.form-section {
  display: flex;
  flex-direction: column;
}

.modal-label {
  font-family: var(--font-display);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--ink-muted);
  margin-bottom: 10px;
}

.qty-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
}

.qty-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 11px 6px;
  background: var(--surface-alt);
  color: var(--ink);
  border: 2px solid var(--outline);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 0 var(--outline);
  cursor: pointer;
  transition: transform 0.06s ease, box-shadow 0.06s ease, background-color 0.08s ease;

  &:hover {
    background: var(--gold-light);
  }

  &:active {
    transform: translateY(3px);
    box-shadow: 0 1px 0 var(--outline);
  }

  &.is-active {
    background: var(--accent);
    color: #ffffff;
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.25),
      0 4px 0 var(--accent-dark),
      0 6px 0 var(--outline);
  }
}

.qty-num {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.qty-sub {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  opacity: 0.8;
}

.mode-toggle {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 10px 12px;
  background: var(--surface-alt);
  color: var(--ink);
  border: 2px solid var(--outline);
  border-radius: var(--radius-md);
  box-shadow: 0 3px 0 var(--outline);
  font-family: var(--font-display);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: transform 0.06s ease, box-shadow 0.06s ease, background-color 0.08s ease;

  &:hover {
    background: var(--gold-light);
  }

  &:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 var(--outline);
  }

  &.is-active {
    background: var(--gold);
    color: var(--ink);
    box-shadow:
      inset 0 2px 0 rgba(255, 255, 255, 0.45),
      0 3px 0 var(--gold-dark),
      0 5px 0 var(--outline);
  }
}

.section-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.section-head__label {
  margin-bottom: 2px;
}

.section-meta {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--ink-muted);
  letter-spacing: 0.03em;
}

.bot-quick-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mini-action-btn {
  appearance: none;
  padding: 6px 10px;
  background: var(--surface-alt);
  color: var(--ink);
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  box-shadow: 0 2px 0 var(--outline);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: transform 0.06s ease, box-shadow 0.06s ease, background-color 0.08s ease;

  &:hover:not(:disabled) {
    background: var(--gold-light);
  }

  &:active:not(:disabled) {
    transform: translateY(2px);
    box-shadow: 0 0 0 var(--outline);
  }

  &--gold {
    background: var(--gold-light);

    &:hover:not(:disabled) {
      background: var(--gold);
    }
  }

  &:disabled {
    opacity: 0.48;
    cursor: not-allowed;
    box-shadow: 0 1px 0 var(--outline);
  }
}

.bot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bot-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  background: var(--surface-alt);
  border: 2px solid var(--outline);
  border-radius: var(--radius-md);
}

.bot-row__info {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.bot-row__avatar {
  appearance: none;
  padding: 0;
  width: 38px;
  height: 38px;
  border: 2px solid var(--outline);
  border-radius: 6px;
  box-shadow: 0 2px 0 var(--outline);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  cursor: default;
  transition: transform 0.08s ease, box-shadow 0.08s ease, filter 0.1s ease;

  &.is-swappable {
    cursor: pointer;

    &:hover {
      filter: brightness(1.06);
      transform: translateY(-1px);
      box-shadow: 0 3px 0 var(--outline);
    }

    &:active {
      transform: translateY(1px);
      box-shadow: 0 0 0 var(--outline);
    }
  }
}

.bot-row__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.bot-row__index {
  color: #ffffff;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 800;
}

.bot-row__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.bot-row__name {
  font-family: var(--font-display);
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bot-row__title {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  color: var(--ink-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bot-row__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.diff-group {
  display: inline-flex;
  border: 2px solid var(--outline);
  border-radius: var(--radius-sm);
  overflow: hidden;
  background: var(--surface);
}

.diff-btn {
  appearance: none;
  border: none;
  border-right: 1.5px solid var(--outline);
  padding: 5px 8px;
  background: transparent;
  color: var(--ink-muted);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: background-color 0.08s ease, color 0.08s ease;

  &:last-child {
    border-right: none;
  }

  &:hover {
    background: var(--surface-alt);
    color: var(--ink);
  }

  &.is-active.diff-btn--easy {
    background: var(--positive);
    color: #ffffff;
  }

  &.is-active.diff-btn--medium {
    background: var(--gold);
    color: var(--ink);
  }

  &.is-active.diff-btn--hard {
    background: var(--danger);
    color: #ffffff;
  }
}

.bot-remove-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  color: var(--danger);
  border: 1.5px solid var(--outline);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.08s ease, color 0.08s ease;

  &:hover {
    background: var(--danger);
    color: #ffffff;
  }
}

.bot-empty {
  padding: 12px 14px;
  background: var(--surface-alt);
  border: 2px dashed var(--rule-muted);
  border-radius: var(--radius-md);
  font-size: 12px;
  line-height: 1.4;
  color: var(--ink-muted);
  text-align: center;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 18px 18px;
  border-top: 2px solid var(--surface-alt);
  flex-shrink: 0;
}
</style>