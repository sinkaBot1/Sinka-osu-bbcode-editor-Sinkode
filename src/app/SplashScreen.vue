<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'

const emit = defineEmits<{ done: [] }>()

// 入场完成后停留时长；出场过渡时长与 CSS 里保持一致
const SHOW_DURATION = 1400
const EXIT_DURATION = 500

const phase = ref<'idle' | 'entering' | 'exiting'>('idle')
let exitTimer: ReturnType<typeof setTimeout> | undefined
let doneTimer: ReturnType<typeof setTimeout> | undefined

function startExit() {
  clearTimeout(exitTimer)
  clearTimeout(doneTimer)
  phase.value = 'exiting'
  doneTimer = setTimeout(() => emit('done'), EXIT_DURATION)
}

onMounted(() => {
  // 先让浏览器绘制初始态（条带在屏幕外），下一帧再加入场类
  void nextTick(() => {
    requestAnimationFrame(() => {
      phase.value = 'entering'
      exitTimer = setTimeout(startExit, SHOW_DURATION)
    })
  })
})

onUnmounted(() => {
  clearTimeout(exitTimer)
  clearTimeout(doneTimer)
})
</script>

<template>
  <!-- 整块贴满视口，exiting 后由父层 v-if 摘掉 -->
  <div
    :class="['splash', `is-${phase}`]"
    role="dialog"
    aria-modal="true"
    aria-label="开场动画"
    @click="startExit"
  >
    <div class="splash-bg" aria-hidden="true"></div>

    <!-- 三条平行四边形色带 -->
    <div class="splash-strips" aria-hidden="true">
      <div class="splash-strip splash-strip-main"></div>
      <div class="splash-strip splash-strip-accent"></div>
      <div class="splash-strip splash-strip-thin"></div>
    </div>

    <!-- 文字内容 -->
    <div class="splash-content">
      <div class="splash-label">
        <span class="splash-eyebrow">osu! bbcode editor</span>
        <span class="splash-version" aria-label="版本 0.1.0">
          <span class="v-char">v</span><span class="version-number">0.1.0</span>
        </span>
        <span class="splash-tag">preview</span>
      </div>
    </div>

    <span class="splash-skip" aria-hidden="true">点击跳过</span>
  </div>
</template>

<style scoped>
/* 所有颜色走 CSS 变量，跟随 document.documentElement 上的 data-theme，
   未来新增主题时此组件无需改动。 */

.splash {
  position: fixed;
  inset: 0;
  z-index: 100;
  overflow: hidden;
  cursor: pointer;
}

/* 底层深色底：退出时淡出，让应用底色透出 */
.splash-bg {
  position: absolute;
  inset: 0;
  background: var(--color-background);
  transition: opacity 200ms cubic-bezier(0.22, 1, 0.36, 1) 160ms;
}
.splash.is-exiting .splash-bg {
  opacity: 0;
}

/* ---- 几何条带 ---- */
.splash-strips {
  position: absolute;
  inset: 0;
}

.splash-strip {
  position: absolute;
  top: -10%;
  height: 120%;
  will-change: transform;
}

/* 主面板 */
.splash-strip-main {
  left: -6%;
  width: 83%;
  background: var(--color-surface-raised);
  transform: skewX(-4deg) translateX(-115%);
}

/* 强调细条 */
.splash-strip-accent {
  left: 68%;
  width: 16%;
  background: color-mix(in srgb, var(--color-accent) 16%, transparent);
  transform: skewX(-4deg) translateX(-700%);
}

/* 超细线 */
.splash-strip-thin {
  left: 80%;
  width: 7%;
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  transform: skewX(-4deg) translateX(-1200%);
}

/* 主面板右边缘 accent 竖线 */
.splash-strip-main::after {
  position: absolute;
  top: 0;
  right: -2px;
  width: 3px;
  height: 100%;
  background: var(--color-accent);
  content: '';
  opacity: 0.7;
}

/* 入场 */
.splash.is-entering .splash-strip-main {
  transform: skewX(-4deg) translateX(0);
  transition: transform 340ms cubic-bezier(0.22, 1, 0.36, 1);
}
.splash.is-entering .splash-strip-accent {
  transform: skewX(-4deg) translateX(0);
  transition: transform 380ms cubic-bezier(0.22, 1, 0.36, 1) 30ms;
}
.splash.is-entering .splash-strip-thin {
  transform: skewX(-4deg) translateX(0);
  transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1) 50ms;
}

/* 离场：细线先走，主面板最后，全部用 vw 避免百分比相对自身宽度导致没走完就停 */
.splash.is-exiting .splash-strip-thin {
  transform: skewX(-4deg) translateX(1800%);
  transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1);
}
.splash.is-exiting .splash-strip-accent {
  transform: skewX(-4deg) translateX(1800%);
  transition: transform 320ms cubic-bezier(0.22, 1, 0.36, 1) 30ms;
}
.splash.is-exiting .splash-strip-main {
  /* vw 单位：120vw 使主面板整体离开屏幕，skewX 导致的底部左偏也完全出界 */
  transform: skewX(-4deg) translateX(120vw);
  transition: transform 360ms cubic-bezier(0.22, 1, 0.36, 1) 60ms;
}

/* ---- 文字内容 ---- */
.splash-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 0 12% 0 10%;
  pointer-events: none;
}

.splash-label {
  display: flex;
  flex-direction: column;
  gap: 10px;
  opacity: 0;
  transform: translateY(10px);
}
.splash.is-entering .splash-label {
  opacity: 1;
  transform: translateY(0);
  transition:
    opacity 260ms cubic-bezier(0.22, 1, 0.36, 1) 220ms,
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1) 220ms;
}
.splash.is-exiting .splash-label {
  opacity: 0;
  transform: translateY(-8px);
  transition:
    opacity 180ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.splash-eyebrow {
  font-size: clamp(9px, 1.2vw, 11px);
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--color-accent);
  text-transform: uppercase;
  line-height: 1;
}

.splash-version {
  font-size: clamp(48px, 8vw, 96px);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--color-text);
}
.splash-version .v-char {
  color: var(--color-muted);
  font-size: 0.65em;
  vertical-align: 0.12em;
}
.splash-version .version-number {
  color: var(--color-accent);
}

.splash-tag {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: clamp(11px, 1.4vw, 13px);
  font-weight: 500;
  letter-spacing: 0.1em;
  color: var(--color-muted);
  text-transform: uppercase;
}
.splash-tag::before {
  display: block;
  flex: 0 0 auto;
  width: 28px;
  height: 1px;
  background: var(--color-accent);
  content: '';
  opacity: 0.5;
}

/* 右下角跳过提示 */
.splash-skip {
  position: absolute;
  right: 5%;
  bottom: 7%;
  font-size: 11px;
  color: var(--color-muted);
  letter-spacing: 0.06em;
  opacity: 0;
  pointer-events: none;
}
.splash.is-entering .splash-skip {
  opacity: 0.6;
  transition: opacity 260ms cubic-bezier(0.22, 1, 0.36, 1) 500ms;
}
.splash.is-exiting .splash-skip {
  opacity: 0;
  transition: opacity 120ms;
}

/* 低动态效果：压缩所有过渡，退化为即时切换 */
@media (prefers-reduced-motion: reduce) {
  .splash-bg,
  .splash-strip-main,
  .splash-strip-accent,
  .splash-strip-thin,
  .splash-label,
  .splash-skip {
    transition-duration: 0.01ms !important;
  }
}
</style>
