<script lang="ts" setup>
import { computed } from "vue";
import { getTileSpriteUrl } from "~/utils/cartridgeTheme";

const props = defineProps({
  tileId: {
    type: Number,
    required: false,
    default: 0,
  },
  tileName: {
    type: String,
    required: true,
  },
  tilePrice: {
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

defineEmits(["handleBuyProperty", "handlePassProperty"]);

const spriteUrl = computed(() =>
  props.assetId ? getTileSpriteUrl(props.assetId) : ""
);

const canAfford = computed(() => props.playerBalance >= props.tilePrice);
</script>

<template>
  <GameModal title="Buy Property?" :code="`$${props.tilePrice}`" icon="coin">
    <p class="modal-copy">
      Acquire this unowned asset at list price or pass to open an immediate room
      auction.
    </p>

    <div class="modal-highlight">
      <div class="modal-asset">
        <div v-if="spriteUrl" class="modal-asset__logo">
          <img :src="spriteUrl" :alt="props.tileName" />
        </div>
        <div>
          <div class="modal-asset__name">{{ props.tileName }}</div>
          <div class="modal-asset__sub">
            Your cash: ${{ props.playerBalance.toLocaleString() }}
          </div>
        </div>
      </div>
      <div class="modal-price">${{ props.tilePrice }}</div>
    </div>

    <div v-if="!canAfford" class="modal-warning">
      <GameIcon name="warn" :size="20" />
      <span>Not enough funds to buy directly. Pass to auction or mortgage assets.</span>
    </div>

    <div class="modal-actions">
      <BaseButton
        variant="positive"
        :disabled="!canAfford || props.isSending"
        @click="$emit('handleBuyProperty')"
      >
        <GameIcon name="coin" :size="19" />
        <span>BUY ${{ props.tilePrice }}</span>
      </BaseButton>
      <BaseButton
        variant="danger"
        :disabled="props.isSending"
        @click="$emit('handlePassProperty')"
      >
        <span>PASS</span>
      </BaseButton>
    </div>
  </GameModal>
</template>