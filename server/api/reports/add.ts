import { join } from 'path'
import { existsSync, mkdirSync, renameSync } from 'fs'
import { readFileGroup, extractTags, scanDirectory } from '../../utils/extract'
import { getReportByName, createReport, createFile, createTag, updateReport, deleteReport } from '../../utils/database/sqlite'
import { getConfig } from '../../utils/config'
import { deleteByReport } from '../../utils/database/lance'
import { vectorizeFiles } from '../../utils/llama'

let importing = false

export default defineEventHandler(async (event) => {
  if (event.method === 'GET') return { status: 200, data: { importing } }
  if (getCookie(event, 'auth_token') !== 'verified') return { status: 401, data: { message: 'Unauthorized' } }
  const body = await readBody<{ action?: 'start' | 'cancel' }>(event).catch(() => ({ action: 'start' as const }))
  if (body.action === 'cancel') {
    importing = false
    return { status: 200, data: { message: 'Cancelling Import Process' } }
  }
  importing = true
  const dataDir = getConfig('dataDir')
  const scanPath = join(dataDir, 'temp')
  setResponseHeaders(event, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' })
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      const send = (message: string, done = false, extra = {}) => { controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 200, data: { message, done, ...extra } })}\n\n`)) }
      try {
        const adminDir = join(dataDir, 'files', 'admin')
        if (!existsSync(adminDir)) mkdirSync(adminDir, { recursive: true })
        const scannedGroups = await scanDirectory(scanPath)
        send(`扫描完成，共 ${scannedGroups.length} 个项目`, false, { total: scannedGroups.length })
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
          } catch (error) {
            console.error('[Add] Validating Project Failed:', error)
            validations.push({ name: item.name, valid: false, filePaths: item.filePaths })
          }
          if ((index + 1) % 100 === 0 || index === scannedGroups.length - 1) send(`正在验证：${index + 1}/${scannedGroups.length}`)
        }
        const validItems = validations.filter(validation => validation.valid)
        const invalidItems = validations.filter(validation => !validation.valid)
        const invalidCount = invalidItems.length
        send(`验证完成，剩 ${validItems.length} 个项目`, false, { valid: validItems.length, invalid: invalidCount })
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
              if (existing.status === 1 || existing.status === 2) {
                for (const filePath of item.filePaths) {
                  const sourcePath = join(scanPath, filePath)
                  const destPath = join(adminDir, filePath)
                  if (existsSync(sourcePath)) renameSync(sourcePath, destPath)
                }
                return { status: 'skipped' }
              }
              deleteReport(existing.id)
              await deleteByReport(existing.id)
            }
            const reportId = createReport(fileGroup.name)
            try {
              updateReport(reportId, { status: 0 })
              const tags = extractTags(fileGroup)
              for (const tag of tags.version) createTag(reportId, 'version', tag)
              for (const tag of tags.loader) createTag(reportId, 'loader', tag)
              for (const tag of tags.error) createTag(reportId, 'error', tag)
              for (const tag of tags.mod) createTag(reportId, 'mod', tag)
              for (const file of fileGroup.files) createFile(reportId, file.name, file.type, file.content)
              if (fileGroup.solution) updateReport(reportId, { solution: fileGroup.solution.solution })
              await vectorizeFiles(reportId, fileGroup.files, tags)
              for (const filePath of item.filePaths) {
                const sourcePath = join(scanPath, filePath)
                const destPath = join(adminDir, filePath)
                if (existsSync(sourcePath)) renameSync(sourcePath, destPath)
              }
              updateReport(reportId, { status: 1 })
              return { status: 'success' }
            } catch (error) {
              await Promise.allSettled([Promise.resolve().then(() => deleteReport(reportId)), deleteByReport(reportId)])
              throw error
            }
          }))
          for (const result of results) {
            if (result.status === 'rejected') {
              failedCount++
              console.error('[Add] Importing Project Failed:', result.reason)
            } else if (result.value.status === 'success') {
              successCount++
            } else if (result.value.status === 'skipped') {
              skippedCount++
            }
          }
          if ((offset + batch.length) % 10 === 0 || offset + batch.length === validItems.length) send(`正在处理：${offset + batch.length}/${validItems.length}`, false, { current: offset + batch.length, total: validItems.length, success: successCount, skipped: skippedCount, failed: failedCount })
          if (!importing) {
            send(`导入终止，成功 ${successCount} 个（跳过 ${skippedCount} 个，失败 ${failedCount} 个）`, true, { cancelled: true, success: successCount, skipped: skippedCount, failed: failedCount })
            return
          }
        }
        send(`导入完成，成功 ${successCount} 个（跳过 ${skippedCount} 个，失败 ${failedCount} 个）`, true, { success: successCount, skipped: skippedCount, failed: failedCount })
      } catch (error) {
        console.error('[Add] Importing Batch Failed:', error)
        const message = error instanceof Error ? error.message : 'Importing Batch Failed'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 500, data: { message } })}\n\n`))
      } finally {
        importing = false
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' } })
})
