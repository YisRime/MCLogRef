import { readFile, readdir, stat } from 'fs/promises'
import { join, extname, basename } from 'path'
import JSZip from 'jszip'

export interface FileGroup {
  name: string
  files: GroupFile[]
  chat?: ChatRecord
  solution?: SolutionRecord
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
}

const LOADER_PATTERNS = [
  /Forge/i,
  /Fabric/i,
  /NeoForge/i,
  /Quilt/i,
  /Fabric Loader\s+[\d.]+/i,
]

const VERSION_PATTERN = /Minecraft(?:\s+Version)?[\s:]+([\d.]+)/i

const ERROR_PATTERNS = [
  /^([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(?:Exception|Error|Throwable))/m,
  /(?:Caused by|Exception in thread)[^:]*:\s*([a-zA-Z_$][a-zA-Z0-9_$]*(?:\.[a-zA-Z_$][a-zA-Z0-9_$]*)*(?:Exception|Error|Throwable))/,
]

const MOD_PACKAGE_PATTERN = /(?:at|knot\/\/)([a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*){2,})\./g

const OFFICIAL_PACKAGES = [
  'net.minecraft',
  'net.minecraftforge',
  'net.fabricmc',
  'net.neoforged',
  'org.quiltmc',
  'com.mojang',
  'com.google',
  'java.',
  'javax.',
  'sun.',
  'jdk.',
  'org.apache',
  'org.objectweb',
  'io.netty',
  'com.google.gson',
  'org.lwjgl',
  'org.spongepowered',
  'net.minecraft.launchwrapper',
]

function detectFileType(filename: string): GroupFile['type'] {
  const lower = filename.toLowerCase()
  if (lower.startsWith('crash-') || lower.includes('crash')) return 'crash'
  if (lower.endsWith('.log') || lower.includes('latest')) return 'gamelog'
  if (lower.includes('启动器日志') || lower.includes('launcher')) return 'log'
  if (lower.includes('讨论') || lower.includes('discuss')) return 'discuss'
  return 'other'
}

export function identifyFileGroup(files: string[]): string[][] {
  const groups: Map<string, string[]> = new Map()
  for (const file of files) {
    const base = basename(file)
    const ext = extname(file)
    if (ext === '.json') continue
    let groupKey: string
    if (base.endsWith('.zip')) {
      groupKey = base.replace('.zip', '')
    } else if (base.match(/crash-\d{4}-\d{2}-\d{2}_\d{2}\.\d{2}\.\d{2}/)) {
      groupKey = base.match(/crash-\d{4}-\d{2}-\d{2}_\d{2}\.\d{2}\.\d{2}/)![0]
    } else if (base.match(/错误报告-\d{4}-\d{1,2}-\d{1,2}_\d{1,2}\.\d{1,2}\.\d{1,2}/)) {
      groupKey = base.match(/错误报告-\d{4}-\d{1,2}-\d{1,2}_\d{1,2}\.\d{1,2}\.\d{1,2}/)![0]
    } else if (base.match(/minecraft-exported-crash-info-\d{4}-\d{2}-\d{2}T/)) {
      groupKey = base.match(/minecraft-exported-crash-info-\d{4}-\d{2}-\d{2}T[\d-]+/)?.[0] || base
    } else {
      groupKey = base
    }
    if (!groups.has(groupKey)) groups.set(groupKey, [])
    groups.get(groupKey)!.push(file)
  }
  return Array.from(groups.values())
}

export async function readFileGroup(filePaths: string[], basePath: string): Promise<FileGroup> {
  const files: GroupFile[] = []
  let chat: ChatRecord | undefined
  let solution: SolutionRecord | undefined
  let groupName = ''
  for (const filePath of filePaths) {
    const fullPath = join(basePath, filePath)
    const base = basename(filePath)
    const ext = extname(filePath)
    if (ext === '.json') {
      if (base.endsWith('.solution.json')) {
        const content = await readFile(fullPath, 'utf-8')
        solution = JSON.parse(content)
        continue
      } else if (base.endsWith('.json')) {
        const content = await readFile(fullPath, 'utf-8')
        const data = JSON.parse(content)
        if (data.recordId && data.messages) {
          chat = data as ChatRecord
          continue
        }
      }
    }
    if (ext === '.zip') {
      groupName = base.replace('.zip', '')
      const zipFiles = await readZipFile(fullPath)
      files.push(...zipFiles)
    } else {
      const content = await readFile(fullPath, 'utf-8')
      const fileType = detectFileType(base)
      files.push({ name: base, type: fileType, content })
    }
  }
  if (!groupName && files.length > 0 && files[0]?.name) {
    const ext = extname(files[0].name)
    groupName = files[0].name.replace(ext, '')
  }
  return { name: groupName, files, chat, solution }
}

async function readZipFile(zipPath: string): Promise<GroupFile[]> {
  const data = await readFile(zipPath)
  const zip = await JSZip.loadAsync(data)
  const files: GroupFile[] = []
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const content = await entry.async('string')
    const base = basename(path)
    const fileType = detectFileType(base)
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
      topLevelFiles.push(entry)
    }
  }
  const groupedTopLevel = identifyFileGroup(topLevelFiles)
  for (const group of groupedTopLevel) {
    const fileGroup = await readFileGroup(group, dirPath)
    groups.push(fileGroup)
  }
  for (const files of subDirs.values()) {
    const fileGroup = await readFileGroup(files, dirPath)
    groups.push(fileGroup)
  }
  return groups
}

export function extractTags(group: FileGroup): ExtractedTags {
  const tags: ExtractedTags = { version: [], loader: [], error: [], mod: [] }
  const allContent = group.files.map(f => f.content).join('\n')
  const versionMatch = allContent.match(VERSION_PATTERN)
  if (versionMatch?.[1]) tags.version.push(versionMatch[1])
  for (const pattern of LOADER_PATTERNS) {
    const match = allContent.match(pattern)
    if (match?.[0]) {
      const loader = match[0].trim()
      if (!tags.loader.includes(loader)) tags.loader.push(loader)
    }
  }
  for (const pattern of ERROR_PATTERNS) {
    const match = allContent.match(pattern)
    if (match?.[1]) {
      const error = match[1]
      if (!tags.error.includes(error)) tags.error.push(error)
    }
  }
  const modPackages = new Set<string>()
  let modMatch: RegExpExecArray | null
  MOD_PACKAGE_PATTERN.lastIndex = 0
  while ((modMatch = MOD_PACKAGE_PATTERN.exec(allContent)) !== null) {
    const pkg = modMatch[1]
    if (pkg) {
      const isOfficial = OFFICIAL_PACKAGES.some(op => pkg.startsWith(op))
      if (!isOfficial) modPackages.add(pkg.split('.').slice(0, 3).join('.'))
    }
  }
  tags.mod.push(...Array.from(modPackages))
  return tags
}

function findSectionBoundaries(lines: string[]): Array<{ start: number; end: number; name: string }> {
  const sections: Array<{ start: number; end: number; name: string }> = []
  const markers = [
    { pattern: /^-- System Details --/i, name: 'system_details' },
    { pattern: /^-- Head --/i, name: 'head' },
    { pattern: /^-- Affected level --/i, name: 'affected_level' },
    { pattern: /^-- Entity being ticked --/i, name: 'entity_ticked' },
    { pattern: /^A detailed walkthrough/i, name: 'walkthrough' },
    { pattern: /^---- Minecraft Crash Report ----/i, name: 'crash_header' },
    { pattern: /^FML:|^States:/i, name: 'mod_list' },
    { pattern: /^\| State \| ID/i, name: 'mod_table' },
  ]
  let currentSection: { start: number; name: string } | null = null
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    for (const marker of markers) {
      if (marker.pattern.test(line)) {
        if (currentSection) sections.push({ start: currentSection.start, end: i - 1, name: currentSection.name })
        currentSection = { start: i, name: marker.name }
        break
      }
    }
  }
  if (currentSection) sections.push({ start: currentSection.start, end: lines.length - 1, name: currentSection.name })
  return sections
}

export function chunkText(content: string, meta: Record<string, string> = {}): TextChunk[] {
  const lines = content.split('\n')
  const chunks: TextChunk[] = []
  const sections = findSectionBoundaries(lines)
  if (sections.length > 0) {
    for (const section of sections) {
      const sectionLines = lines.slice(section.start, section.end + 1)
      const sectionText = sectionLines.join('\n')
      if (sectionText.length > 4096) {
        const subChunks = splitBySize(sectionText, 4096)
        for (const subChunk of subChunks) chunks.push({ text: subChunk, meta: { ...meta, section: section.name } })
      } else if (sectionLines.length > 128) {
        const subChunks = splitByLines(sectionLines, 128)
        for (const subChunk of subChunks) chunks.push({ text: subChunk.join('\n'), meta: { ...meta, section: section.name } })
      } else {
        chunks.push({ text: sectionText, meta: { ...meta, section: section.name } })
      }
    }
  } else {
    if (lines.length <= 128) {
      chunks.push({ text: content, meta })
    } else if (content.length <= 4096) {
      const lineChunks = splitByLines(lines, 128)
      for (const chunk of lineChunks) chunks.push({ text: chunk.join('\n'), meta })
    } else {
      const sizeChunks = splitBySize(content, 4096)
      for (const chunk of sizeChunks) chunks.push({ text: chunk, meta })
    }
  }
  return chunks
}

function splitByLines(lines: string[], chunkSize: number): string[][] {
  const chunks: string[][] = []
  for (let i = 0; i < lines.length; i += chunkSize) chunks.push(lines.slice(i, i + chunkSize))
  return chunks
}

function splitBySize(text: string, maxSize: number): string[] {
  const chunks: string[] = []
  let current = ''
  const lines = text.split('\n')
  for (const line of lines) {
    if (current.length + line.length + 1 > maxSize && current.length > 0) {
      chunks.push(current)
      current = ''
    }
    current += (current ? '\n' : '') + line
  }
  if (current) chunks.push(current)
  return chunks
}
