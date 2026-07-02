<template>
  <div :class="['bg-white/60 backdrop-blur-xl rounded-2xl border border-white shadow-xl shadow-cyan-900/5 transition-all duration-300 overflow-hidden', $attrs.class]">
    <div v-if="$slots.header || header" class="px-5 py-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
      <slot name="header"><h3 class="font-bold text-slate-800">{{ header }}</h3></slot>
    </div>
    <slot />
  </div>
</template>
<script setup lang="ts">
const { header = '' } = defineProps<{ header?: string }>()
</script>