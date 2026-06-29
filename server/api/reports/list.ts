import { getReports } from '../../utils/database/sqlite'

export default defineEventHandler(() => {
  const reports = getReports()
  return { status: 200, data: reports }
})
