/** Preview zoom levels shared by the live preview and the atlas preview. */
export type PreviewZoom = 'fit' | 1 | 2 | 4 | 8

export const PREVIEW_ZOOM_OPTIONS: readonly PreviewZoom[] = ['fit', 1, 2, 4, 8]

/** Displayed CSS pixel size for one zoom level. */
export interface PreviewSize {
  readonly width: number
  readonly height: number
}

/**
 * Resolves the displayed size for a zoom level. Integer zooms are exact
 * frame multiples; `fit` scales the longest side to fit the given bounds
 * while preserving aspect ratio. Never touches the pixel buffer.
 */
export function resolvePreviewSize(
  zoom: PreviewZoom,
  frameWidth: number,
  frameHeight: number,
  fitMaxWidth: number,
  fitMaxHeight: number,
): PreviewSize {
  if (!Number.isInteger(frameWidth) || !Number.isInteger(frameHeight) || frameWidth <= 0 || frameHeight <= 0) {
    throw new RangeError('Frame dimensions must be positive integers.')
  }
  if (zoom === 'fit') {
    const scale = Math.min(fitMaxWidth / frameWidth, fitMaxHeight / frameHeight)
    return {
      width: Math.max(1, Math.round(frameWidth * scale)),
      height: Math.max(1, Math.round(frameHeight * scale)),
    }
  }
  return { width: frameWidth * zoom, height: frameHeight * zoom }
}
