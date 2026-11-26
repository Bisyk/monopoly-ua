<script setup lang="ts"></script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<style lang="scss">
:root {
  --bg-page: #{$cartridge-bg};
  --surface: #{$cartridge-surface};
  --surface-alt: #{$cartridge-surface-alt};
  --ink: #{$cartridge-ink};
  --ink-muted: #{$cartridge-muted};
  --outline: #{$cartridge-ink};
  --rule-muted: #{$cartridge-rule};

  --accent: #{$cartridge-primary};
  --accent-dark: #{$cartridge-primary-dark};
  --gold: #{$cartridge-gold};
  --gold-light: #{$cartridge-gold-light};
  --gold-dark: #{$cartridge-gold-dark};
  --positive: #{$cartridge-positive};
  --positive-dark: #{$cartridge-positive-dark};
  --danger: #{$cartridge-danger};
  --danger-dark: #{$cartridge-danger-dark};
  --danger-soft: #{$cartridge-danger-soft};

  --font-display: #{$font-display};
  --font-body: #{$font-body};
  --font-mono: #{$font-mono};

  --radius-sm: #{$radius-sm};
  --radius-md: #{$radius-md};
  --radius-lg: #{$radius-lg};
  --radius-board: #{$radius-board};

  --panel-border: 2.5px solid #{$cartridge-ink};
  --panel-shadow: 0 5px 0 #{$cartridge-ink};
  --card-shadow: 0 4px 0 #{$cartridge-ink};
  --modal-shadow: 0 6px 0 #{$cartridge-ink};
}

*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  min-height: 100%;
}

body {
  background-color: var(--bg-page);
  background-image:
    linear-gradient(90deg, rgba(30, 27, 58, 0.045) 1px, transparent 1px),
    linear-gradient(rgba(30, 27, 58, 0.045) 1px, transparent 1px);
  background-size: 24px 24px;
  color: var(--ink);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

h1,
h2,
h3 {
  font-family: var(--font-display);
  letter-spacing: 0.01em;
}

input,
button,
select,
textarea {
  font-family: inherit;
}
</style>