import { searchSimilar } from './llama'
import { getReport, getTagsByReport, getFilesByReport, type Report, type Tag, type File } from './database/sqlite'
import { getConfig } from './config'
import { chunkText } from './extract'

export interface AnalysisContext {
  report: Report
  files: File[]
  tags: Tag[]
  mainContent: string
  similarCases: SimilarCase[]
}

export interface SimilarCase {
  rid: number
  text: string
  meta: Record<string, string>
  solution: string
}

const SYSTEM_PROMPT = `你是专业的 Minecraft 模组崩溃分析专家。
你精通 Java 异常堆栈分析，了解游戏机制，擅长解决各种 Mod 之间的冲突。
你需要根据用户提供的相关信息及核心日志，结合相似案例，给出解决方案。
若信息不足以准确确定原因，请加以说明，并给出可能性最高的几个排查方向。

你需要严格遵守以下输出规范，且根据指定的诊断逻辑进行诊断，然后回复：

# 输出规范：回复必须包含且仅包含以下内容：
  ## 诊断结果
   - **核心问题**: 根据解决方案，用一句话概括问题的原因。
   - **错误特征**: 提取关键异常，以及涉及的 Mod ID 或类名。
  ## 解决方案
   - **核心方案**: 若参考了，请给出最贴切的修复建议。
   - **详细步骤**: 分条列出操作步骤。涉及文件操作必须指明路径。
  ## 补充建议 (可选)
   - 针对内存分配、显卡驱动、Java 环境或其它风险的相关提醒。

# 诊断逻辑

1. **Java 环境与版本匹配**
   - **特征识别**: 识别 "Unsupported class file major version" 或 "ClassMetadataNotFoundException" 等。
   - **类版本映射**: 主版本号：65 -> Java 21, 61 -> Java 17, 60 -> Java 16, 55 -> Java 11, 52 -> Java 8。
2. **依赖关系与版本不匹配**
   - **特征识别**: 搜索 "Missing or unsupported mandatory dependencies"、"requires... which is missing!"。
   - **环境错位**: 若 SERVER 环境出现 "Attempted to load class net/minecraft/client"，则误装了仅客户端的模组。
3. **模组冲突与 Mixin 注入**
   - **特征识别**: 搜索 "MixinTransformerError" 或 "InjectionError"。
   - **逻辑**: 若日志中出现 "handler$xxx$method" 模式，定位注入失败的类。
   - **硬冲突**: 若识别到 Overwrite/Redirect 导致的冲突，建议用户二选一。
   - **地物循环**: 若 "Feature order cycle"，建议安装 Cyanide 模组再分析。
4. **实体与模型崩溃**
   - **特征识别**: 搜索 "Ticking Entity"、"Rendering Block Entity" 或 "Tesselating block model"。
   - **定位**: 寻找坐标（Location）和区块信息（Region: r.x.z.mca）。
   - **方案**: 建议使用 Neruina 自动处理或 NBTExplorer/Amulet 手动删除。
5. **JVM 错误与驱动**
   - **特征识别**: 识别 "EXCEPTION_ACCESS_VIOLATION" 及生成的 hs_err_pid.log。
   - **显卡关联**: nvoglv64.dll -> NVIDIA（更新驱动），atio6axx.dll -> AMD（更新/降级驱动，关闭 XMP），ig*.dll -> Intel（关闭 VBOs 或更换 Java 8u51）。
   - **编译器错误**: 若出现 "C2 CompilerThread"，添加参数 -XX:TieredStopAtLevel=3。`

function extractSignature(content: string): string {
  const { textChunk, chunkOffset } = getConfig()
  const lowerLimit = textChunk - chunkOffset
  const upperLimit = textChunk + chunkOffset
  const chunks = chunkText(content).sort((a, b) => a.priority - b.priority)
  let result = ''
  for (const chunk of chunks) {
    if (result.length + chunk.text.length > upperLimit && result.length >= lowerLimit) break
    result += (result ? '\n\n' : '') + chunk.text
    if (result.length >= upperLimit) break
  }
  return result || content.slice(0, textChunk)
}

export async function buildContext(rid: number): Promise<AnalysisContext> {
  const { searchLimit } = getConfig()
  const report = getReport(rid)
  if (!report) throw new Error(`Build Context Failed: Report ${rid} not found`)
  const files = getFilesByReport(rid)
  const tags = getTagsByReport(rid)
  const crashFile = files.find(f => f.type === 'crash' || f.type === 'gamelog') ?? files[0]
  const mainContent = crashFile ? extractSignature(crashFile.content) : report.name
  const filter: Record<string, string> = {}
  for (const type of ['loader', 'version', 'error'] as const) {
    const tag = tags.find(item => item.type === type)
    if (tag) filter[type] = tag.value
  }
  const similarCases = (await searchSimilar(mainContent, searchLimit, filter)).flatMap((result) => {
    const historyReport = getReport(result.rid)
    return historyReport?.solution ? [{ rid: result.rid, text: result.text, meta: result.meta, solution: historyReport.solution }] : []
  })
  return { report, files, tags, similarCases, mainContent }
}

export function buildPrompt(context: AnalysisContext): string {
  const { tags, similarCases, mainContent } = context
  const tagSummary = tags.map(t => `- ${t.type}: ${t.value}`).join('\n')
  let similarSection = ''
  if (similarCases.length > 0) similarSection = `${similarCases.map((c, i) => `## 案例 ${i + 1}\n- 报错特征: \n\`\`\`text\n${c.text}\n\`\`\`\n- 解决方案: ${c.solution}`).join('\n\n')}`
  return `# 相关信息\n${tagSummary}\n# 核心日志\n\`\`\`text\n${mainContent}\n\`\`\`\n# 相似案例\n${similarSection}`
}

export interface AnalysisResult {
  content: string
  done: boolean
}

export async function* analyzeStream(rid: number): AsyncGenerator<AnalysisResult> {
  try {
    const context = await buildContext(rid)
    const prompt = buildPrompt(context)
    const { apiUrl, apiKey, apiModel, temperature } = getConfig()
    if (!apiUrl || !apiKey || !apiModel) {
      yield { content: '错误：未配置 LLM API', done: true }
      return
    }
    const endpoint = `${apiUrl}/chat/completions`
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: apiModel, stream: true, temperature: temperature,
          messages: [ { role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: prompt }],
        }),
      })
      if (!response.ok) {
        yield { content: `错误: 内容请求失败：HTTP ${response.status} ${response.statusText}`, done: true }
        return
      }
      const reader = response.body?.getReader()
      if (!reader) {
        yield { content: '错误：响应流读取失败', done: true }
        return
      }
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (data === '[DONE]') {
            yield { content: '', done: true }
            return
          }
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) yield { content, done: false }
          } catch (err) {
            console.error(`[Analyse] 解析响应流数据 ${data.slice(0, 256)} 失败：`, err)
          }
        }
      }
    } catch (error) {
      yield { content: `\n错误：响应流异常终止：${error instanceof Error ? error.message : String(error)}`, done: true }
    }
  } catch (err) {
    console.error(`[Analyse] 分析报告 ${rid} 失败：`, err)
    yield { content: `\n错误：${err instanceof Error ? err.message : String(err)}`, done: true }
  }
  yield { content: '', done: true }
}

export async function analyze(rid: number): Promise<string> {
  let result = ''
  for await (const chunk of analyzeStream(rid)) result += chunk.content
  return result
}
