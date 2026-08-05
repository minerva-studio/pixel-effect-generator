import { useEffect, useEffectEvent, useRef, type ReactNode } from 'react'
import type { RenderedFrameSet } from '../generators/contract'
import { useI18n } from '../i18n/I18nProvider'
import { drawFrame } from './export'

const PREVIEW_FPS_OPTIONS = [6, 8, 12, 18, 24] as const

interface PreviewProps {
  readonly frameSet: RenderedFrameSet
  readonly previewTitle: string
  readonly frameWidth: number
  readonly frameHeight: number
  readonly frameIndex: number
  readonly isPlaying: boolean
  readonly previewFps: number
  readonly frameCount: number
  readonly minimumFrameCount: number
  readonly maximumFrameCount: number
  readonly onFrameIndex: (frameIndex: number) => void
  readonly onPlaying: (isPlaying: boolean) => void
  readonly onPreviewFps: (previewFps: number) => void
  readonly onFrameCount: (frameCount: number) => void
  readonly tools?: ReactNode
}

/**
 * Owns only the canvas display, playback loop, frame scrubbing, and preview
 * timing. Exporting is owned by the separate ExportPanel, which shares the
 * same rendered frame set instead of living inside this panel.
 */
export function Preview({
  frameSet,
  previewTitle,
  frameWidth,
  frameHeight,
  frameIndex,
  isPlaying,
  previewFps,
  frameCount,
  minimumFrameCount,
  maximumFrameCount,
  onFrameIndex,
  onPlaying,
  onPreviewFps,
  onFrameCount,
  tools,
}: PreviewProps) {
  const { t } = useI18n()
  const previewCanvas = useRef<HTMLCanvasElement>(null)
  const advancePlayback = useEffectEvent(() => {
    onFrameIndex(nextFrameIndex(frameIndex, frameCount))
  })

  useEffect(() => {
    const canvas = previewCanvas.current
    if (canvas) {
      const frames = frameSet.read()
      drawFrame(canvas, frames[frameIndex % frames.length])
    }
  }, [frameIndex, frameSet])

  useEffect(() => {
    if (!isPlaying) {
      return undefined
    }
    const interval = window.setInterval(() => {
      advancePlayback()
    }, 1000 / previewFps)
    return () => window.clearInterval(interval)
  }, [isPlaying, previewFps])

  return (
    <section className="panel preview-panel">
      <div className="panel-heading preview-heading">
        <div>
          <p className="section-label">{t('preview.livePreview')}</p>
          <h2>{previewTitle}</h2>
        </div>
        <span className="frame-counter">{String(frameIndex + 1).padStart(2, '0')} / {String(frameCount).padStart(2, '0')}</span>
      </div>

      <div className="preview-stage">
        <div
          className="canvas-wrap"
          style={{
            aspectRatio: `${frameWidth} / ${frameHeight}`,
            width: frameWidth >= frameHeight ? 'min(512px, calc(100% - 36px))' : 'auto',
            height: frameWidth < frameHeight ? 'min(470px, calc(100vh - 260px))' : 'auto',
          }}
        >
          <canvas ref={previewCanvas} className="pixel-canvas" aria-label={t('preview.canvasLabel')} />
          <div className="origin-mark" aria-hidden="true" />
        </div>
      </div>

      <div className="playback">
        <div className="playback-timeline">
          <button className="icon-button" type="button" onClick={() => onPlaying(!isPlaying)} aria-label={isPlaying ? t('preview.pause') : t('preview.play')}>
            {isPlaying ? 'Ⅱ' : '▶'}
          </button>
          <input
            aria-label={t('preview.currentFrame')}
            type="range"
            min="0"
            max={frameCount - 1}
            value={frameIndex}
            onChange={(event) => {
              onPlaying(false)
              onFrameIndex(Number(event.target.value))
            }}
          />
          <span>{String(frameIndex + 1).padStart(2, '0')} / {String(frameCount).padStart(2, '0')}</span>
        </div>
        <div className="preview-settings" aria-label={t('preview.timingSettings')}>
          <label className="frame-setting">
            <span>{t('preview.totalFrames')}</span>
            <span className="compact-range">
              <input
                aria-label={t('preview.totalFrames')}
                type="range"
                min={minimumFrameCount}
                max={maximumFrameCount}
                step="1"
                value={frameCount}
                onChange={(event) => onFrameCount(clampFrameCount(Number(event.target.value), minimumFrameCount, maximumFrameCount))}
              />
              <input
                aria-label={t('controls.value', { label: t('preview.totalFrames') })}
                type="number"
                min={minimumFrameCount}
                max={maximumFrameCount}
                step="1"
                value={frameCount}
                onChange={(event) => onFrameCount(clampFrameCount(Number(event.target.value), minimumFrameCount, maximumFrameCount))}
              />
            </span>
          </label>
          <label>
            <span>{t('preview.playbackFps')}</span>
            <select aria-label={t('preview.playbackFps')} value={previewFps} onChange={(event) => onPreviewFps(Number(event.target.value))}>
              {PREVIEW_FPS_OPTIONS.map((fps) => <option value={fps} key={fps}>{fps} FPS</option>)}
            </select>
          </label>
          <strong>{t('preview.fpsPreview', { fps: previewFps })}</strong>
        </div>
        {tools ? <div className="preview-tools" aria-label={t('preview.generatorTools')}>{tools}</div> : null}
      </div>
    </section>
  )
}

/** Clamps a whole-frame count into the module's supported range. */
export function clampFrameCount(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) {
    return minimum
  }
  return Math.min(maximum, Math.max(minimum, Math.round(value)))
}

/** Advances one playback step and wraps against the latest frame count. */
export function nextFrameIndex(frameIndex: number, frameCount: number): number {
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new RangeError('Frame count must be a positive integer.')
  }
  return (frameIndex + 1) % frameCount
}
