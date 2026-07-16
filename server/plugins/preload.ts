import { loadEmbeddingModel } from '../utils/llama'

export default defineNitroPlugin(async () => {
  try {
    await loadEmbeddingModel()
  } catch (error) {
    console.error('[Preload] 加载嵌入模型失败：', error)
    throw error
  }
})
