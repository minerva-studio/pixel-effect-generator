import type { PixelFrame } from '../../shared/pixel/frame'
import type { RgbColor } from '../../shared/pixel/color'
import { builtinPalette } from '../../shared/palette/library'
import { clamp01, hashUnit, smoothStep } from '../../shared/pixel/rng'
import { REFERENCE_VIEW, targetBounds, toReference, type FireballView } from './view'

const TAU = Math.PI * 2

/** Flight-loop controls shared by the stream and wrapped fireball forms. */
export interface FireballTuning {
  readonly fireballAngular: number
  readonly fireballContour: number
  readonly fireballBandWarp: number
  readonly fireballBreakup: number
  readonly fireballTrail: 'cooling' | 'flame' | 'smoke'
  readonly fireballRibbons: number
  readonly fireballBall: 'hot' | 'molten'
  readonly flowStrength?: number
}
export type FireballVersion = 'previous' | 'current'
export interface FireballPalette {
  readonly warm: readonly RgbColor[]
  readonly smoke: readonly RgbColor[]
}
export const DEFAULT_FIREBALL_PALETTE: FireballPalette = {
  warm: builtinPalette('flameGlow'),
  smoke: builtinPalette('smokeEmber'),
}
function surface(view: FireballView): { frame: PixelFrame; depth: Float32Array; heat: Float32Array } {
  const length = view.width * view.height
  return { frame: { width: view.width, height: view.height, pixels: new Uint8ClampedArray(length * 4) },
    depth: new Float32Array(length), heat: new Float32Array(length) }
}
function paint(frame: PixelFrame, index: number, color: RgbColor) {
  frame.pixels.set([color.r, color.g, color.b, color.a], index * 4)
}

/** Current-version silhouettes: one central wake, or a ball wrapped in fire with trailing ends. */
export type FireballForm = 'teardrop' | 'plasmaBall'

/**
 * A compact ball drives a thick fire shell. Surface bands bend over its dome before peeling
 * into short, broad tongues. The molten core sits behind those bands, not on top of the fire.
 * Transport advances toward the rear; integer phase harmonics keep the flight loop periodic.
 */
function plasmaBall(time: number, seed: number, tuning: FireballTuning, palette: FireballPalette, view: FireballView) {
  const { warm, smoke } = palette
  const s = surface(view)
  const { width, height, scale } = view
  const { fireballTrail: trail, fireballContour, fireballBandWarp, fireballBreakup, fireballRibbons: count, fireballBall: ball } = tuning
  const flowStrength = tuning.flowStrength ?? 1
  const phase = ((time % 1 + 1) % 1) * TAU
  const offset = hashUnit(seed, 3, 9) * TAU
  const cx = 84, cy = 64, wrapRadius = 15
  // The ends partition the wrap's full height into lanes, so together they start as tall as the ball.
  const ribbons = Array.from({ length: count }, (_, i) => {
    const lane = -1 + (2 * i + 1) / count
    const centrality = 1 - Math.abs(lane)
    return {
      lane,
      length: 54 + 10 * centrality + 8 * hashUnit(seed, i, 72),
      width: Math.min(wrapRadius * 0.85, wrapRadius / count * 1.65),
      // Staggered shedding moves through the wrap instead of wagging the entire wake.
      shift: offset + i * 2.4 + hashUnit(seed, i, 74) * 0.6,
    }
  })
  type Ribbon = (typeof ribbons)[number]
  const amplitude = flowStrength * (0.5 + 2 * fireballContour)
  // The wake never grows wider than the ball: it holds the ball's radius, then narrows.
  const laneScale = (along: number) => 1 - 0.2 * smoothStep(clamp01((along - wrapRadius) / 35))
  const centreline = (r: Ribbon, along: number) => {
    const t = along / r.length
    const sway = amplitude * smoothStep(clamp01((along - wrapRadius * 0.6) / 20))
    const peel = smoothStep(clamp01((along - wrapRadius * 1.4) / 23))
    // The middle stream bends after leaving the shell; otherwise it reads as a straight bar.
    const middleBend = (1 - Math.abs(r.lane)) * flowStrength * fireballContour
      * smoothStep(clamp01((along - wrapRadius) / 18))
      * (2.3 * Math.sin(0.15 * along - 2 * phase + r.shift)
        + 0.65 * Math.sin(0.39 * along - 3 * phase - r.shift))
    // Lanes are packed so the outermost tongue's edge (sway included) sits on the ball's radius.
    const reach = Math.max(0, wrapRadius * laneScale(along) - r.width * laneScale(along) - 0.6 * sway)
    return cy + (count > 1 ? r.lane / (1 - 1 / count) : 0) * (reach + 1.8 * peel)
      + sway * 0.6 * Math.sin(0.24 * along - 2 * phase + r.shift)
      + middleBend
      + flowStrength * fireballBreakup * 1.2 * smoothStep(clamp01((t - 0.6) / 0.4)) * Math.sin(along * 0.6 - 3 * phase + r.shift)
  }
  // Centrelines depend only on target columns when rotation does not mix the axes.
  const paths = view.sin === 0 ? ribbons.map(r => Array.from({ length: width }, (_, x) => {
    const { x: rx } = toReference(view, x, 0)
    const along = cx - rx
    return { yc: centreline(r, along), slope: (centreline(r, along + 1) - centreline(r, along - 1)) / 2 }
  })) : undefined
  const mask = new Uint8Array(width * height)
  const heats = new Float32Array(width * height)
  const tails = new Float32Array(width * height)
  const solid = new Uint8Array(width * height)
  const foreground = new Float32Array(width * height)
  const bounds = targetBounds(view, 6, 28, 100, 100)
  for (let y = bounds.minY; y < bounds.maxY; y++) for (let x = bounds.minX; x < bounds.maxX; x++) {
    const { x: rx, y: ry } = toReference(view, x, y)
    if (ry < 28 || ry >= 100 || rx < 6 || rx >= 100) continue
    const index = y * width + x
    const dx = rx - cx, dy = ry - cy
    const along = cx - rx
    // An elongated rear arc holds the wrap's shoulders without flattening them into a hood.
    // The stone itself remains round; only its fire shell stretches into the wake.
    const ballDepth = wrapRadius - Math.hypot(dx > 0 ? dx : dx / 1.35, dy)
    let depth = ballDepth
    const release = smoothStep(clamp01((along - 6) / 22))
    let best: Ribbon | undefined, bestDepth = -Infinity, bestHalf = 1, bestTwist = 1
    for (const [i, r] of ribbons.entries()) {
      if (along < 0 || along > r.length) continue
      const { yc, slope } = paths?.[i][x] ?? {
        yc: centreline(r, along),
        slope: (centreline(r, along + 1) - centreline(r, along - 1)) / 2,
      }
      const t = along / r.length
      const peel = smoothStep(clamp01((along - wrapRadius) / 12))
      const pulse = Math.sin(along * 0.3 - 2 * phase + r.shift)
      const twist = 1 - peel * flowStrength * 0.18 * (1 - pulse)
      const taper = (1 - smoothStep(clamp01((along - wrapRadius * 0.8) / (r.length - wrapRadius * 0.8)))) ** 0.6
        * (1 - 0.28 * smoothStep(clamp01((t - 0.42) / 0.28)))
      const bite = fireballBreakup * flowStrength * peel * smoothStep(clamp01((t - 0.65) / 0.3))
        * Math.max(0, Math.sin(along * 0.65 - 3 * phase + r.shift))
      const edgeFlow = flowStrength * fireballContour * (0.55 + 0.45 * (1 - Math.abs(r.lane)))
        * smoothStep(clamp01((along - wrapRadius) / 16))
        * Math.sin(along * 0.37 - 2 * phase + r.shift)
      const half = r.width * laneScale(along) * taper * twist + edgeFlow - bite * 2
      const ribbonDepth = half - Math.abs(ry - yc) / Math.sqrt(1 + slope * slope)
      depth = Math.max(depth, ballDepth + release * (ribbonDepth - ballDepth))
      if (ribbonDepth > bestDepth) { best = r; bestDepth = ribbonDepth; bestHalf = half; bestTwist = twist }
    }
    if (depth <= 0) continue
    mask[index] = 1
    const radial = Math.hypot(dx, dy) / wrapRadius
    // Surface ripples vanish at the center, preserving the core's weight and position.
    let core = Math.hypot(dx / wrapRadius, dy / wrapRadius)
    const coreRim = smoothStep(clamp01((core - 0.2) / 0.45))
    core += flowStrength * coreRim * (0.1 * Math.sin(dx * 0.5 + Math.abs(dy) * 0.35 + 2 * phase + offset)
      + 0.04 * Math.sin(dx * 0.9 - dy * 0.6 + 3 * phase - offset))
    // The hot core remains spherical even where the shell continues into the wake.
    const lx = dx / wrapRadius, ly = dy / wrapRadius, dome = lx
    const screenLx = (dx * view.cos - dy * view.sin) / wrapRadius
    const screenLy = (dx * view.sin + dy * view.cos) / wrapRadius
    const light = clamp01(0.5 * screenLx - 0.6 * screenLy + 0.5 * Math.sqrt(Math.max(0, 1 - dome * dome - ly * ly)))
    let heat = 1.15 - 0.85 * core + 0.14 * (light - 0.4)
    if (best) {
      const t = along / best.length
      tails[index] = t
      // Hot where the ends leave the ball, cooling to the tips; faces hotter, twists darker.
      const face = clamp01(bestDepth / Math.max(1, bestHalf))
      const stream = Math.sin(along * 0.34 - 2 * phase + best.shift)
      const ribbonHeat = 0.66 - (trail === 'flame' ? 0.24 : 0.42) * t
        + 0.22 * face ** 4 - 0.12 * (1 - face) - 0.2 * (1 - bestTwist)
        + flowStrength * fireballBandWarp * (0.11 + 0.06 * face) * stream
      heat += (ribbonHeat - heat) * smoothStep(clamp01((along - wrapRadius * 0.4) / 15))
    }
    // Meridians widen over the dome and then open into the tongue roots. Phase travels
    // from the nose to the rear along this curved coordinate, never across the whole ball.
    const envelope = dx > 0 ? Math.sqrt(Math.max(0, wrapRadius ** 2 - dx * dx)) : wrapRadius * laneScale(along)
    const shellGate = 1 - smoothStep(clamp01((along - wrapRadius) / 12))
    const travel = dx > 0 ? Math.acos(Math.min(1, lx)) * wrapRadius : Math.PI * wrapRadius / 2 + along
    let fireBand = 0
    if (envelope > 1 && shellGate > 0) {
      for (const r of ribbons) {
        const stream = Math.sin(travel * 0.32 - 2 * phase + r.shift)
        const bend = r.lane * envelope + flowStrength * fireballBandWarp * stream * 1.4
        const bandWidth = Math.max(1.2 + 0.65 * flowStrength * (0.5 + 0.5 * stream), 0.75 / scale)
        fireBand = Math.max(fireBand, clamp01(1 - Math.abs(dy - bend) / bandWidth))
      }
      heat += shellGate * (fireBand * 0.25 - 0.08)
      // Moving band edges can pass in front of the rock without covering its center.
      const edge = smoothStep(clamp01((radial - 0.48) / 0.27))
      foreground[index] = shellGate * edge * fireBand
    }
    let surfaceHeat: number
    switch (ball) {
      case 'hot': {
        // Continuous fire carries moving meridians through the nose, replacing
        // the radial core's fixed color arc on the forward hemisphere.
        const nose = smoothStep(clamp01((lx - 0.05) / 0.65))
        const frontHeat = 0.7 - 0.12 * radial + flowStrength
          * (0.18 * fireBand + 0.14 * Math.sin(Math.atan2(dy, dx) * 3 - 2 * phase + offset))
        const baseHeat = Math.min(heat, 0.34 + 0.2 * depth)
        surfaceHeat = baseHeat + nose * (frontHeat - baseHeat)
        break
      }
      case 'molten':
        solid[index] = radial < 0.82 ? 1 : 0
        if (envelope > 1 && shellGate > 0 && lx > 0.35 && radial > 0.72 && radial < 0.95) {
          heat = Math.max(heat, 0.68 + 0.16 * fireBand)
        }
        surfaceHeat = Math.min(heat, 0.34 + 0.2 * depth)
        break
    }
    heats[index] = surfaceHeat
  }
  // Gaps fully enclosed where neighbouring ends meet are filled, so the body has one outline.
  const outside = new Uint8Array(width * height)
  const stack: number[] = []
  for (let i = 0; i < width; i++) stack.push(i, (height - 1) * width + i)
  for (let i = 0; i < height; i++) stack.push(i * width, i * width + width - 1)
  while (stack.length) {
    const i = stack.pop()!
    if (outside[i] || mask[i]) continue
    outside[i] = 1
    const x = i % width
    if (x > 0) stack.push(i - 1)
    if (x < width - 1) stack.push(i + 1)
    if (i >= width) stack.push(i - width)
    if (i < (height - 1) * width) stack.push(i + width)
  }
  for (let i = 0; i < mask.length; i++) if (!mask[i] && !outside[i]) { mask[i] = 1; heats[i] = 0.3; tails[i] = 0.5 }
  const outline = warm.length - 1
  const cells = Array.from({ length: 6 }, (_, j) => {
    const r = wrapRadius * 0.9 * Math.sqrt(hashUnit(seed, j, 81)), a = hashUnit(seed, j, 82) * TAU
    return { x: r * Math.cos(a), y: r * Math.sin(a) }
  })
  const band = (heat: number) => Math.min(outline - 1, Math.floor((1 - Math.min(0.99, Math.max(0.21, heat))) * warm.length))
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const index = y * width + x
    if (!mask[index]) continue
    s.depth[index] = 1
    if (!mask[index - 1] || !mask[index + 1] || !mask[index - width] || !mask[index + width]) paint(s.frame, index, warm[outline])
    else if (solid[index] && foreground[index] < 0.25) {
      // Molten: dark rock with glowing cracks inside the wrap. Cracks are the borders of a few
      // seeded cells, so they read as solid lines at 1px.
      const { x: rx, y: ry } = toReference(view, x, y)
      const dx = rx - cx, dy = ry - cy
      const lx = dx / wrapRadius, ly = dy / wrapRadius
      const screenLx = (dx * view.cos - dy * view.sin) / wrapRadius
      const screenLy = (dx * view.sin + dy * view.cos) / wrapRadius
      const light = 0.55 * screenLx - 0.65 * screenLy + 0.5 * Math.sqrt(Math.max(0, 1 - lx * lx - ly * ly))
      let nearest = Infinity, second = Infinity
      for (const cell of cells) {
        const d = Math.hypot(dx - cell.x, dy - cell.y)
        if (d < nearest) { second = nearest; nearest = d } else if (d < second) second = d
      }
      const glow = 0.5 + 0.5 * Math.sin(phase + offset)
      if ((second - nearest) * scale < 1.1) paint(s.frame, index, warm[glow > 0.5 ? 1 : 2])
      else paint(s.frame, index, smoke[light > 0.45 ? 3 : light > 0 ? 4 : 5])
    } else if (solid[index]) {
      paint(s.frame, index, warm[foreground[index] > 0.6 ? 1 : 2])
    } else if (trail === 'smoke' && tails[index] > 0.6) {
      paint(s.frame, index, smoke[Math.min(5, 2 + Math.floor((1 - clamp01(heats[index] * 1.6)) * 4))])
    } else paint(s.frame, index, warm[band(heats[index])])
  }
  return s.frame
}

function fireball(time: number, seed: number, tuning: FireballTuning, version: FireballVersion, form: FireballForm = 'teardrop', palette: FireballPalette = DEFAULT_FIREBALL_PALETTE, view: FireballView = REFERENCE_VIEW) {
  const { warm, smoke } = palette
  if (version === 'current' && form === 'plasmaBall') return plasmaBall(time, seed, tuning, palette, view)
  const s = surface(view)
  const { width, height, scale } = view
  const { fireballTrail: trail, fireballAngular, fireballContour, fireballBandWarp, fireballBreakup } = tuning
  const flowStrength = tuning.flowStrength ?? 1
  const phase = ((time % 1 + 1) % 1) * TAU
  const offset = hashUnit(seed, 3, 9) * TAU
  const outline = warm.length - 1
  const sample = (x: number, y: number, index: number) => {
    const along = (105 - x) / 94
    if (along <= 0 || along >= 1) return
    const downstream = clamp01((along - 0.23) / 0.77)
    const center = 64 + flowStrength * downstream * 4 * Math.sin(along * 10 - phase * 2 + offset)
    const cross = (y - center) / 19
    const transport = along * 17 - phase * 2 + offset
    const headGate = 1 - smoothStep(clamp01((along - 0.12) / 0.32))
    const headFacet = fireballAngular * headGate * (0.12 * Math.sin(transport + cross * 5)
      + 0.06 * Math.sin(along * 23 - phase * 3 - cross * 9 + offset))
    const cooling = trail === 'flame' ? 0 : downstream * 0.13
    const bandFlow = Math.sin(transport + cross * 5)
      * Math.cos(along * 12 + cross * 7 - phase * 3 + offset)
    let energy: number
    let heat: number
    let rim = false
    if (version === 'current') {
      const hx = x - 87
      if (hx >= 14.5) return
      // An explicit teardrop owns the silhouette: a round front that barely breathes and a
      // tapering wake whose edge waves travel backward, so the outline stays readable.
      const tail = clamp01(-hx / 68)
      const axis = 64 + (center - 64) * smoothStep(tail)
      const dy = y - axis
      const side = dy < 0 ? 0 : 1.9
      const base = hx >= 0 ? Math.sqrt(Math.max(0, 210 - hx * hx)) : 14.5 * (1 - tail) ** 0.8
      // Wobble scales with the local width, so the thin tip never frays into 1px strings.
      const give = Math.min(1, base / 7)
      let half = base * (1 + 0.03 * Math.sin(phase + offset)) + headFacet * 12 * give
      half += give * fireballContour * (0.4 + 2.6 * tail) * (Math.sin(hx * 0.33 + phase * 2 + offset + side)
        + 0.45 * Math.sin(hx * 0.71 - dy * 0.2 + phase * 3 - offset + side * 1.7))
      const pinch = ((1 + Math.cos(hx * 0.45 + phase * 2 + offset + side * 0.4)) / 2) ** 6
      half *= 1 - Math.min(0.95, fireballBreakup * 3.2 * smoothStep(clamp01((tail - 0.45) / 0.3)) * pinch)
      if (half * scale < 1.2) return
      const depth = half - Math.abs(dy)
      if (depth <= 0) return
      rim = depth * scale < 1.5
      // Stable teardrop core: ripples displace its coordinates (not its heat), vanish at the
      // center and travel backward, so band edges stream off the back while the center holds.
      const cdx = x - 87, cdy = y - 64
      const behind = clamp01(-cdx / 18)
      let r = Math.hypot(cdx / (cdx > 0 ? 13 : 13 + 11 * behind), cdy / 11) * (1 + 0.035 * Math.sin(phase + offset))
      const coreRim = smoothStep(clamp01((r - 0.2) / 0.45))
      r += flowStrength * coreRim * (0.2 * Math.sin(cdx * 0.42 + Math.abs(cdy) * 0.3 + phase * 2 + offset)
        + 0.07 * Math.sin(cdx * 0.8 - cdy * 0.55 + phase * 3 - offset))
      const coreHeat = 1.28 - 0.95 * r
      const inner = clamp01(depth / Math.max(3, half))
      const bodyHeat = 0.3 + 0.5 * inner * (1 - 0.5 * tail)
        + flowStrength * fireballBandWarp * 0.19 * bandFlow * (0.4 + 0.6 * downstream) - cooling
      energy = depth
      // Only the core reaches white; the body tops out at yellow and never uses the rim colour.
      heat = Math.max(0.25, Math.min(bodyHeat, 0.79), coreHeat)
    } else {
      const centerFlow = 1 // previous study: the whole body flows
      // A rounded source feeds one diminishing wake. No detached primitives are spawned.
      const supply = along < 0.23
        ? 1 - ((0.23 - along) / 0.23) ** (2 - fireballAngular * 0.9)
        : 1 - downstream ** 1.15
      const lift = clamp01((along - 0.05) / 0.7)
      const fold = flowStrength * lift * (0.22 * Math.sin(transport + cross * 5)
        + 0.10 * Math.sin(along * 29 - phase * 4 - cross * 8 + offset))
      const neck = flowStrength * smoothStep(clamp01((downstream - 0.38) / 0.4))
        * 0.55 * ((1 + Math.cos(transport)) / 2) ** 4
      const contour = fireballContour * (0.25 + 0.75 * lift) * (0.15 * Math.sin(transport + cross * 6)
        + 0.065 * Math.sin(along * 26 - phase * 3 - cross * 10 + offset))
      const tailGate = smoothStep(clamp01((downstream - 0.5) / 0.35))
      const tear = fireballBreakup * tailGate * (0.27
        * ((1 + Math.cos(transport + cross * 1.4)) / 2) ** 7
        - 0.06 * Math.sin(transport * 2 - cross * 4))
      energy = supply - cross * cross + centerFlow * (fold + headFacet + contour) - neck - tear
      if (energy <= 0) return
      heat = clamp01((energy + centerFlow * fireballBandWarp * 0.19 * bandFlow
        * (0.4 + 0.6 * downstream)) * 1.08 - cooling)
    }
    s.depth[index] = energy
    s.heat[index] = clamp01(heat)
    if (trail === 'smoke' && downstream > 0.57) {
      const smokeHeat = clamp01(energy * 2 + fireballBandWarp * 0.38 * bandFlow
        * (0.4 + 0.6 * downstream))
      const band = rim ? smoke.length - 1 : Math.min(5, 2 + Math.floor((1 - smokeHeat) * 4))
      paint(s.frame, index, smoke[band])
    } else {
      const band = rim ? outline : Math.min(warm.length - 1, Math.floor((1 - s.heat[index]) * warm.length))
      paint(s.frame, index, warm[band])
    }
  }
  const bounds = targetBounds(view, 6, 30, 109, 99)
  for (let y = bounds.minY; y < bounds.maxY; y++) for (let x = bounds.minX; x < bounds.maxX; x++) {
    const { x: rx, y: ry } = toReference(view, x, y)
    if (ry >= 30 && ry < 99 && rx >= 6 && rx < 109) sample(rx, ry, y * width + x)
  }
  return s.frame
}

/** Renders the accepted 128×128 fireball study in production. */
export function renderCanonicalFireballFrame(time: number, seed: number, tuning: FireballTuning,
  form: FireballForm = 'teardrop', palette: FireballPalette = DEFAULT_FIREBALL_PALETTE,
  version: FireballVersion = 'current', view: FireballView = REFERENCE_VIEW): PixelFrame {
  return fireball(time, seed, tuning, version, form, palette, view)
}
