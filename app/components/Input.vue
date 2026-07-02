<template>
  <div class="flex flex-col gap-1.5 w-full">
    <label v-if="label" :for="inputId" class="text-xs font-bold text-slate-500">{{ label }}</label>
    <div class="relative">
      <input :id="inputId" :type="type" :value="modelValue" :placeholder="placeholder" :disabled="disabled" :class="['block w-full rounded-xl bg-white/80 border border-slate-200 shadow-sm focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 text-sm text-slate-700 transition-all placeholder:text-slate-400 outline-none disabled:opacity-50', sizeMap[size], error && 'border-rose-400 focus:border-rose-500 focus:ring-rose-100 pr-24']" @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)" >
      <span v-if="error" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-rose-500 font-medium pointer-events-none">{{ error }}</span>
    </div>
  </div>
</template>
<script setup lang="ts">
const { modelValue = '', type = 'text', label = '', placeholder = '', size = 'md', disabled = false, error = '' } = defineProps<{ modelValue?: string | number; type?: 'text' | 'password' | 'email' | 'number'; label?: string; placeholder?: string; size?: 'sm' | 'md' | 'lg'; disabled?: boolean; error?: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()
const sizeMap = { sm: 'px-3 py-2 text-xs', md: 'py-2.5 px-3.5', lg: 'px-4 py-3 text-base' }
const inputId = `input-${Math.random().toString(36).substr(2, 9)}`
</script>