import { getConfig, setConfig } from '../utils/config'

export default defineEventHandler(async (event) => {
  try {
    if (event.method === 'GET') return { status: 200, data: getConfig() }
    if (event.method === 'PATCH') {
      const body = await readBody(event)
      if (!body || typeof body !== 'object') return { status: 400, data: { message: 'Validating Request Body' } }
      setConfig(body)
      return { status: 200, data: getConfig() }
    }
    return { status: 405, data: { message: 'Method Not Supported' } }
  } catch {
    return { status: 500, data: { message: 'Processing Config Failed' } }
  }
})
