import type { GameState, Trade } from "~/types";

export type TradeLike = Pick<
  Trade,
  "from" | "to" | "given" | "received" | "givenMoney" | "receivedMoney"
>;

export function computeBoardOwnershipHash(game: GameState): string {
  const ownableTiles = game.board.tiles
    .filter((tile) =>
      ["property", "car", "bonus-property"].includes(tile.type)
    )
    .sort((a, b) => a.id - b.id);

  return ownableTiles
    .map((tile) => `${tile.id}:${tile.owner || "_"}`)
    .join("|");
}

function extractRelevantOwnershipSlice(
  game: GameState,
  boardHash: string,
  trade: TradeLike
): string {
  const involvedTileIds = new Set<number>([
    ...(trade.given ?? []),
    ...(trade.received ?? []),
  ]);
  const involvedGroupIds = new Set<number>();

  for (const tid of involvedTileIds) {
    const tile = game.board.tiles.find((t) => t.id === tid);
    if (tile?.groupId != null) {
      involvedGroupIds.add(tile.groupId);
    }
  }

  const relevantTileIds = new Set<number>(involvedTileIds);
  for (const tile of game.board.tiles) {
    if (tile.groupId != null && involvedGroupIds.has(tile.groupId)) {
      relevantTileIds.add(tile.id);
    }
  }

  const from = trade.from || "";
  const to = trade.to || "";

  return boardHash
    .split("|")
    .filter((token) => {
      const sep = token.indexOf(":");
      if (sep <= 0) return false;
      const id = Number(token.slice(0, sep));
      const owner = token.slice(sep + 1);
      return (
        relevantTileIds.has(id) ||
        (from.length > 0 && owner === from) ||
        (to.length > 0 && owner === to)
      );
    })
    .join("|");
}

export function buildTradeSignature(trade: TradeLike): string {
  const given = [...(trade.given ?? [])].sort((a, b) => a - b).join(",");
  const received = [...(trade.received ?? [])].sort((a, b) => a - b).join(",");
  const givenMoney = Math.max(0, Math.round(Number(trade.givenMoney ?? 0)));
  const receivedMoney = Math.max(
    0,
    Math.round(Number(trade.receivedMoney ?? 0))
  );

  return [
    trade.from || "",
    trade.to || "",
    `g:[${given}]`,
    `r:[${received}]`,
    `gm:${givenMoney}`,
    `rm:${receivedMoney}`,
  ].join(";");
}

export function isTradePreviouslyDeclined(
  game: GameState,
  trade: TradeLike
): boolean {
  const declined = game.declinedTrades ?? [];
  if (!declined.length) {
    return false;
  }

  const signature = buildTradeSignature(trade);
  const boardHash = computeBoardOwnershipHash(game);
  const currentRelevantSlice = extractRelevantOwnershipSlice(
    game,
    boardHash,
    trade
  );

  return declined.some((entry) => {
    if (
      entry.from !== (trade.from || "") ||
      entry.to !== (trade.to || "") ||
      entry.signature !== signature
    ) {
      return false;
    }

    if (entry.boardHash === boardHash) {
      return true;
    }

    // Ignore unrelated board purchases by third parties: keep trade declined until
    // either party's portfolio or an involved color group changes ownership.
    return (
      extractRelevantOwnershipSlice(game, entry.boardHash, trade) ===
      currentRelevantSlice
    );
  });
}

export function recordDeclinedTrade(game: GameState, trade: TradeLike): void {
  if (!trade.from || !trade.to) {
    return;
  }

  if (!Array.isArray(game.declinedTrades)) {
    game.declinedTrades = [];
  }

  const signature = buildTradeSignature(trade);
  const boardHash = computeBoardOwnershipHash(game);

  const alreadyExists = game.declinedTrades.some(
    (entry) =>
      entry.from === trade.from &&
      entry.to === trade.to &&
      entry.signature === signature &&
      entry.boardHash === boardHash
  );

  if (!alreadyExists) {
    game.declinedTrades.push({
      from: trade.from,
      to: trade.to,
      signature,
      boardHash,
    });
  }
}
