import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { insertVectors, searchVectors, type VectorRecord } from './database/lance'
import { chunkText, type ExtractedTags } from './extract'
import { join } from 'path'
import { getConfig } from './config'
import { setGlobalDispatcher, ProxyAgent } from 'undici'

const MODEL_NAME = 'Xenova/bge-base-en-v1.5'
env.cacheDir = join(getConfig('dataDir'), 'models')
let embeddingModel: FeatureExtractionPipeline | null = null
if (process.env.PROXY_URL) setGlobalDispatcher(new ProxyAgent(process.env.PROXY_URL))

export async function loadEmbeddingModel(): Promise<FeatureExtractionPipeline> {
  if (embeddingModel) return embeddingModel
  try {
    console.log(`[Llama] 加载嵌入模型: ${MODEL_NAME}`)
    embeddingModel = await pipeline('feature-extraction', MODEL_NAME, { dtype: 'fp32' })
    return embeddingModel
  } catch (err) {
    console.log('[Llama] 模型加载失败：', err)
    throw err
  }
}

export async function embedText(text: string): Promise<number[]> {
  try {
    if (!embeddingModel) await loadEmbeddingModel()
    const output = await embeddingModel!(text, { pooling: 'cls', normalize: true })
    return Array.from(output.data as Float32Array)
  } catch (err) {
    console.log('[Llama] 文本嵌入失败：', err)
    throw err
  }
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  try {
    if (!embeddingModel) await loadEmbeddingModel()
    const vectors: number[][] = []
    for (const text of texts) {
      try {
        const output = await embeddingModel!(text, { pooling: 'cls', normalize: true })
        vectors.push(Array.from(output.data as Float32Array))
      } catch (err) {
        console.log('[Llama] 嵌入失败：', err)
      }
    }
    return vectors
  } catch (err) {
    console.log('[Llama] 批量嵌入失败：', err)
    throw err
  }
}

export interface Document {
  text: string
  meta: Record<string, string>
}

export async function vectorizeAndStore(rid: number, content: string, tags: ExtractedTags, fileType: string): Promise<number> {
  try {
    const meta: Record<string, string> = { type: fileType }
    if (tags.version.length > 0 && tags.version[0]) meta.version = tags.version[0]
    if (tags.loader.length > 0 && tags.loader[0]) meta.loader = tags.loader[0]
    if (tags.error.length > 0 && tags.error[0]) meta.error = tags.error[0]
    const chunks = chunkText(content, meta)
    console.log(`[Llama] 开始向量化 ${rid}(${fileType})，包含 ${chunks.length} 个切片`)
    let insertedCount = 0
    for (let i = 0; i < chunks.length; i += 16) {
      try {
        const batch = chunks.slice(i, i + 16)
        const texts = batch.map(c => c.text)
        const vectors = await embedBatch(texts)
        const records: VectorRecord[] = batch.map((chunk, idx) => ({ id: Date.now() * 1000 + i + idx, rid, meta: chunk.meta, text: chunk.text, vector: vectors[idx] ?? [] }))
        await insertVectors(records)
        insertedCount += records.length
      } catch (err) {
        console.log(`[Llama] ${i}/${rid} 向量化失败：`, err)
      }
    }
    console.log(`[Llama] ${rid} 向量化完成, 新增 ${insertedCount} 条记录`)
    return insertedCount
  } catch (err) {
    console.log(`[Llama] ${rid} 向量化失败：`, err)
    throw err
  }
}

export interface SearchResult {
  text: string
  meta: Record<string, string>
  score: number
  rid: number
}

function rerank(results: VectorRecord[], queryTags: Record<string, string>): SearchResult[] {
  const { semanticWeight } = getConfig()
  const keywordWeight = 1 - semanticWeight
  return results.map(r => {
    const semanticScore = 1 - (r._distance ?? 0)
    let metaScore = 0
    if (queryTags.error && r.meta.error === queryTags.error) metaScore += 0.7
    if (queryTags.loader && r.meta.loader === queryTags.loader) metaScore += 0.2
    if (queryTags.version && r.meta.version === queryTags.version) metaScore += 0.1
    const finalScore = (semanticScore * semanticWeight) + (metaScore * keywordWeight)
    return { text: r.text, meta: r.meta, score: finalScore, rid: r.rid }
  }).sort((a, b) => b.score - a.score)
}

export async function searchSimilar(query: string, limit?: number, filter?: Record<string, string>): Promise<SearchResult[]> {
  try {
    const config = getConfig()
    const searchLimit = limit ?? config.searchLimit
    const queryVector = await embedText(query)
    const candidateLimit = config.searchCandidate
    let filterStr: string | undefined
    if (filter && filter.loader) filterStr = `meta.loader = '${filter.loader}'`
    const candidates = await searchVectors(queryVector, candidateLimit, filterStr)
    const reranked = rerank(candidates, filter || {})
    console.log(`[Llama] 发现 ${Math.min(searchLimit, reranked.length)} 条记录`)
    return reranked.slice(0, searchLimit)
  } catch (err) {
    console.log('[Llama] 搜索失败：', err)
    throw err
  }
}

export async function closeEmbeddingModel(): Promise<void> {
  embeddingModel = null
}
