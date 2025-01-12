import { parse } from 'url'

const gameState = {
  rooms: {
    roomId1: {
      players: [
        { username: 'Player1', position: 0, balance: 15000, isTurn: true },
        { username: 'Player2', position: 0, balance: 15000, isTurn: false }
      ],
      currentTurn: 'Player1',
      boardState: []
    }
  }
}

export default defineWebSocketHandler({
  open(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!)
    peer.subscribe(roomId)
    console.log(`Opened WS for room: ${roomId}`)
    peer.publish(roomId, 'Another user joined the room')
  },
  close(peer) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!)
    console.log(`Closed WS for room: ${roomId}`)
  },
  error(peer, error) {
    console.log('error on ws', peer, error)
  },
  message(peer, message) {
    const roomId = getRoomIdFromPeer(peer!.request!.url!)
    console.log(`Message received in room ${roomId}:`, message.text())

    peer.publish(roomId, message.text())
  }
})

function getRoomIdFromPeer(url: string): string {
  const queryParams = parse(url, true).query

  return queryParams!.roomId!.toString()
}
