import { loadEmbeddingModel } from '../utils/llama'

export default defineNitroPlugin(async () => {
  try {
    await loadEmbeddingModel()
    console.log('[Preload] 模型加载完成')
  } catch (error) {
    throw new Error(`[Preload] 模型加载失败: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
})
