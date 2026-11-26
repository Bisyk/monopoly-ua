<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { getPlayerInitials } from "~/utils/cartridgeTheme";

const username = ref(
  sessionStorage.getItem("username") ||
    `User-${Math.random().toString(36).substring(2, 10)}`
);

const initials = computed(() => getPlayerInitials(username.value));

const saveUsernameToSessionStorage = (value: string) => {
  sessionStorage.setItem("username", value);
};

onMounted(() => {
  saveUsernameToSessionStorage(username.value);
});
</script>

<template>
  <div class="lobby-stack">
    <section class="profile-bar">
      <div class="profile-bar__identity">
        <div class="profile-avatar">{{ initials }}</div>
        <div>
          <label for="player-username-input" class="profile-label">
            PLAYER CALLSIGN
          </label>
          <p class="profile-hint">
            Shown on your board token and match log.
          </p>
        </div>
      </div>

      <div class="profile-input-wrap">
        <GameIcon name="user" :size="18" class="profile-input-icon" />
        <input
          id="player-username-input"
          type="text"
          class="profile-input"
          v-model="username"
          placeholder="Enter username..."
          @input="
            (e) => {
              saveUsernameToSessionStorage(
                (e.target as HTMLInputElement).value
              );
            }
          "
        />
      </div>
    </section>

    <AvailableRooms :username="username" />
  </div>
</template>

<style scoped lang="scss">
.lobby-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  background: var(--surface);
  border: 2.5px solid var(--outline);
  border-radius: var(--radius-lg);
  box-shadow: var(--panel-shadow);
}

.profile-bar__identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.profile-avatar {
  width: 42px;
  height: 42px;
  border-radius: 6px;
  background: var(--accent);
  color: #ffffff;
  border: 2px solid var(--outline);
  box-shadow: 0 3px 0 var(--outline);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.profile-label {
  display: block;
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--ink);
}

.profile-hint {
  font-size: 12px;
  color: var(--ink-muted);
  margin-top: 2px;
}

.profile-input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex: 1 1 240px;
  max-width: 340px;
}

.profile-input-icon {
  position: absolute;
  left: 12px;
  color: var(--ink-muted);
  pointer-events: none;
}

.profile-input {
  width: 100%;
  padding: 10px 12px 10px 38px;
  background: var(--surface-alt);
  color: var(--ink);
  border: 2px solid var(--outline);
  border-radius: var(--radius-md);
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 700;
  outline: none;
  transition: background-color 0.1s ease, box-shadow 0.1s ease;

  &:focus {
    background: var(--surface);
    box-shadow: 0 0 0 3px rgba(38, 103, 232, 0.25);
  }
}
</style>