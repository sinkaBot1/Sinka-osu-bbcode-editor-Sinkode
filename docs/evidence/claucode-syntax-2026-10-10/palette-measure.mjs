// Claucode 当前编辑器配色的可复查测量脚本：WCAG 对比度与 OKLab/OKLCh。
// 零依赖，不联网，不写任何文件。规则见本目录 README.md 与 docs/theme.md。

const hexToRgb = (hex) => {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
}

const srgbToLinear = (channel) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

const luminance = (rgb) => {
  const [r, g, b] = rgb.map(srgbToLinear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrast = (a, b) => {
  const first = luminance(a)
  const second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

const rgbToOklab = (rgb) => {
  const [r, g, b] = rgb.map(srgbToLinear)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

const oklch = (rgb) => {
  const [L, A, B] = rgbToOklab(rgb)
  let hue = (Math.atan2(B, A) * 180) / Math.PI
  if (hue < 0) hue += 360
  return { L, C: Math.hypot(A, B), h: hue }
}

const deltaE = (a, b) => {
  const first = rgbToOklab(hexToRgb(a))
  const second = rgbToOklab(hexToRgb(b))
  return Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]) * 100
}

const background = hexToRgb('#faf9f5')
const text = '#141413'
const tokens = {
  bracket: '#8b54d5',
  slash: '#8b54d5',
  tag: '#00825d',
  equals: '#8b54d5',
  parameter: '#c04e00',
  invalid: '#e40033',
}

console.log(`底色 #faf9f5  正文 ${text}（正文对底 ${contrast(hexToRgb(text), background).toFixed(2)}:1）`)
for (const [key, hex] of Object.entries(tokens)) {
  const { L, C, h } = oklch(hexToRgb(hex))
  console.log(
    `${key.padEnd(10)} ${hex}  对底 ${contrast(hexToRgb(hex), background).toFixed(2)}:1  ` +
      `C=${C.toFixed(3)} L=${L.toFixed(3)} h=${h.toFixed(1)}°  与正文 ΔE=${deltaE(hex, text).toFixed(1)}`,
  )
}

const entries = Object.entries(tokens)
const averageC = entries.reduce((sum, [, hex]) => sum + oklch(hexToRgb(hex)).C, 0) / entries.length
let nearest = { value: Infinity, pair: '' }
for (let i = 0; i < entries.length; i++) {
  for (let j = i + 1; j < entries.length; j++) {
    if (entries[i][1] === entries[j][1]) continue
    const value = deltaE(entries[i][1], entries[j][1])
    if (value < nearest.value) nearest = { value, pair: `${entries[i][0]}↔${entries[j][0]}` }
  }
}

console.log(`平均饱和度 C=${averageC.toFixed(3)}   最小异色 ΔE=${nearest.value.toFixed(2)}（${nearest.pair}）`)
console.log(`当前行底色 #e9dfc9 与编辑器底色对比度 ${contrast(hexToRgb('#e9dfc9'), background).toFixed(2)}:1`)
