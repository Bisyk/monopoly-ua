import { games } from "../routes/gamesList";

const rooms = "Rooms";
const peers = [];

export default defineWebSocketHandler({
  open(peer) {
    peer.subscribe(rooms);
    console.log(`Opened WS `);
    peers.push(peer);
  },
  close(peer) {
    console.log(`Closed WS `);
  },
  error(peer, error) {
    console.log("error on ws", peer, error);
  },
  message(peer, message) {
    peers.forEach(p => {
      peer.publish(rooms, JSON.stringify(games.value));
    });
  },
});
