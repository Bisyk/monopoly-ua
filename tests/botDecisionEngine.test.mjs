import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultPlayerTemplate,
  defaultPropertyGroups,
  defaultTiles,
} from "~/server/constants";
import { recordDeclinedTrade } from "~/shared/utils/tradeSignature";
import {
  decideBotAction,
  evaluateIncomingTrade,
  evaluateTileStrategicValue,
  findBestTradeProposal,
  findBestUnmortgageTile,
  findBestUpgradeTile,
  getActingBot,
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

test("tradeProposer proposes cash-raising singleton sale when bot is low on cash", () => {
  const game = createGame([
    { username: "bot_hard", isBot: true, botDifficulty: "HARD", balance: 40 },
    { username: "human", isBot: false, botDifficulty: null, balance: 1200 },
  ]);

  assignTiles(game, "bot_hard", [7]); // singleton worth 100
  const proposal = findBestTradeProposal(game, game.players[0], {});
  assert.ok(proposal, "expected a cash-raising proposal");
  assert.equal(proposal.from, "bot_hard");
  assert.equal(proposal.to, "human");
  assert.deepEqual(proposal.given, [7]);
  assert.deepEqual(proposal.received, []);
  assert.ok((proposal.receivedMoney ?? 0) >= 80);
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
