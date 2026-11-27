const roomPeersMap = new Map<string, Set<any>>();

export function addRoomPeer(roomId: string, peer: any): void {
  let peers = roomPeersMap.get(roomId);
  if (!peers) {
    peers = new Set();
    roomPeersMap.set(roomId, peers);
  }
  peers.add(peer);
}

export function removeRoomPeer(roomId: string, peer: any): void {
  const peers = roomPeersMap.get(roomId);
  if (!peers) {
    return;
  }
  peers.delete(peer);
  if (peers.size === 0) {
    roomPeersMap.delete(roomId);
  }
}

export function getRoomPeerCount(roomId: string): number {
  return roomPeersMap.get(roomId)?.size ?? 0;
}

export function broadcastToRoom(
  roomId: string,
  serialized: string,
  fallbackPeer?: any
): void {
  const peers = roomPeersMap.get(roomId);
  if (peers && peers.size > 0) {
    for (const peer of peers) {
      try {
        peer.send(serialized);
      } catch (err) {
        console.error(`Failed to send WS message to peer in room ${roomId}:`, err);
      }
    }
    return;
  }

  if (fallbackPeer) {
    try {
      fallbackPeer.send(serialized);
      fallbackPeer.publish(roomId, serialized);
    } catch (err) {
      console.error(`Failed to broadcast via fallback peer in room ${roomId}:`, err);
    }
  }
}
