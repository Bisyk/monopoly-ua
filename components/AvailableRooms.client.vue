<script setup lang="ts">
import { useRouter } from "vue-router";
import AvailableRoomCard from "./AvailableRoomCard.vue";
import CreateRoomModal from "./CreateRoomModal.vue";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useWebsocketManager } from "~/composables/useWebsocketManager";
import type { CreatedGame } from "~/types";

const props = defineProps({
  username: { type: String, required: true },
});

const allGames = ref<CreatedGame[]>([]);
const roomConnections = ref<{
  [key: string]: { status: any; send: any; open: any; close: any };
}>({});
const isCreateGameModalActive = ref(false);
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

const isConnectedToRoom = computed(() => {
  return allGames.value.some((game) => game.players.includes(props.username));
});

watch(allGames, () => {
  if (
    allGames.value.some(
      (game) =>
        game.players.includes(props.username) && game.status === "PENDING"
    )
  ) {
    const game = allGames.value.find(
      (game) =>
        game.players.includes(props.username) && game.status === "PENDING"
    );
    if (game && game.players.length === game.maxPlayers) {
      startGame(game);
    }
  }
});

const createRoom = async (maxPlayers: number) => {
  try {
    await fetch("/games", {
      method: "POST",
      body: JSON.stringify({
        players: [props.username],
        createdBy: props.username,
        maxPlayers,
      }),
    });

    isCreateGameModalActive.value = false;
  } catch (err) {
    console.error(err);
  }
};

const connectRoom = async (roomId: string | number) => {
  if (roomConnections.value[roomId]) {
    return;
  }

  try {
    await fetch("/games", {
      method: "PUT",
      body: JSON.stringify({
        action: { type: "JOIN_ROOM" },
        payload: { username: props.username, roomId },
      }),
    });
  } catch (error) {
    console.error(error);
  }
};

const startGame = async (game: CreatedGame) => {
  try {
    for (const player of game.players) {
      if (player === props.username) {
        router.push({ path: `/game/${game.id}` });
      }
    }
  } catch (error) {
    console.error(error);
  }
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
  <section class="rooms-panel">
    <CreateRoomModal
      v-if="isCreateGameModalActive"
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
          @joinGame="connectRoom"
        />
      </div>

      <div v-else class="rooms-empty">
        <div class="rooms-empty__icon">
          <GameIcon name="dice" :size="36" />
        </div>
        <h3>NO OPEN GAMES YET</h3>
        <p>Spin up a new Monopoly UA match and invite your squad.</p>
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
</template>

<style lang="scss" scoped>
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
  opacity: 0.88;
  margin-top: 2px;
}

.rooms-body {
  padding: 20px;
  min-height: 54vh;
  background: var(--surface-alt);
}

.rooms-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rooms-empty {
  min-height: 46vh;
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
    max-width: 320px;
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
</style>