<script setup lang="ts"></script>

<template>
  <button class="button">
    <slot />
  </button>
</template>

<style lang="scss" scoped>
.button {
  background-color: #4c7daf;
  border: none;
  color: white;
  padding: 0.5rem 1rem;
  text-align: center;
  text-decoration: none;
  display: inline-block;
  font-size: 16px;
  margin: 4px 2px;
  cursor: pointer;
  font-family: Nunito, sans-serif;
  font-weight: 700;
  border-radius: 15rem;
}
</style>