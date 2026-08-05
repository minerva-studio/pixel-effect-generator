import { assertNormalizedGuid } from './guid'
import { resolveUnityMaxTextureSize } from './textureSize'

/** One sprite to slice in the atlas; coordinates use the manifest top-left origin. */
export interface UnitySpriteInput {
  readonly index: number
  readonly name: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Inputs needed to render one Unity 6 TextureImporter `.meta` file. */
export interface UnityMetaInput {
  readonly guid: string
  readonly pixelsPerUnit: number
  readonly sheetWidth: number
  readonly sheetHeight: number
  readonly generatorId: string
  readonly sprites: readonly UnitySpriteInput[]
}

/** Resolved sprite entry with deterministic IDs and Unity-space coordinates. */
export interface UnitySpriteEntry {
  readonly name: string
  readonly fileId: bigint
  readonly spriteId: string
  readonly x: number
  readonly y: number
  readonly unityY: number
  readonly width: number
  readonly height: number
}

/**
 * Builds deterministic, unique sprite entries. File IDs are signed 64-bit
 * values derived from the generator, frame index, and sprite name; sprite IDs
 * are deterministic 128-bit hex strings. A deterministic probe keeps both
 * unique within one atlas.
 */
export function buildUnitySpriteEntries(input: UnityMetaInput): UnitySpriteEntry[] {
  assertNormalizedGuid(input.guid)
  const entries: UnitySpriteEntry[] = []
  const usedFileIds = new Set<bigint>()
  const usedSpriteIds = new Set<string>()
  for (const sprite of input.sprites) {
    let fileProbe = 0
    let fileId = fileIdFor(input.generatorId, sprite.name, sprite.index, fileProbe)
    while (usedFileIds.has(fileId)) {
      fileProbe += 1
      fileId = fileIdFor(input.generatorId, sprite.name, sprite.index, fileProbe)
    }
    usedFileIds.add(fileId)

    let idProbe = 0
    let spriteId = spriteIdFor(input.generatorId, sprite.name, sprite.index, idProbe)
    while (usedSpriteIds.has(spriteId)) {
      idProbe += 1
      spriteId = spriteIdFor(input.generatorId, sprite.name, sprite.index, idProbe)
    }
    usedSpriteIds.add(spriteId)

    entries.push({
      name: sprite.name,
      fileId,
      spriteId,
      x: sprite.x,
      y: sprite.y,
      unityY: input.sheetHeight - sprite.y - sprite.height,
      width: sprite.width,
      height: sprite.height,
    })
  }
  return entries
}

/**
 * Renders a Unity 6/6000.x TextureImporter `.meta` matching the structure
 * Unity writes for a grid-sliced Multiple sprite atlas. Fixed settings follow
 * the export contract: Point filter, Clamp wrap, Uncompressed, sprite mode.
 */
export function renderUnityMetaYaml(input: UnityMetaInput): string {
  assertNormalizedGuid(input.guid)
  const maxTextureSize = resolveUnityMaxTextureSize(input.sheetWidth, input.sheetHeight)
  const entries = buildUnitySpriteEntries(input)
  const byName = [...entries].sort((left, right) => left.name.localeCompare(right.name))
  const lines: string[] = [
    'fileFormatVersion: 2',
    `guid: ${input.guid}`,
    'TextureImporter:',
    '  internalIDToNameTable: []',
    '  externalObjects: {}',
    '  serializedVersion: 13',
    '  mipmaps:',
    '    mipMapMode: 0',
    '    enableMipMap: 0',
    '    sRGBTexture: 1',
    '    linearTexture: 0',
    '    fadeOut: 0',
    '    borderMipMap: 0',
    '    mipMapsPreserveCoverage: 0',
    '    alphaTestReferenceValue: 0.5',
    '    mipMapFadeDistanceStart: 1',
    '    mipMapFadeDistanceEnd: 3',
    '  bumpmap:',
    '    convertToNormalMap: 0',
    '    externalNormalMap: 0',
    '    heightScale: 0.25',
    '    normalMapFilter: 0',
    '    flipGreenChannel: 0',
    '  isReadable: 0',
    '  streamingMipmaps: 0',
    '  streamingMipmapsPriority: 0',
    '  vTOnly: 0',
    '  ignoreMipmapLimit: 0',
    '  grayScaleToAlpha: 0',
    '  generateCubemap: 6',
    '  cubemapConvolution: 0',
    '  seamlessCubemap: 0',
    '  textureFormat: 1',
    `  maxTextureSize: ${maxTextureSize}`,
    '  textureSettings:',
    '    serializedVersion: 2',
    '    filterMode: 0',
    '    aniso: 1',
    '    mipBias: 0',
    '    wrapU: 1',
    '    wrapV: 1',
    '    wrapW: 1',
    '  nPOTScale: 0',
    '  lightmap: 0',
    '  compressionQuality: 50',
    '  spriteMode: 2',
    '  spriteExtrude: 1',
    '  spriteMeshType: 1',
    '  alignment: 0',
    '  spritePivot: {x: 0.5, y: 0.5}',
    `  spritePixelsToUnits: ${input.pixelsPerUnit}`,
    '  spriteBorder: {x: 0, y: 0, z: 0, w: 0}',
    '  spriteGenerateFallbackPhysicsShape: 1',
    '  alphaUsage: 1',
    '  alphaIsTransparency: 1',
    '  spriteTessellationDetail: -1',
    '  textureType: 8',
    '  textureShape: 1',
    '  singleChannelComponent: 0',
    '  flipbookRows: 1',
    '  flipbookColumns: 1',
    '  maxTextureSizeSet: 0',
    '  compressionQualitySet: 0',
    '  textureFormatSet: 0',
    '  ignorePngGamma: 0',
    '  applyGammaDecoding: 0',
    '  swizzle: 50462976',
    '  cookieLightType: 0',
    '  platformSettings:',
  ]
  for (const target of ['DefaultTexturePlatform', 'Standalone', 'Server']) {
    lines.push(
      '  - serializedVersion: 4',
      `    buildTarget: ${target}`,
      `    maxTextureSize: ${maxTextureSize}`,
      '    resizeAlgorithm: 0',
      '    textureFormat: -1',
      '    textureCompression: 0',
      '    compressionQuality: 50',
      '    crunchedCompression: 0',
      '    allowsAlphaSplitting: 0',
      '    overridden: 0',
      '    ignorePlatformSupport: 0',
      '    androidETC2FallbackOverride: 0',
      '    forceMaximumCompressionQuality_BC6H_BC7: 0',
    )
  }
  lines.push(
    '  spriteSheet:',
    '    serializedVersion: 2',
    '    sprites:',
  )
  for (const entry of entries) {
    lines.push(
      '    - serializedVersion: 2',
      `      name: ${entry.name}`,
      '      rect:',
      '        serializedVersion: 2',
      `        x: ${entry.x}`,
      `        y: ${entry.unityY}`,
      `        width: ${entry.width}`,
      `        height: ${entry.height}`,
      '      alignment: 0',
      '      pivot: {x: 0.5, y: 0.5}',
      '      border: {x: 0, y: 0, z: 0, w: 0}',
      '      customData: ',
      '      outline: []',
      '      physicsShape: []',
      '      tessellationDetail: -1',
      '      bones: []',
      `      spriteID: ${entry.spriteId}`,
      `      internalID: ${entry.fileId}`,
      '      vertices: []',
      '      indices: ',
      '      edges: []',
      '      weights: []',
    )
  }
  lines.push(
    '    outline: []',
    '    customData: ',
    '    physicsShape: []',
    '    bones: []',
    '    spriteID: ',
    '    internalID: 0',
    '    vertices: []',
    '    indices: ',
    '    edges: []',
    '    weights: []',
    '    secondaryTextures: []',
    '    spriteCustomMetadata:',
    '      entries: []',
    '    nameFileIdTable:',
  )
  for (const entry of byName) {
    lines.push(`      ${entry.name}: ${entry.fileId}`)
  }
  lines.push(
    '  mipmapLimitGroupName: ',
    '  pSDRemoveMatte: 0',
    '  userData: ',
    '  assetBundleName: ',
    '  assetBundleVariant: ',
  )
  return `${lines.join('\n')}\n`
}

/** Deterministic signed 64-bit file ID for one sprite. */
function fileIdFor(generatorId: string, spriteName: string, frameIndex: number, probe: number): bigint {
  const high = hash32(`${generatorId}\u0000${spriteName}`, 0x9e3779b9 ^ Math.imul(frameIndex + probe, 0x85ebca6b))
  const low = hash32(`${generatorId}\u0000${spriteName}\u0000${frameIndex + probe}`, 0xc2b2ae3d)
  const unsigned = (BigInt(high) << 32n) | BigInt(low)
  return unsigned >= 1n << 63n ? unsigned - (1n << 64n) : unsigned
}

/** Deterministic 128-bit hex sprite ID for one sprite. */
function spriteIdFor(generatorId: string, spriteName: string, frameIndex: number, probe: number): string {
  const base = `${generatorId}|${spriteName}|${frameIndex}|${probe}`
  const words = [
    hash32(`${base}|a`, 0x12345678),
    hash32(`${base}|b`, 0x9abcdef0),
    hash32(`${base}|c`, 0x13579bdf),
    hash32(`${base}|d`, 0x2468ace0),
  ]
  return words.map((word) => word.toString(16).padStart(8, '0')).join('')
}

/** FNV-1a over UTF-16 code units; deterministic for identical input strings. */
function hash32(input: string, seed: number): number {
  let hash = seed >>> 0
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash ^ input.charCodeAt(index), 0x01000193)
  }
  return hash >>> 0
}
