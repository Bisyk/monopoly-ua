<script setup lang="ts">
  import type { PropType } from "vue";
  import type { Tile } from "~/types";

  defineProps({
    tilesState: {
      type: Array as PropType<Tile[]>,
      required: true,
    },
    gameState: {
      type: Object,
      required: true,
    },
    showTileInfo: {
      type: Function,
      required: true,
    },
    players: {
      type: Array,
      required: true,
    },
    player: {
      type: Object,
      required: true,
    },
  });

  defineEmits(["activateTrade"]);
</script>

<template>
  <div class="main-container">
    <div class="table">
      <div class="players-container">
        <PlayerContainer
          v-for="playerFromPlayers in gameState.players"
          :key="playerFromPlayers.username"
          :player="player"
          :playerFromPlayers="playerFromPlayers"
          @activateTrade="$emit('activateTrade', playerFromPlayers.username)"
        />
      </div>

      <div
        v-if="tilesState && tilesState.length"
        class="board"
      >
        <div class="center">
          <div>
            <div
              v-if="gameState.gameLog && gameState?.gameLog.length"
              class="gameLog"
            >
              <p v-for="entry in gameState?.gameLog">
                {{ entry.username }}: {{ entry.msg }}
              </p>
            </div>
          </div>
        </div>
        <!-- Go Tile -->
        <BoardTile
          :tile="tilesState[0]"
          :players="gameState.players"
        />
        <!-- Top Row -->
        <div class="row horizontal-row top-row">
          <BoardTile
            v-for="tile in tilesState.slice(1, 10)"
            :tile="tile"
            :players="gameState.players"
            @show-tile-info="(e: Event, tile: Tile) => showTileInfo(e, tile)"
            :tileGroups="[
              gameState.boardState.groups[0],
              gameState.boardState.groups[1],
            ]"
          />
        </div>
        <!-- Jail Tile -->
        <BoardTile
          :tile="tilesState[10]"
          :type="tilesState[10].type"
          :players="gameState.players"
        />
        <!-- Right Row -->
        <div class="row vertical-row right-row">
          <BoardTile
            v-for="tile in tilesState.slice(11, 20)"
            :tile="tile"
            :players="gameState.players"
            @show-tile-info="(e: Event, tile: Tile) => showTileInfo(e, tile)"
            :tileGroups="[
              gameState.boardState.groups[2],
              gameState.boardState.groups[3],
            ]"
          />
        </div>
        <!-- Free Parking Tile -->
        <BoardTile
          :tile="tilesState[20]"
          :players="gameState.players"
        />
        <!-- Bottom Row -->
        <div class="row horizontal-row bottom-row">
          <BoardTile
            v-for="tile in tilesState.slice(21, 30).reverse()"
            :tile="tile"
            :players="gameState.players"
            @show-tile-info="(e: Event, tile: Tile) => showTileInfo(e, tile)"
            :tileGroups="[
              gameState.boardState.groups[4],
              gameState.boardState.groups[5],
            ]"
          />
        </div>
        <!-- Go to Jail Tile -->
        <BoardTile
          :tile="tilesState[30]"
          :players="gameState.players"
        />
        <!-- Left Row -->
        <div class="row vertical-row left-row">
          <BoardTile
            v-for="tile in tilesState.slice(31, 40).reverse()"
            :tile="tile"
            :players="gameState.players"
            @show-tile-info="(e: Event, tile: Tile) => showTileInfo(e, tile)"
            :tileGroups="[
              gameState.boardState.groups[6],
              gameState.boardState.groups[7],
            ]"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
  $tile-size: 7vmin;
  $corner-tile-size: 14vmin;

  $tile-size-l: 6vmin;
  $corner-tile-size-l: 12vmin;

  .gameLog {
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }

  .main-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
    aspect-ratio: 4/3;
  }

  .table {
    display: flex;
    flex-direction: row;
    place-items: center;
    height: 100vh;
    gap: 4vmin;
    margin-right: 10vmin;
    border: 1px solid red;

    .players-container {
      padding: 3.5vmin 0 3.5vmin 0;
      display: flex;
      flex-direction: column;
      width: 15vmin;
      height: 100%;
      gap: 2vmin;
      justify-content: center;
    }
  }

  .board {
    display: grid;
    grid-template-columns: $corner-tile-size repeat(9, $tile-size) $corner-tile-size; // Use viewport width units for columns
    grid-template-rows: $corner-tile-size repeat(9, $tile-size) $corner-tile-size; // Use viewport width units for rows
    grid-gap: 2px;
    max-height: 95vmin;
    width: fit-content;
  }

  .center {
    position: relative;
    grid-column: 2 / 11;
    grid-row: 2 / 11;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(7, 1fr);
    justify-items: center;
    align-items: center;
  }

  // =================
  // Rows and Spaces
  // =================

  .row {
    display: grid;
    grid-gap: 2px;
  }

  .horizontal-row {
    grid-template-columns: repeat(
      9,
      $tile-size
    ); // Adjust column size based on viewport width
    grid-template-rows: calc($corner-tile-size);
  }

  .vertical-row {
    grid-template-columns: $corner-tile-size;
    grid-template-rows: repeat(
      9,
      $tile-size
    ); // Adjust row size based on viewport width

    .container {
      top: 50%;
      left: 50%;
    }
  }

  // Specific space styles for different rows
  .bottom-row {
    grid-column: 2 / 11;
    grid-row: 11;
  }

  .left-row {
    grid-column: 1;
    grid-row: 2 / 11;

    .container {
      transform: translate(-50%, -50%) rotate(90deg);
    }
  }

  .top-row {
    grid-column: 2 / 11;
    grid-row: 1;

    .container {
      transform: rotate(0deg);
    }
  }

  .right-row {
    grid-column: 11;
    grid-row: 2 / 11;

    .container {
      transform: translate(-50%, -50%) rotate(-90deg);
    }
  }

  .gameLog {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(126, 126, 126, 0.1);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow-y: scroll;
    scrollbar-width: thin;
    scrollbar-color: #ccc transparent;
    border-radius: 2rem;
  }

  @media (max-width: 890px) {
    .board {
      display: grid;
      grid-template-columns: $corner-tile-size-l repeat(9, $tile-size-l) $corner-tile-size-l; // Use viewport width units for columns
      grid-template-rows: $corner-tile-size-l repeat(9, $tile-size-l) $corner-tile-size-l; // Use viewport width units for rows
      grid-gap: 2px;
      max-height: 95vmin;
      width: fit-content;
    }

    .horizontal-row {
      grid-template-columns: repeat(
        9,
        $tile-size-l
      ); // Adjust column size based on viewport width
      grid-template-rows: calc($corner-tile-size-l);
    }

    .vertical-row {
      grid-template-columns: $corner-tile-size-l;
      grid-template-rows: repeat(
        9,
        $tile-size-l
      ); // Adjust row size based on viewport width

      .container {
        top: 50%;
        left: 50%;
      }
    }

    .players-container {
      width: 10vmin;
    }
  }
</style>
