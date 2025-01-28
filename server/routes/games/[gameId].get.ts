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

  console.log("finded game", game);

  if (!game) {
    return { status: 404 };
  }

  return { body: JSON.stringify({ game }) };
});
