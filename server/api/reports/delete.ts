import { deleteReport } from '../../utils/database/sqlite'
import { deleteByReport } from '../../utils/database/lance'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ ids?: number[] }>(event)
  if (!body?.ids || !Array.isArray(body.ids)) return { status: 400, data: { message: 'Invalid IDs' } }
  try {
    for (const id of body.ids) {
      deleteReport(id)
      await deleteByReport(id)
    }
    return { status: 200, data: { deleted: body.ids.length } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Delete Failed'
    return { status: 500, data: { message } }
  }
})
