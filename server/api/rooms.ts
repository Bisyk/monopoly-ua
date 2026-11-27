import prisma from "~/lib/prisma";

const ROOMS_CHANNEL = "Rooms";
const lobbyPeers = new Set<any>();

async function fetchRooms() {
  return prisma.room.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function broadcastRoomsUpdate(): Promise<void> {
  if (lobbyPeers.size === 0) {
    return;
  }

  const availableRooms = await fetchRooms();
  const serialized = JSON.stringify(availableRooms);

  for (const peer of lobbyPeers) {
    try {
      peer.send(serialized);
    } catch (err) {
      console.error("Failed to broadcast rooms update to lobby peer:", err);
      lobbyPeers.delete(peer);
    }
  }
}

export default defineWebSocketHandler({
  async open(peer) {
    peer.subscribe(ROOMS_CHANNEL);
    lobbyPeers.add(peer);
    console.log("Opened lobby WS");
    const availableRooms = await fetchRooms();
    peer.send(JSON.stringify(availableRooms));
  },
  close(peer) {
    lobbyPeers.delete(peer);
    console.log("Closed lobby WS");
  },
  error(peer, error) {
    lobbyPeers.delete(peer);
    console.log("error on lobby ws", peer, error);
  },
  async message(peer, _message) {
    const availableRooms = await fetchRooms();
    peer.send(JSON.stringify(availableRooms));
  },
});
