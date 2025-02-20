<script setup lang="ts">
defineProps({
  tilesState: {
    type: Array,
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
})
</script>

<template>
  <div class="table">
    <div v-if="tilesState && tilesState.length" class="board">
      <div class="center">
        <div>
          <div v-if="gameState.gameLog && gameState?.gameLog.length" class="gameLog">
            <p v-for="entry in gameState?.gameLog">{{ entry.username }}: {{ entry.msg }}</p>
          </div>
        </div>
      </div>

      <!-- Go Tile -->
      <BoardTile :tile="tilesState[0]" :players="gameState.players" />

      <!-- Top Row -->
      <div class="row horizontal-row top-row ">
        <BoardTile v-for="tile in tilesState.slice(1, 10)" :tile="tile" :players="gameState.players"
          @show-tile-info="(e, tile) => showTileInfo(e, tile)" :tileGroups="[gameState.boardState[0].groups[0],gameState.boardState[0].groups[1]]"/>
      </div>

      <!-- Jail Tile -->
      <BoardTile :tile="tilesState[10]" :type="tilesState[10].type" :players="gameState.players" />

      <!-- Right Row -->
      <div class="row vertical-row right-row">
        <BoardTile v-for="tile in tilesState.slice(11, 20)" :tile="tile" :players="gameState.players"
          @show-tile-info="(e, tile) => showTileInfo(e, tile)" :tileGroups="[gameState.boardState[0].groups[2],gameState.boardState[0].groups[3]]"/>
      </div>

      <!-- Free Parking Tile -->
      <BoardTile :tile="tilesState[20]" :players="gameState.players" />

      <!-- Bottom Row -->
      <div class="row horizontal-row bottom-row">
        <BoardTile v-for="tile in tilesState.slice(21, 30).reverse()" :tile="tile" :players="gameState.players"
          @show-tile-info="(e, tile) => showTileInfo(e, tile)" :tileGroups="[gameState.boardState[0].groups[4],gameState.boardState[0].groups[5]]"/>
      </div>

      <!-- Go to Jail Tile -->
      <BoardTile :tile="tilesState[30]" :players="gameState.players" />

      <!-- Left Row -->
      <div class="row vertical-row left-row">
        <BoardTile v-for="tile in tilesState.slice(31, 40).reverse()" :tile="tile" :players="gameState.players"
          @show-tile-info="(e, tile) => showTileInfo(e, tile)" :tileGroups="[gameState.boardState[0].groups[6],gameState.boardState[0].groups[7]]"/>
      </div>

    </div>
  </div>
</template>

<style lang="scss" scoped>
$tile-size: 7vmin; 
$corner-tile-size: 14vmin; 

.gameLog{
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.table {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100vh;
  overflow: hidden;
  position: relative;
}

.board {
  display: grid;
  grid-template-columns: $corner-tile-size repeat(9, $tile-size) $corner-tile-size; // Use viewport width units for columns
  grid-template-rows: $corner-tile-size repeat(9, $tile-size) $corner-tile-size; // Use viewport width units for rows
  grid-gap: 2px;
  margin: 0 auto;
  max-width: 95vmin; 
  max-height: 95vmin;
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
  grid-template-columns: repeat(9, $tile-size); // Adjust column size based on viewport width
  grid-template-rows: calc($corner-tile-size);
}

.vertical-row {
  grid-template-columns: $corner-tile-size;
  grid-template-rows: repeat(9, $tile-size); // Adjust row size based on viewport width

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
</style>