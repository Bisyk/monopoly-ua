class PropertyTile {
  public id: number;
  public groupId: number;
  public spriteName: string;
  public name: string;
  public price: number;
  public type: string;
  public owner: string;
  public houses: number;
  public mortgaged: boolean;
  public position: number;
  public rentLevel: number;
  public rentLevels: number;
  public mortgagePrice: number;
  public buybackPrice: number;

  public constructor(
    id: number,
    groupId: number,
    spriteName: string,
    name: string,
    price: number,
    rentLevels: number[]
  ) {
    this.id = id;
    this.groupId = groupId;
    this.spriteName = spriteName;
    this.name = name;
    this.price = price;
    this.rentLevel = 0;
    this.rentLevels = rentLevels;
    this.type = "property";
    this.owner = "";
    this.houses = 0;
    this.mortgaged = false;
    this.position = id;
    this.mortgagePrice = price / 2;
    this.buybackPrice = this.mortgagePrice + this.mortgagePrice / 5;
  }
}

export const initialGroupsState = [
  {
    groupId: 1,
    color: "#FFC0CB", // light pink
    properties: [2, 4],
    upgradePrice: 50,
    isFullSet: false,
  },
  {
    groupId: 2,
    color: "#FFFFE0", // light yellow
    properties: [7, 9, 10],
    upgradePrice: 50,
    isFullSet: false,
  },
  {
    groupId: 3,
    color: "#E0FFFF", // light cyan
    properties: [12, 14, 15],
    upgradePrice: 100,
    isFullSet: false,
  },
  {
    groupId: 4,
    color: "#ADD8E6", // light blue
    properties: [17, 19, 20],
    upgradePrice: 100,
    isFullSet: false,
  },
  {
    groupId: 5,
    color: "#FFDAB9", // light peach
    properties: [22, 24, 25],
    upgradePrice: 150,
    isFullSet: false,
  },
  {
    groupId: 6,
    color: "#FFB6C1", // light coral
    properties: [27, 28, 30],
    upgradePrice: 150,
    isFullSet: false,
  },
  {
    groupId: 7,
    color: "#DDA0DD", // plum
    properties: [32, 33, 35],
    upgradePrice: 200,
    isFullSet: false,
  },
  {
    groupId: 8,
    color: "#F5DEB3", // wheat
    properties: [38, 40],
    upgradePrice: 200,
    isFullSet: false,
  },
];

export const initialPlayersState = {
  position: 1,
  balance: 1500,
  properties: [],
  ownedPropertiesGroup: [],
  jailed: false,
  turnsInJail: 0,
  isUpgradeAvailable: true,
};

export const initialTilesState = [
  {
    id: 1,
    type: "go",
    spriteName: "go",
    position: 1,
    name: "Go",
  },
  new PropertyTile(2, 1, "atb", "ATB", 60, [2, 10, 30, 90, 160, 250]),
  {
    id: 3,
    type: "chance",
    spriteName: "chance",
    position: 3,
    name: "Chance",
  },
  new PropertyTile(4, 1, "silpo", "Silpo", 60, [4, 20, 60, 180, 320, 450]),
  {
    id: 5,
    type: "tax",
    spriteName: "tax",
    position: 5,
    name: "Tax",
  },
  {
    id: 6,
    type: "car",
    spriteName: "mercedes-benz",
    position: 6,
    price: 200,
    owner: "",
    mortgaged: false,
    name: "Mercedes-Benz",
  },
  new PropertyTile(7, 2, "staff", "Staff", 100, [6, 30, 90, 270, 400, 550]),
  {
    id: 8,
    type: "chance",
    spriteName: "chance",
    position: 8,
    name: "Chance",
  },
  new PropertyTile(9, 2, "urban", "Urban", 100, [6, 30, 90, 270, 400, 550]),
  new PropertyTile(
    10,
    2,
    "riotdivision",
    "Riot Division",
    120,
    [8, 40, 100, 300, 450, 600]
  ),
  {
    id: 11,
    type: "jail",
    spriteName: "JAIL",
    position: 11,
    name: "Jail",
  },
  new PropertyTile(
    12,
    3,
    "depositphotos",
    "Depositphotos",
    140,
    [10, 50, 150, 450, 625, 750]
  ),
  {
    id: 13,
    type: "bonus-property",
    spriteName: "ukrnafta",
    position: 13,
    owner: "",
    houses: 0,
    price: 150,
    mortgaged: false,
    name: "Ukrnafta",
  },
  new PropertyTile(
    14,
    3,
    "gitlab",
    "GitLab",
    140,
    [10, 50, 150, 450, 625, 750]
  ),
  new PropertyTile(
    15,
    3,
    "grammarly",
    "Grammarly",
    160,
    [12, 60, 180, 500, 700, 900]
  ),
  {
    id: 16,
    type: "car",
    spriteName: "porsche",
    position: 16,
    price: 200,
    owner: "",
    mortgaged: false,
    name: "Porsche",
  },
  new PropertyTile(
    17,
    4,
    "globallogic",
    "GlobalLogic",
    180,
    [14, 70, 200, 550, 750, 950]
  ),
  {
    id: 18,
    type: "chance",
    spriteName: "chance",
    position: 18,
    name: "Chance",
  },
  new PropertyTile(
    19,
    4,
    "softserve",
    "SoftServe",
    180,
    [14, 70, 200, 550, 750, 950]
  ),
  new PropertyTile(20, 4, "epam", "EPAM", 200, [16, 80, 220, 600, 800, 1000]),
  {
    id: 21,
    type: "parking",
    spriteName: "parking",
    position: 21,
    name: "Parking",
  },
  new PropertyTile(
    22,
    5,
    "monobank",
    "Monobank",
    220,
    [18, 90, 250, 700, 875, 1050]
  ),
  {
    id: 23,
    type: "chance",
    spriteName: "chance",
    position: 23,
    name: "Chance",
  },
  new PropertyTile(
    24,
    5,
    "oschadbank",
    "Oschadbank",
    220,
    [18, 90, 250, 700, 875, 1050]
  ),
  new PropertyTile(
    25,
    5,
    "privatbank",
    "PrivatBank",
    240,
    [20, 100, 300, 750, 925, 1100]
  ),
  {
    id: 26,
    type: "car",
    spriteName: "bmw",
    position: 26,
    price: 200,
    owner: "",
    mortgaged: false,
    name: "BMW",
  },
  new PropertyTile(27, 6, "okko", "OKKO", 260, [22, 110, 330, 800, 975, 1150]),
  new PropertyTile(28, 6, "wog", "WOG", 260, [22, 110, 330, 800, 975, 1150]),
  {
    id: 29,
    type: "bonus-property",
    spriteName: "naftogaz",
    position: 29,
    owner: "",
    houses: 0,
    price: 150,
    mortgaged: false,
    name: "Naftogaz",
  },
  new PropertyTile(
    30,
    6,
    "socar",
    "SOCAR",
    280,
    [24, 120, 360, 850, 1025, 1200]
  ),
  {
    id: 31,
    type: "goToJail",
    spriteName: "goToJail",
    position: 31,
    name: "Go to Jail",
  },
  new PropertyTile(
    32,
    7,
    "ukrposhta",
    "Ukrposhta",
    300,
    [26, 130, 390, 900, 1100, 1275]
  ),
  new PropertyTile(
    33,
    7,
    "meest",
    "Meest",
    300,
    [26, 130, 390, 900, 1100, 1275]
  ),
  {
    id: 34,
    type: "chance",
    spriteName: "chance",
    position: 34,
    name: "Chance",
  },
  new PropertyTile(
    35,
    7,
    "novaposhta",
    "Nova Poshta",
    320,
    [28, 150, 450, 1000, 1200, 1400]
  ),
  {
    id: 36,
    type: "car",
    spriteName: "toyota",
    position: 36,
    price: 200,
    owner: "",
    mortgaged: false,
    name: "Toyota",
  },
  {
    id: 37,
    type: "luxury-tax",
    spriteName: "luxurytax",
    position: 37,
    name: "Luxury Tax",
  },
  new PropertyTile(
    38,
    8,
    "metinvest",
    "Metinvest",
    350,
    [35, 175, 500, 1100, 1300, 1500]
  ),
  {
    id: 39,
    type: "chance",
    spriteName: "chance",
    position: 39,
    name: "Chance",
  },
  new PropertyTile(
    40,
    8,
    "dtek",
    "DTEK",
    400,
    [50, 200, 600, 1400, 1700, 2000]
  ),
];

export const colors = [
  "#9999FF", // blue
  "#99CC99", // green
  "#FF9999", // red
  "#FFFF99", // yellow
  "#CC99CC", // purple
  "#FFCC99", // orange
  "#CC9980", // brown
  "#FFE6EB", // pink
];
