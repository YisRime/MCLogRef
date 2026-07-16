import { deleteReport } from '../../utils/database/sqlite'
import { deleteByReport } from '../../utils/database/lance'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ ids?: number[] }>(event)
  if (!Array.isArray(body?.ids)) return { status: 400, data: { message: '报告 ID 列表无效' } }
  try {
    for (const id of body.ids) {
      deleteReport(id)
      await deleteByReport(id)
    }
    return { status: 200, data: { deleted: body.ids.length } }
  } catch (err) {
    console.error(`[Delete] 删除报告失败，报告 ID：${body.ids.join(',')}`, err)
    return { status: 500, data: { message: err instanceof Error ? err.message : '删除报告失败' } }
  }
})
