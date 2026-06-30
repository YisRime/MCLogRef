// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/ui', '@nuxt/eslint'],
  runtimeConfig: {
    apiUrl: '',
    apiKey: '',
    apiModel: '',
    temperature: 0.2,
    adminSecret: '',
    dataDir: './data',
    textChunk: 6144,
    chunkOffset: 2048,
    searchLimit: 5,
    searchCandidate: 64,
    semanticWeight: 0.6,
  },
})