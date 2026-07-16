import { getConfig, setConfig } from '../utils/config'

export default defineEventHandler(async (event) => {
  try {
    if (event.method === 'GET') return { status: 200, data: getConfig() }
    if (event.method === 'PATCH') {
      const body = await readBody(event)
      if (!body || typeof body !== 'object') return { status: 400, data: { message: '请求正文无效' } }
      setConfig(body)
      return { status: 200, data: getConfig() }
    }
    return { status: 405, data: { message: '请求方法不受支持' } }
  } catch (err) {
    console.error(`[Config] 处理配置请求失败，方法：${event.method}`, err)
    return { status: 500, data: { message: err instanceof Error ? err.message : '配置请求失败' } }
  }
})
