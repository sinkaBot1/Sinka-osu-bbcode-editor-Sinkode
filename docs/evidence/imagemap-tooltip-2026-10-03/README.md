# imagemap 悬停气泡修复证据（2026-10-03）

## 来源与范围

- `official.png`：所有者提供的官网截图，圆角文字框下方有向下三角尖，箭头两侧没有矩形背景。
- `before.png`：所有者提供的项目截图，气泡显示为没有可见尖端的矩形。
- `earlier-rectangle.png`：原先留在仓库根目录的 `evidence-tooltip-arrow.png`，归档后保留其原始像素。该本地诊断图显示矩形背景吞掉箭头的旧问题；缩放比例与原始输入未记录，不作为正确样式的测量依据。
- 截图未附原始 BBCode、缩放比例或官网版本，不能据此重新推定字号、内边距、配色或上游提交。保留兼容性说明 §6.4 已授权的尺寸与黑底白字令牌，D-09 常驻粉色热区不改。
- 固定输入沿用 `tests/e2e/preview.spec.ts` 的悬停样例，图片由测试拦截为 400×300 纯色 SVG，不请求真实图床。

```bbcode
[imagemap]
https://example.com/map.png
45 40 10 10 https://example.com/area 左侧热区
[/imagemap]
```

## 修复约束与验收

1. 外层只负责定位与一次透明度过渡，不绘制背景；文字节点绘制圆角背景，箭头位于文字框之外。箭头两侧必须露出原图。
2. 框体与箭头由父级透明度统一淡入淡出，子级透明度恒为 1。比较最终有效透明度（父级 × 子级），不能只比较局部透明度。
3. 上下翻转前后整体尺寸相同，尖端贴在热区边缘；横向避让视口时箭头随锚点移动，不仍固定在框体中心。
4. 浏览器测试读取截图像素检查箭头中心与两侧，覆盖上方、下方与右侧边界。只检查 DOM 与尺寸不足以确认实际可见。

实现独立基于本项目结构与所有者截图；未获取或复制 osu-web 源码、样式表或素材。

## 最终复核结果

- 按顺序执行 `npm run format:check`、`npm run lint`、`npm run typecheck`、`npm run test`、`npm run build`、`npm run test:e2e`，全部通过：16 个单元/组件测试文件、99 条用例，90 条端到端用例。
- `npm run docs:check`、`node tests/check-osu-web-fixtures.mjs`、`git diff --check` 全部通过；固定样例矩阵为 49 个 case、24 个标签。
- 离线隔离额外覆盖新窗口首次导航、伪装本机域名和站外 WebSocket；所有站外目标都在浏览器内使用替身或关闭连接。未安装依赖、未禁用安全检查、未访问真实站外服务。
- 自动化完成后进行本地浏览器复核：连续三次悬停与移出、键盘聚焦、窗口缩放后收起，均通过。读取 `after.png` 确认三角尖端可见、两侧无矩形背景。
- 实测文字框高度 `26.1875px`、整体高度 `34.1875px`、箭头 `16×8px`，文字框与箭头接缝误差 `0px`，尖端与热区边缘误差 `0.1875px`（定位坐标取整造成的亚像素差）。外层背景透明，文字框仍为既有黑色令牌。
- 构建仍有既有的主包超过 `500kB` 提示（约 `524.87kB`），不影响本次构建成功，未扩大范围处理。

`after.png` 是独立复核截图：图片为本地生成的 400×300 纯色 SVG，使用如下输入，并非官网原图的逐像素比对。

```bbcode
[imagemap]
https://example.invalid/offline-map.svg
30 45 50 15 https://example.invalid/region SINKA0
[/imagemap]
```

如需继续对齐官网文字框的尺寸、字号与间距，需要原始 BBCode、浏览器缩放比例或对应测量记录；本次不据未标定截图改动既有尺寸、字号或配色。

## 本轮修改文件

- `src/app/theme.css`：透明定位外层、圆角文字背景、独立三角尖端与一次整体淡入淡出。
- `src/preview/PreviewPane.vue`：横向避让后箭头继续对准热区。
- `tests/e2e/preview.spec.ts`：实际截图像素、上下翻转、右侧边界、最终有效透明度检查。
- `tests/e2e/help.spec.ts`：帮助里的同一预览组件同步更新断言。
- `tests/e2e/helpers.ts`、`tests/e2e/network-isolation.spec.ts`、`playwright.config.ts`：离线验收覆盖弹窗、准确的本机主机名、WebSocket 与 Service Worker 约束；不改变软件的真实外链功能。
- `docs/compatibility.md`、`docs/workbench.md`、`docs/testing.md`：同步实际绘制结构、验证标准与离线验收规则。
- 本证据目录的 `README.md`、`official.png`、`before.png`、`after.png`：所有者截图、固定复现输入、修复截图与验证结果。
- `earlier-rectangle.png`：从仓库根目录归档的旧诊断截图。

上述验收记录属于热区修复阶段；后续默认禁联网规则与测试隔离已单独整理，持久规则见仓库的 `AGENTS.md`。变更历史以 Git 提交记录为准。

## 外链测试隔离收尾（2026-10-03）

- 依据：本地 `tests/e2e/header.spec.ts` 中两个固定外链用例原先仍注册了页面级 `page.route()`；真正接管新窗口首次导航的是 `tests/e2e/helpers.ts` 的上下文级隔离。删除这两处旧拦截，避免误导维护者。
- 为两个外链用例补充新窗口内容为空的断言，锁定其显示的是统一隔离提供的本地替身页面；保留原有链接地址、打开新窗口与安全属性断言，不改变产品实现。
- 范围仅为 `tests/e2e/header.spec.ts`、`docs/testing.md` 和本证据文件；保留已有防遗漏回归测试及 Service Worker、站外 WebSocket 保护，不扩大为测试框架重构。
- 验收先运行顶栏与网络隔离专项，再按六条固定命令顺序复核；全程使用本机服务与站外替身，不联网校验目标网站。
- 收尾验收结果：顶栏与隔离专项 14 条通过；六条固定命令全部通过，99 条单元/组件测试与 90 条端到端测试通过；文档检查、49 个固定样例检查与差异空白检查通过。保留既有大包构建提示；没有新增依赖、产品行为改动或必须由所有者提供的后续输入。
