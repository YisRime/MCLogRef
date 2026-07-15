import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, renameSync, readFileSync } from 'fs'
import { getConfig } from '../utils/config'
import { createReport, createFile, createTag, updateReport, deleteReport, getReportByName, incrementStat } from '../utils/database/sqlite'
import { detectFileType, decodeFile, extractTags, readZipFile, type FileGroup, type GroupFile } from '../utils/extract'
import { vectorizeFiles } from '../utils/llama'
import { deleteByReport } from '../utils/database/lance'

export default defineEventHandler(async (event) => {
  try {
    const formData = await readMultipartFormData(event)
    if (!formData?.length) return { status: 400, data: { message: 'No File Uploaded' } }
    const file = formData[0]
    if (!file?.filename) return { status: 400, data: { message: 'No File Name' } }
    const filename = file.filename
    console.log(`[API] 上传文件：${filename}`)
    const existing = getReportByName(filename)
    if (existing) return { status: 200, data: { id: existing.id, name: existing.name, skipped: true } }
    const dataDir = getConfig('dataDir')
    const tempDir = join(dataDir, 'temp')
    const userDir = join(dataDir, 'files', 'user')
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
    if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true })
    const tempPath = join(tempDir, filename)
    writeFileSync(tempPath, file.data)
    const files: GroupFile[] = filename.toLowerCase().endsWith('.zip')
      ? await readZipFile(readFileSync(tempPath), filename)
      : [{ name: filename, type: detectFileType(filename, filename), content: decodeFile(readFileSync(tempPath)) }]
    if (files.length === 0) throw new Error('No Valid Files Found')
    const group: FileGroup = { name: filename, files, filePath: [filename] }
    const rid = createReport(filename)
    try {
      const tags = extractTags(group)
      for (const tag of tags.version) createTag(rid, 'version', tag)
      for (const tag of tags.loader) createTag(rid, 'loader', tag)
      for (const tag of tags.error) createTag(rid, 'error', tag)
      for (const tag of tags.mod) createTag(rid, 'mod', tag)
      for (const reportFile of files) createFile(rid, reportFile.name, reportFile.type, reportFile.content)
      await vectorizeFiles(rid, files, tags, filename)
      renameSync(tempPath, join(userDir, filename))
      updateReport(rid, { status: 2 })
    } catch (error) {
      deleteReport(rid)
      await deleteByReport(rid)
      throw error
    }
    incrementStat('user_uploads')
    console.log(`[API] ${filename} 上传完成，ID 为 ${rid}`)
    return { status: 200, data: { id: rid, name: filename } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request Failed'
    return { status: 500, data: { message } }
  }
})
