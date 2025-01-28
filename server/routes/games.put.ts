import prisma from "~/lib/prisma";

export default defineEventHandler(async event => {
  console.log("PUT /games");

  const { action, payload } = await readBody(event);

  console.log(action, payload);

  if (action.type === "JOIN_ROOM") {
    console.log("PUT /games JOIN_ROOM");
    const game = await prisma.room.findUnique({
      where: {
        id: payload.roomId,
      },
    });

    if (!game) {
      return { status: 404 };
    }

    if (game.players.includes(payload.username)) {
      return { msg: "User already in room" };
    }

    const updatedGame = await prisma.room.update({
      where: {
        id: payload.roomId,
      },
      data: {
        players: [...game.players, payload.username],
      },
    });

    return {
      body: JSON.stringify({
        game: updatedGame,
      }),
    };
  }
});
