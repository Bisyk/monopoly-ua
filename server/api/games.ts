const rooms = 'Rooms'

import { games } from '../routes/gamesList'

export default defineWebSocketHandler({
  open(peer) {
    peer.subscribe(rooms)
    console.log(`Opened WS `)
  },
  close(peer) {
    console.log(`Closed WS `)
  },
  error(peer, error) {
    console.log('error on ws', peer, error)
  },
  message(peer, message) {
    peer.publish(rooms, JSON.stringify(games.value))
  }
})
