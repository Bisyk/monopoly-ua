import type { Tile } from "~/types";
import { GAME_RULES } from "~/shared/constants/gameRules";

/**
 * Strict Hasbro rule: receiving a mortgaged property in a trade incurs an immediate
 * 10% mortgage transfer fee (rounded up to whole dollars) paid to the bank.
 */
export function getTileMortgageTransferFee(tile: Tile | undefined): number {
  if (!tile || !tile.mortgaged) {
    return 0;
  }
  const mortgageValue = tile.mortgagePrice ?? Math.floor((tile.price ?? 0) / 2);
  if (mortgageValue <= 0) {
    return 0;
  }
  return Math.ceil(mortgageValue * GAME_RULES.MORTGAGE_TRANSFER_FEE_RATE);
}

export function computeMortgageTransferFee(
  tiles: Tile[],
  tileIds: number[]
): number {
  return tileIds.reduce((sum, id) => {
    const tile = tiles.find((t) => t.id === id);
    return sum + getTileMortgageTransferFee(tile);
  }, 0);
}

/**
 * Returns a tile's trade parity value for the 50%–200% rule:
 * - Unmortgaged tile: full face price
 * - Mortgaged tile: face price minus mortgage value (50% unencumbered equity)
 */
export function getTileTradeParityValue(tile: Tile | undefined): number {
  if (!tile || !tile.price) {
    return 0;
  }
  if (!tile.mortgaged) {
    return tile.price;
  }
  const mortgageValue = tile.mortgagePrice ?? Math.floor(tile.price / 2);
  return Math.max(0, tile.price - mortgageValue);
}
