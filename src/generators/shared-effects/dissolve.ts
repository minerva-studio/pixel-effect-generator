import { clamp01, hashUnit } from '../../shared/pixel/rng'
import type { DissolveStyle } from './types'

/** User-tunable retro dissolve settings shared by both pixel surfaces. */
export interface DissolveOptions {
  readonly size: number
  readonly jitter: number
  readonly density: number
  readonly speed: number
}

/**
 * Returns true when a retro-styled pixel should dissolve away under the given
 * style. The `pixelNoise` style keeps its original per-pixel logic in each
 * renderer for byte stability, so it never reaches this helper.
 */
export function dissolvePixelRejected(
  style: DissolveStyle,
  seed: number,
  x: number,
  y: number,
  width: number,
  height: number,
  dissolve: number,
  coverage: number,
  edge: number,
  options: DissolveOptions,
): boolean {
  const effective = clamp01(dissolve * options.speed)
  if (effective >= 1) return true
  switch (style) {
    case 'pixelNoise':
      return false
    case 'scanSweep': {
      // A wave sweeps from the top-left corner toward the bottom-right; the
      // per-pixel jitter leaves a ragged pixel front behind the wave.
      const sweep = (x + y) / Math.max(1, width + height)
      const jitter = (hashUnit(seed ^ 0x5d3c4e1f, x, y) - 0.5) * 0.18
      return sweep + jitter < effective || hashUnit(seed ^ 0x9e3779b9, x, y) > coverage
    }
    case 'blockFade': {
      // Whole 2x2 pixel blocks share one fate for an arcade-style fade.
      const blockHash = hashUnit(seed ^ 0x7a11c3d5, Math.floor(x / 2), Math.floor(y / 2))
      return blockHash > coverage * (1 - effective)
    }
    case 'circleFade': {
      // Circles with the configured radius cover every pixel (default 6px on
      // an 8px cell) so the surface stays seamless before dissolve; vanished
      // blocks leave round holes bounded by the surviving circles' arcs. Odd
      // rows shift half a cell and every center gets deterministic jitter so
      // the dots read as scattered rather than a rigid grid.
      const radius = options.size
      const cell = Math.max(2, Math.round(radius * (4 / 3) * (1 + options.density)))
      const radiusSquared = radius ** 2
      const baseX = Math.floor(x / cell)
      const baseY = Math.floor(y / cell)
      const survival = coverage * (1 - effective)
      const jitterAmount = options.jitter * 2
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const blockX = baseX + offsetX
          const blockY = baseY + offsetY
          const rowShift = blockY % 2 === 1 ? cell / 2 : 0
          const jitterX = (hashUnit(seed ^ 0x1f2e1a4b, blockX, blockY) - 0.5) * jitterAmount * 2
          const jitterY = (hashUnit(seed ^ 0x5b9a3c7d, blockX, blockY) - 0.5) * jitterAmount * 2
          const centerX = blockX * cell + cell / 2 + rowShift + jitterX
          const centerY = blockY * cell + cell / 2 + jitterY
          const dx = x - centerX
          const dy = y - centerY
          if (dx * dx + dy * dy > radiusSquared) continue
          if (hashUnit(seed ^ 0x7a11c3d5, blockX, blockY) <= survival) return false
        }
      }
      return true
    }
    case 'edgeRoll': {
      // Outer pixels fade first and the roll advances inward; jitter keeps
      // the roll edge uneven instead of a crisp ring.
      const jitter = (hashUnit(seed ^ 0x3f29c1a7, x, y) - 0.5) * 0.36
      return edge + jitter * effective > 1 - effective
    }
  }
}
