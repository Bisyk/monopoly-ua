<script setup lang="ts">
import { useRouter } from "vue-router";
import AvailableRoomCard from "./AvailableRoomCard.vue";
import CreateRoomModal from "./CreateRoomModal.vue";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useWebsocketManager } from "~/composables/useWebsocketManager";
import type { BotDifficulty, BotSlot, CreatedGame } from "~/types";

const props = defineProps({
  username: { type: String, required: true },
});

const allGames = ref<CreatedGame[]>([]);
const roomConnections = ref<{
  [key: string]: { status: any; send: any; open: any; close: any };
}>({});
const isCreateGameModalActive = ref(false);
const navigatedRoomId = ref<string | null>(null);
const joinedPendingRoomIds = new Set<string>();
const router = useRouter();
// @ts-ignore
const protocol = location.protocol === "https:" ? "wss" : "ws";
const { send, handleMessage } = useWebsocketManager(
  `${protocol}://${location.host}/api/rooms`
);

let pollInterval: ReturnType<typeof setInterval> | null = null;

handleMessage((message: string) => {
  allGames.value = JSON.parse(message);
});

const availableGames = computed(() => {
  return allGames.value.filter((game) => game.status === "PENDING");
});

const liveGames = computed(() => {
  return allGames.value.filter((game) => game.status === "STARTED");
});

const isConnectedToRoom = computed(() => {
  return allGames.value.some(
    (game) =>
      game.status === "PENDING" && game.players.includes(props.username)
  );
});

const navigateToRoom = (roomId: string) => {
  if (!roomId || navigatedRoomId.value === roomId) return;
  navigatedRoomId.value = roomId;
  router.push({ path: `/game/${roomId}` });
};

const parseGameResponse = async (response: Response) => {
  try {
    const data = await response.json();
    if (typeof data?.body === "string") {
      return JSON.parse(data.body);
    }
    return data ?? {};
  } catch {
    return {};
  }
};

watch(allGames, (games) => {
  for (const game of games) {
    if (!game.players.includes(props.username)) continue;

    if (game.status === "PENDING") {
      joinedPendingRoomIds.add(game.id);
      if (game.players.length === game.maxPlayers) {
        navigateToRoom(game.id);
        return;
      }
    } else if (
      game.status === "STARTED" &&
      joinedPendingRoomIds.has(game.id)
    ) {
      navigateToRoom(game.id);
      return;
    }
  }
});

const createRoom = async (payload: {
  maxPlayers: number;
  includeCreator: boolean;
  bots: BotSlot[];
}) => {
  try {
    const response = await fetch("/games", {
      method: "POST",
      body: JSON.stringify({
        players: payload.includeCreator ? [props.username] : [],
        createdBy: props.username,
        maxPlayers: payload.maxPlayers,
        includeCreator: payload.includeCreator,
        bots: payload.bots,
      }),
    });

    const parsed = await parseGameResponse(response);
    isCreateGameModalActive.value = false;

    const room: CreatedGame | undefined = parsed?.room;
    if (parsed?.gameStarted && room?.id) {
      navigateToRoom(room.id);
      return;
    }

    if (payload.includeCreator && room?.id) {
      joinedPendingRoomIds.add(room.id);
    }
    send("GET_GAMES");
  } catch (err) {
    console.error(err);
  }
};

const connectRoom = async (roomId: string | number) => {
  if (roomConnections.value[roomId]) {
    return;
  }

  try {
    const normalizedRoomId = String(roomId);
    joinedPendingRoomIds.add(normalizedRoomId);

    const response = await fetch("/games", {
      method: "PUT",
      body: JSON.stringify({
        action: { type: "JOIN_ROOM" },
        payload: { username: props.username, roomId: normalizedRoomId },
      }),
    });

    const parsed = await parseGameResponse(response);
    if (parsed?.gameStarted) {
      navigateToRoom(normalizedRoomId);
      return;
    }
    send("GET_GAMES");
  } catch (error) {
    console.error(error);
  }
};

const addBot = async ({
  roomId,
  difficulty,
}: {
  roomId: string;
  difficulty: BotDifficulty;
}) => {
  try {
    const response = await fetch("/games", {
      method: "PUT",
      body: JSON.stringify({
        action: { type: "ADD_BOT" },
        payload: { username: props.username, roomId, difficulty },
      }),
    });

    const parsed = await parseGameResponse(response);
    if (parsed?.gameStarted) {
      navigateToRoom(roomId);
      return;
    }
    send("GET_GAMES");
  } catch (error) {
    console.error(error);
  }
};

const removeBot = async ({
  roomId,
  botUsername,
}: {
  roomId: string;
  botUsername: string;
}) => {
  try {
    await fetch("/games", {
      method: "PUT",
      body: JSON.stringify({
        action: { type: "REMOVE_BOT" },
        payload: { username: props.username, roomId, botUsername },
      }),
    });
    send("GET_GAMES");
  } catch (error) {
    console.error(error);
  }
};

const spectateRoom = (roomId: string) => {
  navigateToRoom(roomId);
};

const closeModal = () => {
  isCreateGameModalActive.value = false;
};

onMounted(() => {
  send("GET_GAMES");
  pollInterval = setInterval(() => {
    send("GET_GAMES");
  }, 1000);
});

onUnmounted(() => {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
});
</script>

<template>
  <div class="rooms-stack">
    <section class="rooms-panel">
      <CreateRoomModal
        v-if="isCreateGameModalActive"
        :creator-username="props.username"
        @create-game="createRoom"
        @close-modal="closeModal"
      />

      <div class="rooms-header">
        <div class="rooms-header__left">
          <GameIcon name="dice" :size="22" />
          <div>
            <h2 class="rooms-title">AVAILABLE TABLES</h2>
            <p class="rooms-sub">
              {{ availableGames.length }} open
              {{ availableGames.length === 1 ? "room" : "rooms" }} waiting for
              players
            </p>
          </div>
        </div>

        <BaseButton
          v-if="!isConnectedToRoom"
          variant="secondary"
          size="md"
          @click="isCreateGameModalActive = true"
        >
          <GameIcon name="plus" :size="18" />
          <span>CREATE GAME</span>
        </BaseButton>
        <RetroBadge v-else variant="positive">IN ROOM</RetroBadge>
      </div>

      <div class="rooms-body">
        <div v-if="availableGames.length" class="rooms-list">
          <AvailableRoomCard
            v-for="game in availableGames"
            :key="game.id"
            :game-id="game.id"
            :max-players="game.maxPlayers"
            :players="game.players"
            :bots="game.bots"
            :created-by="game.createdBy"
            :current-username="props.username"
            :status="game.status"
            @join-game="connectRoom"
            @add-bot="addBot"
            @remove-bot="removeBot"
          />
        </div>

        <div v-else class="rooms-empty">
          <div class="rooms-empty__icon">
            <GameIcon name="dice" :size="36" />
          </div>
          <h3>NO OPEN GAMES YET</h3>
          <p>
            Spin up a new Monopoly UA match against friends, AI bots, or watch
            an all-bot showdown.
          </p>
          <BaseButton
            v-if="!isConnectedToRoom"
            variant="primary"
            size="md"
            @click="isCreateGameModalActive = true"
          >
            <GameIcon name="plus" :size="18" />
            <span>CREATE FIRST GAME</span>
          </BaseButton>
        </div>
      </div>
    </section>

    <section class="rooms-panel">
      <div class="rooms-header rooms-header--live">
        <div class="rooms-header__left">
          <GameIcon name="bolt" :size="22" />
          <div>
            <h2 class="rooms-title">LIVE MATCHES</h2>
            <p class="rooms-sub">
              {{ liveGames.length }} active
              {{ liveGames.length === 1 ? "match" : "matches" }} available to
              spectate
            </p>
          </div>
        </div>

        <RetroBadge variant="gold">{{ liveGames.length }} LIVE</RetroBadge>
      </div>

      <div class="rooms-body rooms-body--compact">
        <div v-if="liveGames.length" class="rooms-list">
          <AvailableRoomCard
            v-for="game in liveGames"
            :key="game.id"
            :game-id="game.id"
            :max-players="game.maxPlayers"
            :players="game.players"
            :bots="game.bots"
            :created-by="game.createdBy"
            :current-username="props.username"
            :status="game.status"
            @spectate-game="spectateRoom"
          />
        </div>

        <div v-else class="live-empty">
          No live matches right now. Launch an
          <strong>ALL-BOT SPECTATE</strong> match from
          <strong>CREATE GAME</strong> to watch bots battle live.
        </div>
      </div>
    </section>
  </div>
</template>

<style lang="scss" scoped>
.rooms-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.rooms-panel {
  background: var(--surface);
  border: 2.5px solid var(--outline);
  border-radius: var(--radius-lg);
  box-shadow: var(--panel-shadow);
  overflow: hidden;
}

.rooms-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  padding: 14px 20px;
  background: var(--accent);
  color: #ffffff;
  border-bottom: 2.5px solid var(--outline);

  &--live {
    background: var(--positive);
  }
}

.rooms-header__left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rooms-title {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.1;
}

.rooms-sub {
  font-size: 12px;
  opacity: 0.9;
  margin-top: 2px;
}

.rooms-body {
  padding: 20px;
  min-height: 40vh;
  background: var(--surface-alt);

  &--compact {
    min-height: 0;
  }
}

.rooms-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rooms-empty {
  min-height: 34vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
  padding: 32px 16px;
  background: var(--surface);
  border: 2px dashed var(--rule-muted);
  border-radius: var(--radius-md);

  h3 {
    font-family: var(--font-display);
    font-size: 18px;
    color: var(--ink);
  }

  p {
    font-size: 13px;
    color: var(--ink-muted);
    max-width: 360px;
    margin-bottom: 6px;
  }
}

.rooms-empty__icon {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  background: var(--gold-light);
  border: 2.5px solid var(--outline);
  box-shadow: 0 4px 0 var(--outline);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ink);
  margin-bottom: 4px;
}

.live-empty {
  padding: 20px 16px;
  text-align: center;
  background: var(--surface);
  border: 2px dashed var(--rule-muted);
  border-radius: var(--radius-md);
  font-size: 13px;
  color: var(--ink-muted);
}
</style>