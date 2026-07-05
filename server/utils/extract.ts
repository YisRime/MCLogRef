import { readFile, readdir, stat } from 'fs/promises'
import { join, extname, basename } from 'path'
import JSZip from 'jszip'
import { getConfig } from './config'

export interface FileGroup {
  name: string
  files: GroupFile[]
  chat?: ChatRecord
  solution?: SolutionRecord
  filePath: string[]
}

export interface GroupFile {
  name: string
  type: 'crash' | 'gamelog' | 'log' | 'discuss' | 'other'
  content: string
}

export interface ChatRecord {
  recordId: string
  uploaderId: string
  messages: Array<{ content: string; userId: string }>
}

export interface SolutionRecord {
  has_solution: boolean
  solution: string
}

export interface ExtractedTags {
  version: string[]
  loader: string[]
  error: string[]
  mod: string[]
}

export interface TextChunk {
  text: string
  meta: Record<string, string>
  priority: number
}

function extractGroupKey(filepath: string): string {
  const base = basename(filepath)
  const lower = base.toLowerCase()
  if (lower.endsWith('.solution.json')) return base.slice(0, -14)
  if (lower.endsWith('.json')) return base.slice(0, -5)
  return base.replace(/\.zip$/i, '')
}

export function identifyFileGroup(files: string[]): string[][] {
  const groups: Map<string, string[]> = new Map()
  for (const file of files) {
    const key = extractGroupKey(file)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(file)
  }
  return Array.from(groups.values())
}

const FILE_TYPE_RULES: Array<{ test: (name: string) => boolean; type: GroupFile['type'] }> = [
  {
    test: (n) => /^crash-\d{4}-\d{2}-\d{2}_\d{2}\.\d{2}\.\d{2}-/.test(n) || n.startsWith('crash-'),
    type: 'crash',
  },
  {
    test: (n) => n.toLowerCase() === 'latest.log' || n.toLowerCase() === 'minecraft.log',
    type: 'gamelog',
  },
  {
    test: (n) => n.endsWith('.log') || n.startsWith('hs_err_pid'),
    type: 'log',
  },
  {
    test: (n) => n.includes('启动器') || n.includes('launcher') || n === 'hmcl.log',
    type: 'log',
  },
  {
    test: (n) =>
      n.endsWith('.txt') &&
      (n.includes('崩溃前') || n.includes('游戏') || n.includes('output')),
    type: 'log',
  },
]

function detectFileType(filename: string, groupBaseName: string): GroupFile['type'] {
  const lower = filename.toLowerCase()
  if (filename === `${groupBaseName}.json`) return 'discuss'
  for (const rule of FILE_TYPE_RULES) if (rule.test(filename) || rule.test(lower)) return rule.type
  if (lower.endsWith('.txt')) return 'other'
  return 'other'
}

function normalizeSolution(raw: unknown): SolutionRecord {
  if (typeof raw === 'string') return { has_solution: true, solution: raw }
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>
    return { has_solution: obj.has_solution === true, solution: typeof obj.solution === 'string' ? obj.solution : '' }
  }
  return { has_solution: false, solution: '' }
}

export async function readFileGroup(filePaths: string[], basePath: string): Promise<FileGroup> {
  const contentFiles: GroupFile[] = []
  let chat: ChatRecord | undefined
  let solution: SolutionRecord | undefined
  const groupBaseName = extractGroupKey(filePaths[0]!)
  for (const filePath of filePaths) {
    const fullPath = join(basePath, filePath)
    const base = basename(filePath)
    const ext = extname(filePath).toLowerCase()
    if (ext === '.json') {
      try {
        const content = await readFile(fullPath, 'utf-8')
        const json = JSON.parse(content)
        if (base === `${groupBaseName}.solution.json` || json.has_solution !== undefined) {
          solution = normalizeSolution(json)
          continue
        }
        if (base === `${groupBaseName}.json` && json.recordId && json.messages) {
          chat = json as ChatRecord
          contentFiles.push({ name: base, type: 'discuss', content })
          continue
        }
      } catch { /* Ignore */ }
    }
    if (ext === '.zip') {
      const zipFiles = await readZipFile(fullPath)
      for (const zf of zipFiles) {
        if (zf.name.endsWith('.solution.json')) {
          try { solution = normalizeSolution(JSON.parse(zf.content)) } catch { /* Ignore */ }
          continue
        }
        contentFiles.push(zf)
      }
      continue
    }
    if (/\.(png|jpg|jpeg|gif|bmp)$/i.test(ext)) continue
    try {
      const content = await readFile(fullPath, 'utf-8')
      const fileType = detectFileType(base, groupBaseName)
      contentFiles.push({ name: base, type: fileType, content })
    } catch { /* Ignore */ }
  }
  console.log(`[Extract] 文件组 ${groupBaseName} 读取到文件数：${contentFiles.length}`)
  return { name: groupBaseName, files: contentFiles, chat, solution, filePath: filePaths }
}

async function readZipFile(zipPath: string): Promise<GroupFile[]> {
  const data = await readFile(zipPath)
  const zip = await JSZip.loadAsync(data)
  const files: GroupFile[] = []
  const zipBaseName = basename(zipPath).replace(/\.zip$/i, '')
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const content = await entry.async('string')
    const base = basename(path)
    const fileType = detectFileType(base, zipBaseName)
    files.push({ name: base, type: fileType, content })
  }
  return files
}

export async function readDirectory(dirPath: string): Promise<FileGroup[]> {
  const entries = await readdir(dirPath)
  const groups: FileGroup[] = []
  const topLevelFiles: string[] = []
  const subDirs: Map<string, string[]> = new Map()
  for (const entry of entries) {
    const fullPath = join(dirPath, entry)
    const stats = await stat(fullPath)
    if (stats.isDirectory()) {
      const subFiles = await readdir(fullPath)
      subDirs.set(entry, subFiles.map(f => join(entry, f)))
    } else {
      if (entry.endsWith('.zip')) {
        try {
          const group = await readFileGroup([entry], dirPath)
          groups.push(group)
        } catch { /* Ignore */ }
      } else {
        topLevelFiles.push(entry)
      }
    }
  }
  const groupedTopLevel = identifyFileGroup(topLevelFiles)
  for (const group of groupedTopLevel) {
    const fileGroup = await readFileGroup(group, dirPath)
    groups.push(fileGroup)
  }
  for (const [dirName, files] of subDirs.entries()) {
    const fileGroup = await readFileGroup(files, dirPath)
    fileGroup.filePath = [dirName]
    groups.push(fileGroup)
  }
  console.log(`[Extract] 目录 ${dirPath} 读取到文件组数：${groups.length}`)
  return groups
}

const VERSION_PATTERNS = [/Minecraft(?:\s+Version)?(?:\s+ID)?[\s:]+([\d.]+(?:-pre\d+)?(?:-rc\d+)?)/i]

const LOADER_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /Fabric\s+Loader\s+([\d.]+)/i, name: 'Fabric' },
  { pattern: /NeoForge/i, name: 'NeoForge' },
  { pattern: /Forge/i, name: 'Forge' },
  { pattern: /Quilt\s+Loader/i, name: 'Quilt' },
  { pattern: /Quilt/i, name: 'Quilt' },
  { pattern: /FML\s+v?[\d.]+.+/i, name: 'Forge' },
  { pattern: /MCP\s+v[\d.]+\s+FML\s+v[\d.]+/i, name: 'Forge' },
  { pattern: /net\.minecraftforge\./i, name: 'Forge' },
  { pattern: /net\.fabricmc\./i, name: 'Fabric' },
  { pattern: /net\.neoforged\./i, name: 'NeoForge' },
  { pattern: /org\.quiltmc\./i, name: 'Quilt' },
  { pattern: /fml,forge/i, name: 'Forge' },
  { pattern: /LaunchWrapper/i, name: 'Forge' },
  { pattern: /Forge Mod Loader/i, name: 'Forge' },
]

const MANIFEST_LOADER_PATTERNS: Array<{ pattern: RegExp; loader: string }> = [
  { pattern: /[Ff]abric/i, loader: 'Fabric' },
  { pattern: /[Ff]orge/i, loader: 'Forge' },
  { pattern: /[Nn]eo[Ff]orge/i, loader: 'NeoForge' },
  { pattern: /[Qq]uilt/i, loader: 'Quilt' },
]

const ERROR_PATTERNS = [
  /(?:^Description:\s*)(.+)$/m,
  /^([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*(?:Exception|Error|Throwable))/m,
  /(?:Caused by|Exception in thread|Error:)\s*[^:]*:\s*([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*(?:Exception|Error|Throwable))/,
  /^([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*(?:Exception|Error|Throwable)):\s*.+$/m,
]

const MOD_PACKAGE_PATTERN = /(?:^|\s)(?:at\s+|at |knot\/\/)([a-z][\w]*(?:\.[a-z][\w]*){2,})\./gm

const OFFICIAL_PACKAGES = [
  'net.minecraft', 'net.minecraftforge', 'net.minecraftforge.fml', 'net.fabricmc', 
  'net.neoforged', 'org.quiltmc', 'com.mojang', 'com.google', 'java.', 'javax.', 
  'sun.', 'jdk.', 'org.apache', 'org.objectweb', 'io.netty', 'com.google.gson', 
  'org.lwjgl', 'org.spongepowered', 'net.minecraft.launchwrapper', 'cpw.mods', 
  'org.openjdk', 'it.unimi.dsi', 'com.electronwill',
]

function addUniqueTag(arr: string[], val: string | null | undefined) {
  if (val && !arr.includes(val)) arr.push(val)
}

export function extractTags(group: FileGroup): ExtractedTags {
  const tags: ExtractedTags = { version: [], loader: [], error: [], mod: [] }
  const allContent = group.files.map(f => f.content).join('\n')
  for (const file of group.files) {
    for (const { pattern, loader } of MANIFEST_LOADER_PATTERNS) if (pattern.test(file.name)) addUniqueTag(tags.loader, loader)
    const vMatch = file.name.match(/^(\d+\.\d+(?:\.\d+)?)/)
    if (vMatch?.[1]) addUniqueTag(tags.version, vMatch[1])
  }
  for (const pattern of VERSION_PATTERNS) {
    const match = allContent.match(pattern)
    if (match?.[1]) addUniqueTag(tags.version, match[1])
  }
  const logVersionMatch = allContent.match(/Loading Minecraft\s+([\d.]+(?:-pre\d+)?(?:-rc\d+)?)/i)
  if (logVersionMatch?.[1]) addUniqueTag(tags.version, logVersionMatch[1])
  const detectedLoaders = new Set<string>(tags.loader)
  for (const { pattern, name } of LOADER_PATTERNS) if (pattern.test(allContent)) detectedLoaders.add(name)
  if (detectedLoaders.has('NeoForge') && detectedLoaders.has('Forge')) detectedLoaders.delete('Forge')
  tags.loader = Array.from(detectedLoaders)
  for (const pattern of ERROR_PATTERNS) {
    const match = allContent.match(pattern)
    if (match?.[1]) addUniqueTag(tags.error, match[1].trim())
  }
  const modPackages = new Set<string>()
  const seen = new Set<string>()
  let modMatch: RegExpExecArray | null
  MOD_PACKAGE_PATTERN.lastIndex = 0
  while ((modMatch = MOD_PACKAGE_PATTERN.exec(allContent)) !== null) {
    const pkg = modMatch[1]
    if (pkg && !seen.has(pkg)) {
      seen.add(pkg)
      const isOfficial = OFFICIAL_PACKAGES.some(op => pkg.startsWith(op))
      if (!isOfficial) modPackages.add(pkg.split('.').slice(0, 3).join('.'))
    }
  }
  const suspectedMatch = allContent.match(/Suspected\s+Mods?:\s*(.+)/i)
  if (suspectedMatch?.[1]) {
    const mods = suspectedMatch[1].split(/,\s*/).map(m => m.replace(/\s*\([^)]+\)/, '').trim()).filter(Boolean)
    for (const mod of mods) addUniqueTag(tags.mod, mod)
  }
  tags.mod.push(...Array.from(modPackages))
  console.log(`[Extract] ${group.name} 提取到标签：version = ${tags.version}, loader = ${tags.loader}, error = ${tags.error}, mod = ${tags.mod.length}`)
  return tags
}

const ERROR_KEYWORDS = /Exception|Error|WARN|FATAL|Crash|Ticking|Render/i
const TIME_PATTERN = /^\[\d{2}:\d{2}:\d{2}(?:\.\d+)?\]|^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?\]/

function findSectionBoundaries(lines: string[]): Array<{ start: number; end: number; priority: number }> {
  const sections: Array<{ start: number; end: number; priority: number }> = []
  const sectionHeaderPattern = /^(?:----|--)\s*(.+?)\s*(?:----|--)\s*$/
  const customMarkers = [
    { pattern: /^A detailed walkthrough/i, priority: 1 },
    { pattern: /^FML:|^States:/i, priority: 2 },
    { pattern: /^\| State \| ID/i, priority: 2 },
    { pattern: /^Mod List:/i, priority: 2 },
    { pattern: /^ModLauncher/i, priority: 3 },
    { pattern: /^(?:UCHIJAAAA|UCHIJ|UCHIJA|UCHIJE)\t/i, priority: 2 },
    { pattern: /^Suspected Mods?:/i, priority: 2 },
    { pattern: /^Mixins in Stacktrace:/i, priority: 2 },
    { pattern: /^Loaded Shaderpack:/i, priority: 2 },
    { pattern: /^-- MOD\s+/i, priority: 1 },
    { pattern: /^\s*Mod\s+File:/i, priority: 1 },
  ]
  let current: { start: number; priority: number } | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] || ''
    let foundPriority = 0
    const match = line.match(sectionHeaderPattern)
    if (match?.[1]) {
      const header = match[1].toLowerCase()
      if (/crash|error|entity|walkthrough|head/.test(header)) foundPriority = 1
      else if (/details|mixin|shader|mod|states/.test(header)) foundPriority = 2
      else foundPriority = 3
    } else {
      for (const m of customMarkers) if (m.pattern.test(line)) { foundPriority = m.priority; break }
    }
    if (foundPriority > 0) {
      if (current) {
        let end = i - 1
        while (end > current.start && !(lines[end] || '').trim()) end--
        sections.push({ ...current, end })
      }
      current = { start: i, priority: foundPriority }
    }
  }
  if (current) sections.push({ ...current, end: lines.length - 1 })
  return sections
}

function getPriority(basePriority: number | undefined, errorCount: number, lines: number): number {
  if (basePriority === 1 || errorCount > lines * 0.1 || errorCount > 5) return 1
  if (basePriority === 2 || errorCount > 0) return 2
  return 3
}

function chunkLogText(lines: string[], meta: Record<string, string>, basePriority?: number): TextChunk[] {
  const { textChunk, chunkOffset } = getConfig()
  const lowerBound = textChunk - chunkOffset
  const upperBound = textChunk + chunkOffset
  const chunks: TextChunk[] = []
  let buf: string[] = [], len = 0, errs = 0
  for (const line of lines) {
    const isNew = TIME_PATTERN.test(line)
    if ((len >= lowerBound && isNew) || len >= upperBound) {
      chunks.push({ text: buf.join('\n'), priority: getPriority(basePriority, errs, buf.length), meta: { ...meta, has_errors: errs > 0 ? 'true' : 'false' } })
      buf = []; len = 0; errs = 0
    }
    buf.push(line); len += line.length + 1
    if (ERROR_KEYWORDS.test(line)) errs++
  }
  if (buf.length) chunks.push({ text: buf.join('\n'), priority: getPriority(basePriority, errs, buf.length), meta: { ...meta, has_errors: errs > 0 ? 'true' : 'false' } })
  return chunks
}

function optimizeChunks(chunks: TextChunk[]): TextChunk[] {
  const { textChunk, chunkOffset } = getConfig()
  const maxSafeLen = textChunk + chunkOffset
  const result: TextChunk[] = []
  let curr: TextChunk | null = null
  for (const chunk of chunks) {
    if (!chunk.text.trim()) continue
    if (curr && curr.priority === chunk.priority && curr.text.length + chunk.text.length < maxSafeLen) {
      curr.text += '\n' + chunk.text
    } else {
      if (curr) result.push(curr)
      curr = { ...chunk }
    }
  }
  if (curr) result.push(curr)
  return result.flatMap(c => {
    if (c.text.length <= textChunk + chunkOffset * 2) return [c]
    const parts: TextChunk[] = []
    let text = c.text
    while (text.length > 0) {
      parts.push({ text: text.slice(0, textChunk), priority: c.priority, meta: c.meta })
      text = text.slice(textChunk)
    }
    return parts
  })
}

export function chunkText(content: string, meta: Record<string, string> = {}): TextChunk[] {
  const lines = content.split('\n')
  const sections = findSectionBoundaries(lines)
  const chunks: TextChunk[] = []
  if (sections.length === 0) return optimizeChunks(chunkLogText(lines, meta))
  if (sections[0]!.start > 0) chunks.push(...chunkLogText(lines.slice(0, sections[0]!.start), meta))
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]!
    chunks.push(...chunkLogText(lines.slice(s.start, s.end + 1), meta, s.priority))
    const nextStart = sections[i + 1]?.start ?? lines.length
    if (s.end + 1 < nextStart) chunks.push(...chunkLogText(lines.slice(s.end + 1, nextStart), meta))
  }
  return optimizeChunks(chunks)
}
