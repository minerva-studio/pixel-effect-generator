import type { PixelFrame } from '../shared/pixel/frame'
import { packHorizontalSheet } from '../shared/pixel/spritesheet'

/** Packs frames and starts a local browser download of the PNG sprite sheet. */
export function exportHorizontalSpriteSheet(frames: readonly PixelFrame[], fileName: string): void {
  const sheet = packHorizontalSheet(frames)
  const canvas = document.createElement('canvas')
  drawFrame(canvas, sheet)
  canvas.toBlob((blob) => {
    if (blob) {
      downloadBlob(blob, fileName)
    }
  }, 'image/png')
}

/** Starts a local browser download of already-encoded animation bytes. */
export function downloadBytes(bytes: Uint8Array, fileName: string, mime: string): void {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  downloadBlob(new Blob([copy], { type: mime }), fileName)
}

/** Starts a local browser download of plain text content. */
export function downloadText(text: string, fileName: string, mime: string): void {
  downloadBlob(new Blob([text], { type: mime }), fileName)
}

/** Draws one already-rasterized RGBA frame without invoking Canvas geometry. */
export function drawFrame(canvas: HTMLCanvasElement, frame: PixelFrame): void {
  canvas.width = frame.width
  canvas.height = frame.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Canvas 2D is unavailable.')
  }
  context.putImageData(new ImageData(new Uint8ClampedArray(frame.pixels), frame.width, frame.height), 0, 0)
}

/** Starts a local browser download and releases its object URL on the next task. */
function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
