import type { BotDifficulty } from "~/types";

export const BOT_DIFFICULTIES: BotDifficulty[] = ["EASY", "MEDIUM", "HARD"];

export const BOT_DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  EASY: "EASY",
  MEDIUM: "MED",
  HARD: "HARD",
};

export interface BotPersona {
  id: string;
  username: string;
  title: string;
  avatarUrl: string;
  bgColor: string;
}

export const BOT_PERSONAS: BotPersona[] = [
  {
    id: "kolo-bucks",
    username: "Ihor Kolo-Bucks",
    title: "Banking Baron",
    avatarUrl: "/assets/avatars/kolo-bucks.jpg",
    bgColor: "#2667E8",
  },
  {
    id: "rinat-shakhtyar",
    username: "Rinat Shakhtyar",
    title: "Steel & Club Mogul",
    avatarUrl: "/assets/avatars/rinat-shakhtyar.jpg",
    bgColor: "#E63956",
  },
  {
    id: "petro-chocobaron",
    username: "Petro Choco-Baron",
    title: "Sweet Factory King",
    avatarUrl: "/assets/avatars/petro-chocobaron.jpg",
    bgColor: "#1EB554",
  },
  {
    id: "yulia-kosaprime",
    username: "Yulia Kosa-Prime",
    title: "Coalition Strategist",
    avatarUrl: "/assets/avatars/yulia-kosaprime.jpg",
    bgColor: "#D99100",
  },
  {
    id: "vitali-klitchko",
    username: "Vitali Klitch-KO",
    title: "Kyiv Mayor & Champ",
    avatarUrl: "/assets/avatars/vitali-klitchko.jpg",
    bgColor: "#7B4CE2",
  },
  {
    id: "viktor-yanukgold",
    username: "Viktor Yanuk-Gold",
    title: "Golden Loaf Tycoon",
    avatarUrl: "/assets/avatars/viktor-yanukgold.jpg",
    bgColor: "#F26B21",
  },
];

const BOT_PERSONA_BY_NAME = new Map<string, BotPersona>(
  BOT_PERSONAS.map((persona) => [persona.username.toLowerCase(), persona])
);

export function getBotPersonaByUsername(
  username?: string | null
): BotPersona | null {
  if (!username) {
    return null;
  }
  return BOT_PERSONA_BY_NAME.get(username.trim().toLowerCase()) ?? null;
}

export function getBotAvatarUrl(username?: string | null): string | null {
  return getBotPersonaByUsername(username)?.avatarUrl ?? null;
}

export function isValidBotDifficulty(value: unknown): value is BotDifficulty {
  return value === "EASY" || value === "MEDIUM" || value === "HARD";
}

export function normalizeBotDifficulty(value: unknown): BotDifficulty {
  if (typeof value === "string") {
    const upper = value.toUpperCase();
    if (isValidBotDifficulty(upper)) {
      return upper;
    }
  }
  return "MEDIUM";
}

export function generateBotUsername(existingUsernames: string[]): string {
  const existing = new Set(existingUsernames.map((n) => n.toLowerCase()));
  for (const persona of BOT_PERSONAS) {
    if (!existing.has(persona.username.toLowerCase())) {
      return persona.username;
    }
  }
  let idx = 1;
  while (existing.has(`tycoon-bot-${idx}`)) {
    idx += 1;
  }
  return `Tycoon-Bot-${idx}`;
}
