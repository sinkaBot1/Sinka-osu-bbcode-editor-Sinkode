import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 站点通过 GitHub Pages 的自定义域名以**根路径**发布，资源前缀固定为 `/`。
// 若改回项目页形式（`<用户名>.github.io/<仓库名>/`），必须改成 `/<仓库名>/`，
// 否则线上会白屏并伴随大量 404。
export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
