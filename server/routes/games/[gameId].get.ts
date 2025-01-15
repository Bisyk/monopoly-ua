import { games } from "../gamesList";

export default defineEventHandler(async event => {
  console.log(`GET /games/${event!.context!.params!.gameId}`);

  const gameId = event!.context!.params!.gameId;

  const game = games.value.find(game => game.id === Number(gameId));

  if (!game) {
    return { status: 404 };
  }

  return { body: JSON.stringify({ game }) };
});
