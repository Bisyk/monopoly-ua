import prisma from "~/lib/prisma";
import {
  generateBotUsername,
  normalizeBotDifficulty,
} from "~/shared/constants/botNames";
import { broadcastRoomsUpdate } from "../api/rooms";
import { startGameForRoom } from "../utils/startGameForRoom";

export default defineEventHandler(async (event) => {
  console.log("PUT /games");

  const rawBody = await readBody(event);
  const body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;

  const { action, payload } = body ?? {};
  const actionType = action?.type;

  if (actionType === "JOIN_ROOM") {
    console.log("PUT /games JOIN_ROOM");
    const room = await prisma.room.findUnique({
      where: {
        id: payload.roomId,
      },
    });

    if (!room) {
      console.log("room to join not found");
      return { status: 404 };
    }

    if (room.status !== "PENDING") {
      return { status: 400, msg: "Room has already started" };
    }

    if (room.players.includes(payload.username)) {
      return { msg: "User already in room" };
    }

    if (room.players.length >= room.maxPlayers) {
      return { status: 400, msg: "Room is full" };
    }

    const updatedRoom = await prisma.room.update({
      where: {
        id: payload.roomId,
      },
      data: {
        players: [...room.players, payload.username],
      },
    });

    console.log("room joined", updatedRoom);

    let finalRoom = updatedRoom;
    let gameStarted = false;

    if (updatedRoom.players.length === updatedRoom.maxPlayers) {
      console.log("starting game for full room", updatedRoom.id);
      await startGameForRoom(updatedRoom);
      finalRoom = { ...updatedRoom, status: "STARTED" };
      gameStarted = true;
    }

    await broadcastRoomsUpdate();

    return {
      body: JSON.stringify({
        game: finalRoom,
        gameStarted,
      }),
    };
  }

  if (actionType === "ADD_BOT") {
    console.log("PUT /games ADD_BOT");
    const room = await prisma.room.findUnique({
      where: {
        id: payload.roomId,
      },
    });

    if (!room) {
      return { status: 404 };
    }

    if (room.status !== "PENDING") {
      return { status: 400, msg: "Cannot add bot to a started room" };
    }

    if (room.createdBy !== payload.username) {
      return { status: 403, msg: "Only the room creator can add bots" };
    }

    if (room.players.length >= room.maxPlayers) {
      return { status: 400, msg: "Room is full" };
    }

    const botUsername = generateBotUsername(room.players);
    const difficulty = normalizeBotDifficulty(payload.difficulty);

    const updatedRoom = await prisma.room.update({
      where: {
        id: payload.roomId,
      },
      data: {
        players: [...room.players, botUsername],
        bots: [...(room.bots ?? []), { username: botUsername, difficulty }],
      },
    });

    let finalRoom = updatedRoom;
    let gameStarted = false;

    if (updatedRoom.players.length === updatedRoom.maxPlayers) {
      console.log("starting game for full room after ADD_BOT", updatedRoom.id);
      await startGameForRoom(updatedRoom);
      finalRoom = { ...updatedRoom, status: "STARTED" };
      gameStarted = true;
    }

    await broadcastRoomsUpdate();

    return {
      body: JSON.stringify({
        game: finalRoom,
        gameStarted,
      }),
    };
  }

  if (actionType === "REMOVE_BOT") {
    console.log("PUT /games REMOVE_BOT");
    const room = await prisma.room.findUnique({
      where: {
        id: payload.roomId,
      },
    });

    if (!room) {
      return { status: 404 };
    }

    if (room.status !== "PENDING") {
      return { status: 400, msg: "Cannot remove bot from a started room" };
    }

    if (room.createdBy !== payload.username) {
      return { status: 403, msg: "Only the room creator can remove bots" };
    }

    const botUsername = payload.botUsername;
    const existingBots = room.bots ?? [];
    if (
      !existingBots.some(
        (b: { username: string; difficulty: string }) =>
          b.username === botUsername
      )
    ) {
      return { status: 404, msg: "Bot not found in room" };
    }

    const updatedRoom = await prisma.room.update({
      where: {
        id: payload.roomId,
      },
      data: {
        players: room.players.filter((p: string) => p !== botUsername),
        bots: existingBots.filter(
          (b: { username: string; difficulty: string }) =>
            b.username !== botUsername
        ),
      },
    });

    await broadcastRoomsUpdate();

    return {
      body: JSON.stringify({
        game: updatedRoom,
        gameStarted: false,
      }),
    };
  }

  return { status: 400, msg: "Unsupported action" };
});
