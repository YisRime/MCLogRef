<template>
  <div class="flex flex-col gap-6 p-8 h-screen w-full">
    <div class="flex items-center justify-between">
      <h2 class="text-3xl font-bold text-slate-800">日志管理</h2>
      <div class="flex items-center gap-3">
        <Button title="上一页" variant="secondary" size="icon" :disabled="currentPage === 1" @click="currentPage--; loadReports()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </Button>
        <div class="text-sm text-slate-600 px-2">第 <span class="font-bold text-slate-800">{{ currentPage }}</span> 页</div>
        <Button title="下一页" variant="secondary" size="icon" :disabled="!hasMorePages" @click="currentPage++; loadReports()">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </Button>
        <div class="w-px h-6 bg-slate-200 mx-1" />
        <Button v-if="selectedIds.size > 0" variant="secondary" size="icon" class="text-rose-500 hover:bg-rose-50 hover:border-rose-300" @click="deleteSelected">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </Button>
        <Button title="刷新" variant="secondary" size="icon" @click="loadReports">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </Button>
        <Button title="导入" variant="primary" size="icon" @click="showImportModal = true">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </Button>
      </div>
    </div>
    <Card class="flex flex-col flex-1 min-h-0 overflow-hidden">
      <div class="flex-1 overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="bg-slate-50/80 text-slate-500 border-b border-slate-200/80 sticky top-0 z-10">
            <tr>
              <th class="px-3 py-2.5 font-medium text-left">文件</th>
              <th class="px-3 py-2.5 font-medium text-center w-40">时间</th>
              <th class="px-3 py-2.5 font-medium text-center w-20">ID</th>
              <th class="px-3 py-2.5 font-medium text-center w-24">状态</th>
              <th class="px-3 py-2.5 font-medium text-center w-12">
                <input type="checkbox" class="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer" :checked="allSelected" @change="allSelected ? selectedIds.clear() : reports.forEach(report => selectedIds.add(report.id))">
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 bg-white">
            <tr v-for="report in reports" :key="report.id" class="hover:bg-cyan-50/50 cursor-pointer transition-colors" @click="viewReport(report)">
              <td class="px-3 py-3">
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600 shrink-0">
                    <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                    </svg>
                  </div>
                  <span class="font-bold text-slate-700 text-base">{{ report.name }}</span>
                </div>
              </td>
              <td class="px-3 py-3 text-slate-500 font-medium text-center w-40">{{ new Date(report.timestamp * 1000).toLocaleDateString('zh-CN') }} {{ new Date(report.timestamp * 1000).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) }}</td>
              <td class="px-3 py-3 text-slate-500 font-mono text-xs text-center w-20">{{ report.id }}</td>
              <td class="px-3 py-3 text-center w-24">
                <span :class="['inline-block text-xs px-2.5 py-1 rounded-md font-medium border', { 0: 'bg-amber-50 text-amber-600 border-amber-200', 1: 'bg-emerald-50 text-emerald-600 border-emerald-200', 2: 'bg-cyan-50 text-cyan-600 border-cyan-200' }[report.status]]">
                  {{ { 0: '处理中', 1: '已完成', 2: '已上传' }[report.status]}}
                </span>
              </td>
              <td class="px-3 py-3 text-center w-12" @click.stop>
                <input type="checkbox" class="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer" :checked="selectedIds.has(report.id)" @change="selectedIds.has(report.id) ? selectedIds.delete(report.id) : selectedIds.add(report.id)">
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
    <Modal v-model="showDetailModal" :title="selectedReport?.name" size="xl">
      <div v-if="reportDetail" class="flex flex-col gap-3">
        <div v-if="reportDetail.tags && reportDetail.tags.filter(t => t.type === 'error' || t.type === 'mod').length > 0" class="flex flex-col gap-2">
          <div v-if="reportDetail.tags.filter(t => t.type === 'error').length > 0">
            <h4 class="text-xs font-semibold text-slate-600 mb-1.5">涉及报错</h4>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="tag in reportDetail.tags.filter(t => t.type === 'error')" :key="tag.id" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium bg-rose-50 text-rose-700 border border-rose-200">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" /></svg>{{ tag.value }}
              </span>
            </div>
          </div>
          <div v-if="reportDetail.tags.filter(t => t.type === 'mod').length > 0">
            <h4 class="text-xs font-semibold text-slate-600 mb-1.5">可疑模组</h4>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="tag in reportDetail.tags.filter(t => t.type === 'mod')" :key="tag.id" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium bg-orange-50 text-orange-700 border border-orange-200">
                <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" /></svg>{{ tag.value }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex gap-3">
          <div v-if="reportDetail.tags && (reportDetail.tags.filter(t => t.type === 'version').length > 0 || reportDetail.tags.filter(t => t.type === 'loader').length > 0)" class="flex flex-col gap-2 px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 shrink-0">
            <div v-if="reportDetail.tags.filter(t => t.type === 'version').length > 0" class="flex flex-col">
              <span class="text-xs text-slate-500">版本</span>
              <span class="text-sm font-semibold text-slate-800">{{ reportDetail.tags.filter(t => t.type === 'version')[0]?.value }}</span>
            </div>
            <div v-if="reportDetail.tags.filter(t => t.type === 'loader').length > 0" class="flex flex-col">
              <span class="text-xs text-slate-500">加载器</span>
              <span class="text-sm font-semibold text-slate-800">{{ reportDetail.tags.filter(t => t.type === 'loader')[0]?.value }}</span>
            </div>
          </div>
          <div v-if="reportDetail.files && reportDetail.files.length > 0" class="flex-1">
            <h4 class="text-xs font-semibold text-slate-600 mb-1.5">文件列表</h4>
            <div class="grid grid-cols-4 gap-2">
              <div v-for="file in reportDetail.files" :key="file.id" class="flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-lg hover:bg-cyan-50 hover:border-cyan-300 transition-colors cursor-pointer" @click="viewFileContent(file)">
                <div :class="['w-6 h-6 rounded flex items-center justify-center shrink-0', { crash: 'bg-rose-100 text-rose-600', other: 'bg-slate-100 text-slate-600', log: 'bg-yellow-100 text-yellow-600', gamelog: 'bg-orange-100 text-orange-600', discuss: 'bg-green-100 text-green-600' }[file.type]]">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" /></svg>
                </div>
                <p class="flex-1 text-base font-medium text-slate-700 font-mono truncate">{{ file.file }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-if="reportDetail.solution">
          <h4 class="text-xs font-semibold text-slate-600 mb-1.5">解决方案</h4>
          <div class="bg-cyan-50 border border-cyan-200 rounded-lg p-3 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{{ reportDetail.solution }}</div>
        </div>
      </div>
    </Modal>
    <Modal v-model="showFileModal" :title="selectedFile ? `${selectedFile.file} - ${({ crash: '崩溃报告', gamelog: '游戏日志', log: '日志', discuss: '讨论', other: '其他' }[selectedFile.type])}` : ''" size="xl">
      <div class="bg-slate-50 border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-700 whitespace-pre-wrap max-h-[60vh] overflow-y-auto">{{ selectedFile?.content }}</div>
    </Modal>
    <Modal v-model="showImportModal" title="导入" size="md">
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="px-4 py-3 bg-slate-50 rounded-lg border border-slate-200">
            <p class="text-xs text-slate-500 mb-1">共计</p>
            <p class="text-2xl font-bold text-slate-700">{{ importStats.total }}</p>
          </div>
          <div class="px-4 py-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p class="text-xs text-slate-500 mb-1">成功</p>
            <p class="text-2xl font-bold text-emerald-600">{{ importStats.success }}</p>
          </div>
          <div class="px-4 py-3 bg-amber-50 rounded-lg border border-amber-200">
            <p class="text-xs text-slate-500 mb-1">跳过</p>
            <p class="text-2xl font-bold text-amber-600">{{ importStats.skipped }}</p>
          </div>
          <div class="px-4 py-3 bg-rose-50 rounded-lg border border-rose-200">
            <p class="text-xs text-slate-500 mb-1">失败</p>
            <p class="text-2xl font-bold text-rose-600">{{ importStats.failed }}</p>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex items-center justify-between w-full">
          <div class="text-sm text-slate-600 font-medium">{{ importMessage }}</div>
          <div class="flex gap-3">
            <Button variant="secondary" :disabled="!isImporting" @click="cancelImport">取消</Button>
            <Button variant="primary" :disabled="isImporting" @click="startImport">{{ isImporting ? '导入中...' : '开始' }}</Button>
          </div>
        </div>
      </template>
    </Modal>
  </div>
</template>
<script setup lang="ts">
interface Report {
  id: number
  name: string
  solution: string
  status: number
  timestamp: number
}

interface FileInfo {
  id: number
  rid: number
  file: string
  type: 'crash' | 'gamelog' | 'log' | 'discuss' | 'other'
  content?: string
}

interface TagInfo {
  id: number
  rid: number
  type: 'version' | 'loader' | 'error' | 'mod'
  value: string
}

interface ReportDetail extends Report {
  files: FileInfo[]
  tags: TagInfo[]
}

interface ImportStats {
  total: number
  success: number
  skipped: number
  failed: number
}

const currentPage = ref(1)
const reports = ref<Report[]>([])
const selectedReport = ref<Report | null>(null)
const reportDetail = ref<ReportDetail | null>(null)
const showDetailModal = ref(false)
const showFileModal = ref(false)
const selectedFile = ref<FileInfo | null>(null)
const showImportModal = ref(false)
const isImporting = ref(false)
const importMessage = ref('')
const selectedIds = ref<Set<number>>(new Set())
const hasMorePages = ref(true)
const importStats = ref<ImportStats>({ total: 0, success: 0, skipped: 0, failed: 0 })

const allSelected = computed(() => reports.value.length > 0 && reports.value.every(report => selectedIds.value.has(report.id)))

async function viewReport(report: Report) {
  selectedReport.value = report
  showDetailModal.value = true
  reportDetail.value = null
  try {
    const response = await fetch(`/api/reports/info?id=${report.id}`)
    if (!response.ok) throw new Error(`Load Report Failed: HTTP ${response.status} ${response.statusText}`)
    const result = await response.json()
    if (result.status !== 200 || !result.data) throw new Error(`Load Report Failed: ${result.data?.message || `Status ${result.status}`}`)
    reportDetail.value = result.data
  } catch (error) {
    console.error(`[Report] 加载报告 ${report.id} 详情失败：`, error)
  }
}

async function viewFileContent(file: FileInfo) {
  selectedFile.value = file
  showFileModal.value = true
  if (file.content) return
  try {
    const response = await fetch(`/api/reports/info?id=${file.rid}&content=true&fileId=${file.id}`)
    if (!response.ok) throw new Error(`Load File Failed: HTTP ${response.status} ${response.statusText}`)
    const result = await response.json()
    if (result.status !== 200 || !result.data) throw new Error(`Load File Failed: ${result.data?.message || `Status ${result.status}`}`)
    file.content = result.data.content
    selectedFile.value = result.data
  } catch (error) {
    console.error(`[Report] 加载文件 ${file.id} 内容失败：`, error)
  }
}

async function deleteSelected() {
  if (selectedIds.value.size === 0) return
  const ids = Array.from(selectedIds.value)
  try {
    const response = await fetch('/api/reports/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
    if (!response.ok) throw new Error(`Delete Reports Failed: HTTP ${response.status} ${response.statusText}`)
    const result = await response.json()
    if (result.status !== 200) throw new Error(`Delete Reports Failed: ${result.data?.message || `Status ${result.status}`}`)
    selectedIds.value.clear()
    await loadReports()
  } catch (error) {
    console.error(`[Report] 删除报告 ${ids.join(',')} 失败：`, error)
  }
}

async function loadReports() {
  const page = currentPage.value
  try {
    const response = await fetch(`/api/reports/list?${new URLSearchParams({ page: String(page), pageSize: '100' })}`)
    if (!response.ok) throw new Error(`Load Reports Failed: HTTP ${response.status} ${response.statusText}`)
    const result = await response.json()
    if (result.status !== 200 || !Array.isArray(result.data)) throw new Error(`Load Reports Failed: ${result.data?.message || `Status ${result.status}`}`)
    reports.value = result.data
    hasMorePages.value = result.data.length === 100
    selectedIds.value.clear()
  } catch (error) {
    console.error(`[Report] 加载报告列表第 ${page} 页失败：`, error)
  }
}

async function startImport() {
  if (isImporting.value) return
  isImporting.value = true
  importMessage.value = '正在导入...'
  importStats.value = { total: 0, success: 0, skipped: 0, failed: 0 }
  try {
    const response = await fetch('/api/reports/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) })
    if (!response.ok) throw new Error(`Import Failed: HTTP ${response.status} ${response.statusText}`)
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Import Failed: Response body is not readable')
    const decoder = new TextDecoder()
    let buffer = ''
    while (isImporting.value) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        let event
        try {
          event = JSON.parse(line.slice(6))
        } catch (error) {
          console.error(`[Report] 解析导入数据 ${line} 失败：`, error)
          continue
        }
        if (event.status >= 400) throw new Error(`Import Failed: ${event.data?.message || `Status ${event.status}`}`)
        if (event.status !== 200 || !event.data) continue
        const importData = event.data
        if (importData.message) importMessage.value = importData.message
        if (importData.total !== undefined) {
          importStats.value = { total: importData.total, success: importData.success ?? 0, skipped: importData.skipped ?? 0, failed: importData.failed ?? 0 }
        } else {
          if (importData.success !== undefined) importStats.value.success = importData.success
          if (importData.skipped !== undefined) importStats.value.skipped = importData.skipped
          if (importData.failed !== undefined) importStats.value.failed = importData.failed
        }
        if (importData.done) {
          isImporting.value = false
          await loadReports()
        } else if (importData.cancelled) {
          isImporting.value = false
        }
      }
    }
  } catch (error) {
    console.error(`[Report] 导入报告失败：总计 ${importStats.value.total}、成功 ${importStats.value.success}、跳过 ${importStats.value.skipped}、失败 ${importStats.value.failed}`, error)
    importMessage.value = `错误: ${error instanceof Error ? error.message : '导入失败'}`
    isImporting.value = false
  }
}

async function cancelImport() {
  if (!isImporting.value) return
  importMessage.value = '正在取消...'
  try {
    const response = await fetch('/api/reports/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) })
    if (!response.ok) throw new Error(`Cancel Import Failed: HTTP ${response.status} ${response.statusText}`)
  } catch (error) {
    console.error('[Report] 取消导入失败：', error)
    isImporting.value = false
  }
}

onMounted(async () => {
  await loadReports()
  try {
    const response = await fetch('/api/reports/add')
    if (!response.ok) throw new Error(`Check Status Failed: HTTP ${response.status} ${response.statusText}`)
    const result = await response.json()
    if (result.status === 200 && result.data?.importing) {
      showImportModal.value = true
      await startImport()
    }
  } catch (error) {
    console.error('[Report] 检查状态失败：', error)
  }
})

watch(showImportModal, (opened) => {
  if (!opened) {
    if (isImporting.value) cancelImport()
    importMessage.value = ''
    importStats.value = { total: 0, success: 0, skipped: 0, failed: 0 }
  }
})
</script>
