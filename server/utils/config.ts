import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'

export interface AppConfig {
  apiUrl: string
  apiKey: string
  apiModel: string
  dataDir: string
  adminSecret: string
}

const defaultConfig: AppConfig = {
  apiUrl: '',
  apiKey: '',
  apiModel: '',
  dataDir: './data',
  adminSecret: '',
}

function getDataDir(): string {
  const envDir = process.env.DATA_DIR
  return resolve(envDir || defaultConfig.dataDir)
}

function getConfigPath(): string {
  return join(getDataDir(), 'config.json')
}

function ensureDataDir(): void {
  const dir = getDataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function readConfigFile(): Partial<AppConfig> {
  const path = getConfigPath()
  if (!existsSync(path)) return {}
  try {
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content)
  } catch {
    return {}
  }
}

function writeConfigFile(config: Partial<AppConfig>): void {
  ensureDataDir()
  const path = getConfigPath()
  const existing = readConfigFile()
  const merged = { ...existing, ...config }
  writeFileSync(path, JSON.stringify(merged, null, 2), 'utf-8')
}

export function getConfig(): AppConfig
export function getConfig<K extends keyof AppConfig>(key: K): AppConfig[K]
export function getConfig<K extends keyof AppConfig>(key?: K): AppConfig | AppConfig[K] {
  const fileConfig = readConfigFile()
  const config: AppConfig = {
    apiUrl: process.env.API_URL || fileConfig.apiUrl || defaultConfig.apiUrl,
    apiKey: process.env.API_KEY || fileConfig.apiKey || defaultConfig.apiKey,
    apiModel: process.env.API_MODEL || fileConfig.apiModel || defaultConfig.apiModel,
    dataDir: getDataDir(),
    adminSecret: process.env.ADMIN_SECRET || fileConfig.adminSecret || defaultConfig.adminSecret,
  }
  if (key !== undefined) return config[key]
  return config
}

export function setConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void
export function setConfig(config: Partial<AppConfig>): void
export function setConfig<K extends keyof AppConfig>(keyOrConfig: K | Partial<AppConfig>, value?: AppConfig[K]): void {
  if (typeof keyOrConfig === 'string') {
    writeConfigFile({ [keyOrConfig]: value } as Partial<AppConfig>)
  } else {
    writeConfigFile(keyOrConfig)
  }
}
