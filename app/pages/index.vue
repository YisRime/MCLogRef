<template>
  <div class="min-h-screen flex flex-col items-center justify-center p-6">
    <div class="w-4/5 max-w-screen-xl flex flex-col h-[80vh]">
      <header class="flex items-center gap-3 mb-6 shrink-0">
        <svg class="w-10 h-10 text-cyan-600" fill="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1.5" opacity="0.9"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5" opacity="0.6"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5" opacity="0.6"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5" opacity="0.9"/>
          <circle cx="6.5" cy="6.5" r="1.5" fill="white" opacity="0.5"/>
          <circle cx="17.5" cy="17.5" r="1.5" fill="white" opacity="0.5"/>
        </svg>
        <div>
          <h1 class="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">MCLogRef</h1>
          <p class="text-slate-500 text-sm">以 RAG + LLM 为核心的 Minecraft 崩溃报告分析</p>
        </div>
      </header>
      <div class="grid grid-cols-3 gap-5 flex-1 min-h-0">
        <div class="flex flex-col gap-5 h-full">
          <Card class="flex-1 min-h-0">
            <div class="p-6 h-full flex flex-col">
              <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6 shrink-0">
                <svg class="w-6 h-6 text-cyan-600" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>运行原理
              </h3>
              <div class="flex flex-col gap-6 flex-1">
                <div v-for="(step, idx) in steps" :key="idx" class="flex gap-4">
                  <div :class="['w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shrink-0 border shadow-sm', step.color]">{{ idx + 1 }}</div>
                  <div>
                    <p class="font-bold text-slate-800 text-base">{{ step.title }}</p>
                    <p class="text-sm text-slate-500 leading-relaxed mt-1">{{ step.desc }}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
          <Card class="shrink-0">
            <div class="relative p-6 flex items-center justify-between overflow-hidden">
              <div class="absolute -right-4 -top-4 w-32 h-32 bg-cyan-50 rounded-full blur-2xl pointer-events-none"/>
              <div class="relative flex items-center gap-4">
                <img src="https://www.gravatar.com/avatar/10ab7469b62e35641073cb4af53649ce?s=256" alt="YisRime" class="w-16 h-16 rounded-full border-2 border-cyan-100 shadow-md">
                <div class="flex flex-col justify-center">
                  <p class="text-2xl font-bold text-cyan-700">苡淞</p>
                  <p class="text-sm text-slate-500 mt-1">天山云水 上下一白</p>
                </div>
              </div>
              <div class="relative flex flex-col gap-2 w-32">
                <a v-for="link in socialLinks" :key="link.name" :href="link.url" target="_blank" :class="['flex items-center justify-center gap-2 text-xs py-1.5 bg-white/80 rounded-lg border border-slate-200 text-slate-600 hover:border-cyan-300 transition-all shadow-sm', link.hover]">
                  <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path :d="link.icon"/></svg>{{ link.name }}
                </a>
              </div>
            </div>
          </Card>
        </div>
        <div class="col-span-2 flex flex-col gap-5 h-full">
          <Card class="shrink-0 cursor-pointer group" @click="!file && input?.click()" @dragover.prevent @drop.prevent="(e: DragEvent) => { if (e.dataTransfer?.files?.[0]) file = e.dataTransfer.files[0] }">
            <div v-if="!file" class="p-6 flex items-center gap-6">
              <div class="flex-1 overflow-hidden">
                <p class="text-xl font-bold text-slate-800 truncate">上传崩溃报告或游戏日志</p>
                <p class="text-sm text-slate-500 truncate mt-1.5">点击或拖拽文件至此（支持 TXT、LOG 等原始日志或启动器导出的 ZIP 压缩包）</p>
              </div>
              <div class="w-16 h-16 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 shadow-sm border border-cyan-100">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
              </div>
            </div>
            <div v-else class="p-6 flex items-center justify-between gap-5 cursor-default">
              <div class="flex items-center gap-5 flex-1 overflow-hidden">
                <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-500 text-white flex items-center justify-center shrink-0 shadow-md">
                  <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 20 20">
                    <path v-if="file.name.endsWith('.zip')" d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/>
                    <path v-else fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/>
                  </svg>
                </div>
                <div class="flex-1 overflow-hidden">
                  <p class="text-lg font-bold text-slate-800 truncate">{{ file.name }}</p>
                  <p class="text-sm text-slate-500 font-medium mt-1">{{ file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${(file.size / 1024).toFixed(2)} KB` : `${(file.size / 1048576).toFixed(2)} MB` }}</p>
                </div>
              </div>
              <div class="flex items-center gap-3 shrink-0">
                <Button variant="secondary" size="icon" class="text-slate-400 hover:text-rose-500 hover:bg-rose-50 hover:border-rose-200" :disabled="status !== 'idle'" @click.stop="reset">
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </Button>
                <Button variant="primary" size="lg" :disabled="status !== 'idle'" @click.stop="start">分析</Button>
              </div>
            </div>
            <input ref="input" type="file" accept=".txt,.log,.zip" class="hidden" @change="select">
          </Card>
          <Card class="flex-1 min-h-0">
            <div class="p-6 flex flex-col h-full">
              <div class="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
                  <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                  </svg>分析结果
                </h3>
                <span v-if="badge" class="text-xs font-medium flex items-center gap-1.5 px-2.5 py-1.5 rounded-md" :class="badge.class">
                  <svg v-if="badge.loading" class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <circle cx="12" cy="12" r="10" stroke-opacity="0.2"/>
                    <path d="M12 2a10 10 0 0110 10" stroke-linecap="round"/>
                  </svg>
                  <svg v-else-if="badge.icon === 'error'" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  <svg v-else-if="badge.icon === 'success'" class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                  </svg>{{ badge.text }}
                </span>
              </div>
              <div class="flex-1 overflow-y-auto mt-4 pr-2 min-h-0">
                <MDC :value="result || ''" tag="div" class="max-w-none text-slate-700 text-sm leading-[1.5] [&_h1]:text-cyan-600 [&_h1]:font-semibold [&_h1]:leading-[1.3] [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:mt-0 [&_h2]:text-cyan-700 [&_h2]:font-semibold [&_h2]:leading-[1.3] [&_h2]:mb-2 [&_h2]:text-base [&_h2]:mt-4 [&_h3]:text-cyan-800 [&_h3]:font-semibold [&_h3]:leading-[1.3] [&_h3]:mb-2 [&_h3]:text-[0.9375rem] [&_h3]:mt-3 [&_h4]:text-cyan-900 [&_h4]:font-semibold [&_h4]:leading-[1.3] [&_h4]:mb-2 [&_h4]:text-sm [&_h4]:mt-[0.625rem] [&_p]:m-0 [&_p]:mb-2 [&_strong]:text-slate-900 [&_strong]:font-semibold [&_code]:text-cyan-600 [&_code]:bg-cyan-50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.875em] [&_code]:font-[Consolas,Monaco,monospace] [&_ul]:my-2 [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:pl-5 [&_li]:my-1 [&>:first-child]:mt-0 [&>:last-child]:mb-0" />
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const steps = [
  { title: '解析与提取', desc: '上传日志后，自动提取模组列表、报错堆栈等元数据。', color: 'bg-cyan-50 text-cyan-600 border-cyan-100' },
  { title: '日志向量化', desc: '将提取的报错特征转化为高维向量,存入本地向量数据库。', color: 'bg-teal-50 text-teal-600 border-teal-100' },
  { title: '相似度匹配', desc: '基于语义相似度，从历史案例与知识库中召回相关上下文。', color: 'bg-emerald-50 text-emerald-600 border-emerald-100' },
  { title: '大模型分析', desc: '将日志与上下文融合构造提示词，调用 LLM 生成解决方案。', color: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
]

const socialLinks = [
  { name: 'GitHub', url: 'https://github.com/YisRime', hover: 'hover:text-cyan-600', icon: 'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z' },
  { name: 'Bilibili', url: 'https://space.bilibili.com/1984500810', hover: 'hover:text-cyan-600', icon: 'M17.813 4.653h.854c1.51.054 2.769.578 3.773 1.574 1.004.995 1.524 2.249 1.56 3.76v7.36c-.036 1.51-.556 2.769-1.56 3.773s-2.262 1.524-3.773 1.56H5.333c-1.51-.036-2.769-.556-3.773-1.56S.036 18.858 0 17.347v-7.36c.036-1.511.556-2.765 1.56-3.76 1.004-.996 2.262-1.52 3.773-1.574h.774l-1.174-1.12a1.234 1.234 0 0 1-.373-.906c0-.356.124-.658.373-.907l.027-.027c.267-.249.573-.373.92-.373.347 0 .653.124.92.373L9.653 4.44c.071.071.134.142.187.213h4.267a.836.836 0 0 1 .16-.213l2.84-2.707c.267-.249.573-.373.92-.373.347 0 .662.124.947.373.285.249.427.551.427.907 0 .32-.125.622-.374.906l-1.213 1.107zm-11.414 9.786c1.004 0 1.813-.818 1.813-1.84 0-1.022-.81-1.84-1.813-1.84-1.004 0-1.813.818-1.813 1.84 0 1.022.81 1.84 1.813 1.84zm11.2 0c1.004 0 1.813-.818 1.813-1.84 0-1.022-.81-1.84-1.813-1.84-1.004 0-1.813.818-1.813 1.84 0 1.022.81 1.84 1.813 1.84z' },
]

const input = ref<HTMLInputElement>()
const file = ref<File>()
const rid = ref<number>()
const status = ref<'idle' | 'uploading' | 'analyzing' | 'error' | 'done'>('idle')
const result = ref('')

const badge = computed(() => {
  if (status.value === 'error') return { text: '分析出错', class: 'text-rose-600 bg-rose-50', icon: 'error', loading: false }
  if (status.value === 'analyzing') return { text: '分析中', class: 'text-cyan-600 bg-cyan-50', loading: true }
  if (status.value === 'uploading') return { text: '上传中', class: 'text-blue-600 bg-blue-50', loading: true }
  if (status.value === 'done') return { text: '已分析', class: 'text-emerald-600 bg-emerald-50', icon: 'success', loading: false }
  return null
})

const select = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files?.[0]) file.value = target.files[0]
}

const reset = () => {
  file.value = undefined
  rid.value = undefined
  status.value = 'idle'
  result.value = ''
  if (input.value) input.value.value = ''
}

const start = async () => {
  if (status.value !== 'idle' || !file.value) return
  try {
    status.value = 'uploading'
    rid.value = undefined
    const fd = new FormData()
    fd.append('file', file.value)
    const uploadRes = await fetch('/api/report', { method: 'POST', body: fd })
    const uploadData = await uploadRes.json()
    if (uploadData.status !== 200 || !uploadData.data?.id) throw new Error(uploadData.data?.message)
    rid.value = uploadData.data.id
    status.value = 'analyzing'
    result.value = ''
    const analyzeRes = await fetch('/api/analyze', { method: 'POST', body: JSON.stringify({ rid: rid.value }), headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(600000) })
    if (!analyzeRes.ok) throw new Error(`${analyzeRes.status} ${analyzeRes.statusText}`)
    const reader = analyzeRes.body?.getReader()
    if (!reader) throw new Error
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() || ''
      for (const chunk of chunks) {
        if (!chunk.trim() || !chunk.startsWith('data: ')) continue
        try {
          const { status: code, data } = JSON.parse(chunk.slice(6))
          if (code === 200 && data) {
            if (data.content && typeof data.content === 'string') result.value += data.content
            if (data.done) { status.value = 'done'; return }
          } else if (code >= 400) throw new Error(data.message)
        } catch (e) {
          console.warn('JSON 解析出错：', e)
        }
      }
    }
    status.value = 'done'
  } catch (err: unknown) {
    status.value = 'error'
    result.value = (err as Error).message
  }
}
</script>