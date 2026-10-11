# imagemap 悬停气泡证据

本目录保存 imagemap 气泡的参考截图、当前实现截图和固定复现输入。证据对应当前预览行为。

## 固定输入

```bbcode
[imagemap]
https://example.com/map.png
45 40 10 10 https://example.com/area 左侧热区
[/imagemap]
```

测试将图片替换为本地 400×300 SVG，不请求真实图床。

## 当前行为

- 气泡外层只负责定位和一次 `opacity` 过渡；文字节点绘制圆角黑底，箭头位于文字框之外，两侧露出原图。
- 箭头尺寸为 `16×8px`，跟随气泡上下翻转和横向避让移动，尖端指向热区边缘。
- 文字与箭头由同一个父级透明度控制，子级透明度保持 `1`；外层不绘制背景，避免遮住箭头两侧的原图。
- 鼠标停顿 `200ms` 后显示，移出后 `150ms` 淡出；键盘聚焦立即显示。页面或面板滚动、窗口缩放和内容重渲染时收起。
- 热区说明文字使用 `aria-label`，不依赖浏览器原生 `title` 提示；气泡不参与指针命中。
- 低动态效果模式下取消等待并即时显示，不播放淡入淡出。

## 证据文件

- `official.png`：参考外观。
- `after.png`：当前实现截图。

实现和验收规则见[兼容性说明](../../compatibility.md) D-17、[工作台说明](../../workbench.md)和[测试说明](../../testing.md)。像素检查见 `tests/e2e/preview.spec.ts` 与 `tests/e2e/help.spec.ts`。

## 复核输入

```bbcode
[imagemap]
https://example.invalid/offline-map.svg
30 45 50 15 https://example.invalid/region SINKA0
[/imagemap]
```

端到端测试通过本机服务和网络隔离提供图片替身，不访问站外地址。
