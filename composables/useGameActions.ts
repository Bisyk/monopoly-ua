import { computed, ref, watch } from "vue";
import { type Group, type Player, type Tile } from "~/types";
import { rollDice } from "~/utils/gameFunctions";

export const useGameActions = (send: Function, username: string) => {
  const isSending = ref(false);
  const turnResult = ref({ left: 0, right: 0 });
  const selectedTile = ref<any>(null);
  const tradePlayerUsername = ref("");
  const gameState = ref<any>({} as any);
  const tradeTiles = ref({
    given: new Set(),
    received: new Set(),
    givenMoney: 0,
    receivedMoney: 0,
  });

  watch(gameState, (newState) => {
    if (Object.keys(newState).length > 0) {
      gameState.value = newState;
    }
  });

  const board = computed(() => {
    return gameState.value?.board ?? [];
  });

  const tiles = computed(() => {
    return gameState.value.board?.tiles ?? [];
  });

  const propertyGroups = computed(() => {
    return gameState.value.board?.groups ?? [];
  });

  const player = computed(() => {
    if (!gameState.value.players) return {};
    return gameState.value.players.find((p: Player) => p.username === username);
  });

  const currentTilePlayerOn = computed(() => {
    return (
      tiles.value?.find((t: Tile) => t.id === player.value.position) ?? {}
    );
  });

  const fullSetsGroups = computed(() => {
    return (
      propertyGroups.value
        ?.filter((g: Group) => g.isFullSet)
        .map((g: Group) => g.groupId) ?? []
    );
  });

  const sendAction = (action: string, payload: Record<string, unknown>) => {
    if (gameState.value?.status === "ENDED") {
      isSending.value = false;
      return;
    }

    send(
      JSON.stringify({
        action,
        payload,
      })
    );
  };

  const handleUserTurn = () => {
    isSending.value = true;
    turnResult.value = rollDice();
    sendAction("ROLL_DICE", { username, turnResult: turnResult.value });
  };

  const handleBuyProperty = (propertyId: number) => {
    isSending.value = true;
    sendAction("BUY_PROPERTY", { username, propertyId });
  };

  const handlePassProperty = (propertyId: number) => {
    isSending.value = true;
    sendAction("PASS_PROPERTY", { username, propertyId });
  };

  const handleMortgageProperty = (propertyId: number) => {
    isSending.value = true;
    sendAction("MORTGAGE_PROPERTY", { username, propertyId });
    selectedTile.value = null;
  };

  const handleBuyBackProperty = (propertyId: number) => {
    isSending.value = true;
    sendAction("BUY_BACK_PROPERTY", { username, propertyId });
    selectedTile.value = null;
  };

  const handleUpgradeProperty = (propertyId: number) => {
    isSending.value = true;
    sendAction("UPGRADE_PROPERTY", { username, propertyId });
    selectedTile.value = null;
  };

  const handleSellProperty = (propertyId: number) => {
    isSending.value = true;
    sendAction("SELL_PROPERTY", { username, propertyId });
    selectedTile.value = null;
  };

  const handlePayRent = (propertyId: number) => {
    isSending.value = true;
    if (currentTilePlayerOn.value.type === "bonus-property") {
      sendAction("PAY_RENT", {
        username,
        propertyId,
        turnResult: turnResult.value,
      });
    } else {
      sendAction("PAY_RENT", { username, propertyId });
    }
  };

  const handlePassAuctionProperty = (propertyId: number) => {
    isSending.value = true;
    sendAction("PASS_AUCTION_PROPERTY", { username, propertyId });
  };

  const handleBidAuctionProperty = (propertyId: number) => {
    isSending.value = true;
    sendAction("BID_AUCTION_PROPERTY", { username, propertyId });
  };

  const handleJailPay = () => {
    isSending.value = true;
    sendAction("JAIL_PAY", { username });
  };

  const handlePayChance = () => {
    isSending.value = true;
    sendAction("PAY_CHANCE", {
      username,
      amount: gameState.value.activeChance.amount,
    });
  };

  const handlePayTax = () => {
    isSending.value = true;
    sendAction("PAY_TAX", { username, tax: currentTilePlayerOn.value.taxAmount });
  };

  const handleSendTrade = () => {
    isSending.value = true;
    sendAction("TRADE", {
      username,
      tradePlayerUsername: tradePlayerUsername.value,
      tradeTiles: {
        given: Array.from(tradeTiles.value.given),
        received: Array.from(tradeTiles.value.received),
        givenMoney: tradeTiles.value.givenMoney,
        receivedMoney: tradeTiles.value.receivedMoney,
      },
    });
    tradePlayerUsername.value = "";
    tradeTiles.value = {
      given: new Set(),
      received: new Set(),
      givenMoney: 0,
      receivedMoney: 0,
    };
  };

  const handleAcceptTrade = () => {
    isSending.value = true;
    sendAction("ACCEPT_TRADE", { username });
  };

  const handleDeclineTrade = () => {
    isSending.value = true;
    sendAction("DECLINE_TRADE", { username });
  };

  return {
    isSending,
    turnResult,
    selectedTile,
    tradePlayerUsername,
    gameState,
    tradeTiles,
    board,
    tiles,
    propertyGroups,
    player,
    currentTilePlayerOn,
    fullSetsGroups,
    handleUserTurn,
    handleBuyProperty,
    handlePassProperty,
    handleMortgageProperty,
    handleBuyBackProperty,
    handleUpgradeProperty,
    handleSellProperty,
    handlePayRent,
    handlePassAuctionProperty,
    handleBidAuctionProperty,
    handleJailPay,
    handlePayChance,
    handlePayTax,
    handleSendTrade,
    handleAcceptTrade,
    handleDeclineTrade,
  };
};
