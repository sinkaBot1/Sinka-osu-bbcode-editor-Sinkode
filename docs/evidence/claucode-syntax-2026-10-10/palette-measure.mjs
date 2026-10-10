// Claucode 编辑器配色的可复查测量脚本：WCAG 对比度、OKLab/OKLCh、
// "色相 → 饱和度上限"扫描与候选方案评估。零依赖，不联网，不写任何文件。
// 结论与规则见本目录 README.md 与 docs/theme.md §2.6、§6。

const hexToRgb = (hex) => {
  const value = hex.replace('#', '')
  return [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255)
}
const srgbToLinear = (channel) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
const linearToSrgb = (channel) =>
  channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055

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
const oklabToRgb = ([L, A, B]) => {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(linearToSrgb)
}

const oklch = (rgb) => {
  const [L, A, B] = rgbToOklab(rgb)
  let hue = (Math.atan2(B, A) * 180) / Math.PI
  if (hue < 0) hue += 360
  return { L, C: Math.hypot(A, B), h: hue }
}
const fromOklch = (L, C, hue) =>
  oklabToRgb([L, C * Math.cos((hue * Math.PI) / 180), C * Math.sin((hue * Math.PI) / 180)])
const inGamut = (rgb) => rgb.every((channel) => channel >= -0.0002 && channel <= 1.0002)
const toHex = (rgb) =>
  '#' +
  rgb
    .map((channel) =>
      Math.round(Math.min(1, Math.max(0, channel)) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
const deltaE = (a, b) => {
  const first = rgbToOklab(hexToRgb(a))
  const second = rgbToOklab(hexToRgb(b))
  return (
    Math.hypot(first[0] - second[0], first[1] - second[1], first[2] - second[2]) * 100
  )
}

const maxChromaAt = (L, hue) => {
  let low = 0
  let high = 0.45
  for (let step = 0; step < 50; step++) {
    const mid = (low + high) / 2
    if (inGamut(fromOklch(L, mid, hue))) low = mid
    else high = mid
  }
  return low
}

// 在给定色相与目标对比度下，求 sRGB 色域内饱和度上限的取值
const solve = (hue, target, background) => {
  let low = 0.2
  let high = 0.95
  for (let step = 0; step < 70; step++) {
    const L = (low + high) / 2
    if (contrast(fromOklch(L, maxChromaAt(L, hue), hue), background) > target) low = L
    else high = L
  }
  const C = maxChromaAt(low, hue)
  return { hex: toHex(fromOklch(low, C, hue)), L: low, C, rgb: fromOklch(low, C, hue) }
}

const lightCanvas = hexToRgb('#faf9f5')
const darkCanvas = hexToRgb('#15181d')
const lightText = hexToRgb('#141413')
const darkText = hexToRgb('#d7dee8')

const palettes = {
  'Darkode（现行，深色）': {
    background: darkCanvas,
    text: darkText,
    tokens: {
      bracket: '#c586c0',
      slash: '#d7ba7d',
      tag: '#4ec9b0',
      equals: '#ffcc66',
      parameter: '#ce9178',
      invalid: '#f44747',
    },
  },
  'Claucode 初版（2026-10-04）': {
    background: lightCanvas,
    text: lightText,
    tokens: {
      bracket: '#8a4a86',
      slash: '#8a6d1f',
      tag: '#2f6b5f',
      equals: '#8a5a00',
      parameter: '#a05236',
      invalid: '#b93b3b',
    },
  },
  '方案 A（只弱化结构符）': {
    background: lightCanvas,
    text: lightText,
    tokens: {
      bracket: '#8d857a',
      slash: '#8d857a',
      tag: '#2f6b5f',
      equals: '#8d857a',
      parameter: '#a05236',
      invalid: '#b93b3b',
    },
  },
  '方案 B（结构符中性化 + 语义提彩）': {
    background: lightCanvas,
    text: lightText,
    tokens: {
      bracket: '#8d857a',
      slash: '#8d857a',
      tag: '#0a5f8f',
      equals: '#8d857a',
      parameter: '#a8452b',
      invalid: '#c02a2a',
    },
  },
  '方案 C + 结构符中性灰（同日一度采用，已推翻）': {
    background: lightCanvas,
    text: lightText,
    tokens: {
      bracket: '#8d857a',
      slash: '#8d857a',
      tag: '#00825d',
      equals: '#8d857a',
      parameter: '#c04e00',
      invalid: '#e40033',
    },
  },
  '最终采用（方案 C + 结构符紫罗兰）': {
    background: lightCanvas,
    text: lightText,
    tokens: {
      bracket: '#8b54d5',
      slash: '#8b54d5',
      tag: '#00825d',
      equals: '#8b54d5',
      parameter: '#c04e00',
      invalid: '#e40033',
    },
  },
  '方案 D（全色相重排）': {
    background: lightCanvas,
    text: lightText,
    tokens: {
      bracket: '#c000e1',
      slash: '#0070da',
      tag: '#007974',
      equals: '#936200',
      parameter: '#bf4100',
      invalid: '#d90031',
    },
  },
}

for (const [name, plan] of Object.entries(palettes)) {
  console.log(`\n===== ${name} =====`)
  console.log(
    `底色 ${toHex(plan.background)}  正文 ${toHex(plan.text)}（正文对底 ${contrast(plan.text, plan.background).toFixed(2)}:1）`,
  )
  const entries = Object.entries(plan.tokens)
  for (const [key, hex] of entries) {
    const { L, C, h } = oklch(hexToRgb(hex))
    console.log(
      `${key.padEnd(10)} ${hex}  对底 ${contrast(hexToRgb(hex), plan.background).toFixed(2)}:1  ` +
        `C=${C.toFixed(3)} L=${L.toFixed(3)} h=${h.toFixed(1)}°  与正文 ΔE=${deltaE(hex, toHex(plan.text)).toFixed(1)}`,
    )
  }
  const averageC = entries.reduce((sum, [, hex]) => sum + oklch(hexToRgb(hex)).C, 0) / entries.length
  let worst = { value: Infinity, pair: '' }
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i][1] === entries[j][1]) continue
      const value = deltaE(entries[i][1], entries[j][1])
      if (value < worst.value) worst = { value, pair: `${entries[i][0]}↔${entries[j][0]}` }
    }
  }
  console.log(
    `平均饱和度 C=${averageC.toFixed(3)}   最小异色 ΔE=${worst.value.toFixed(2)}（${worst.pair}）`,
  )
}

console.log('\n===== #faf9f5 上"色相 → 饱和度上限"扫描（解释标签名为何发灰）=====')
console.log('色相   4.6:1 上限取值        3.2:1 上限取值')
for (let hue = 0; hue < 360; hue += 15) {
  const strict = solve(hue, 4.6, lightCanvas)
  const graphic = solve(hue, 3.2, lightCanvas)
  console.log(
    `${String(hue).padStart(3)}°    C=${strict.C.toFixed(3)} ${strict.hex}    C=${graphic.C.toFixed(3)} ${graphic.hex}`,
  )
}

// 固定色相与饱和度，二分出恰好达到目标对比度的明度（结构符选色用）
const solveAtChroma = (hue, chroma, target, background) => {
  let low = 0.15
  let high = 0.95
  for (let step = 0; step < 80; step++) {
    const L = (low + high) / 2
    const C = Math.min(chroma, maxChromaAt(L, hue))
    if (contrast(fromOklch(L, C, hue), background) > target) low = L
    else high = L
  }
  const C = Math.min(chroma, maxChromaAt(low, hue))
  return { hex: toHex(fromOklch(low, C, hue)), rgb: fromOklch(low, C, hue), C, L: low }
}

console.log('\n===== 结构符候选：固定色相与饱和度，求恰好 ≥4.6:1 的明度 =====')
const references = { 标签名: '#00825d', 参数: '#c04e00', 无效标签: '#e40033', 正文: '#141413' }
console.log('色相  饱和度   取值      实测    与标签名/参数/无效标签/正文 的 OKLab ΔE')
for (const hue of [300, 315, 325, 335]) {
  for (const chroma of [0.14, 0.19, 0.22]) {
    const picked = solveAtChroma(hue, chroma, 4.6, lightCanvas)
    const distances = Object.values(references).map((value) =>
      deltaE(picked.hex, value).toFixed(1).padStart(6),
    )
    console.log(
      `${String(hue).padStart(3)}°  C=${chroma.toFixed(2)}  ${picked.hex}  ${contrast(picked.rgb, lightCanvas).toFixed(2)}:1  ${distances.join(' ')}`,
    )
  }
}
console.log(
  '说明：300° 紫罗兰在 C=0.19 时得到 #8b54d5（本次采用，与四色的最小 ΔE 为 28.1）；335° 品红与参数、无效标签同属红系，同档位最小 ΔE 只有 17.3，故未采用。',
)
