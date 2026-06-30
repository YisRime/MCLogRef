import os from 'os'
import { execSync } from 'child_process'
import { getCount } from '../utils/database/lance'
import { getGlobalCounts, getStat, incrementStat } from '../utils/database/sqlite'
import { getConfig } from '../utils/config'

function getDirectorySize(path: string) {
  try {
    if (os.platform() === 'win32') {
      const output = execSync(`dir /s "${path}" | findstr "bytes" | findstr /v "free"`).toString()
      const matches = output.match(/(\d[\d,]*)\s+bytes/)
      return matches ? parseInt(matches[1]!.replace(/,/g, ''), 10) : 0
    } else {
      const output = execSync(`du -sb "${path}"`).toString()
      return parseInt(output.split('\t')[0]!, 10)
    }
  } catch {
    return 0
  }
}

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') incrementStat('visits')
  const dbCounts = getGlobalCounts()
  const vectorCount = await getCount().catch(() => 0)
  const memoryUsage = process.memoryUsage()
  const cpuLoad = os.loadavg()
  const dataDir = getConfig('dataDir')
  const diskUsage = getDirectorySize(dataDir)
  const data = {
    reports: {
      total: dbCounts.reports,
      userUploaded: dbCounts.userReports,
      adminImported: dbCounts.adminReports,
    },
    files: { total: dbCounts.files },
    vectors: { total: vectorCount },
    metrics: {
      visits: getStat('visits'),
      analyses: getStat('analyses'),
      userUploads: getStat('user_uploads'),
    },
    system: {
      memory: {
        rss: memoryUsage.rss, heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed, external: memoryUsage.external,
      },
      cpu: { load: cpuLoad, cores: os.cpus().length },
      disk: { dataDirSize: diskUsage },
    },
  }
  return { status: 200, data }
})
