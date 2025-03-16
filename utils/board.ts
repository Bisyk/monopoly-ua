export const getTilePosition = (tileId: number) => {
  if (tileId >= 1 && tileId <= 10) {
    return "top";
  }
  if (tileId >= 11 && tileId <= 20) {
    return "right";
  }
  if (tileId >= 21 && tileId <= 30) {
    return "bottom";
  }
  if (tileId >= 31 && tileId <= 40) {
    return "left";
  }
};
