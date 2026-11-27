import type { BotDifficulty, GameState, Player, Tile, Trade } from "~/types";
import {
  buildTradeSignature,
  isTradePreviouslyDeclined,
} from "~/shared/utils/tradeSignature";
import { getPlayerTradableProperties } from "~/utils/getPlayerTradableProperties";
import {
  applyTradeToOwnershipMap,
  buildOwnershipMap,
  computeGroupMonopolyPower,
  computePlayerPortfolioValue,
  evaluateIncomingTrade,
  getFullSetsFromOwnership,
} from "./tradeEvaluator";
import {
  evaluateTileStrategicValue,
  getFullSetGroupIds,
  getGroupStrategicMultiplier,
  getGroupTiles,
  getPlayerFullSetGroupIds,
  getSafetyReserve,
} from "./valuation";

interface RankedProposal {
  trade: Trade;
  score: number;
  signature: string;
}

function roundToTen(amount: number): number {
  return Math.max(0, Math.round(amount / 10) * 10);
}

function getTileById(game: GameState, id: number): Tile | undefined {
  return game.board.tiles.find((t) => t.id === id);
}

/**
 * Deterministically searches for the best legal, fair, non-declined trade proposal
 * initiated by `bot` toward an active opponent not currently on trade cooldown.
 */
export function findBestTradeProposal(
  game: GameState,
  bot: Player,
  cooldownByTarget: Record<string, number> = {}
): Trade | null {
  if (game.status === "ENDED") {
    return null;
  }

  const eliminated = new Set(game.eliminatedPlayers ?? []);
  if (eliminated.has(bot.username)) {
    return null;
  }

  const difficulty: BotDifficulty = bot.botDifficulty ?? "MEDIUM";
  const reserve = getSafetyReserve(game, bot, difficulty);
  const surplusCash = Math.max(0, bot.balance - reserve);

  const activeOpponents = game.players.filter(
    (p) =>
      p.username !== bot.username &&
      !eliminated.has(p.username) &&
      (cooldownByTarget[p.username] ?? 0) <= 0
  );

  if (!activeOpponents.length) {
    return null;
  }

  const fullSetGroupIds = getFullSetGroupIds(game);
  const botFullSets = new Set(getPlayerFullSetGroupIds(game, bot.username));
  const botTradableIds = getPlayerTradableProperties(
    game.board.tiles,
    fullSetGroupIds,
    bot.username
  );

  // Never propose breaking our own existing full monopolies
  const botGiveableTiles = botTradableIds
    .map((id) => getTileById(game, id))
    .filter((t): t is Tile => {
      if (!t) return false;
      if (t.type === "property" && t.groupId != null && botFullSets.has(t.groupId)) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.id - b.id);

  const oppTradableMap = new Map<string, Set<number>>();
  for (const opp of activeOpponents) {
    oppTradableMap.set(
      opp.username,
      new Set(
        getPlayerTradableProperties(
          game.board.tiles,
          fullSetGroupIds,
          opp.username
        )
      )
    );
  }

  const ownershipBefore = buildOwnershipMap(game);
  const botPortfolioBefore = computePlayerPortfolioValue(
    game,
    ownershipBefore,
    bot.username,
    bot.balance,
    reserve
  );

  const seenSignatures = new Set<string>();
  const rawCandidates: Array<{ trade: Trade; isCashRaise: boolean }> = [];

  const pushCandidate = (trade: Trade, isCashRaise: boolean = false) => {
    const normalized: Trade = {
      from: bot.username,
      to: trade.to,
      given: [...trade.given].sort((a, b) => a - b),
      received: [...trade.received].sort((a, b) => a - b),
      givenMoney: Math.max(0, Math.round(trade.givenMoney ?? 0)),
      receivedMoney: Math.max(0, Math.round(trade.receivedMoney ?? 0)),
    };

    if (
      normalized.given.length === 0 &&
      normalized.received.length === 0 &&
      (normalized.givenMoney ?? 0) === 0 &&
      (normalized.receivedMoney ?? 0) === 0
    ) {
      return;
    }

    const sig = buildTradeSignature(normalized);
    if (seenSignatures.has(sig)) {
      return;
    }
    if (isTradePreviouslyDeclined(game, normalized)) {
      return;
    }

    seenSignatures.add(sig);
    rawCandidates.push({ trade: normalized, isCashRaise });
  };

  // --- 1. Set-completion / set-advancement offers ---
  for (const group of game.board.groups) {
    const groupTiles = getGroupTiles(game, group);
    if (!groupTiles.length) {
      continue;
    }

    const ownedByBot = groupTiles.filter((t) => t.owner === bot.username);
    const missingTiles = groupTiles.filter((t) => t.owner !== bot.username);
    if (ownedByBot.length === 0 || missingTiles.length === 0) {
      continue;
    }

    const isCompleting = missingTiles.length === 1;
    // EASY only tries direct set completion; MEDIUM/HARD also pursue 1/3 -> 2/3 when clean
    if (difficulty === "EASY" && !isCompleting) {
      continue;
    }
    if (!isCompleting && ownedByBot.length < 1) {
      continue;
    }

    for (const wantedTile of missingTiles) {
      if (!wantedTile.owner) {
        continue;
      }
      const opp = activeOpponents.find((p) => p.username === wantedTile.owner);
      if (!opp) {
        continue;
      }
      const oppTradable = oppTradableMap.get(opp.username);
      if (!oppTradable || !oppTradable.has(wantedTile.id)) {
        continue;
      }

      const wantedPrice = wantedTile.price ?? 100;
      const wantedValBot = evaluateTileStrategicValue(
        game,
        wantedTile,
        bot.username
      );
      const wantedValOpp = evaluateTileStrategicValue(
        game,
        wantedTile,
        opp.username
      );

      // (a) Cash-only offer
      if (surplusCash >= wantedPrice) {
        const cashOfferRaw =
          difficulty === "EASY"
            ? wantedPrice * 1.1
            : difficulty === "MEDIUM"
              ? Math.max(wantedPrice * 1.25, wantedValOpp * 1.05)
              : Math.min(
                  wantedValBot * 0.85,
                  Math.max(wantedPrice * 1.25, wantedValOpp * 1.1)
                );

        const cashOffer = roundToTen(
          Math.min(surplusCash, Math.max(wantedPrice, cashOfferRaw))
        );

        if (cashOffer >= wantedPrice && cashOffer <= surplusCash) {
          pushCandidate({
            from: bot.username,
            to: opp.username,
            given: [],
            received: [wantedTile.id],
            givenMoney: cashOffer,
            receivedMoney: 0,
          });
        }
      }

      // Eligible tiles bot can give (never from the group we're trying to complete)
      const eligibleGiveTiles = botGiveableTiles.filter(
        (t) => !(t.type === "property" && t.groupId === group.groupId)
      );

      // (b) 1-for-1 tile swap (+ optional cash sweetener / cash request)
      for (const giveTile of eligibleGiveTiles) {
        const givePrice = giveTile.price ?? 100;
        const giveValOpp = evaluateTileStrategicValue(
          game,
          giveTile,
          opp.username
        );

        let givenMoney = 0;
        let receivedMoney = 0;

        const targetBaseNeed = Math.max(wantedPrice, wantedValOpp);
        if (giveValOpp < targetBaseNeed) {
          const gap = roundToTen((targetBaseNeed - giveValOpp) * 1.05);
          if (gap > 0 && gap <= surplusCash) {
            givenMoney = gap;
          }
        } else if (
          difficulty !== "EASY" &&
          givePrice > wantedPrice + 40 &&
          opp.balance >= 120
        ) {
          const ask = roundToTen((givePrice - wantedPrice) * 0.5);
          if (ask > 0 && opp.balance - ask >= 100) {
            receivedMoney = ask;
          }
        }

        pushCandidate({
          from: bot.username,
          to: opp.username,
          given: [giveTile.id],
          received: [wantedTile.id],
          givenMoney,
          receivedMoney,
        });
      }

      // (c) 2-for-1 tile swap for completing a monopoly (MEDIUM / HARD)
      if (difficulty !== "EASY" && isCompleting && eligibleGiveTiles.length >= 2) {
        // Pick up to 5 lowest-value-to-bot singletons to keep search compact & deterministic
        const singletons = eligibleGiveTiles
          .filter((t) => {
            if (t.type !== "property" || t.groupId == null) return true;
            const g = game.board.groups.find((gr) => gr.groupId === t.groupId);
            if (!g) return true;
            const ownedInG = g.properties.filter(
              (pid) => ownershipBefore.get(pid) === bot.username
            ).length;
            return ownedInG === 1;
          })
          .sort(
            (a, b) =>
              evaluateTileStrategicValue(game, a, bot.username) -
                evaluateTileStrategicValue(game, b, bot.username) ||
              a.id - b.id
          )
          .slice(0, 5);

        for (let i = 0; i < singletons.length; i++) {
          for (let j = i + 1; j < singletons.length; j++) {
            const t1 = singletons[i];
            const t2 = singletons[j];
            const combinedFace = (t1.price ?? 0) + (t2.price ?? 0);
            if (combinedFace > wantedPrice * 2.1) {
              continue;
            }
            pushCandidate({
              from: bot.username,
              to: opp.username,
              given: [t1.id, t2.id],
              received: [wantedTile.id],
              givenMoney: 0,
              receivedMoney: 0,
            });
          }
        }
      }
    }
  }

  // --- 2. Cash-raising offer when bot is low on cash ---
  if (bot.balance < reserve && botGiveableTiles.length > 0) {
    const singletons = botGiveableTiles
      .filter((t) => {
        if (t.type !== "property" || t.groupId == null) return true;
        const g = game.board.groups.find((gr) => gr.groupId === t.groupId);
        if (!g) return true;
        const ownedInG = g.properties.filter(
          (pid) => ownershipBefore.get(pid) === bot.username
        ).length;
        return ownedInG === 1;
      })
      .sort(
        (a, b) =>
          evaluateTileStrategicValue(game, a, bot.username) -
            evaluateTileStrategicValue(game, b, bot.username) || a.id - b.id
      );

    if (singletons.length > 0) {
      const tileToSell = singletons[0];
      const basePrice = tileToSell.price ?? 100;

      for (const opp of activeOpponents) {
        if (opp.balance < Math.max(200, basePrice * 1.4)) {
          continue;
        }
        const valToOpp = evaluateTileStrategicValue(
          game,
          tileToSell,
          opp.username
        );
        const askCash = roundToTen(
          Math.min(
            opp.balance - 100,
            Math.max(basePrice * 0.9, Math.min(valToOpp * 0.95, basePrice * 1.25))
          )
        );
        if (askCash >= Math.round(basePrice * 0.8) && askCash <= opp.balance - 100) {
          pushCandidate(
            {
              from: bot.username,
              to: opp.username,
              given: [tileToSell.id],
              received: [],
              givenMoney: 0,
              receivedMoney: askCash,
            },
            true
          );
        }
      }
    }
  }

  // --- 3. Filter for strategic validity, fairness, and deterministic ranking ---
  const ranked: RankedProposal[] = [];

  for (const { trade, isCashRaise } of rawCandidates) {
    const opp = activeOpponents.find((p) => p.username === trade.to);
    if (!opp) {
      continue;
    }

    const givenMoney = trade.givenMoney ?? 0;
    const receivedMoney = trade.receivedMoney ?? 0;
    const postBotBalance = bot.balance - givenMoney + receivedMoney;
    const postOppBalance = opp.balance - receivedMoney + givenMoney;

    if (postBotBalance < 0 || postOppBalance < 0) {
      continue;
    }

    const ownershipAfter = applyTradeToOwnershipMap(ownershipBefore, trade);
    const botFullBefore = getFullSetsFromOwnership(
      game,
      ownershipBefore,
      bot.username
    );
    const botFullAfter = getFullSetsFromOwnership(
      game,
      ownershipAfter,
      bot.username
    );
    const oppFullBefore = getFullSetsFromOwnership(
      game,
      ownershipBefore,
      opp.username
    );
    const oppFullAfter = getFullSetsFromOwnership(
      game,
      ownershipAfter,
      opp.username
    );

    const botNewMonos = botFullAfter.filter((g) => !botFullBefore.includes(g));
    const oppNewMonos = oppFullAfter.filter((g) => !oppFullBefore.includes(g));

    // HARD bot guard: never propose handing opponent a monopoly unless bot gets a comparable/stronger one
    if (difficulty === "HARD" && oppNewMonos.length > 0) {
      if (botNewMonos.length === 0) {
        continue;
      }
      const botPower = botNewMonos.reduce(
        (s, g) => s + computeGroupMonopolyPower(game, g),
        0
      );
      const oppPower = oppNewMonos.reduce(
        (s, g) => s + computeGroupMonopolyPower(game, g),
        0
      );
      if (botPower < oppPower * 0.95) {
        continue;
      }
      if (postBotBalance < reserve) {
        continue;
      }
    }

    // Compute bot's strategic gain
    const botPortfolioAfter = computePlayerPortfolioValue(
      game,
      ownershipAfter,
      bot.username,
      postBotBalance,
      reserve
    );
    const botDelta =
      botPortfolioAfter + postBotBalance - (botPortfolioBefore + bot.balance);

    // Cash-raising trades get a liquidity rescue bonus when bot is below safety reserve
    const liquidityBonus = isCashRaise
      ? Math.min(receivedMoney, Math.max(0, reserve - bot.balance)) * 0.6
      : 0;

    if (botDelta + liquidityBonus <= 0) {
      continue;
    }

    // Target fairness / plausibility check
    const offeredToOppVal =
      trade.given.reduce(
        (s, id) =>
          s +
          Math.max(
            getTileById(game, id)?.price ?? 0,
            evaluateTileStrategicValue(game, getTileById(game, id)!, opp.username)
          ),
        0
      ) + givenMoney;

    const requestedFromOppVal =
      trade.received.reduce(
        (s, id) => s + (getTileById(game, id)?.price ?? 0),
        0
      ) + receivedMoney;

    if (requestedFromOppVal > 0) {
      const ratio = offeredToOppVal / requestedFromOppVal;
      if (ratio < 0.78 || ratio > 2.2) {
        continue;
      }
    }

    let plausibilityBonus = 0;
    if (opp.isBot) {
      const oppEval = evaluateIncomingTrade(game, opp, trade);
      if (oppEval.accept) {
        plausibilityBonus = 500;
      } else if (difficulty === "HARD" || oppEval.score < -80) {
        // Avoid wasting turns on clearly rejected bot-to-bot trades
        continue;
      }
    } else {
      // For human targets, slightly favor clean, attractive offers
      if (
        requestedFromOppVal > 0 &&
        offeredToOppVal >= requestedFromOppVal * 0.95 &&
        offeredToOppVal <= requestedFromOppVal * 1.5
      ) {
        plausibilityBonus = 100;
      }
    }

    const monopolyPriorityBonus = botNewMonos.reduce(
      (s, g) => s + Math.round(getGroupStrategicMultiplier(g) * 150),
      0
    );

    const score = Math.round(
      botDelta + liquidityBonus + monopolyPriorityBonus + plausibilityBonus
    );

    ranked.push({
      trade,
      score,
      signature: buildTradeSignature(trade),
    });
  }

  if (!ranked.length) {
    return null;
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.signature.localeCompare(b.signature);
  });

  return ranked[0].trade;
}
