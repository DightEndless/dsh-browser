/**
 * Image address extraction for `browser_images`.
 *
 * The text snapshot cannot carry element attributes, so a lazily loaded image
 * whose real address lives in `zoomfile`/`file`/`data-src` — Discuz renders
 * every in-post image as `src="static/image/common/none.gif"` plus a `zoomfile`
 * with the real URL — leaves no trace in the model's view of the page. This
 * module reads those address channels and returns a compact line-per-image
 * listing. Only short text lines cross the bridge: never image bytes, never DOM.
 *
 * @module
 */

/** Address channels in priority order; the first non-placeholder one wins. */
const URL_SOURCES = ['currentSrc', 'zoomfile', 'file', 'data-src', 'src'] as const

/** Which channel supplied the reported address. */
export type ImageUrlSource = (typeof URL_SOURCES)[number]

/**
 * Placeholder, chrome, and template providers that never carry post content.
 * Deliberately URL-shaped only: guessing from rendered size would drop real
 * images that are still lazily unswapped.
 */
const DECORATIVE_URL_PATTERNS: readonly RegExp[] = [
  /\/static\/image\//i,
  /\/static\/js\//i,
  /\/(?:none|blank|spacer|loading|transparent)\.gif(?:[?#]|$)/i,
  /avatar\.php/i,
  /(?:^|[/_.-])smiley/i,
  /\/template\//i,
  /\/source\/plugin\//i,
  /^data:/i,
  /^about:/i,
]

/**
 * Content regions probed in order when the caller gives no selector. Scanning
 * the whole document instead would return page chrome — on a Discuz thread the
 * author sidebar alone contributes ~130 credit icons plus ~1380 `static/image`
 * sprites — and the real post images would never fit inside `limit`.
 */
const CONTENT_SCOPE_SELECTORS: readonly string[] = [
  'main, [role="main"]',
  'article',
  '.pcb',
  'td.t_f, [id^="postmessage_"]',
]

/** `limit` used when the caller omits it. */
export const DEFAULT_IMAGE_LIMIT = 30
/** Ceiling on `limit`, so one call can never render an unbounded listing. */
export const MAX_IMAGE_LIMIT = 200
/** Per-image alt-text budget. */
const MAX_ALT_CHARS = 60

/** One addressable image on the page. */
export interface PageImage {
  /** Absolute URL to fetch. */
  url: string
  /** Channel the URL came from. */
  source: ImageUrlSource
  /** Alt text, already collapsed and truncated (empty when absent). */
  alt: string
  /** HTML/rendered width, when the page exposes one. */
  width?: number
  /** HTML/rendered height, when the page exposes one. */
  height?: number
  /** True when the real URL came from a lazy channel or the element is lazy. */
  lazy: boolean
  /** True when the element's rendered URL is a placeholder and `url` is the real one. */
  placeholder: boolean
}

/** Result of one image scan. */
export interface ImageScan {
  images: PageImage[]
  /** Distinct content addresses found before `limit` was applied. */
  total: number
  /** Images dropped because every address they exposed was a placeholder. */
  decorativeSkipped: number
  /** Human-readable description of where the scan looked. */
  scope: string
  /** Set when the request itself was invalid (bad selector or limit). */
  error?: string
}

/** Clamp a caller-supplied `limit` to the supported range. */
export function normalizeImageLimit(value: unknown): number | undefined {
  if (value === undefined) return DEFAULT_IMAGE_LIMIT
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) return undefined
  return Math.min(value, MAX_IMAGE_LIMIT)
}

/** Whether an absolute URL is page chrome rather than content. */
export function isDecorativeUrl(url: string): boolean {
  return DECORATIVE_URL_PATTERNS.some((pattern) => pattern.test(url))
}

function resolveAbsoluteUrl(value: string | null | undefined, base: string): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed === '') return undefined
  try {
    return new URL(trimmed, base).href
  } catch {
    return undefined
  }
}

function channelValue(img: HTMLImageElement, source: ImageUrlSource): string | null {
  if (source === 'currentSrc') return img.currentSrc === '' ? null : img.currentSrc
  return img.getAttribute(source)
}

function positive(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.round(value) : undefined
}

function attributeSize(img: HTMLImageElement, name: 'width' | 'height'): number | undefined {
  const raw = img.getAttribute(name)
  if (raw === null) return undefined
  return positive(Number.parseInt(raw, 10))
}

/** HTML attributes first, then the intrinsic size when it describes this URL. */
function imageDimensions(img: HTMLImageElement, trustIntrinsic: boolean): { width?: number; height?: number } {
  // For a lazily unswapped image the intrinsic size belongs to the placeholder
  // (`none.gif`), not to the URL being reported, so it is withheld there.
  const intrinsic = (name: 'Width' | 'Height'): number | undefined => {
    if (!trustIntrinsic || !img.complete) return undefined
    return positive(name === 'Width' ? img.naturalWidth : img.naturalHeight)
  }
  return {
    width: attributeSize(img, 'width') ?? intrinsic('Width'),
    height: attributeSize(img, 'height') ?? intrinsic('Height'),
  }
}

function cleanAlt(img: HTMLImageElement): string {
  const alt = (img.getAttribute('alt') ?? '').replace(/\s+/g, ' ').trim()
  return alt.length <= MAX_ALT_CHARS ? alt : `${alt.slice(0, MAX_ALT_CHARS - 1)}…`
}

function isLazyElement(img: HTMLImageElement): boolean {
  if (img.getAttribute('loading') === 'lazy') return true
  return /lazy/i.test(img.getAttribute('class') ?? '')
}

/**
 * Build one image record from an `<img>`, walking the address channels in
 * priority order and skipping placeholder values at every step. Returns
 * `undefined` when the element exposes no content address at all.
 */
export function imageFromElement(img: HTMLImageElement, base: string): PageImage | undefined {
  const candidates: Array<{ source: ImageUrlSource; url: string }> = []
  for (const source of URL_SOURCES) {
    const url = resolveAbsoluteUrl(channelValue(img, source), base)
    if (url !== undefined) candidates.push({ source, url })
  }
  if (candidates.length === 0) return undefined
  const real = candidates.find((candidate) => !isDecorativeUrl(candidate.url))
  if (real === undefined) return undefined

  // The address the page actually paints with: `currentSrc` when the browser
  // resolved one, else the `src` attribute.
  const rendered = candidates.find((candidate) => candidate.source === 'currentSrc')
    ?? candidates.find((candidate) => candidate.source === 'src')
  const placeholder = rendered !== undefined && rendered.url !== real.url && isDecorativeUrl(rendered.url)
  const dimensions = imageDimensions(img, !placeholder)
  return {
    url: real.url,
    source: real.source,
    alt: cleanAlt(img),
    ...dimensions.width !== undefined ? { width: dimensions.width } : {},
    ...dimensions.height !== undefined ? { height: dimensions.height } : {},
    lazy: real.source !== 'currentSrc' && real.source !== 'src' || isLazyElement(img),
    placeholder,
  }
}

/** Resolve the elements to scan and describe that choice for the model. */
function resolveScope(doc: Document, selector: string | undefined): { roots: Element[]; scope: string } | { error: string } {
  if (selector !== undefined) {
    let roots: Element[]
    try {
      roots = [...doc.querySelectorAll(selector)]
    } catch {
      return { error: `selector is not a valid CSS selector: ${selector}` }
    }
    if (roots.length === 0) return { error: `No element matched selector: ${selector}` }
    return { roots, scope: selector }
  }
  for (const candidate of CONTENT_SCOPE_SELECTORS) {
    const roots = [...doc.querySelectorAll(candidate)]
    if (roots.length > 0) return { roots, scope: candidate }
  }
  const body = doc.body
  return body === null ? { error: 'The document has no body to scan.' } : { roots: [body], scope: 'body' }
}

/**
 * Collect the page's content image addresses. Duplicate addresses collapse to
 * the first occurrence so a repeated decoration cannot crowd out `limit`.
 *
 * @param doc - the document to scan.
 * @param options - optional `selector` override and `limit`.
 * @returns the scan result; `error` is set for an invalid request.
 */
export function collectPageImages(
  doc: Document,
  options: { selector?: string; limit?: number } = {},
): ImageScan {
  const limit = options.limit ?? DEFAULT_IMAGE_LIMIT
  const resolved = resolveScope(doc, options.selector)
  if ('error' in resolved) {
    return { images: [], total: 0, decorativeSkipped: 0, scope: options.selector ?? '', error: resolved.error }
  }
  const base = doc.baseURI
  const seen = new Set<string>()
  const images: PageImage[] = []
  let decorativeSkipped = 0
  for (const root of resolved.roots) {
    for (const img of root.querySelectorAll('img')) {
      const image = imageFromElement(img, base)
      if (image === undefined) {
        decorativeSkipped += 1
        continue
      }
      if (seen.has(image.url)) continue
      seen.add(image.url)
      images.push(image)
    }
  }
  return {
    images: images.slice(0, limit),
    total: images.length,
    decorativeSkipped,
    scope: resolved.scope,
  }
}

function renderDimensions(image: PageImage): string {
  if (image.width === undefined && image.height === undefined) return ''
  return `${image.width ?? '?'}x${image.height ?? '?'}`
}

/** Render one scan as the compact line-per-image text the model receives. */
export function renderImageScan(scan: ImageScan): string {
  if (scan.error !== undefined) return scan.error
  const header = `Image addresses (scope: ${scan.scope}; ${scan.total} found, ${scan.decorativeSkipped} placeholder/decorative skipped).`
  if (scan.images.length === 0) {
    return `${header}\nNo content image address was found in this scope. Pass selector, or allFrames=true, to look elsewhere.`
  }
  const lines = scan.images.map((image, index) => {
    const fields = [renderDimensions(image)]
    if (image.alt !== '') fields.push(`alt="${image.alt}"`)
    const flags = [
      ...image.lazy ? ['lazy'] : [],
      ...image.placeholder ? ['placeholder'] : [],
    ]
    if (flags.length > 0) fields.push(flags.join('+'))
    return `${index + 1}. ${image.url}${fields.filter((field) => field !== '').map((field) => ` | ${field}`).join('')}`
  })
  const remaining = scan.total - scan.images.length
  if (remaining > 0) lines.push(`…and ${remaining} more (raise limit to list them).`)
  return `${header}\n${lines.join('\n')}`
}
