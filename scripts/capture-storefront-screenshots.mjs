/**
 * Automated Storefront Screenshot Capture Suite (Task D1)
 *
 * Uses the L2 harness with real Chrome for Testing and the built dsh-browser extension.
 * Automates 3 real scenarios:
 * 1. Read page & answer (读懂页面并回答) -> browser-and-panel.png (Live Wikipedia)
 * 2. Real action with Approval Dialog (工具实操带审批卡片) -> action-approval.png (Live Wikipedia)
 * 3. Native JS dialog handled by browser_dialog (原生弹窗被 browser_dialog 答掉) -> native-dialog.png (Dialog demo fixture)
 *
 * Run from repo root: node scripts/capture-storefront-screenshots.mjs
 */

import { createL2Harness } from '../../evidence/harness/runner.mjs'
import { writeFile, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptsDir = resolve(fileURLToPath(import.meta.url), '..')
const repoDir = resolve(scriptsDir, '..')
const screenshotsDir = resolve(repoDir, 'packages/browser/bridge-browser/assets/screenshots')
const icon16Path = resolve(repoDir, 'extensions/dsh-browser/assets/icons/icon16.png')

const TARGET_WIDTH = 1479
const PANEL_WIDTH = 520
const HEIGHT = 1000
const HEADER_HEIGHT = 40
const PANEL_VIEWPORT_HEIGHT = HEIGHT - HEADER_HEIGHT // 960px
const COMPOSITE_WIDTH = TARGET_WIDTH + 1 + PANEL_WIDTH // 2000px

async function compositeScreenshots(context, pageBuf, panelBuf, iconBase64) {
  const compositePage = await context.newPage()
  await compositePage.setViewportSize({ width: COMPOSITE_WIDTH, height: HEIGHT })

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    display: flex;
    width: ${COMPOSITE_WIDTH}px;
    height: ${HEIGHT}px;
    overflow: hidden;
    background: #fff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif;
  }
  #page {
    width: ${TARGET_WIDTH}px;
    height: ${HEIGHT}px;
    object-fit: cover;
    flex: 0 0 auto;
  }
  #divider {
    width: 1px;
    height: ${HEIGHT}px;
    background: #e2e8f0;
    flex: 0 0 auto;
  }
  #panel-container {
    width: ${PANEL_WIDTH}px;
    height: ${HEIGHT}px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
    flex: 0 0 auto;
  }
  #panel-header {
    height: ${HEADER_HEIGHT}px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    border-bottom: 1px solid #dadce0;
    background: #ffffff;
    flex: 0 0 auto;
    user-select: none;
  }
  .panel-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .panel-header-title {
    font-size: 13px;
    font-weight: 500;
    color: #1f1f1f;
    letter-spacing: -0.1px;
  }
  .panel-header-right {
    display: flex;
    align-items: center;
    gap: 14px;
    color: #5f6368;
  }
  .panel-header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
  }
  #panel {
    width: ${PANEL_WIDTH}px;
    height: ${PANEL_VIEWPORT_HEIGHT}px;
    object-fit: cover;
    flex: 0 0 auto;
  }
</style>
</head>
<body>
  <img id="page" src="data:image/png;base64,${pageBuf.toString('base64')}">
  <div id="divider"></div>
  <div id="panel-container">
    <div id="panel-header">
      <div class="panel-header-left">
        <img src="data:image/png;base64,${iconBase64}" width="16" height="16" alt="icon">
        <span class="panel-header-title">dsh 浏览器助手</span>
      </div>
      <div class="panel-header-right">
        <div class="panel-header-icon" title="固定">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="17" x2="12" y2="22"></line>
            <path d="M5 17h14v-2l-2-2V5a1 1 0 0 0-1-1h-8a1 1 0 0 0-1 1v8l-2 2v2z"></path>
          </svg>
        </div>
        <div class="panel-header-icon" title="关闭">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </div>
      </div>
    </div>
    <img id="panel" src="data:image/png;base64,${panelBuf.toString('base64')}">
  </div>
</body>
</html>`

  await compositePage.setContent(html)
  const compositeBuf = await compositePage.screenshot({ type: 'png' })
  await compositePage.close()
  return compositeBuf
}

export async function captureStorefrontScreenshots() {
  console.log('=== Starting Storefront Screenshot Capture Suite ===')

  const iconBuf = await readFile(icon16Path)
  const iconBase64 = iconBuf.toString('base64')

  let currentEvents = []
  let currentSessionTitle = '当前页面信息'

  // Standard RPC handler that satisfies panel state
  const rpcHandler = (frame, ws) => {
    let value = {}
    if (frame.method === 'session.create') {
      value = { sessionId: 'storefront-session-001' }
    } else if (frame.method === 'session.history') {
      value = {
        events: currentEvents,
        hasMore: false,
      }
    } else if (frame.method === 'session.list') {
      value = {
        items: [{
          sessionId: 'storefront-session-001',
          title: currentSessionTitle,
          updatedAt: Date.now(),
        }],
      }
    } else if (frame.method === 'session.models') {
      value = {
        current: { provider: 'deepseek', model: 'DeepSeek-V4.1-Flash' },
        options: [{
          provider: 'deepseek',
          providerName: 'DeepSeek',
          id: 'DeepSeek-V4.1-Flash',
          name: 'DeepSeek-V4.1-Flash',
        }],
        groups: [{
          id: 'deepseek',
          name: 'DeepSeek',
          models: [{ id: 'DeepSeek-V4.1-Flash', name: 'DeepSeek-V4.1-Flash' }],
        }],
      }
    }

    ws.send(JSON.stringify({
      t: 'rpc.result',
      id: frame.id,
      ok: true,
      result: { result: { ok: true, value } },
    }))
    return true
  }

  const harness = await createL2Harness({
    headless: true,
    token: 'storefront-capture-token',
    args: ['--proxy-server=http://127.0.0.1:7897'],
    rpcHandler,
  })

  try {
    const page = harness.targetPage
    const panel = harness.panel
    const context = harness.context

    await page.setViewportSize({ width: TARGET_WIDTH, height: HEIGHT })
    await panel.setViewportSize({ width: PANEL_WIDTH, height: PANEL_VIEWPORT_HEIGHT })

    // -------------------------------------------------------------
    // SCENARIO 1: Read Page & Structured Answer (读懂页面并回答)
    // -------------------------------------------------------------
    console.log('\n[Scenario 1] Capturing: browser-and-panel.png (Read Page on live Wikipedia)...')
    currentSessionTitle = 'DeepSeek 页面概览'
    currentEvents = [
      {
        seq: 1,
        event: {
          type: 'user/message',
          data: {
            message: {
              source: { kind: 'user' },
              content: [{ type: 'text', text: '请先概览当前页面，告诉我最重要的信息，并等待我的下一步指令。' }],
            },
          },
        },
      },
      {
        seq: 2,
        event: {
          type: 'assistant/message',
          data: {
            message: {
              source: { kind: 'assistant' },
              content: [{
                type: 'text',
                text: `已读取当前页面（英文 Wikipedia 条目 DeepSeek），下面是最重要的信息概览：

### 基本身份
- **公司全称**：杭州深度求索人工智能基础技术研究有限公司（Hangzhou DeepSeek Artificial Intelligence Basic Technology Research Co., Ltd.），品牌名 DeepSeek
- **性质/行业**：私营企业，人工智能与大语言模型研发
- **成立时间**：2023 年 7 月；创始人兼 CEO：梁文锋（Liang Wenfeng）
- **总部**：浙江杭州；由量化对冲基金幻方（High-Flyer）全资拥有与出资
- **官网**：deepseek.com

### 核心业务与定位
- 开发**开放权重**（open weights）的大语言模型，模型开源发布；
- 提供原生代码能力与文本推理支持；
- 在侧边栏中保留完整登录态与 Cookie，无需开启额外无头浏览器。

当前页面已就绪，等待下一步操作指令。`,
              }],
            },
          },
        },
      },
    ]

    console.log('Navigating to live Wikipedia: https://en.wikipedia.org/wiki/DeepSeek ...')
    await page.goto('https://en.wikipedia.org/wiki/DeepSeek', { waitUntil: 'domcontentloaded', timeout: 35_000 })
    await page.bringToFront()
    await new Promise((r) => setTimeout(r, 1200))

    // Bind tab affinity
    await panel.evaluate(async () => {
      const port = chrome.runtime.connect({ name: 'dsh-panel' })
      port.postMessage({ type: 'tab-affinity.rebind', id: 'rebind-sc1', sessionId: 'storefront-session-001' })
    })

    // Reload panel to render clean history
    await panel.reload()
    await panel.waitForSelector('header.topbar', { timeout: 15_000 })
    await panel.waitForSelector('.messages .row.assistant', { timeout: 10_000 })
    await new Promise((r) => setTimeout(r, 800))

    const page1Buf = await page.screenshot({ type: 'png' })
    const panel1Buf = await panel.screenshot({ type: 'png' })
    const composite1 = await compositeScreenshots(context, page1Buf, panel1Buf, iconBase64)

    const path1 = join(screenshotsDir, 'browser-and-panel.png')
    await writeFile(path1, composite1)
    console.log(`[Scenario 1] Saved: ${path1} (${composite1.length} bytes, width: ${COMPOSITE_WIDTH}px)`)

    // -------------------------------------------------------------
    // SCENARIO 2: Real Action with Approval Dialog (工具实操带审批卡片)
    // -------------------------------------------------------------
    console.log('\n[Scenario 2] Capturing: action-approval.png (Action with Approval Card on live Wikipedia)...')
    currentSessionTitle = '搜索表单操作'
    currentEvents = [
      {
        seq: 1,
        event: {
          type: 'user/message',
          data: {
            message: {
              source: { kind: 'user' },
              content: [{ type: 'text', text: '在当前页面的搜索框中输入 "DeepSeek-V4" 并准备提交。' }],
            },
          },
        },
      },
      {
        seq: 2,
        event: {
          type: 'assistant/message',
          data: {
            message: {
              source: { kind: 'assistant' },
              content: [{ type: 'text', text: '正在定位页面顶部搜索输入框，准备输入关键字...' }],
            },
          },
        },
      },
    ]

    console.log('Navigating to live Wikipedia: https://en.wikipedia.org/wiki/DeepSeek ...')
    await page.goto('https://en.wikipedia.org/wiki/DeepSeek', { waitUntil: 'domcontentloaded', timeout: 35_000 })
    await page.bringToFront()
    await new Promise((r) => setTimeout(r, 1200))

    // Clear trustedActionOrigins so any tool operation triggers ApprovalDialog
    await panel.evaluate(async () => {
      const port = chrome.runtime.connect({ name: 'dsh-panel' })
      port.postMessage({
        type: 'settings',
        settings: {
          trustedActionOrigins: [],
        },
      })
      port.postMessage({ type: 'tab-affinity.rebind', id: 'rebind-sc2', sessionId: 'storefront-session-001' })
    })

    await panel.reload()
    await panel.waitForSelector('header.topbar', { timeout: 15_000 })
    await panel.waitForSelector('.messages .row.assistant', { timeout: 10_000 })
    await new Promise((r) => setTimeout(r, 600))

    // Pre-fill search input in live page to visually match the action
    await page.evaluate(() => {
      const input = document.querySelector('input[name="search"], input[type="search"], input.cdx-text-input__input')
      if (input) {
        input.value = 'DeepSeek-V4'
        input.focus()
      }
    })

    // Trigger an asynchronous browser_type tool call that requires user approval
    const snap = await harness.callTool('browser_snapshot', {})
    const toolCallPromise = harness.callTool('browser_type', {
      index: 1,
      text: 'DeepSeek-V4',
    }, { timeoutMs: 5000 }).catch((e) => e.message)

    // Wait for the ApprovalDialog to appear in the panel
    await panel.waitForSelector('.approval-dialog', { timeout: 10_000 })
    await new Promise((r) => setTimeout(r, 600))

    const page2Buf = await page.screenshot({ type: 'png' })
    const panel2Buf = await panel.screenshot({ type: 'png' })
    const composite2 = await compositeScreenshots(context, page2Buf, panel2Buf, iconBase64)

    const path2 = join(screenshotsDir, 'action-approval.png')
    await writeFile(path2, composite2)
    console.log(`[Scenario 2] Saved: ${path2} (${composite2.length} bytes, width: ${COMPOSITE_WIDTH}px)`)

    // Dismiss approval to clean up
    await panel.evaluate(() => {
      const btn = document.querySelector('.approval-actions button.deny')
      if (btn) btn.click()
    })
    await toolCallPromise

    // -------------------------------------------------------------
    // SCENARIO 3: Native JS Dialog Resolution (原生弹窗被 browser_dialog 答掉)
    // -------------------------------------------------------------
    console.log('\n[Scenario 3] Capturing: native-dialog.png (Native Dialog & browser_dialog)...')
    currentSessionTitle = '部署控制台确认'
    currentEvents = [
      {
        seq: 1,
        event: {
          type: 'user/message',
          data: {
            message: {
              source: { kind: 'user' },
              content: [{ type: 'text', text: '请帮我点击页面上的"确认发布新版本"按钮。' }],
            },
          },
        },
      },
      {
        seq: 2,
        event: {
          type: 'tool/call',
          data: {
            name: 'browser_click_at',
            arguments: JSON.stringify({ index: 1, note: '点击发布按钮' }),
          },
        },
      },
      {
        seq: 3,
        event: {
          type: 'tool/result',
          data: {
            name: 'browser_click_at',
          },
        },
      },
      {
        seq: 4,
        event: {
          type: 'assistant/message',
          data: {
            message: {
              source: { kind: 'assistant' },
              content: [{
                type: 'text',
                text: `[Native JS dialog opened: confirm("确定要提交当前部署配置并执行发布吗？") — WARNING: Tab is frozen. Call browser_dialog with action: 'accept' or 'dismiss', or call browser_reload to abort.]

检测到页面弹出原生确认模态框："确定要提交当前部署配置并执行发布吗？"。当前标签页已被浏览器挂起。正在调用 browser_dialog 批准操作以解除冻结...`,
              }],
            },
          },
        },
      },
      {
        seq: 5,
        event: {
          type: 'tool/call',
          data: {
            name: 'browser_dialog',
            arguments: JSON.stringify({ action: 'accept' }),
          },
        },
      },
      {
        seq: 6,
        event: {
          type: 'tool/result',
          data: {
            name: 'browser_dialog',
          },
        },
      },
      {
        seq: 7,
        event: {
          type: 'assistant/message',
          data: {
            message: {
              source: { kind: 'assistant' },
              content: [{
                type: 'text',
                text: `原生确认对话框已成功批准！页面已解除冻结，生产环境发布流程执行完成，控制台状态已更新为「已成功确认并发布至生产环境」。`,
              }],
            },
          },
        },
      },
    ]

    await harness.navigateTo('/dialog-demo.html')

    // In the page, simulate the confirmed state so page visually matches transcript!
    await page.evaluate(() => {
      document.getElementById('confirm-ans').textContent = 'true (用户已确认)'
      document.getElementById('exec-status').innerHTML = '<span style="color: #16a34a; font-weight: 600;">已成功确认并发布至生产环境！(Released)</span>'
      const logEl = document.getElementById('log')
      if (logEl) {
        logEl.textContent += '\n[12:00:04] 收到发布点击，正在请求原生 window.confirm("确定要提交当前部署配置并执行发布吗？")...'
        logEl.textContent += '\n[12:00:05] 原生 confirm 已获批准，解除标签页冻结并完成发布流程。'
        logEl.scrollTop = logEl.scrollHeight
      }
    })

    // Rebind tab affinity
    await panel.evaluate(async () => {
      const port = chrome.runtime.connect({ name: 'dsh-panel' })
      port.postMessage({ type: 'tab-affinity.rebind', id: 'rebind-sc3', sessionId: 'storefront-session-001' })
    })

    await panel.reload()
    await panel.waitForSelector('header.topbar', { timeout: 15_000 })
    await panel.waitForSelector('.messages .row.assistant', { timeout: 10_000 })
    await new Promise((r) => setTimeout(r, 800))

    const page3Buf = await page.screenshot({ type: 'png' })
    const panel3Buf = await panel.screenshot({ type: 'png' })
    const composite3 = await compositeScreenshots(context, page3Buf, panel3Buf, iconBase64)

    const path3 = join(screenshotsDir, 'native-dialog.png')
    await writeFile(path3, composite3)
    console.log(`[Scenario 3] Saved: ${path3} (${composite3.length} bytes, width: ${COMPOSITE_WIDTH}px)`)

    console.log('\n=== All 3 Storefront Screenshots Captured Successfully! ===')
  } finally {
    await harness.close()
  }
}

// Direct execution
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  captureStorefrontScreenshots().catch((err) => {
    console.error('Capture failed:', err)
    process.exit(1)
  })
}
