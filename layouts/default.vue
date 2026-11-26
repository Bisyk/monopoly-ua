<script setup lang="ts"></script>

<template>
  <header class="site-header">
    <div class="site-header__inner">
      <NuxtLink to="/" class="brand-link">
        <span class="brand-badge">
          <img src="/assets/ukr-flag.png" alt="Ukraine flag" />
        </span>
        <span class="brand-text">
          <span class="brand-title">MONOPOLY UA</span>
          <span class="brand-sub">ONLINE TABLETOP</span>
        </span>
      </NuxtLink>
      <RetroBadge variant="gold">16-BIT EDITION</RetroBadge>
    </div>
  </header>
  <main class="site-main">
    <slot />
  </main>
</template>

<style scoped lang="scss">
.site-header {
  background: var(--surface);
  border-bottom: 2.5px solid var(--outline);
  box-shadow: 0 4px 0 var(--outline);
}

.site-header__inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.brand-link {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  text-decoration: none;
  color: var(--ink);
}

.brand-badge {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gold-light);
  border: 2px solid var(--outline);
  border-radius: 6px;
  box-shadow: 0 3px 0 var(--outline);
  padding: 4px;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1;
}

.brand-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: var(--ink);
  text-shadow: 2px 2px 0 var(--gold);
}

.brand-sub {
  margin-top: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--ink-muted);
}

.site-main {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px 20px 40px;
}
</style>