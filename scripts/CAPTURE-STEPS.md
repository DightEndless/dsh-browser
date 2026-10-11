# 店面与市场展示截图可复现拍摄指南 (Storefront Screenshot Reproduction Guide)

本文档记录 `packages/browser/bridge-browser/assets/screenshots/` 下四张展示截图的复现流程、参数规格与单步操作说明。

---

## 1. 产物规格与清单 (`screenshots.json`)

所有截图均严格符合市场准入标准：纯净无隐私信息、真机真扩展执行渲染、无操作系统外壳杂质、宽度 ≥ 1600px、单张体积 ≤ 1.5 MB。

| 文件名 | 尺寸 (像素) | 体积 | 形式 | 描述说明 (用于商店详情与 PR) |
|---|---|---|---|---|
| `cover.png` | 1672 × 941 | ~883 KB | 设计图 | **核心能力全景**：展示本插件相对于上游新增的 9 项关键能力（整页截屏、视口坐标点击、悬停、拖拽、批量动作、脚本求值、文件注入、图片提取、多浏览器切换）。 |
| `browser-and-panel.png` | 2000 × 1000 | ~250 KB | 真实截图 | **场景一 · 读懂页面**：模型通过结构化纯文本快照理解当前页面（在线真实维基百科 DeepSeek 条目），并在侧边栏给出结构化总结与分析。 |
| `action-approval.png` | 2000 × 1000 | ~260 KB | 真实截图 | **场景二 · 实操与审批门禁**：模型执行在线页面（真实维基百科）表单填写动作时，侧边栏弹出原生安全审批卡片，来源明确为 `https://en.wikipedia.org`，敏感参数打码，必须用户授权方可执行。 |
| `native-dialog.png` | 2000 × 1000 | ~130 KB | 真实截图 | **场景三 · 原生弹窗不卡死**：本地控制台测试页（本地 fixture：`/dialog-demo.html`）弹出原生 `confirm`/`alert` 模态对话框时整条调用链不挂起，提示模型通过专用 `browser_dialog` 工具快速应答解除冻结。 |

> **真实来源与本地测试页说明**：
> - 场景一与场景二均直接访问互联网公网真实页面：`https://en.wikipedia.org/wiki/DeepSeek`，展示日常浏览与交互的真实效果；
> - 场景三使用本地确定性环境测试页（local fixture：`/dialog-demo.html`），用于精确验证并展示原生 JavaScript 弹窗挂起与解除冻结机制；报告中明确区分，不将本地测试页虚标为公网页面。

---

## 2. 一键自动化重拍脚本 (Automated Runner)

仓库已配备基于 L2 真浏览器脚手架的自动化拍摄套件，任何改版后只需一条命令即可重新拍摄并自动合成：

```powershell
# 确保扩展构建产物最新
pnpm --filter dsh-browser-extension run build

# 执行拍摄脚本（需本地代理 127.0.0.1:7897 支持访问公网 Wikipedia）
node scripts/capture-storefront-screenshots.mjs
```

脚本将自动拉起 Chromium (Chrome for Testing) + 加载未打包扩展 + 依次走完三个场景并输出至目标目录。侧边栏顶部包含完整的扩展侧栏原生标题栏（图标与名称），顶部无裁剪。

---

## 3. 分场景人工/自动化详细拍摄步骤

### 场景一：读懂页面并回答 (`browser-and-panel.png`)

1. **环境与尺寸**：
   - 目标标签页视口：`1479 × 1000` px；
   - 扩展侧边栏视口：`520 × 960` px（含 40px 原生侧栏标题栏，总高 1000px）；
   - 合成总尺寸：`2000 × 1000` px（含 1px 中间浅灰分割线 `#e2e8f0`）。
2. **访问页面**：
   - 公网真实公开条目：英文 Wikipedia DeepSeek 条目 (`https://en.wikipedia.org/wiki/DeepSeek`)。
3. **交互动作**：
   - 打开扩展面板 `chrome-extension://<id>/panel/index.html`；
   - 绑定至当前标签页；
   - 发送提示词：`请先概览当前页面，告诉我最重要的信息，并等待我的下一步指令。`；
   - 模型获取 `browser_snapshot` 后输出条目结构化 Markdown 总结（公司背景、成立时间、开源定位、模型序列等）。
4. **截图合成**：
   - 截取网页主视口与已展开侧边栏，拼接并加上原生侧栏头部，生成 2000px 宽度 PNG。

---

### 场景二：工具实操与审批卡片 (`action-approval.png`)

1. **环境与尺寸**：
   - 目标标签页视口：`1479 × 1000` px；
   - 扩展侧边栏视口：`520 × 960` px（含 40px 原生侧栏标题栏，总高 1000px）；
   - 合成总尺寸：`2000 × 1000` px。
2. **访问页面**：
   - 公网真实公开条目：英文 Wikipedia DeepSeek 条目 (`https://en.wikipedia.org/wiki/DeepSeek`)。
3. **交互动作**：
   - 侧边栏清空信任源（`trustedActionOrigins: []`），使任何修改类页面操作必须经过安全审批；
   - 用户发送操作指令：`在当前页面的搜索框中输入 "DeepSeek-V4" 并准备提交。`；
   - 模型发起 `browser_type`（目标为搜索框元素 `[1]`，内容为 `"DeepSeek-V4"`）；
   - 页面搜索框实时呈现键入焦点状态与键入值；
   - 侧边栏立即弹出原生 **安全检查 · 允许执行页面操作？** 模态卡片：
     - 图标：带锁盾牌；
     - 动作详情：`向元素 [1] 输入 11 个字符 (文本内容不会显示在确认框)`；
     - 来源：`https://en.wikipedia.org`（与公网真实页面来源完全一致）；
     - 操作按钮：`拒绝` / `仅允许这一次` / `本次会话信任此域`。
4. **截图合成**：
   - 在审批卡片高亮浮起、背景半透明蒙层就绪的瞬间完成截图与拼接。

---

### 场景三：原生弹窗被 `browser_dialog` 答掉 (`native-dialog.png`)

1. **环境与尺寸**：
   - 目标标签页视口：`1479 × 1000` px；
   - 扩展侧边栏视口：`520 × 960` px（含 40px 原生侧栏标题栏，总高 1000px）；
   - 合成总尺寸：`2000 × 1000` px。
2. **访问页面**：
   - 本地控制台测试页面（local fixture）：`/dialog-demo.html`（开源应用控制台 · 部署与环境管理）。
3. **交互动作**：
   - 页面包含原生模态框触发器：`window.confirm('确定要提交当前部署配置并执行发布吗？')`；
   - 用户指令：`请帮我点击页面上的"确认发布新版本"按钮。`；
   - 模型调用 `browser_click_at` 触发按钮点击；
   - 原生 confirm 弹出致使页面主线程进入模态等待；
   - 本插件扩展捕获 `Page.javascriptDialogOpening` 事件，5ms 内向模型极速返回警报响应：
     `[Native JS dialog opened: confirm("确定要提交当前部署配置并执行发布吗？") — WARNING: Tab is frozen. Call browser_dialog with action: 'accept' or 'dismiss', or call browser_reload to abort.]`；
   - 模型立即发起后续工具调用：`browser_dialog(action: 'accept')`；
   - 扩展通过 CDP `Page.handleJavaScriptDialog` 答复批准，原生弹窗消失，页面主线程解除冻结并顺利刷新发布状态为「已成功确认并发布至生产环境！(Released)」。
4. **截图合成**：
   - 截取页面控制台状态已完成发布、同时侧边栏完整保留弹窗警报与 `browser_dialog` 解答记录的状态。
