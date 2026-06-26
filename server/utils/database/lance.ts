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
}

let connection: Connection | null = null
let table: Table | null = null

function getDbPath(): string {
  const dataDir = getConfig('dataDir')
  return join(dataDir, 'reports')
}

export async function getLanceConnection(): Promise<Connection> {
  if (connection) return connection
  const path = getDbPath()
  const dir = getConfig('dataDir')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  connection = await connect(path)
  return connection
}

export async function getTable(): Promise<Table> {
  if (table) return table
  const conn = await getLanceConnection()
  const tableNames = await conn.tableNames()
  if (tableNames.includes('vectors')) {
    table = await conn.openTable('vectors')
  } else {
    table = await conn.createTable('vectors', [
      {
        id: 0, rid: 0, meta: {}, text: '',
        vector: new Array(384).fill(0),
      },
    ])
  }
  return table
}

export async function insertVectors(records: VectorRecord[]): Promise<void> {
  const tbl = await getTable()
  await tbl.add(records as unknown as Record<string, unknown>[])
}

export async function searchVectors(vector: number[], limit: number = 5, filter?: string): Promise<VectorRecord[]> {
  const tbl = await getTable()
  let query = tbl.query().nearestTo(vector).limit(limit)
  if (filter) query = query.where(filter)
  const results = await query.toArray()
  return results as unknown as VectorRecord[]
}

export async function searchByMetadata(filter: string, limit: number = 100): Promise<VectorRecord[]> {
  const tbl = await getTable()
  const results = await tbl.query().where(filter).limit(limit).toArray()
  return results as unknown as VectorRecord[]
}

export async function deleteByReport(rid: number): Promise<void> {
  const tbl = await getTable()
  await tbl.delete(`rid = ${rid}`)
}

export async function getCount(): Promise<number> {
  const tbl = await getTable()
  return await tbl.countRows()
}

export async function closeLanceConnection(): Promise<void> {
  table = null
  connection = null
}
