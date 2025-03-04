import { games } from "../gamesList";
import prisma from "~/lib/prisma";

export default defineEventHandler(async event => {
  console.log(`GET /game/${event!.context!.params!.gameId}`);

  const roomId = event!.context!.params!.gameId;

  const game = await prisma.game.findUnique({
    where: {
      associatedRoomId: roomId,
    },
  });

  if (!game) {
    console.log("game not found");
    return { status: 404 };
  }

  console.log("game found");

  return { body: JSON.stringify({ game }) };
});
