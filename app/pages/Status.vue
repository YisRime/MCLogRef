<template>
  <div class="flex flex-col gap-6 p-8 h-screen w-full">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-3xl font-bold text-slate-800">状态统计</h2>
      </div>
      <button :disabled="loading" class="w-10 h-10 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-cyan-600 hover:bg-slate-50 transition-colors" @click="refresh">
        <svg :class="['w-5 h-5', loading && 'animate-spin']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
      </button>
    </div>
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" clip-rule="evenodd"/></svg>
            </div>
            <h3 class="font-bold text-slate-800">日志统计</h3>
          </div>
        </template>
        <div class="grid grid-cols-3 gap-4 p-6">
          <div class="px-4 py-5 bg-cyan-50/50 rounded-xl border border-cyan-200">
            <p class="text-sm text-slate-500 mb-2">日志总计</p>
            <p class="text-4xl font-bold text-cyan-600">{{ data.reports?.total ?? 0 }}</p>
          </div>
          <div class="px-4 py-5 bg-emerald-50/50 rounded-xl border border-emerald-200">
            <p class="text-sm text-slate-500 mb-2">今日新增</p>
            <p class="text-4xl font-bold text-emerald-600">{{ data.reports?.today ?? 0 }}</p>
          </div>
          <div class="px-4 py-5 bg-blue-50/50 rounded-xl border border-blue-200">
            <p class="text-sm text-slate-500 mb-2">本周新增</p>
            <p class="text-4xl font-bold text-blue-600">{{ data.reports?.week ?? 0 }}</p>
          </div>
          <div class="col-span-3 grid grid-cols-2 gap-4">
            <div class="flex items-center gap-3 px-4 py-4 bg-violet-50/50 rounded-xl border border-violet-200">
              <div class="w-12 h-12 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/></svg>
              </div>
              <div>
                <p class="text-sm text-slate-500">用户上传</p>
                <p class="text-2xl font-bold text-violet-700">{{ data.reports?.user ?? 0 }}</p>
              </div>
            </div>
            <div class="flex items-center gap-3 px-4 py-4 bg-amber-50/50 rounded-xl border border-amber-200">
              <div class="w-12 h-12 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clip-rule="evenodd"/></svg>
              </div>
              <div>
                <p class="text-sm text-slate-500">后台导入</p>
                <p class="text-2xl font-bold text-amber-700">{{ data.reports?.admin ?? 0 }}</p>
              </div>
            </div>
            <div class="col-span-2 flex items-center justify-between px-4 py-4 bg-indigo-50/50 rounded-xl border border-indigo-200">
              <span class="text-base font-bold text-slate-700">用户占比</span>
              <span class="text-2xl font-bold text-indigo-600">{{ ((data.reports?.user ?? 0) / Math.max(data.reports?.total ?? 1, 1) * 100).toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
            </div>
            <h3 class="font-bold text-slate-800">文件统计</h3>
          </div>
        </template>
        <div class="flex flex-col gap-4 p-6">
          <div class="flex items-center justify-between px-4 py-5 bg-teal-50/50 rounded-xl border border-teal-200">
            <p class="text-base font-bold text-slate-700">文件总数</p>
            <p class="text-5xl font-bold text-teal-600">{{ data.files?.total ?? 0 }}</p>
          </div>
          <div class="flex items-center justify-between px-4 py-4 bg-slate-50 rounded-xl border border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-rose-500 shrink-0"/>
              <span class="text-base text-slate-700">崩溃报告</span>
            </div>
            <span class="text-xl font-bold text-slate-800">{{ data.files?.crash ?? 0 }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-4 bg-slate-50 rounded-xl border border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-amber-500 shrink-0"/>
              <span class="text-base text-slate-700">游戏日志</span>
            </div>
            <span class="text-xl font-bold text-slate-800">{{ data.files?.gamelog ?? 0 }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-4 bg-slate-50 rounded-xl border border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-blue-500 shrink-0"/>
              <span class="text-base text-slate-700">启动日志</span>
            </div>
            <span class="text-xl font-bold text-slate-800">{{ data.files?.log ?? 0 }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-4 bg-slate-50 rounded-xl border border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-green-500 shrink-0"/>
              <span class="text-base text-slate-700">讨论记录</span>
            </div>
            <span class="text-xl font-bold text-slate-800">{{ data.files?.discuss ?? 0 }}</span>
          </div>
          <div class="flex items-center justify-between px-4 py-4 bg-slate-50 rounded-xl border border-slate-100">
            <div class="flex items-center gap-3">
              <div class="w-3 h-3 rounded-full bg-slate-400 shrink-0"/>
              <span class="text-base text-slate-700">其他文件</span>
            </div>
            <span class="text-xl font-bold text-slate-800">{{ data.files?.other ?? 0 }}</span>
          </div>
        </div>
      </Card>
      <Card>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>
            </div>
            <h3 class="font-bold text-slate-800">历史统计</h3>
          </div>
        </template>
        <div class="grid grid-cols-2 gap-4 p-6">
          <div class="px-4 py-5 bg-purple-50/50 rounded-xl border border-purple-200">
            <p class="text-sm text-slate-500 mb-2">分析次数</p>
            <p class="text-4xl font-bold text-purple-600">{{ data.analyses ?? 0 }}</p>
          </div>
          <div class="px-4 py-5 bg-pink-50/50 rounded-xl border border-pink-200">
            <p class="text-sm text-slate-500 mb-2">向量数据</p>
            <p class="text-4xl font-bold text-pink-600">{{ data.vectors ?? 0 }}</p>
          </div>
          <div class="col-span-2 flex items-center justify-between px-4 py-4 bg-sky-50/50 rounded-xl border border-sky-200">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/></svg>
              </div>
              <span class="text-base text-slate-700">访问次数</span>
            </div>
            <span class="text-2xl font-bold text-sky-700">{{ data.visits ?? 0 }}</span>
          </div>
          <div class="col-span-2 flex items-center justify-between px-4 py-4 bg-orange-50/50 rounded-xl border border-orange-200">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M5.5 13a3.5 3.5 0 01-.369-6.98 4 4 0 117.753-1.977A4.5 4.5 0 1113.5 13H11V9.413l1.293 1.293a1 1 0 001.414-1.414l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13H5.5z"/><path d="M9 13h2v5a1 1 0 11-2 0v-5z"/></svg>
              </div>
              <span class="text-base text-slate-700">上传次数</span>
            </div>
            <span class="text-2xl font-bold text-orange-700">{{ data.uploads ?? 0 }}</span>
          </div>
          <div class="col-span-2 flex items-center justify-between px-4 py-4 bg-fuchsia-50/50 rounded-xl border border-fuchsia-200">
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-lg bg-fuchsia-100 text-fuchsia-600 flex items-center justify-center shrink-0">
                <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"/><path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"/><path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"/></svg>
              </div>
              <span class="text-base text-slate-700">向量/报告比</span>
            </div>
            <span class="text-2xl font-bold text-fuchsia-700">{{ ((data.vectors ?? 0) / Math.max(data.reports?.total ?? 1, 1)).toFixed(1) }}</span>
          </div>
        </div>
      </Card>
      <Card>
        <template #header>
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-cyan-50 text-cyan-600 flex items-center justify-center">
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3z" clip-rule="evenodd"/></svg>
            </div>
            <h3 class="font-bold text-slate-800">占用统计</h3>
          </div>
        </template>
        <div class="flex flex-col gap-4 p-6">
          <div class="px-4 py-5 bg-lime-50/50 rounded-xl border border-lime-200">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-slate-500">CPU 负债</p>
              <p class="text-sm text-slate-600">利用率 <span class="font-bold text-lime-700">{{ cpuPercent }}</span></p>
            </div>
            <p class="text-4xl font-bold text-lime-600 mb-3">{{ data.cpu ?? '0.00' }}</p>
            <div class="relative h-3 w-full bg-slate-200 rounded-full overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-r from-lime-500 to-lime-600 transition-all duration-500 rounded-full" :style="{ width: cpuPercent }"/>
            </div>
          </div>
          <div class="px-4 py-5 bg-rose-50/50 rounded-xl border border-rose-200">
            <div class="flex items-center justify-between mb-2">
              <p class="text-sm text-slate-500">内存占用</p>
              <p class="text-sm text-slate-600"><span class="font-bold text-rose-700">{{ data.memory?.used ?? '0 B' }}</span> / {{ data.memory?.total ?? '0 B' }}</p>
            </div>
            <p class="text-4xl font-bold text-rose-600 mb-3">{{ data.memory?.percent ?? '0' }}<span class="text-2xl">%</span></p>
            <div class="relative h-3 w-full bg-slate-200 rounded-full overflow-hidden">
              <div class="absolute inset-0 bg-gradient-to-r from-rose-500 to-rose-600 transition-all duration-500 rounded-full" :style="{ width: `${data.memory?.percent ?? 0}%` }"/>
            </div>
          </div>
          <div class="flex items-center gap-3 px-4 py-5 bg-cyan-50/50 rounded-xl border border-cyan-200">
            <div class="w-12 h-12 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center shrink-0">
              <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z"/><path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z"/><path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z"/></svg>
            </div>
            <div>
              <p class="text-sm text-slate-500">磁盘占用</p>
              <p class="text-2xl font-bold text-cyan-700">{{ data.disk ?? '0 B' }}</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
const loading = ref(false)
const data = ref({
  reports: { total: 0, user: 0, admin: 0, today: 0, week: 0 },
  files: { total: 0, crash: 0, gamelog: 0, log: 0, discuss: 0, other: 0 },
  vectors: 0, visits: 0, analyses: 0, uploads: 0, cpu: '0.00', disk: '0 B',
  memory: { percent: '0', used: '0 B', total: '0 B' },
})

const cpuPercent = computed(() => `${Math.min(parseFloat(data.value.cpu) * 100, 100).toFixed(0)}%`)

async function fetch() {
  try {
    const res = await window.fetch('/api/status')
    if (res.ok) {
      const result = await res.json()
      data.value = result.data || result
    }
  } catch (err) {
    console.error('[Status] 获取失败：', err)
  }
}

async function refresh() {
  if (loading.value) return
  loading.value = true
  await fetch()
  setTimeout(() => loading.value = false, 1000)
}

onMounted(() => fetch())
</script>
