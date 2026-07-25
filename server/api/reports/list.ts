import { getReports } from '../../utils/database/sqlite'

export default defineEventHandler((event) => {
  try {
    const page = Math.max(1, Number(getQuery(event).page) || 1)
    return { status: 200, data: getReports(100, (page - 1) * 100) }
  } catch {
    return { status: 500, data: { message: 'Getting List Failed' } }
  }
})
