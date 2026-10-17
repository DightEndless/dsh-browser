import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const testDir = fileURLToPath(new URL('.', import.meta.url))
const clientPath = join(testDir, '../src/client.js')
const clientCode = readFileSync(clientPath, 'utf8')

describe('client.js browser bundle', () => {
  let loadedModule: any
  let moduleLoader: { load: (descriptor: any) => void }

  beforeEach(() => {
    loadedModule = undefined
    moduleLoader = {
      load: vi.fn((descriptor) => {
        const dummyRequire = (id: string) => {
          if (id === 'react') {
            return {
              useState: vi.fn(val => [val, vi.fn()]),
              useEffect: vi.fn(),
              useCallback: vi.fn(fn => fn),
              createElement: vi.fn(),
            }
          }
          throw new Error(`Unexpected require: ${id}`)
        }
        loadedModule = descriptor.factory(dummyRequire)
      }),
    }
    ;(globalThis as any).window = {
      __ModuleLoader__: moduleLoader,
      location: {
        protocol: 'http:',
        hostname: '127.0.0.1',
        port: '19387',
        origin: 'http://127.0.0.1:19387',
      },
    }
  })

  afterEach(() => {
    delete (globalThis as any).window
  })

  it('evaluates and registers with window.__ModuleLoader__', () => {
    const run = new Function(clientCode)
    run()

    expect(moduleLoader.load).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '@dightendless/dsh-bridge-browser',
      }),
    )
    expect(loadedModule).toBeDefined()
    expect(typeof loadedModule.apply).toBe('function')
    expect(loadedModule.inject).toEqual(['slots', 'locale'])
  })

  it('defines bilingual dictionaries with symmetric keys', () => {
    let capturedDictionaries: any
    const mockCtx = {
      effect: vi.fn((fn) => fn()),
      locale: {
        register: vi.fn((ns, dicts) => {
          capturedDictionaries = dicts
        }),
      },
      slots: {
        inject: vi.fn(),
      },
    }

    const run = new Function(clientCode)
    run()
    loadedModule.apply(mockCtx)

    expect(mockCtx.locale.register).toHaveBeenCalled()
    expect(capturedDictionaries).toBeDefined()
    expect(capturedDictionaries.zh).toBeDefined()
    expect(capturedDictionaries.en).toBeDefined()

    const zhKeys = Object.keys(capturedDictionaries.zh).sort()
    const enKeys = Object.keys(capturedDictionaries.en).sort()
    expect(zhKeys).toEqual(enKeys)

    // Verify key entries required for H9 installation and fallback degradation
    expect(zhKeys).toContain('extensionInstall.title')
    expect(zhKeys).toContain('extensionInstall.help')
    expect(zhKeys).toContain('extensionInstall.manualHelp')
    expect(zhKeys).toContain('extensionInstall.manualHint')
    expect(zhKeys).toContain('extensionInstall.copyPath')
    expect(zhKeys).toContain('extensionInstall.pathCopied')
    expect(zhKeys).toContain('extensionInstall.reloadReminder')
    expect(zhKeys).toContain('extensionInstall.failed')
  })

  it('registers its own settings section upon apply', () => {
    const registeredSlots: any[] = []
    const mockCtx = {
      effect: vi.fn(),
      locale: { register: vi.fn() },
      slots: {
        inject: vi.fn((slotName, cb) => cb()),
        register: vi.fn((descriptor, component) => {
          registeredSlots.push({ descriptor, component })
        }),
      },
    }

    const run = new Function(clientCode)
    run()
    loadedModule.apply(mockCtx)

    expect(mockCtx.slots.inject).toHaveBeenCalledWith('settings.section', expect.any(Function))
    expect(registeredSlots.length).toBe(1)
    expect(registeredSlots[0].descriptor).toEqual({
      name: 'settings.section',
      id: 'bridge-browser',
      order: 40,
      label: expect.any(Function),
      locale: 'bridge-browser',
    })
    expect(typeof registeredSlots[0].component).toBe('function')
  })
})
