import { resolve } from "path";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  alias: {
    "@": resolve(__dirname, "/"),
  },
  devtools: { enabled: false },
  nitro: {
    experimental: {
      websocket: true,
    },
  },
  modules: ["@pinia/nuxt", "@nuxt/fonts", "@prisma/nuxt"],
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "public/assets/_variables.scss" as *;',
        },
      },
    },
  },
  prisma: {
    skipPrompts: true,
  },
});
