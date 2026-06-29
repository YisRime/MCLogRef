import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, renameSync } from 'fs'
import { getConfig } from '../utils/config'
import { createReport, createFile, createTag, updateReport, getReportByName } from '../utils/database/sqlite'
import { extractTags, readFileGroup } from '../utils/extract'
import { vectorizeAndStore } from '../utils/llama'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  if (!formData || formData.length === 0) return { status: 400, data: { message: 'No File Uploaded' } }
  const file = formData[0]
  if (!file?.filename) return { status: 400, data: { message: 'No Filename' } }
  try {
    const dataDir = getConfig('dataDir')
    const tempDir = join(dataDir, 'temp')
    const userDir = join(dataDir, 'files', 'user')
    if (!existsSync(tempDir)) mkdirSync(tempDir, { recursive: true })
    if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true })
    const tempPath = join(tempDir, file.filename)
    writeFileSync(tempPath, file.data)
    const group = await readFileGroup([file.filename], tempDir)
    const existing = getReportByName(group.name)
    if (existing) return { status: 200, data: { id: existing.id, name: existing.name, message: 'Report Already Exists' } }
    const rid = createReport(group.name)
    const tags = extractTags(group)
    for (const tag of tags.version) createTag(rid, 'version', tag)
    for (const tag of tags.loader) createTag(rid, 'loader', tag)
    for (const tag of tags.error) createTag(rid, 'error', tag)
    for (const tag of tags.mod) createTag(rid, 'mod', tag)
    for (const f of group.files) {
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
    return { status: 200, data: { id: rid, name: group.name } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload Failed'
    return { status: 500, data: { message } }
  }
})
