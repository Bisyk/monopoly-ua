import { games } from "./gamesList";

export default defineEventHandler(async event => {
  console.log("PUT /games");

  const { action, payload } = await readBody(event);

  if (action.type === "JOIN_ROOM") {
    console.log("PUT /games JOIN_ROOM");
    const game = games.value.find(game => game.id === payload.roomId);

    if (!game) {
      return { status: 404 };
    }

    if (game.players.includes(payload.username)) {
      return { msg: "User already in room" };
    }

    game.players.push(payload.username);

    if (game.players.length === game.maxPlayers) {
      game.status = "ACTIVE";
    }

    return {
      body: JSON.stringify({
        username: payload.username,
        roomId: payload.roomId,
      }),
    };
  }
});
