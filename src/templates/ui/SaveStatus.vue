<script setup lang="ts">
import type { SaveState } from '../store/saveScheduler'

defineProps<{
  status: SaveState
  text: string
}>()
</script>

<template>
  <span class="save-status" :class="`save-status--${status}`" role="status">
    <span class="save-status-dot" aria-hidden="true"></span>{{ text }}
  </span>
</template>
