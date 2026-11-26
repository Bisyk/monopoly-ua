export const checkIsFullPropertySet = (player: any, board: any) => {
  const playerProperties = player.properties;

  for (const group of board.groups) {
    const groupProperties = group.properties;

    if (
      groupProperties.some((p: any) => playerProperties.includes(p)) &&
      group.isFullSet
    ) {
      group.isFullSet = false;

      board.tiles.forEach((t: any) => {
        if (groupProperties.includes(t.id)) {
          t.rentLevels[0] = t.rentLevels[0] / 2;
        }
      });
    }

    if (groupProperties.every((p: any) => playerProperties.includes(p))) {
      group.isFullSet = true;

      board.tiles.forEach((t: any) => {
        if (groupProperties.includes(t.id)) {
          t.rentLevels[0] = t.rentLevels[0] * 2;
        }
      });
    }
  }
};
