<script setup lang="ts">
import { computed } from "vue";
import { getTileSpriteUrl } from "~/utils/cartridgeTheme";

const props = defineProps({
  tilePlayerOn: {
    type: Object,
    required: true,
  },
  turnResult: {
    type: Object,
    required: true,
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

defineEmits(["handlePayRent"]);

const baseRentValue = computed(
  () => props.tilePlayerOn.rentLevels?.[props.tilePlayerOn.rentLevel ?? 0] ?? 0
);

const isBonusProperty = computed(
  () => props.tilePlayerOn.type === "bonus-property"
);

const rentDue = computed(() => {
  if (isBonusProperty.value && props.turnResult) {
    return (
      (Number(props.turnResult.left || 0) +
        Number(props.turnResult.right || 0)) *
      baseRentValue.value
    );
  }
  return baseRentValue.value;
});

const shortfall = computed(() => Math.max(0, rentDue.value - props.playerBalance));
const spriteUrl = computed(() => getTileSpriteUrl(props.tilePlayerOn.assetId));
</script>

<template>
  <GameModal title="Rent Due!" :code="props.tilePlayerOn.name" icon="warn">
    <div class="modal-highlight">
      <div class="modal-asset">
        <div v-if="spriteUrl" class="modal-asset__logo">
          <img :src="spriteUrl" :alt="props.tilePlayerOn.name" />
        </div>
        <div>
          <div class="modal-asset__name">Pay {{ props.tilePlayerOn.owner }}</div>
          <div v-if="isBonusProperty" class="modal-asset__sub">
            ({{ props.turnResult.left }} + {{ props.turnResult.right }}) ×
            {{ baseRentValue }}x
          </div>
          <div v-else class="modal-asset__sub">
            Your cash: ${{ props.playerBalance.toLocaleString() }}
          </div>
        </div>
      </div>
      <div class="modal-price modal-price--danger">${{ rentDue }}</div>
    </div>

    <div v-if="shortfall > 0" class="modal-warning">
      <GameIcon name="warn" :size="20" />
      <span>
        Short ${{ shortfall }} — mortgage a deed or sell upgrades before paying
        rent.
      </span>
    </div>

    <div class="modal-actions">
      <BaseButton
        variant="danger"
        size="lg"
        block
        :disabled="props.playerBalance < rentDue || props.isSending"
        @click="$emit('handlePayRent')"
      >
        <GameIcon name="coin" :size="20" />
        <span>PAY ${{ rentDue }}</span>
      </BaseButton>
    </div>
  </GameModal>
</template>