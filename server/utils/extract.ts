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
  return { name: groupBaseName, files: contentFiles, chat, solution }
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
  for (const files of subDirs.values()) {
    const fileGroup = await readFileGroup(files, dirPath)
    groups.push(fileGroup)
  }
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
  return tags
}

function findSectionBoundaries(lines: string[]): Array<{ start: number; end: number; name: string }> {
  const sections: Array<{ start: number; end: number; name: string }> = []
  const markers: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /^---- Minecraft Crash Report ----/i, name: 'crash_header' },
    { pattern: /^-- System Details --/i, name: 'system_details' },
    { pattern: /^-- Head --/i, name: 'head' },
    { pattern: /^-- Affected screen --/i, name: 'affected_screen' },
    { pattern: /^-- Affected level --/i, name: 'affected_level' },
    { pattern: /^-- Entity being ticked --/i, name: 'entity_ticked' },
    { pattern: /^-- Block entity being ticked --/i, name: 'block_entity_ticked' },
    { pattern: /^A detailed walkthrough/i, name: 'walkthrough' },
    { pattern: /^-- MOD\s+/i, name: 'mod_error' },
    { pattern: /^\s*Mod\s+File:/i, name: 'mod_error' },
    { pattern: /^FML:|^States:/i, name: 'mod_list' },
    { pattern: /^\| State \| ID/i, name: 'mod_table' },
    { pattern: /^Mod List:/i, name: 'mod_list' },
    { pattern: /^ModLauncher/i, name: 'modlauncher' },
    { pattern: /^(?:UCHIJAAAA|UCHIJ|UCHIJA|UCHIJE)\t/i, name: 'mod_list' },
    { pattern: /^Suspected Mods?:/i, name: 'system_details' },
    { pattern: /^Mixins in Stacktrace:/i, name: 'mixins' },
    { pattern: /^Loaded Shaderpack:/i, name: 'shader' },
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
        for (const sub of splitBySize(sectionText, 4096)) chunks.push({ text: sub, meta: { ...meta, section: section.name } })
      } else if (sectionLines.length > 128) {
        for (const sub of splitByLines(sectionLines, 128)) chunks.push({ text: sub.join('\n'), meta: { ...meta, section: section.name } })
      } else {
        chunks.push({ text: sectionText, meta: { ...meta, section: section.name } })
      }
    }
  } else {
    if (lines.length <= 128) {
      chunks.push({ text: content, meta })
    } else if (content.length <= 4096) {
      for (const sub of splitByLines(lines, 128)) chunks.push({ text: sub.join('\n'), meta })
    } else {
      for (const sub of splitBySize(content, 4096)) chunks.push({ text: sub, meta })
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
