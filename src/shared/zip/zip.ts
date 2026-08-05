import { zipSync, type Zippable } from 'fflate'
import { MANIFEST_SCHEMA, MANIFEST_VERSION, serializeManifestDocument } from '../project/document'
import type { EffectProjectV1, ExportManifestV1, SpriteRect } from '../project/types'
import { packSpriteSheet, type SpriteSheetLayout } from '../pixel/atlas'
import type { PackedSpriteSheet } from '../pixel/atlas'
import type { PixelFrame } from '../pixel/frame'
import { encodePng } from '../pixel/png'
import { buildUnitySpriteEntries, renderUnityMetaYaml } from '../unity/meta'
import { resolveUnityMaxTextureSize } from '../unity/textureSize'

/** Fixed archive timestamp so ZIP bytes never depend on the current time. */
const FIXED_ZIP_MTIME = new Date(1980, 0, 1)

/** One entry inside a generated ZIP archive. */
export interface ZipEntry {
  readonly name: string
  readonly bytes: Uint8Array
}

/** Inputs for a frame-sequence ZIP package. */
export interface FrameZipInput {
  readonly generatorId: string
  readonly frames: readonly PixelFrame[]
  readonly fps: number
  readonly project: EffectProjectV1
  readonly folderName: string
  readonly frameNamePrefix: string
}

/** Inputs for a Unity 6 atlas ZIP package. */
export interface UnityZipInput {
  readonly generatorId: string
  readonly frames: readonly PixelFrame[]
  readonly fps: number
  readonly project: EffectProjectV1
  readonly pixelsPerUnit: number
  readonly guid: string
  readonly layout: SpriteSheetLayout
  readonly folderName: string
  readonly imageName: string
}

/**
 * Encodes one ZIP archive with every entry stamped 1980-01-01 00:00:00 local
 * time; identical inputs always produce identical bytes.
 */
export function zipEntries(entries: readonly ZipEntry[]): Uint8Array {
  const data: Zippable = {}
  for (const entry of entries) {
    data[entry.name] = [entry.bytes, { mtime: FIXED_ZIP_MTIME }]
  }
  return zipSync(data)
}

/** Builds the frame-sequence manifest for a per-frame ZIP package. */
export function buildFrameSequenceManifest(input: FrameZipInput): ExportManifestV1 {
  const { width, height } = input.frames[0]
  const frameNames = frameNamesFor(input.frames.length, input.frameNamePrefix)
  return {
    schema: MANIFEST_SCHEMA,
    version: MANIFEST_VERSION,
    generator: input.generatorId,
    project: input.project,
    output: {
      type: 'frame-sequence',
      frameWidth: width,
      frameHeight: height,
      frameCount: input.frames.length,
      fps: input.fps,
      frames: frameNames.map((name, index) => ({ index, name, file: `frames/${name}.png` })),
    },
  }
}

/** Builds the sprite-sheet manifest for a Unity atlas ZIP package. */
export function buildSpriteSheetManifest(
  input: UnityZipInput,
  atlas: PackedSpriteSheet,
): ExportManifestV1 {
  return {
    schema: MANIFEST_SCHEMA,
    version: MANIFEST_VERSION,
    generator: input.generatorId,
    project: input.project,
    output: {
      type: 'sprite-sheet',
      layout: input.layout,
      image: input.imageName,
      width: atlas.frame.width,
      height: atlas.frame.height,
      columns: atlas.columns,
      rows: atlas.rows,
      coordinateOrigin: 'top-left',
      sprites: atlas.sprites,
    },
  }
}

/** Builds a per-frame transparent PNG ZIP with a manifest.json. */
export function buildFrameZip(input: FrameZipInput): Uint8Array {
  if (input.frames.length === 0) {
    throw new RangeError('At least one frame is required.')
  }
  const frameNames = frameNamesFor(input.frames.length, input.frameNamePrefix)
  const entries: ZipEntry[] = [
    {
      name: `${input.folderName}/manifest.json`,
      bytes: encodeText(serializeManifestDocument(buildFrameSequenceManifest(input))),
    },
  ]
  input.frames.forEach((frame, index) => {
    entries.push({
      name: `${input.folderName}/frames/${frameNames[index]}.png`,
      bytes: encodePng(frame),
    })
  })
  return zipEntries(entries)
}

/** Builds a Unity 6 atlas ZIP with PNG, matching `.meta`, and manifest.json. */
export function buildUnityZip(input: UnityZipInput): Uint8Array {
  if (input.frames.length === 0) {
    throw new RangeError('At least one frame is required.')
  }
  const packed = packSpriteSheet(input.frames, input.layout, input.generatorId)
  // Independent guard so oversized atlases can never reach the encoder even
  // if the UI path is bypassed. PNG and frame ZIP outputs are not limited.
  resolveUnityMaxTextureSize(packed.frame.width, packed.frame.height)
  const manifest = buildSpriteSheetManifest(input, packed)
  const meta = renderUnityMetaYaml({
    guid: input.guid,
    pixelsPerUnit: input.pixelsPerUnit,
    sheetWidth: packed.frame.width,
    sheetHeight: packed.frame.height,
    generatorId: input.generatorId,
    sprites: buildUnitySpriteInputs(packed.sprites),
  })
  return zipEntries([
    {
      name: `${input.folderName}/manifest.json`,
      bytes: encodeText(serializeManifestDocument(manifest)),
    },
    {
      name: `${input.folderName}/${input.imageName}`,
      bytes: encodePng(packed.frame),
    },
    {
      name: `${input.folderName}/${input.imageName}.meta`,
      bytes: encodeText(meta),
    },
  ])
}

/** Zero-padded sprite names with at least three digits. */
export function frameNamesFor(frameCount: number, prefix: string): string[] {
  const widthDigits = Math.max(3, String(Math.max(0, frameCount - 1)).length)
  return Array.from({ length: frameCount }, (_, index) => `${prefix}_${String(index).padStart(widthDigits, '0')}`)
}

function buildUnitySpriteInputs(sprites: readonly SpriteRect[]): Parameters<typeof buildUnitySpriteEntries>[0]['sprites'] {
  return sprites.map((sprite) => ({
    index: sprite.index,
    name: sprite.name,
    x: sprite.x,
    y: sprite.y,
    width: sprite.width,
    height: sprite.height,
  }))
}

function encodeText(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}
