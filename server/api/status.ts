import os from 'os'
import { execSync } from 'child_process'
import { getCount } from '../utils/database/lance'
import { getReportCounts, getFileCounts, incrementStat, getStat } from '../utils/database/sqlite'
import { getConfig } from '../utils/config'

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

function getDiskSize(): number {
  try {
    const path = getConfig('dataDir')
    const cmd = os.platform() === 'win32' ? `dir /s "${path}" | findstr "bytes" | findstr /v "free"` : `du -sb "${path}"`
    const output = execSync(cmd).toString()
    if (os.platform() === 'win32') {
      const matches = output.match(/(\d[\d,]*)\s+bytes/)
      return matches ? parseInt(matches[1]!.replace(/,/g, '')) : 0
    }
    return parseInt(output.split('\t')[0]!)
  } catch { return 0 }
}

export default defineEventHandler(async (event) => {
  try {
    if (event.method === 'GET') incrementStat('visits')
    const reports = getReportCounts()
    const files = getFileCounts()
    const vectorCount = await getCount().catch(() => 0)
    const mem = process.memoryUsage()
    return {
      status: 200,
      data: {
        reports, files, vectors: vectorCount,
        visits: getStat('visits'), analyses: getStat('analyses'), uploads: getStat('user_uploads'),
        cpu: os.loadavg()[0]!.toFixed(2), disk: formatBytes(getDiskSize()),
        memory: {
          percent: ((mem.heapUsed / mem.heapTotal) * 100).toFixed(1),
          used: formatBytes(mem.heapUsed), total: formatBytes(mem.heapTotal),
        },
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Get Status Failed'
    return { status: 500, data: { message } }
  }
})
