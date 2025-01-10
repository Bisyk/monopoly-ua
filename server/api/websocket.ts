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
    const roomId = getRoomIdFromPeer(peer)
    peer.subscribe(roomId)
    console.log(`Opened WS for room: ${roomId}`)
    peer.publish(roomId, 'Another user joined the room')
  },
  close(peer) {
    const roomId = getRoomIdFromPeer(peer)
    console.log(`Closed WS for room: ${roomId}`)
  },
  error(peer, error) {
    console.log('error on ws', peer, error)
  },
  message(peer, message) {
    const roomId = getRoomIdFromPeer(peer)
    console.log(`Message received in room ${roomId}:`, message.text())

    peer.publish(roomId, message.text())
  }
})

function getRoomIdFromPeer(peer: { request: { url: string } }): string {
  const url = peer.request.url

  const queryParams = parse(url, true).query

  return queryParams!.roomId![0]
}
