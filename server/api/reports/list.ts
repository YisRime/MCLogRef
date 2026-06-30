import { getReports } from '../../utils/database/sqlite'

export default defineEventHandler((event) => {
  const page = Math.max(1, Number(getQuery(event).page) || 1)
  return { status: 200, data: getReports(100, (page - 1) * 100) }
})
