import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { getConfig } from '../config'

let db: Database.Database | null = null

function getDbPath(): string {
  const dataDir = getConfig('dataDir')
  return join(dataDir, 'meta.db')
}

export function getDatabase(): Database.Database {
  if (db) return db
  try {
    const path = getDbPath()
    const dir = getConfig('dataDir')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    console.log(`[SQLite] 初始化数据库：${path}`)
    db = new Database(path)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initTables()
    return db
  } catch (err) {
    console.log('[SQLite] 初始化失败：', err)
    throw err
  }
}

function initTables(): void {
  try {
    const db = getDatabase()
    db.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        solution TEXT DEFAULT '',
        status INTEGER DEFAULT 0,
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)
    db.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rid INTEGER NOT NULL,
        file TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('crash', 'gamelog', 'log', 'discuss', 'other')),
        content TEXT DEFAULT '',
        FOREIGN KEY (rid) REFERENCES reports(id) ON DELETE CASCADE
      )
    `)
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rid INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('version', 'loader', 'error', 'mod')),
        value TEXT NOT NULL,
        FOREIGN KEY (rid) REFERENCES reports(id) ON DELETE CASCADE
      )
    `)
    db.exec(`
      CREATE TABLE IF NOT EXISTS stats (
        key TEXT PRIMARY KEY,
        value INTEGER DEFAULT 0
      )
    `)
    db.exec('CREATE INDEX IF NOT EXISTS idx_files_rid ON files(rid)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_tags_rid ON tags(rid)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_tags_type ON tags(type)')
    db.exec('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)')
  } catch (err) {
    console.log('[SQLite] 初始化表失败：', err)
  }
}

export interface Report {
  id: number
  name: string
  solution: string
  status: number
  timestamp: number
}

export interface File {
  id: number
  rid: number
  file: string
  type: 'crash' | 'gamelog' | 'log' | 'discuss' | 'other'
  content: string
}

export interface Tag {
  id: number
  rid: number
  type: 'version' | 'loader' | 'error' | 'mod'
  value: string
}

export function createReport(name: string): number {
  try {
    const db = getDatabase()
    const result = db.prepare('INSERT INTO reports (name) VALUES (?)').run(name)
    return result.lastInsertRowid as number
  } catch (err) {
    console.log(`[SQLite] 日志 ${name} 创建失败：`, err)
    throw err
  }
}

export function getReport(id: number): Report | undefined {
  try {
    const db = getDatabase()
    return db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as Report | undefined
  } catch (err) {
    console.log(`[SQLite] 日志 ${id} 查询失败：`, err)
    return undefined
  }
}

export function getReportByName(name: string): Report | undefined {
  try {
    const db = getDatabase()
    return db.prepare('SELECT * FROM reports WHERE name = ?').get(name) as Report | undefined
  } catch (err) {
    console.log(`[SQLite] 日志名 ${name} 查询失败：`, err)
    return undefined
  }
}

export function getReports(limit: number = 100, offset: number = 0): Report[] {
  try {
    const db = getDatabase()
    return db.prepare('SELECT * FROM reports ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset) as Report[]
  } catch (err) {
    console.log('[SQLite] 列表查询失败：', err)
    return []
  }
}

export function updateReport(id: number, data: Partial<Pick<Report, 'name' | 'solution' | 'status'>>): void {
  try {
    const db = getDatabase()
    const fields: string[] = []
    const values: unknown[] = []
    if (data.name !== undefined) {
      fields.push('name = ?')
      values.push(data.name)
    }
    if (data.solution !== undefined) {
      fields.push('solution = ?')
      values.push(data.solution)
    }
    if (data.status !== undefined) {
      fields.push('status = ?')
      values.push(data.status)
    }
    if (fields.length === 0) return
    values.push(id)
    db.prepare(`UPDATE reports SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  } catch (err) {
    console.log(`[SQLite] 日志 ${id} 更新失败：`, err)
  }
}

export function deleteReport(id: number): void {
  try {
    const db = getDatabase()
    db.prepare('DELETE FROM reports WHERE id = ?').run(id)
  } catch (err) {
    console.log(`[SQLite] 日志 ${id} 删除失败：`, err)
  }
}

export function createFile(rid: number, file: string, type: File['type'], content: string = ''): number {
  try {
    const db = getDatabase()
    const result = db.prepare('INSERT INTO files (rid, file, type, content) VALUES (?, ?, ?, ?)').run(rid, file, type, content)
    return result.lastInsertRowid as number
  } catch (err) {
    console.log(`[SQLite] 文件 ${file}(${rid}) 创建失败：`, err)
    throw err
  }
}

export function getFilesByReport(rid: number): File[] {
  try {
    const db = getDatabase()
    return db.prepare('SELECT * FROM files WHERE rid = ?').all(rid) as File[]
  } catch (err) {
    console.log(`[SQLite] 文件 ${rid} 查询失败：`, err)
    return []
  }
}

export function getFile(id: number): File | undefined {
  try {
    const db = getDatabase()
    return db.prepare('SELECT * FROM files WHERE id = ?').get(id) as File | undefined
  } catch (err) {
    console.log(`[SQLite] 文件 ${id} 查询失败：`, err)
    return undefined
  }
}

export function createTag(rid: number, type: Tag['type'], value: string): number {
  try {
    const db = getDatabase()
    const result = db.prepare('INSERT INTO tags (rid, type, value) VALUES (?, ?, ?)').run(rid, type, value)
    return result.lastInsertRowid as number
  } catch (err) {
    console.log(`[SQLite] 标签 ${type}(${rid}) 创建失败：`, err)
    throw err
  }
}

export function getTagsByReport(rid: number): Tag[] {
  try {
    const db = getDatabase()
    return db.prepare('SELECT * FROM tags WHERE rid = ?').all(rid) as Tag[]
  } catch (err) {
    console.log(`[SQLite] 标签 ${rid} 查询失败：`, err)
    return []
  }
}

export function getTagsByType(type: Tag['type']): Tag[] {
  try {
    const db = getDatabase()
    return db.prepare('SELECT * FROM tags WHERE type = ?').all(type) as Tag[]
  } catch (err) {
    console.log(`[SQLite] 标签类型 ${type} 查询失败：`, err)
    return []
  }
}

export function getStat(key: string): number {
  try {
    const db = getDatabase()
    const row = db.prepare('SELECT value FROM stats WHERE key = ?').get(key) as { value: number } | undefined
    return row?.value || 0
  } catch (err) {
    console.log(`[SQLite] 状态 ${key} 查询失败：`, err)
    return 0
  }
}

export function incrementStat(key: string): void {
  try {
    const db = getDatabase()
    db.prepare('INSERT INTO stats (key, value) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET value = value + 1').run(key)
  } catch (err) {
    console.log(`[SQLite] 状态 ${key} 更新失败：`, err)
  }
}

export function getReportCounts() {
  try {
    const db = getDatabase()
    const nowTs = Math.floor(Date.now() / 1000)
    const todayTs = nowTs - 86400
    const weekTs = nowTs - 604800
    const result = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as user,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as admin,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as week
      FROM reports
    `).get(todayTs, weekTs)
    return result as { total: number; user: number; admin: number; today: number; week: number }
  } catch (err) {
    console.log('[SQLite] 日志统计查询失败：', err)
    return { total: 0, user: 0, admin: 0, today: 0, week: 0 }
  }
}

export function getFileCounts() {
  try {
    const db = getDatabase()
    const result = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'crash' THEN 1 ELSE 0 END) as crash,
        SUM(CASE WHEN type = 'gamelog' THEN 1 ELSE 0 END) as gamelog,
        SUM(CASE WHEN type = 'log' THEN 1 ELSE 0 END) as log,
        SUM(CASE WHEN type = 'discuss' THEN 1 ELSE 0 END) as discuss,
        SUM(CASE WHEN type = 'other' THEN 1 ELSE 0 END) as other
      FROM files
    `).get()
    return result as { total: number; crash: number; gamelog: number; log: number; discuss: number; other: number }
  } catch (err) {
    console.log('[SQLite] 文件统计查询失败：', err)
    return { total: 0, crash: 0, gamelog: 0, log: 0, discuss: 0, other: 0 }
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}