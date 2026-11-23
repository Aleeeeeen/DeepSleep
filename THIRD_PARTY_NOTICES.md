# 第三方组件 / Third-party components

Copyright (C) 2026 ATRI072121 — original DSH for Android adaptation code.

本仓库原创 Android 适配代码使用 GPL-3.0-only，协议全文见 [LICENSE](LICENSE)。第三方软件、插件和工具保留各自的版权与许可证；本仓库的许可证声明不替代或变更上游条款。

The original Android adaptation code in this repository is licensed under GPL-3.0-only; see [LICENSE](LICENSE). Third-party software, plugins, and tools retain their own copyrights and licenses. This repository's license declaration does not replace or change upstream terms.

| 组件 / Component | 上游 / Upstream | 用途 / Role |
| --- | --- | --- |
| DeepSeek Harness (dsh) | [@deepseek-ai/dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) | dsh host and plugin runtime |
| Termux components | [termux/termux-packages](https://github.com/termux/termux-packages) | Android bionic tools and libraries |
| Node.js | [nodejs/node](https://github.com/nodejs/node) | JavaScript runtime |
| Shizuku / Shizuku API | [RikkaApps/Shizuku](https://github.com/RikkaApps/Shizuku), [RikkaApps/Shizuku-API](https://github.com/RikkaApps/Shizuku-API) | Authorized system interaction |
| Community plugins and native modules | Individual packages referenced by the source and runtime | Optional features and platform integration |

Git 中不包含完整的第三方依赖树。各插件及运行时组件的准确版本、许可证和版权说明应以实际分发包内的 `package.json`、许可证文件及对应上游源码为准。

The complete third-party dependency tree is not committed to Git. Consult each distributed component's `package.json`, license files, and corresponding upstream source for its exact version, license, and copyright notices.

重新构建或分发时，应保留适用的上游版权与许可证说明，并按各组件的许可证提供其要求的材料。应用图标和头像随原始源码包保留；本文件不作额外的第三方素材授权声明。

When rebuilding or redistributing, retain applicable upstream copyright and license notices and provide the materials required by each component's license. The app icon and avatar are retained from the supplied source archive; this notice makes no additional third-party artwork licensing claim.
