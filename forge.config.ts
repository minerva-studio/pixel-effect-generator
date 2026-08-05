import type { ForgeConfig } from '@electron-forge/shared-types'
import { MakerZIP } from '@electron-forge/maker-zip'
import { VitePlugin } from '@electron-forge/plugin-vite'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { FuseV1Options, FuseVersion } from '@electron/fuses'

/**
 * Electron Forge configuration for the Windows x64 portable ZIP. The renderer
 * reuses the existing React/Vite app through the official Vite plugin; no
 * generator algorithm or interface is duplicated.
 */
const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    name: 'PixelEffectGenerator',
    executableName: 'PixelEffectGenerator',
    appBundleId: 'com.minervagamestudio.pixeleffectgenerator',
    icon: 'build/icon',
    extraResource: ['build/icon.png'],
    win32metadata: {
      CompanyName: 'Minerva Game Studio',
      ProductName: 'Pixel Effect Generator',
      FileDescription: 'Deterministic pixel-art VFX generator',
      InternalName: 'PixelEffectGenerator',
      OriginalFilename: 'PixelEffectGenerator.exe',
    },
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['win32']),
  ],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: 'src/electron/main.ts',
          config: 'vite.main.config.mts',
          target: 'main',
        },
        {
          entry: 'src/electron/preload.ts',
          config: 'vite.preload.config.mts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.mts',
        },
      ],
    }),
    // Disable Node CLI, Inspector, and RunAsNode capabilities in the package.
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
}

export default config
