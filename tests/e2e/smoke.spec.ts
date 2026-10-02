import { expect, test } from '@playwright/test'
import { installNetworkIsolation } from './helpers'

test('首页直接进入编辑器工作区', async ({ page }) => {
  await installNetworkIsolation(page)
  await page.goto('/')
  await expect(page.getByRole('main', { name: 'BBCode 编辑工作区' })).toBeVisible()
  await expect(page).toHaveTitle('osu! BBCode Editor | Sinkode')
})
