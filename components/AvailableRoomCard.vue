<script setup lang="ts">
defineProps({
  maxPlayers: {
    type: Number,
    required: true
  },
  players: {
    type: Array,
    required: true
  },
  gameId: {
    type: String,
    required: true
  }
})

defineEmits(['joinGame'])
</script>

<template>
  <div class="card">
    <h3>Game #{{ gameId }}</h3>
    <div class="playersContainer">
      <div v-for="player in maxPlayers">
        <div class="playerCard">
          <div class="avatarContainer">
            <div v-if="players[player - 1]" class="avatar"></div>
            <BaseButton v-else @click="$emit('joinGame', gameId)" class="avatarPlaceholder" bg-color="transparent"
              text-color="black">+</BaseButton>

          </div>
          <p class="playerName" v-if="players[player - 1]">
            {{ players[player - 1] }}
          </p>
          <p class="playerName" v-else>Join now</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.card {
  max-width: 800px;
  margin: 1rem auto;

  h3 {
    margin-bottom: 1rem;
  }
}

.playersContainer {
  display: flex;
  gap: 2rem;

  .playerCard {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
}

.avatarContainer {
  width: 5rem;
  height: 5rem;

  .avatar {
    background-color: black;
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }

  .avatarPlaceholder {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    font-size: 8rem;
  }
}

.playerName {
  text-align: center;
  width: 100px;
  display: inline-block;
  white-space: nowrap;
  overflow: hidden !important;
  text-overflow: ellipsis;

}
</style>