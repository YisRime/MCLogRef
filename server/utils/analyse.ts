import { searchSimilar } from './llama'
import { getReport, getTagsByReport, getFilesByReport, type Report, type Tag, type File } from './database/sqlite'
import { getConfig } from './config'

export interface AnalysisContext {
  report: Report
  files: File[]
  tags: Tag[]
  similarCases: SimilarCase[]
}

export interface SimilarCase {
  rid: number
  text: string
  meta: Record<string, string>
  solution: string
}

export async function buildContext(rid: number): Promise<AnalysisContext> {
  const report = getReport(rid)
  if (!report) throw new Error(`Report ${rid} Not Found`)
  const files = getFilesByReport(rid)
  const tags = getTagsByReport(rid)
  const crashFile = files.find(f => f.type === 'crash') ?? files[0]
  const queryText = crashFile?.content.slice(0, 500) ?? report.name
  const filter: Record<string, string> = {}
  const versionTag = tags.find(t => t.type === 'version')
  const loaderTag = tags.find(t => t.type === 'loader')
  if (versionTag) filter.version = versionTag.value
  if (loaderTag) filter.loader = loaderTag.value
  const searchResults = await searchSimilar(queryText, 5, Object.keys(filter).length > 0 ? filter : undefined)
  const similarCases: SimilarCase[] = searchResults.map(r => ({ rid: r.rid, text: r.text, meta: r.meta, solution: '' }))
  return { report, files, tags, similarCases }
}

export function buildPrompt(context: AnalysisContext): string {
  const { report, files, tags, similarCases } = context
  const systemInfo = files.find(f => f.type === 'crash')?.content ?? files[0]?.content ?? ''
  const tagSummary = tags.map(t => `${t.type}: ${t.value}`).join('\n')
  let similarSection = ''
  if (similarCases.length > 0) {
    similarSection = `
## 历史相似案例
以下是与当前问题相似的历史案例及其解决方案：
${similarCases.map((c, i) => `### 案例 ${i + 1}
**元数据**: ${Object.entries(c.meta).map(([k, v]) => `${k}=${v}`).join(', ')}
**内容片段**:
\`\`\`
${c.text.slice(0, 500)}
\`\`\`
**解决方案**: ${c.solution || '暂无'}`).join('\n\n')}
`
  }

  return `你是一个专业的 Minecraft 模组崩溃分析专家。请根据以下信息分析当前崩溃问题，并给出详细的诊断和操作建议。
## 当前问题
**报告名称**: ${report.name}
**标签信息**:
${tagSummary || '无'}
**崩溃日志/游戏日志**:
\`\`\`
${systemInfo.slice(0, 3000)}
\`\`\`
${similarSection}
## 分析要求
1. **问题定位**: 识别崩溃的根本原因，包括具体的模组、代码位置或配置问题
2. **原因分析**: 解释为什么会出现这个问题
3. **解决方案**: 提供具体的操作步骤来解决问题
4. **预防建议**: 如何避免类似问题再次发生
请用中文回答，格式清晰，步骤具体。`
}

export interface AnalysisResult {
  content: string
  done: boolean
}

export async function* analyzeStream(rid: number): AsyncGenerator<AnalysisResult> {
  const context = await buildContext(rid)
  const prompt = buildPrompt(context)
  const { apiUrl, apiKey, apiModel } = getConfig()
  if (!apiUrl || !apiKey || !apiModel) {
    yield { content: '错误：未配置 LLM API。请在设置中配置 API_URL、API_KEY 和 API_MODEL。', done: true }
    return
  }
  const response = await fetch(`${apiUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: apiModel,
      messages: [
        { role: 'system', content: '你是一个专业的 Minecraft 模组崩溃分析专家。' },
        { role: 'user', content: prompt },
      ],
      stream: true,
    }),
  })
  if (!response.ok) {
    yield { content: `错误：LLM API 请求失败 (${response.status})`, done: true }
    return
  }
  const reader = response.body?.getReader()
  if (!reader) {
    yield { content: '错误：无法读取响应流', done: true }
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
      const parsed = JSON.parse(data)
      const content = parsed.choices?.[0]?.delta?.content
      if (content) yield { content, done: false }
    }
  }
  yield { content: '', done: true }
}

export async function analyze(rid: number): Promise<string> {
  let result = ''
  for await (const chunk of analyzeStream(rid)) result += chunk.content
  return result
}
