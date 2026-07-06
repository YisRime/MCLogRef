import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, renameSync } from 'fs'
import { getConfig } from '../utils/config'
import { createReport, createFile, createTag, updateReport, getReportByName, incrementStat } from '../utils/database/sqlite'
import { extractTags, readFileGroup } from '../utils/extract'
import { vectorizeAndStore } from '../utils/llama'

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event)
    if (!formData || formData.length === 0) return { status: 400, data: { message: 'No File Uploaded' } }
    const file = formData[0]
    if (!file || !file.filename) return { status: 400, data: { message: 'No Filename' } }
    const filename = file.filename
    const fileData = file.data
    console.log(`[API] 上传文件：${filename}`)
    setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
    const stream = new ReadableStream({
      async start(controller) {
        const send = (message: string, done = false, extra = {}) => controller.enqueue(`data: ${JSON.stringify({ status: 200, data: { message, done, ...extra } })}\n\n`)
        try {
          const dataDir = getConfig('dataDir')
          const tempDir = join(dataDir, 'temp')
          const userDir = join(dataDir, 'files', 'user')
          if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
          if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true })
          send(`${filename} 保存中...`)
          const tempPath = join(tempDir, filename)
          writeFileSync(tempPath, fileData)
          send('解析信息中...')
          const group = await readFileGroup([filename], tempDir)
          const existing = getReportByName(group.name)
          if (existing) {
            send(`${group.name} 已存在`, true, { id: existing.id, name: existing.name })
            return
          }
          const rid = createReport(group.name)
          send('提取标签中...')
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
          if (group.solution?.solution) {
            updateReport(rid, { solution: group.solution.solution, status: 1 })
          } else {
            updateReport(rid, { status: 2 })
          }
          for (const root of group.filePath) {
            const src = join(tempDir, root)
            const dest = join(userDir, root)
            if (existsSync(src)) renameSync(src, dest)
          }
          incrementStat('user_uploads')
          console.log(`[API] ${group.name} 上传完成，ID 为 ${rid}`)
          send('预处理完成', true, { id: rid, name: group.name })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload Failed'
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
