import { games } from "../gamesList";

export default defineEventHandler(async event => {
  console.log("lol");

  const gameId = event!.context!.params!.gameId;

  console.log(gameId);

  const game = games.value.find(game => game.id === Number(gameId));

  if (!game) {
    return { status: 404 };
  }

  return { body: JSON.stringify({ game }) };
});
