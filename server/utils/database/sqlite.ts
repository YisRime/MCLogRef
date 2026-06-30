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
  const path = getDbPath()
  const dir = getConfig('dataDir')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  db = new Database(path)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  initTables()
  return db
}

function initTables(): void {
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
  const db = getDatabase()
  const result = db.prepare('INSERT INTO reports (name) VALUES (?)').run(name)
  return result.lastInsertRowid as number
}

export function getReport(id: number): Report | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as Report | undefined
}

export function getReportByName(name: string): Report | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM reports WHERE name = ?').get(name) as Report | undefined
}

export function getReports(limit: number = 100, offset: number = 0): Report[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM reports ORDER BY timestamp DESC LIMIT ? OFFSET ?').all(limit, offset) as Report[]
}

export function updateReport(id: number, data: Partial<Pick<Report, 'name' | 'solution' | 'status'>>): void {
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
}

export function deleteReport(id: number): void {
  const db = getDatabase()
  db.prepare('DELETE FROM reports WHERE id = ?').run(id)
}

export function createFile(rid: number, file: string, type: File['type'], content: string = ''): number {
  const db = getDatabase()
  const result = db.prepare('INSERT INTO files (rid, file, type, content) VALUES (?, ?, ?, ?)').run(rid, file, type, content)
  return result.lastInsertRowid as number
}

export function getFilesByReport(rid: number): File[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM files WHERE rid = ?').all(rid) as File[]
}

export function getFile(id: number): File | undefined {
  const db = getDatabase()
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id) as File | undefined
}

export function createTag(rid: number, type: Tag['type'], value: string): number {
  const db = getDatabase()
  const result = db.prepare('INSERT INTO tags (rid, type, value) VALUES (?, ?, ?)').run(rid, type, value)
  return result.lastInsertRowid as number
}

export function getTagsByReport(rid: number): Tag[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM tags WHERE rid = ?').all(rid) as Tag[]
}

export function getTagsByType(type: Tag['type']): Tag[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM tags WHERE type = ?').all(type) as Tag[]
}

export function getStat(key: string): number {
  const db = getDatabase()
  const row = db.prepare('SELECT value FROM stats WHERE key = ?').get(key) as { value: number } | undefined
  return row?.value || 0
}

export function incrementStat(key: string): void {
  const db = getDatabase()
  db.prepare('INSERT INTO stats (key, value) VALUES (?, 1) ON CONFLICT(key) DO UPDATE SET value = value + 1').run(key)
}

export function getGlobalCounts() {
  const db = getDatabase()
  const reports = db.prepare('SELECT COUNT(*) as count FROM reports').get() as { count: number }
  const files = db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number }
  const userReports = db.prepare('SELECT COUNT(*) as count FROM reports WHERE status = 2').get() as { count: number }
  const adminReports = db.prepare('SELECT COUNT(*) as count FROM reports WHERE status = 1').get() as { count: number }
  return { reports: reports.count, files: files.count, userReports: userReports.count, adminReports: adminReports.count }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}