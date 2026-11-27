import test from "node:test";
import assert from "node:assert/strict";
import {
  colors,
  defaultPlayerTemplate,
  defaultPropertyGroups,
  defaultTiles,
} from "~/server/constants";
import { decideBotAction, getActingBot } from "~/server/utils/bots/decisionEngine";
import { handleRollDice } from "~/server/utils/gameActions/handleRollDice";
import { buyProperty } from "~/server/utils/gameActions/buyProperty";
import { passProperty } from "~/server/utils/gameActions/passProperty";
import { bidAuctionProperty } from "~/server/utils/gameActions/bidAuctionProperty";
import { passAuctionProperty } from "~/server/utils/gameActions/passAuctionProperty";
import { payRent } from "~/server/utils/gameActions/payRent";
import { payTax } from "~/server/utils/gameActions/payTax";
import { payChance } from "~/server/utils/gameActions/payChance";
import { payJail } from "~/server/utils/gameActions/payJail";
import { mortgageProperty } from "~/server/utils/gameActions/mortgageProperty";
import { buybackProperty } from "~/server/utils/gameActions/buybackProperty";
import { upgradeProperty } from "~/server/utils/gameActions/upgradeProperty";
import { sellProperty } from "~/server/utils/gameActions/sellProperty";
import { sendTrade } from "~/server/utils/gameActions/sendTrade";
import { acceptTrade } from "~/server/utils/gameActions/acceptTrade";
import { declineTrade } from "~/server/utils/gameActions/declineTrade";

function createSeededRng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function createBotGame(botConfigs) {
  const players = botConfigs.map((cfg, idx) => ({
    ...structuredClone(defaultPlayerTemplate),
    username: cfg.username,
    color: colors[idx % colors.length],
    isBot: true,
    botDifficulty: cfg.difficulty,
    botRiskLevel: cfg.riskLevel ?? 0.5,
  }));

  return {
    id: "sim-game-1",
    associatedRoomId: "sim-room-1",
    status: "STARTED",
    winnerUsername: null,
    eliminatedPlayers: [],
    currentTurn: players[0].username,
    currentAction: "roll",
    players,
    gameLog: [],
    board: {
      tiles: structuredClone(defaultTiles),
      groups: structuredClone(defaultPropertyGroups),
    },
    activeChance: { type: "" },
    auctionParticipants: [],
    activeAuctionBidder: "",
    auctionBidAmount: 0,
    auctionedTileId: null,
    activeTrade: {
      from: "",
      to: "",
      given: [],
      received: [],
      givenMoney: 0,
      receivedMoney: 0,
      returnAction: null,
    },
    lastDiceRoll: null,
    declinedTrades: [],
  };
}

function dispatchAction(game, decision) {
  const idx = game.players.findIndex((p) => p.username === game.currentTurn);
  const current = idx >= 0 ? game.players[idx] : undefined;

  switch (decision.action) {
    case "ROLL_DICE":
      return handleRollDice(game, current, idx, decision);
    case "BUY_PROPERTY":
      buyProperty(game, current, idx, decision);
      return null;
    case "PASS_PROPERTY":
      passProperty(game, current, idx, decision);
      return null;
    case "BID_AUCTION_PROPERTY":
      bidAuctionProperty(game, current, idx, decision);
      return null;
    case "PASS_AUCTION_PROPERTY":
      passAuctionProperty(game, current, idx, decision);
      return null;
    case "PAY_RENT":
      payRent(game, current, idx, decision);
      return null;
    case "PAY_TAX":
      payTax(game, current, idx, decision);
      return null;
    case "PAY_CHANCE":
      payChance(game, current, idx, decision);
      return null;
    case "JAIL_PAY":
      payJail(game, current);
      return null;
    case "MORTGAGE_PROPERTY":
      mortgageProperty(game, current, decision);
      return null;
    case "BUY_BACK_PROPERTY":
      buybackProperty(game, current, decision);
      return null;
    case "UPGRADE_PROPERTY":
      upgradeProperty(game, current, decision);
      return null;
    case "SELL_PROPERTY":
      sellProperty(game, current, decision);
      return null;
    case "TRADE":
      sendTrade(game, decision);
      return null;
    case "ACCEPT_TRADE":
      acceptTrade(game);
      return null;
    case "DECLINE_TRADE":
      declineTrade(game);
      return null;
    default:
      throw new Error(`Unexpected action ${decision.action}`);
  }
}

function assertBoardInvariants(game) {
  const activeNames = new Set(game.players.map((p) => p.username));

  for (const player of game.players) {
    assert.ok(
      Number.isFinite(player.balance),
      `Balance must be finite for ${player.username}, got ${player.balance}`
    );
    assert.ok(
      player.balance >= 0,
      `Balance must be non-negative for ${player.username}, got ${player.balance}`
    );
    assert.ok(
      player.position >= 1 && player.position <= 40,
      `Position out of bounds for ${player.username}: ${player.position}`
    );
  }

  for (const tile of game.board.tiles) {
    if (tile.owner) {
      assert.ok(
        activeNames.has(tile.owner),
        `Tile ${tile.id} owned by non-active player ${tile.owner}`
      );
      const owner = game.players.find((p) => p.username === tile.owner);
      assert.ok(
        owner.properties.includes(tile.id),
        `Tile ${tile.id} owner ${tile.owner} missing from player.properties`
      );
    }
  }
}

function runSimulatedGame(botConfigs, seed, maxSteps = 2500) {
  const game = createBotGame(botConfigs);
  const rng = createSeededRng(seed);
  let lastTurnOwner = "";
  let proposedTradeThisTurn = false;
  let proposedLiquidationTradeThisTurn = false;
  let mortgagedTileIdsThisTurn = [];
  let turnStepCount = 0;
  const cooldowns = {};
  const actionCounts = {};

  let steps = 0;

  while (game.status !== "ENDED" && steps < maxSteps) {
    const actingBot = getActingBot(game);
    assert.ok(actingBot, `Expected an acting bot at step ${steps}`);

    const isOwnTurn = actingBot.username === game.currentTurn;
    if (isOwnTurn && lastTurnOwner !== game.currentTurn) {
      lastTurnOwner = game.currentTurn;
      proposedTradeThisTurn = false;
      proposedLiquidationTradeThisTurn = false;
      mortgagedTileIdsThisTurn = [];
      turnStepCount = 0;
      const botCd = cooldowns[actingBot.username];
      if (botCd) {
        for (const t of Object.keys(botCd)) {
          if (botCd[t] <= 1) delete botCd[t];
          else botCd[t] -= 1;
        }
      }
    }

    const decision = decideBotAction(
      game,
      actingBot,
      {
        proposedTradeThisTurn: isOwnTurn ? proposedTradeThisTurn : false,
        proposedLiquidationTradeThisTurn: isOwnTurn
          ? proposedLiquidationTradeThisTurn
          : false,
        mortgagedTileIdsThisTurn: isOwnTurn ? [...mortgagedTileIdsThisTurn] : [],
        turnStepCount: isOwnTurn ? turnStepCount : 0,
        tradeCooldownByTarget: { ...(cooldowns[actingBot.username] ?? {}) },
      },
      rng
    );

    assert.ok(
      decision,
      `Bot ${actingBot.username} returned null decision for action ${game.currentAction}`
    );

    const beforeTurn = game.currentTurn;
    const beforeAction = game.currentAction;
    const beforeSnapshot = JSON.stringify(game);
    const move = dispatchAction(game, decision);
    const afterSnapshot = JSON.stringify(game);

    assert.ok(
      move !== null || beforeSnapshot !== afterSnapshot,
      `No-op action ${decision.action} by ${actingBot.username} at step ${steps} (currentAction=${game.currentAction})`
    );

    actionCounts[decision.action] = (actionCounts[decision.action] ?? 0) + 1;

    if (isOwnTurn && decision.action === "MORTGAGE_PROPERTY") {
      mortgagedTileIdsThisTurn.push(decision.payload.propertyId);
    }

    if (decision.action === "TRADE") {
      if (isOwnTurn) {
        if (beforeAction === "roll") {
          proposedTradeThisTurn = true;
        } else {
          proposedLiquidationTradeThisTurn = true;
        }
      }
      const target = decision.payload.tradePlayerUsername;
      cooldowns[actingBot.username] = cooldowns[actingBot.username] ?? {};
      cooldowns[actingBot.username][target] = 3;
    }

    if (
      isOwnTurn &&
      [
        "MORTGAGE_PROPERTY",
        "BUY_BACK_PROPERTY",
        "UPGRADE_PROPERTY",
        "SELL_PROPERTY",
        "JAIL_PAY",
        "TRADE",
      ].includes(decision.action)
    ) {
      turnStepCount += 1;
    }

    if (isOwnTurn && decision.action === "ROLL_DICE") {
      turnStepCount = 0;
      proposedLiquidationTradeThisTurn = false;
      mortgagedTileIdsThisTurn = [];
    }

    if (game.currentTurn !== beforeTurn) {
      lastTurnOwner = "";
      proposedTradeThisTurn = false;
      proposedLiquidationTradeThisTurn = false;
      mortgagedTileIdsThisTurn = [];
      turnStepCount = 0;
    }

    assertBoardInvariants(game);
    steps += 1;
  }

  return { game, actionCounts, steps };
}

test("full 3-bot game (EASY, MEDIUM, HARD) runs cleanly without soft-locks, no-op spins, or state corruption", () => {
  const { game, actionCounts } = runSimulatedGame(
    [
      { username: "KyivBot", difficulty: "EASY", riskLevel: 0.4 },
      { username: "LvivBot", difficulty: "MEDIUM", riskLevel: 0.6 },
      { username: "OdesaBot", difficulty: "HARD", riskLevel: 0.85 },
    ],
    42
  );

  assert.ok(actionCounts.ROLL_DICE > 20, "Bots should roll dice many times");
  assert.ok(actionCounts.BUY_PROPERTY > 5, "Bots should purchase properties");
  assert.ok(game.gameLog.length > 30, "Game log should narrate bot actions");

  if (game.status === "ENDED") {
    assert.equal(game.players.length, 1);
    assert.equal(game.winnerUsername, game.players[0].username);
  }
});

test("multi-seed 4-bot HARD/MEDIUM games with varied risk profiles run cleanly without soft-locks or corruption", () => {
  for (const seed of [7, 19, 101, 2026]) {
    const { game, actionCounts } = runSimulatedGame(
      [
        { username: "CautiousHard", difficulty: "HARD", riskLevel: 0.1 },
        { username: "BalancedMed", difficulty: "MEDIUM", riskLevel: 0.5 },
        { username: "AggressiveHard", difficulty: "HARD", riskLevel: 0.85 },
        { username: "RecklessHard", difficulty: "HARD", riskLevel: 0.98 },
      ],
      seed,
      1800
    );

    assert.ok(actionCounts.ROLL_DICE > 20, `seed ${seed}: expected >20 rolls`);
    assert.ok(actionCounts.BUY_PROPERTY > 10, `seed ${seed}: expected >10 buys`);
    if (game.status === "ENDED") {
      assert.equal(game.players.length, 1);
      assert.equal(game.winnerUsername, game.players[0].username);
    }
  }
});

test("repeated identical trade sent to bot after decline is always declined with zero randomness", () => {
  const game = createBotGame([
    { username: "HumanPlayer", difficulty: "EASY" },
    { username: "OdesaBot", difficulty: "HARD" },
  ]);
  game.players[0].isBot = false;
  game.players[0].botDifficulty = null;

  // Give Human tile 2 ($60) and Bot tile 40 ($400)
  const tile2 = game.board.tiles.find((t) => t.id === 2);
  const tile40 = game.board.tiles.find((t) => t.id === 40);
  tile2.owner = "HumanPlayer";
  game.players[0].properties.push(2);
  tile40.owner = "OdesaBot";
  game.players[1].properties.push(40);

  for (let attempt = 0; attempt < 10; attempt++) {
    dispatchAction(game, {
      action: "TRADE",
      payload: {
        username: "HumanPlayer",
        tradePlayerUsername: "OdesaBot",
        tradeTiles: {
          given: [2],
          received: [40],
          givenMoney: 0,
          receivedMoney: 0,
        },
      },
    });

    const actingBot = getActingBot(game);
    assert.equal(actingBot?.username, "OdesaBot");

    const decision = decideBotAction(game, actingBot);
    assert.equal(decision?.action, "DECLINE_TRADE");
    dispatchAction(game, decision);
    assert.equal(game.currentAction, "roll");
  }

  assert.equal(game.declinedTrades.length, 1, "Declined trade signature should be deduplicated");
});
