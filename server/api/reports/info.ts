import { getReport, getFilesByReport, getTagsByReport } from '../../utils/database/sqlite'

export default defineEventHandler((event) => {
  try {
    const id = Number(getQuery(event).id)
    if (isNaN(id)) return { status: 400, data: { message: '报告 ID 无效' } }
    const report = getReport(id)
    if (!report) return { status: 404, data: { message: '报告不存在' } }
    return { status: 200, data: { ...report, files: getFilesByReport(id), tags: getTagsByReport(id) } }
  } catch (err) {
    console.error(`[Info] 获取报告详情失败，报告 ID：${getQuery(event).id ?? '未知'}`, err)
    return { status: 500, data: { message: err instanceof Error ? err.message : '获取报告详情失败' } }
  }
})
