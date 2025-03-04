import prisma from "~/lib/prisma";
import {
  colors,
  initialGroupsState,
  initialPlayersState,
  initialTilesState,
} from "../constants";

export default defineEventHandler(async event => {
  console.log("PUT /games");

  const { action, payload } = await readBody(event);

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
            ...initialPlayersState,
          })),
          currentTurn: room!.players[0],
          currentAction: "roll",
          auctionParticipants: [],
          currentAuctionParticipant: "",
          currentAuctionBid: 0,
          tileOnAuction: null,
          activeChance: {
            type: "",
          },
          activeTrade: {
            from: "",
            to: "",
            tilesGiven: [],
            tilesReceived: [],
            moneyGiven: 0,
            moneyReceived: 0,
          },
          boardState: {
            tiles: initialTilesState,
            groups: initialGroupsState,
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
