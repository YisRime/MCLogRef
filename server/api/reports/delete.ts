import { deleteReport } from '../../utils/database/sqlite'
import { deleteByReport } from '../../utils/database/lance'

export default defineEventHandler(async (event) => {
  if (getCookie(event, 'auth_token') !== 'verified') return { status: 401, data: { message: 'Unauthorized' } }
  const body = await readBody<{ ids?: number[] }>(event)
  if (!Array.isArray(body?.ids)) return { status: 400, data: { message: 'Validating Report IDs' } }
  try {
    for (const id of body.ids) {
      deleteReport(id)
      await deleteByReport(id)
    }
    return { status: 200, data: { deleted: body.ids.length } }
  } catch {
    return { status: 500, data: { message: 'Deleting Reports Failed' } }
  }
})
