import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { insertVectors, searchVectors, type VectorRecord } from './database/lance'
import { chunkText, type ExtractedTags } from './extract'
import { join } from 'path'
import { getConfig } from './config'

env.cacheDir = join(getConfig('dataDir'), 'models')
let embeddingModel: FeatureExtractionPipeline | null = null
const MODEL_NAME = 'Xenova/gte-base-en-v1.5'

export async function loadEmbeddingModel(): Promise<FeatureExtractionPipeline> {
  if (embeddingModel) return embeddingModel
  embeddingModel = await pipeline('feature-extraction', MODEL_NAME, { dtype: 'fp32' })
  return embeddingModel
}

export async function embedText(text: string): Promise<number[]> {
  const model = await loadEmbeddingModel()
  const output = await model(text, { pooling: 'cls', normalize: true })
  const vector = Array.from(output.data as Float32Array)
  return vector
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

export interface Document {
  text: string
  meta: Record<string, string>
}

export async function vectorizeAndStore(rid: number, content: string, tags: ExtractedTags, fileType: string): Promise<number> {
  const meta: Record<string, string> = { type: fileType }
  if (tags.version.length > 0 && tags.version[0]) meta.version = tags.version[0]
  if (tags.loader.length > 0 && tags.loader[0]) meta.loader = tags.loader[0]
  if (tags.error.length > 0 && tags.error[0]) meta.error = tags.error[0]
  const chunks = chunkText(content, meta)
  let insertedCount = 0
  for (let i = 0; i < chunks.length; i += 10) {
    const batch = chunks.slice(i, i + 10)
    const texts = batch.map(c => c.text)
    const vectors = await embedBatch(texts)
    const records: VectorRecord[] = batch.map((chunk, idx) => ({ id: Date.now() * 1000 + i + idx, rid, meta: chunk.meta, text: chunk.text, vector: vectors[idx] ?? [] }))
    await insertVectors(records)
    insertedCount += records.length
  }
  return insertedCount
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
  const queryVector = await embedText(query)
  const candidateLimit = config.searchCandidate
  let filterStr: string | undefined
  if (filter && filter.loader) filterStr = `meta.loader = '${filter.loader}'`
  const candidates = await searchVectors(queryVector, candidateLimit, filterStr)
  const reranked = rerank(candidates, filter || {})
  return reranked.slice(0, searchLimit)
}

export async function closeEmbeddingModel(): Promise<void> {
  embeddingModel = null
}
