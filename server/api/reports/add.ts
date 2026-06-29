import { join } from 'path'
import { readDirectory, extractTags } from '../../utils/extract'
import { createReport, createFile, createTag, updateReport } from '../../utils/database/sqlite'
import { vectorizeAndStore } from '../../utils/llama'
import { getConfig } from '../../utils/config'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ dir?: string }>(event)
  const dir = body?.dir ?? join(getConfig('dataDir'), 'imports')
  try {
    const groups = await readDirectory(dir)
    const results: Array<{ id: number; name: string }> = []
    for (const group of groups) {
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
      results.push({ id: rid, name: group.name })
    }
    return { status: 200, data: { imported: results.length, reports: results } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Import Failed'
    return { status: 500, data: { message } }
  }
})
