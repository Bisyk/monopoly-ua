import test from "node:test";
import assert from "node:assert/strict";
import { handleRollDice } from "~/server/utils/gameActions/handleRollDice";
import { defaultPlayerTemplate, defaultPropertyGroups, defaultTiles } from "~/server/constants";

function createTestGame(playerOverrides = []) {
  const players = [
    {
      ...structuredClone(defaultPlayerTemplate),
      username: "alice",
      color: "#9999FF",
      ...playerOverrides[0],
    },
    {
      ...structuredClone(defaultPlayerTemplate),
      username: "bob",
      color: "#99CC99",
      ...playerOverrides[1],
    },
  ];

  return {
    id: "game-1",
    associatedRoomId: "room-1",
    status: "STARTED",
    winnerUsername: null,
    eliminatedPlayers: [],
    currentTurn: "alice",
    currentAction: "roll",
    players,
    gameLog: [],
    board: {
      tiles: structuredClone(defaultTiles),
      groups: structuredClone(defaultPropertyGroups),
    },
    activeChance: { type: null },
    auctionParticipants: [],
    activeTrade: null,
  };
}

function rollMessage(left, right) {
  return {
    action: "ROLL_DICE",
    payload: {
      username: "alice",
      turnResult: { left, right },
    },
  };
}

test("handleRollDice emits a single step segment for a normal roll", () => {
  const game = createTestGame([{ position: 1 }]);
  const move = handleRollDice(game, game.players[0], 0, rollMessage(2, 4));

  assert.ok(move);
  assert.equal(move.username, "alice");
  assert.ok(typeof move.moveId === "string" && move.moveId.length > 0);
  assert.deepEqual(move.segments, [{ from: 1, to: 7, mode: "step" }]);
  assert.equal(game.players[0].position, 7);
});

test("handleRollDice wraps clockwise around Go (40 -> 1)", () => {
  const game = createTestGame([{ position: 38 }]);
  const move = handleRollDice(game, game.players[0], 0, rollMessage(2, 3));

  assert.ok(move);
  assert.deepEqual(move.segments, [{ from: 38, to: 3, mode: "step" }]);
  assert.equal(game.players[0].position, 3);
});

test("handleRollDice emits direct jail segment and clears doubles state on 3rd consecutive double", () => {
  const game = createTestGame([{ position: 15, doublesInRow: 2, bonusRoll: true }]);
  const move = handleRollDice(game, game.players[0], 0, rollMessage(4, 4));

  assert.ok(move);
  assert.deepEqual(move.segments, [{ from: 15, to: 11, mode: "direct" }]);
  assert.equal(game.players[0].position, 11);
  assert.equal(game.players[0].jailed, true);
  assert.equal(game.players[0].doublesInRow, 0);
  assert.equal(game.players[0].bonusRoll, false);
  assert.equal(game.currentTurn, "bob");
});

test("handleRollDice emits step + direct segments and advances turn when rolling doubles onto Go to Jail", () => {
  const game = createTestGame([{ position: 25 }]);
  const move = handleRollDice(game, game.players[0], 0, rollMessage(3, 3));

  assert.ok(move);
  assert.deepEqual(move.segments, [
    { from: 25, to: 31, mode: "step" },
    { from: 31, to: 11, mode: "direct" },
  ]);
  assert.equal(game.players[0].position, 11);
  assert.equal(game.players[0].jailed, true);
  assert.equal(game.players[0].doublesInRow, 0);
  assert.equal(game.players[0].bonusRoll, false);
  assert.equal(game.currentTurn, "bob");
});

test("handleRollDice emits step + direct segments and advances turn when Chance sends a doubles roller to jail", () => {
  const originalRandom = Math.random;
  // Index 2 in chances is { type: "goToJail", tileId: 11 } (4 items -> 0.6 selects index 2)
  Math.random = () => 0.6;

  try {
    const game = createTestGame([{ position: 2 }]);
    // 2 + (3 + 3) = 8 (Chance tile)
    const move = handleRollDice(game, game.players[0], 0, rollMessage(3, 3));

    assert.ok(move);
    assert.deepEqual(move.segments, [
      { from: 2, to: 8, mode: "step" },
      { from: 8, to: 11, mode: "direct" },
    ]);
    assert.equal(game.players[0].position, 11);
    assert.equal(game.players[0].jailed, true);
    assert.equal(game.players[0].doublesInRow, 0);
    assert.equal(game.players[0].bonusRoll, false);
    assert.equal(game.currentTurn, "bob");
  } finally {
    Math.random = originalRandom;
  }
});

test("handleRollDice returns null when jailed player fails to roll doubles", () => {
  const game = createTestGame([{ position: 11, jailed: true, turnsInJail: 3 }]);
  const move = handleRollDice(game, game.players[0], 0, rollMessage(2, 5));

  assert.equal(move, null);
  assert.equal(game.players[0].position, 11);
  assert.equal(game.players[0].jailed, true);
  assert.equal(game.players[0].turnsInJail, 2);
  assert.equal(game.currentTurn, "bob");
});
