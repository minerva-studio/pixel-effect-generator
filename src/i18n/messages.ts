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
    description: 'Physical fire, pressure release, rolling fireballs, and retro blasts.',
    previewTitle: 'Fire burst study',
    categories: {
      body: { label: 'Body', description: 'Pick the fire shape and tune its size, outline, and surface material.' },
      motion: { label: 'Motion', description: 'Control direction, formation, hold, dissolve, and the motion curve.' },
      effects: { label: 'Effects', description: 'Toggle and tune flash core, shockwave, fire jets, and fragments.' },
      palette: { label: 'Palette', description: 'Order discrete colors from the hot core to the dark edge.' },
    },
    controls: {
      shape: { label: 'Body shape', description: 'Choose a combustion silhouette; cards loop a fixed-seed preview.' },
      radius: { label: 'Radius', description: 'Maximum radius of the centered fireball.' },
      churnAmount: { label: 'Churn amount', description: 'How strongly the fire blobs roll, merge, and wobble over time.' },
      pressureWidth: { label: 'Pressure front', description: 'Pixel width of the hot leading edge released by the burst.' },
      pressureSharpness: { label: 'Front sharpness', description: 'Keeps the pressure front crisp instead of noisy.' },
      shapeIrregularity: { label: 'Shape irregularity', description: 'Varies blob angle, size, and timing; zero produces a regular outline.' },
      rotation: { label: 'Rotation', description: 'Rotates the body, fire jets, and directional shock fronts together.' },
      surfaceStyle: { label: 'Surface material', description: 'Choose how the fire body is layered, sooted, or pixel-eroded.' },
      coverage: { label: 'Body integrity', description: 'Keeps more of the body geometry without changing the surface grain.' },
      bandWarp: { label: 'Band curvature', description: 'Bends burning layer boundaries with smooth low-frequency variation.' },
      edgeBreakup: { label: 'Edge breakup', description: 'Controls how unevenly burning layers erode inward from the silhouette.' },
      sootAmount: { label: 'Soot amount', description: 'Controls the bounded amount of dark rolling soot clouds.' },
      sootScale: { label: 'Soot scale', description: 'Spatial scale of smooth soot clouds.' },
      mode: { label: 'Direction', description: 'Outward explosion or inward implosion with mirrored timing.' },
      motionCurve: { label: 'Motion curve', description: 'Shapes how quickly formation and pressure release accelerate.' },
      formationDuration: { label: 'Formation time', description: 'Fraction of the animation used to reach full size.' },
      holdDuration: { label: 'Hold time', description: 'Fraction of the animation held at full size before dissolving.' },
      dissolveStart: { label: 'Dissolve time', description: 'Point at which the body begins its defined breakup.' },
      core: { label: 'Flash core', description: 'Short-lived hot center flash at the impact end.' },
      coreRadius: { label: 'Core radius', description: 'Maximum radius of the enabled hot flash.' },
      coreDuration: { label: 'Core duration', description: 'Fraction of the animation occupied by the flash core.' },
      shockwave: { label: 'Shockwave', description: 'A centered polar front that never perturbs the body outline.' },
      shockwaveMode: { label: 'Shockwave type', description: 'Disable the wave or choose a full ring or compound multi-ring; rings can be squashed.' },
      shockwaveColorMode: { label: 'Color mode', description: 'Flat single color or a radial gradient across each wave band.' },
      shockwaveThickness: { label: 'Thickness', description: 'Radial band thickness of each wave ring.' },
      shockwaveStartRadius: { label: 'Start radius', description: 'Wave start radius as a percentage of the body radius.' },
      shockwaveEndRadius: { label: 'End radius', description: 'Wave end radius as a percentage of the body radius.' },
      shockwaveStartTime: { label: 'Start time', description: 'Point in the animation when the wave begins moving.' },
      shockwaveDuration: { label: 'Duration', description: 'Fraction of the animation used to travel between the two radii.' },
      shockwaveRingCount: { label: 'Ring count', description: 'Number of complete rings that chase each other across the same path.' },
      shockwaveRingSpacing: { label: 'Ring spacing', description: 'Time stagger between consecutive rings; higher values spread them out.' },
      shockwaveSquash: { label: 'Squash amount', description: 'Elliptical flattening along the squash axis for an impact feel.' },
      shockwaveSquashAngle: { label: 'Squash angle', description: 'Angle of the flattening axis in degrees.' },
      tongues: { label: 'Fire jets', description: 'Filled tapered flames launched from balanced body tips.' },
      tongueCount: { label: 'Jet count', description: 'Exact number of angularly balanced active flames.' },
      tongueLength: { label: 'Jet length', description: 'Maximum filled extension beyond each selected tip.' },
      tongueWidth: { label: 'Root width', description: 'Width where each jet overlaps its owning body tip.' },
      tongueCurvature: { label: 'Curvature', description: 'Bounded sideways bend without changing jet distribution.' },
      tongueVariation: { label: 'Length variation', description: 'Bounded deterministic length difference between selected jets.' },
      fragments: { label: 'Char fragments', description: 'Deterministic square debris flying outward or inward.' },
      fragmentCount: { label: 'Fragment count', description: 'Exact number of generated fragments.' },
      fragmentMinSize: { label: 'Minimum size', description: 'Smallest square fragment size.' },
      fragmentMaxSize: { label: 'Maximum size', description: 'Largest square fragment size.' },
      fragmentTravelDistance: { label: 'Travel distance', description: 'Distance fragments travel away from or toward the center.' },
      fragmentTangentialDrift: { label: 'Tangential drift', description: 'Sideways deviation from each fragment radial path.' },
      fragmentLifetime: { label: 'Lifetime', description: 'Fraction of the animation in which fragments participate.' },
      seed: { label: 'Random seed', description: 'Unsigned 32-bit value used to reproduce the same effect.' },
    },
    options: {
      explosion: 'Explosion',
      implosion: 'Implosion',
      crisp: 'Crisp',
      balanced: 'Balanced',
      drifting: 'Drifting',
      billowingFireball: 'Billowing fireball',
      pressureBurst: 'Pressure burst',
      legacyRadial: 'Legacy radial',
      burningLayers: 'Burning layers',
      rollingSoot: 'Rolling soot',
      retroPixel: 'Retro pixel',
      shockwaveNone: 'Off',
      shockwaveMultiRing: 'Compound multi-ring',
      shockwaveColorFlat: 'Single color',
      shockwaveColorGradient: 'Radial gradient',
      shockwaveRing: 'Complete ring',
    },
    shapeDescriptions: {
      billowingFireball: 'Churning merged fire blobs with soot edges.',
      pressureBurst: 'A compact flash releases a sharp connected front.',
      legacyRadial: 'The original dense radial pixel explosion.',
    },
    effects: { enabled: 'On', disabled: 'Off' },
    palette: {
      hotCore: 'Hot core',
      outerEdge: 'Dark edge',
      band: 'Explosion palette band {index}',
      removeBand: 'Remove explosion palette band {index}',
      remove: 'Remove',
      addColorBand: 'Add color band',
    },
    presets: {
      rollingFireball: { name: 'Rolling Fireball', description: 'Churning merged fire blobs with burning layers and fire jets.' },
      pressureBurst: { name: 'Pressure Burst', description: 'A compact flash releases a sharp center-connected pressure front.' },
      retroBurst: { name: 'Retro Burst', description: 'The original radial ring with dense per-pixel noise.' },
    },
    seed: { randomize: 'Randomize' },
  },
  energyBloom: {
    name: 'Energy Bloom',
    description: 'Petal, star, and corolla energy effects with vivid convergence.',
    previewTitle: 'Bloom study',
    categories: {
      body: { label: 'Body', description: 'Pick the bloom shape and tune its size, outline, and surface material.' },
      motion: { label: 'Motion', description: 'Control direction, formation, hold, dissolve, and the motion curve.' },
      effects: { label: 'Effects', description: 'Toggle and tune flash core, shockwave, energy tongues, and shards.' },
      palette: { label: 'Palette', description: 'Order discrete colors from the bright center to the deep outer edge.' },
    },
    controls: {
      shape: { label: 'Bloom shape', description: 'Choose a petal, star, or corolla silhouette; cards loop a fixed-seed preview.' },
      radius: { label: 'Radius', description: 'Maximum radius of the centered bloom.' },
      petalCount: { label: 'Petal count', description: 'Number of rounded petals around the shared center.' },
      petalStretch: { label: 'Petal stretch', description: 'Elongates each petal away from the shared center.' },
      rayCount: { label: 'Ray count', description: 'Number of tapered star rays radiating from the center.' },
      rayTaper: { label: 'Ray taper', description: 'Sharper wedges as the value rises; lower values read as soft rays.' },
      corollaLayers: { label: 'Corolla layers', description: 'Two or three staggered petal rings around the center.' },
      layerDelay: { label: 'Layer delay', description: 'Staggers each corolla layer; outer layers open later or close first.' },
      shapeIrregularity: { label: 'Shape irregularity', description: 'Varies petal angle, size, and timing; zero produces a regular bloom.' },
      rotation: { label: 'Rotation', description: 'Rotates the body, energy tongues, and directional shock fronts together.' },
      surfaceStyle: { label: 'Surface material', description: 'Choose how the bloom body is banded, hollowed, cracked, or eroded.' },
      coverage: { label: 'Body integrity', description: 'Keeps more of the body geometry without changing the surface grain.' },
      bandWarp: { label: 'Band curvature', description: 'Bends cel-shaded band boundaries with smooth low-frequency variation.' },
      edgeBreakup: { label: 'Edge breakup', description: 'Controls how unevenly cel shading erodes inward from the silhouette.' },
      cavityAmount: { label: 'Cavity amount', description: 'Controls the bounded amount of hollow molten regions.' },
      cavityScale: { label: 'Cavity scale', description: 'Spatial scale of smooth molten cavities.' },
      chunkSize: { label: 'Chunk size', description: 'Stable plate size used by the crystal shard surface.' },
      crackWidth: { label: 'Crack width', description: 'One- or two-pixel separation between crystal plates.' },
      mode: { label: 'Direction', description: 'Outward bloom or inward convergence with mirrored timing.' },
      motionCurve: { label: 'Motion curve', description: 'Shapes how quickly formation and convergence accelerate.' },
      formationDuration: { label: 'Formation time', description: 'Fraction of the animation used to reach full size.' },
      holdDuration: { label: 'Hold time', description: 'Fraction of the animation held at full size before dissolving.' },
      dissolveStart: { label: 'Dissolve time', description: 'Point at which the body begins its defined breakup.' },
      core: { label: 'Flash core', description: 'Short-lived bright center flash at the impact end.' },
      coreRadius: { label: 'Core radius', description: 'Maximum radius of the enabled flash.' },
      coreDuration: { label: 'Core duration', description: 'Fraction of the animation occupied by the flash core.' },
      shockwave: { label: 'Shockwave', description: 'A centered polar front that never perturbs the bloom outline.' },
      shockwaveMode: { label: 'Shockwave type', description: 'Disable the wave or choose a full ring or compound multi-ring; rings can be squashed.' },
      shockwaveColorMode: { label: 'Color mode', description: 'Flat single color or a radial gradient across each wave band.' },
      shockwaveThickness: { label: 'Thickness', description: 'Radial band thickness of each wave ring.' },
      shockwaveStartRadius: { label: 'Start radius', description: 'Wave start radius as a percentage of the body radius.' },
      shockwaveEndRadius: { label: 'End radius', description: 'Wave end radius as a percentage of the body radius.' },
      shockwaveStartTime: { label: 'Start time', description: 'Point in the animation when the wave begins moving.' },
      shockwaveDuration: { label: 'Duration', description: 'Fraction of the animation used to travel between the two radii.' },
      shockwaveRingCount: { label: 'Ring count', description: 'Number of complete rings that chase each other across the same path.' },
      shockwaveRingSpacing: { label: 'Ring spacing', description: 'Time stagger between consecutive rings; higher values spread them out.' },
      shockwaveSquash: { label: 'Squash amount', description: 'Elliptical flattening along the squash axis for an impact feel.' },
      shockwaveSquashAngle: { label: 'Squash angle', description: 'Angle of the flattening axis in degrees.' },
      tongues: { label: 'Energy tongues', description: 'Filled tapered ribbons launched from petal or star tips.' },
      tongueCount: { label: 'Tongue count', description: 'Exact number of angularly balanced active tongues.' },
      tongueLength: { label: 'Tongue length', description: 'Maximum filled extension beyond each selected tip.' },
      tongueWidth: { label: 'Root width', description: 'Width where each tongue overlaps its owning tip.' },
      tongueCurvature: { label: 'Curvature', description: 'Bounded sideways bend without changing tongue distribution.' },
      tongueVariation: { label: 'Length variation', description: 'Bounded deterministic length difference between selected tongues.' },
      fragments: { label: 'Energy shards', description: 'Deterministic diamond shards flying outward or inward.' },
      fragmentCount: { label: 'Shard count', description: 'Exact number of generated shards.' },
      fragmentMinSize: { label: 'Minimum size', description: 'Smallest diamond shard size.' },
      fragmentMaxSize: { label: 'Maximum size', description: 'Largest diamond shard size.' },
      fragmentTravelDistance: { label: 'Travel distance', description: 'Distance shards travel away from or toward the center.' },
      fragmentTangentialDrift: { label: 'Tangential drift', description: 'Sideways deviation from each shard radial path.' },
      fragmentLifetime: { label: 'Lifetime', description: 'Fraction of the animation in which shards participate.' },
      seed: { label: 'Random seed', description: 'Unsigned 32-bit value used to reproduce the same effect.' },
    },
    options: {
      explosion: 'Bloom',
      implosion: 'Converge',
      crisp: 'Crisp',
      balanced: 'Balanced',
      drifting: 'Drifting',
      softPetals: 'Soft petals',
      sharpStarburst: 'Sharp starburst',
      layeredCorolla: 'Layered corolla',
      celBands: 'Cel bands',
      moltenCavities: 'Molten cavities',
      crystalShards: 'Crystal shards',
      gridNoise: 'Grid noise',
      pixelNoise: 'Pixel noise',
      shockwaveNone: 'Off',
      shockwaveMultiRing: 'Compound multi-ring',
      shockwaveColorFlat: 'Single color',
      shockwaveColorGradient: 'Radial gradient',
      shockwaveRing: 'Complete ring',
    },
    shapeDescriptions: {
      softPetals: 'Rounded cartoon petals that open outward.',
      sharpStarburst: 'Controlled tapered star rays.',
      layeredCorolla: 'Staggered petal layers opening in sequence.',
    },
    effects: { enabled: 'On', disabled: 'Off' },
    palette: {
      hotCore: 'Bright center',
      outerEdge: 'Deep edge',
      band: 'Bloom palette band {index}',
      removeBand: 'Remove bloom palette band {index}',
      remove: 'Remove',
      addColorBand: 'Add color band',
    },
    presets: {
      softPetals: { name: 'Soft Petals', description: 'Rounded cartoon petals with cel bands; tongues are off by default.' },
      sharpStarburst: { name: 'Sharp Starburst', description: 'Controlled tapered star rays with a crystalline surface.' },
      layeredCorolla: { name: 'Layered Corolla', description: 'Two staggered petal layers that open in sequence.' },
      softPetalsImplosion: { name: 'Soft Petals Implosion', description: 'Rounded petals collapse inward onto a closing flash.' },
      starburstImplosion: { name: 'Starburst Implosion', description: 'Sharp star rays converge into the center from the rim.' },
      corollaImplosion: { name: 'Corolla Implosion', description: 'Staggered corolla layers close inward, outer layer first.' },
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
    name: '燃烧爆炸',
    description: '物理火焰、压力释放、翻滚火球与复古爆炸。',
    previewTitle: '火焰爆发研究',
    categories: {
      body: { label: '主体', description: '选择火焰形状，调节尺寸、轮廓与表面材质。' },
      motion: { label: '动态', description: '控制方向、成形、保持、消散与运动曲线。' },
      effects: { label: '附加效果', description: '开关并调节闪核、冲击波、火舌与碎片。' },
      palette: { label: '颜色', description: '从白热点到暗色外缘排列离散颜色。' },
    },
    controls: {
      shape: { label: '主体形状', description: '选择燃烧剪影；卡片循环播放固定种子预览。' },
      radius: { label: '半径', description: '居中火球的最大半径。' },
      churnAmount: { label: '翻滚强度', description: '控制火团随时间翻滚、合并与摆动的程度。' },
      pressureWidth: { label: '压力前缘', description: '爆裂释放的高温前沿像素宽度。' },
      pressureSharpness: { label: '前缘锐度', description: '让压力前缘保持清晰而非噪点化。' },
      shapeIrregularity: { label: '轮廓不规则度', description: '改变火团角度、尺寸与时序；设为零时轮廓规则。' },
      rotation: { label: '整体旋转', description: '同时旋转主体、火舌与定向冲击波。' },
      surfaceStyle: { label: '表面材质', description: '选择火体如何分层、形成烟炱或被像素侵蚀。' },
      coverage: { label: '主体完整度', description: '保留更多主体几何，不改变当前表面的噪点粒度。' },
      bandWarp: { label: '色带弯曲', description: '使用连续低频变化弯曲燃烧层边界。' },
      edgeBreakup: { label: '边缘破碎度', description: '控制燃烧层从外向内侵蚀时的不均匀程度。' },
      sootAmount: { label: '烟炱数量', description: '控制数量受限的暗色翻滚烟云。' },
      sootScale: { label: '烟炱尺度', description: '连续烟云的空间尺度。' },
      mode: { label: '方向', description: '向外爆炸或向内聚合，时序对称。' },
      motionCurve: { label: '运动曲线', description: '塑造成形与压力释放的加速方式。' },
      formationDuration: { label: '成形时间', description: '主体到达完整尺寸所占的动画时间比例。' },
      holdDuration: { label: '保持时间', description: '主体保持完整尺寸后开始消散的时间比例。' },
      dissolveStart: { label: '消散时间', description: '主体开始按自身规则破碎的时间点。' },
      core: { label: '闪核', description: '冲击端短暂出现的高温中心闪光。' },
      coreRadius: { label: '闪核半径', description: '启用后闪核的最大半径。' },
      coreDuration: { label: '闪核时长', description: '闪核占据整个动画的时间比例。' },
      shockwave: { label: '冲击波', description: '不干扰主体轮廓的中心极坐标波前。' },
      shockwaveMode: { label: '冲击波类型', description: '关闭冲击波，或选择完整圆环与多道圆环；圆环可压扁。' },
      shockwaveColorMode: { label: '配色模式', description: '单色填充，或在每个波环带宽内使用径向渐变。' },
      shockwaveThickness: { label: '厚度', description: '每个冲击波圆环的径向带宽度。' },
      shockwaveStartRadius: { label: '起始半径', description: '以主体半径百分比表示的波前起点。' },
      shockwaveEndRadius: { label: '终止半径', description: '以主体半径百分比表示的波前终点。' },
      shockwaveStartTime: { label: '开始时间', description: '冲击波开始移动的动画时间点。' },
      shockwaveDuration: { label: '持续时间', description: '冲击波走完起止半径所占的动画时间比例。' },
      shockwaveRingCount: { label: '环数', description: '沿同一路径依次追逐展开的完整圆环数量。' },
      shockwaveRingSpacing: { label: '环间距', description: '相邻圆环之间的时间错位；数值越大越分散。' },
      shockwaveSquash: { label: '压扁程度', description: '沿压扁轴的椭圆压扁程度，用于营造冲击感。' },
      shockwaveSquashAngle: { label: '压扁角度', description: '压扁轴的角度，单位为度。' },
      tongues: { label: '火焰喷流', description: '从均衡选择的主体尖端发射的填充式收细火焰。' },
      tongueCount: { label: '喷流数量', description: '围绕主体均衡分布的准确喷流数量。' },
      tongueLength: { label: '喷流长度', description: '从所选尖端向外延伸的最大长度。' },
      tongueWidth: { label: '根部宽度', description: '喷流与主体尖端重叠位置的宽度。' },
      tongueCurvature: { label: '弯曲度', description: '不改变分布的受限横向弯曲程度。' },
      tongueVariation: { label: '长度变化', description: '所选喷流之间受限且可复现的长度差异。' },
      fragments: { label: '焦炭碎片', description: '向外飞散或向内汇入的可复现方块碎片。' },
      fragmentCount: { label: '碎片数量', description: '实际生成的准确碎片数量。' },
      fragmentMinSize: { label: '最小尺寸', description: '最小方块碎片的边长。' },
      fragmentMaxSize: { label: '最大尺寸', description: '最大方块碎片的边长。' },
      fragmentTravelDistance: { label: '飞行距离', description: '碎片向外飞散或向内汇入的距离。' },
      fragmentTangentialDrift: { label: '切向漂移', description: '碎片偏离径向路径的横向距离。' },
      fragmentLifetime: { label: '存活时间', description: '碎片参与动画的时间比例。' },
      seed: { label: '随机种子', description: '用于精确复现同一效果的无符号 32 位数值。' },
    },
    options: {
      explosion: '爆炸',
      implosion: '内聚',
      crisp: '利落',
      balanced: '均衡',
      drifting: '飘移',
      billowingFireball: '翻滚火球',
      pressureBurst: '压力爆裂',
      legacyRadial: '复古径向',
      burningLayers: '燃烧分层',
      rollingSoot: '翻滚烟炱',
      retroPixel: '复古像素',
      shockwaveNone: '关闭',
      shockwaveMultiRing: '复合多环',
      shockwaveColorFlat: '单色',
      shockwaveColorGradient: '径向渐变',
      shockwaveRing: '完整圆环',
    },
    shapeDescriptions: {
      billowingFireball: '合并翻滚的火团，带烟炱边缘。',
      pressureBurst: '紧凑闪核释放锐利且中心连通的波前。',
      legacyRadial: '原有密集径向像素爆炸。',
    },
    effects: { enabled: '开启', disabled: '关闭' },
    palette: {
      hotCore: '白热点',
      outerEdge: '暗色外缘',
      band: '爆炸色带 {index}',
      removeBand: '删除爆炸色带 {index}',
      remove: '删除',
      addColorBand: '添加色带',
    },
    presets: {
      rollingFireball: { name: '翻滚火球', description: '合并翻滚的火团，配燃烧分层与火焰喷流。' },
      pressureBurst: { name: '压力爆裂', description: '紧凑闪核释放锐利且中心连通的压力前缘。' },
      retroBurst: { name: '复古爆发', description: '原有径向圆环与密集逐像素噪点。' },
    },
    seed: { randomize: '随机化' },
  },
  energyBloom: {
    name: '能量绽放',
    description: '花瓣、星芒与花冠能量效果，配绚丽内聚。',
    previewTitle: '能量绽放研究',
    categories: {
      body: { label: '主体', description: '选择绽放形状，调节尺寸、轮廓与表面材质。' },
      motion: { label: '动态', description: '控制方向、成形、保持、消散与运动曲线。' },
      effects: { label: '附加效果', description: '开关并调节闪核、冲击波、能量焰舌与晶片。' },
      palette: { label: '颜色', description: '从明亮中心到深邃外缘排列离散颜色。' },
    },
    controls: {
      shape: { label: '绽放形状', description: '选择花瓣、星芒或花冠剪影；卡片循环播放固定种子预览。' },
      radius: { label: '半径', description: '居中绽放的最大半径。' },
      petalCount: { label: '花瓣数量', description: '围绕共同中心分布的圆润花瓣数量。' },
      petalStretch: { label: '花瓣伸长度', description: '控制每片花瓣远离共同核心的拉伸程度。' },
      rayCount: { label: '星芒数量', description: '从中心向外辐射的锥形光瓣数量。' },
      rayTaper: { label: '星芒锐度', description: '数值越高光瓣越尖锐，越低越柔和。' },
      corollaLayers: { label: '花冠层数', description: '围绕中心的两到三层错位花瓣环。' },
      layerDelay: { label: '分层延迟', description: '让各层花冠错时展开；外层后开或先收。' },
      shapeIrregularity: { label: '轮廓不规则度', description: '改变花瓣角度、尺寸与时序；设为零时轮廓规则。' },
      rotation: { label: '整体旋转', description: '同时旋转主体、能量焰舌与定向冲击波。' },
      surfaceStyle: { label: '表面材质', description: '选择绽放主体如何分层、空腔、开裂或侵蚀。' },
      coverage: { label: '主体完整度', description: '保留更多主体几何，不改变当前表面的噪点粒度。' },
      bandWarp: { label: '色带弯曲', description: '使用连续低频变化弯曲赛璐璐色带边界。' },
      edgeBreakup: { label: '边缘破碎度', description: '控制赛璐璐轮廓从外向内侵蚀时的不均匀程度。' },
      cavityAmount: { label: '空腔数量', description: '控制数量受限的熔融空腔。' },
      cavityScale: { label: '空腔尺度', description: '连续熔融空腔的空间尺度。' },
      chunkSize: { label: '裂片尺寸', description: '晶体裂片表面的稳定分区尺寸。' },
      crackWidth: { label: '裂缝宽度', description: '晶体板块之间一到两个像素的间隔。' },
      mode: { label: '方向', description: '向外绽放或向内收敛，时序对称。' },
      motionCurve: { label: '运动曲线', description: '塑造成形与收敛的加速方式。' },
      formationDuration: { label: '成形时间', description: '主体到达完整尺寸所占的动画时间比例。' },
      holdDuration: { label: '保持时间', description: '主体保持完整尺寸后开始消散的时间比例。' },
      dissolveStart: { label: '消散时间', description: '主体开始按自身规则破碎的时间点。' },
      core: { label: '闪核', description: '冲击端短暂出现的明亮中心闪光。' },
      coreRadius: { label: '闪核半径', description: '启用后闪核的最大半径。' },
      coreDuration: { label: '闪核时长', description: '闪核占据整个动画的时间比例。' },
      shockwave: { label: '冲击波', description: '不干扰主体轮廓的中心极坐标波前。' },
      shockwaveMode: { label: '冲击波类型', description: '关闭冲击波，或选择完整圆环与多道圆环；圆环可压扁。' },
      shockwaveColorMode: { label: '配色模式', description: '单色填充，或在每个波环带宽内使用径向渐变。' },
      shockwaveThickness: { label: '厚度', description: '每个冲击波圆环的径向带宽度。' },
      shockwaveStartRadius: { label: '起始半径', description: '以主体半径百分比表示的波前起点。' },
      shockwaveEndRadius: { label: '终止半径', description: '以主体半径百分比表示的波前终点。' },
      shockwaveStartTime: { label: '开始时间', description: '冲击波开始移动的动画时间点。' },
      shockwaveDuration: { label: '持续时间', description: '冲击波走完起止半径所占的动画时间比例。' },
      shockwaveRingCount: { label: '环数', description: '沿同一路径依次追逐展开的完整圆环数量。' },
      shockwaveRingSpacing: { label: '环间距', description: '相邻圆环之间的时间错位；数值越大越分散。' },
      shockwaveSquash: { label: '压扁程度', description: '沿压扁轴的椭圆压扁程度，用于营造冲击感。' },
      shockwaveSquashAngle: { label: '压扁角度', description: '压扁轴的角度，单位为度。' },
      tongues: { label: '能量焰舌', description: '从花瓣或星芒尖端发射的填充式收细能量带。' },
      tongueCount: { label: '焰舌数量', description: '围绕主体均衡分布的准确焰舌数量。' },
      tongueLength: { label: '焰舌长度', description: '从所选尖端向外延伸的最大长度。' },
      tongueWidth: { label: '根部宽度', description: '焰舌与所属尖端重叠位置的宽度。' },
      tongueCurvature: { label: '弯曲度', description: '不改变分布的受限横向弯曲程度。' },
      tongueVariation: { label: '长度变化', description: '所选焰舌之间受限且可复现的长度差异。' },
      fragments: { label: '能量晶片', description: '向外飞散或向内汇入的可复现菱形晶片。' },
      fragmentCount: { label: '晶片数量', description: '实际生成的准确晶片数量。' },
      fragmentMinSize: { label: '最小尺寸', description: '最小菱形晶片的尺寸。' },
      fragmentMaxSize: { label: '最大尺寸', description: '最大菱形晶片的尺寸。' },
      fragmentTravelDistance: { label: '飞行距离', description: '晶片向外飞散或向内汇入的距离。' },
      fragmentTangentialDrift: { label: '切向漂移', description: '晶片偏离径向路径的横向距离。' },
      fragmentLifetime: { label: '存活时间', description: '晶片参与动画的时间比例。' },
      seed: { label: '随机种子', description: '用于精确复现同一效果的无符号 32 位数值。' },
    },
    options: {
      explosion: '绽放',
      implosion: '收敛',
      crisp: '利落',
      balanced: '均衡',
      drifting: '飘移',
      softPetals: '圆润花瓣',
      sharpStarburst: '锐利星芒',
      layeredCorolla: '分层花冠',
      celBands: '赛璐璐色带',
      moltenCavities: '熔融空腔',
      crystalShards: '晶体裂片',
      gridNoise: '方格噪点',
      pixelNoise: '像素噪点',
      shockwaveNone: '关闭',
      shockwaveMultiRing: '复合多环',
      shockwaveColorFlat: '单色',
      shockwaveColorGradient: '径向渐变',
      shockwaveRing: '完整圆环',
    },
    shapeDescriptions: {
      softPetals: '向外展开的圆润卡通花瓣。',
      sharpStarburst: '受控的锥形锐利星芒。',
      layeredCorolla: '按层错时展开的花瓣环。',
    },
    effects: { enabled: '开启', disabled: '关闭' },
    palette: {
      hotCore: '明亮中心',
      outerEdge: '深邃外缘',
      band: '绽放色带 {index}',
      removeBand: '删除绽放色带 {index}',
      remove: '删除',
      addColorBand: '添加色带',
    },
    presets: {
      softPetals: { name: '圆润花瓣', description: '赛璐璐色带的圆润卡通花瓣；默认关闭火舌。' },
      sharpStarburst: { name: '锐利星芒', description: '受控锥形星芒配晶体表面。' },
      layeredCorolla: { name: '分层花冠', description: '两圈错位花瓣按序展开。' },
      softPetalsImplosion: { name: '圆润花瓣·内聚', description: '圆润花瓣向收拢的闪光中心坍缩。' },
      starburstImplosion: { name: '星芒·内聚', description: '锐利星芒从外缘向中心收束。' },
      corollaImplosion: { name: '花冠·内聚', description: '错位花冠由外层向内收拢。' },
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
  'energyBloom.palette.band': { index: number }
  'energyBloom.palette.removeBand': { index: number }
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
  energyBloom: {
    name: 'energyBloom.name',
    description: 'energyBloom.description',
    previewTitle: 'energyBloom.previewTitle',
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
    body: { label: 'explosion.categories.body.label', description: 'explosion.categories.body.description' },
    motion: { label: 'explosion.categories.motion.label', description: 'explosion.categories.motion.description' },
    effects: { label: 'explosion.categories.effects.label', description: 'explosion.categories.effects.description' },
    palette: { label: 'explosion.categories.palette.label', description: 'explosion.categories.palette.description' },
  },
  energyBloom: {
    body: { label: 'energyBloom.categories.body.label', description: 'energyBloom.categories.body.description' },
    motion: { label: 'energyBloom.categories.motion.label', description: 'energyBloom.categories.motion.description' },
    effects: { label: 'energyBloom.categories.effects.label', description: 'energyBloom.categories.effects.description' },
    palette: { label: 'energyBloom.categories.palette.label', description: 'energyBloom.categories.palette.description' },
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
    rollingFireball: { name: 'explosion.presets.rollingFireball.name', description: 'explosion.presets.rollingFireball.description' },
    pressureBurst: { name: 'explosion.presets.pressureBurst.name', description: 'explosion.presets.pressureBurst.description' },
    retroBurst: { name: 'explosion.presets.retroBurst.name', description: 'explosion.presets.retroBurst.description' },
  },
  energyBloom: {
    softPetals: { name: 'energyBloom.presets.softPetals.name', description: 'energyBloom.presets.softPetals.description' },
    sharpStarburst: { name: 'energyBloom.presets.sharpStarburst.name', description: 'energyBloom.presets.sharpStarburst.description' },
    layeredCorolla: { name: 'energyBloom.presets.layeredCorolla.name', description: 'energyBloom.presets.layeredCorolla.description' },
    softPetalsImplosion: { name: 'energyBloom.presets.softPetalsImplosion.name', description: 'energyBloom.presets.softPetalsImplosion.description' },
    starburstImplosion: { name: 'energyBloom.presets.starburstImplosion.name', description: 'energyBloom.presets.starburstImplosion.description' },
    corollaImplosion: { name: 'energyBloom.presets.corollaImplosion.name', description: 'energyBloom.presets.corollaImplosion.description' },
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
