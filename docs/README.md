<meta name="google-site-verification" content="tw5pjIDYKCrq1QKYBrD5iyV7DXIM4rsHN9d11WlJFe4" />

[한국어](../README.md) | [English](docs/readme_en.md) | **[Chiese](docs/readme_zh-cn.md)**

<div align="center">
  <img src="../src-tauri/icons/icon.ico" alt="dmnote Logo" width="120" height="120">

  <h1>DM Note</h1>

  <p>
    <strong>支持广泛自定义的按键显示程序</strong>
  </p>
  <p>
    <strong>提供用户自定义按键映射与样式、可轻松切换的预设，以及现代化、直观的界面。</strong>
  </p>

https://img.shields.io/github/release/lee-sihun/DmNote.svg?logo=github
https://img.shields.io/github/downloads/lee-sihun/DmNote/total.svg?logo=github
https://img.shields.io/github/license/lee-sihun/DmNote.svg?logo=github

</div>

https://github.com/user-attachments/assets/20fb118d-3982-4925-9004-9ce0936590c2

🌟 概述

DM Note 是一款专为配合 DJMAX RESPECT V 使用而创建的按键显示程序。基于 Tauri 和 React 构建，它允许您通过简单设置，在直播或游戏视频创作时可视化显示按键输入。目前，它仅官方支持 Windows 10/11 和 macOS 环境。如果您使用的是 Linux，我们推荐尝试 社区分支版本。

下载 DM NOTE v1.5.0

✨ 功能特性

⌨️ 键盘输入与映射

· 实时键盘输入检测与可视化
· 自定义按键映射配置

🎨 按键样式自定义

· 基于网格的按键编辑
· 支持图片分配
· 自定义 CSS 支持

💾 预设与设置管理

· 自动保存用户设置
· 保存/加载预设

🖼️ 覆盖层与窗口管理

· 锁定窗口位置
· 始终置顶
· 选择调整大小锚点

🌧️ 音符效果（雨滴效果）自定义

· 调整音符效果的颜色、不透明度、圆角、速度和高度
· 反向功能

🔢 按键计数器

· 实时显示每个按键的输入次数
· 自定义计数器位置、颜色和样式
· 自定义 CSS 支持

⚙️ 图形与设置

· 多语言支持（韩语、英语）
· 图形渲染选项（Direct3D 11/9， OpenGL）
· 重置设置

🚀 开发

技术栈

· 前端: React 19 + Typescript + Vite 7
· 后端: Tauri
· 样式: Tailwind CSS 3
· 输入检测: Raw Input API (Windows), Global input events (macOS)
· 包管理器: npm

文件夹结构

```
DmNote/
├─ src/                          # 前端
│  ├─ renderer/                  # React 渲染器
│  │  ├─ components/             # UI 组件
│  │  ├─ hooks/                  # 状态/同步钩子
│  │  ├─ stores/                 # Zustand 状态库
│  │  ├─ windows/                # 渲染器窗口 (主窗口/覆盖层)
│  │  ├─ styles/                 # 全局/通用样式
│  │  └─ assets/                 # 静态资源
│  └─ types/                     # 共享类型/模式
├─ src-tauri/                    # Tauri 后端
│  └─ src/                       # 命令、服务
├─ package.json                  # 项目依赖项和运行脚本
├─ tsconfig.json                 # TypeScript 配置
└─ vite.config.ts                # Vite 配置
```

基本安装与运行

在终端中按顺序输入以下命令：

```bash
git clone https://github.com/lee-sihun/DmNote.git
cd DmNote
npm install
npm run tauri:dev
```

🖼️ 截图

<!--img src="assets/2025-08-29_12-07-12.webp" alt="Note Effect" width="700"-->

<img src="assets/IMG_1005.gif" alt="音符效果" width="700">

<!--img src="assets/1.webp" alt="按键显示演示 1" width="700"-->

<img src="assets/2025-09-20_11-55-17.gif" alt="按键显示演示 2" width="700">

<!--img src="assets/IMG_1008.gif" alt="按键显示演示 3" width="700"-->

<img src="assets/2025-09-20_11-57-38.gif" alt="按键显示演示 4" width="700">

📝 注意事项

· 某些游戏在全屏模式下可能无法正常工作。这种情况下，请使用无边框窗口模式。
· 如果出现图形问题，请在设置中更改渲染选项。
· 您可以使用 OBS 窗口捕获，无需色度键抠像即可实现透明背景捕获。
· 在游戏画面上方显示时，请使用始终置顶功能放置，并启用锁定覆盖层窗口。
· 自定义 CSS 示例文件位于 assets 文件夹中。
· 分配类名时，只输入选择器排除的名称（例如，blue -> 正确，.blue -> 错误）。
· 程序默认设置保存在 %appdata%/com.dmnote.desktop 文件夹下的 store.json 文件中。

🤝 贡献

我们欢迎您的贡献！请查看 贡献指南 了解详情。

✨ 贡献者

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->

<!-- prettier-ignore-start -->

<!-- markdownlint-disable -->

<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/lee-sihun"><img src="https://avatars.githubusercontent.com/u/111095268?v=4?s=100" width="100px;" alt="이시훈"/><br /><sub><b>李时勋</b></sub></a><br /><a href="#maintenance-lee-sihun" title="维护">🚧</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/eun-yeon"><img src="https://avatars.githubusercontent.com/u/173552527?v=4?s=100" width="100px;" alt="연우"/><br /><sub><b>延宇</b></sub></a><br /><a href="#design-eun-yeon" title="设计">🎨</a> <a href="#ideas-eun-yeon" title="想法、规划与反馈">🤔</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mohong2"><img src="https://avatars.githubusercontent.com/u/150683765?v=4?s=100" width="100px;" alt="mo_hong"/><br /><sub><b>mo_hong</b></sub></a><br /><a href="#translation-mohong2" title="翻译">🌍</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/LSVoiid"><img src="https://avatars.githubusercontent.com/u/187824877?v=4?s=100" width="100px;" alt="LSVoiid"/><br /><sub><b>LSVoiid</b></sub></a><br /><a href="#translation-LSVoiid" title="翻译">🌍</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->

<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

📄 许可证

GPL-3.0 许可证 版权所有 (C) 2024 lee-sihun

❤️ 特别感谢！

· tauri-apps/tauri

<!--
## 🔜 计划中的更新

- 按键输入计数、输入速度可视化
- 同时输入间隔（毫秒）显示
- 输入统计分析功能
 -->