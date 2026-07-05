import { analyzeStream } from '../utils/analyse'
import { incrementStat } from '../utils/database/sqlite'

export default defineEventHandler(async (event) => {
  let rid = Number(getQuery(event).rid)
  if (isNaN(rid)) {
    const body = await readBody<{ rid?: number }>(event).catch(() => null)
    rid = Number(body?.rid)
  }
  if (isNaN(rid) || rid <= 0) return { status: 400, data: { message: 'Invalid Report Id' } }
  console.log(`[API] 开始分析：${rid}`)
  incrementStat('analyses')
  setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of analyzeStream(rid)) controller.enqueue(`data: ${JSON.stringify({ status: 200, data: chunk })}\n\n`)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown Error'
        controller.enqueue(`data: ${JSON.stringify({ status: 500, data: { content: `\nError: ${message}`, done: true } })}\n\n`)
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })
})