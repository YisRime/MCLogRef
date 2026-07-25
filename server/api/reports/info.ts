import { getReport, getFilesByReport, getTagsByReport, getFile } from '../../utils/database/sqlite'

export default defineEventHandler((event) => {
  try {
    const query = getQuery(event)
    const id = Number(query.id)
    if (isNaN(id)) return { status: 400, data: { message: 'Validating Report ID' } }
    if (query.content === 'true') {
      const fileId = Number(query.fileId)
      if (isNaN(fileId)) return { status: 400, data: { message: 'Missing File ID' } }
      const file = getFile(fileId)
      if (!file) return { status: 404, data: { message: 'Finding File Failed' } }
      if (file.rid !== id) return { status: 403, data: { message: 'Accessing File Denied' } }
      return { status: 200, data: file }
    }
    const report = getReport(id)
    if (!report) return { status: 404, data: { message: 'Finding Report Failed' } }
    const files = getFilesByReport(id).map(({ id, rid, file, type }) => ({ id, rid, file, type }))
    return { status: 200, data: { ...report, files, tags: getTagsByReport(id) } }
  } catch {
    return { status: 500, data: { message: 'Getting Info Failed' } }
  }
})
