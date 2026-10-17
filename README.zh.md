# dsh 浏览器操作

> [!NOTE]
> **打开浏览器扩展侧边栏，就能原地接管你当前正在浏览的网页。**
>
> **本仓库是 [omdsh-dev/dsh-browser](https://github.com/omdsh-dev/dsh-browser) 的 fork**，补齐了上游没有的能力：视口与整页 `browser_screenshot`、`browser_hover`、`browser_click_at`、`browser_drag`、`browser_batch`、`browser_eval`、`browser_upload`、`browser_images`。桥接包使用独立的包名 `@dightendless/dsh-bridge-browser`，因此本 fork 与上游包可以同时存在于同一个 dsh profile 中，不会互相顶替。

[English](README.md) | **中文**

[![npm version](https://img.shields.io/npm/v/%40dightendless%2Fdsh-bridge-browser?label=npm&color=cb3837)](https://www.npmjs.com/package/@dightendless/dsh-bridge-browser)

<img width="1672" alt="dsh 浏览器操作：本 fork 新增的工具，围绕一台带有编号元素清单与侧边栏的浏览器窗口排布" src="packages/browser/bridge-browser/assets/screenshots/cover.png" />

<img width="1672" alt="侧边栏已连接，正在读取一个页面" src="packages/browser/bridge-browser/assets/screenshots/browser-and-panel.png" />

<p align="center">
  <img width="100%" alt="dsh-browser 架构图：纯文本大模型如何通过扩展接管正在使用的浏览器标签页" src="packages/browser/bridge-browser/assets/diagrams/architecture.svg" />
</p>

把 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 连接到你正在使用的 Chrome 或 Firefox 标签页。模型可以读取页面内容、操作控件、导航和管理标签页，同时保留登录态、会话和 Cookie。侧边栏提供对话界面。

`dsh` 是由 DeepSeek AI 开发的开源、插件化 agent harness（智能体框架）。本仓库将配套的浏览器桥插件与 Chrome/Firefox MV3 扩展组成一个独立的 pnpm workspace。

浏览器操作以文本为主：页面会转换为结构化文本和带编号的交互元素清单，模型通过编号定位元素。`browser_screenshot` 是唯一会返回图片的工具——它把截图存成本地文件，只把路径交给模型，因此页面通道依然保持文本形态。dsh 0.2.0 的多模态对话是另一条独立通道：宿主声明图片能力时，侧栏可发送 PNG、JPEG、WebP 和 GIF。

> [!IMPORTANT]
> 支持的 dsh 运行时：`0.2.0-rc.2`、整条 `0.2.1-alpha` 线，以及 `0.2.1-rc.1` / `0.2.1-rc.2`。`0.2.1` 线收紧了网关的 `PeerScope` 契约，所以 **0.3.6 是第一个能在其上工作的版本**——更旧的版本会在 `$events` 上断开，面板始终连不上。不再支持更旧的 DSH。

## 快速安装

> [!TIP]
> **不需要 API Key、不需要注册账号、不接任何第三方服务。** Chrome 零配置：装好插件、重启 dsh、加载一次扩展，侧边栏自己连上。全程只走你本机的回环地址。（只有 Firefox 需要本地 token，因为 `moz-extension://` 的 UUID 无法为扩展鉴权——见 [Firefox](#firefox)。）

有三条路线。本项目同时包含 dsh bridge plugin 和浏览器扩展，而扩展这一半在 Chrome 里只能以「加载已解压」的方式安装——浏览器不提供别的途径。所以除非用安装器，两半是分开装的。

**1. 只装插件**（已预构建，无需构建步骤，也不需要 Git）：

```sh
dsh plugin --profile web add @dightendless/dsh-bridge-browser
```

（同样的字节也附在 [最新 release](https://github.com/DightEndless/dsh-browser/releases/latest) 的 tarball 里，可离线安装；手动管理 profile 的话就是 `npm i @dightendless/dsh-bridge-browser`。装完插件后重启 dsh，它会扩展释到 `~/.dsh/browser-extension` 并打印该路径。）

**2. 只装扩展**（已预构建）：从同一个 release 的 tarball 里取 `extension/` 文件夹，或者让插件自己释放（路线 1 首次启动就会做）。然后打开 `chrome://extensions`（Edge 是 `edge://extensions`），开启右上角**开发者模式**，点 **加载已解压的扩展程序**，选中那个文件夹。

路线 1 加路线 2 就是完整安装，而且**都不需要 Node、pnpm 或 Git**。

**3. 两半一起装**，用一行安装器：它会构建并注册桥插件、把 Chrome 扩展构建到 `~/.dsh/browser-extension`，然后打开 `chrome://extensions`：

macOS 与 Linux：

```sh
curl -fsSL https://raw.githubusercontent.com/DightEndless/dsh-browser/refs/heads/main/scripts/install.sh | bash
```

Windows（PowerShell）：

```powershell
$s="$env:TEMP\dsh-install.ps1"; irm https://raw.githubusercontent.com/DightEndless/dsh-browser/refs/heads/main/scripts/install.ps1 -OutFile $s; powershell -NoProfile -ExecutionPolicy Bypass -File $s
```

这条路线需要 Node.js 22+ 与 pnpm，因为它要从源码构建两半。

无论走哪条路线，最后都在浏览器扩展页面里加载或重新加载 **dsh 浏览器助手**；如果 dsh 已经在运行，装完请重启。前置要求、启动命令、更新方式和开发者安装详见[详细安装与使用](#详细安装与使用)。

也可以从仓库源码安装插件——`dsh plugin --profile web add github:DightEndless/dsh-browser#path:/packages/browser/bridge-browser`——但该包会在安装时自行构建，而 pnpm 对 git 来源的包默认拒绝执行构建脚本，必须先手工加一条 `allowBuilds` 才会构建。上面的 release 资产没有这个问题，因为它们已经是构建好的产物。

> [!IMPORTANT]
> npm 上未加 scope 的 [`dsh-browser`](https://www.npmjs.com/package/dsh-browser) 包属于另一个项目，与本仓库无关。本 fork 同样没有发布 npm 包：上方的预构建资产就是安装方式，安装器则是"一条命令装齐"的替代方案。

## 与 Playwright 方案的核心区别

常见的浏览器 Agent 方案多基于无头 Playwright 或 Puppeteer。这类方案适合自动化测试与爬虫，但在作为日常伴随式个人助手时，与 `dsh-browser` 存在显著区别：

1. **接管正在使用的标签页 vs. 空白新浏览器**：Playwright 每次启动全新的干净浏览器实例，没有用户的日常登录状态与 Cookie；而 `dsh-browser` 直接接入你在 Chrome 或 Edge 中此刻正在浏览的标签页，完整保留现有登录凭据、会话与个性化配置，无需重复登录或传递账号密码。
2. **零额外浏览器进程与调试端口**：无需在后台拉起第二个浏览器，也不对外开放 `--remote-debugging-port` 远程调试端口（该端口在本地网络上存在无凭据控制风险）。扩展与宿主桥接通过本地回环 WebSocket 进行，受独立的 bearer token 保护。
3. **受信任输入与逐项人工审批**：与 Playwright 预设的全自动无人值守脚本不同，`dsh-browser` 专为人类协同设计。状态变更类操作在执行前会在侧边栏弹出原生审批卡片；其中 `browser_click` 使用 content script 的 `el.click()`（合成事件），而坐标点击（`browser_click_at`）、键盘输入（`browser_press`/`browser_type`）与拖拽/上传等均经 CDP 派发具有 `isTrusted: true` 标记的真实硬件级输入；表单敏感信息在快照中自动脱敏呈现。

## 性能基准


在 2026 年 8 月 18 日完成的 60 次配对端到端评测中（该评测在上游项目上测得，本 fork 与之共用同一套页面工具面），两个后端分配到的 30 次运行均全部成功；dsh 浏览器操作使用了更少的模型/工具轮次，并以更短时间完成任务：

| 后端 | 成功率 | 平均端到端耗时 | 平均浏览器工具调用 |
|---|---:|---:|---:|
| **dsh 浏览器操作** | **30/30** | **5.32 秒** | **3.4** |
| 对齐工具契约的 Playwright 基线 | 30/30 | 6.67 秒 | 4.7 |

Playwright / 扩展的配对耗时比为 **1.24**（95% CI **1.16–1.34**）：Playwright 耗时约多 24%；等价地说，dsh 浏览器操作将延迟降低约 20%，每个任务平均节省 1.35 秒。评测使用 6 个浏览器任务、5 个确定性 seed、相同的 DSH profile 与模型（`deepseek-v4-flash`），并通过独立页面状态验证结果。详见[评测方法与复现说明](benchmark/README.md)。

## 核心能力

| 能力 | 工具 | 说明 |
|---|---|---|
| 读取页面 | `browser_snapshot` | 结构化文本快照：标题/URL/正文/编号交互清单/表单字段（敏感值掩码）；`delta: true` 只返回变化 |
| 点击元素 | `browser_click` | 按编号点击链接/按钮/复选框等 |
| 按坐标点击 | `browser_click_at` | 用受信任的鼠标输入点击视口内的位置；`x`/`y` 为视口比例 |
| 填写表单 | `browser_type` | 输入文本（React/Vue 受控组件兼容）；按可见文字或 value 选下拉框；勾选/取消复选框与单选框；`replace` 清空重填 |
| 上传文件 | `browser_upload` | 按路径把本地文件挂到文件输入框；审批框会显示文件路径 |
| 执行脚本 | `browser_eval` | 通过 DevTools 协议在页面里求值 JavaScript 并返回结果；需要 `debugger` 权限 |
| 按键 | `browser_press` | Enter/Tab/Escape/方向键等。Tab 真正移动焦点，Enter/空格真正触发页面默认行为 |
| 滚动 | `browser_scroll` | 视口滚动（up/down/top/bottom） |
| 页面导航 | `browser_navigate` / `browser_open_tab` / `browser_back` / `browser_forward` / `browser_reload` | 受控标签页内导航，或新开标签页并跟随（`active:false` 时保持当前页在前台） |
| 列出标签页 | `browser_list_tabs` | 列出可访问标签页的稳定 ID、标题、URL、窗口/顺序以及活动/受控状态 |
| 跟随标签页 | `browser_follow_tab` | 将后续浏览器工具绑定到 `browser_list_tabs` 返回的标签页，而不激活该标签页 |
| 关闭标签页 | `browser_close_tab` | 关闭 `browser_list_tabs` 返回的标签页 |
| 读取区域 | `browser_get_text` | 懒加载内容 / 局部文本 |
| 列出图片 | `browser_images` | 正文区的绝对图片地址，每张一行，带宽高、alt 和懒加载/占位标记；会解析 `zoomfile`/`file`/`data-src` 通道，支持 `selector`、`limit`、`allFrames` |
| 截取画面 | `browser_screenshot` | 把可见区域存成本地图片并返回路径供 `read_image` 查看；页面含义靠视觉（验证码、图表、排版）或图片本身拿不到时用它 |
| 等待 | `browser_wait` | 页面稳定检测；也可等 `selector`/`text` 出现，或配合 `gone` 等它消失，用 `timeoutMs` 限时 |
| 发送图片 | `session.prompt` / `session.attachment` | 按宿主能力启用图片草稿、纯图片消息和持久历史预览 |
| 引用选中内容 | 侧栏输入框 | 在页面里划选的文字会出现在输入框，随下一条消息一起发送，并带上来源与不可信内容边界 |

## 组成

```
packages/browser/bridge-browser/
  cordis.patch.yml
extensions/dsh-browser/
scripts/install.sh
scripts/install.ps1
```

## 为什么这样设计

- **使用你的真实浏览器，而不是无头副本**：模型操作你已经打开的页面，登录态、会话和 Cookie 均会保留。
- **以文本为主的页面接口**：编号控件、跨快照稳定 ID、delta 更新和敏感值掩码，使模型无需截图也能操作页面；用户主动添加的对话图片走 dsh 独立的多模态消息通道。
- **用「指」代替「描述」**：直接划选你要问的那段文字，侧栏会把它引用下来，说「解释这个」不必再描述整页内容。只有侧栏打开时才会捕获，并且在你发送消息之前不会离开浏览器。
- **收窄隐私边界**：密码和支付卡字段始终显示为 `••••`，字段值不会离开页面。
- **受保护的桥连接**：远程连接使用认证握手，特权网关方法拒绝非回环调用方，扩展把工具绑定到一个由用户控制的标签页。

## 详细安装与使用

前置要求：Node.js `^22.19` 或 `>=24`、Corepack/pnpm，以及 Chrome 116+ 或 Firefox 140+。Windows 还需要系统自带的 Windows PowerShell 5.1，或 PowerShell 7+。

### 安装或更新

托管安装请运行：

```sh
curl -fsSL https://raw.githubusercontent.com/DightEndless/dsh-browser/refs/heads/main/scripts/install.sh | bash
```

Windows 请运行：

```powershell
$s="$env:TEMP\dsh-install.ps1"; irm https://raw.githubusercontent.com/DightEndless/dsh-browser/refs/heads/main/scripts/install.ps1 -OutFile $s; powershell -NoProfile -ExecutionPolicy Bypass -File $s
```

安装器会下载本仓库的默认分支、构建并注册桥插件、把 Chrome 扩展构建到 `~/.dsh/browser-extension`，然后打开 `chrome://extensions`。首次安装时，请把该目录作为已解压扩展加载；更新时点击**重新加载**。如果 dsh 已在运行，请重启。

`scripts/install.sh` 覆盖 macOS 与 Linux，`scripts/install.ps1` 覆盖 Windows；两者写入同一个托管工作区和同一份安装元数据。当系统提供剪贴板工具（`pbcopy`、`wl-copy`、`xclip`、`xsel` 或 PowerShell 的 `Set-Clipboard`）时，安装器会把扩展路径复制到剪贴板；无论是否复制成功都会打印该路径。若未检测到 Chrome/Chromium，安装器会打印对应的安装命令；设置 `DSH_INSTALL_BROWSER=1` 可让安装器尝试自动安装。

Windows 命令先下载 `install.ps1` 再执行，而不是管道给 `Invoke-Expression`：脚本是带 BOM 的 UTF-8，Windows PowerShell 依赖 BOM 才能正确显示中文，而 `Invoke-Expression` 无法处理开头的 BOM。本地 checkout 路径可以包含空格；安装器通过 profile 内的目录联接注册桥插件，因此包规格中不会出现 Windows 绝对路径。

如需从源码 checkout 安装当前分支：

```sh
git clone https://github.com/DightEndless/dsh-browser.git
cd dsh-browser
./scripts/install.sh
```

Windows 请在 checkout 中运行 `.\scripts\install.ps1`。拉取或切换版本后，请重新运行安装器并重新加载扩展。

### Firefox 源码构建

Firefox 使用独立的 MV3 manifest、事件页后台和 Sidebar。在 checkout 中构建后，打开 `about:debugging#/runtime/this-firefox`，选择「临时载入附加组件」，再选取 `extensions/dsh-browser/dist-firefox/manifest.json`：

```sh
pnpm install
pnpm --filter dsh-browser-extension run build:firefox
```

桥地址仍会自动探测。Firefox 的 `moz-extension://` UUID 不能证明扩展身份，因此需要把 `~/.dsh/ext-bridge-token` 中的 bearer token 填入扩展设置（dsh 启动日志会报告该文件路径）。签名发布时可直接使用同一份 `dist-firefox/` 产物。

### 启动与使用

启动托管安装：

```sh
cd ~/.dsh/dsh-browser && pnpm start
```

使用源码 checkout 时，请在仓库根目录运行 `pnpm start`。受支持的精确公开版本为：

```sh
npx @deepseek-ai/dsh@0.2.0-rc.2 web
```

Chrome 本机使用无需配置；Firefox 需要填写上述本地桥 token。打开页面，点击 DeepSeek 鲸鱼图标，等待侧边栏显示**已连接**。已有 HTTP(S) 标签页会在第一次操作时自动加载。在浏览器受保护页面和扩展商店中，模型可以读取标签页元数据，并通过浏览器级能力导航到 HTTP(S)、后退、前进和刷新，但不能读取或操作受保护页面的 DOM。

## 故障排查

**侧边栏一直显示「未连接」**

Chrome 不需要填地址、也不需要填 token——两个框留空，扩展会自己找到桥。若仍连不上：

- 确认 dsh 正在运行。扩展会直接问插件：插件占用固定的回环端口（`30789`，被占则 `30790` / `30791`），在那里用 `/ext/bridge-config` 回应当前真实的 WebSocket 地址。可以用 `curl http://127.0.0.1:30789/ext/bridge-config` 自查，返回类似 `{"wsUrl":"ws://127.0.0.1:<端口>/ext/bridge"}` 的 JSON。
- 这几个端口都没有响应，说明插件没加载。运行 `dsh plugin --profile <profile> list` 确认，装好后重启 dsh。
- 升级插件后要重新加载一次扩展：打开 `chrome://extensions`，点卡片上的圆形重载箭头。只重启 dsh 不会重载扩展。
- 用 `--host 0.0.0.0` 做的远程部署无法自动发现。打开面板设置，展开**高级**，把桥地址（以及 token）填进去。

Firefox 始终需要 token：`moz-extension://` 的 UUID 无法为扩展鉴权。

## 开发

桥接插件和 Chrome/Firefox 扩展都属于本仓库 workspace；所有命令均在本仓库根目录执行。首次开发安装运行 `pnpm install`。

```sh
pnpm run build
pnpm run typecheck
pnpm run test
pnpm run check:runtime
pnpm run test:smoke

pnpm --filter @dightendless/dsh-bridge-browser run build
pnpm --filter @dightendless/dsh-bridge-browser run typecheck
pnpm --filter @dightendless/dsh-bridge-browser run test

pnpm --filter dsh-browser-extension run build
pnpm --filter dsh-browser-extension run build:firefox
pnpm --filter dsh-browser-extension run test
```

注意：

- 启动前桥接插件必须已有 `lib/` 供 Loader 加载；`scripts/install.sh` 和根目录 `pnpm run build` 都会先构建插件再构建扩展。
- 桥构建使用 Node.js `copyFileSync` 复制浏览器客户端，因此同一条包脚本不依赖 Unix `cp` 命令。
- `@deepseek-ai/dsh` 与桥接插件的依赖固定在同一条经过验证的公开发布线上；升级时必须同时更新 manifest、锁文件并重跑根目录检查。

`check:runtime` 检查实际解析的 DSH 依赖和锁文件；`test:smoke` 使用临时 DSH home 启动真实 web 宿主，验证桥接和重启后的会话读取，无需模型密钥。CI 在干净安装后运行这些检查。

如果遇到 `cache.hydratePrepared is not a function`，更新仓库后重新运行 `pnpm install --frozen-lockfile` 和 `pnpm run build`，再重启 `pnpm start`。无需删除会话数据或清空全局缓存。

## 安全

- 桥路径在 `/api` 信任栅栏之外，自带 bearer token 认证。
- Chrome 扩展的本地 Origin 保留零配置回环访问；Firefox Origin 是每次安装生成的 UUID，必须携带 bearer token。
- 特权网关方法（`settings.*`/`credentials.*`/`host.open*`）对非回环来源一律拒绝。
- 单活动连接；浏览器页面管线默认以结构化文本呈现，`browser_screenshot` 是唯一会返回图片的浏览器工具：截图落到本地文件，模型拿到的是该路径，而不是内联像素。用户主动添加的对话图片交给 dsh 持久附件服务，密码和卡号值永不回传。
- 助手开始工作时会绑定当时的活动标签页（提交提示时绑定；直接调用浏览器工具时则在首次调用绑定）。用户手动切页后，后续浏览器操作会暂停，侧栏会询问让助手继续原页面还是跟随新页面；选择原页面后允许在后台继续，但扩展绝不静默改绑或切换用户正在看的页面。受控标签页关闭后也会暂停，直到用户显式选择当前页。
- 只有在侧栏打开、且页面共享不是「关闭」时才会捕获划选内容，密码和卡号字段永不读取。内容在发送之前始终留在扩展内部；移除、页面跳转或标签页关闭都会丢弃它；发送时与页面快照一样包在不可信内容边界内，来源标题和 URL 同样由页面提供，因此也放在边界之内。
- 网页文字会标记为不可信输入。默认「自动共享」只按需读取受控标签页且不额外弹窗；对隐私敏感时可选择「每次询问」，或用「关闭」完全阻断读取。在「每次询问」模式下，读取弹窗可以仅允许一次，也可以持久切回自动读取；之后仍可在设置中关闭。读取的页面文字会发送给当前选择的模型。
- 点击、输入、按键、导航、历史跳转和刷新默认失败关闭，必须由用户批准。可以只在当前侧栏会话中信任单个 origin（最后一个侧栏关闭或 Service Worker 重启即清空）；永久信任需在设置中显式管理。显式跨域 `browser_navigate` 和未知目标的历史跳转始终重新询问。
- **允许模型完全控制浏览器**是显式的全局选择，只有设置保存成功后才会生效。启用后，页面读取、页面操作和标签页列出/跟随/关闭都不会再请求确认。调用在收到时固定其访问模式，因此开启完全控制不会追溯提升已经开始的受限调用。关闭会立即生效：取消尚未下发操作的调用，等待已经下发到浏览器的操作完成，再保存限制设置。快速重新开启也会在旧权限撤销完成前保持受限，并发保存会按请求顺序落盘。无论是否启用，浏览器受保护页面的 DOM 内容都无法访问。
