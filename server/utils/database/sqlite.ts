import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { getConfig } from '../config'

let db: Database.Database | null = null

function getDbPath(): string { return join(getConfig('dataDir'), 'meta.db') }

export function getDatabase(): Database.Database {
  if (db) return db
  const dir = getConfig('dataDir')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  db = new Database(getDbPath())
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initTables()
  return db
}

function initTables(): void {
  const database = db!
  database.exec(`
      CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        solution TEXT DEFAULT '',
        status INTEGER DEFAULT 0,
        timestamp INTEGER DEFAULT (strftime('%s', 'now'))
      )
    `)
  database.exec(`
      CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rid INTEGER NOT NULL,
        file TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('crash', 'gamelog', 'log', 'discuss', 'other')),
        content TEXT DEFAULT '',
        FOREIGN KEY (rid) REFERENCES reports(id) ON DELETE CASCADE
      )
    `)
  database.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rid INTEGER NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('version', 'loader', 'error', 'mod')),
        value TEXT NOT NULL,
        FOREIGN KEY (rid) REFERENCES reports(id) ON DELETE CASCADE
      )
    `)
  database.exec(`
      CREATE TABLE IF NOT EXISTS stats (
        key TEXT PRIMARY KEY,
        value INTEGER DEFAULT 0
      )
    `)
  database.exec('CREATE INDEX IF NOT EXISTS idx_files_rid ON files(rid)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_tags_rid ON tags(rid)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_tags_type ON tags(type)')
  database.exec('CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)')
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
  return getDatabase().prepare('INSERT INTO reports (name) VALUES (?)').run(name).lastInsertRowid as number
}

export function getReport(id: number): Report | undefined {
  return getDatabase().prepare('SELECT * FROM reports WHERE id = ?').get(id) as Report | undefined
}

export function getReportByName(name: string): Report | undefined {
  return getDatabase().prepare('SELECT * FROM reports WHERE name = ?').get(name) as Report | undefined
}

export function getReports(limit: number = 100, offset: number = 0): Report[] {
  return getDatabase().prepare('SELECT * FROM reports ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset) as Report[]
}

export function updateReport(id: number, data: Partial<Pick<Report, 'name' | 'solution' | 'status'>>): void {
  const fields: string[] = []
  const values: unknown[] = []
  for (const key of ['name', 'solution', 'status'] as const) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`)
      values.push(data[key])
    }
  }
  if (fields.length) getDatabase().prepare(`UPDATE reports SET ${fields.join(', ')} WHERE id = ?`).run(...values, id)
}

export function deleteReport(id: number): void {
  getDatabase().prepare('DELETE FROM reports WHERE id = ?').run(id)
}

export function createFile(rid: number, file: string, type: File['type'], content: string = ''): number {
  return getDatabase().prepare('INSERT INTO files (rid, file, type, content) VALUES (?, ?, ?, ?)').run(rid, file, type, content).lastInsertRowid as number
}

export function getFilesByReport(rid: number): File[] {
  return getDatabase().prepare('SELECT * FROM files WHERE rid = ?').all(rid) as File[]
}

export function getFile(id: number): File | undefined {
  return getDatabase().prepare('SELECT * FROM files WHERE id = ?').get(id) as File | undefined
}

export function createTag(rid: number, type: Tag['type'], value: string): number {
  return getDatabase().prepare('INSERT INTO tags (rid, type, value) VALUES (?, ?, ?)').run(rid, type, value).lastInsertRowid as number
}

export function getTagsByReport(rid: number): Tag[] {
  return getDatabase().prepare('SELECT * FROM tags WHERE rid = ?').all(rid) as Tag[]
}

export function getTagsByType(type: Tag['type']): Tag[] {
  return getDatabase().prepare('SELECT * FROM tags WHERE type = ?').all(type) as Tag[]
}

export function getStat(key: string): number {
  return (getDatabase().prepare('SELECT value FROM stats WHERE key = ?').get(key) as { value: number } | undefined)?.value || 0
}

export function incrementStat(key: string): void {
  getDatabase().prepare('INSERT INTO stats (key, value) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET value = value + 1').run(key)
}

export function getReportCounts() {
  const nowTs = Math.floor(Date.now() / 1000)
  return getDatabase().prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) as user,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as admin,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as today,
        SUM(CASE WHEN timestamp >= ? THEN 1 ELSE 0 END) as week
      FROM reports
    `).get(nowTs - 86400, nowTs - 604800) as { total: number; user: number; admin: number; today: number; week: number }
}

export function getFileCounts() {
  return getDatabase().prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'crash' THEN 1 ELSE 0 END) as crash,
        SUM(CASE WHEN type = 'gamelog' THEN 1 ELSE 0 END) as gamelog,
        SUM(CASE WHEN type = 'log' THEN 1 ELSE 0 END) as log,
        SUM(CASE WHEN type = 'discuss' THEN 1 ELSE 0 END) as discuss,
        SUM(CASE WHEN type = 'other' THEN 1 ELSE 0 END) as other
      FROM files
    `).get() as { total: number; crash: number; gamelog: number; log: number; discuss: number; other: number }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
