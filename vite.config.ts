import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 站点通过 GitHub Pages 的自定义域名 sinkodeosu.site 以**根路径**发布，资源前缀固定为 `/`。
// 项目页形式（`<用户名>.github.io/<仓库名>/`）才需要改成 `/<仓库名>/`；改回项目页时
// 必须同时更新 docs/deployment.md，否则线上会白屏并伴随大量 404。
export default defineConfig({
  base: '/',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
