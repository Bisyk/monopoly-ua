import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultPlayerTemplate,
  defaultPropertyGroups,
  defaultTiles,
} from "~/server/constants";
import {
  isTradePreviouslyDeclined,
  recordDeclinedTrade,
} from "~/shared/utils/tradeSignature";
import { sendTrade } from "~/server/utils/gameActions/sendTrade";
import { acceptTrade } from "~/server/utils/gameActions/acceptTrade";
import { declineTrade } from "~/server/utils/gameActions/declineTrade";
import { mortgageProperty } from "~/server/utils/gameActions/mortgageProperty";
import {
  canSurviveWithoutTile,
  decideBotAction,
  evaluateIncomingTrade,
  evaluateTileStrategicValue,
  findBestTradeProposal,
  findBestUnmortgageTile,
  findBestUpgradeTile,
  findPreMortgageTradeOffer,
  findProactiveMortgageForUpgrade,
  getActingBot,
  getActionReserve,
  getAmountOwedForCurrentAction,
  getGameStage,
  getMaxOpponentRent,
  getSafetyReserve,
  planNextLiquidationAction,
} from "~/server/utils/bots";

function createGame(playerOverrides = [], gameOverrides = {}) {
  const defaults = [
    {
      ...structuredClone(defaultPlayerTemplate),
      username: "bot_hard",
      color: "#9999FF",
      isBot: true,
      botDifficulty: "HARD",
    },
    {
      ...structuredClone(defaultPlayerTemplate),
      username: "human",
      color: "#99CC99",
      isBot: false,
      botDifficulty: null,
    },
  ];

  const players = defaults.map((base, idx) => ({
    ...base,
    ...(playerOverrides[idx] ?? {}),
  }));

  if (playerOverrides.length > defaults.length) {
    for (let i = defaults.length; i < playerOverrides.length; i++) {
      players.push({
        ...structuredClone(defaultPlayerTemplate),
        username: `player_${i + 1}`,
        color: "#FF9999",
        ...playerOverrides[i],
      });
    }
  }

  return {
    id: "game-bot-test",
    associatedRoomId: "room-bot-test",
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
    activeChance: { type: null },
    auctionParticipants: [],
    activeAuctionBidder: null,
    auctionBidAmount: null,
    auctionedTileId: null,
    activeTrade: null,
    lastDiceRoll: { left: 3, right: 4 },
    declinedTrades: [],
    ...gameOverrides,
  };
}

function assignTiles(game, username, tileIds, options = {}) {
  const player = game.players.find((p) => p.username === username);
  assert.ok(player, `player ${username} must exist`);

  for (const id of tileIds) {
    const tile = game.board.tiles.find((t) => t.id === id);
    assert.ok(tile, `tile ${id} must exist`);
    tile.owner = username;
    if (options.mortgaged !== undefined) {
      tile.mortgaged = options.mortgaged;
    }
    if (options.rentLevel !== undefined) {
      tile.rentLevel = options.rentLevel;
    }
    if (!player.properties.includes(id)) {
      player.properties.push(id);
    }
  }

  for (const group of game.board.groups) {
    const tiles = group.properties.map((id) =>
      game.board.tiles.find((t) => t.id === id)
    );
    const firstOwner = tiles[0]?.owner;
    group.isFullSet =
      Boolean(firstOwner) && tiles.every((t) => t?.owner === firstOwner);
  }
}

const forbiddenRng = () => {
  throw new Error("rng MUST NOT be called in deterministic path");
};

// =============================================================================
// 1. getActingBot priority & guards
// =============================================================================

test("getActingBot resolves trade -> auction -> currentTurn priority and returns null on ENDED or human", () => {
  const game = createGame([
    { username: "human", isBot: false, botDifficulty: null },
    { username: "botA", isBot: true, botDifficulty: "HARD" },
    { username: "botB", isBot: true, botDifficulty: "EASY" },
  ]);

  // Turn belongs to human
  game.currentTurn = "human";
  game.currentAction = "roll";
  assert.equal(getActingBot(game), null);

  // Trade pending to botA takes priority over human's turn
  game.currentAction = "trade";
  game.activeTrade = {
    from: "human",
    to: "botA",
    given: [2],
    received: [4],
    givenMoney: 0,
    receivedMoney: 0,
  };
  assert.equal(getActingBot(game)?.username, "botA");

  // Trade pending to human returns null even if currentTurn is botA
  game.currentTurn = "botA";
  game.activeTrade.from = "botA";
  game.activeTrade.to = "human";
  assert.equal(getActingBot(game), null);

  // Auction bidder botB takes priority over currentTurn
  game.currentAction = "auction";
  game.activeAuctionBidder = "botB";
  assert.equal(getActingBot(game)?.username, "botB");

  // Auction bidder human returns null
  game.activeAuctionBidder = "human";
  assert.equal(getActingBot(game), null);

  // Ended game always returns null
  game.currentAction = "roll";
  game.currentTurn = "botA";
  game.status = "ENDED";
  assert.equal(getActingBot(game), null);
});

// =============================================================================
// 2. Trade evaluation determinism across EASY, MEDIUM, HARD
// =============================================================================

test("Trade evaluation is 100% deterministic across EASY, MEDIUM, and HARD and never invokes rng", () => {
  for (const difficulty of ["EASY", "MEDIUM", "HARD"]) {
    const game = createGame([
      { username: "human", isBot: false, botDifficulty: null, balance: 1500 },
      { username: "bot", isBot: true, botDifficulty: difficulty, balance: 1200 },
    ]);

    // Bot owns 17, 19 (Group 4 Orange); human offers 20 (completes Orange) for $220
    assignTiles(game, "bot", [17, 19]);
    assignTiles(game, "human", [20]);

    const trade = {
      from: "human",
      to: "bot",
      given: [20],
      received: [],
      givenMoney: 0,
      receivedMoney: 220,
    };

    game.currentTurn = "human";
    game.currentAction = "trade";
    game.activeTrade = trade;

    const bot = game.players[1];
    const baselineEval = evaluateIncomingTrade(game, bot, trade);
    const baselineDecision = decideBotAction(game, bot, undefined, forbiddenRng);

    for (let i = 0; i < 10; i++) {
      assert.deepEqual(evaluateIncomingTrade(game, bot, trade), baselineEval);
      assert.deepEqual(
        decideBotAction(game, bot, undefined, forbiddenRng),
        baselineDecision
      );
    }

    assert.ok(
      baselineDecision?.action === "ACCEPT_TRADE" ||
        baselineDecision?.action === "DECLINE_TRADE"
    );
  }
});

test("EASY trade evaluation accepts fair face value (>= 95%) and rejects lowball offers deterministically", () => {
  const game = createGame([
    { username: "human", isBot: false, botDifficulty: null, balance: 1500 },
    { username: "bot_easy", isBot: true, botDifficulty: "EASY", balance: 1000 },
  ]);

  assignTiles(game, "bot_easy", [20]); // price 200
  const bot = game.players[1];

  const acceptableTrade = {
    from: "human",
    to: "bot_easy",
    given: [],
    received: [20],
    givenMoney: 190, // 95% of 200
    receivedMoney: 0,
  };
  assert.equal(evaluateIncomingTrade(game, bot, acceptableTrade).accept, true);

  const lowballTrade = {
    from: "human",
    to: "bot_easy",
    given: [],
    received: [20],
    givenMoney: 150, // 75% of 200
    receivedMoney: 0,
  };
  assert.equal(evaluateIncomingTrade(game, bot, lowballTrade).accept, false);
});

test("Previously declined trade is ALWAYS declined until board ownership changes, then re-evaluated", () => {
  const game = createGame([
    { username: "human", isBot: false, botDifficulty: null, balance: 1500 },
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 1200 },
  ]);

  assignTiles(game, "bot_hard", [17, 19]);
  assignTiles(game, "human", [20]);

  const trade = {
    from: "human",
    to: "bot_hard",
    given: [20],
    received: [],
    givenMoney: 0,
    receivedMoney: 220,
  };

  const bot = game.players[1];
  // Initially favorable & accepted
  assert.equal(evaluateIncomingTrade(game, bot, trade).accept, true);

  // Once recorded as declined under current board state, must immediately reject
  recordDeclinedTrade(game, trade);
  const declinedRes = evaluateIncomingTrade(game, bot, trade);
  assert.equal(declinedRes.accept, false);
  assert.equal(declinedRes.reason, "previously_declined");
  assert.equal(declinedRes.score, -Infinity);

  // When board ownership changes (e.g. another tile gets bought), trade is re-evaluated
  assignTiles(game, "human", [7]);
  const reEvaluated = evaluateIncomingTrade(game, bot, trade);
  assert.equal(reEvaluated.accept, true);
});

test("HARD bot refuses giving opponent a monopoly without comparable monopoly gain", () => {
  const game = createGame([
    { username: "human", isBot: false, botDifficulty: null, balance: 2000 },
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 1000 },
  ]);

  // Human has 17, 19 (Group 4 Orange) and wants 20 from bot for huge cash ($450)
  assignTiles(game, "human", [17, 19]);
  assignTiles(game, "bot_hard", [20]);
  const bot = game.players[1];

  const badTrade = {
    from: "human",
    to: "bot_hard",
    given: [],
    received: [20],
    givenMoney: 450,
    receivedMoney: 0,
  };

  const res = evaluateIncomingTrade(game, bot, badTrade);
  assert.equal(res.accept, false);
  assert.equal(res.reason, "hard_refuses_opponent_monopoly");
});

test("HARD bot accepts mutual monopoly swap when gaining stronger monopoly with upgrade cash, refuses if cash below reserve", () => {
  const game = createGame([
    { username: "human", isBot: false, botDifficulty: null, balance: 1500 },
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 900 },
  ]);

  // Bot has 17, 19 (Group 4 Orange) + 15 (Group 3 Cyan)
  // Human has 12, 14 (Group 3 Cyan) + 20 (Group 4 Orange)
  assignTiles(game, "bot_hard", [17, 19, 15]);
  assignTiles(game, "human", [12, 14, 20]);
  const bot = game.players[1];

  const mutualSwap = {
    from: "human",
    to: "bot_hard",
    given: [20],
    received: [15],
    givenMoney: 0,
    receivedMoney: 0,
  };

  // Bot has plenty of cash ($900 >= safetyReserve) and gets stronger Group 4 vs Group 3
  const accepted = evaluateIncomingTrade(game, bot, mutualSwap);
  assert.equal(accepted.accept, true);

  // If bot has too little cash to build (< safetyReserve), refuses mutual monopoly
  bot.balance = 60;
  const rejectedLowCash = evaluateIncomingTrade(game, bot, mutualSwap);
  assert.equal(rejectedLowCash.accept, false);
  assert.equal(
    rejectedLowCash.reason,
    "hard_insufficient_cash_to_upgrade_after_mutual_monopoly"
  );
});

test("HARD bot never breaks an existing full set unless getting a strictly superior full set + cash", () => {
  const game = createGame([
    { username: "human", isBot: false, botDifficulty: null, balance: 1500 },
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 800 },
  ]);

  // Bot owns full Group 1 (2, 4) and 2/3 of Group 4 (17, 19); human owns 20
  assignTiles(game, "bot_hard", [2, 4, 17, 19]);
  assignTiles(game, "human", [20]);
  const bot = game.players[1];

  // Breaking Group 1 for pure cash only -> refused
  const cashForMono = {
    from: "human",
    to: "bot_hard",
    given: [],
    received: [2],
    givenMoney: 300,
    receivedMoney: 0,
  };
  assert.equal(evaluateIncomingTrade(game, bot, cashForMono).accept, false);

  // Breaking weak Group 1 to complete strong Group 4 + cash -> accepted
  const upgradeToSuperiorMono = {
    from: "human",
    to: "bot_hard",
    given: [20],
    received: [2],
    givenMoney: 50,
    receivedMoney: 0,
  };
  assert.equal(
    evaluateIncomingTrade(game, bot, upgradeToSuperiorMono).accept,
    true
  );
});

test("Trade evaluator rejects non-tradable mortgaged or upgraded full-set properties", () => {
  const game = createGame([
    { username: "human", isBot: false, botDifficulty: null, balance: 1500 },
    { username: "bot_easy", isBot: true, botDifficulty: "EASY", balance: 1000 },
  ]);

  assignTiles(game, "human", [20], { mortgaged: true });
  const bot = game.players[1];

  const mortgagedTrade = {
    from: "human",
    to: "bot_easy",
    given: [20],
    received: [],
    givenMoney: 0,
    receivedMoney: 100,
  };
  const res1 = evaluateIncomingTrade(game, bot, mortgagedTrade);
  assert.equal(res1.accept, false);
  assert.equal(res1.reason, "sender_property_not_tradable");

  // Upgraded full set owned by bot is also non-tradable
  assignTiles(game, "bot_easy", [2, 4], { rentLevel: 1 });
  const upgradedTrade = {
    from: "human",
    to: "bot_easy",
    given: [],
    received: [2],
    givenMoney: 500,
    receivedMoney: 0,
  };
  const res2 = evaluateIncomingTrade(game, bot, upgradedTrade);
  assert.equal(res2.accept, false);
  assert.equal(res2.reason, "bot_property_not_tradable");
});

// =============================================================================
// 3. HARD bot strategic behaviors (Jail, Liquidation, Upgrades, Auctions, Rent)
// =============================================================================

test("HARD bot pays jail fine in early game and stays in jail in late game with high opponent rent", () => {
  // Early game: almost all properties unowned
  const earlyGame = createGame([
    {
      username: "bot_hard",
      isBot: true,
      botDifficulty: "HARD",
      jailed: true,
      turnsInJail: 3,
      position: 11,
      balance: 800,
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1200 },
  ]);

  const earlyDecision = decideBotAction(
    earlyGame,
    earlyGame.players[0],
    { proposedTradeThisTurn: true, turnStepCount: 0, tradeCooldownByTarget: {} },
    forbiddenRng
  );
  assert.equal(earlyDecision?.action, "JAIL_PAY");
  assert.deepEqual(earlyDecision?.payload, { username: "bot_hard" });

  // Late game: most tiles owned and opponent has heavily upgraded monopolies
  const lateGame = createGame([
    {
      username: "bot_hard",
      isBot: true,
      botDifficulty: "HARD",
      jailed: true,
      turnsInJail: 3,
      position: 11,
      balance: 600,
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1200 },
  ]);

  // Assign most tiles & upgrade opponent's Group 4 & Group 5
  assignTiles(
    lateGame,
    "human",
    [2, 4, 7, 9, 10, 12, 14, 15, 17, 19, 20, 22, 24, 25, 27, 28, 30, 32, 33, 35, 38, 40]
  );
  for (const id of [17, 19, 20, 22, 24, 25]) {
    lateGame.board.tiles.find((t) => t.id === id).rentLevel = 3;
  }

  assert.equal(getGameStage(lateGame), "late");
  assert.ok(getMaxOpponentRent(lateGame, "bot_hard").maxRent >= 550);

  const lateDecision = decideBotAction(
    lateGame,
    lateGame.players[0],
    { proposedTradeThisTurn: true, turnStepCount: 0, tradeCooldownByTarget: {} },
    forbiddenRng
  );
  assert.equal(lateDecision?.action, "ROLL_DICE");
  assert.equal(lateDecision?.payload.username, "bot_hard");
  assert.ok(
    lateDecision?.payload.turnResult.left >= 1 &&
      lateDecision?.payload.turnResult.left <= 6
  );
});

test("HARD bot liquidates weak assets before paying rent to avoid bankruptcy and obeys even-selling", () => {
  const game = createGame([
    {
      username: "bot_hard",
      isBot: true,
      botDifficulty: "HARD",
      position: 40,
      balance: 50,
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1500 },
  ]);

  // Human owns tile 40 (DTEK, rent level 1 = 200)
  assignTiles(game, "human", [38, 40], { rentLevel: 1 });
  // Bot owns: singleton tile 7 ($100, mortgage 50), car tile 6 (no mortgagePrice!), and upgraded Group 4 (17@2, 19@1, 20@1)
  assignTiles(game, "bot_hard", [6, 7, 17, 19, 20]);
  game.board.tiles.find((t) => t.id === 17).rentLevel = 2;
  game.board.tiles.find((t) => t.id === 19).rentLevel = 1;
  game.board.tiles.find((t) => t.id === 20).rentLevel = 1;

  game.currentTurn = "bot_hard";
  game.currentAction = "payRent";

  assert.equal(getAmountOwedForCurrentAction(game, game.players[0]), 200);

  // Step 1: Must mortgage weak singleton tile 7 first (NOT car 6 which has no mortgagePrice, NOT Group 4 houses)
  const step1 = decideBotAction(
    game,
    game.players[0],
    { proposedTradeThisTurn: false, turnStepCount: 0, tradeCooldownByTarget: {} },
    forbiddenRng
  );
  assert.deepEqual(step1, {
    action: "MORTGAGE_PROPERTY",
    payload: { username: "bot_hard", propertyId: 7 },
  });

  // Apply mortgage -> balance becomes 100 (still < 200)
  game.board.tiles.find((t) => t.id === 7).mortgaged = true;
  game.players[0].balance += 50;

  // Step 2: Must sell house on tile 17 (rentLevel 2, obeying even-selling rule!)
  const step2 = decideBotAction(
    game,
    game.players[0],
    { proposedTradeThisTurn: false, turnStepCount: 1, tradeCooldownByTarget: {} },
    forbiddenRng
  );
  assert.deepEqual(step2, {
    action: "SELL_PROPERTY",
    payload: { username: "bot_hard", propertyId: 17 },
  });

  // Apply sell -> balance becomes 100 + 200/2 = 200 (>= 200)
  game.board.tiles.find((t) => t.id === 17).rentLevel = 1;
  game.players[0].balance += 100;

  // Step 3: Now affordable -> emits PAY_RENT!
  const step3 = decideBotAction(
    game,
    game.players[0],
    { proposedTradeThisTurn: false, turnStepCount: 2, tradeCooldownByTarget: {} },
    forbiddenRng
  );
  assert.deepEqual(step3, {
    action: "PAY_RENT",
    payload: { username: "bot_hard", propertyId: 40 },
  });
});

test("HARD bot upgrades evenly prioritizing highest-ROI monopoly and respects safety reserve", () => {
  const game = createGame([
    {
      username: "bot_hard",
      isBot: true,
      botDifficulty: "HARD",
      balance: 1000,
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
  ]);

  // Bot owns both Group 1 (2, 4) and Group 4 (17, 19, 20)
  assignTiles(game, "bot_hard", [2, 4, 17, 19, 20]);
  // Tile 17 already has 1 house; tiles 19 & 20 have 0 houses -> even-building forbids upgrading 17 again!
  game.board.tiles.find((t) => t.id === 17).rentLevel = 1;

  const bot = game.players[0];
  const reserve = getSafetyReserve(game, bot, "HARD");
  const chosen = findBestUpgradeTile(game, bot, "HARD", reserve);

  assert.ok(chosen);
  assert.ok([19, 20].includes(chosen.id), `expected tile 19 or 20, got ${chosen.id}`);

  // When bot balance is too low to keep safety reserve, returns null
  bot.balance = reserve + 50; // Group 4 costs 100, Group 1 costs 50 (exactly reserve)
  const lowCashChoice = findBestUpgradeTile(game, bot, "HARD", reserve);
  assert.ok(lowCashChoice && [2, 4].includes(lowCashChoice.id));

  bot.balance = reserve + 10;
  assert.equal(findBestUpgradeTile(game, bot, "HARD", reserve), null);
});

test("findBestUnmortgageTile prioritizes mortgaged tiles belonging to a full set", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 800 },
    { username: "human", isBot: false, botDifficulty: null, balance: 800 },
  ]);

  assignTiles(game, "bot_hard", [17, 19, 20, 38]);
  game.board.tiles.find((t) => t.id === 17).mortgaged = true; // part of full Group 4
  game.board.tiles.find((t) => t.id === 38).mortgaged = true; // expensive singleton

  const best = findBestUnmortgageTile(game, game.players[0], 150);
  assert.equal(best?.id, 17);
});

test("HARD bot auction bidding respects deterministic maxBid", () => {
  const game = createGame([
    { username: "human", isBot: false, botDifficulty: null, balance: 1500 },
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 1200 },
  ]);

  // Bot already owns 17, 19 -> tile 20 completes Orange monopoly!
  assignTiles(game, "bot_hard", [17, 19]);
  const tile20 = game.board.tiles.find((t) => t.id === 20);
  const strategicValue = evaluateTileStrategicValue(game, tile20, "bot_hard");

  game.currentAction = "auction";
  game.auctionedTileId = 20;
  game.auctionParticipants = ["bot_hard", "human"];
  game.activeAuctionBidder = "bot_hard";

  // Bid well below maxBid -> BID_AUCTION_PROPERTY
  game.auctionBidAmount = 220;
  const bidDecision = decideBotAction(
    game,
    game.players[1],
    undefined,
    forbiddenRng
  );
  assert.deepEqual(bidDecision, {
    action: "BID_AUCTION_PROPERTY",
    payload: { username: "bot_hard", propertyId: 20 },
  });

  // Bid above strategicValue * 1.15 -> PASS_AUCTION_PROPERTY
  game.auctionBidAmount = Math.round(strategicValue * 1.2);
  const passDecision = decideBotAction(
    game,
    game.players[1],
    undefined,
    forbiddenRng
  );
  assert.deepEqual(passDecision, {
    action: "PASS_AUCTION_PROPERTY",
    payload: { username: "bot_hard", propertyId: 20 },
  });
});

test("PAY_RENT on bonus-property includes turnResult from lastDiceRoll", () => {
  const game = createGame([
    {
      username: "bot_hard",
      isBot: true,
      botDifficulty: "HARD",
      position: 13,
      balance: 500,
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
  ]);

  assignTiles(game, "human", [13]); // Ukrnafta (bonus-property)
  game.currentTurn = "bot_hard";
  game.currentAction = "payRent";
  game.lastDiceRoll = { left: 5, right: 4 };

  assert.equal(getAmountOwedForCurrentAction(game, game.players[0]), 36);
  const decision = decideBotAction(game, game.players[0], undefined, forbiddenRng);
  assert.deepEqual(decision, {
    action: "PAY_RENT",
    payload: {
      username: "bot_hard",
      propertyId: 13,
      turnResult: { left: 5, right: 4 },
    },
  });
});

// =============================================================================
// 4. EASY bot randomness on turn decisions vs determinism on trades
// =============================================================================

test("EASY bot exhibits randomness on buy and jail decisions with different rng values", () => {
  const game = createGame([
    {
      username: "bot_easy",
      isBot: true,
      botDifficulty: "EASY",
      position: 17,
      balance: 1000,
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
  ]);

  // Buy decision varies with rng
  game.currentAction = "buy";
  const buyDecision = decideBotAction(game, game.players[0], undefined, () => 0.1);
  const passDecision = decideBotAction(game, game.players[0], undefined, () => 0.9);
  assert.equal(buyDecision?.action, "BUY_PROPERTY");
  assert.equal(passDecision?.action, "PASS_PROPERTY");

  // Jail decision varies with rng
  game.currentAction = "roll";
  game.players[0].jailed = true;
  game.players[0].position = 11;
  const ctx = {
    proposedTradeThisTurn: true,
    turnStepCount: 6,
    tradeCooldownByTarget: {},
  };
  const jailPay = decideBotAction(game, game.players[0], ctx, () => 0.1);
  const jailRoll = decideBotAction(game, game.players[0], ctx, () => 0.9);
  assert.equal(jailPay?.action, "JAIL_PAY");
  assert.equal(jailRoll?.action, "ROLL_DICE");
});

// =============================================================================
// 5. tradeProposer behavior, cooldowns, and declined-trade avoidance
// =============================================================================

test("tradeProposer finds valid set-completing proposal and respects cooldowns & previously declined trades", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 1200 },
    { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
  ]);

  // Bot holds 17, 19 (Group 4) and singleton 7; human holds 20
  assignTiles(game, "bot_hard", [17, 19, 7]);
  assignTiles(game, "human", [20]);

  const bot = game.players[0];

  // Respects cooldown -> skips human when cooldown > 0
  assert.equal(findBestTradeProposal(game, bot, { human: 2 }), null);

  // Without cooldown -> proposes a valid trade requesting tile 20
  const proposal = findBestTradeProposal(game, bot, {});
  assert.ok(proposal, "expected a trade proposal");
  assert.equal(proposal.from, "bot_hard");
  assert.equal(proposal.to, "human");
  assert.deepEqual(proposal.received, [20]);

  // Recording that proposal as declined prevents proposing the same trade again
  recordDeclinedTrade(game, proposal);
  const nextProposal = findBestTradeProposal(game, bot, {});
  if (nextProposal) {
    assert.notDeepEqual(nextProposal, proposal);
  }
});

test("tradeProposer does not propose non-tradable mortgaged tiles", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 1200 },
    { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
  ]);

  assignTiles(game, "bot_hard", [17, 19]);
  assignTiles(game, "human", [20], { mortgaged: true });

  const proposal = findBestTradeProposal(game, game.players[0], {});
  assert.equal(proposal, null);
});

test("tradeProposer avoids cheap fire-sale on HARD and sells singleton at 1.4x-2.0x when opponent needs it", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 40 },
    { username: "human", isBot: false, botDifficulty: null, balance: 1200 },
  ]);

  assignTiles(game, "bot_hard", [7]); // group 2 singleton worth 100
  // Human doesn't need group 2 -> HARD refuses cheap 0.9x-1.25x bargain fire-sale
  assert.equal(findBestTradeProposal(game, game.players[0], {}), null);

  // Give human a matching tile in group 2 (tile 9; tile 10 unowned so not set-completing)
  assignTiles(game, "human", [9]);
  const proposal = findBestTradeProposal(game, game.players[0], {});
  assert.ok(proposal, "expected a targeted high-value cash-raising proposal");
  assert.equal(proposal.from, "bot_hard");
  assert.equal(proposal.to, "human");
  assert.deepEqual(proposal.given, [7]);
  assert.deepEqual(proposal.received, []);
  assert.ok(
    (proposal.receivedMoney ?? 0) >= 140 && (proposal.receivedMoney ?? 0) <= 200,
    `expected 1.4x-2.0x ask, got ${proposal.receivedMoney}`
  );
});

test("planNextLiquidationAction returns null when no legal liquidation exists", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 10 },
    { username: "human", isBot: false, botDifficulty: null, balance: 1200 },
  ]);

  // Car tile has no mortgagePrice in defaultTiles -> cannot mortgage safely
  assignTiles(game, "bot_hard", [6]);
  assert.equal(planNextLiquidationAction(game, game.players[0]), null);
});

// =============================================================================
// 6. Harder Bot AI: Anti-Stupid Trades, Risk Profiles, Pre-Mortgage 2x Offers,
//    Board-Aware Tactics (#1-#8)
// =============================================================================

test("MEDIUM bot rejects selling a full-set-completing tile or breaking own full set even for 2x+ cash", () => {
  const game = createGame([
    { username: "human", isBot: false, botDifficulty: null, balance: 2500 },
    { username: "bot_med", isBot: true, botDifficulty: "MEDIUM", balance: 800 },
  ]);

  // Human owns 17, 19 (Group 4); bot owns 20 ($200) and full Group 1 (2, 4)
  assignTiles(game, "human", [17, 19]);
  assignTiles(game, "bot_med", [20, 2, 4]);
  const bot = game.players[1];

  // Even 2.5x cash ($500 for $200 tile) cannot buy a completing tile from MEDIUM
  const cashForOppMono = {
    from: "human",
    to: "bot_med",
    given: [],
    received: [20],
    givenMoney: 500,
    receivedMoney: 0,
  };
  const res1 = evaluateIncomingTrade(game, bot, cashForOppMono);
  assert.equal(res1.accept, false);
  assert.equal(res1.reason, "medium_refuses_opponent_monopoly");

  // Even 3x cash ($180 for $60 tile) cannot break MEDIUM's existing full set
  const cashToBreakOwnSet = {
    from: "human",
    to: "bot_med",
    given: [],
    received: [2],
    givenMoney: 180,
    receivedMoney: 0,
  };
  const res2 = evaluateIncomingTrade(game, bot, cashToBreakOwnSet);
  assert.equal(res2.accept, false);
  assert.equal(res2.reason, "medium_protects_existing_monopoly");
});

test("MEDIUM and HARD bots do not propose cash-only trades to buy a set-completing tile", () => {
  for (const difficulty of ["MEDIUM", "HARD"]) {
    const game = createGame([
      { username: "bot", isBot: true, botDifficulty: difficulty, balance: 1500 },
      { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
    ]);

    // Bot owns 17, 19 (no extra tiles to swap); human owns 20
    assignTiles(game, "bot", [17, 19]);
    assignTiles(game, "human", [20]);

    const proposal = findBestTradeProposal(game, game.players[0], {});
    assert.equal(
      proposal,
      null,
      `${difficulty} bot must not propose cash-only offer for a completing tile`
    );
  }
});

test("Risky bot spends down to $0 on upgrades while cautious bot preserves buffer before enemy monopoly", () => {
  const riskyGame = createGame([
    {
      username: "bot_risky",
      isBot: true,
      botDifficulty: "HARD",
      botRiskLevel: 0.95,
      position: 35, // close to passing GO!
      balance: 100, // exact cost of 1 Group 4 house
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
  ]);
  assignTiles(riskyGame, "bot_risky", [17, 19, 20]);

  const riskyDecision = decideBotAction(
    riskyGame,
    riskyGame.players[0],
    { proposedTradeThisTurn: true, turnStepCount: 0, tradeCooldownByTarget: {} },
    forbiddenRng
  );
  assert.equal(riskyDecision?.action, "UPGRADE_PROPERTY");

  const cautiousGame = createGame([
    {
      username: "bot_safe",
      isBot: true,
      botDifficulty: "HARD",
      botRiskLevel: 0.05,
      position: 12, // directly upstream from human's upgraded Group 4 (17, 19, 20)
      balance: 120,
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
  ]);
  assignTiles(cautiousGame, "bot_safe", [2, 4]); // upgradePrice 50
  assignTiles(cautiousGame, "human", [17, 19, 20], { rentLevel: 3 });

  const cautiousReserve = getActionReserve(
    cautiousGame,
    cautiousGame.players[0],
    "HARD",
    "upgrade"
  );
  assert.ok(cautiousReserve >= 100, `expected cautious reserve >= 100, got ${cautiousReserve}`);
  const cautiousDecision = decideBotAction(
    cautiousGame,
    cautiousGame.players[0],
    { proposedTradeThisTurn: true, turnStepCount: 0, tradeCooldownByTarget: {} },
    forbiddenRng
  );
  assert.equal(cautiousDecision?.action, "ROLL_DICE");
});

test("HARD bot proactively mortgages weak singleton to fund houses on a full set", () => {
  const game = createGame([
    {
      username: "bot_hard",
      isBot: true,
      botDifficulty: "HARD",
      botRiskLevel: 0.85,
      position: 1,
      balance: 60, // needs $100 for Group 4 house; tile 7 mortgages for $50 -> $110
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
  ]);

  assignTiles(game, "bot_hard", [17, 19, 20, 7]);
  const plan = findProactiveMortgageForUpgrade(game, game.players[0], "HARD");
  assert.ok(plan, "expected proactive mortgage plan");
  assert.equal(plan.tileToMortgage.id, 7);

  const decision = decideBotAction(
    game,
    game.players[0],
    { proposedTradeThisTurn: true, turnStepCount: 0, tradeCooldownByTarget: {} },
    forbiddenRng
  );
  assert.deepEqual(decision, {
    action: "MORTGAGE_PROPERTY",
    payload: { username: "bot_hard", propertyId: 7 },
  });
});

test("Pre-mortgage nice offer triggers before reactive debt mortgage (up to 2x max) and restores payRent cleanly", () => {
  const game = createGame([
    {
      username: "bot_hard",
      isBot: true,
      botDifficulty: "HARD",
      position: 40,
      balance: 50,
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1500 },
  ]);

  // Human owns tile 40 (rent 200) and tile 17 (1 of 3 in Group 4)
  assignTiles(game, "human", [38, 40], { rentLevel: 1 });
  assignTiles(game, "human", [17]);
  // Bot owns singleton tile 19 ($180, Group 4 — advances human 1->2 of 3, does NOT complete set!)
  assignTiles(game, "bot_hard", [19]);

  game.currentTurn = "bot_hard";
  game.currentAction = "payRent";

  // Step 1: Instead of mortgaging tile 19 for $90, bot makes a nice offer (up to 2x = $360) to human!
  const step1 = decideBotAction(
    game,
    game.players[0],
    {
      proposedTradeThisTurn: false,
      proposedLiquidationTradeThisTurn: false,
      turnStepCount: 0,
      tradeCooldownByTarget: {},
    },
    forbiddenRng
  );
  assert.equal(step1?.action, "TRADE");
  assert.equal(step1?.payload.tradePlayerUsername, "human");
  assert.deepEqual(step1?.payload.tradeTiles.given, [19]);
  assert.ok(
    step1.payload.tradeTiles.receivedMoney >= 250 &&
      step1.payload.tradeTiles.receivedMoney <= 360,
    `expected ask between 1.4x and 2.0x ($250..$360), got ${step1.payload.tradeTiles.receivedMoney}`
  );

  // Apply sendTrade -> switches to trade and records returnAction = "payRent"
  sendTrade(game, step1);
  assert.equal(game.currentAction, "trade");
  assert.equal(game.activeTrade?.returnAction, "payRent");

  // Branch A: If human declines, game resumes payRent and bot falls back to mortgaging tile 19
  const declineClone = structuredClone(game);
  declineTrade(declineClone);
  assert.equal(declineClone.currentAction, "payRent");
  const afterDecline = decideBotAction(
    declineClone,
    declineClone.players[0],
    {
      proposedTradeThisTurn: false,
      proposedLiquidationTradeThisTurn: true,
      turnStepCount: 1,
      tradeCooldownByTarget: { human: 3 },
    },
    forbiddenRng
  );
  assert.deepEqual(afterDecline, {
    action: "MORTGAGE_PROPERTY",
    payload: { username: "bot_hard", propertyId: 19 },
  });

  // Branch B: If human accepts, game resumes payRent and bot pays rent directly without mortgaging!
  acceptTrade(game);
  assert.equal(game.currentAction, "payRent");
  assert.ok(game.players[0].balance >= 200);
  const afterAccept = decideBotAction(
    game,
    game.players[0],
    {
      proposedTradeThisTurn: false,
      proposedLiquidationTradeThisTurn: true,
      turnStepCount: 1,
      tradeCooldownByTarget: { human: 3 },
    },
    forbiddenRng
  );
  assert.equal(afterAccept?.action, "PAY_RENT");
});

test("Pre-mortgage offer refuses to sell a set-completing tile unless literal bankruptcy emergency", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 50 },
    { username: "human", isBot: false, botDifficulty: null, balance: 2000 },
  ]);

  // Human owns 17, 19 -> tile 20 ($200) completes human's Orange full set!
  assignTiles(game, "human", [17, 19]);
  // Bot owns 20 ($200) + 32 ($300, mortgage 150)
  assignTiles(game, "bot_hard", [20, 32]);
  const tile20 = game.board.tiles.find((t) => t.id === 20);

  // Bot can survive $150 debt via tile 32 alone -> NOT bankruptcy emergency -> refuses selling tile 20!
  assert.equal(canSurviveWithoutTile(game, game.players[0], 20, 150), true);
  assert.equal(
    findPreMortgageTradeOffer(game, game.players[0], tile20, {
      isBankruptcyEmergency: false,
    }),
    null
  );

  // Bot owes $350 (50 + 150 = 200 < 350) -> literal bankruptcy emergency -> offers tile 20 at 2x ($400)!
  assert.equal(canSurviveWithoutTile(game, game.players[0], 20, 350), false);
  const emergencyOffer = findPreMortgageTradeOffer(
    game,
    game.players[0],
    tile20,
    { isBankruptcyEmergency: true, amountNeeded: 300 }
  );
  assert.ok(emergencyOffer);
  assert.equal(emergencyOffer.receivedMoney, 400);
});

test("Full-set unmortgaging unlocks blocked monopolies with minimal cash floor (#1)", () => {
  const game = createGame([
    {
      username: "bot_hard",
      isBot: true,
      botDifficulty: "HARD",
      botRiskLevel: 0.7,
      balance: 140, // buyback for tile 17 ($180) is 108 -> leaves $32 (well below normal safetyReserve!)
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1200 },
  ]);
  assignTiles(game, "bot_hard", [17, 19, 20]);
  game.board.tiles.find((t) => t.id === 17).mortgaged = true;

  const decision = decideBotAction(
    game,
    game.players[0],
    { proposedTradeThisTurn: true, turnStepCount: 0, tradeCooldownByTarget: {} },
    forbiddenRng
  );
  assert.deepEqual(decision, {
    action: "BUY_BACK_PROPERTY",
    payload: { username: "bot_hard", propertyId: 17 },
  });
});

test("HARD bot accepts cash-balanced mutual monopoly swap (#2) and refuses feeding runaway leader (#4)", () => {
  // Cash-balanced mutual swap: Bot gets Group 3 (weaker) vs Human getting Group 4 (stronger)
  const swapGame = createGame([
    { username: "human", isBot: false, botDifficulty: null, balance: 1200 },
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 400 },
  ]);
  assignTiles(swapGame, "bot_hard", [12, 14, 20]);
  assignTiles(swapGame, "human", [17, 19, 15]);

  // Without cash, Group 3 is weaker than Group 4 -> refused
  const unbalancedSwap = {
    from: "human",
    to: "bot_hard",
    given: [15],
    received: [20],
    givenMoney: 0,
    receivedMoney: 0,
  };
  assert.equal(
    evaluateIncomingTrade(swapGame, swapGame.players[1], unbalancedSwap).accept,
    false
  );

  // With $300 cash to balance monopoly power & rush houses -> accepted!
  const balancedSwap = {
    from: "human",
    to: "bot_hard",
    given: [15],
    received: [20],
    givenMoney: 300,
    receivedMoney: 0,
  };
  assert.equal(
    evaluateIncomingTrade(swapGame, swapGame.players[1], balancedSwap).accept,
    true
  );

  // Leader-aware guard: Human is already runaway leader with full Group 5 + huge cash
  const leaderGame = createGame([
    { username: "human", isBot: false, botDifficulty: null, balance: 2500 },
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 500 },
  ]);
  assignTiles(leaderGame, "human", [22, 24, 25, 17, 19, 15]);
  assignTiles(leaderGame, "bot_hard", [12, 14, 20]);

  // Roughly equal Group 3 vs Group 4 swap feeds the leader a 2nd monopoly -> refused!
  const feedLeaderTrade = {
    from: "human",
    to: "bot_hard",
    given: [15],
    received: [20],
    givenMoney: 0,
    receivedMoney: 0,
  };
  const leaderRes = evaluateIncomingTrade(
    leaderGame,
    leaderGame.players[1],
    feedLeaderTrade
  );
  assert.equal(leaderRes.accept, false);
  assert.equal(leaderRes.reason, "hard_refuses_feeding_leader");
});

test("Board-aware jail stays in jail when opponent has houses right outside jail (#5)", () => {
  const game = createGame([
    {
      username: "bot_hard",
      isBot: true,
      botDifficulty: "HARD",
      jailed: true,
      turnsInJail: 3,
      position: 11,
      balance: 700,
    },
    { username: "human", isBot: false, botDifficulty: null, balance: 1200 },
  ]);

  // Mid-game: opponent has 3 houses on Group 4 (tiles 17, 19, 20 — prime 6, 8, 9 roll outside jail!)
  assignTiles(game, "human", [17, 19, 20], { rentLevel: 3 });

  const decision = decideBotAction(
    game,
    game.players[0],
    { proposedTradeThisTurn: true, turnStepCount: 0, tradeCooldownByTarget: {} },
    forbiddenRng
  );
  assert.equal(decision?.action, "ROLL_DICE");
});

test("Trap-based upgrading prioritizes monopoly where opponent is 7 steps upstream (#6)", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 1000 },
    {
      username: "human",
      isBot: false,
      botDifficulty: null,
      position: 5, // 7 steps upstream of tile 12 (Group 3) — nowhere near Group 4 (17, 19, 20)!
      balance: 1000,
    },
  ]);

  // Bot owns both Group 3 (12, 14, 15, mult 1.2) and Group 4 (17, 19, 20, mult 1.35)
  assignTiles(game, "bot_hard", [12, 14, 15, 17, 19, 20]);
  // Without trap awareness, Group 4 (mult 1.35) beats Group 3 (mult 1.2).
  // With human sitting at pos 5 (2d6 landing directly onto 12, 14, 15!), Group 3 wins!
  const chosen = findBestUpgradeTile(game, game.players[0], "HARD", 0);
  assert.ok(chosen);
  assert.ok(
    [12, 14, 15].includes(chosen.id),
    `expected trap upgrade on Group 3 (12/14/15), got tile ${chosen.id}`
  );
});

test("2-for-1 trade proposal adds cash sweetener when two cheap singletons fall short (#7)", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 1000 },
    { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
  ]);

  // Bot owns 32, 33 (Group 7, $300 each) + two cheap singletons 2 ($60) and 7 ($100)
  // Human owns 35 ($320, completes Group 7)
  assignTiles(game, "bot_hard", [32, 33, 2, 7]);
  assignTiles(game, "human", [35]);

  const proposal = findBestTradeProposal(game, game.players[0], {});
  assert.ok(proposal, "expected a swap proposal for tile 35");
  assert.deepEqual(proposal.received, [35]);
  assert.ok(proposal.given.length >= 1, "must include property in swap, not pure cash");
  assert.ok((proposal.givenMoney ?? 0) > 0, "should add cash sweetener to bridge value gap");
});

test("Threat-aware liquidation sells houses from cold set and keeps houses where opponent is approaching (#8)", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 0 },
    {
      username: "human",
      isBot: false,
      botDifficulty: null,
      position: 5, // right behind Group 3 (12, 14, 15)!
      balance: 1000,
    },
  ]);

  // Bot owns upgraded Group 3 (12, 14, 15 @ level 2) and upgraded Group 4 (17, 19, 20 @ level 2)
  // Normally Group 3 (mult 1.2) is sold before Group 4 (mult 1.35),
  // but human is right behind Group 3 -> keep Group 3 houses and sell from cold Group 4!
  assignTiles(game, "bot_hard", [12, 14, 15, 17, 19, 20], { rentLevel: 2 });

  const plan = planNextLiquidationAction(game, game.players[0]);
  assert.ok(plan);
  assert.equal(plan.action, "SELL_PROPERTY");
  assert.ok(
    [17, 19, 20].includes(plan.propertyId),
    `expected selling from cold Group 4 (17/19/20), got tile ${plan.propertyId}`
  );
});

test("Proactive 2-step mortgage to upgrade never ping-pongs by unmortgaging the same tile", () => {
  const game = createGame(
    [
      {
        username: "bot_wild",
        isBot: true,
        botDifficulty: "HARD",
        botRiskLevel: 0.9,
        balance: 85,
      },
      { username: "human", isBot: false, botDifficulty: null, balance: 900 },
    ],
    { currentTurn: "bot_wild", currentAction: "roll" }
  );

  // Full red set (group 5: upgradePrice = 150) + two weak singletons (tile 7 mp=50, tile 2 mp=30)
  assignTiles(game, "bot_wild", [22, 24, 25, 7, 2]);
  const bot = game.players[0];

  const ctx = {
    proposedTradeThisTurn: false,
    proposedLiquidationTradeThisTurn: false,
    mortgagedTileIdsThisTurn: [],
    turnStepCount: 0,
    tradeCooldownByTarget: {},
  };

  // Step 1: mortgage first weak singleton (+30 or +50)
  const d1 = decideBotAction(game, bot, ctx);
  assert.equal(d1?.action, "MORTGAGE_PROPERTY");
  mortgageProperty(game, bot, d1);
  ctx.mortgagedTileIdsThisTurn.push(d1.payload.propertyId);
  ctx.turnStepCount += 1;

  // Step 2: MUST mortgage second singleton (NOT BUY_BACK_PROPERTY!)
  const d2 = decideBotAction(game, bot, ctx);
  assert.equal(
    d2?.action,
    "MORTGAGE_PROPERTY",
    `expected 2nd MORTGAGE_PROPERTY instead of ping-pong, got ${d2?.action}`
  );
  mortgageProperty(game, bot, d2);
  ctx.mortgagedTileIdsThisTurn.push(d2.payload.propertyId);
  ctx.turnStepCount += 1;

  // Step 3: Now has $85 + $30 + $50 = $165 >= $150 -> MUST UPGRADE_PROPERTY!
  const d3 = decideBotAction(game, bot, ctx);
  assert.equal(d3?.action, "UPGRADE_PROPERTY");
  assert.ok([22, 24, 25].includes(d3?.payload.propertyId));
});

test("Declined-trade memory survives unrelated mortgages, upgrades, and 3rd-party buys", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 1000 },
    { username: "human", isBot: false, botDifficulty: null, balance: 1000 },
    { username: "third", isBot: true, botDifficulty: "HARD", balance: 1000 },
  ]);

  assignTiles(game, "bot_hard", [4, 14]);
  assignTiles(game, "human", [25]);
  assignTiles(game, "third", [2, 17, 19, 20]);

  const offer = {
    from: "bot_hard",
    to: "human",
    given: [4, 14],
    received: [25],
    givenMoney: 0,
    receivedMoney: 0,
  };
  recordDeclinedTrade(game, offer);
  assert.equal(isTradePreviouslyDeclined(game, offer), true);

  // Unrelated mortgage + upgrade + 3rd party buying unrelated tile 32 must NOT clear declined memory
  game.board.tiles.find((t) => t.id === 2).mortgaged = true;
  game.board.tiles.find((t) => t.id === 17).rentLevel = 2;
  assignTiles(game, "third", [32]);
  assert.equal(
    isTradePreviouslyDeclined(game, offer),
    true,
    "unrelated board changes must not re-enable rejected trade spam"
  );

  // Changing ownership in an involved group (group 5 tile 22 bought by bot_hard) DOES refresh it
  assignTiles(game, "bot_hard", [22]);
  assert.equal(
    isTradePreviouslyDeclined(game, offer),
    false,
    "acquiring a tile in involved group should refresh trade eligibility"
  );
});

test("Debt pre-mortgage scan checks ALL mortgageable non-set tiles and ignores normal trade cooldown", () => {
  const game = createGame(
    [
      {
        username: "bot_hard",
        isBot: true,
        botDifficulty: "HARD",
        position: 22,
        balance: 20,
      },
      { username: "human", isBot: false, botDifficulty: null, balance: 1200 },
    ],
    { currentTurn: "bot_hard", currentAction: "payRent" }
  );

  // Human owns tile 22 (rent > $20) AND tile 17 (orange, group 4)
  // Bot owns ATB (tile 2, $60 - unwanted, ranked #1 for mortgage) AND tile 19 (orange, $180 - human wants!)
  assignTiles(game, "human", [22, 17]);
  game.board.tiles.find((t) => t.id === 22).rentLevel = 1; // rent $90
  assignTiles(game, "bot_hard", [2, 19]);

  // Even when human is on normal trade cooldown (3), debt pre-mortgage scan finds tile 19 for 1.4x-2.0x!
  const decision = decideBotAction(game, game.players[0], {
    proposedTradeThisTurn: true,
    proposedLiquidationTradeThisTurn: false,
    mortgagedTileIdsThisTurn: [],
    turnStepCount: 0,
    tradeCooldownByTarget: { human: 3 },
  });

  assert.equal(decision?.action, "TRADE");
  assert.equal(decision?.payload.tradePlayerUsername, "human");
  assert.deepEqual(decision?.payload.tradeTiles.given, [19]);
  assert.ok(
    decision?.payload.tradeTiles.receivedMoney >= 250 &&
      decision?.payload.tradeTiles.receivedMoney <= 360,
    `expected 1.4x-2.0x ask on $180 tile, got ${decision?.payload.tradeTiles.receivedMoney}`
  );
});

test("HARD bots propose and accept 2-for-1 mutual monopoly swaps using a sweetener tile", () => {
  const game = createGame(
    [
      { username: "bot_a", isBot: true, botDifficulty: "HARD", balance: 250 },
      { username: "bot_b", isBot: true, botDifficulty: "HARD", balance: 400 },
    ],
    { currentTurn: "bot_a", currentAction: "roll" }
  );

  // bot_a wants tile 20 to complete Group 4 (orange, power 1021)
  // bot_b wants tile 15 to complete Group 3 (pink, power 634)
  // bot_a only has $250 cash (cannot afford a big cash sweetener while keeping upgrade cash),
  // BUT bot_a owns tile 32 ($300 green singleton) which bridges the monopoly power gap!
  assignTiles(game, "bot_a", [17, 19, 15, 32]);
  assignTiles(game, "bot_b", [12, 14, 20]);

  const proposal = findBestTradeProposal(game, game.players[0], {});
  assert.ok(proposal, "expected a mutual monopoly swap proposal");
  assert.equal(proposal.to, "bot_b");
  assert.deepEqual(proposal.received, [20]);
  assert.ok(proposal.given.includes(15), "must give bot_b its completing tile 15");

  const evalB = evaluateIncomingTrade(game, game.players[1], proposal);
  assert.equal(
    evalB.accept,
    true,
    `expected bot_b to accept balanced 2-for-1 mutual swap, got ${evalB.reason}`
  );
});

test("MEDIUM and HARD bots refuse selling 2/2 Energy Utilities (10x) or completing opponent's pair for cash", () => {
  for (const difficulty of ["MEDIUM", "HARD"]) {
    // Case 1: Bot owns BOTH Energy Utilities (13 Ukrnafta + 29 Naftogaz); human offers $300 or even $800 cash
    const game1 = createGame([
      { username: "bot", isBot: true, botDifficulty: difficulty, balance: 500 },
      { username: "human", isBot: false, botDifficulty: null, balance: 2000 },
    ]);
    assignTiles(game1, "bot", [13, 29]);

    for (const offerCash of [300, 600, 800]) {
      const res = evaluateIncomingTrade(game1, game1.players[0], {
        from: "human",
        to: "bot",
        given: [],
        received: [13, 29],
        givenMoney: offerCash,
        receivedMoney: 0,
      });
      assert.equal(
        res.accept,
        false,
        `${difficulty} must refuse selling 2/2 Energy Utilities for $${offerCash} cash (got ${res.reason})`
      );
    }

    // Case 2: Human already owns Ukrnafta (13), offers $300 (2x) for bot's Naftogaz (29)
    const game2 = createGame([
      { username: "bot", isBot: true, botDifficulty: difficulty, balance: 500 },
      { username: "human", isBot: false, botDifficulty: null, balance: 2000 },
    ]);
    assignTiles(game2, "human", [13]);
    assignTiles(game2, "bot", [29]);

    const res2 = evaluateIncomingTrade(game2, game2.players[0], {
      from: "human",
      to: "bot",
      given: [],
      received: [29],
      givenMoney: 300,
      receivedMoney: 0,
    });
    assert.equal(
      res2.accept,
      false,
      `${difficulty} must refuse gifting 2nd Energy Utility (10x) for cash (got ${res2.reason})`
    );

    // Case 3: Single utility at 1.0x face value ($150) is also rejected
    const game3 = createGame([
      { username: "bot", isBot: true, botDifficulty: difficulty, balance: 500 },
      { username: "human", isBot: false, botDifficulty: null, balance: 2000 },
    ]);
    assignTiles(game3, "bot", [13]);
    const res3 = evaluateIncomingTrade(game3, game3.players[0], {
      from: "human",
      to: "bot",
      given: [],
      received: [13],
      givenMoney: 150,
      receivedMoney: 0,
    });
    assert.equal(
      res3.accept,
      false,
      `${difficulty} must refuse selling single Energy Utility at 1.0x face price`
    );
  }
});

test("MEDIUM and HARD bots protect Cars (3-4 car stacks, opponent 3rd/4th car, and 1.0x face-value dumps)", () => {
  for (const difficulty of ["MEDIUM", "HARD"]) {
    // Case 1: Bot owns 3 Cars (6, 16, 26); human offers $1200 (2x) cash for all 3 or $400 for 1
    const game1 = createGame([
      { username: "bot", isBot: true, botDifficulty: difficulty, balance: 500 },
      { username: "human", isBot: false, botDifficulty: null, balance: 2500 },
    ]);
    assignTiles(game1, "bot", [6, 16, 26]);

    const resAll = evaluateIncomingTrade(game1, game1.players[0], {
      from: "human",
      to: "bot",
      given: [],
      received: [6, 16, 26],
      givenMoney: 1200,
      receivedMoney: 0,
    });
    assert.equal(
      resAll.accept,
      false,
      `${difficulty} must refuse selling 3-car stack for cash`
    );

    // Case 2: Human already owns 2 Cars (6, 16), offers $400 (2x) for bot's 3rd Car (26)
    const game2 = createGame([
      { username: "bot", isBot: true, botDifficulty: difficulty, balance: 500 },
      { username: "human", isBot: false, botDifficulty: null, balance: 2000 },
    ]);
    assignTiles(game2, "human", [6, 16]);
    assignTiles(game2, "bot", [26]);

    const res3rd = evaluateIncomingTrade(game2, game2.players[0], {
      from: "human",
      to: "bot",
      given: [],
      received: [26],
      givenMoney: 400,
      receivedMoney: 0,
    });
    assert.equal(
      res3rd.accept,
      false,
      `${difficulty} must refuse gifting opponent a 3rd Car for cash`
    );

    // Case 3: Single Car at 1.0x face value ($200) is also rejected
    const game3 = createGame([
      { username: "bot", isBot: true, botDifficulty: difficulty, balance: 500 },
      { username: "human", isBot: false, botDifficulty: null, balance: 2000 },
    ]);
    assignTiles(game3, "bot", [6]);

    const resFace = evaluateIncomingTrade(game3, game3.players[0], {
      from: "human",
      to: "bot",
      given: [],
      received: [6],
      givenMoney: 200,
      receivedMoney: 0,
    });
    assert.equal(
      resFace.accept,
      false,
      `${difficulty} must refuse selling single Car at 1.0x face value`
    );
  }
});

test("Bots DO trade away 2/2 Energy Utilities when receiving a strong color monopoly, and never offer them in cash-raises", () => {
  const game = createGame([
    { username: "bot", isBot: true, botDifficulty: "HARD", balance: 40 },
    { username: "human", isBot: false, botDifficulty: null, balance: 1500 },
  ]);

  // Bot owns 2/2 Energy Utilities (13, 29) + 2 orange tiles (17, 19); human owns tile 20 (completes orange!)
  assignTiles(game, "bot", [13, 29, 17, 19]);
  assignTiles(game, "human", [20]);

  // Pre-mortgage / low-cash offer must NEVER try to sell one of bot's 2/2 Energy Utilities for cash
  const tile13 = game.board.tiles.find((t) => t.id === 13);
  assert.equal(
    findPreMortgageTradeOffer(game, game.players[0], tile13, {
      isBankruptcyEmergency: false,
    }),
    null
  );

  // Trading 2/2 Energy Utilities in exchange for completing Orange monopoly (+ $150 cash) IS acceptable
  const swapRes = evaluateIncomingTrade(game, game.players[0], {
    from: "human",
    to: "bot",
    given: [20],
    received: [13, 29],
    givenMoney: 150,
    receivedMoney: 0,
  });
  assert.equal(
    swapRes.accept,
    true,
    `expected HARD bot to trade 2/2 Utilities when receiving Orange monopoly + cash, got ${swapRes.reason}`
  );
});

test("MEDIUM and HARD bots never spam early-game or lowball (+$20 / 1.2x) cash-only offers and reject cheap cash buyouts when rich", () => {
  for (const difficulty of ["MEDIUM", "HARD"]) {
    // Exact Turn-2 screenshot scenario:
    // Bot owns Riot Division (10, $120, Group 2), human owns Urban (9, $100, Group 2) + EPAM (20, $200),
    // Staff (7, $100, Group 2) is still unowned; both players have $1,200+ cash.
    const game = createGame([
      { username: "bot", isBot: true, botDifficulty: difficulty, balance: 1380 },
      { username: "human", isBot: false, botDifficulty: null, balance: 1200 },
      { username: "other", isBot: true, botDifficulty: difficulty, balance: 1360 },
    ]);
    assignTiles(game, "bot", [10]);
    assignTiles(game, "human", [9, 20]);
    assignTiles(game, "other", [12]);

    // 1. Must NOT propose $120 cash-only offer for Urban while Staff is unowned
    assert.equal(
      findBestTradeProposal(game, game.players[0], {}),
      null,
      `${difficulty} bot must not spam early-game cash-only offer for Urban ($100)`
    );

    // 2. Even when Staff (7) IS owned by a 3rd player (1-1-1 split), bot must not send a 1.2x ($120) lowball to rich human
    assignTiles(game, "other", [7]);
    const splitProposal = findBestTradeProposal(game, game.players[0], {});
    if (splitProposal && splitProposal.given.length === 0) {
      assert.ok(
        (splitProposal.givenMoney ?? 0) >= 160,
        `${difficulty} cash-only offer to rich human must be >= 1.6x ($160), got ${splitProposal.givenMoney}`
      );
    }

    // 3. Conversely, a rich MEDIUM/HARD bot must refuse selling Urban ($100) for $120 cash to a buyer advancing 1/3 -> 2/3
    const reverseGame = createGame([
      { username: "human", isBot: false, botDifficulty: null, balance: 1380 },
      { username: "bot", isBot: true, botDifficulty: difficulty, balance: 1200 },
    ]);
    assignTiles(reverseGame, "human", [10]);
    assignTiles(reverseGame, "bot", [9, 20]);

    const lowballBuyout = evaluateIncomingTrade(reverseGame, reverseGame.players[1], {
      from: "human",
      to: "bot",
      given: [],
      received: [9],
      givenMoney: 120,
      receivedMoney: 0,
    });
    assert.equal(
      lowballBuyout.accept,
      false,
      `${difficulty} rich bot must refuse $120 pure-cash buyout for Urban ($100) advancing opponent to 2/3`
    );
  }
});
