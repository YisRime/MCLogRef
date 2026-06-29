import { getReport, getFilesByReport, getTagsByReport } from '../../utils/database/sqlite'

export default defineEventHandler((event) => {
  const id = Number(getQuery(event).id)
  if (isNaN(id)) return { status: 400, data: { message: 'Invalid Report Id' } }
  const report = getReport(id)
  if (!report) return { status: 404, data: { message: 'Report Not Found' } }
  const files = getFilesByReport(id)
  const tags = getTagsByReport(id)
  return { status: 200, data: { ...report, files, tags } }
})
