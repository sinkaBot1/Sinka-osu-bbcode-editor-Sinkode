<script setup lang="ts">
import type { SaveState } from '../store/saveScheduler'

defineProps<{
  status: SaveState
  text: string
}>()
</script>

<template>
  <span class="save-status" :class="`save-status--${status}`" role="status">{{ text }}</span>
</template>
