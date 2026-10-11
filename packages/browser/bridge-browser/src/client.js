/**
 * Browser half of `@dightendless/dsh-bridge-browser`.
 *
 * When the host plugin is active, this client registers a General-settings row
 * that guides the user through loading the unpacked extension into Chrome/Edge
 * with a one-click copyable directory path, and displays the bridge WebSocket URL.
 */
window.__ModuleLoader__.load({
  id: '@dightendless/dsh-bridge-browser',
  factory: (require) => {
    const module = { exports: {} }
    const React = require('react')

    const BRIDGE_PATH = '/ext/bridge'
    const BRIDGE_CONFIG_PATH = '/ext/bridge-config'
    const LOCALE_NS = 'bridge-browser'
    const STYLE_ID = '@dightendless/dsh-bridge-browser/BridgeAddressRow'
    const inject = ['slots', 'locale']

    const dictionaries = {
      zh: {
        'bridgeAddress.title': '浏览器桥地址',
        'bridgeAddress.help': '粘贴到 Chrome 扩展「桥地址」设置；本机一般无需 Token。',
        'bridgeAddress.copy': '复制',
        'bridgeAddress.copied': '已复制',
        'bridgeAddress.loading': '正在读取…',
        'bridgeAddress.unavailable': '暂时无法读取桥地址',

        'extensionInstall.title': '浏览器扩展快速安装',
        'extensionInstall.help': '插件已将浏览器助手释放到本地目录，在浏览器中四步即可完成加载：',
        'extensionInstall.step1': '1. 在浏览器地址栏打开 chrome://extensions（Edge 打开 edge://extensions）',
        'extensionInstall.step2': '2. 开启右上角「开发者模式」开关',
        'extensionInstall.step3': '3. 点击左上角「加载已解压的扩展程序」按钮',
        'extensionInstall.step4': '4. 选中下方扩展解压目录（点击按钮复制后粘贴）：',
        'extensionInstall.copyPath': '复制目录路径',
        'extensionInstall.pathCopied': '已复制路径',
        'extensionInstall.reloadReminder': '已加载过扩展？打开 chrome://extensions，找到“dsh 浏览器助手”，点击卡片上的“重新加载”旋转箭头（↻）即可更新，然后重启 dsh。',
        'extensionInstall.failed': '扩展自动释放失败：',
        'extensionInstall.manualHint': '请检查目录写入权限，或从插件包内的 extension/ 目录手动加载。',
      },
      en: {
        'bridgeAddress.title': 'Browser bridge address',
        'bridgeAddress.help': 'Paste into the Chrome extension Bridge address setting. Loopback needs no token.',
        'bridgeAddress.copy': 'Copy',
        'bridgeAddress.copied': 'Copied',
        'bridgeAddress.loading': 'Loading…',
        'bridgeAddress.unavailable': 'Bridge address unavailable',

        'extensionInstall.title': 'Browser Extension Setup',
        'extensionInstall.help': 'The extension has been extracted to a local directory. Load it unpacked in four simple steps:',
        'extensionInstall.step1': '1. Open chrome://extensions in Chrome (or edge://extensions in Edge)',
        'extensionInstall.step2': '2. Turn on "Developer mode" in the top-right corner',
        'extensionInstall.step3': '3. Click the "Load unpacked" button in the top-left',
        'extensionInstall.step4': '4. Select the unpacked extension directory below (copy path with the button):',
        'extensionInstall.copyPath': 'Copy directory path',
        'extensionInstall.pathCopied': 'Path copied',
        'extensionInstall.reloadReminder': 'Already installed? Open chrome://extensions, find “dsh Browser Assistant,” click the rotating-arrow Reload button (↻) to apply updates, then restart dsh.',
        'extensionInstall.failed': 'Automatic extension extraction failed: ',
        'extensionInstall.manualHint': 'Please check write permissions or load manually from the plugin package extension/ directory.',
      },
    }

    function bridgeWsUrlFromLocation(location) {
      const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const hostname = location.hostname === 'localhost' ? '127.0.0.1' : location.hostname
      const host = location.port === '' ? hostname : `${hostname}:${location.port}`
      return `${wsProtocol}//${host}${BRIDGE_PATH}`
    }

    async function resolveBridgeConfig(location) {
      const fallbackUrl = bridgeWsUrlFromLocation(location)
      try {
        const response = await fetch(`${location.origin}${BRIDGE_CONFIG_PATH}`, {
          signal: AbortSignal.timeout(1_500),
        })
        if (!response.ok) {
          return { wsUrl: fallbackUrl, extensionPath: '', extensionStatus: 'unknown', extensionError: '' }
        }
        const body = await response.json()
        const wsUrl = (typeof body?.wsUrl === 'string'
          && (body.wsUrl.startsWith('ws://') || body.wsUrl.startsWith('wss://')))
          ? body.wsUrl
          : fallbackUrl
        return {
          wsUrl,
          extensionPath: typeof body?.extensionPath === 'string' ? body.extensionPath : '',
          extensionStatus: typeof body?.extensionStatus === 'string' ? body.extensionStatus : 'unknown',
          extensionError: typeof body?.extensionError === 'string' ? body.extensionError : '',
        }
      } catch {
        return { wsUrl: fallbackUrl, extensionPath: '', extensionStatus: 'unknown', extensionError: '' }
      }
    }

    function installStyle() {
      if (typeof document === 'undefined') return () => {}
      if (document.querySelector(`style[data-plugin-css=${JSON.stringify(STYLE_ID)}]`) !== null) {
        return () => {}
      }
      const style = document.createElement('style')
      style.dataset.plugin = '@dightendless/dsh-bridge-browser'
      style.dataset.pluginCss = STYLE_ID
      style.textContent = [
        '.dshBridgeContainer{border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;gap:16px;padding:16px 0}',
        '.dshBridgeSection{display:flex;flex-direction:column;gap:8px}',
        '.dshBridgeTitle{color:var(--dsw-alias-label-primary);font-size:14px;font-weight:600;line-height:22px}',
        '.dshBridgeHelp{color:var(--dsw-alias-label-tertiary);font-size:12px;font-weight:400;line-height:18px;margin:0}',
        '.dshBridgeSteps{display:flex;flex-direction:column;gap:4px;margin:2px 0 6px 0;padding-left:0;list-style:none}',
        '.dshBridgeStepItem{color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
        '.dshBridgeBody{display:flex;align-items:center;gap:8px;min-width:0}',
        '.dshBridgeValue{flex:1;min-width:0;margin:0;padding:8px 12px;border-radius:10px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:400 12px/18px ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;user-select:all;-webkit-user-select:all;overflow-x:auto;white-space:nowrap}',
        '.dshBridgeButton{flex:none;height:32px;padding:0 12px;border:none;border-radius:16px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}',
        '.dshBridgeButton:hover{background:var(--dsw-alias-interactive-bg-hover)}',
        '.dshBridgeButton:disabled{cursor:default;opacity:0.6}',
        '.dshBridgeReloadNotice{display:flex;align-items:flex-start;gap:6px;padding:8px 12px;border-radius:8px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary);font-size:12px;line-height:18px}',
        '.dshBridgeReloadGlyph{font-weight:bold;font-size:14px;line-height:18px}',
        '.dshBridgeErrorNotice{display:flex;flex-direction:column;gap:4px;padding:8px 12px;border-radius:8px;background:rgba(255, 77, 79, 0.08);border:1px solid rgba(255, 77, 79, 0.2);color:var(--dsw-alias-label-danger, #d9363e);font-size:12px;line-height:18px}',
      ].join('')
      document.head.append(style)
      return () => style.remove()
    }

    function BridgeAddressRow({ t }) {
      const [config, setConfig] = React.useState({
        wsUrl: '',
        extensionPath: '',
        extensionStatus: 'loading',
        extensionError: '',
      })
      const [status, setStatus] = React.useState('loading')
      const [copiedWs, setCopiedWs] = React.useState(false)
      const [copiedPath, setCopiedPath] = React.useState(false)

      React.useEffect(() => {
        let cancelled = false
        void resolveBridgeConfig(window.location).then((res) => {
          if (cancelled) return
          setConfig(res)
          setStatus('ready')
        }).catch(() => {
          if (cancelled) return
          setStatus('error')
        })
        return () => { cancelled = true }
      }, [])

      React.useEffect(() => {
        if (!copiedWs) return undefined
        const timer = window.setTimeout(() => setCopiedWs(false), 1_500)
        return () => window.clearTimeout(timer)
      }, [copiedWs])

      React.useEffect(() => {
        if (!copiedPath) return undefined
        const timer = window.setTimeout(() => setCopiedPath(false), 1_500)
        return () => window.clearTimeout(timer)
      }, [copiedPath])

      const copyText = React.useCallback(async (text, selector, onSuccess) => {
        if (!text) return
        try {
          await navigator.clipboard.writeText(text)
          onSuccess()
        } catch {
          const selection = window.getSelection()
          const node = document.querySelector(selector)
          if (selection !== null && node instanceof HTMLElement) {
            const range = document.createRange()
            range.selectNodeContents(node)
            selection.removeAllRanges()
            selection.addRange(range)
            onSuccess()
          }
        }
      }, [])

      const onCopyWs = React.useCallback(() => {
        void copyText(config.wsUrl, '.dshBridgeWsValue', () => setCopiedWs(true))
      }, [copyText, config.wsUrl])

      const onCopyPath = React.useCallback(() => {
        void copyText(config.extensionPath, '.dshBridgePathValue', () => setCopiedPath(true))
      }, [copyText, config.extensionPath])

      const wsValue = status === 'loading'
        ? t('bridgeAddress.loading')
        : status === 'error'
          ? t('bridgeAddress.unavailable')
          : config.wsUrl

      const pathValue = status === 'loading'
        ? t('bridgeAddress.loading')
        : config.extensionPath || t('bridgeAddress.unavailable')

      return React.createElement(
        'div',
        { className: 'dshBridgeContainer' },

        // Section 1: Extension installation guide
        React.createElement(
          'div',
          { className: 'dshBridgeSection' },
          React.createElement('div', { className: 'dshBridgeTitle' }, t('extensionInstall.title')),
          React.createElement('p', { className: 'dshBridgeHelp' }, t('extensionInstall.help')),
          React.createElement(
            'ul',
            { className: 'dshBridgeSteps' },
            React.createElement('li', { className: 'dshBridgeStepItem' }, t('extensionInstall.step1')),
            React.createElement('li', { className: 'dshBridgeStepItem' }, t('extensionInstall.step2')),
            React.createElement('li', { className: 'dshBridgeStepItem' }, t('extensionInstall.step3')),
            React.createElement('li', { className: 'dshBridgeStepItem' }, t('extensionInstall.step4')),
          ),
          React.createElement(
            'div',
            { className: 'dshBridgeBody' },
            React.createElement(
              'code',
              {
                className: 'dshBridgeValue dshBridgePathValue',
                title: config.extensionPath || undefined,
              },
              pathValue,
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'dshBridgeButton',
                disabled: status !== 'ready' || !config.extensionPath,
                onClick: onCopyPath,
              },
              copiedPath ? t('extensionInstall.pathCopied') : t('extensionInstall.copyPath'),
            ),
          ),
          config.extensionStatus === 'failed' && React.createElement(
            'div',
            { className: 'dshBridgeErrorNotice' },
            React.createElement('span', null, `${t('extensionInstall.failed')}${config.extensionError}`),
            React.createElement('small', null, t('extensionInstall.manualHint')),
          ),
          React.createElement(
            'div',
            { className: 'dshBridgeReloadNotice' },
            React.createElement('span', { className: 'dshBridgeReloadGlyph', 'aria-hidden': 'true' }, '↻'),
            React.createElement('span', null, t('extensionInstall.reloadReminder')),
          ),
        ),

        // Section 2: Bridge WebSocket Address
        React.createElement(
          'div',
          { className: 'dshBridgeSection' },
          React.createElement('div', { className: 'dshBridgeTitle' }, t('bridgeAddress.title')),
          React.createElement('p', { className: 'dshBridgeHelp' }, t('bridgeAddress.help')),
          React.createElement(
            'div',
            { className: 'dshBridgeBody' },
            React.createElement(
              'code',
              {
                className: 'dshBridgeValue dshBridgeWsValue',
                title: config.wsUrl || undefined,
              },
              wsValue,
            ),
            React.createElement(
              'button',
              {
                type: 'button',
                className: 'dshBridgeButton',
                disabled: status !== 'ready' || !config.wsUrl,
                onClick: onCopyWs,
              },
              copiedWs ? t('bridgeAddress.copied') : t('bridgeAddress.copy'),
            ),
          ),
        ),
      )
    }

    function apply(ctx) {
      ctx.effect(() => installStyle(), 'bridge-browser: settings row styles')
      ctx.effect(
        () => ctx.locale.register(LOCALE_NS, dictionaries),
        'bridge-browser: settings dictionaries',
      )
      ctx.slots.inject('settings.general.item', () => ctx.slots.register({
        name: 'settings.general.item',
        id: 'bridge-browser-address',
        order: 100,
        locale: LOCALE_NS,
      }, BridgeAddressRow))
    }

    module.exports.apply = apply
    module.exports.inject = inject
    return module.exports
  },
})
