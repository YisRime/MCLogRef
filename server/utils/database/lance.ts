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

function getDbPath(): string {
  const dataDir = getConfig('dataDir')
  return join(dataDir, 'reports')
}

export async function getLanceConnection(): Promise<Connection> {
  if (connection) return connection
  try {
    const path = getDbPath()
    const dir = getConfig('dataDir')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    console.log(`[LanceDB] 初始化数据库: ${path}`)
    connection = await connect(path)
    return connection
  } catch (err) {
    console.log('[LanceDB] 初始化失败：', err)
    throw err
  }
}

export async function getTable(): Promise<Table> {
  if (table) return table
  try {
    const conn = await getLanceConnection()
    const tableNames = await conn.tableNames()
    if (tableNames.includes('vectors')) {
      table = await conn.openTable('vectors')
    } else {
      table = await conn.createTable('vectors', [
        {
          id: 0, rid: 0, meta: {}, text: '',
          vector: new Array(768).fill(0),
        },
      ])
    }
    return table
  } catch (err) {
    console.log('[LanceDB] 表获取失败：', err)
    throw err
  }
}

export async function insertVectors(records: VectorRecord[]): Promise<void> {
  try {
    const tbl = await getTable()
    await tbl.add(records as unknown as Record<string, unknown>[])
  } catch (err) {
    console.log('[LanceDB] 向量创建失败：', err)
    throw err
  }
}

export async function searchVectors(vector: number[], limit: number = 5, filter?: string): Promise<VectorRecord[]> {
  try {
    const tbl = await getTable()
    let query = tbl.query().nearestTo(vector).limit(limit)
    if (filter) query = query.where(filter)
    const results = await query.toArray()
    return results as unknown as VectorRecord[]
  } catch (err) {
    console.log('[LanceDB] 向量搜索失败：', err)
    throw err
  }
}

export async function searchByMetadata(filter: string, limit: number = 100): Promise<VectorRecord[]> {
  try {
    const tbl = await getTable()
    const results = await tbl.query().where(filter).limit(limit).toArray()
    return results as unknown as VectorRecord[]
  } catch (err) {
    console.log('[LanceDB] 数据搜索失败：', err)
    throw err
  }
}

export async function deleteByReport(rid: number): Promise<void> {
  try {
    const tbl = await getTable()
    await tbl.delete(`rid = ${rid}`)
  } catch (err) {
    console.log(`[LanceDB] 删除 ${rid} 失败：`, err)
    throw err
  }
}

export async function getCount(): Promise<number> {
  try {
    const tbl = await getTable()
    return await tbl.countRows()
  } catch (err) {
    console.log('[LanceDB] 状态获取失败：', err)
    return 0
  }
}

export async function closeLanceConnection(): Promise<void> {
  table = null
  connection = null
}
