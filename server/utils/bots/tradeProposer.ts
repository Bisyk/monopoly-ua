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
  countSpecialTilesFromOwnership,
  evaluateIncomingTrade,
  getFullSetsFromOwnership,
} from "./tradeEvaluator";
import {
  doesTileCompleteSet,
  evaluateTileStrategicValue,
  getFullSetGroupIds,
  getGroupStrategicMultiplier,
  getGroupTiles,
  getPlayerFullSetGroupIds,
  getSafetyReserve,
  isOpponentLeading,
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
      // MEDIUM/HARD do not spam cash-only offers trying to buy a completing tile for a full set;
      // they must negotiate real property swaps / mutual sets instead.
      const allowCashOnlyOffer = difficulty === "EASY" || !isCompleting;
      if (allowCashOnlyOffer && surplusCash >= wantedPrice) {
        const cashOfferRaw =
          difficulty === "EASY"
            ? wantedPrice * 1.1
            : difficulty === "MEDIUM"
              ? Math.max(wantedPrice * 1.2, wantedValOpp * 1.05)
              : Math.min(
                  wantedValBot * 0.85,
                  Math.max(wantedPrice * 1.2, wantedValOpp * 1.08)
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

      // (b) 1-for-1 tile swap (+ smart cash balancing for mutual-set swaps)
      for (const giveTile of eligibleGiveTiles) {
        const givePrice = giveTile.price ?? 100;
        const giveValOpp = evaluateTileStrategicValue(
          game,
          giveTile,
          opp.username
        );

        let givenMoney = 0;
        let receivedMoney = 0;

        const isMutualMonopolySwap =
          isCompleting &&
          giveTile.type === "property" &&
          giveTile.groupId != null &&
          doesTileCompleteSet(game, giveTile, opp.username);

        if (isMutualMonopolySwap && difficulty !== "EASY") {
          const botSetPower = computeGroupMonopolyPower(game, group.groupId);
          const oppSetPower = computeGroupMonopolyPower(game, giveTile.groupId!);
          const powerDiff = botSetPower - oppSetPower;

          if (powerDiff > 40) {
            // Bot is getting the stronger set: offer cash sweetener to make swap realistic
            const sweetener = roundToTen(Math.min(surplusCash, powerDiff * 0.55));
            if (sweetener > 0) {
              givenMoney = sweetener;
            }
          } else if (powerDiff < -40 && opp.balance >= 160) {
            // Opponent is getting the stronger set: ask for cash to rush houses on our set
            const ask = roundToTen(
              Math.min(opp.balance - 100, Math.abs(powerDiff) * 0.65)
            );
            if (ask >= 40) {
              receivedMoney = ask;
            }
          }
        } else {
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

      // (c) 2-for-1 tile swap (+ optional cash sweetener/ask) for completing a monopoly (MEDIUM / HARD)
      if (difficulty !== "EASY" && isCompleting && eligibleGiveTiles.length >= 2) {
        const lowValueSingletons = eligibleGiveTiles
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
          );

        // (c1) 2-for-1 mutual monopoly swaps: opponent's completing tile + a sweetener singleton
        //      (unlocks unequal monopoly trades even when cash alone can't bridge the power gap!)
        const oppCompletingTiles = eligibleGiveTiles.filter(
          (t) =>
            t.type === "property" &&
            t.groupId != null &&
            doesTileCompleteSet(game, t, opp.username)
        );
        for (const compTile of oppCompletingTiles) {
          const botSetPower = computeGroupMonopolyPower(game, group.groupId);
          const oppSetPower = computeGroupMonopolyPower(game, compTile.groupId!);
          const powerDiff = botSetPower - oppSetPower;

          const sweeteners = lowValueSingletons
            .filter(
              (s) =>
                s.id !== compTile.id &&
                !(s.type === "property" && s.groupId === compTile.groupId)
            )
            .slice(0, 3);

          for (const sweet of sweeteners) {
            const sweetPower = (sweet.price ?? 0) * 0.9;
            const residualDiff = powerDiff - sweetPower;
            let givenMoney = 0;
            let receivedMoney = 0;

            if (residualDiff > 50) {
              const cashSweet = roundToTen(
                Math.min(surplusCash, residualDiff * 0.55)
              );
              if (cashSweet > 0) {
                givenMoney = cashSweet;
              }
            } else if (residualDiff < -60 && opp.balance >= 160) {
              const cashAsk = roundToTen(
                Math.min(opp.balance - 100, Math.abs(residualDiff) * 0.6)
              );
              if (cashAsk >= 40) {
                receivedMoney = cashAsk;
              }
            }

            pushCandidate({
              from: bot.username,
              to: opp.username,
              given: [compTile.id, sweet.id],
              received: [wantedTile.id],
              givenMoney,
              receivedMoney,
            });
          }
        }

        // (c2) Standard 2-for-1 singleton package (useful against humans or EASY opponents)
        const singletons = lowValueSingletons.slice(0, 5);
        for (let i = 0; i < singletons.length; i++) {
          for (let j = i + 1; j < singletons.length; j++) {
            const t1 = singletons[i];
            const t2 = singletons[j];
            const combinedFace = (t1.price ?? 0) + (t2.price ?? 0);
            if (combinedFace > wantedPrice * 2.2) {
              continue;
            }

            const combinedValOpp =
              evaluateTileStrategicValue(game, t1, opp.username) +
              evaluateTileStrategicValue(game, t2, opp.username);
            const targetBaseNeed = Math.max(wantedPrice, wantedValOpp);

            // Avoid pitching weak low-ball 2-for-1 junk to humans
            if (!opp.isBot && combinedValOpp < wantedPrice * 1.15 && surplusCash < 60) {
              continue;
            }

            let givenMoney = 0;
            let receivedMoney = 0;
            if (combinedValOpp < targetBaseNeed) {
              const gap = roundToTen((targetBaseNeed - combinedValOpp) * 0.95);
              if (gap > 0 && gap <= surplusCash) {
                givenMoney = gap;
              }
            } else if (
              combinedFace > wantedPrice + 80 &&
              opp.balance >= 160
            ) {
              const ask = roundToTen(
                Math.min(opp.balance - 100, (combinedFace - wantedPrice) * 0.45)
              );
              if (ask >= 30) {
                receivedMoney = ask;
              }
            }

            pushCandidate({
              from: bot.username,
              to: opp.username,
              given: [t1.id, t2.id],
              received: [wantedTile.id],
              givenMoney,
              receivedMoney,
            });
          }
        }
      }
    }
  }

  // --- 2. Cash-raising offer when bot is genuinely low on cash ---
  const cashRaiseThreshold =
    difficulty === "EASY" ? reserve : Math.max(100, Math.round(reserve * 0.65));
  if (bot.balance < cashRaiseThreshold && botGiveableTiles.length > 0) {
    const botCarsCount = countSpecialTilesFromOwnership(
      game,
      ownershipBefore,
      bot.username,
      "car"
    );
    const botUtilsCount = countSpecialTilesFromOwnership(
      game,
      ownershipBefore,
      bot.username,
      "bonus-property"
    );
    const singletons = botGiveableTiles
      .filter((t) => {
        if (t.type === "bonus-property") {
          return botUtilsCount < 2;
        }
        if (t.type === "car") {
          return botCarsCount < 2;
        }
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
      // MEDIUM & HARD only sell singletons for cash when an opponent genuinely wants one
      // at a lucrative 1.4x–2.0x price (no 0.93x–1.25x bargain fire-sales or tile hot-potato!)
      const targetedOffer = findBestPreMortgageTradeOffer(
        game,
        bot,
        singletons,
        {
          cooldownByTarget,
          isBankruptcyEmergency: false,
        }
      );
      if (targetedOffer) {
        pushCandidate(targetedOffer, true);
      }

      if (difficulty === "EASY") {
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

    // MEDIUM & HARD guard: never propose breaking/gifting special sets (2/2 Energy Utilities or 3-4 Cars)
    // unless bot receives a color monopoly (or 3+ Cars for utilities)
    if (difficulty !== "EASY") {
      const botUtilsB = countSpecialTilesFromOwnership(game, ownershipBefore, bot.username, "bonus-property");
      const botUtilsA = countSpecialTilesFromOwnership(game, ownershipAfter, bot.username, "bonus-property");
      const oppUtilsB = countSpecialTilesFromOwnership(game, ownershipBefore, opp.username, "bonus-property");
      const oppUtilsA = countSpecialTilesFromOwnership(game, ownershipAfter, opp.username, "bonus-property");
      const botCarsB = countSpecialTilesFromOwnership(game, ownershipBefore, bot.username, "car");
      const botCarsA = countSpecialTilesFromOwnership(game, ownershipAfter, bot.username, "car");
      const oppCarsB = countSpecialTilesFromOwnership(game, ownershipBefore, opp.username, "car");
      const oppCarsA = countSpecialTilesFromOwnership(game, ownershipAfter, opp.username, "car");

      const botGainsColorMono = botNewMonos.length > 0;
      const botGainsStrongCars = botCarsA >= 3 && botCarsA > botCarsB;

      if (botUtilsB >= 2 && botUtilsA < 2 && !botGainsColorMono && !botGainsStrongCars) {
        continue;
      }
      if (botCarsB >= 3 && botCarsA < botCarsB && !botGainsColorMono) {
        continue;
      }
      if (oppCarsA >= 3 && oppCarsA > oppCarsB && !botGainsColorMono) {
        continue;
      }
      if (oppUtilsB < 2 && oppUtilsA >= 2 && !botGainsColorMono && !botGainsStrongCars) {
        continue;
      }
    }

    // MEDIUM & HARD guard: never propose handing opponent a monopoly unless bot gets a comparable/stronger one (cash/sweetener-balanced)
    if (difficulty !== "EASY" && oppNewMonos.length > 0) {
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
      const netCashForBot = receivedMoney - givenMoney;
      const extraToBotVal = trade.received.reduce((s, id) => {
        const t = getTileById(game, id);
        if (!t || (t.type === "property" && t.groupId != null && botNewMonos.includes(t.groupId))) {
          return s;
        }
        return s + (t.price ?? 0);
      }, 0);
      const extraToOppVal = trade.given.reduce((s, id) => {
        const t = getTileById(game, id);
        if (!t || (t.type === "property" && t.groupId != null && oppNewMonos.includes(t.groupId))) {
          return s;
        }
        return s + (t.price ?? 0);
      }, 0);

      const effectiveBotPower =
        botPower + Math.max(0, netCashForBot) * 1.3 + extraToBotVal * 0.95;
      const effectiveOppPower =
        oppPower + Math.max(0, -netCashForBot) * 1.15 + extraToOppVal * 0.9;

      const oppIsRunawayLeader =
        difficulty === "HARD" &&
        oppFullBefore.length >= 1 &&
        isOpponentLeading(game, bot.username, opp.username);
      const requiredRatio = oppIsRunawayLeader
        ? 1.15
        : difficulty === "HARD"
          ? 0.92
          : 0.85;

      if (effectiveBotPower < effectiveOppPower * requiredRatio) {
        continue;
      }

      if (difficulty === "HARD") {
        const cheapestNewSetUpgrade = Math.min(
          ...botNewMonos.map(
            (g) =>
              game.board.groups.find((gr) => gr.groupId === g)?.upgradePrice ??
              100
          )
        );
        const minUpgradeCash = Math.min(
          reserve,
          Math.max(100, cheapestNewSetUpgrade)
        );
        if (postBotBalance < minUpgradeCash) {
          continue;
        }
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
    const isMutualSwap = botNewMonos.length > 0 && oppNewMonos.length > 0;
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
        (s, id) =>
          s +
          (isMutualSwap
            ? Math.max(
                getTileById(game, id)?.price ?? 0,
                evaluateTileStrategicValue(
                  game,
                  getTileById(game, id)!,
                  bot.username
                )
              )
            : getTileById(game, id)?.price ?? 0),
        0
      ) + receivedMoney;

    if (requestedFromOppVal > 0) {
      const ratio = offeredToOppVal / requestedFromOppVal;
      const maxRatio = isMutualSwap ? 2.6 : 2.2;
      if (ratio < 0.72 || ratio > maxRatio) {
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
        offeredToOppVal >= requestedFromOppVal * 0.9 &&
        offeredToOppVal <= requestedFromOppVal * 1.6
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

export interface PreMortgageOfferOptions {
  cooldownByTarget?: Record<string, number>;
  isBankruptcyEmergency?: boolean;
  amountNeeded?: number;
}

/**
 * Evaluates whether there is a "good moment" to offer `tileToMortgage` to an opponent
 * who genuinely needs it for up to 2x face price BEFORE mortgaging it for 0.5x.
 *
 * Strict rule:
 * - Never offers a set-completing tile for cash unless `isBankruptcyEmergency` is true
 *   (bot has zero other assets sufficient to avoid bankruptcy).
 * - Only triggers when an active opponent owns matching group/car/utility tiles AND
 *   has comfortable spare cash to pay 1.4x–2.0x face price.
 */
export function findPreMortgageTradeOffer(
  game: GameState,
  bot: Player,
  tileToMortgage: Tile,
  options: PreMortgageOfferOptions = {}
): Trade | null {
  if (game.status === "ENDED") {
    return null;
  }

  const eliminated = new Set(game.eliminatedPlayers ?? []);
  if (eliminated.has(bot.username)) {
    return null;
  }

  const difficulty: BotDifficulty = bot.botDifficulty ?? "MEDIUM";
  if (difficulty === "EASY") {
    return null;
  }

  const basePrice = tileToMortgage.price ?? 0;
  if (basePrice <= 0 || tileToMortgage.mortgaged) {
    return null;
  }

  const fullSetGroupIds = getFullSetGroupIds(game);
  const botTradable = new Set(
    getPlayerTradableProperties(game.board.tiles, fullSetGroupIds, bot.username)
  );
  if (!botTradable.has(tileToMortgage.id)) {
    return null;
  }

  const botFullSets = new Set(getPlayerFullSetGroupIds(game, bot.username));
  if (!options.isBankruptcyEmergency) {
    if (
      tileToMortgage.type === "property" &&
      tileToMortgage.groupId != null &&
      botFullSets.has(tileToMortgage.groupId)
    ) {
      return null;
    }
    if (tileToMortgage.type === "bonus-property") {
      const botUtils = game.board.tiles.filter(
        (t) => t.type === "bonus-property" && t.owner === bot.username
      ).length;
      if (botUtils >= 2) {
        return null;
      }
    }
    if (tileToMortgage.type === "car") {
      const botCars = game.board.tiles.filter(
        (t) => t.type === "car" && t.owner === bot.username
      ).length;
      if (botCars >= 3) {
        return null;
      }
    }
  }

  const cooldownByTarget = options.cooldownByTarget ?? {};
  const activeOpponents = game.players.filter(
    (p) =>
      p.username !== bot.username &&
      !eliminated.has(p.username) &&
      (cooldownByTarget[p.username] ?? 0) <= 0
  );

  if (!activeOpponents.length) {
    return null;
  }

  const mortgageValue = tileToMortgage.mortgagePrice ?? Math.round(basePrice * 0.5);
  const minAttractiveAsk = Math.max(
    Math.round(basePrice * 1.4),
    Math.round(mortgageValue * 2.4)
  );
  const maxAllowedAsk = Math.round(basePrice * 2.0);

  const candidates: Array<{ trade: Trade; score: number; targetName: string }> = [];

  for (const opp of activeOpponents) {
    const completesOppSet = doesTileCompleteSet(game, tileToMortgage, opp.username);
    if (completesOppSet && !options.isBankruptcyEmergency) {
      continue;
    }

    // Determine whether `opp` genuinely needs this tile and how strong the need is
    let needFactor = 0;

    if (tileToMortgage.type === "property" && tileToMortgage.groupId != null) {
      const group = game.board.groups.find(
        (g) => g.groupId === tileToMortgage.groupId
      );
      if (group) {
        const oppOwnedInGroup = group.properties.filter((pid) => {
          if (pid === tileToMortgage.id) return false;
          const t = getTileById(game, pid);
          return t?.owner === opp.username;
        }).length;

        if (oppOwnedInGroup >= 1) {
          const mult = getGroupStrategicMultiplier(group.groupId);
          if (completesOppSet) {
            needFactor = 2.0; // Bankruptcy survival emergency: ask full 2x max
          } else if (mult >= 1.2) {
            needFactor = 1.85; // Strong color group advancement (1 -> 2 of 3)
          } else {
            needFactor = 1.65; // Standard group advancement
          }
        }
      }
    } else if (tileToMortgage.type === "car") {
      const oppCars = game.board.tiles.filter(
        (t) =>
          t.type === "car" &&
          t.id !== tileToMortgage.id &&
          t.owner === opp.username
      ).length;
      if (oppCars >= 2) {
        // Never gift 3rd or 4th car for cash outside literal bankruptcy emergency
        if (!options.isBankruptcyEmergency) {
          continue;
        }
        needFactor = 2.0;
      } else if (oppCars === 1) {
        needFactor = 1.65;
      }
    } else if (tileToMortgage.type === "bonus-property") {
      const oppUtils = game.board.tiles.filter(
        (t) =>
          t.type === "bonus-property" &&
          t.id !== tileToMortgage.id &&
          t.owner === opp.username
      ).length;
      if (oppUtils >= 1) {
        // Never gift 2nd Energy Utility (10x) for cash outside literal bankruptcy emergency
        if (!options.isBankruptcyEmergency) {
          continue;
        }
        needFactor = 2.0;
      }
    }

    if (needFactor <= 0) {
      continue;
    }

    // Buyer must have comfortable cash above the ask so the offer is realistic
    const oppCashBuffer = Math.max(100, Math.round(basePrice * 0.4));
    const maxAffordableByOpp = opp.balance - oppCashBuffer;
    if (maxAffordableByOpp < minAttractiveAsk) {
      continue;
    }

    // Scale ask price cleanly between 1.4x and 2.0x max
    const desiredAsk = Math.min(maxAllowedAsk, Math.round(basePrice * needFactor));
    const askCash = Math.min(
      maxAllowedAsk,
      roundToTen(Math.min(maxAffordableByOpp, desiredAsk))
    );

    if (askCash < minAttractiveAsk || askCash > maxAffordableByOpp) {
      continue;
    }

    let chosenCandidate: Trade | null = null;
    const initialCandidate: Trade = {
      from: bot.username,
      to: opp.username,
      given: [tileToMortgage.id],
      received: [],
      givenMoney: 0,
      receivedMoney: askCash,
    };

    if (!isTradePreviouslyDeclined(game, initialCandidate)) {
      if (!opp.isBot || evaluateIncomingTrade(game, opp, initialCandidate).accept) {
        chosenCandidate = initialCandidate;
      } else {
        // If a bot opponent declines the top 1.65x–2.0x ask, try the 1.4x floor
        // (still ~2.8x mortgage value) before giving up and mortgaging for 0.5x.
        const floorAsk = Math.min(maxAffordableByOpp, roundToTen(minAttractiveAsk));
        if (floorAsk >= minAttractiveAsk && floorAsk < askCash) {
          const floorCandidate: Trade = {
            ...initialCandidate,
            receivedMoney: floorAsk,
          };
          if (
            !isTradePreviouslyDeclined(game, floorCandidate) &&
            evaluateIncomingTrade(game, opp, floorCandidate).accept
          ) {
            chosenCandidate = floorCandidate;
          }
        }
      }
    }

    if (!chosenCandidate) {
      continue;
    }

    const finalAsk = chosenCandidate.receivedMoney ?? 0;
    const coversNeedBonus =
      typeof options.amountNeeded === "number" && finalAsk >= options.amountNeeded
        ? 100
        : 0;

    candidates.push({
      trade: chosenCandidate,
      score: finalAsk + coversNeedBonus,
      targetName: opp.username,
    });
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.targetName.localeCompare(b.targetName);
  });

  return candidates[0].trade;
}

/**
 * Scans all eligible mortgageable `candidateTiles` to find the highest-value
 * pre-mortgage offer (1.4x–2.0x) to an opponent who genuinely needs one of them.
 */
export function findBestPreMortgageTradeOffer(
  game: GameState,
  bot: Player,
  candidateTiles: Tile[],
  options: PreMortgageOfferOptions = {}
): Trade | null {
  let best: { trade: Trade; score: number; sig: string } | null = null;

  for (const tile of candidateTiles) {
    const offer = findPreMortgageTradeOffer(game, bot, tile, options);
    if (!offer) {
      continue;
    }
    const ask = offer.receivedMoney ?? 0;
    const coversBonus =
      typeof options.amountNeeded === "number" && ask >= options.amountNeeded
        ? 150
        : 0;
    const score = ask + coversBonus;
    const sig = buildTradeSignature(offer);

    if (
      !best ||
      score > best.score ||
      (score === best.score && sig.localeCompare(best.sig) < 0)
    ) {
      best = { trade: offer, score, sig };
    }
  }

  return best?.trade ?? null;
}

