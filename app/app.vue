<template>
  <div class="min-h-screen bg-gray-50/50 text-gray-800">
    <nav
      :class="[
        'fixed top-0 left-0 right-0 z-40 transition-all duration-300 border-b',
        isScrolled ? 'bg-white/80 backdrop-blur-xl border-gray-200/50 shadow-sm' : 'bg-transparent border-transparent'
      ]"
    >
      <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <NuxtLink to="/" class="flex items-center gap-2.5 group">
          <div class="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold shadow-md group-hover:bg-blue-700 transition-colors">M</div>
          <div class="flex flex-col">
            <span class="text-lg font-bold leading-none text-gray-900">MCLogRef</span>
            <span class="text-xs text-blue-600 font-medium">崩溃分析系统</span>
          </div>
        </NuxtLink>
        <div class="flex items-center gap-2">
          <NuxtLink
            v-for="item in navItems" :key="item.path" :to="item.path"
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              route.path === item.path ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100/80'
            ]"
          >
            {{ item.label }}
          </NuxtLink>
        </div>
      </div>
    </nav>
    <main class="pt-24 pb-12 px-6">
      <div class="max-w-6xl mx-auto">
        <NuxtPage />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()
const isScrolled = ref(false)

const navItems = [
  { path: '/', label: '首页' },
  { path: '/report', label: '报告' },
  { path: '/option', label: '设置' },
]

onMounted(() => {
  window.addEventListener('scroll', () => { isScrolled.value = window.scrollY > 10 })
})
</script>