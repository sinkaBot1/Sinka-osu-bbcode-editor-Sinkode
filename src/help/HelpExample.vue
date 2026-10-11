<script setup lang="ts">
import { computed } from 'vue'
import { compileForPreview } from '../bbcode/compatibility'
import PreviewPane from '../preview/PreviewPane.vue'
import exampleImage from './assets/example-image.svg'

const props = defineProps<{ source: string }>()

const example = computed(() => {
  const result = compileForPreview(props.source)
  // template 内容保持惰性，在挂载前替换媒体地址，避免帮助示例请求第三方。
  const template = document.createElement('template')
  template.innerHTML = result.sanitizedHtml
  const hasMedia = template.content.querySelector('img, audio, iframe') !== null

  for (const image of template.content.querySelectorAll('img')) {
    image.src = exampleImage
    image.alt = '本地示意图'
  }
  for (const audio of template.content.querySelectorAll('audio')) {
    audio.removeAttribute('src')
    audio.preload = 'none'
    audio.setAttribute('aria-label', '音频控件示意，不播放远程音频')
  }
  for (const iframe of template.content.querySelectorAll('iframe')) {
    const placeholder = document.createElement('div')
    placeholder.className = 'help-example-video'
    placeholder.textContent = 'YouTube 视频区域'
    iframe.replaceWith(placeholder)
  }

  return { result: { ...result, sanitizedHtml: template.innerHTML, media: [] }, hasMedia }
})
</script>

<template>
  <div class="help-panel-effect">
    <PreviewPane :result="example.result" />
    <p v-if="example.hasMedia" class="help-example-media-note">
      本地示意：图片使用示意图，音频和视频不加载或播放远程资源。
    </p>
  </div>
</template>
