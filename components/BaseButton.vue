<script setup lang="ts">
const props = defineProps({
  textColor: {
    type: String,
    required: false,
    default: 'white'
  },
  bgColor: {
    type: String,
    required: false,
    default: '#4c7daf'
  }
})
</script>

<template>
  <button class="button">
    <slot />
  </button>
</template>

<style lang="scss" scoped>
.button {
  background-color: v-bind('props.bgColor');
  border: none;
  color: v-bind('props.textColor');
  padding: 0.5rem 1rem;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  cursor: pointer;
  font-family: Nunito, sans-serif;
  font-weight: 700;
  border-radius: 15rem;

  &:hover {
    transform: scale(1.1);
    transition: transform 0.3s ease;
  }
}
</style>