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
    textChunk: 16384,
    chunkOffset: 4096,
    searchLimit: 5,
    searchCandidate: 50,
    semanticWeight: 0.7,
  },
})