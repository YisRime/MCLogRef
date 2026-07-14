<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 backdrop-blur-sm p-4" @click.self="close">
        <div :class="['bg-white/90 backdrop-blur-xl rounded-2xl border border-white shadow-2xl shadow-cyan-900/10 w-full flex flex-col', sizeMap[size]]" @click.stop>
          <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 class="font-bold text-slate-800">{{ title }}</h3>
            <button class="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center transition-colors text-slate-400 hover:text-slate-600" @click="close">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div class="px-5 pb-5 overflow-y-auto min-h-0">
            <slot />
          </div>
          <div v-if="$slots.footer" class="px-5 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
<script setup lang="ts">
const { modelValue, title = '', size = 'md', closeOnClickOutside = true } = defineProps<{ modelValue: boolean; title?: string; size?: 'sm' | 'md' | 'lg' | 'xl'; closeOnClickOutside?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()
const sizeMap = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }
function close() { if (closeOnClickOutside) emit('update:modelValue', false) }
</script>
<style scoped>
.modal-enter-active, .modal-leave-active { transition: opacity 0.3s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-active > div:last-child, .modal-leave-active > div:last-child { transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
.modal-enter-from > div:last-child { transform: scale(0.95); }
.modal-leave-to > div:last-child { transform: scale(0.98); }
</style>