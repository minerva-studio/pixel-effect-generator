import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECTILE_PARAMETERS } from '../model'
import { PROJECTILE_BUILTIN_PRESETS, applyProjectilePreset, parseProjectilePresetPayload } from '../presets'
import { renderProjectileFrames } from '../renderer'

function hashFrames(frames: ReturnType<typeof renderProjectileFrames>): string[] {
  return frames.map(({ pixels }) => {
    let value = 0x811c9dc5
    for (const byte of pixels) value = Math.imul(value ^ byte, 0x01000193) >>> 0
    return value.toString(16).padStart(8, '0')
  })
}

describe('arrow and crystal rendering goldens', () => {
  it('preserves every frame for defaults, built-in presets, and rasterization variants', () => {
    const cases = (['arrow', 'crystal'] as const).flatMap((id) => {
      const builtIns = PROJECTILE_BUILTIN_PRESETS
        .filter((preset) => parseProjectilePresetPayload(preset.payload).kind === id)
      const defaultParameters = applyProjectilePreset(DEFAULT_PROJECTILE_PARAMETERS, builtIns[0].payload)
      const presets = builtIns.map((preset) => ({
        name: `${id}-${preset.id}`,
        parameters: applyProjectilePreset(defaultParameters, preset.payload),
      }))
      return [
        { name: `${id}-default`, parameters: defaultParameters },
        ...presets,
        { name: `${id}-rotation-30`, parameters: { ...defaultParameters, rotationDegrees: 30 } },
        { name: `${id}-canvas-96x80`, parameters: { ...defaultParameters, canvasWidth: 96, canvasHeight: 80 } },
      ]
    })
    const output = Object.fromEntries(cases.map(({ name, parameters }) => [name, hashFrames(renderProjectileFrames(parameters))]))
    expect(output).toEqual({
      'arrow-default': ['c5ed866e', '46527522', 'bbd3ae61', 'f6283d49', '98da9bc9', 'cb5e6e4b', '8f9e59e4', '3dadf245', 'dffdd928', 'b206ccf5'],
      'arrow-enchantedArrow': ['c5ed866e', '46527522', 'bbd3ae61', 'f6283d49', '98da9bc9', 'cb5e6e4b', '8f9e59e4', '3dadf245', 'dffdd928', 'b206ccf5'],
      'arrow-energyArrow': ['264edfbb', '65d65919', 'ae827521', 'aa46e3aa', '9e58f723', '2c6b770b', 'e2080173', 'acfebaba', '7f22567f', '4e7280b7'],
      'arrow-rotation-30': ['c8f0fb0c', '3284a391', 'c1b4a209', '70535aa4', '2d17c4fa', '29928cd5', 'f195756e', '28958146', '35482b0a', 'a6cf12c6'],
      'arrow-canvas-96x80': ['b1796c41', '6772b061', '2d3e636f', '124ea1d9', '265e8cbb', '610f8a13', '4ad85414', 'be5962ad', '1d60a7ad', '359ae4eb'],
      'crystal-default': ['9a13ba93', '5552eb58', '9f1a0efd', '1d597747', '5b5fad10', '9a0672d9', 'afe31e10', '770b7e67', 'b1c6180b', 'a458b012'],
      'crystal-crystalSpear': ['9a13ba93', '5552eb58', '9f1a0efd', '1d597747', '5b5fad10', '9a0672d9', 'afe31e10', '770b7e67', 'b1c6180b', 'a458b012'],
      'crystal-crystalCore': ['70c237a9', 'd4cb53ae', '59efae45', '42017013', 'bfff30b1', '5e25261a', '501a4cd0', '0840ed96', 'fc3ad8a8', '3a1e4be4'],
      'crystal-rotation-30': ['f12cb742', 'e12ad7ba', '03c602a9', '6a147468', '3a8324e5', '9f9b97ee', '70b95fdd', 'ee40b23d', '516cb8df', 'ed0723fb'],
      'crystal-canvas-96x80': ['2e075e93', '2bb6a858', 'f36f28fd', '7ff36b47', 'e50f7210', 'e9f8c6d9', 'c44e5f10', '13b73a67', '8d37f00b', '5c650312'],
    })
  })
})
