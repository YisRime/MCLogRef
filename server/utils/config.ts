import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

export interface AppConfig {
  apiUrl: string
  apiKey: string
  apiModel: string
  temperature: number
  dataDir: string
  adminSecret: string
  textChunk: number
  chunkOffset: number
  searchLimit: number
  searchCandidate: number
  semanticWeight: number
}

const defaultConfig: AppConfig = {
  apiUrl: '',
  apiKey: '',
  apiModel: '',
  temperature: 0.2,
  dataDir: './data',
  adminSecret: '',
  textChunk: 6144,
  chunkOffset: 2048,
  searchLimit: 5,
  searchCandidate: 64,
  semanticWeight: 0.6,
}

function getDataDir(): string { return resolve(process.env.DATA_DIR || defaultConfig.dataDir) }

function getConfigPath(): string { return join(getDataDir(), 'config.json') }

function ensureDataDir(): void { if (!existsSync(getDataDir())) mkdirSync(getDataDir(), { recursive: true }) }

function readConfigFile(): Partial<AppConfig> {
  const path = getConfigPath()
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch (err) {
    console.error(`[Config] 读取配置 ${path} 失败：`, err)
    return {}
  }
}

function writeConfigFile(config: Partial<AppConfig>): void {
  ensureDataDir()
  writeFileSync(getConfigPath(), JSON.stringify({ ...readConfigFile(), ...config }, null, 2), 'utf-8')
}

export function getConfig(): AppConfig
export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K]
export function getConfig<K extends keyof AppConfig>(key?: K): AppConfig | AppConfig[K] {
  const fileConfig = readConfigFile()
  const config: AppConfig = {
    apiUrl: process.env.API_URL || fileConfig.apiUrl || defaultConfig.apiUrl,
    apiKey: process.env.API_KEY || fileConfig.apiKey || defaultConfig.apiKey,
    apiModel: process.env.API_MODEL || fileConfig.apiModel || defaultConfig.apiModel,
    temperature: Number(process.env.API_TEMPERATURE || fileConfig.temperature || defaultConfig.temperature),
    dataDir: getDataDir(),
    adminSecret: process.env.ADMIN_SECRET || fileConfig.adminSecret || defaultConfig.adminSecret,
    textChunk: Number(process.env.TEXT_CHUNK_SIZE || fileConfig.textChunk || defaultConfig.textChunk),
    chunkOffset: Number(process.env.CHUNK_OFFSET || fileConfig.chunkOffset || defaultConfig.chunkOffset),
    searchLimit: Number(process.env.SEARCH_LIMIT || fileConfig.searchLimit || defaultConfig.searchLimit),
    searchCandidate: Number(process.env.SEARCH_CANDIDATE || fileConfig.searchCandidate || defaultConfig.searchCandidate),
    semanticWeight: Number(process.env.SEMANTIC_WEIGHT || fileConfig.semanticWeight || defaultConfig.semanticWeight),
  }
  if (key !== undefined) return config[key]
  return config
}

export function setConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void
export function setConfig(config: Partial<AppConfig>): void
export function setConfig<K extends keyof AppConfig>(keyOrConfig: K | Partial<AppConfig>, value?: AppConfig[K]): void {
  writeConfigFile(typeof keyOrConfig === 'string' ? { [keyOrConfig]: value } as Partial<AppConfig> : keyOrConfig)
}
