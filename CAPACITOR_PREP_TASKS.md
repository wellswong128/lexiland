# LexiLand Capacitor 包装前置任务清单

在开始 Capacitor 包装之前，请按顺序完成本文件的任务。每完成一项就手动测试一次，确认没问题再继续。

> **目标**：把现有 PWA（React + Vite + Vercel API）包成 iOS / Android 原生壳，保留现有 Web 功能，并为 App Store / Google Play 上架做准备。
>
> **原则**：先跑通最小可用原生 App，再逐步加原生能力；PWA 与 Capacitor 版本可并行维护。

---

## 0. 当前已完成（PWA 阶段）

以下项目你已完成，Capacitor 包装可以直接在此基础上进行：

- [x] 功能 MVP：拍照加字、字卡、测验、错字、每日任务、学习报告
- [x] Guest 模式与离线本机字卡
- [x] PWA Service Worker、离线快取、安装页
- [x] 真机测试清單（iOS Safari / Android Chrome / 离线 / 更新）
- [x] 「有新版本，點此更新」提示 UI
- [x] 生产部署：`https://learn.lexiland.cc`

---

## 1. 包装策略（开始前先决定）

在开始写代码前，先确认以下决策：

| 决策项 | 建议方案 | 说明 |
| --- | --- | --- |
| Web 资源来源 | **打包 `dist/` 进 App** | 启动快、可离线浏览 UI；与现有 Vite build 一致 |
| API 请求 | **指向生产 API** `https://learn.lexiland.cc/api/*` | Vercel Serverless 继续负责 AI、Supabase 代理 |
| 数据存储 | **继续用 WebView localStorage** | 第一阶段不改数据层；与 PWA 行为一致 |
| PWA Service Worker | **Capacitor 内先关闭 SW 注册** | 避免 WebView 与 SW 双重快取冲突；离线靠本机字卡 + 已打包静态资源 |
| 第一阶段平台 | **先做 iOS 或 Android 其中一个** | 建议先做你主要测试设备（目前是 iPhone） |
| 发布目标 | **内部 TestFlight / 侧载测试 → 再考虑商店** | 不要第一步就处理全套商店合规 |

**推荐架构：**

```text
┌─────────────────────────────┐
│  Capacitor Native Shell     │
│  (iOS / Android WebView)    │
├─────────────────────────────┤
│  React App (dist/)          │
│  localStorage / Router      │
├─────────────────────────────┤
│  HTTPS API                  │
│  learn.lexiland.cc/api/*    │
├─────────────────────────────┤
│  Supabase Auth + DB         │
│  Vercel Serverless          │
└─────────────────────────────┘
```

---

## 2. 账号与环境准备

### 2.1 开发机器

- [ ] **macOS**（若要 build iOS；Android 可在 macOS / Windows / Linux）
- [ ] 安装 **Node.js 20+**（与现有项目一致）
- [ ] 安装 **Xcode**（iOS）及 Command Line Tools
- [ ] 安装 **Android Studio** + SDK（Android）
- [ ] 安装 **CocoaPods**（`sudo gem install cocoapods`，iOS 需要）

### 2.2 开发者账号

- [ ] **Apple Developer Program**（TestFlight / App Store，年费）
- [ ] **Google Play Console**（Android 上架，一次性注册费）
- [ ] 确认团队内谁负责签名证书与 Bundle ID / Application ID

### 2.3 项目环境变量（整理一份 `.env.capacitor.example`）

确认以下变量在原生 App build 时可用（通过 Vite `import.meta.env` 注入）：

| 变量 | 用途 | 原生注意点 |
| --- | --- | --- |
| `VITE_APP_URL` | App 对外 URL | 建议固定 `https://learn.lexiland.cc` |
| `VITE_AUTH_REDIRECT_URL` | Supabase 登入回调 | **必须**改为原生 Deep Link（见 Phase 5） |
| `VITE_SUPABASE_URL` | Supabase 项目 | 与 PWA 相同 |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | 与 PWA 相同 |
| `VITE_API_BASE_URL`（建议新增） | API 根路径 | Capacitor 内需用绝对 URL，不能只用 `/api` |

- [ ] 列出所有 `VITE_*` 变量
- [ ] 决定原生 App 的 `VITE_API_BASE_URL=https://learn.lexiland.cc`
- [ ] 不要把 `SUPABASE_SERVICE_ROLE_KEY` 打进客户端

---

## 3. 代码库准备（Capacitor 初始化前）

### 3.1 建立分支

- [ ] 从 `main` 开分支，例如：`cursor/capacitor-init-5a41`

### 3.2 API 路径抽象（重要）

目前前端多处使用相对路径 `/api/...`。在 Capacitor WebView 中，origin 是 `capacitor://localhost` 或 `https://localhost`，相对 `/api` **不会**打到 Vercel。

- [ ] 新增 `src/lib/apiBase.js`，统一返回 API 前缀：
  - Web/PWA：`""` 或 `import.meta.env.VITE_API_BASE_URL || ""`
  - Capacitor：强制 `https://learn.lexiland.cc`
- [ ] 替换以下模块中的 fetch 路径（逐一改，改完就测）：
  - [ ] `src/features/wordGroups/wordGroupsApi.js`
  - [ ] `src/features/words/completeWordApi.js`
  - [ ] `src/components/PhotoWordCapture.jsx`（图片 AI 相关 API）
  - [ ] 其他 `/api/` 调用（全局搜索 `fetch("/api` 和 `` `/api ``）
- [ ] 确认 Vercel API 允许来自 App WebView 的 CORS（若 fetch 跨域）

### 3.3 平台检测

- [ ] 新增 `src/lib/platform.js`（或扩展 `pwaPlatform.js`）：
  - `isCapacitorNative()` — `@capacitor/core` 的 `Capacitor.isNativePlatform()`
  - `isIosNative()` / `isAndroidNative()`
- [ ] 供 UI 隐藏「加入主屏幕 / PWA 安装」相关入口（原生 App 不需要）

### 3.4 Service Worker 策略

- [ ] 在 `src/lib/registerServiceWorker.js` 加入判断：**Capacitor 原生环境不注册 SW**
- [ ] 保留 PWA 版本 SW 行为不变
- [ ] 更新设定页 PWA 状态说明：原生 App 显示「Native App 模式」

### 3.5 路由与静态资源

- [ ] 确认 `vite.config.js` 的 `base` 为 `/`（Capacitor 默认）
- [ ] 确认 `BrowserRouter` 在 WebView 内正常（不要用仅 PWA 的 path 假设）
- [ ] 检查 `public/manifest.webmanifest` 图标路径在 `dist/` 内有效

---

## 4. 初始化 Capacitor（第一次接入）

### 4.1 安装依赖

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
```

- [ ] 安装完成，`package.json` 已更新

### 4.2 初始化配置

```bash
npx cap init "力思樂園" com.lexiland.app --web-dir dist
```

- [ ] 生成 `capacitor.config.ts`（或 `.json`）
- [ ] 确认 `webDir: 'dist'`
- [ ] 设定 `appId`（例如 `com.lexiland.app`，与商店一致后再改会很麻烦）
- [ ] 设定 `appName`：`力思樂園` / `LexiLand`

### 4.3 建议的 `capacitor.config` 起始值

```ts
{
  appId: "com.lexiland.app",
  appName: "力思樂園",
  webDir: "dist",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    // 开发阶段可选：server.url 指向 live reload
  },
}
```

- [ ] 配置文件已提交到 repo
- [ ] 把 `ios/`、`android/` 目录纳入 git（Capacitor 官方建议）

### 4.4 npm scripts（建议新增）

```json
{
  "build:cap": "vite build",
  "cap:sync": "npm run build:cap && npx cap sync",
  "cap:ios": "npm run cap:sync && npx cap open ios",
  "cap:android": "npm run cap:sync && npx cap open android"
}
```

- [ ] scripts 已加入并可在本地运行

---

## 5. Supabase 登入与 Deep Link（必做）

原生 App 不能用 PWA 的 `https://learn.lexiland.cc/auth/callback` 直接当作唯一回调，需要 **Custom URL Scheme** 或 **Universal Links / App Links**。

### 5.1 选择回调方案

| 方案 | iOS | Android | 复杂度 |
| --- | --- | --- | --- |
| Custom URL Scheme | `com.lexiland.app://auth/callback` | 同左 | 低，先做这项 |
| Universal / App Links | `https://learn.lexiland.cc/...` | 同左 | 中高，上架前建议补 |

### 5.2 任务清单

- [ ] 安装 `@capacitor/app`（监听 `appUrlOpen`）
- [ ] 修改 `src/features/auth/authRedirect.js`：
  - 原生环境返回 scheme URL
  - Web 环境维持现有逻辑
- [ ] Supabase Dashboard → Authentication → URL Configuration：
  - [ ] 加入 `com.lexiland.app://auth/callback`（或你选的 scheme）
  - [ ] 保留 `https://learn.lexiland.cc/**` 给 PWA
- [ ] 测试 **Email Magic Link** 登入
- [ ] 测试 **Google / Apple OAuth**（若已启用）
- [ ] 测试登出后 Guest 模式仍可用

### 5.3 验收标准

- [ ] 原生 App 内完成登入后回到 App，不是停在 Safari
- [ ] 登入后云端组別、同步功能正常
- [ ] 未登入时「先不登入，继续使用」仍有效

---

## 6. 原生权限与拍照加字（旗舰功能）

目前 `PhotoWordCapture.jsx` 使用 `<input type="file" capture="environment">`。WebView 内通常可用，但体验不如原生相机插件稳定。

### 6.1 第一阶段（最小改动）

- [ ] 在 iOS / Android 原生项目声明相机/相册权限说明
- [ ] 真机测试现有 file input 在 WebView 是否可用
- [ ] 测试相册选图 + 拍照两条路径

### 6.2 第二阶段（体验优化，可选）

- [ ] 安装 `@capacitor/camera`
- [ ] 原生环境走 Camera API，Web 继续 file input
- [ ] 处理 iPad / 权限被拒时的 fallback 文案

### 6.3 iOS Info.plist 示例键

- [ ] `NSCameraUsageDescription`
- [ ] `NSPhotoLibraryUsageDescription`

### 6.4 Android 权限

- [ ] `AndroidManifest.xml` 相机/存储权限
- [ ] Android 13+ 媒体权限适配

---

## 7. UI / 安全区 / 状态列

LexiLand 已有 `env(safe-area-inset-*)` 与 bottom nav，原生需再确认：

- [ ] 安装 `@capacitor/status-bar`（可选）
- [ ] 设定状态列风格与 App 粉蓝背景协调
- [ ] 确认底部导航不被 iPhone Home Indicator 遮挡
- [ ] 确认游戏全屏页（`/games/*`）在原生仍正常
- [ ] 隐藏或调整以下 PWA 专属 UI：
  - [ ] 安装页 / QR 安装引导（原生不需要）
  - [ ] 「加入主屏幕」按钮
  - [ ] PWA 更新横幅（改为 App Store / 内置更新策略，或保留作 hotfix 用）

---

## 8. 网络、离线、错误文案

- [ ] 原生 App 启动时无网：首页与本机字卡仍可进入
- [ ] 离线时 API 失败：继续显示中文提示（已完成 `Load failed` → 离线文案）
- [ ] 在线时 AI 拍照扫字可用
- [ ] 考虑加入 `@capacitor/network` 监听网络变化（可选）

---

## 9. iOS 平台任务

- [ ] `npx cap add ios`
- [ ] `npm run cap:sync`
- [ ] Xcode 设定 **Bundle Identifier** = `com.lexiland.app`
- [ ] 设定 **Display Name**、App Icon（1024 + 各尺寸，可从 `pwa-512.png` 延伸）
- [ ] 设定 **Launch Screen**（Splash，可用 `@capacitor/splash-screen`）
- [ ] 配置 Signing Team
- [ ] 真机 Run（Development）
- [ ] Archive → TestFlight 内部测试

### iOS 验收清单

- [ ] 冷启动 < 3 秒进入首页（视设备而定）
- [ ] 拍照加字 → AI 识别 → 生成字卡
- [ ] 字卡 / 游戏 / 错字 / 学习报告
- [ ] 登入 / 登出 / Guest
- [ ] 飞航模式：本机功能可用，云功能提示离线
- [ ] 从后台切回 App 状态不丢失

---

## 10. Android 平台任务

- [ ] `npx cap add android`
- [ ] `npm run cap:sync`
- [ ] 设定 `applicationId`、应用名称、图标
- [ ] 设定 Adaptive Icon
- [ ] 配置 Splash Screen（Android 12+）
- [ ] Debug 真机安装 APK
- [ ] 生成 Signed AAB（Play 上架用）

### Android 验收清单

与 iOS 相同的核心功能清单跑一遍。

---

## 11. 测试矩阵（Capacitor 版）

每次改原生相关代码后，至少测以下组合：

| # | 场景 | 预期 |
| --- | --- | --- |
| 1 | 新安装 → Guest 直接用 | 可拍照、加字、复习 |
| 2 | Email 登入 | 回调回 App，云同步可用 |
| 3 | OAuth 登入（如有） | 同上 |
| 4 | 离线启动 | 本机字卡/游戏可用；云/API 功能提示离线 |
| 5 | 拍照加字 | 相机/相册可用，AI 返回单字 |
| 6 | 切换英文组別 | 在线时加载；离线显示离线文案 |
| 7 | 学习报告 / 成就 | 在线可读；离线可看本机部分或提示 |
| 8 | App 切后台再打开 | 不重载丢失状态 |
| 9 | 新版本发布 | App Store / Play 更新流程（或 TestFlight） |

---

## 12. 发布准备（可放在 Capacitor 跑通之后）

### 12.1 商店素材

- [ ] App 名称：力思樂園 / LexiLand
- [ ] 副标题 / 简短说明（强调「影一影課本，即刻變溫習卡」）
- [ ] 截图：首页、拍照加字、字卡、游戏、学习报告
- [ ] 隐私政策 URL（必填）
- [ ] 支持 URL / 联系邮箱

### 12.2 合规

- [ ] 儿童隐私（若目标用户含小學生，留意 COPPA / 本地法规）
- [ ] AI 功能说明（拍照上传至服务器处理）
- [ ] 数据存储说明（本机 + 云端的 Supabase）
- [ ] 第三方 SDK 清单（Supabase、分析工具如有）

### 12.3 版本策略

- [ ] 定版本号规则（例如 `1.0.0` 对应首次商店上架）
- [ ] 决定 Web/PWA 与 Native 版本号是否同步
- [ ] 建立 TestFlight / Internal Testing 分发流程

---

## 13. 风险与回退

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| `/api` 相对路径在 WebView 失效 | AI、组別、登入全挂 | Phase 3.2 必须先做 API base 抽象 |
| Supabase OAuth 回调失败 | 无法登入 | Phase 5 Deep Link 必测 |
| SW 与 WebView 冲突 | 白屏 / 旧版本缓存 | 原生关闭 SW |
| 相机权限被拒 | 旗舰功能不可用 | 清晰权限文案 + 相册 fallback |
| App 审核对 AI/儿童内容要求 | 上架延迟 | 提前准备隐私说明与家长指引 |

**回退方案**：即使 Capacitor 延期，PWA 已可独立使用；原生壳只是增量渠道。

---

## 14. 建议执行顺序（总览）

按这个顺序做，最少返工：

1. **Phase 3.2** — API base URL 抽象（Capacitor 前置最关键）
2. **Phase 3.3–3.4** — 平台检测 + 关闭原生 SW
3. **Phase 4** — 初始化 Capacitor，跑通 `cap sync` + Xcode/Android Studio 打开
4. **Phase 5** — Supabase Deep Link 登入
5. **Phase 6** — 拍照权限与真机测试
6. **Phase 9 或 10** — 先完成一个平台的 TestFlight / 侧载
7. **Phase 11** — 完整测试矩阵
8. **Phase 12** — 商店素材与合规（上架前）

---

## 15. 第一个 Sprint 建议（可立即开工的最小范围）

若只想先验证 Capacitor 是否适合 LexiLand，第一个 Sprint 只做：

- [ ] API base 抽象 + 全局搜索替换
- [ ] `cap init` + iOS 平台 + `cap sync`
- [ ] 原生关闭 Service Worker
- [ ] Guest 模式跑通首页 → 拍照 → 字卡
- [ ] 暂不做 OAuth，仅测 Guest + 本机字卡

**Sprint 完成标准**：iPhone 上安装的 Debug App 能完成「拍照加字 → 温习 → 游戏」闭环。

---

## 16. 相关文件

| 文件 | 用途 |
| --- | --- |
| `vite.config.js` | Web build + PWA 插件 |
| `src/lib/registerServiceWorker.js` | SW 注册（原生需跳过） |
| `src/features/auth/authRedirect.js` | 登入回调 URL |
| `src/lib/appUrl.js` | 生产 URL 常量 |
| `src/components/PhotoWordCapture.jsx` | 拍照加字 |
| `vercel.json` | API 路由与 SW headers |
| `public/manifest.webmanifest` | PWA manifest（原生图标可复用） |

---

## 17. 完成后下一步

当 **第 15 节 Sprint** 完成后，再开新文档或在本文件勾选：

- [ ] Capacitor 正式合并到 `main`
- [ ] CI 增加 `npm run build:cap` 检查
- [ ] TestFlight 内部测试链接分发给团队
- [ ] 评估是否引入 Capacitor Live Update（可选，非必须）

---

**文档版本**：2026-06-22  
**适用分支**：`main`（PWA + 更新提示 UI 已合并）  
**维护者**：LexiLand 开发团队
