import prisma from "~/lib/prisma";
import { CreatedGame } from "~/types";

export default defineEventHandler(async event => {
  console.log(`POST /games`);
  const data: string = await readBody(event);
  const body: CreatedGame = JSON.parse(data);

  const room = await prisma.room.create({
    data: {
      players: body.players,
      createdBy: body.createdBy,
      maxPlayers: body.maxPlayers,
      status: "PENDING",
    },
  });

  console.log("room created: ", room);

  return { body: JSON.stringify({ room: room }) };
});
