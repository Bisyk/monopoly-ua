import prisma from "~/lib/prisma";

const rooms = "Rooms";
const peers = [];

export default defineWebSocketHandler({
  async open(peer) {
    peer.subscribe(rooms);
    console.log(`Opened WS `);
    const availableRooms = await prisma.room.findMany();
    peer.send(JSON.stringify(availableRooms));
    peers.push(peer);
  },
  close(peer) {
    console.log(`Closed WS `);
  },
  error(peer, error) {
    console.log("error on ws", peer, error);
  },
  async message(peer, message) {
    const availableRooms = await prisma.room.findMany();
    peer.send(JSON.stringify(availableRooms));
  },
});
