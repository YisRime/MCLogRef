import { join } from 'path'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { readFileGroup, extractTags, chunkText, scanDirectory } from '../../utils/extract'
import { getReportByName, createReport, createFile, createTag, updateReport, deleteReport } from '../../utils/database/sqlite'
import { getConfig } from '../../utils/config'
import { embedBatch } from '../../utils/llama'
import { insertVectors, deleteByReport, type VectorRecord } from '../../utils/database/lance'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ dir?: string }>(event).catch(() => ({ dir: undefined }))
  const dataDir = getConfig('dataDir')
  const scanPath = body.dir ?? join(dataDir, 'temp')
  setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' })
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (message: string, done = false, extra = {}) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 200, data: { message, done, ...extra } })}\n\n`)) }
      try {
        const adminDir = join(dataDir, 'files', 'admin')
        if (!existsSync(adminDir)) mkdirSync(adminDir, { recursive: true })
        const scannedGroups = await scanDirectory(scanPath)
        send(`扫描完成，共 ${scannedGroups.length} 项`, false, { total: scannedGroups.length })
        const validations: Array<{ name: string; valid: boolean; filePaths: string[] }> = []
        for (let index = 0; index < scannedGroups.length; index++) {
          const item = scannedGroups[index]!
          const hasOriginal = item.filePaths.some((filepath: string) => !filepath.endsWith('.json'))
          if (!hasOriginal) {
            validations.push({ name: item.name, valid: false, filePaths: item.filePaths })
            continue
          }
          try {
            const fileGroup = await readFileGroup(item.filePaths, scanPath)
            validations.push({ name: item.name, valid: !!fileGroup.solution?.has_solution, filePaths: item.filePaths })
          } catch {
            validations.push({ name: item.name, valid: false, filePaths: item.filePaths })
          }
          if ((index + 1) % 100 === 0 || index === scannedGroups.length - 1) send(`校验中: ${index + 1}/${scannedGroups.length}`)
        }
        const validItems = validations.filter(validation => validation.valid)
        const invalidItems = validations.filter(validation => !validation.valid)
        const invalidCount = invalidItems.length
        send(`校验完成，有效 ${validItems.length} 项`, false, { valid: validItems.length, invalid: invalidCount })
        const otherDir = join(dataDir, 'files', 'other')
        if (!existsSync(otherDir)) mkdirSync(otherDir, { recursive: true })
        for (const invalid of invalidItems) {
          for (const filePath of invalid.filePaths) {
            const sourcePath = join(scanPath, filePath)
            const destPath = join(otherDir, filePath)
            if (existsSync(sourcePath)) renameSync(sourcePath, destPath)
          }
        }
        if (validItems.length === 0) return
        let successCount = 0
        let skippedCount = 0
        let failedCount = 0
        for (let offset = 0; offset < validItems.length; offset += 4) {
          const batch = validItems.slice(offset, offset + 4)
          const results = await Promise.allSettled(batch.map(async (item) => {
            const fileGroup = await readFileGroup(item.filePaths, scanPath)
            const existing = getReportByName(fileGroup.name)
            if (existing) {
              if (existing.status === 1 || existing.status === 2) return { status: 'skipped' }
              deleteReport(existing.id)
              await deleteByReport(existing.id)
            }
            const reportId = createReport(fileGroup.name)
            updateReport(reportId, { status: 0 })
            const tags = extractTags(fileGroup)
            for (const tag of tags.version) createTag(reportId, 'version', tag)
            for (const tag of tags.loader) createTag(reportId, 'loader', tag)
            for (const tag of tags.error) createTag(reportId, 'error', tag)
            for (const tag of tags.mod) createTag(reportId, 'mod', tag)
            for (const file of fileGroup.files) createFile(reportId, file.name, file.type, file.content)
            if (fileGroup.solution) updateReport(reportId, { solution: fileGroup.solution.solution })
            const chunks: Array<{ text: string; meta: Record<string, string> }> = []
            for (const file of fileGroup.files) {
              const meta: Record<string, string> = { type: file.type }
              if (tags.version[0]) meta.version = tags.version[0]
              if (tags.loader[0]) meta.loader = tags.loader[0]
              if (tags.error[0]) meta.error = tags.error[0]
              chunks.push(...chunkText(file.content, meta))
            }
            for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 16) {
              const chunkBatch = chunks.slice(chunkIndex, chunkIndex + 16)
              const texts = chunkBatch.map(chunk => chunk.text)
              const vectors = await embedBatch(texts)
              const records: VectorRecord[] = chunkBatch.map((chunk, idx) => ({ id: Date.now() * 1000 + chunkIndex + idx, rid: reportId, meta: chunk.meta, text: chunk.text, vector: vectors[idx] ?? [] }))
              await insertVectors(records)
              if ((chunkIndex + 16) % 160 === 0 || chunkIndex + 16 >= chunks.length) send(`向量化 ${fileGroup.name}: ${Math.min(chunkIndex + 16, chunks.length)}/${chunks.length} 块`, false, { reportName: fileGroup.name, currentChunk: Math.min(chunkIndex + 16, chunks.length), totalChunks: chunks.length })
            }
            for (const filePath of item.filePaths) {
              const sourcePath = join(scanPath, filePath)
              const destPath = join(adminDir, filePath)
              if (existsSync(sourcePath)) renameSync(sourcePath, destPath)
            }
            updateReport(reportId, { status: 1 })
            return { status: 'success' }
          }))
          for (const result of results) {
            if (result.status === 'fulfilled') {
              if (result.value.status === 'success') successCount++
              else if (result.value.status === 'skipped') skippedCount++
            } else {
              failedCount++
            }
          }
          if ((offset + batch.length) % 100 === 0 || offset + batch.length === validItems.length) send(`处理中: ${offset + batch.length}/${validItems.length}`, false, { current: offset + batch.length, total: validItems.length, success: successCount, skipped: skippedCount, failed: failedCount })
        }
        send(`导入完成，成功 ${successCount} 项（跳过 ${skippedCount} 项，失败 ${failedCount} 项）`, true, { success: successCount, skipped: skippedCount, failed: failedCount })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import Failed'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 500, data: { message } })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no'  } })
})
