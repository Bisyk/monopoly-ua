import { games } from "../routes/gamesList";

const rooms = "Rooms";
const peers = [];

export default defineWebSocketHandler({
  open(peer) {
    peer.subscribe(rooms);
    console.log(`Opened WS `);
    peer.send(JSON.stringify(games.value));
    peers.push(peer);
  },
  close(peer) {
    console.log(`Closed WS `);
  },
  error(peer, error) {
    console.log("error on ws", peer, error);
  },
  message(peer, message) {
    peer.send(JSON.stringify(games.value));
  },
});
