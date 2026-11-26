<script setup lang="ts">
import { computed } from "vue";
import { getTileSpriteUrl } from "~/utils/cartridgeTheme";

const props = defineProps({
  tileOnAuctionName: {
    type: String,
    required: true,
  },
  tileOnAuctionPrice: {
    type: Number,
    required: true,
  },
  assetId: {
    type: String,
    required: false,
    default: "",
  },
  playerBalance: {
    type: Number,
    required: true,
  },
  isSending: {
    type: Boolean,
    required: true,
  },
});

defineEmits(["handleBidAuctionProperty", "handlePassAuctionProperty"]);

const spriteUrl = computed(() =>
  props.assetId ? getTileSpriteUrl(props.assetId) : ""
);

const canAfford = computed(
  () => props.playerBalance >= props.tileOnAuctionPrice
);
</script>

<template>
  <GameModal title="Live Auction!" code="+$10 STEP" icon="gavel">
    <p class="modal-copy">
      Place the next bid to claim <strong>{{ props.tileOnAuctionName }}</strong>
      or pass to drop out of this round.
    </p>

    <div class="modal-highlight">
      <div class="modal-asset">
        <div v-if="spriteUrl" class="modal-asset__logo">
          <img :src="spriteUrl" :alt="props.tileOnAuctionName" />
        </div>
        <div>
          <div class="modal-asset__name">{{ props.tileOnAuctionName }}</div>
          <div class="modal-asset__sub">
            Your cash: ${{ props.playerBalance.toLocaleString() }}
          </div>
        </div>
      </div>
      <div class="modal-price">${{ props.tileOnAuctionPrice }}</div>
    </div>

    <div v-if="!canAfford" class="modal-warning">
      <GameIcon name="warn" :size="20" />
      <span>Insufficient cash for this bid amount.</span>
    </div>

    <div class="modal-actions">
      <BaseButton
        variant="positive"
        :disabled="!canAfford || props.isSending"
        @click="$emit('handleBidAuctionProperty')"
      >
        <GameIcon name="gavel" :size="19" />
        <span>BID ${{ props.tileOnAuctionPrice }}</span>
      </BaseButton>
      <BaseButton
        variant="danger"
        :disabled="props.isSending"
        @click="$emit('handlePassAuctionProperty')"
      >
        <span>PASS</span>
      </BaseButton>
    </div>
  </GameModal>
</template>