import { games } from "./gamesList";

export default defineEventHandler(async event => {
  console.log("PUT /games");

  const { username, roomId } = await readBody(event);

  const game = games.value.find(game => game.id === roomId);

  if (!game) {
    return { status: 404 };
  }

  game.players.push(username);

  return { body: JSON.stringify({ username, roomId }) };
});
