import { getReports } from '../../utils/database/sqlite'

export default defineEventHandler((event) => {
  try {
    const page = Math.max(1, Number(getQuery(event).page) || 1)
    return { status: 200, data: getReports(100, (page - 1) * 100) }
  } catch (err) {
    console.error(`[List] 获取报告列表失败，页码：${getQuery(event).page ?? 1}`, err)
    return { status: 500, data: { message: err instanceof Error ? err.message : '获取报告列表失败' } }
  }
})
