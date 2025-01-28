// import { games } from "./gamesList";

import prisma from "~/lib/prisma";

export default defineEventHandler(async event => {
  console.log("lol");
  const body: CreatedGame = await readBody(event);

  const room = await prisma.room.create({
    data: {
      players: body.players,
      createdBy: body.createdBy,
      maxPlayers: body.maxPlayers,
      status: "PENDING",
    },
  });
  console.log(room);
  return { body: JSON.stringify({ room: room }) };
});
