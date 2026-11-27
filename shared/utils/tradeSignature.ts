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
    .map(
      (tile) =>
        `${tile.id}:${tile.owner || "_"}:${tile.mortgaged ? 1 : 0}:${
          tile.rentLevel ?? 0
        }`
    )
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

  return declined.some(
    (entry) =>
      entry.from === (trade.from || "") &&
      entry.to === (trade.to || "") &&
      entry.signature === signature &&
      entry.boardHash === boardHash
  );
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
