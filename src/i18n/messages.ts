import type { Locale } from './locales'

/** Source-of-truth English dictionary; every locale mirrors this exact key structure. */
const enTree = {
  app: {
    eyebrow: 'PIXEL EFFECT TOOLKIT',
    title: 'Pixel Effect Generator',
    subtitle: 'Focused generators for deterministic, pixel-perfect game VFX.',
    status: '{width} × {height} RGBA',
    languageLabel: 'Interface language',
  },
  workspace: {
    navLabel: 'Effect generators',
    generatorsLabel: 'GENERATORS',
    generatorSectionLabel: 'GENERATOR {index} · {name}',
    parametersTitle: '{name} parameters',
    reset: 'Reset',
    categoryTabsLabel: '{name} parameter categories',
    categoryControls: '{label} controls',
    exportDimensions: '{width} × {height} px · transparent PNG',
    exportButton: 'Export PNG',
  },
  preview: {
    livePreview: 'LIVE PREVIEW',
    canvasLabel: 'Animated pixel effect preview',
    play: 'Play animation',
    pause: 'Pause animation',
    currentFrame: 'Current frame',
    timingSettings: 'Preview timing settings',
    totalFrames: 'Total frames',
    playbackFps: 'Playback FPS',
    fpsPreview: '{fps} FPS preview',
    generatorTools: 'Generator preview tools',
  },
  controls: {
    about: 'About {label}',
    value: '{label} value',
  },
  slash: {
    name: 'Slash',
    description: 'Animated weapon trails and sweeping attack arcs.',
    previewTitle: 'Sweep study',
    categories: {
      shape: { label: 'Shape', description: 'Define the arc silhouette, orientation, and perspective.' },
      palette: { label: 'Palette', description: 'Build the radial color bands from the inner edge outward.' },
      motion: { label: 'Motion', description: 'Control timing, trail length, and the direction of the sweep.' },
      fragments: { label: 'Fragments', description: 'Shape and animate debris released from the trailing edge.' },
      breakup: { label: 'Breakup', description: 'Control dissolve and outer-edge damage patterns.' },
    },
    controls: {
      radius: { label: 'Radius', description: "Distance from the origin to the slash's outer edge." },
      thickness: { label: 'Thickness', description: 'Width of the colored arc between its inner and outer edges.' },
      startAngle: { label: 'Start angle', description: 'Starting direction in screen space: 0° points right and 90° points down.' },
      sweepAngle: { label: 'Sweep angle', description: 'Degrees travelled from the start angle; values above 360° create a second pass.' },
      rotation: { label: 'Rotation', description: 'Rotates the complete local slash path to aim the overall swing in screen space.' },
      tilt: { label: 'Perspective tilt', description: 'Compresses the slash plane; 90° produces the thinnest stable pixel projection.' },
      sweepSpeed: { label: 'Sweep speed', description: 'Higher values make the leading edge complete its path sooner.' },
      trailLength: { label: 'Trail length', description: 'Delays the trailing edge so more of the arc remains visible.' },
      dissolveMode: { label: 'Dissolve mode', description: 'How the trailing edge erodes pixels: ordered dither, clustered noise blocks, or streak-like tears.' },
      edgeMode: { label: 'Edge mode', description: 'How the outer edge breaks up: 2×2 chips, a jagged contour, or wedge-shaped slash cuts.' },
      dissolve: { label: 'Dissolve', description: 'Length of the dissolution transition immediately ahead of the trailing edge.' },
      edgeBreakup: { label: 'Edge breakup', description: 'Intensity of outer-edge removal for the active edge mode.' },
      breakupDepth: { label: 'Breakup depth', description: 'Maximum depth of edge breakup while preserving the core arc.' },
      fragmentMode: { label: 'Fragment mode', description: 'How debris is drawn: square chunks, tangent-aligned shards, or fast short-lived sparks.' },
      amount: { label: 'Amount', description: 'Amount of colored debris released as the trailing edge passes.' },
      minSize: { label: 'Minimum size', description: 'Smallest chunk width, shard line length, or spark trail length for the selected fragment mode.' },
      maxSize: { label: 'Maximum size', description: 'Largest chunk width, shard line length, or spark trail length for the selected fragment mode.' },
      tangentSpeed: { label: 'Tangent speed', description: 'Motion along the direction of the sweep per animation cycle.' },
      outwardSpeed: { label: 'Outward speed', description: 'Motion away from the slash center per animation cycle.' },
      lifetime: { label: 'Lifetime', description: 'Fraction of the animation for which detached fragments remain alive.' },
      direction: { label: 'Sweep direction', description: 'Changes temporal travel along the same arc without flipping the rendered image.' },
      paletteOrder: { label: 'Palette order', description: 'Bands are sampled directly on the pixel grid. No blended colors are introduced.' },
      randomSeed: { label: 'Random seed', description: 'Re-enter the same unsigned 32-bit value to reproduce breakup exactly.' },
    },
    options: {
      ordered: 'Ordered',
      clusteredNoise: 'Clustered noise',
      directionalStreaks: 'Directional streaks',
      blockChips: 'Block chips',
      jaggedContour: 'Jagged contour',
      slashCuts: 'Slash cuts',
      pixelChunks: 'Pixel chunks',
      directionalShards: 'Directional shards',
      energySparks: 'Energy sparks',
      clockwise: 'Clockwise',
      counterClockwise: 'Counter',
    },
    palette: {
      innerEdge: 'Inner edge',
      outerEdge: 'Outer edge',
      band: 'Palette band {index}',
      removeBand: 'Remove palette band {index}',
      remove: 'Remove',
      addColorBand: 'Add color band',
    },
    seed: {
      randomize: 'Randomize',
    },
    canvas: {
      size: 'Canvas size',
      resizeProportionally: 'Resize proportionally',
      scaleEffect: 'Scale effect',
      preset: 'Preset',
      presetLabel: 'Canvas preset',
      customWidth: 'Custom canvas width',
      customHeight: 'Custom canvas height',
      apply: 'Apply',
      sizeError: 'Use whole pixels from 16 to 512.',
      presetSquare: 'Square {width}×{height}',
      presetHorizontal: 'Horizontal {width}×{height}',
      presetCustom: 'Custom',
    },
  },
  export: {
    fileName: 'pixel-{name}-{width}x{height}-{frameCount}-frames.png',
    sectionLabel: 'EXPORT',
    title: 'Export frames',
    summary: '{width} × {height} canvas · {frameCount} frames · {fps} FPS',
    tabsLabel: 'Export categories',
    tabs: {
      project: 'Project',
      spriteSheet: 'Sprite Sheet',
      animation: 'Animation',
      frameZip: 'Frame ZIP',
    },
    project: {
      summary: '{name} · {width} × {height} · {frameCount} frames · {fps} FPS',
      save: 'Save JSON',
      load: 'Load JSON',
      fileLabel: 'Project JSON file',
      imported: 'Project imported successfully.',
    },
    spriteSheet: {
      layout: 'Layout',
      horizontal: 'Horizontal',
      compactGrid: 'Compact grid',
      target: 'Target',
      pngTarget: 'PNG',
      unityTarget: 'Unity 6 package',
      expectedSize: '{width} × {height} px',
      exportPng: 'Export PNG',
      exportUnityZip: 'Export Unity ZIP',
      pixelsPerUnit: 'Pixels Per Unit',
      stableGuid: 'Stable GUID',
      stableGuidPlaceholder: 'Optional GUID…',
      stableGuidValue: 'Normalized GUID: {guid}',
      unityHint: 'Fill in a GUID to keep exports stable; leave empty to generate a new one each export.',
    },
    animation: {
      format: 'Format',
      loop: 'Loop',
      loopLabel: 'Loop animation',
      gif: 'GIF',
      apng: 'APNG',
      summary: '{width} × {height} px · {frameCount} frames · {fps} FPS',
      exportGif: 'Export GIF',
      exportApng: 'Export APNG',
    },
    frameZip: {
      summary: '{frameCount} frames · {width} × {height} px · {fps} FPS',
      includesManifest: 'Includes manifest.json for frame metadata.',
      exportButton: 'Export Frame ZIP',
    },
    preparing: 'Preparing…',
    encoding: 'Encoding…',
    errors: {
      projectFileUnreadable: 'Could not read the selected file.',
      invalidJson: 'The file is not valid JSON.',
      unsupportedSchema: 'This is not a Pixel Effect project.',
      unsupportedVersion: 'This project version is not supported.',
      wrongGenerator: 'This project was saved for a different generator.',
      invalidParameters: 'The project parameters are invalid.',
      invalidFps: 'The playback FPS is not supported.',
      invalidPpu: 'Pixels Per Unit must be an integer from 1 to 1024.',
      invalidGuid: 'Stable GUID must be empty or a valid GUID.',
      unityAtlasTooLarge: 'The Unity atlas is {width} × {height} px; Unity 6 supports up to 16384 px per side.',
      renderFailed: 'The project could not be rendered.',
      exportFailed: 'Export failed. Please try again.',
    },
    fileNames: {
      project: 'pixel-{name}-{width}x{height}-{frameCount}-frames.json',
      compactPng: 'pixel-{name}-{width}x{height}-{frameCount}-frames-compact.png',
      frameZip: 'pixel-{name}-{width}x{height}-{frameCount}-frames.zip',
      folderSequence: 'pixel-{name}-{width}x{height}-{frameCount}-frames',
      unityZip: 'pixel-{name}-{width}x{height}-{frameCount}-frames-{layout}-unity6.zip',
      unityImage: 'pixel-{name}-{width}x{height}-{frameCount}-frames-{layout}.png',
      folder: 'pixel-{name}-{width}x{height}-{frameCount}-frames-{layout}-unity6',
    },
    gifFileName: 'pixel-{name}-{width}x{height}-{frameCount}-frames-{fps}fps.gif',
    apngFileName: 'pixel-{name}-{width}x{height}-{frameCount}-frames-{fps}fps-animated.png',
  },
} as const

/** Message tree shape with plain string values, shared by every locale. */
export type MessageTree = DeepStringify<typeof enTree>

/** Recursively widens literal string values while preserving the object shape. */
type DeepStringify<T> = {
  readonly [Key in keyof T]: T[Key] extends string ? string : DeepStringify<T[Key]>
}

/** Flattens nested objects into dotted keys, e.g. `app.title`. */
type KeysOf<T, Prefix extends string = ''> = {
  readonly [Key in keyof T & string]: T[Key] extends string
    ? Join<Prefix, Key>
    : KeysOf<T[Key], Join<Prefix, Key>>
}[keyof T & string]

type Join<Prefix extends string, Key extends string> = Prefix extends '' ? Key : `${Prefix}.${Key}`

/** Every valid translation key, derived from the English dictionary. */
export type MessageKey = KeysOf<typeof enTree>

/** English messages used for rendering and as the runtime fallback. */
export const en: MessageTree = enTree

/** Simplified Chinese messages mirroring the English key structure exactly. */
export const zhCN: MessageTree = {
  app: {
    eyebrow: '像素特效工具集',
    title: '像素特效生成器',
    subtitle: '专注生成确定性、逐像素精确的游戏特效。',
    status: '{width} × {height} RGBA',
    languageLabel: '界面语言',
  },
  workspace: {
    navLabel: '特效生成器',
    generatorsLabel: '生成器',
    generatorSectionLabel: '生成器 {index} · {name}',
    parametersTitle: '{name} 参数',
    reset: '重置',
    categoryTabsLabel: '{name} 参数分类',
    categoryControls: '{label} 控件',
    exportDimensions: '{width} × {height} px · 透明 PNG',
    exportButton: '导出 PNG',
  },
  preview: {
    livePreview: '实时预览',
    canvasLabel: '像素特效动画预览',
    play: '播放动画',
    pause: '暂停动画',
    currentFrame: '当前帧',
    timingSettings: '预览播放设置',
    totalFrames: '总帧数',
    playbackFps: '播放帧率',
    fpsPreview: '{fps} FPS 预览',
    generatorTools: '生成器预览工具',
  },
  controls: {
    about: '关于 {label}',
    value: '{label} 数值',
  },
  slash: {
    name: '斩击',
    description: '动态武器拖尾与横扫攻击弧线。',
    previewTitle: '扫掠效果',
    categories: {
      shape: { label: '形状', description: '定义弧线的轮廓、朝向与透视。' },
      palette: { label: '调色板', description: '从内缘向外构建径向色带。' },
      motion: { label: '运动', description: '控制时序、拖尾长度与扫击方向。' },
      fragments: { label: '碎片', description: '控制从拖尾边缘释放碎片的形态与动画。' },
      breakup: { label: '破碎', description: '控制溶解与外缘破碎效果。' },
    },
    controls: {
      radius: { label: '半径', description: '从原点到扫击外缘的距离。' },
      thickness: { label: '厚度', description: '内缘与外缘之间彩色弧线的宽度。' },
      startAngle: { label: '起始角度', description: '屏幕空间中的起始方向：0° 指向右，90° 指向下。' },
      sweepAngle: { label: '扫掠角度', description: '从起始角度扫过的角度；超过 360° 会进行第二轮扫掠。' },
      rotation: { label: '旋转', description: '旋转完整的局部扫掠路径，调整屏幕空间中的整体挥动方向。' },
      tilt: { label: '透视倾斜', description: '压缩扫掠平面；90° 产生最薄的稳定像素投影。' },
      sweepSpeed: { label: '扫掠速度', description: '数值越高，前缘越早走完全程。' },
      trailLength: { label: '拖尾长度', description: '延缓拖尾边缘，让更多弧线保持可见。' },
      dissolveMode: { label: '溶解模式', description: '拖尾边缘如何侵蚀像素：有序抖动、簇状噪点块或条纹状撕裂。' },
      edgeMode: { label: '边缘模式', description: '外缘如何破碎：2×2 方块、锯齿轮廓或楔形切口。' },
      dissolve: { label: '溶解', description: '紧邻拖尾边缘前方的溶解过渡长度。' },
      edgeBreakup: { label: '边缘破碎', description: '当前边缘模式的外缘移除强度。' },
      breakupDepth: { label: '破碎深度', description: '在保留核心弧线的前提下，边缘破碎的最大深度。' },
      fragmentMode: { label: '碎片模式', description: '碎片如何绘制：方块碎片、切向碎片或快速消散的火花。' },
      amount: { label: '数量', description: '拖尾边缘经过时释放的彩色碎片数量。' },
      minSize: { label: '最小尺寸', description: '所选碎片模式中最小的方块边长、碎片线段长度或火花拖尾长度。' },
      maxSize: { label: '最大尺寸', description: '所选碎片模式中最大的方块边长、碎片线段长度或火花拖尾长度。' },
      tangentSpeed: { label: '切向速度', description: '每个动画周期沿扫掠方向的位移。' },
      outwardSpeed: { label: '外扩速度', description: '每个动画周期远离扫掠中心的位移。' },
      lifetime: { label: '存活时间', description: '碎片脱离后在动画中存活的时间比例。' },
      direction: { label: '扫掠方向', description: '沿同一弧线改变时间行进方向，而不翻转渲染图像。' },
      paletteOrder: { label: '调色板顺序', description: '色带直接在像素网格上采样，不引入混合颜色。' },
      randomSeed: { label: '随机种子', description: '重新输入相同的无符号 32 位数值，可精确复现破碎效果。' },
    },
    options: {
      ordered: '有序',
      clusteredNoise: '簇状噪点',
      directionalStreaks: '定向条纹',
      blockChips: '方块碎片',
      jaggedContour: '锯齿轮廓',
      slashCuts: '斩切划痕',
      pixelChunks: '像素方块',
      directionalShards: '定向碎片',
      energySparks: '能量火花',
      clockwise: '顺时针',
      counterClockwise: '逆时针',
    },
    palette: {
      innerEdge: '内缘',
      outerEdge: '外缘',
      band: '色带 {index}',
      removeBand: '删除色带 {index}',
      remove: '删除',
      addColorBand: '添加色带',
    },
    seed: {
      randomize: '随机化',
    },
    canvas: {
      size: '画布尺寸',
      resizeProportionally: '等比缩放',
      scaleEffect: '缩放效果',
      preset: '预设',
      presetLabel: '画布预设',
      customWidth: '自定义画布宽度',
      customHeight: '自定义画布高度',
      apply: '应用',
      sizeError: '画布边长需为 16 到 512 的整数。',
      presetSquare: '方形 {width}×{height}',
      presetHorizontal: '横向 {width}×{height}',
      presetCustom: '自定义',
    },
  },
  export: {
    fileName: 'pixel-{name}-{width}x{height}-{frameCount}-帧.png',
    sectionLabel: '导出',
    title: '导出帧',
    summary: '{width} × {height} 画布 · {frameCount} 帧 · {fps} FPS',
    tabsLabel: '导出分类',
    tabs: {
      project: '项目',
      spriteSheet: '精灵图',
      animation: '动图',
      frameZip: '逐帧 ZIP',
    },
    project: {
      summary: '{name} · {width} × {height} · {frameCount} 帧 · {fps} FPS',
      save: '保存 JSON',
      load: '加载 JSON',
      fileLabel: '项目 JSON 文件',
      imported: '项目导入成功。',
    },
    spriteSheet: {
      layout: '布局',
      horizontal: '横向',
      compactGrid: '紧凑网格',
      target: '目标',
      pngTarget: 'PNG',
      unityTarget: 'Unity 6 素材包',
      expectedSize: '{width} × {height} px',
      exportPng: '导出 PNG',
      exportUnityZip: '导出 Unity ZIP',
      pixelsPerUnit: '每单位像素',
      stableGuid: '固定 GUID',
      stableGuidPlaceholder: '可选 GUID…',
      stableGuidValue: '规范化 GUID：{guid}',
      unityHint: '填写 GUID 可让导出保持稳定；留空时每次导出生成新 GUID。',
    },
    animation: {
      format: '格式',
      loop: '循环',
      loopLabel: '循环动画',
      gif: 'GIF',
      apng: 'APNG',
      summary: '{width} × {height} px · {frameCount} 帧 · {fps} FPS',
      exportGif: '导出 GIF',
      exportApng: '导出 APNG',
    },
    frameZip: {
      summary: '{frameCount} 帧 · {width} × {height} px · {fps} FPS',
      includesManifest: '包含 manifest.json 帧元数据。',
      exportButton: '导出逐帧 ZIP',
    },
    preparing: '准备中…',
    encoding: '编码中…',
    errors: {
      projectFileUnreadable: '无法读取所选文件。',
      invalidJson: '文件不是有效的 JSON。',
      unsupportedSchema: '这不是像素特效项目。',
      unsupportedVersion: '不支持此项目版本。',
      wrongGenerator: '此项目保存自其他生成器。',
      invalidParameters: '项目参数无效。',
      invalidFps: '不支持的播放帧率。',
      invalidPpu: '每单位像素必须为 1 到 1024 的整数。',
      invalidGuid: '固定 GUID 必须为空或有效 GUID。',
      unityAtlasTooLarge: 'Unity 图集为 {width} × {height} px；Unity 6 每边上限为 16384 px。',
      renderFailed: '项目无法渲染。',
      exportFailed: '导出失败，请重试。',
    },
    fileNames: {
      project: 'pixel-{name}-{width}x{height}-{frameCount}-帧.json',
      compactPng: 'pixel-{name}-{width}x{height}-{frameCount}-帧-compact.png',
      frameZip: 'pixel-{name}-{width}x{height}-{frameCount}-帧.zip',
      folderSequence: 'pixel-{name}-{width}x{height}-{frameCount}-帧',
      unityZip: 'pixel-{name}-{width}x{height}-{frameCount}-帧-{layout}-unity6.zip',
      unityImage: 'pixel-{name}-{width}x{height}-{frameCount}-帧-{layout}.png',
      folder: 'pixel-{name}-{width}x{height}-{frameCount}-帧-{layout}-unity6',
    },
    gifFileName: 'pixel-{name}-{width}x{height}-{frameCount}-帧-{fps}fps.gif',
    apngFileName: 'pixel-{name}-{width}x{height}-{frameCount}-帧-{fps}fps-animated.png',
  },
}

/** Explicit named-parameter contracts for the few dynamic templates. */
export interface MessageParams {
  'app.status': { width: number; height: number }
  'workspace.generatorSectionLabel': { index: string; name: string }
  'workspace.parametersTitle': { name: string }
  'workspace.categoryTabsLabel': { name: string }
  'workspace.categoryControls': { label: string }
  'workspace.exportDimensions': { width: number; height: number }
  'export.summary': { width: number; height: number; frameCount: number; fps: number }
  'export.project.summary': { name: string; width: number; height: number; frameCount: number; fps: number }
  'export.spriteSheet.expectedSize': { width: number; height: number }
  'export.spriteSheet.stableGuidValue': { guid: string }
  'export.errors.unityAtlasTooLarge': { width: number; height: number }
  'export.animation.summary': { width: number; height: number; frameCount: number; fps: number }
  'export.frameZip.summary': { frameCount: number; width: number; height: number; fps: number }
  'preview.fpsPreview': { fps: number }
  'controls.about': { label: string }
  'controls.value': { label: string }
  'slash.palette.band': { index: number }
  'slash.palette.removeBand': { index: number }
  'slash.canvas.presetSquare': { width: number; height: number }
  'slash.canvas.presetHorizontal': { width: number; height: number }
  'export.fileName': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.project': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.compactPng': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.frameZip': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.folderSequence': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.unityZip': { name: string; width: number; height: number; frameCount: number; layout: string }
  'export.fileNames.unityImage': { name: string; width: number; height: number; frameCount: number; layout: string }
  'export.fileNames.folder': { name: string; width: number; height: number; frameCount: number; layout: string }
  'export.gifFileName': { name: string; width: number; height: number; frameCount: number; fps: number }
  'export.apngFileName': { name: string; width: number; height: number; frameCount: number; fps: number }
}

/** Parameter type for one key; keys without named parameters accept none. */
export type ParamsFor<Key extends MessageKey> = Key extends keyof MessageParams ? MessageParams[Key] : undefined

/** Translation signature used by the React context and components. */
export type TranslateFunction = <Key extends MessageKey>(key: Key, params?: ParamsFor<Key>) => string

/** Selects the message tree for a locale, falling back to English. */
export function messagesForLocale(locale: Locale): MessageTree {
  return locale === 'zh-CN' ? zhCN : en
}

/**
 * Resolves and interpolates one message. Missing keys fall back to English;
 * keys absent from both trees or missing parameters throw so gaps surface early.
 */
export function translate(
  messages: MessageTree,
  key: MessageKey,
  params?: Record<string, string | number>,
): string {
  const localTemplate = readKey(messages, key)
  const template = localTemplate ?? readKey(en, key)
  if (template === undefined) {
    throw new RangeError(`Missing translation key: ${key}`)
  }
  if (localTemplate === undefined && typeof console !== 'undefined') {
    console.warn(`Missing translation key in current locale, falling back to English: ${key}`)
  }
  return interpolate(template, params)
}

/** Walks a dotted key through a message tree. */
function readKey(tree: MessageTree, key: string): string | undefined {
  let current: unknown = tree
  for (const segment of key.split('.')) {
    if (typeof current !== 'object' || current === null || !(segment in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[segment]
  }
  return typeof current === 'string' ? current : undefined
}

/** Replaces every `{name}` placeholder with its provided value. */
function interpolate(template: string, params: Record<string, string | number> | undefined): string {
  const values = params ?? {}
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    if (!(name in values)) {
      throw new RangeError(`Missing interpolation parameter: ${name}`)
    }
    return String(values[name])
  })
}

/** Stable translation keys for one generator's name, description, and preview title. */
export interface GeneratorDisplayKeys {
  readonly name: MessageKey
  readonly description: MessageKey
  readonly previewTitle: MessageKey
}

/** Stable translation keys for one generator category's label and description. */
export interface CategoryDisplayKeys {
  readonly label: MessageKey
  readonly description: MessageKey
}

const GENERATOR_DISPLAY_KEYS: Readonly<Record<string, GeneratorDisplayKeys>> = {
  slash: {
    name: 'slash.name',
    description: 'slash.description',
    previewTitle: 'slash.previewTitle',
  },
}

const CATEGORY_DISPLAY_KEYS: Readonly<Record<string, Readonly<Record<string, CategoryDisplayKeys>>>> = {
  slash: {
    shape: { label: 'slash.categories.shape.label', description: 'slash.categories.shape.description' },
    palette: { label: 'slash.categories.palette.label', description: 'slash.categories.palette.description' },
    motion: { label: 'slash.categories.motion.label', description: 'slash.categories.motion.description' },
    fragments: { label: 'slash.categories.fragments.label', description: 'slash.categories.fragments.description' },
    breakup: { label: 'slash.categories.breakup.label', description: 'slash.categories.breakup.description' },
  },
}

/** Returns translated display keys for a generator id, or undefined to keep the definition fallback. */
export function generatorDisplayKeys(generatorId: string): GeneratorDisplayKeys | undefined {
  return GENERATOR_DISPLAY_KEYS[generatorId]
}

/** Returns translated display keys for one category of a generator id, or undefined for the fallback. */
export function categoryDisplayKeys(generatorId: string, categoryId: string): CategoryDisplayKeys | undefined {
  return CATEGORY_DISPLAY_KEYS[generatorId]?.[categoryId]
}
