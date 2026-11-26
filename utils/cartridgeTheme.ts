export const CARTRIDGE_GROUP_COLORS: Record<number, string> = {
  1: "#E64E8A", // Retail
  2: "#F0AE19", // Streetwear
  3: "#00A3B5", // Tech Products
  4: "#2667E8", // IT Giants
  5: "#F26B21", // Banking
  6: "#E63956", // Fuel
  7: "#7B4CE2", // Logistics
  8: "#2B2852", // Industry
};

export const CARTRIDGE_GROUP_NAMES: Record<number, string> = {
  1: "Retail",
  2: "Streetwear",
  3: "Tech Products",
  4: "IT Giants",
  5: "Banking",
  6: "Fuel",
  7: "Logistics",
  8: "Industry",
};

const PLAYER_COLOR_MAP: Record<string, string> = {
  "#9999FF": "#2667E8", // blue
  "#99CC99": "#1EB554", // green
  "#FF9999": "#E63956", // red
  "#FFFF99": "#D99100", // gold
  "#CC99CC": "#7B4CE2", // purple
  "#FFCC99": "#F26B21", // orange
  "#CC9980": "#9E5A38", // brown
  "#FFE6EB": "#E64E8A", // pink
};

export function getCartridgeGroupColor(
  groupId?: number | null,
  fallback?: string
): string {
  if (groupId && CARTRIDGE_GROUP_COLORS[groupId]) {
    return CARTRIDGE_GROUP_COLORS[groupId];
  }
  return fallback || "#4F5778";
}

export function getCartridgeGroupName(
  groupId?: number | null,
  tileType?: string
): string {
  if (groupId && CARTRIDGE_GROUP_NAMES[groupId]) {
    return CARTRIDGE_GROUP_NAMES[groupId];
  }
  if (tileType === "car") return "Auto Fleet";
  if (tileType === "bonus-property") return "Energy Utility";
  return "Special";
}

export function getCartridgePlayerColor(rawColor?: string | null): string {
  if (!rawColor) return "#2667E8";
  const upper = rawColor.toUpperCase();
  return PLAYER_COLOR_MAP[upper] || rawColor;
}

export function getPlayerInitials(username?: string | null): string {
  if (!username) return "??";
  const cleaned = username.trim().replace(/^User-/i, "");
  const parts = cleaned.split(/[\s_-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return cleaned.slice(0, 2).toUpperCase();
}

export function getTileSpriteUrl(assetId?: string | null): string {
  if (!assetId) return "";
  const normalized = assetId === "JAIL" ? "jail" : assetId;
  return `/assets/sprites/ua/${normalized}.webp`;
}
