import prisma from "~/lib/prisma";
import {
  generateBotUsername,
  normalizeBotDifficulty,
} from "~/shared/constants/botNames";
import type { BotDifficulty, BotSlot } from "~/types";
import { broadcastRoomsUpdate } from "../api/rooms";
import { startGameForRoom } from "../utils/startGameForRoom";

interface CreateGameRequestBody {
  players?: string[];
  createdBy: string;
  maxPlayers: number;
  includeCreator?: boolean;
  bots?: Array<{ username?: string; difficulty: BotDifficulty | string }>;
}

export default defineEventHandler(async (event) => {
  console.log("POST /games");
  const rawBody = await readBody(event);
  const body: CreateGameRequestBody =
    typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;

  const rawMaxPlayers = Number(body.maxPlayers);
  const maxPlayers = Number.isFinite(rawMaxPlayers)
    ? Math.max(2, Math.min(6, Math.floor(rawMaxPlayers)))
    : 2;

  const includeCreator = body.includeCreator !== false;
  const createdBy = body.createdBy;
  const players: string[] = [];

  if (includeCreator) {
    if (
      !Array.isArray(body.bots) &&
      Array.isArray(body.players) &&
      body.players.length > 0
    ) {
      for (const player of body.players) {
        if (
          typeof player === "string" &&
          player.trim().length > 0 &&
          !players.includes(player) &&
          players.length < maxPlayers
        ) {
          players.push(player);
        }
      }
    } else if (typeof createdBy === "string" && createdBy.trim().length > 0) {
      players.push(createdBy);
    }
  }

  const botSlots: BotSlot[] = [];
  if (Array.isArray(body.bots)) {
    for (const botRequest of body.bots) {
      if (players.length >= maxPlayers) {
        break;
      }

      const candidateName =
        typeof botRequest?.username === "string"
          ? botRequest.username.trim()
          : "";
      const botUsername =
        candidateName.length > 0 && !players.includes(candidateName)
          ? candidateName
          : generateBotUsername(players);
      const difficulty = normalizeBotDifficulty(botRequest?.difficulty);

      players.push(botUsername);
      botSlots.push({ username: botUsername, difficulty });
    }
  }

  const createdRoom = await prisma.room.create({
    data: {
      players,
      bots: botSlots,
      createdBy,
      maxPlayers,
      status: "PENDING",
    },
  });

  let room = createdRoom;
  let gameStarted = false;

  if (room.players.length === room.maxPlayers) {
    await startGameForRoom(room);
    room = {
      ...room,
      status: "STARTED",
    };
    gameStarted = true;
  }

  await broadcastRoomsUpdate();

  console.log("room created: ", room, { gameStarted });

  return { body: JSON.stringify({ room, gameStarted }) };
});
