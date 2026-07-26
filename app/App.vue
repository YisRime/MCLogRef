<template>
  <div class="h-screen bg-gradient-to-br from-slate-50 via-cyan-50 to-teal-50 relative overflow-hidden flex flex-col">
    <div class="fixed rounded-full pointer-events-none z-0 w-96 h-96 opacity-25 bg-gradient-to-br from-cyan-400 to-cyan-600 -top-32 -right-24 blur-3xl"/>
    <div class="fixed rounded-full pointer-events-none z-0 w-80 h-80 opacity-25 bg-gradient-to-br from-cyan-300 to-teal-400 -bottom-20 left-48 blur-3xl"/>
    <div class="fixed rounded-full pointer-events-none z-0 w-64 h-64 opacity-20 bg-gradient-to-br from-cyan-200 to-teal-200 top-1/2 right-1/4 blur-3xl"/>
    <nav class="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg shadow-cyan-500/10 px-3 py-2 flex items-center gap-2 border border-cyan-100/50">
      <div class="flex items-center gap-2">
        <svg class="w-6 h-6 text-cyan-600 cursor-pointer flex-shrink-0" fill="currentColor" viewBox="0 0 24 24" @click="isAuthenticated ? null : (showAuthInput = !showAuthInput)">
          <rect x="3" y="3" width="7" height="7" rx="1.5" opacity="0.9"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5" opacity="0.6"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5" opacity="0.6"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5" opacity="0.9"/>
          <circle cx="6.5" cy="6.5" r="1.5" fill="white" opacity="0.5"/>
          <circle cx="17.5" cy="17.5" r="1.5" fill="white" opacity="0.5"/>
          <line x1="10" y1="6.5" x2="14" y2="6.5" stroke="currentColor" stroke-width="1" opacity="0.4"/>
          <line x1="6.5" y1="10" x2="6.5" y2="14" stroke="currentColor" stroke-width="1" opacity="0.4"/>
        </svg>
        <NuxtLink to="/" class="text-sm font-semibold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent whitespace-nowrap">MCLogRef</NuxtLink>
      </div>
      <template v-if="isAuthenticated">
        <NuxtLink to="/report" class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 text-sm font-medium border hover:scale-105 whitespace-nowrap ml-2" active-class="bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/30 border-transparent" :class="[$route.path === '/report' ? 'text-white border-transparent' : 'text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 border-slate-200']">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
          </svg>
          <span>文档</span>
        </NuxtLink>
        <NuxtLink to="/status" class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 text-sm font-medium border hover:scale-105 whitespace-nowrap" active-class="bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/30 border-transparent" :class="[$route.path === '/status' ? 'text-white border-transparent' : 'text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 border-slate-200']">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"/>
          </svg>
          <span>状态</span>
        </NuxtLink>
        <NuxtLink to="/option" class="px-3 py-1.5 rounded-xl transition-all flex items-center gap-2 text-sm font-medium border hover:scale-105 whitespace-nowrap" active-class="bg-gradient-to-br from-cyan-500 to-teal-500 text-white shadow-md shadow-cyan-500/30 border-transparent" :class="[$route.path === '/option' ? 'text-white border-transparent' : 'text-slate-500 hover:bg-cyan-50 hover:text-cyan-600 border-slate-200']">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
          <span>选项</span>
        </NuxtLink>
      </template>
      <template v-else>
        <Transition>
          <div v-if="showAuthInput" class="flex items-center gap-2 ml-2">
            <input v-model="authToken" type="password" class="px-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 bg-white/80 w-24" placeholder="Token...">
          </div>
        </Transition>
      </template>
    </nav>
    <main :class="[$route.path === '/' ? 'h-full relative z-10' : 'relative z-10 flex-1 overflow-y-auto']">
      <div :class="[$route.path === '/' ? 'w-3/5 mx-auto' : 'w-4/5 mx-auto']">
        <NuxtPage />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
const isAuthenticated = ref(false)
const showAuthInput = ref(false)
const authToken = ref('')
let validateTimer: NodeJS.Timeout | null = null

const checkAuth = async () => {
  try {
    const res = await fetch('/api/auth')
    const data = await res.json()
    isAuthenticated.value = data?.data?.authenticated ?? false
  } catch {
    isAuthenticated.value = false
  }
}

const validateToken = async (token: string) => {
  if (!token) return
  const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) })
  const data = await res.json()
  if (data.status === 200) {
    isAuthenticated.value = true
    authToken.value = ''
    showAuthInput.value = false
  }
}

watch(authToken, (newToken) => {
  if (validateTimer) clearTimeout(validateTimer)
  if (newToken) validateTimer = setTimeout(() => { validateToken(newToken) }, 1000)
})

onMounted(checkAuth)
</script>
