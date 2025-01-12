<script setup></script>

<template>
  <header>
    <div>
      <h1>MONOPOLY </h1>
      <img src="public/assets/ukr-flag.png" alt="logo">
      <BaseButton >Clear Games</BaseButton>
    </div>
  </header>
  <main>
    <slot />
  </main>
</template>

<style lang="scss">
header {
  border-bottom: 2px solid #ccc;
  padding: 0.5rem 2rem;

  div {
    display: flex;
    align-items: center;
    gap: 0.2rem;

    img {
      width: 40px;
      height: 40px;
    }
  }

  h1 {
    font-size: 1.5rem;
    color: rgb(0, 0, 0);
    font-weight: 900;
  }
}
</style>