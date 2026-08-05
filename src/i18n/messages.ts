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
  desktop: {
    titleBar: {
      file: 'File',
      newProject: 'New Project',
      openProject: 'Open Project…',
      openRecent: 'Open Recent',
      noRecent: 'No recent projects',
      clearRecent: 'Clear recent projects',
      save: 'Save',
      saveAs: 'Save As…',
      exit: 'Exit',
      minimize: 'Minimize',
      maximize: 'Maximize',
      restore: 'Restore',
      close: 'Close',
      untitled: 'Untitled',
      unsaved: 'Unsaved changes',
    },
    confirm: {
      title: 'Unsaved changes',
      message: 'Save changes to the current project?',
      save: 'Save',
      discard: 'Discard',
      cancel: 'Cancel',
    },
    toasts: {
      savedProject: 'Saved project',
      newProject: 'Created a new project',
      saveFailed: 'Save failed. Please try again.',
      openFailed: 'Could not open this project.',
      recentFailed: 'The recent project could not be opened.',
    },
  },
  toast: {
    label: 'Notifications',
    dismiss: 'Dismiss notification',
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
    zoom: 'Zoom',
    zoomFit: 'Fit',
    zoomOption: '{zoom}×',
  },
  previewTools: {
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
  presets: {
    selectLabel: 'Effect preset',
    placeholder: 'Presets…',
    builtInGroup: 'Built-in',
    customGroup: 'Custom',
    modified: 'Modified',
    saveAs: 'Save as…',
    update: 'Update',
    manage: 'Manage',
    manageDialogLabel: 'Manage presets',
    saveNameLabel: 'Preset name',
    saveConfirm: 'Save',
    cancel: 'Cancel',
    confirm: 'OK',
    rename: 'Rename',
    delete: 'Delete',
    confirmDelete: 'Confirm delete?',
    noCustom: 'No custom presets yet.',
    warning: 'Local preset data was unreadable and was ignored.',
    storageHint: 'Custom presets need browser storage; built-in presets still work.',
    errors: {
      nameLength: 'Preset name must be 1–40 characters.',
      limit: 'Maximum 32 custom presets per generator.',
      storageUnavailable: 'Browser storage is unavailable.',
      invalidPreset: 'This preset could not be applied.',
    },
  },
  controls: {
    about: 'About {label}',
    value: '{label} value',
  },
  slash: {
    name: 'Slash',
    description: 'Animated weapon trails and sweeping attack arcs.',
    previewTitle: 'Sweep study',
    presets: {
      cleanArc: { name: 'Clean Arc', description: 'A crisp, low-breakup base slash.' },
      heavyCleave: { name: 'Heavy Cleave', description: 'A thick arc with a long, heavy trail.' },
      energySweep: { name: 'Energy Sweep', description: 'A bright palette with fast energy sparks.' },
      shatteredEdge: { name: 'Shattered Edge', description: 'A heavily broken edge with directional shards.' },
      fullCircle: { name: 'Full Circle', description: 'A complete 360-degree ring sweep.' },
    },
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
  },
  explosion: {
    name: 'Explosion',
    description: 'Layered pixel explosions and converging energy effects.',
    previewTitle: 'Radial burst study',
    categories: {
      shape: { label: 'Shape', description: 'Compose the body, flash core, and shockwave.' },
      palette: { label: 'Palette', description: 'Order discrete colors from the hot core to the dark edge.' },
      motion: { label: 'Motion', description: 'Control expansion, convergence, timing, and dissolve.' },
      fragments: { label: 'Fragments', description: 'Scatter or gather deterministic pixel debris.' },
      trails: { label: 'Trails', description: 'Shape energy rays or flame strands that travel with the burst.' },
    },
    controls: {
      mode: { label: 'Effect mode', description: 'Use dedicated timing for an outward explosion or inward implosion.' },
      bodyStyle: { label: 'Body style', description: 'Modern clean color clusters or the dense retro pixel noise.' },
      shockwaveStyle: { label: 'Shockwave style', description: 'Segmented impact arcs or the original complete ring.' },
      trailMode: { label: 'Trail mode', description: 'Sharp tapered energy rays or thicker forked flame strands.' },
      radius: { label: 'Radius', description: 'Maximum radius of the centered layered effect.' },
      bodyStrength: { label: 'Body strength', description: 'Density of the main colored burst body; zero disables it.' },
      irregularity: { label: 'Irregularity', description: 'Amount of deterministic contour variation and edge breakup.' },
      coreRadius: { label: 'Flash core', description: 'Radius of the hot flash; zero disables the core.' },
      shockwaveWidth: { label: 'Shockwave width', description: 'Pixel width of the radial ring; zero disables it.' },
      expansionSpeed: { label: 'Radial speed', description: 'Shapes how quickly the body expands or converges.' },
      coreDuration: { label: 'Core duration', description: 'Fraction of the animation occupied by the flash core.' },
      shockwaveSpeed: { label: 'Shockwave speed', description: 'Shapes how quickly the shockwave crosses its path.' },
      dissolveStart: { label: 'Dissolve start', description: 'Point at which the main body begins losing pixels.' },
      fragmentAmount: { label: 'Amount', description: 'Number of deterministic fragments; zero disables them.' },
      fragmentMinSize: { label: 'Minimum size', description: 'Smallest square fragment size.' },
      fragmentMaxSize: { label: 'Maximum size', description: 'Largest square fragment size.' },
      fragmentRadialSpeed: { label: 'Radial distance', description: 'Distance fragments travel away from or toward the center.' },
      fragmentTangentialJitter: { label: 'Tangential drift', description: 'Sideways deviation from each fragment radial path.' },
      fragmentLifetime: { label: 'Lifetime', description: 'Fraction of the animation in which fragments participate.' },
      trailAmount: { label: 'Trail count', description: 'Number of rays or strands; zero disables trails.' },
      trailLength: { label: 'Trail length', description: 'Maximum visible trail length; zero disables trails.' },
      trailWidth: { label: 'Trail width', description: 'Base pixel width of each ray or strand.' },
      trailLengthRandomness: { label: 'Length randomness', description: 'How much individual trail lengths vary.' },
      seed: { label: 'Random seed', description: 'Unsigned 32-bit value used to reproduce the same effect.' },
    },
    options: {
      explosion: 'Explosion',
      implosion: 'Implosion',
      cleanClusters: 'Clean clusters',
      pixelNoise: 'Pixel noise',
      segmentedArc: 'Segmented arc',
      fullRing: 'Full ring',
      energyRays: 'Energy rays',
      flameStrands: 'Flame strands',
    },
    palette: {
      hotCore: 'Hot core',
      outerEdge: 'Dark edge',
      band: 'Explosion palette band {index}',
      removeBand: 'Remove explosion palette band {index}',
      remove: 'Remove',
      addColorBand: 'Add color band',
    },
    presets: {
      modernBurst: {
        name: 'Modern Burst',
        description: 'The modern flame body with segmented arcs and energy rays.',
      },
      modernImplosion: {
        name: 'Modern Implosion',
        description: 'The same modern language collapsing inward with longer flame strands.',
      },
      retroBurst: {
        name: 'Retro Burst',
        description: 'The original warm ring with dense pixel noise and square debris.',
      },
    },
    seed: { randomize: 'Randomize' },
  },
  project: {
    menu: 'Project',
    open: 'Open project…',
    save: 'Save project',
    opening: 'Opening…',
    saving: 'Saving…',
    imported: 'Project imported successfully.',
    fileLabel: 'Project JSON file',
    fileName: 'pixel-{name}-{width}x{height}-{frameCount}-frames.json',
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
      renderFailed: 'The project could not be rendered.',
      downloadFailed: 'Save failed. Please try again.',
    },
  },
    export: {
      fileName: 'pixel-{name}-{width}x{height}-{frameCount}-frames.png',
    sectionLabel: 'EXPORT',
    title: 'Export frames',
    summary: '{width} × {height} canvas · {frameCount} frames · {fps} FPS',
    tabsLabel: 'Export categories',
    tabs: {
      spriteSheet: 'Sprite Sheet',
      animation: 'Animation',
      frameZip: 'Frame ZIP',
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
    atlasPreview: {
      toggle: 'Sprite sheet preview',
      meta: '{width} × {height} px · {layout}',
      layoutHorizontal: 'Horizontal',
      layoutCompact: 'Compact grid',
      zoomLabel: 'Preview zoom',
      zoomFit: 'Fit',
      zoomOption: '{zoom}×',
      canvasLabel: 'Packed sprite sheet preview',
    },
    frameZip: {
      summary: '{frameCount} frames · {width} × {height} px · {fps} FPS',
      includesManifest: 'Includes manifest.json for frame metadata.',
      exportButton: 'Export Frame ZIP',
    },
    preparing: 'Preparing…',
    encoding: 'Encoding…',
    toasts: {
      exportingPng: 'Exporting PNG…',
      exportingGif: 'Encoding GIF…',
      exportingApng: 'Encoding APNG…',
      exportingFrameZip: 'Preparing frame ZIP…',
      exportingUnityZip: 'Preparing Unity package…',
      savingProject: 'Saving project…',
      exportedPng: 'Exported PNG',
      exportedGif: 'Exported GIF',
      exportedApng: 'Exported APNG',
      exportedFrameZip: 'Exported frame ZIP',
      exportedUnityZip: 'Exported Unity package',
    },
    errors: {
      invalidPpu: 'Pixels Per Unit must be an integer from 1 to 1024.',
      invalidGuid: 'Stable GUID must be empty or a valid GUID.',
      unityAtlasTooLarge: 'The Unity atlas is {width} × {height} px; Unity 6 supports up to 16384 px per side.',
      exportFailed: 'Export failed. Please try again.',
    },
    fileNames: {
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
  desktop: {
    titleBar: {
      file: '文件',
      newProject: '新建项目',
      openProject: '打开项目…',
      openRecent: '最近项目',
      noRecent: '暂无最近项目',
      clearRecent: '清空最近项目',
      save: '保存',
      saveAs: '另存为…',
      exit: '退出',
      minimize: '最小化',
      maximize: '最大化',
      restore: '还原',
      close: '关闭',
      untitled: '未命名',
      unsaved: '有未保存的修改',
    },
    confirm: {
      title: '未保存的修改',
      message: '要保存当前项目的修改吗？',
      save: '保存',
      discard: '不保存',
      cancel: '取消',
    },
    toasts: {
      savedProject: '项目已保存',
      newProject: '已创建新项目',
      saveFailed: '保存失败，请重试。',
      openFailed: '无法打开该项目。',
      recentFailed: '无法打开该最近项目。',
    },
  },
  toast: {
    label: '通知',
    dismiss: '关闭通知',
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
    zoom: '缩放',
    zoomFit: '适应',
    zoomOption: '{zoom}×',
  },
  previewTools: {
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
  presets: {
    selectLabel: '效果预设',
    placeholder: '预设…',
    builtInGroup: '内置',
    customGroup: '自定义',
    modified: '已修改',
    saveAs: '另存为…',
    update: '更新',
    manage: '管理',
    manageDialogLabel: '管理预设',
    saveNameLabel: '预设名称',
    saveConfirm: '保存',
    cancel: '取消',
    confirm: '确定',
    rename: '重命名',
    delete: '删除',
    confirmDelete: '确认删除？',
    noCustom: '暂无自定义预设。',
    warning: '本地预设数据无法读取，已忽略。',
    storageHint: '自定义预设需要浏览器存储；内置预设仍可用。',
    errors: {
      nameLength: '预设名称需为 1–40 个字符。',
      limit: '每个生成器最多 32 个自定义预设。',
      storageUnavailable: '浏览器存储不可用。',
      invalidPreset: '该预设无法应用。',
    },
  },
  controls: {
    about: '关于 {label}',
    value: '{label} 数值',
  },
  slash: {
    name: '斩击',
    description: '动态武器拖尾与横扫攻击弧线。',
    previewTitle: '扫掠效果',
    presets: {
      cleanArc: { name: '干净弧光', description: '清晰、低破碎的基础刀光。' },
      heavyCleave: { name: '重斩', description: '较厚、拖尾较长的重击弧线。' },
      energySweep: { name: '能量横扫', description: '鲜亮色板与快速能量火花。' },
      shatteredEdge: { name: '碎裂边缘', description: '明显破口与定向碎片。' },
      fullCircle: { name: '整圆', description: '完整的 360° 环形扫击。' },
    },
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
  },
  explosion: {
    name: '爆炸与内聚',
    description: '分层像素爆炸与能量汇聚效果。',
    previewTitle: '径向爆发实验',
    categories: {
      shape: { label: '造型', description: '组合爆体、闪核与冲击环。' },
      palette: { label: '调色板', description: '从白热点到暗色外缘排列离散颜色。' },
      motion: { label: '运动', description: '控制扩张、内聚、时序与消散。' },
      fragments: { label: '碎片', description: '散射或汇聚可复现的像素碎片。' },
      trails: { label: '拖尾', description: '塑造随爆发伸展或收束的能量射线与火焰拉丝。' },
    },
    controls: {
      mode: { label: '效果模式', description: '使用专门时序生成向外爆炸或向内聚合。' },
      bodyStyle: { label: '主体风格', description: '现代干净色块，或密集的复古像素噪点。' },
      shockwaveStyle: { label: '冲击波风格', description: '带缺口的分段冲击弧，或原有的完整圆环。' },
      trailMode: { label: '拖尾模式', description: '锐利的锥形能量射线，或较粗且分叉的火焰拉丝。' },
      radius: { label: '半径', description: '居中分层效果的最大半径。' },
      bodyStrength: { label: '爆体强度', description: '主体彩色爆体的密度；设为零可关闭。' },
      irregularity: { label: '不规则度', description: '确定性轮廓变化与边缘破碎的程度。' },
      coreRadius: { label: '闪核半径', description: '高亮闪核的半径；设为零可关闭。' },
      shockwaveWidth: { label: '冲击环宽度', description: '径向冲击环的像素宽度；设为零可关闭。' },
      expansionSpeed: { label: '径向速度', description: '调整爆体扩张或内聚的速度曲线。' },
      coreDuration: { label: '闪核时长', description: '闪核占据整个动画的时间比例。' },
      shockwaveSpeed: { label: '冲击环速度', description: '调整冲击环走完整条路径的速度曲线。' },
      dissolveStart: { label: '消散起点', description: '主体爆体开始丢失像素的时间点。' },
      fragmentAmount: { label: '碎片数量', description: '确定性碎片数量；设为零可关闭。' },
      fragmentMinSize: { label: '最小尺寸', description: '最小方块碎片的边长。' },
      fragmentMaxSize: { label: '最大尺寸', description: '最大方块碎片的边长。' },
      fragmentRadialSpeed: { label: '径向距离', description: '碎片向外飞散或向内汇入的距离。' },
      fragmentTangentialJitter: { label: '切向漂移', description: '碎片偏离径向路径的横向距离。' },
      fragmentLifetime: { label: '存活时间', description: '碎片参与动画的时间比例。' },
      trailAmount: { label: '拖尾数量', description: '射线或拉丝的数量；设为零可关闭。' },
      trailLength: { label: '拖尾长度', description: '可见拖尾的最大长度；设为零可关闭。' },
      trailWidth: { label: '拖尾宽度', description: '每条射线或拉丝的基础像素宽度。' },
      trailLengthRandomness: { label: '长度随机度', description: '各条拖尾长度之间的差异程度。' },
      seed: { label: '随机种子', description: '用于精确复现同一效果的无符号 32 位数值。' },
    },
    options: {
      explosion: '爆炸',
      implosion: '内聚',
      cleanClusters: '干净色块',
      pixelNoise: '像素噪点',
      segmentedArc: '分段弧',
      fullRing: '完整圆环',
      energyRays: '能量射线',
      flameStrands: '火焰拉丝',
    },
    palette: {
      hotCore: '白热点',
      outerEdge: '暗色外缘',
      band: '爆炸色带 {index}',
      removeBand: '删除爆炸色带 {index}',
      remove: '删除',
      addColorBand: '添加色带',
    },
    presets: {
      modernBurst: {
        name: '现代爆发',
        description: '现代火焰主体，配分段冲击弧与能量射线。',
      },
      modernImplosion: {
        name: '现代内聚',
        description: '同一视觉语言向内坍缩，配更长的火焰拉丝。',
      },
      retroBurst: {
        name: '复古爆发',
        description: '原有暖色圆环、密集像素噪点与方块碎片。',
      },
    },
    seed: { randomize: '随机化' },
  },
  project: {
    menu: '项目',
    open: '打开项目…',
    save: '保存项目',
    opening: '打开中…',
    saving: '保存中…',
    imported: '项目导入成功。',
    fileLabel: '项目 JSON 文件',
    fileName: 'pixel-{name}-{width}x{height}-{frameCount}-帧.json',
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
      renderFailed: '项目无法渲染。',
      downloadFailed: '保存失败，请重试。',
    },
  },
  export: {
    fileName: 'pixel-{name}-{width}x{height}-{frameCount}-帧.png',
    sectionLabel: '导出',
    title: '导出帧',
    summary: '{width} × {height} 画布 · {frameCount} 帧 · {fps} FPS',
    tabsLabel: '导出分类',
    tabs: {
      spriteSheet: '精灵图',
      animation: '动图',
      frameZip: '逐帧 ZIP',
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
    atlasPreview: {
      toggle: '精灵图预览',
      meta: '{width} × {height} px · {layout}',
      layoutHorizontal: '横向',
      layoutCompact: '紧凑网格',
      zoomLabel: '预览缩放',
      zoomFit: '适应',
      zoomOption: '{zoom}×',
      canvasLabel: '打包精灵图预览',
    },
    frameZip: {
      summary: '{frameCount} 帧 · {width} × {height} px · {fps} FPS',
      includesManifest: '包含 manifest.json 帧元数据。',
      exportButton: '导出逐帧 ZIP',
    },
    preparing: '准备中…',
    encoding: '编码中…',
    toasts: {
      exportingPng: '正在导出 PNG…',
      exportingGif: '正在编码 GIF…',
      exportingApng: '正在编码 APNG…',
      exportingFrameZip: '正在准备逐帧 ZIP…',
      exportingUnityZip: '正在准备 Unity 素材包…',
      savingProject: '正在保存项目…',
      exportedPng: '已导出 PNG',
      exportedGif: '已导出 GIF',
      exportedApng: '已导出 APNG',
      exportedFrameZip: '已导出逐帧 ZIP',
      exportedUnityZip: '已导出 Unity 素材包',
    },
    errors: {
      invalidPpu: '每单位像素必须为 1 到 1024 的整数。',
      invalidGuid: '固定 GUID 必须为空或有效 GUID。',
      unityAtlasTooLarge: 'Unity 图集为 {width} × {height} px；Unity 6 每边上限为 16384 px。',
      exportFailed: '导出失败，请重试。',
    },
    fileNames: {
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
  'export.spriteSheet.expectedSize': { width: number; height: number }
  'export.spriteSheet.stableGuidValue': { guid: string }
  'export.errors.unityAtlasTooLarge': { width: number; height: number }
  'export.animation.summary': { width: number; height: number; frameCount: number; fps: number }
  'export.frameZip.summary': { frameCount: number; width: number; height: number; fps: number }
  'preview.fpsPreview': { fps: number }
  'preview.zoomOption': { zoom: number }
  'controls.about': { label: string }
  'controls.value': { label: string }
  'slash.palette.band': { index: number }
  'slash.palette.removeBand': { index: number }
  'explosion.palette.band': { index: number }
  'explosion.palette.removeBand': { index: number }
  'previewTools.canvas.presetSquare': { width: number; height: number }
  'previewTools.canvas.presetHorizontal': { width: number; height: number }
  'export.fileName': { name: string; width: number; height: number; frameCount: number }
  'project.fileName': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.compactPng': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.frameZip': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.folderSequence': { name: string; width: number; height: number; frameCount: number }
  'export.fileNames.unityZip': { name: string; width: number; height: number; frameCount: number; layout: string }
  'export.fileNames.unityImage': { name: string; width: number; height: number; frameCount: number; layout: string }
  'export.fileNames.folder': { name: string; width: number; height: number; frameCount: number; layout: string }
  'export.atlasPreview.meta': { width: number; height: number; layout: string }
  'export.atlasPreview.zoomOption': { zoom: number }
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

/** Stable translation keys for one generator preset name and description. */
export interface PresetDisplayKeys {
  readonly name: MessageKey
  readonly description: MessageKey
}

const GENERATOR_DISPLAY_KEYS: Readonly<Record<string, GeneratorDisplayKeys>> = {
  slash: {
    name: 'slash.name',
    description: 'slash.description',
    previewTitle: 'slash.previewTitle',
  },
  explosion: {
    name: 'explosion.name',
    description: 'explosion.description',
    previewTitle: 'explosion.previewTitle',
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
  explosion: {
    shape: { label: 'explosion.categories.shape.label', description: 'explosion.categories.shape.description' },
    palette: { label: 'explosion.categories.palette.label', description: 'explosion.categories.palette.description' },
    motion: { label: 'explosion.categories.motion.label', description: 'explosion.categories.motion.description' },
    fragments: { label: 'explosion.categories.fragments.label', description: 'explosion.categories.fragments.description' },
    trails: { label: 'explosion.categories.trails.label', description: 'explosion.categories.trails.description' },
  },
}

const PRESET_DISPLAY_KEYS: Readonly<Record<string, Readonly<Record<string, PresetDisplayKeys>>>> = {
  slash: {
    cleanArc: { name: 'slash.presets.cleanArc.name', description: 'slash.presets.cleanArc.description' },
    heavyCleave: { name: 'slash.presets.heavyCleave.name', description: 'slash.presets.heavyCleave.description' },
    energySweep: { name: 'slash.presets.energySweep.name', description: 'slash.presets.energySweep.description' },
    shatteredEdge: { name: 'slash.presets.shatteredEdge.name', description: 'slash.presets.shatteredEdge.description' },
    fullCircle: { name: 'slash.presets.fullCircle.name', description: 'slash.presets.fullCircle.description' },
  },
  explosion: {
    modernBurst: { name: 'explosion.presets.modernBurst.name', description: 'explosion.presets.modernBurst.description' },
    modernImplosion: { name: 'explosion.presets.modernImplosion.name', description: 'explosion.presets.modernImplosion.description' },
    retroBurst: { name: 'explosion.presets.retroBurst.name', description: 'explosion.presets.retroBurst.description' },
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

/** Returns translated display keys for one preset id, or undefined. */
export function presetDisplayKeys(generatorId: string, presetId: string): PresetDisplayKeys | undefined {
  return PRESET_DISPLAY_KEYS[generatorId]?.[presetId]
}
