// One-shot check that the multi-browser bridge is live on the running dsh.
// Leaves real extension connections alone; exits non-zero when the bridge is
// still single-connection.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(join(here, 'packages', 'browser', 'bridge-browser', 'package.json'))
const WebSocket = require('ws')

const ports = [19387, 3080, 3081, 3090, 14389, 43189]
let wsUrl
for (const port of ports) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/ext/bridge-config`, { signal: AbortSignal.timeout(1500) })
    if (!res.ok) continue
    const body = await res.json()
    if (typeof body.wsUrl === 'string') { wsUrl = body.wsUrl; break }
  } catch { /* next port */ }
}
if (!wsUrl) {
  console.error('no dsh bridge on this machine; start dsh first')
  process.exit(1)
}

const CAPS = { textOnly: true, snapshotMaxChars: 32000, maxInteractiveItems: 60 }
const open = (id) => new Promise((resolve, reject) => {
  const ws = new WebSocket(wsUrl, { origin: 'chrome-extension://multi-browser-check', handshakeTimeout: 10000 })
  const frames = []
  ws.on('message', (d) => {
    const f = JSON.parse(d.toString())
    frames.push(f)
    if (f.t === 'ping') ws.send(JSON.stringify({ t: 'pong' }))
    if (f.t === 'browser.use') ws.send(JSON.stringify({ t: 'tool.result', id: f.id, ok: true, result: { text: id } }))
  })
  ws.on('error', reject)
  ws.on('open', () => {
    ws.send(JSON.stringify({ t: 'hello', token: '', caps: CAPS, browser: { kind: id, label: id, instanceId: `check-${id}` } }))
    setTimeout(() => resolve({ ws, frames }), 400)
  })
})

const chrome = await open('chrome')
const edge = await open('edge')
const ok = (c) => c.frames.some((f) => f.t === 'hello.ok')
const chromeAlive = chrome.ws.readyState === 1

console.log('bridge           :', wsUrl)
console.log('chrome handshake :', ok(chrome))
console.log('edge handshake   :', ok(edge))
console.log('chrome survived  :', chromeAlive)
chrome.ws.close(); edge.ws.close()

if (ok(chrome) && ok(edge) && chromeAlive) {
  console.log('\nMULTI-BROWSER: live (two browsers can be connected at once)')
} else {
  console.log('\nMULTI-BROWSER: not active — the running dsh still has the old single-connection bridge')
  process.exitCode = 1
}
