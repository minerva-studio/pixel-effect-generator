# 像素特效生成器

[English](README.md) · [打开网页版](https://minerva-studio.github.io/pixel-effect-generator/) · [下载 Windows 版本](https://github.com/minerva-studio/pixel-effect-generator/releases)

像素特效生成器是一款在浏览器和 Windows 桌面运行的像素风特效编辑器。你可以调整生成器、逐帧预览动画，并导出精灵图、动画图片或 Unity 6 资源。渲染结果是确定性的：相同的参数和随机种子会生成相同的像素。

## 生成器

| 阶段 | 生成器 | 效果 |
| --- | --- | --- |
| 稳定 | 斩击 | 武器拖尾和横扫攻击弧线 |
| 稳定 | 燃烧爆炸 | 火焰、烟尘、冲击爆破、翻滚火团和复古爆发 |
| 稳定 | 火球 | 四种造型的循环飞行火球 |
| 稳定 | 火焰 | 循环播放的烛火、火把和篝火 |
| 实验性 | 箭 | 实体箭和能量箭的飞行循环 |
| 实验性 | 水晶 | 多面水晶投射物的飞行循环 |
| 实验性 | 能量绽放 | 花瓣、星芒和花冠形态的能量效果 |

实验性生成器仍在打磨，参数和效果可能调整。

## 制作特效

1. 点击**新建**并选择生成器。对话框将稳定和实验性生成器分开展示。
2. 从内置预设开始，或保存自己的预设。按需调整形状、动态、质感和特效等参数。效果偏离预设或默认值后，生成器名称旁会出现对应的恢复操作。
3. 在播放控制下方的颜色条直接编辑颜色。点击色块可修改 HEX、透明度和顺序；通过**色卡**应用整组颜色。应用预设前锁定颜色，可保留当前配色。
4. 播放或拖动时间轴逐帧查看效果，并调整帧数、播放速度、画布尺寸和随机种子。
5. 用**保存**留下可继续编辑的项目，或用**导出**生成资源文件。

界面支持简体中文和英文。网页版通过浏览器上传和下载文件；Windows 版还提供原生文件对话框和最近使用的项目。

## 导出格式

| 格式 | 内容 |
| --- | --- |
| PNG 精灵图 | 透明背景，按横排或紧凑网格排列各帧 |
| GIF / APNG | 动画图片，可选择是否循环 |
| Unity 6 ZIP | 精灵图 PNG、Unity `.meta` 文件和清单；可设置每单位像素数与 GUID |
| 逐帧 ZIP | 每帧一张透明 PNG，附带清单 |

**项目 JSON**通过**保存**和**打开**使用，与图片导出分开。它保存生成器参数（包括当前配色）、画布与动画设置、随机种子和 Unity 导出设置。自定义预设库与色卡库存放在应用本地，不会写入项目文件。

能量绽放目前可以导出 PNG、GIF 和 APNG，但暂不支持项目 JSON、Unity ZIP 和逐帧 ZIP。

## 本地运行

使用 Node.js 22 和 npm：

```sh
npm ci
npm run dev
```

在浏览器打开 Vite 输出的网址。Windows 下也可以运行 `dev.cmd`，它会启动开发服务器并打开浏览器。

| 命令 | 用途 |
| --- | --- |
| `npm run dev` | 启动网页版开发服务器 |
| `npm run build` | 检查 TypeScript 并构建网页版 |
| `npm run typecheck` | 仅检查 TypeScript |
| `npm run test` | 运行 Vitest 测试 |
| `npm run tauri:dev` | 以开发模式运行 Windows 桌面版 |
| `npm run tauri:build` | 构建 Windows 桌面安装包 |

开发或构建桌面版还需要 Rust 和 Tauri 2 的 Windows 构建环境。桌面安装包使用 NSIS 和 WebView2。

## 项目结构

- `src/generators/<id>/`：各生成器的参数、渲染器、控件、预设，以及受支持时的项目编解码器。
- `src/generators/registry.ts`：生成器的注册顺序和成熟度。
- `src/shared/`：像素渲染、色卡、项目文件与导出的基础模块。
- `src/components/`：工作台、预览、颜色条、预设与导出界面。
- `src/i18n/resources/`：英文和简体中文文案。
- `src-tauri/`：Windows 桌面外壳。

网页版从 `main` 分支部署。与 `package.json` 版本号匹配的版本标签会触发 Windows 发行版构建。

## 许可

[MIT](LICENSE) © 2026 Minerva Game Studio。
