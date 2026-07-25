import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { insertVectors, searchVectors, type VectorRecord } from './database/lance'
import { chunkText, type ExtractedTags, type GroupFile } from './extract'
import { join } from 'path'
import { getConfig } from './config'
import { setGlobalDispatcher, ProxyAgent } from 'undici'

const MODEL_NAME = 'Xenova/bge-base-en-v1.5'
env.cacheDir = join(getConfig('dataDir'), 'models')
let embeddingModel: FeatureExtractionPipeline | null = null
if (process.env.PROXY_URL) setGlobalDispatcher(new ProxyAgent(process.env.PROXY_URL))

export async function loadEmbeddingModel(): Promise<FeatureExtractionPipeline> {
  if (embeddingModel) return embeddingModel
  embeddingModel = await pipeline('feature-extraction', MODEL_NAME, { dtype: 'fp32' })
  return embeddingModel
}

export async function embedText(text: string): Promise<number[]> {
  const model = await loadEmbeddingModel()
  const output = await model(text, { pooling: 'cls', normalize: true })
  return Array.from(output.data as Float32Array)
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const model = await loadEmbeddingModel()
  const vectors: number[][] = []
  for (const text of texts) {
    const output = await model(text, { pooling: 'cls', normalize: true })
    vectors.push(Array.from(output.data as Float32Array))
  }
  return vectors
}

export async function vectorizeFiles(rid: number, files: GroupFile[], tags: ExtractedTags): Promise<number> {
  const chunks = files.flatMap((file) => {
    const meta: Record<string, string> = { type: file.type }
    if (tags.version[0]) meta.version = tags.version[0]
    if (tags.loader[0]) meta.loader = tags.loader[0]
    if (tags.error[0]) meta.error = tags.error[0]
    return chunkText(file.content, meta)
  })
  for (let i = 0; i < chunks.length; i += 16) {
    const batch = chunks.slice(i, i + 16)
    const vectors = await embedBatch(batch.map(chunk => chunk.text))
    if (vectors.length !== batch.length) throw new Error(`Vectorize Failed: Expected ${batch.length} vectors, received ${vectors.length}`)
    const records: VectorRecord[] = batch.map((chunk, idx) => ({ id: Date.now() * 1000 + i + idx, rid, meta: chunk.meta, text: chunk.text, vector: vectors[idx]! }))
    await insertVectors(records)
  }
  return chunks.length
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
  const config = getConfig()
  const searchLimit = limit ?? config.searchLimit
  const candidates = await searchVectors(await embedText(query),  config.searchCandidate,  filter && Object.keys(filter).length > 0 ? filter : undefined)
  return rerank(candidates, filter || {}).slice(0, searchLimit)
}

export async function closeEmbeddingModel(): Promise<void> {
  embeddingModel = null
}
