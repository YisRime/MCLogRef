<template>
  <label :class="['inline-flex items-center gap-2 cursor-pointer', disabled && 'opacity-40 cursor-not-allowed']">
    <input type="checkbox" :checked="modelValue" :disabled="disabled" class="sr-only" @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)" >
    <span :class="['inline-flex items-center justify-center rounded transition-all duration-300 border-2', sizeMap[size], disabled ? (modelValue ? 'bg-slate-300 border-slate-400' : 'bg-slate-100 border-slate-300') : modelValue ? 'bg-gradient-to-br from-cyan-500 to-teal-500 border-cyan-500 shadow-sm' : 'bg-white/80 border-slate-200 shadow-sm focus:border-cyan-400']">
      <svg v-if="modelValue" :class="['w-3 h-3', disabled ? 'text-slate-50' : 'text-white']" fill="currentColor" viewBox="0 0 12 12"><path d="M10.28 2.28L4.5 8.06 1.72 5.28a1 1 0 00-1.41 1.41l3.5 3.5a1 1 0 001.41 0l6.5-6.5a1 1 0 00-1.41-1.41z" /></svg>
    </span>
    <span v-if="label" :class="['text-sm font-medium', disabled ? 'text-slate-400' : 'text-slate-700']">{{ label }}</span>
  </label>
</template>
<script setup lang="ts">
const { modelValue = false, label = '', size = 'md', disabled = false } = defineProps<{ modelValue?: boolean; label?: string; size?: 'sm' | 'md' | 'lg'; disabled?: boolean }>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
const sizeMap = { sm: 'w-4 h-4', md: 'w-5 h-5', lg: 'w-6 h-6' }
</script>