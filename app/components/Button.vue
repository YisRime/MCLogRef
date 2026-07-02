<template>
  <button :disabled="disabled" :class="['inline-flex justify-center items-center rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed border', sizeMap[size], typeMap[variant], $attrs.class]" @click="$emit('click', $event)">
    <slot />
  </button>
</template>
<script setup lang="ts">
const { size = 'md', variant = 'primary', disabled = false } = defineProps<{ size?: 'sm' | 'md' | 'lg'; variant?: 'primary' | 'secondary' | 'outline' | 'ghost'; disabled?: boolean }>()
defineEmits<{ click: [event: MouseEvent] }>()
const sizeMap = { sm: 'py-1.5 px-3 text-xs', md: 'py-2.5 px-4 text-sm', lg: 'py-3 px-5 text-sm' }
const typeMap = {
  primary: 'text-white bg-cyan-500 hover:bg-cyan-600 border-cyan-500 hover:border-cyan-600 shadow-sm',
  secondary: 'text-slate-700 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 shadow-sm',
  outline: 'text-cyan-600 bg-transparent border-cyan-500 hover:bg-cyan-50 hover:border-cyan-600',
  ghost: 'text-slate-600 bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-200',
}
</script>
