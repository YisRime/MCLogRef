import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, renameSync, readFileSync } from 'fs'
import { getConfig } from '../utils/config'
import { createReport, createFile, createTag, updateReport, getReportByName, incrementStat } from '../utils/database/sqlite'
import { extractTags, chunkText, detectFileType } from '../utils/extract'
import { embedBatch } from '../utils/llama'
import { insertVectors, type VectorRecord } from '../utils/database/lance'

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event)
    if (!formData?.length) return { status: 400, data: { message: 'No File Uploaded' } }
    const file = formData[0]
    if (!file?.filename) return { status: 400, data: { message: 'No Filename' } }
    const filename = file.filename
    console.log(`[API] 上传文件：${filename}`)
    setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' })
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        const send = (message: string, done = false, extra = {}) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 200, data: { message, done, ...extra } })}\n\n`)) }
        try {
          const dataDir = getConfig('dataDir')
          const tempDir = join(dataDir, 'temp')
          const userDir = join(dataDir, 'files', 'user')
          if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
          if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true })
          send(`${filename} 保存中...`)
          const tempPath = join(tempDir, filename)
          writeFileSync(tempPath, file.data)
          send('解析信息中...')
          const existing = getReportByName(filename)
          if (existing) {
            send(`${filename} 已存在`, true, { id: existing.id, name: existing.name })
            return
          }
          const content = readFileSync(tempPath, 'utf-8')
          const fileType = detectFileType(filename, filename)
          const rid = createReport(filename)
          createFile(rid, filename, fileType, content)
          send('提取标签中...')
          const tags = extractTags({ name: filename, files: [{ name: filename, type: fileType, content }], filePath: [filename] })
          for (const tag of tags.version) createTag(rid, 'version', tag)
          for (const tag of tags.loader) createTag(rid, 'loader', tag)
          for (const tag of tags.error) createTag(rid, 'error', tag)
          for (const tag of tags.mod) createTag(rid, 'mod', tag)
          send('向量化中...')
          const meta: Record<string, string> = { type: fileType }
          if (tags.version[0]) meta.version = tags.version[0]
          if (tags.loader[0]) meta.loader = tags.loader[0]
          if (tags.error[0]) meta.error = tags.error[0]
          const chunks = chunkText(content, meta)
          console.log(`[API] 向量化 ${filename} 中（共 ${chunks.length} 个）`)
          for (let i = 0; i < chunks.length; i += 16) {
            const batch = chunks.slice(i, i + 16)
            const texts = batch.map(c => c.text)
            const vectors = await embedBatch(texts)
            const records: VectorRecord[] = batch.map((chunk, idx) => ({ id: Date.now() * 1000 + i + idx, rid, meta: chunk.meta, text: chunk.text, vector: vectors[idx] ?? [] }))
            await insertVectors(records)
          }
          renameSync(tempPath, join(userDir, filename))
          updateReport(rid, { status: 2 })
          incrementStat('user_uploads')
          console.log(`[API] ${filename} 上传完成，ID 为 ${rid}`)
          send('预处理完成', true, { id: rid, name: filename })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload Failed'
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 500, data: { message } })}\n\n`))
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
