import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

// 生产产物验收入口：沿用同一套用例与浏览器矩阵，只把被测对象换成构建后的 dist。
// 默认使用独立端口且禁止复用已存在的服务，避免开发服务器冒充生产构建验收；
// 在 taskkill 受限的会话中可用 E2E_PREVIEW_REUSE=1 复用自行启动的 preview。
export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL: 'http://127.0.0.1:4174',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: process.env.E2E_PREVIEW_REUSE === '1',
    timeout: 180_000,
  },
})
