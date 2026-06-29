import { pipeline, env, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { insertVectors, searchVectors, type VectorRecord } from './database/lance'
import { chunkText, type ExtractedTags } from './extract'
import { join } from 'path'
import { getConfig } from './config'

env.cacheDir = join(getConfig('dataDir'), 'models')
let embeddingModel: FeatureExtractionPipeline | null = null
const MODEL_NAME = 'Xenova/bge-small-en-v1.5'

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

export async function searchSimilar(query: string, limit: number = 5, filter?: Record<string, string>): Promise<SearchResult[]> {
  const queryVector = await embedText(query)
  let filterStr: string | undefined
  if (filter) {
    const conditions = Object.entries(filter).map(([key, value]) => { return `meta.${key} = '${value}'` })
    filterStr = conditions.join(' AND ')
  }
  const results = await searchVectors(queryVector, limit, filterStr)
  return results.map(r => ({ text: r.text, meta: r.meta, score: 0, rid: r.rid }))
}

export async function closeEmbeddingModel(): Promise<void> {
  embeddingModel = null
}
