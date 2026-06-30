import { getCount } from '../utils/database/lance'

const clients = new Set<(data: string) => void>()

export function broadcast(data: unknown) {
  for (const send of clients) send(`data: ${JSON.stringify({ status: 200, data })}\n\n`)
}

export default defineEventHandler(async (event) => {
  setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
  const stream = new ReadableStream({
    start(controller) {
      const send = (data: string) => controller.enqueue(data)
      clients.add(send)
      const sendStatus = async () => {
        try {
          const count = await getCount()
          send(`data: ${JSON.stringify({ status: 200, data: { vectorCount: count } })}\n\n`)
        } catch { /* Ignore */ }
      }
      sendStatus()
      const interval = setInterval(sendStatus, 10000)
      event.node.req.on('close', () => {
        clearInterval(interval)
        clients.delete(send)
        controller.close()
      })
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })
})
