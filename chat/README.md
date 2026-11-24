# DeepSleep Android 0.4 测试版

[下载 0.4 ARM64 测试版 APK](https://github.com/Aleeeeeen/DeepSleep/releases/download/v0.4.0/DeepSleep-0.4-arm64.apk) · [下载测试记录](https://github.com/Aleeeeeen/DeepSleep/releases/download/v0.3.0/deepseek_data-deepsleep.zip)

DeepSleep 是使用 DeepSeek 开放平台的第三方 Android 聊天客户端。打开应用进入中文聊天页，左上角打开历史会话，右上角新建对话。侧栏可打开账号、导入历史或切换到 DSH。DSH 顶栏可以返回 DeepSleep。两种界面共用手机上的会话库。

## 安装和登录

支持 Android 8.0 及以上 ARM64 设备。安装包约 190 MiB，首次使用要解压本地聊天引擎，建议预留约 1.5 GB。0.4 与 0.3 使用相同包名和签名，可直接覆盖安装并保留会话。

在左侧菜单打开“我的账号”，点“登录 DeepSeek 账号”。系统浏览器打开 DeepSeek 的 Harness 授权页，授权成功后自动配置账号模型，全程无需手动创建或粘贴个人 Key。模型调用使用开放平台余额。需要充值时从账号页前往官方收银台，确认金额并付款，返回后会刷新余额。

## 导入和续聊

在 **导入历史 → 从网页版选择对话** 打开一条旧对话，点 **导入当前对话并续聊**。应用内网页版会保留自己的登录状态。也可用已登录的系统浏览器生成官方分享链接，使用 Android 的分享菜单发给 DeepSleep，或在导入面板粘贴链接。拥有官方分享链接的人可查看该分享。网页导入保存当前分支的提问和回答文字，批量迁移或保留附件请展开 **从 ZIP 批量导入**。

打开左侧菜单，选择“导入历史”，用系统文件选择器选中 DeepSeek 网页版导出的原始 ZIP，点“开始导入”。在结果里点会话标题，直接回到手机聊天页阅读或追问。导入、阅读和历史保存都在本机完成，发送追问时该会话的上下文才会交给所用模型。卸载应用会清除本地会话。

支持官方 v3 导出，含 manifest.json、chat_session_index.json 和 chat_sessions/。单个 ZIP 上限 128 MiB，每个解压条目上限 32 MiB，每次最多导入最近 1,000 条会话。分叉对话保留导出时选中的分支，重复导入会产生副本。导出内含原件的受支持图片可保存为附件，其他文件仅保留文件卡片。

## 在 Windows 上试用

在 Android Studio 的 Device Manager 启动支持 arm64-v8a 的 Android 15 模拟器。在本目录执行下列命令，然后通过手机界面测试。

```powershell
adb shell getprop ro.product.cpu.abilist
adb install --no-incremental -r .\out\DeepSleep-0.4-arm64.apk
adb push .\out\deepseek_data-deepsleep.zip /sdcard/Download/deepseek_data-deepsleep.zip
adb shell am start -n app.dsconversation.mobile/.ChatActivity
```

样例 ZIP 包含“旅行笔记”和“行李清单”。在“旅行笔记”里问“我的行程编号是什么？”，旧对话中的编号是 MAPLE-731。可以打开 DSH，再返回手机聊天页，检查两边是否是同一条会话。真实账号的支付、到账和首次付费回复需要在自己的账号上验证。

0.3 版曾在 Windows 的 Android 15 模拟器上从 0.2 覆盖安装，使用电脑上的测试模型核对了实际请求。新建聊天和导入后续聊的请求都没有携带工具。测试模型在续聊时收到了原来的提问、选中分支的回答和新问题，并回复了 MAPLE-731。切换至 DSH 再返回后可看到相同的对话。[启动首页](../docs/images/chat-home.png) · [ZIP 导入](../docs/images/zip-import.png) · [手机续聊](../docs/images/imported-chat.png) · [DSH 界面](../docs/images/dsh-view.png)


0.4 版已在同一模拟器上覆盖安装，验证了官网分享链接导入、重启后恢复会话，以及新问题和历史问答一同发送给本地测试模型。私人历史列表需要在自己的账号上验证。

## 实现和构建

这个目录是 [DSH-forAndroid v0.2.5](https://github.com/ATRI072121/DSH-forAndroid/releases/tag/v0.2.5) 源码仓库中的DeepSleep 聊天版本。APK 使用此目录的 Android 清单和源码，只声明网络与前台服务权限。底层是上游针对 Android 适配的 DeepSeek Harness `0.2.1-rc.2`。登录、授权回调、模型初始化和余额查询复用官方账号模块。桌面浏览器登录、移动支付和账号认证的可用性由 DeepSeek 提供。官方模块的位置见 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。

在 Windows 上使用 JDK 21、Python 3.9+、Android SDK 35 和 Android build-tools。下载上游发布页中的 `DSH-forAndroid-0.2.5-source.zip`。脚本会校验整个压缩包的 SHA-256，提取基础依赖并整合本目录的聊天、账号和历史导入界面。下例使用该源码压缩包内 `_tools` 目录的 build-tools 和 D8 8.5.35。

```powershell
.\build.ps1 -Jdk C:\Tools\jdk-21 `
  -SourceArchive C:\Tools\DSH-forAndroid-0.2.5-source.zip `
  -BuildTools C:\Tools\_tools\bt\android-14 `
  -D8Jar C:\Tools\_tools\r8.jar `
  -AndroidJar C:\Android\sdk\platforms\android-35\android.jar
```

脚本生成本机测试签名并校验 APK，输出在 `out/DeepSleep-0.4-arm64.apk`。用于本机测试的签名文件保存在当前用户的 `%LOCALAPPDATA%\DSChatPrototype`。应保留这个签名以便后续覆盖升级。代码和随包组件的许可证见上层目录的 [LICENSE](../LICENSE) 和 [第三方声明](../THIRD_PARTY_NOTICES.md)。导入器以 MIT 协议发布，基于 [DeepSeek 官方历史导入模块](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/experimental/deepseek-chat-import) 的 `0.2.2-rc.5` 版本，已为本 APK 内的 Harness 和 Android 文件选择器做适配。原始 npm 压缩包及其 LICENSE 位于 `vendor/` 中。
