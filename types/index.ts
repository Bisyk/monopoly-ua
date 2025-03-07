// export { Tile, Player };

export interface Tile {
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

export interface Player {
  username: string;
  color: string;
  position: number;
  balance: number;
  properties: number[];
  ownedPropertiesGroup: number[];
  jailed: boolean;
  turnsInJail: number;
  doublesInRow: number;
  bonusRoll: boolean;
}

export interface Group {
  groupId: number;
  color: string;
  properties: number[];
  upgradePrice: number;
  isFullSet: boolean;
  isUpgradeAvailable: boolean;
}
