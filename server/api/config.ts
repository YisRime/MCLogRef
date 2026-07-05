import { getConfig, setConfig } from '../utils/config'

export default defineEventHandler(async (event) => {
  const method = event.method
  if (method === 'GET') return { status: 200, data: getConfig() }
  if (method === 'PATCH') {
    const body = await readBody(event)
    if (!body || typeof body !== 'object') return { status: 400, data: { message: 'Invalid Request Body' } }
    console.log(`[API] 更新配置：${Object.keys(body)}`)
    setConfig(body)
    return { status: 200, data: getConfig() }
  }
  return { status: 405, data: { message: 'Method Not Allowed' } }
})
