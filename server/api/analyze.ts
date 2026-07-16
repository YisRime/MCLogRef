import { analyzeStream } from '../utils/analyse'
import { incrementStat } from '../utils/database/sqlite'

export default defineEventHandler(async (event) => {
  try {
    let rid = Number(getQuery(event).rid)
    if (isNaN(rid)) {
      const body = await readBody<{ rid?: number }>(event).catch(() => null)
      rid = Number(body?.rid)
    }
    if (isNaN(rid) || rid <= 0) return { status: 400, data: { message: '报告 ID 无效' } }
    incrementStat('analyses')
    setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of analyzeStream(rid)) controller.enqueue(`data: ${JSON.stringify({ status: 200, data: chunk })}\n\n`)
        } catch (err) {
          console.error(`[Analyze] 输出分析流失败，报告 ID：${rid}`, err)
          const message = err instanceof Error ? err.message : '未知错误'
          controller.enqueue(`data: ${JSON.stringify({ status: 500, data: { content: `\n错误：${message}`, done: true } })}\n\n`)
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })
  } catch (err) {
    console.error('[Analyze] 处理分析请求失败', err)
    return { status: 500, data: { message: err instanceof Error ? err.message : '分析请求失败' } }
  }
})
