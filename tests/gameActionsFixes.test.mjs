import test from "node:test";
import assert from "node:assert/strict";
import { handleRollDice } from "~/server/utils/gameActions/handleRollDice";
import { payTax } from "~/server/utils/gameActions/payTax";
import { payRent } from "~/server/utils/gameActions/payRent";
import { sendTrade } from "~/server/utils/gameActions/sendTrade";
import { acceptTrade } from "~/server/utils/gameActions/acceptTrade";
import { declineTrade } from "~/server/utils/gameActions/declineTrade";
import { passAuctionProperty } from "~/server/utils/gameActions/passAuctionProperty";
import { bidAuctionProperty } from "~/server/utils/gameActions/bidAuctionProperty";
import { mortgageProperty } from "~/server/utils/gameActions/mortgageProperty";
import { buybackProperty } from "~/server/utils/gameActions/buybackProperty";
import { upgradeProperty } from "~/server/utils/gameActions/upgradeProperty";
import { sellProperty } from "~/server/utils/gameActions/sellProperty";
import {
  assignPropertyToPlayer,
  recalculateSpecialPropertyRentLevels,
  syncPropertySets,
} from "~/server/utils/gameActions/shared";
import {
  buildTradeSignature,
  computeBoardOwnershipHash,
  isTradePreviouslyDeclined,
} from "~/shared/utils/tradeSignature";
import {
  defaultPlayerTemplate,
  defaultPropertyGroups,
  defaultTiles,
} from "~/server/constants";

function createTestGame(playerOverrides = []) {
  const defaultPlayers = [
    { username: "alice", color: "#9999FF" },
    { username: "bob", color: "#99CC99" },
  ];
  const players = (
    playerOverrides.length ? playerOverrides : defaultPlayers
  ).map((override, idx) => ({
    ...structuredClone(defaultPlayerTemplate),
    username: defaultPlayers[idx]?.username ?? `player${idx + 1}`,
    color: defaultPlayers[idx]?.color ?? "#FF9999",
    ...override,
  }));

  return {
    id: "game-1",
    associatedRoomId: "room-1",
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
    },
    lastDiceRoll: null,
    declinedTrades: [],
  };
}

test("handleRollDice saves lastDiceRoll and advances turn when landing on opponent's mortgaged property", () => {
  const game = createTestGame([{ position: 1 }, { position: 1 }]);
  const tile = game.board.tiles.find((t) => t.id === 4); // Silpo
  tile.owner = "bob";
  tile.mortgaged = true;
  game.players[1].properties.push(4);

  handleRollDice(game, game.players[0], 0, {
    action: "ROLL_DICE",
    payload: { username: "alice", turnResult: { left: 1, right: 2 } },
  });

  assert.deepEqual(game.lastDiceRoll, { left: 1, right: 2 });
  assert.equal(game.players[0].position, 4);
  assert.equal(game.currentAction, "roll");
  assert.equal(game.currentTurn, "bob");
  assert.ok(
    game.gameLog.some(
      (entry) =>
        entry.username === "alice" &&
        entry.msg === "Silpo is mortgaged — no rent owed"
    )
  );
});

test("payTax deducts tax, logs payment, resets action to roll, and advances turn", () => {
  const game = createTestGame([{ balance: 1500 }, { balance: 1500 }]);
  game.currentAction = "payTax";

  payTax(game, game.players[0], 0, {
    action: "PAY_TAX",
    payload: { username: "alice", tax: 100 },
  });

  assert.equal(game.players[0].balance, 1400);
  assert.equal(game.currentAction, "roll");
  assert.equal(game.currentTurn, "bob");
  assert.ok(
    game.gameLog.some(
      (entry) => entry.username === "alice" && entry.msg === "paid $100 tax"
    )
  );
});

test("payRent on bonus-property uses game.lastDiceRoll when payload.turnResult is omitted, and falls back to 7", () => {
  const game = createTestGame([{ balance: 1500 }, { balance: 1500 }]);
  const ukrnafta = game.board.tiles.find((t) => t.id === 13);
  assignPropertyToPlayer(game, ukrnafta, game.players[1], 0);
  game.lastDiceRoll = { left: 4, right: 5 }; // sum = 9, base rent = 4 => $36
  game.currentAction = "payRent";

  payRent(game, game.players[0], 0, {
    action: "PAY_RENT",
    payload: { username: "alice", propertyId: 13 },
  });

  assert.equal(game.players[0].balance, 1464);
  assert.equal(game.players[1].balance, 1536);
  assert.equal(game.currentAction, "roll");
  assert.equal(game.currentTurn, "bob");
  assert.ok(
    game.gameLog.some(
      (entry) =>
        entry.username === "alice" &&
        entry.msg === "paid $36 rent to bob for Ukrnafta"
    )
  );

  // Also verify fallback multiplier 7 when neither turnResult nor lastDiceRoll exists
  const game2 = createTestGame([{ balance: 1500 }, { balance: 1500 }]);
  const ukrnafta2 = game2.board.tiles.find((t) => t.id === 13);
  const naftogaz2 = game2.board.tiles.find((t) => t.id === 29);
  assignPropertyToPlayer(game2, ukrnafta2, game2.players[1], 0);
  assignPropertyToPlayer(game2, naftogaz2, game2.players[1], 0); // 2 bonus props => rentLevel 1 => multiplier 10
  game2.lastDiceRoll = null;

  payRent(game2, game2.players[0], 0, {
    action: "PAY_RENT",
    payload: { username: "alice", propertyId: 13 },
  });

  assert.equal(game2.players[0].balance, 1430); // 10 * 7 = 70
  assert.equal(game2.players[1].balance, 1570);
});

test("acceptTrade recalculates car, bonus-property, and full-set rents idempotently without double-doubling", () => {
  const game = createTestGame([{ balance: 1500 }, { balance: 1500 }]);
  const alice = game.players[0];
  const bob = game.players[1];

  const atb = game.board.tiles.find((t) => t.id === 2); // group 1, base rent 2
  const silpo = game.board.tiles.find((t) => t.id === 4); // group 1, base rent 4
  const mercedes = game.board.tiles.find((t) => t.id === 6); // car
  const porsche = game.board.tiles.find((t) => t.id === 16); // car
  const ukrnafta = game.board.tiles.find((t) => t.id === 13); // bonus
  const naftogaz = game.board.tiles.find((t) => t.id === 29); // bonus

  // Initial ownership:
  // alice owns ATB (2), Mercedes (6), Ukrnafta (13)
  // bob owns Silpo (4), Porsche (16), Naftogaz (29)
  assignPropertyToPlayer(game, atb, alice, 0);
  assignPropertyToPlayer(game, mercedes, alice, 0);
  assignPropertyToPlayer(game, ukrnafta, alice, 0);
  assignPropertyToPlayer(game, silpo, bob, 0);
  assignPropertyToPlayer(game, porsche, bob, 0);
  assignPropertyToPlayer(game, naftogaz, bob, 0);

  // Alice gives Mercedes(6) + Ukrnafta(13) + $50 to Bob for Silpo(4)
  sendTrade(game, {
    action: "TRADE",
    payload: {
      username: "alice",
      tradePlayerUsername: "bob",
      tradeTiles: {
        given: [6, 13],
        received: [4],
        givenMoney: "50",
        receivedMoney: "",
      },
    },
  });

  assert.equal(game.activeTrade.givenMoney, 50);
  assert.equal(game.activeTrade.receivedMoney, 0);
  assert.equal(game.currentAction, "trade");

  acceptTrade(game);

  const group1 = game.board.groups.find((g) => g.groupId === 1);
  assert.equal(group1.isFullSet, true);
  assert.equal(atb.rentLevels[0], 4); // doubled once from 2 -> 4
  assert.equal(silpo.rentLevels[0], 8); // doubled once from 4 -> 8
  assert.deepEqual(alice.ownedPropertyGroupIds, [1]);
  assert.deepEqual(bob.ownedPropertyGroupIds, []);

  // Bob now owns both cars (6, 16) and both bonus properties (13, 29)
  assert.equal(mercedes.rentLevel, 1);
  assert.equal(porsche.rentLevel, 1);
  assert.equal(ukrnafta.rentLevel, 1);
  assert.equal(naftogaz.rentLevel, 1);

  assert.equal(alice.balance, 1450);
  assert.equal(bob.balance, 1550);
  assert.equal(game.currentAction, "roll");
  assert.equal(game.activeTrade.from, "");

  // Calling syncPropertySets & recalculateSpecialPropertyRentLevels again must NOT double-double
  syncPropertySets(game);
  recalculateSpecialPropertyRentLevels(game);
  assert.equal(atb.rentLevels[0], 4);
  assert.equal(silpo.rentLevels[0], 8);
  assert.equal(mercedes.rentLevel, 1);
  assert.equal(ukrnafta.rentLevel, 1);

  // Trading a full set directly to Bob keeps rentLevels[0] doubled once (no double-doubling) and moves ownedPropertyGroupIds
  sendTrade(game, {
    action: "TRADE",
    payload: {
      username: "alice",
      tradePlayerUsername: "bob",
      tradeTiles: {
        given: [2, 4],
        received: [],
        givenMoney: 0,
        receivedMoney: 200,
      },
    },
  });
  acceptTrade(game);

  assert.equal(group1.isFullSet, true);
  assert.equal(atb.rentLevels[0], 4);
  assert.equal(silpo.rentLevels[0], 8);
  assert.deepEqual(alice.ownedPropertyGroupIds, []);
  assert.deepEqual(bob.ownedPropertyGroupIds, [1]);
});

test("declineTrade records declined trade signature and boardHash before clearing activeTrade", () => {
  const game = createTestGame([{ balance: 1500 }, { balance: 1500 }]);
  const atb = game.board.tiles.find((t) => t.id === 2);
  const silpo = game.board.tiles.find((t) => t.id === 4);
  assignPropertyToPlayer(game, atb, game.players[0], 0);
  assignPropertyToPlayer(game, silpo, game.players[1], 0);

  const expectedBoardHash = computeBoardOwnershipHash(game);
  const tradeOffer = {
    from: "alice",
    to: "bob",
    given: [2],
    received: [4],
    givenMoney: 25,
    receivedMoney: 0,
  };

  sendTrade(game, {
    action: "TRADE",
    payload: {
      username: "alice",
      tradePlayerUsername: "bob",
      tradeTiles: {
        given: [2],
        received: [4],
        givenMoney: 25,
        receivedMoney: 0,
      },
    },
  });

  declineTrade(game);

  assert.equal(game.currentAction, "roll");
  assert.equal(game.activeTrade.from, "");
  assert.equal(game.activeTrade.to, "");
  assert.equal(game.declinedTrades.length, 1);
  assert.deepEqual(game.declinedTrades[0], {
    from: "alice",
    to: "bob",
    signature: buildTradeSignature(tradeOffer),
    boardHash: expectedBoardHash,
  });
  assert.equal(isTradePreviouslyDeclined(game, tradeOffer), true);
  assert.ok(
    game.gameLog.some(
      (entry) =>
        entry.username === "bob" && entry.msg === "declined trade from alice"
    )
  );
});

test("passAuctionProperty uses assignPropertyToPlayer (syncing sets & rents) and resets auction state", () => {
  const game = createTestGame([
    { username: "alice", balance: 1500 },
    { username: "bob", balance: 1500 },
    { username: "carol", balance: 1500 },
  ]);

  // Bob already owns ATB (tile 2) from group 1
  const atb = game.board.tiles.find((t) => t.id === 2);
  const silpo = game.board.tiles.find((t) => t.id === 4); // price 60
  assignPropertyToPlayer(game, atb, game.players[1], 0);

  // Auction for Silpo (4) with bob and carol; bob already bid $70 (> $60 price)
  game.currentAction = "auction";
  game.auctionParticipants = ["bob", "carol"];
  game.activeAuctionBidder = "carol";
  game.auctionBidAmount = 70;
  game.auctionedTileId = 4;

  passAuctionProperty(game, game.players[0], 0, {
    action: "PASS_AUCTION_PROPERTY",
    payload: { username: "carol", propertyId: 4 },
  });

  assert.equal(silpo.owner, "bob");
  assert.equal(game.players[1].balance, 1430);
  assert.ok(game.players[1].properties.includes(4));
  // Full set sync from assignPropertyToPlayer must have triggered!
  const group1 = game.board.groups.find((g) => g.groupId === 1);
  assert.equal(group1.isFullSet, true);
  assert.equal(atb.rentLevels[0], 4);
  assert.equal(silpo.rentLevels[0], 8);
  assert.deepEqual(game.players[1].ownedPropertyGroupIds, [1]);

  // Clean auction reset
  assert.deepEqual(game.auctionParticipants, []);
  assert.equal(game.activeAuctionBidder, "");
  assert.equal(game.auctionBidAmount, 0);
  assert.equal(game.auctionedTileId, null);
  assert.equal(game.currentAction, "roll");
  assert.equal(game.currentTurn, "bob");
});

test("bidAuctionProperty finishes cleanly when single participant bids and resets auction state", () => {
  const game = createTestGame([
    { username: "alice", balance: 1500 },
    { username: "bob", balance: 1500 },
  ]);
  const mercedes = game.board.tiles.find((t) => t.id === 6);
  const porsche = game.board.tiles.find((t) => t.id === 16);
  assignPropertyToPlayer(game, mercedes, game.players[1], 0);

  game.currentAction = "auction";
  game.auctionParticipants = ["bob"];
  game.activeAuctionBidder = "bob";
  game.auctionBidAmount = 200;
  game.auctionedTileId = 16;

  bidAuctionProperty(game, game.players[0], 0, {
    action: "BID_AUCTION_PROPERTY",
    payload: { username: "bob", propertyId: 16 },
  });

  assert.equal(porsche.owner, "bob");
  assert.equal(game.players[1].balance, 1290); // 200 + 10 increment
  assert.equal(mercedes.rentLevel, 1);
  assert.equal(porsche.rentLevel, 1);
  assert.deepEqual(game.auctionParticipants, []);
  assert.equal(game.activeAuctionBidder, "");
  assert.equal(game.auctionBidAmount, 0);
  assert.equal(game.auctionedTileId, null);
  assert.equal(game.currentAction, "roll");
  assert.equal(game.currentTurn, "bob");
});

test("mortgage, buyback, upgrade, and sell actions enforce ownership and Monopoly building rules", () => {
  const game = createTestGame([{ balance: 1500 }, { balance: 1500 }]);
  const alice = game.players[0];
  const bob = game.players[1];

  const atb = game.board.tiles.find((t) => t.id === 2);
  const silpo = game.board.tiles.find((t) => t.id === 4);
  const group1 = game.board.groups.find((g) => g.groupId === 1);

  assignPropertyToPlayer(game, atb, alice, 0);
  assignPropertyToPlayer(game, silpo, alice, 0);

  // Non-owner cannot mortgage or upgrade
  mortgageProperty(game, bob, { payload: { propertyId: 2 } });
  assert.equal(atb.mortgaged, false);
  upgradeProperty(game, bob, { payload: { propertyId: 2 } });
  assert.equal(atb.rentLevel, 0);

  // Valid upgrade on ATB (0 -> 1)
  upgradeProperty(game, alice, { payload: { propertyId: 2 } });
  assert.equal(atb.rentLevel, 1);
  assert.equal(alice.balance, 1450);
  assert.equal(group1.isUpgradeAvailable, false);

  // Reset upgrade availability for next turn
  group1.isUpgradeAvailable = true;

  // Cannot unevenly upgrade ATB to 2 while Silpo is at 0
  upgradeProperty(game, alice, { payload: { propertyId: 2 } });
  assert.equal(atb.rentLevel, 1);

  // Cannot mortgage Silpo while ATB in the same group has an upgrade
  mortgageProperty(game, alice, { payload: { propertyId: 4 } });
  assert.equal(silpo.mortgaged, false);

  // Downgrade ATB (1 -> 0) works, then mortgaging Silpo works
  sellProperty(game, alice, { payload: { propertyId: 2 } });
  assert.equal(atb.rentLevel, 0);

  mortgageProperty(game, alice, { payload: { propertyId: 4 } });
  assert.equal(silpo.mortgaged, true);

  // Cannot upgrade ATB while Silpo is mortgaged
  upgradeProperty(game, alice, { payload: { propertyId: 2 } });
  assert.equal(atb.rentLevel, 0);

  // Redeem Silpo, then upgrade succeeds
  buybackProperty(game, alice, { payload: { propertyId: 4 } });
  assert.equal(silpo.mortgaged, false);
  upgradeProperty(game, alice, { payload: { propertyId: 2 } });
  assert.equal(atb.rentLevel, 1);
});

test("Cars and Energy Utilities can be mortgaged and redeemed (including when owning sets with rentLevel > 0)", () => {
  const game = createTestGame([{ balance: 500 }, { balance: 1500 }]);
  const alice = game.players[0];

  const mercedes = game.board.tiles.find((t) => t.id === 6);
  const porsche = game.board.tiles.find((t) => t.id === 16);
  const ukrnafta = game.board.tiles.find((t) => t.id === 13);
  const naftogaz = game.board.tiles.find((t) => t.id === 29);

  // Assign 2 Cars + 2 Utilities so rentLevel becomes 1 on all of them
  assignPropertyToPlayer(game, mercedes, alice, 0);
  assignPropertyToPlayer(game, porsche, alice, 0);
  assignPropertyToPlayer(game, ukrnafta, alice, 0);
  assignPropertyToPlayer(game, naftogaz, alice, 0);

  assert.equal(mercedes.rentLevel, 1);
  assert.equal(ukrnafta.rentLevel, 1);

  // Mortgage Car ($200 -> +$100) and Energy Utility ($150 -> +$75)
  mortgageProperty(game, alice, { payload: { propertyId: 6 } });
  assert.equal(mercedes.mortgaged, true);
  assert.equal(alice.balance, 600);

  mortgageProperty(game, alice, { payload: { propertyId: 13 } });
  assert.equal(ukrnafta.mortgaged, true);
  assert.equal(alice.balance, 675);

  // Redeem Car (-$120) and Energy Utility (-$90)
  buybackProperty(game, alice, { payload: { propertyId: 6 } });
  assert.equal(mercedes.mortgaged, false);
  assert.equal(alice.balance, 555);

  buybackProperty(game, alice, { payload: { propertyId: 13 } });
  assert.equal(ukrnafta.mortgaged, false);
  assert.equal(alice.balance, 465);
});

test("acceptTrade supports mortgaged properties with Strict Hasbro 10% mortgage transfer fee", () => {
  const game = createTestGame([{ balance: 500 }, { balance: 500 }]);
  const alice = game.players[0];
  const bob = game.players[1];

  // Alice owns mortgaged EPAM (tile 20, price $200, mortgage $100 -> 10% fee = $10)
  // Bob owns mortgaged Ukrnafta (tile 13, price $150, mortgage $75 -> 10% fee = ceil(7.5) = $8)
  const epam = game.board.tiles.find((t) => t.id === 20);
  const ukrnafta = game.board.tiles.find((t) => t.id === 13);
  assignPropertyToPlayer(game, epam, alice, 0);
  assignPropertyToPlayer(game, ukrnafta, bob, 0);
  epam.mortgaged = true;
  ukrnafta.mortgaged = true;

  // Swap EPAM + $20 from Alice for Ukrnafta from Bob
  game.currentAction = "trade";
  game.activeTrade = {
    from: "alice",
    to: "bob",
    given: [20],
    received: [13],
    givenMoney: 20,
    receivedMoney: 0,
    returnAction: "roll",
  };

  acceptTrade(game);

  // Ownership transfers and both properties remain mortgaged
  assert.equal(epam.owner, "bob");
  assert.equal(epam.mortgaged, true);
  assert.equal(ukrnafta.owner, "alice");
  assert.equal(ukrnafta.mortgaged, true);

  // Alice: 500 - 20 (cash) - 8 (10% of $75) = 472
  // Bob:   500 + 20 (cash) - 10 (10% of $100) = 510
  assert.equal(alice.balance, 472);
  assert.equal(bob.balance, 510);
  assert.ok(
    game.gameLog.some((e) => e.username === "bob" && e.msg.includes("$10 mortgage transfer fee"))
  );
  assert.ok(
    game.gameLog.some((e) => e.username === "alice" && e.msg.includes("$8 mortgage transfer fee"))
  );

  // If recipient cannot afford the 10% mortgage transfer fee, acceptTrade refuses to execute
  alice.balance = 5; // cannot afford $10 fee for receiving mortgaged EPAM back
  game.currentAction = "trade";
  game.activeTrade = {
    from: "bob",
    to: "alice",
    given: [20],
    received: [],
    givenMoney: 0,
    receivedMoney: 0,
    returnAction: "roll",
  };
  acceptTrade(game);
  assert.equal(epam.owner, "bob", "trade must not execute when recipient cannot pay 10% fee");
  assert.equal(alice.balance, 5);
});


