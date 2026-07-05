<template>
  <div class="flex flex-col gap-6 pt-8">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-bold text-slate-800">配置选项</h2>
      </div>
      <div class="flex items-center gap-4">
        <svg v-if="status === 'success'" class="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
        <svg v-else-if="status === 'error'" class="w-5 h-5 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
        <Button variant="primary" size="md" :disabled="status === 'saving'" @click="saveConfig">{{ status === 'saving' ? '保存中...' : '保存' }}</Button>
      </div>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 class="font-bold text-slate-800">LLM 配置</h3>
          </div>
        </template>
        <div class="flex flex-col gap-6 p-6">
          <Input v-model="config.apiUrl" label="API 地址" placeholder="https://api.deepseek.com" />
          <Input v-model="config.apiKey" label="API 密钥" type="password" placeholder="sk-..." />
          <Input v-model="config.apiModel" label="模型名称" placeholder="deepseek-v4-pro" />
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-2">温度：{{ config.temperature }}</label>
            <input v-model.number="config.temperature" type="range" min="0" max="2" step="0.1" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500">
          </div>
        </div>
      </Card>
      <Card>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2 1.5 3 4 3h8c2.5 0 4-1 4-3V7m-4 0v10M4 7c0-2 1.5-3 4-3h8c2.5 0 4 1 4 3" />
              </svg>
            </div>
            <h3 class="font-bold text-slate-800">RAG 配置</h3>
          </div>
        </template>
        <div class="flex flex-col gap-6 p-6">
          <Input v-model="config.dataDir" label="数据目录" placeholder="./data" />
          <Input v-model.number="config.textChunk" label="切片字符数" type="number" />
          <Input v-model.number="config.chunkOffset" label="切片偏移量" type="number" />
          <Input v-model.number="config.searchLimit" label="搜索结果数" type="number" />
          <Input v-model.number="config.searchCandidate" label="搜索候选数" type="number" />
          <div>
            <label class="block text-xs font-bold text-slate-500 mb-2">向量权重：{{ config.semanticWeight }}</label>
            <input v-model.number="config.semanticWeight" type="range" min="0" max="1" step="0.1" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-cyan-500">
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>
<script setup lang="ts">
interface Config {
  apiUrl: string
  apiKey: string
  apiModel: string
  temperature: number
  dataDir: string
  textChunk: number
  chunkOffset: number
  searchLimit: number
  searchCandidate: number
  semanticWeight: number
}

const status = ref<'idle' | 'saving' | 'success' | 'error'>('idle')

const config = ref<Config>({
  apiUrl: '',
  apiKey: '',
  apiModel: '',
  temperature: 0.2,
  dataDir: './data',
  textChunk: 6144,
  chunkOffset: 2048,
  searchLimit: 5,
  searchCandidate: 64,
  semanticWeight: 0.6,
})

async function loadConfig() {
  try {
    const response = await fetch('/api/config')
    if (response.ok) {
      const result = await response.json()
      const configData = result.data || result
      config.value = { ...config.value, ...configData }
    }
  } catch (error) {
    console.error('[Option] 加载失败：', error)
  }
}

async function saveConfig() {
  status.value = 'saving'
  try {
    const response = await fetch('/api/config', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config.value) })
    if (response.ok) {
      status.value = 'success'
    } else {
      status.value = 'error'
      console.error('[Option] 保存失败：', response.status, response.statusText)
    }
  } catch (error) {
    status.value = 'error'
    console.error('[Option] 保存出错：', error)
  } finally {
    setTimeout(() => { status.value = 'idle' }, 1000)
  }
}

onMounted(() => loadConfig())
</script>
