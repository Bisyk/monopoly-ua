import prisma from "~/lib/prisma";

export default defineEventHandler(async event => {
  const body: CreatedGame = await readBody(event);

  const room = await prisma.room.create({
    data: {
      players: body.players,
      createdBy: body.createdBy,
      maxPlayers: body.maxPlayers,
      status: "PENDING",
    },
  });
  return { body: JSON.stringify({ room: room }) };
});
