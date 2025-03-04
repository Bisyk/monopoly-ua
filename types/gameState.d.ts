declare interface gameLogEntry {
  username: string;
  msg: string;
}

declare interface GameState {
  roomId: number | null;
  players: Array<string>;
  currentTurn: string | null;
  currentAction: string | null;
  auctionParticipants: string[] | null;
  currentAuctionParticipant: string | null;
  currentAuctionBid: number | null;
  tileOnAuction: Tile | null;
  boardState: Object;
  gameLog: Array<gameLogEntry>;
}

declare interface Tile {
  id: number;
  groupId: number;
  spriteName: string;
  name: string;
  price: number;
  type: string;
  owner: string;
  houses: number;
  mortgaged: boolean;
  position: number;
  rentLevel: number;
  rentLevels: number[];
  mortgagePrice: number;
  buybackPrice: number;
}
