import type { PixelFrame } from './frame'
import { packHorizontalSheet } from './spritesheet'
import type { SpriteRect } from '../project/types'

export type SpriteSheetLayout = 'horizontal' | 'compact'

/** A packed atlas plus the metadata needed to slice it again. */
export interface PackedSpriteSheet {
  readonly frame: PixelFrame
  readonly columns: number
  readonly rows: number
  readonly sprites: readonly SpriteRect[]
}

/**
 * Packs equal-sized frames into a sprite atlas. Horizontal keeps the existing
 * left-to-right layout; compact picks the most square grid by aspect score,
 * empty cells, then column count.
 */
export function packSpriteSheet(
  frames: readonly PixelFrame[],
  layout: SpriteSheetLayout,
  namePrefix = 'frame',
): PackedSpriteSheet {
  if (frames.length === 0) {
    throw new RangeError('At least one frame is required.')
  }
  const { width, height } = frames[0]
  assertUniformFrames(frames, width, height)
  if (layout === 'horizontal') {
    const columns = frames.length
    return {
      frame: packHorizontalSheet(frames),
      columns,
      rows: 1,
      sprites: buildSpriteRects(frames.length, width, height, columns, namePrefix),
    }
  }
  const columns = chooseCompactColumns(frames.length, width, height)
  const rows = Math.ceil(frames.length / columns)
  const sheetWidth = columns * width
  const sheetHeight = rows * height
  const sheet = packCompactSheet(frames, columns, width, height, sheetWidth, sheetHeight)
  return {
    frame: sheet,
    columns,
    rows,
    sprites: buildSpriteRects(frames.length, width, height, columns, namePrefix),
  }
}

/** Builds top-left rects in row-major order for a grid atlas. */
function buildSpriteRects(
  frameCount: number,
  frameWidth: number,
  frameHeight: number,
  columns: number,
  namePrefix: string,
): SpriteRect[] {
  const widthDigits = Math.max(3, String(frameCount - 1).length)
  const rects: SpriteRect[] = []
  for (let index = 0; index < frameCount; index += 1) {
    const column = index % columns
    const row = Math.floor(index / columns)
    rects.push({
      index,
      name: `${namePrefix}_${String(index).padStart(widthDigits, '0')}`,
      x: column * frameWidth,
      y: row * frameHeight,
      width: frameWidth,
      height: frameHeight,
    })
  }
  return rects
}

/** Packs every frame row-major into one sheet-sized RGBA buffer. */
function packCompactSheet(
  frames: readonly PixelFrame[],
  columns: number,
  frameWidth: number,
  frameHeight: number,
  sheetWidth: number,
  sheetHeight: number,
): PixelFrame {
  const pixels = new Uint8ClampedArray(sheetWidth * sheetHeight * 4)
  frames.forEach((frame, index) => placeFrame(frame, index, columns, frameWidth, frameHeight, sheetWidth, pixels))
  return { width: sheetWidth, height: sheetHeight, pixels }
}

/** Copies one frame into its row-major grid cell; unused cells stay clear. */
function placeFrame(
  frame: PixelFrame,
  index: number,
  columns: number,
  frameWidth: number,
  frameHeight: number,
  sheetWidth: number,
  pixels: Uint8ClampedArray,
): void {
  const column = index % columns
  const row = Math.floor(index / columns)
  const originX = column * frameWidth
  const originY = row * frameHeight
  for (let y = 0; y < frameHeight; y += 1) {
    const sourceStart = y * frameWidth * 4
    const sourceEnd = sourceStart + frameWidth * 4
    const destinationStart = ((originY + y) * sheetWidth + originX) * 4
    pixels.set(frame.pixels.subarray(sourceStart, sourceEnd), destinationStart)
  }
}

/**
 * Chooses the compact grid column count for `1..frameCount` columns using
 * aspect score first, then fewer empty cells, then fewer columns.
 */
export function chooseCompactColumns(frameCount: number, frameWidth: number, frameHeight: number): number {
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new RangeError('frameCount must be a positive integer.')
  }
  let best: { columns: number; aspectScore: number; emptyCells: number } | undefined
  for (let columns = 1; columns <= frameCount; columns += 1) {
    const rows = Math.ceil(frameCount / columns)
    const sheetWidth = columns * frameWidth
    const sheetHeight = rows * frameHeight
    // Symmetric log difference keeps perfect ties bit-identical so the
    // deterministic tie-breakers below always agree.
    const aspectScore = Math.abs(Math.log(sheetWidth) - Math.log(sheetHeight))
    const emptyCells = columns * rows - frameCount
    const candidate = { columns, aspectScore, emptyCells }
    if (
      best === undefined
      || candidate.aspectScore < best.aspectScore
      || (candidate.aspectScore === best.aspectScore && candidate.emptyCells < best.emptyCells)
      || (candidate.aspectScore === best.aspectScore && candidate.emptyCells === best.emptyCells && candidate.columns < best.columns)
    ) {
      best = candidate
    }
  }
  return best!.columns
}

function assertUniformFrames(frames: readonly PixelFrame[], width: number, height: number): void {
  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height) {
      throw new RangeError('All frames must have the same dimensions.')
    }
  }
}
