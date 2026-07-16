import { connect, type Connection, type Table } from '@lancedb/lancedb'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { getConfig } from '../config'

export interface VectorRecord {
  id: number
  rid: number
  meta: Record<string, string>
  text: string
  vector: number[]
  _distance?: number
}

let connection: Connection | null = null
let table: Table | null = null

function getDbPath(): string { return join(getConfig('dataDir'), 'reports') }

export async function getLanceConnection(): Promise<Connection> {
  if (connection) return connection
  const dir = getConfig('dataDir')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  connection = await connect(getDbPath())
  return connection
}

export async function getTable(): Promise<Table> {
  if (table) return table
  const conn = await getLanceConnection()
  table = (await conn.tableNames()).includes('vectors')
    ? await conn.openTable('vectors')
    : await conn.createTable('vectors', [{ id: 0, rid: 0, meta: { type: '', version: '', loader: '', error: '' }, text: '', vector: new Array(768).fill(0) }])
  return table
}

export async function insertVectors(records: VectorRecord[]): Promise<void> {
  await (await getTable()).add(records as unknown as Record<string, unknown>[])
}

export async function searchVectors(vector: number[], limit: number = 5, filter?: string): Promise<VectorRecord[]> {
  let query = (await getTable()).query().nearestTo(vector).limit(limit)
  if (filter) query = query.where(filter)
  return await query.toArray() as unknown as VectorRecord[]
}

export async function searchByMetadata(filter: string, limit: number = 100): Promise<VectorRecord[]> {
  return await (await getTable()).query().where(filter).limit(limit).toArray() as unknown as VectorRecord[]
}

export async function deleteByReport(rid: number): Promise<void> {
  await (await getTable()).delete(`rid = ${rid}`)
}

export async function getCount(): Promise<number> {
  return await (await getTable()).countRows()
}

export async function closeLanceConnection(): Promise<void> {
  table = null
  connection = null
}
