// 用真实浏览器渲染当前 Claucode 编辑器状态并截图。
//
// 只访问本机回环 http://127.0.0.1:4173，不访问任何站外地址。
// 运行前先起本机服务：npm run dev -- --host 127.0.0.1 --port 4173
// 截图写到当前工作目录的 .tmp/ 下。

import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const outDir = resolve('.tmp')
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1180, height: 900 }, deviceScaleFactor: 2 })
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'load' })

// 切到 Claucode：默认主题是 Darkode
await page
  .getByRole('navigation', { name: '工作台入口' })
  .getByRole('button', { name: '主题', exact: true })
  .click()
await page
  .getByRole('dialog', { name: '选择主题' })
  .locator('.theme-option')
  .filter({ hasText: 'Claucode' })
  .click()
await page.keyboard.press('Escape')
await page.waitForTimeout(1200)

const editor = page.locator('.editor-panel')
const readToken = (name) =>
  page.evaluate(
    (token) => getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    name,
  )
const tokens = ['--syntax-bracket', '--syntax-tag', '--syntax-parameter', '--editor-active-line']

await page.waitForTimeout(400)
await editor.screenshot({ path: resolve(outDir, 'editor-final-purple.png') })
const values = []
for (const name of tokens) values.push(`${name}=${await readToken(name)}`)
console.log(`Claucode 当前状态  editor-final-purple.png  ${values.join('  ')}`)

await browser.close()
console.log('截图已写入 .tmp/')
