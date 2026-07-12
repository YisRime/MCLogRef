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

export function extractGroupKey(filepath: string): string {
  const base = basename(filepath)
  if (base.endsWith('.solution.json')) return base.slice(0, -14)
  if (base.endsWith('.json')) return base.slice(0, -5)
  return base
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

export function detectFileType(filename: string, groupBaseName: string): GroupFile['type'] {
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
    try {
      const fullPath = join(basePath, filePath)
      const base = basename(filePath)
      const ext = extname(filePath).toLowerCase()
      if (ext === '.json') {
        try {
          const content = await readFile(fullPath, 'utf-8')
          if (base === `${groupBaseName}.solution.json`) {
            try {
              const json = JSON.parse(content)
              solution = normalizeSolution(json)
            } catch {
              solution = normalizeSolution(content.trim())
            }
            continue
          }
          const json = JSON.parse(content)
          if (json.has_solution !== undefined) {
            solution = normalizeSolution(json)
            continue
          }
          if (base === `${groupBaseName}.json` && json.recordId && json.messages) {
            chat = json as ChatRecord
            contentFiles.push({ name: base, type: 'discuss', content })
            continue
          }
        } catch (err) {
          console.log(`[Extract] 解析 ${filePath} 失败：`, err)
        }
      }
      if (ext === '.zip') {
        try {
          const zipFiles = await readZipFile(fullPath)
          for (const zf of zipFiles) {
            if (zf.name.endsWith('.solution.json')) {
              try {
                const json = JSON.parse(zf.content)
                solution = normalizeSolution(json)
              } catch {
                solution = normalizeSolution(zf.content.trim())
              }
              continue
            }
            contentFiles.push(zf)
          }
        } catch (err) {
          console.log(`[Extract] 读取 ${filePath} 失败：`, err)
        }
        continue
      }
      if (/\.(png|jpg|jpeg|gif|bmp)$/i.test(ext)) continue
      try {
        const content = await readFile(fullPath, 'utf-8')
        const fileType = detectFileType(base, groupBaseName)
        contentFiles.push({ name: base, type: fileType, content })
      } catch (err) {
        console.log(`[Extract] 读取 ${filePath} 失败：`, err)
      }
    } catch (err) {
      console.log(`[Extract] 处理 ${filePath} 失败：`, err)
    }
  }
  return { name: groupBaseName, files: contentFiles, chat, solution, filePath: filePaths }
}

async function readZipFile(zipPath: string): Promise<GroupFile[]> {
  try {
    const data = await readFile(zipPath)
    const zip = await JSZip.loadAsync(data)
    const files: GroupFile[] = []
    const zipBaseName = basename(zipPath).replace(/\.zip$/i, '')
    for (const [path, entry] of Object.entries(zip.files)) {
      if (entry.dir) continue
      try {
        const content = await entry.async('string')
        const base = basename(path)
        const fileType = detectFileType(base, zipBaseName)
        files.push({ name: base, type: fileType, content })
      } catch (err) {
        console.log(`[Extract] 读取 ${path}(ZIP) 失败：`, err)
      }
    }
    return files
  } catch (err) {
    console.log(`[Extract] 加载 ${zipPath} 失败：`, err)
    return []
  }
}

export async function scanDirectory(directoryPath: string): Promise<Array<{ name: string; filePaths: string[] }>> {
  const entries = await readdir(directoryPath)
  const result: Array<{ name: string; filePaths: string[] }> = []
  const topFiles: string[] = []
  const subDirectories: string[] = []
  for (const entry of entries) {
    const fullPath = join(directoryPath, entry)
    const stats = await stat(fullPath)
    if (stats.isDirectory()) {
      subDirectories.push(entry)
    } else {
      topFiles.push(entry)
    }
  }
  const groupedTop = identifyFileGroup(topFiles)
  for (const group of groupedTop) result.push({ name: extractGroupKey(group[0]!), filePaths: group })
  for (const directory of subDirectories) {
    const subFiles = await readdir(join(directoryPath, directory))
    result.push({ name: directory, filePaths: subFiles.map((file: string) => join(directory, file)) })
  }
  return result
}

const VERSION_PATTERNS: Array<{ pattern: RegExp; priority: number }> = [
  { pattern: /Minecraft\s+Version(?:\s+ID)?[\s:]+([\d.]+(?:-pre\d+)?(?:-rc\d+)?)/i, priority: 1 },
  { pattern: /Loading Minecraft\s+([\d.]+(?:-pre\d+)?(?:-rc\d+)?)/i, priority: 1 },
  { pattern: /^--\s*Minecraft\s+Version[\s:]+([\d.]+)/im, priority: 1 },
  { pattern: /Minecraft Version ID:\s+([\d.]+)/i, priority: 1 },
  { pattern: /--fml\.mcVersion[,\s]+([\d.]+)/i, priority: 1 },
  { pattern: /Game version:\s*([\d.]+)/i, priority: 1 },
  { pattern: /Minecraft\s+([\d.]+)\s+Crash Report/i, priority: 1 },
  { pattern: /Loading for game Minecraft\s+([\d.]+)/i, priority: 1 },
  { pattern: /(?:^|\n)Minecraft[\s:]+([\d.]+(?:-pre\d+)?(?:-rc\d+)?)/i, priority: 2 },
  { pattern: /minecraft[_-]([\d.]+)\.jar/i, priority: 3 },
  { pattern: /forge[_-]?([\d.]+)-/i, priority: 4 },
  { pattern: /fabric-loader[_-]?([\d.]+)-/i, priority: 4 },
]

const LOADER_PATTERNS: Array<{ pattern: RegExp; name: string; priority: number }> = [
  { pattern: /NeoForge\s+v?([\d.]+)/i, name: 'NeoForge', priority: 1 },
  { pattern: /Fabric\s+Loader\s+v?([\d.]+)/i, name: 'Fabric', priority: 1 },
  { pattern: /Forge\s+v?([\d.]+)/i, name: 'Forge', priority: 1 },
  { pattern: /Quilt\s+Loader\s+v?([\d.]+)/i, name: 'Quilt', priority: 1 },
  { pattern: /--fml\.neoForgeVersion/i, name: 'NeoForge', priority: 1 },
  { pattern: /--fml\.forgeVersion/i, name: 'Forge', priority: 1 },
  { pattern: /net\.neoforged\.(?:neoforge|fml)/i, name: 'NeoForge', priority: 2 },
  { pattern: /net\.minecraftforge\.(?:fml|common)/i, name: 'Forge', priority: 2 },
  { pattern: /net\.fabricmc\.loader/i, name: 'Fabric', priority: 2 },
  { pattern: /org\.quiltmc\.loader/i, name: 'Quilt', priority: 2 },
  { pattern: /(?:Server|Client) brand changed to 'neoforge'/i, name: 'NeoForge', priority: 2 },
  { pattern: /(?:Server|Client) brand changed to 'forge'/i, name: 'Forge', priority: 2 },
  { pattern: /Known server brands?:\s*forge/i, name: 'Forge', priority: 3 },
  { pattern: /cpw\.mods\.modlauncher/i, name: 'Forge', priority: 3 },
  { pattern: /FML\s+v?[\d.]+/i, name: 'Forge', priority: 4 },
  { pattern: /MCP\s+v[\d.]+\s+FML\s+v[\d.]+/i, name: 'Forge', priority: 4 },
  { pattern: /Forge Mod Loader/i, name: 'Forge', priority: 4 },
]

const ERROR_PATTERNS = [
  { pattern: /(?:^Description:\s*)([^\n]+?)(?:\s*--)?$/m, priority: 2 },
  { pattern: /Exception message:\s*([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*(?:Exception|Error|Throwable))(?::|$)/i, priority: 1 },
  { pattern: /^([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*(?:Exception|Error|Throwable))(?::|$)/m, priority: 1 },
  { pattern: /(?:Caused by|Exception in thread|Error):\s*([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*(?:Exception|Error|Throwable))/g, priority: 1 },
]

const ERROR_DESCRIPTION_FILTERS = [
  /^(?:A detailed|The game crashed|There was a severe problem)/i,
  /^(?:Watching Server)$/i,
]

const MOD_PACKAGE_PATTERN = /(?:^|\s)(?:at\s+|at |knot\/\/)([a-z][\w]*(?:\.[a-z][\w]*){2,})\./gm

const OFFICIAL_PACKAGES = [
  'net.minecraft', 'com.mojang', 'net.minecraftforge', 'net.minecraftforge.fml',
  'net.fabricmc', 'net.neoforged', 'org.quiltmc', 'cpw.mods', 'org.jackhuang.hmcl',
  'java.', 'javax.', 'sun.', 'jdk.', 'org.openjdk', 'net.minecraft.launchwrapper',
]

const INVALID_MOD_NAMES = [
  'NONE', 'Unknown', 'Minecraft', 'Forge', 'Fabric',
  'NeoForge', 'Quilt', 'Version:', 'Mod List:', 'FML', 'MCP',
]

const VERSION_BY_PRIORITY = [1, 2, 3, 4].map(p => VERSION_PATTERNS.filter(v => v.priority === p))
const LOADER_BY_PRIORITY = [1, 2, 3, 4].map(p => LOADER_PATTERNS.filter(l => l.priority === p))

function extractVersion(content: string): string | null {
  for (const group of VERSION_BY_PRIORITY) {
    for (const { pattern } of group) {
      const match = content.match(pattern)
      if (match?.[1] && /^\d+\.\d+(?:\.\d+)?(?:-pre\d+)?(?:-rc\d+)?$/.test(match[1])) return match[1]
    }
  }
  return null
}

function extractLoader(content: string): string | null {
  const found = new Set<string>()
  for (const group of LOADER_BY_PRIORITY.slice(0, 3)) {
    for (const { pattern, name } of group) if (pattern.test(content)) found.add(name)
    if (found.size > 0) break
  }
  if (found.has('NeoForge') && found.has('Forge')) found.delete('Forge')
  if (found.has('Quilt') && found.has('Fabric')) found.delete('Fabric')
  return found.size > 0 ? Array.from(found)[0]! : null
}

function extractErrors(content: string): string[] {
  const errorMap = new Map<string, number>()
  for (const { pattern, priority } of ERROR_PATTERNS) {
    const matches = pattern.global ? Array.from(content.matchAll(pattern), m => m[1] || '').filter(Boolean) : (content.match(pattern)?.[1] ? [content.match(pattern)![1]!] : [])
    for (const error of matches) {
      const trimmed = error.trim()
      if (!ERROR_DESCRIPTION_FILTERS.some(filter => filter.test(trimmed)) && !errorMap.has(trimmed)) errorMap.set(trimmed, priority)
    }
  }
  return Array.from(errorMap.entries()).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([error]) => error)
}

function extractMods(content: string): string[] {
  const modCandidates: Array<{ name: string; priority: number }> = []
  const modSectionMatch = content.match(/-- MOD (\w+) --/i)
  if (modSectionMatch?.[1] && Boolean(modSectionMatch[1]) && !INVALID_MOD_NAMES.some(invalid => modSectionMatch[1]! === invalid || modSectionMatch[1]!.startsWith(invalid))) modCandidates.push({ name: modSectionMatch[1], priority: 1 })
  const suspectedMatch = content.match(/Suspected\s+Mods?:\s*(.+)/i)
  if (suspectedMatch?.[1]) {
    const mods = suspectedMatch[1].split(/,\s*/).map(m => m.replace(/\s*\([^)]+\)/, '').trim()).filter(name => Boolean(name) && !INVALID_MOD_NAMES.some(invalid => name === invalid || name.startsWith(invalid)))
    for (const mod of mods) modCandidates.push({ name: mod, priority: 2 })
  }
  const modPackages = new Set<string>()
  const seen = new Set<string>()
  let modMatch: RegExpExecArray | null
  MOD_PACKAGE_PATTERN.lastIndex = 0
  while ((modMatch = MOD_PACKAGE_PATTERN.exec(content)) !== null) {
    const pkg = modMatch[1]
    if (pkg && !seen.has(pkg)) {
      seen.add(pkg)
      const isOfficial = OFFICIAL_PACKAGES.some(op => pkg.startsWith(op))
      if (!isOfficial) {
        const shortPkg = pkg.split('.').slice(0, 3).join('.')
        if (Boolean(shortPkg) && !INVALID_MOD_NAMES.some(invalid => shortPkg === invalid || shortPkg.startsWith(invalid))) modPackages.add(shortPkg)
      }
    }
  }
  for (const pkg of modPackages) modCandidates.push({ name: pkg, priority: 3 })
  const seenMods = new Set<string>()
  return modCandidates
    .sort((a, b) => a.priority - b.priority)
    .filter(m => {
      if (seenMods.has(m.name)) return false
      seenMods.add(m.name)
      return true
    })
    .map(m => m.name)
}

export function extractTags(group: FileGroup): ExtractedTags {
  const tags: ExtractedTags = { version: [], loader: [], error: [], mod: [] }
  const allContent = group.files.map(f => f.content).join('\n')
  const version = extractVersion(allContent)
  if (version) tags.version.push(version)
  const loader = extractLoader(allContent)
  if (loader) tags.loader.push(loader)
  tags.error = extractErrors(allContent)
  tags.mod = extractMods(allContent)
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
      chunks.push({ text: buf.join('\n'), priority: getPriority(basePriority, errs, buf.length), meta: { ...meta } })
      buf = []; len = 0; errs = 0
    }
    buf.push(line); len += line.length + 1
    if (ERROR_KEYWORDS.test(line)) errs++
  }
  if (buf.length) chunks.push({ text: buf.join('\n'), priority: getPriority(basePriority, errs, buf.length), meta: { ...meta } })
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
