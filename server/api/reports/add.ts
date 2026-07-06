import { join } from 'path'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { readDirectory, extractTags } from '../../utils/extract'
import { createReport, createFile, createTag, updateReport, getReportByName } from '../../utils/database/sqlite'
import { vectorizeAndStore } from '../../utils/llama'
import { getConfig } from '../../utils/config'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody<{ dir?: string }>(event)
    const dataDir = getConfig('dataDir')
    const scanDir = body?.dir ?? join(dataDir, 'temp')
    const adminDir = join(dataDir, 'files', 'admin')
    console.log(`[API] 开始导入：${scanDir}`)
    setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
    const stream = new ReadableStream({
      async start(controller) {
        const send = (message: string, done = false, extra = {}) => controller.enqueue(`data: ${JSON.stringify({ status: 200, data: { message, done, ...extra } })}\n\n`)
        try {
          if (!existsSync(adminDir)) mkdirSync(adminDir, { recursive: true })
          const groups = await readDirectory(scanDir)
          const results: Array<{ id: number; name: string }> = []
          send(`扫描完成，共计 ${groups.length} 项`)
          for (let i = 0; i < groups.length; i++) {
            const group = groups[i]!
            if (!group.solution || group.solution.has_solution !== true) {
              send(`[${i + 1}/${groups.length}]${group.name} 无方案`)
              continue
            }
            if (getReportByName(group.name)) {
              send(`[${i + 1}/${groups.length}]${group.name} 已存在`)
              continue
            }
            send(`[${i + 1}/${groups.length}]处理 ${group.name} 中...`)
            const rid = createReport(group.name)
            const tags = extractTags(group)
            for (const tag of tags.version) createTag(rid, 'version', tag)
            for (const tag of tags.loader) createTag(rid, 'loader', tag)
            for (const tag of tags.error) createTag(rid, 'error', tag)
            for (const tag of tags.mod) createTag(rid, 'mod', tag)
            for (const f of group.files) {
              send(`${f.name} 向量化中...`)
              createFile(rid, f.name, f.type, f.content)
              await vectorizeAndStore(rid, f.content, tags, f.type)
            }
            updateReport(rid, { solution: group.solution.solution, status: 1 })
            for (const root of group.filePath) {
              const src = join(scanDir, root)
              const dest = join(adminDir, root)
              try {
                if (existsSync(src)) renameSync(src, dest)
              } catch (moveErr) {
                console.log(`[API] 移动失败：${root}`, moveErr)
              }
            }
            results.push({ id: rid, name: group.name })
          }
          send(`预处理完成，新增 ${results.length} 项`, true, { imported: results.length, reports: results })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Import Failed'
          controller.enqueue(`data: ${JSON.stringify({ status: 500, data: { message } })}\n\n`)
        } finally {
          controller.close()
        }
      },
    })
    return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request Failed'
    return { status: 500, data: { message } }
  }
})
