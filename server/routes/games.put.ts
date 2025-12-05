import prisma from "~/lib/prisma";
import {
  colors,
  defaultPropertyGroups,
  defaultPlayerTemplate,
  defaultTiles,
} from "../constants";

export default defineEventHandler(async event => {
  console.log("PUT /games");

  const data: string = await readBody(event);
  const body = JSON.parse(data);

  const { action, payload } = body;

  if (action.type === "JOIN_ROOM") {
    console.log("PUT /games JOIN_ROOM");
    const game = await prisma.room.findUnique({
      where: {
        id: payload.roomId,
      },
    });

    if (!game) {
      console.log("room to join not found");
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

    console.log("room joined", updatedGame);

    if (updatedGame.players.length === updatedGame.maxPlayers) {
      console.log("create game");
      const room = updatedGame;
      const roomId = updatedGame.id;

      const game = await prisma.game.create({
        data: {
          associatedRoomId: roomId,
          players: room!.players.map((player, idx) => ({
            username: player,
            color: colors[idx],
            ...defaultPlayerTemplate,
          })),
          currentTurn: room!.players[0],
          currentAction: "roll",
          auctionParticipants: [],
          activeAuctionBidder: "",
          auctionBidAmount: 0,
          auctionedTileId: null,
          activeChance: {
            type: "",
          },
          activeTrade: {
            from: "",
            to: "",
            given: [],
            received: [],
            givenMoney: 0,
            receivedMoney: 0,
          },
          board: {
            tiles: defaultTiles,
            groups: defaultPropertyGroups,
          },
          gameLog: [],
        },
      });

      console.log("game created", game);
    }

    return {
      body: JSON.stringify({
        game: updatedGame,
      }),
    };
  }
});
