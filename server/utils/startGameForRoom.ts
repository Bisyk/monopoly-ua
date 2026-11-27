import prisma from "~/lib/prisma";
import {
  getBotPersonaByUsername,
  normalizeBotDifficulty,
} from "~/shared/constants/botNames";
import type { BotDifficulty, BotSlot } from "~/types";
import { getCartridgePlayerColor } from "~/utils/cartridgeTheme";
import {
  colors,
  defaultPlayerTemplate,
  defaultPropertyGroups,
  defaultTiles,
} from "../constants";

export interface StartGameRoomInput {
  id: string;
  players: string[];
  bots?: Array<BotSlot | { username: string; difficulty: string }>;
  maxPlayers: number;
}

export async function startGameForRoom(room: StartGameRoomInput) {
  const existingGame = await prisma.game.findUnique({
    where: {
      associatedRoomId: room.id,
    },
  });

  if (existingGame) {
    await prisma.room
      .update({
        where: { id: room.id },
        data: { status: "STARTED" },
      })
      .catch(() => {});
    return existingGame;
  }

  const botDifficultyByUsername = new Map<string, BotDifficulty>();
  for (const botSlot of room.bots ?? []) {
    botDifficultyByUsername.set(
      botSlot.username,
      normalizeBotDifficulty(botSlot.difficulty)
    );
  }

  const usedHexColors = new Set<string>();
  for (const username of room.players) {
    if (botDifficultyByUsername.has(username)) {
      const persona = getBotPersonaByUsername(username);
      if (persona) {
        usedHexColors.add(persona.bgColor.toUpperCase());
      }
    }
  }

  let humanColorIdx = 0;
  const pickHumanColor = () => {
    for (let attempt = 0; attempt < colors.length; attempt++) {
      const candidate = colors[(humanColorIdx + attempt) % colors.length];
      const resolved = getCartridgePlayerColor(candidate).toUpperCase();
      if (!usedHexColors.has(resolved)) {
        usedHexColors.add(resolved);
        humanColorIdx = (humanColorIdx + attempt + 1) % colors.length;
        return candidate;
      }
    }
    const fallback = colors[humanColorIdx % colors.length];
    humanColorIdx += 1;
    return fallback;
  };

  const players = room.players.map((username) => {
    const botDifficulty = botDifficultyByUsername.get(username);
    const isBot = botDifficulty !== undefined;
    const persona = isBot ? getBotPersonaByUsername(username) : null;

    return {
      ...defaultPlayerTemplate,
      properties: [],
      ownedPropertyGroupIds: [],
      username,
      color: persona ? persona.bgColor : pickHumanColor(),
      isBot,
      botDifficulty: isBot ? botDifficulty : null,
    };
  });

  let createdGame;
  try {
    createdGame = await prisma.game.create({
      data: {
        associatedRoomId: room.id,
        status: "STARTED",
        winnerUsername: null,
        eliminatedPlayers: [],
        players,
        currentTurn: room.players[0],
        currentAction: "roll",
        auctionParticipants: [],
        activeAuctionBidder: "",
        auctionBidAmount: 0,
        auctionedTileId: null,
        activeChance: {
          type: "",
        },
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
        board: {
          tiles: defaultTiles,
          groups: defaultPropertyGroups,
        },
        gameLog: [],
      },
    });
  } catch (err) {
    // Handle concurrent creation race idempotently
    const racedGame = await prisma.game.findUnique({
      where: { associatedRoomId: room.id },
    });
    if (racedGame) {
      await prisma.room
        .update({
          where: { id: room.id },
          data: { status: "STARTED" },
        })
        .catch(() => {});
      return racedGame;
    }
    throw err;
  }

  await prisma.room.update({
    where: {
      id: room.id,
    },
    data: {
      status: "STARTED",
    },
  });

  return createdGame;
}
