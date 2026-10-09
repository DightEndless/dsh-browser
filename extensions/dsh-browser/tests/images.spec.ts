// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  collectPageImages,
  DEFAULT_IMAGE_LIMIT,
  MAX_IMAGE_LIMIT,
  normalizeImageLimit,
  renderImageScan,
} from '../src/content/images.ts'

/**
 * Mirrors the real Discuz thread markup: the author sidebar carries credit
 * icons that live on the same CDN as post content, and every in-post image is a
 * lazily swapped `none.gif` placeholder whose real URL sits in `zoomfile`.
 */
const DISCUZ_HTML = `
  <div class="pls">
    <dl class="cl">
      <dt><b><img style="vertical-align:middle" src="https://img.gamemale.com/album/201404/12/023039r465s6wuz65a5sx4.jpg" /> 金币</b></dt>
      <dd><img style="vertical-align:middle" src="https://img.gamemale.com/album/201404/12/023033uxlbvypbeqlzjyy5.jpg" /></dd>
    </dl>
    <img src="https://www.gamemale.com/uc_server/avatar.php?uid=742147&size=middle" />
  </div>
  <div class="pcb">
    <div class="t_fsz"><table><tr><td class="t_f" id="postmessage_7451990">
      <img id="aimg_683319" src="static/image/common/none.gif"
           zoomfile="https://img.gamemale.com/forum/202610/02/131605zhuv8vy91u7czhrb.png"
           file="https://img.gamemale.com/forum/202610/02/131605zhuv8vy91u7czhrb.png"
           class="zoom" width="372" alt="" />
      <img src="static/image/common/none.gif"
           zoomfile="https://img.gamemale.com/forum/202610/02/132501trjtnpermyv7m4vj.png" class="zoom" />
      <img src="static/image/common/logo.png" alt="decorative" />
      <img src="https://www.gamemale.com/template/mwt2/extend/img/logo.png" />
      <img src="https://www.gamemale.com/static/image/smiley/default/titter.gif" />
      <img data-src="https://img.gamemale.com/forum/202610/02/132501trjtnpermyv7m4vj.png" src="data:image/gif;base64,R0lGOD" />
    </td></tr></table></div>
  </div>`

/** Install a fixture body and return the live document. */
function page(html: string = DISCUZ_HTML) {
  document.body.innerHTML = html
  return document
}

describe('browser_images limit normalization', () => {
  it('defaults, clamps, and rejects limits', () => {
    expect(normalizeImageLimit(undefined)).toBe(DEFAULT_IMAGE_LIMIT)
    expect(normalizeImageLimit(5)).toBe(5)
    expect(normalizeImageLimit(MAX_IMAGE_LIMIT + 500)).toBe(MAX_IMAGE_LIMIT)
    expect(normalizeImageLimit(0)).toBeUndefined()
    expect(normalizeImageLimit(-3)).toBeUndefined()
    expect(normalizeImageLimit(2.5)).toBeUndefined()
    expect(normalizeImageLimit('10')).toBeUndefined()
  })
})

describe('browser_images collection', () => {
  it('defaults to the post body so sidebar credit icons never crowd the listing', () => {
    const scan = collectPageImages(page(), {})
    expect(scan.scope).toBe('.pcb')
    expect(scan.images.map((image) => image.url)).toEqual([
      'https://img.gamemale.com/forum/202610/02/131605zhuv8vy91u7czhrb.png',
      'https://img.gamemale.com/forum/202610/02/132501trjtnpermyv7m4vj.png',
    ])
  })

  it('reads the real address out of zoomfile and flags the lazily swapped placeholder', () => {
    const [first] = collectPageImages(page(), {}).images
    expect(first).toMatchObject({
      url: 'https://img.gamemale.com/forum/202610/02/131605zhuv8vy91u7czhrb.png',
      source: 'zoomfile',
      alt: '',
      width: 372,
      lazy: true,
      placeholder: true,
    })
    // No height attribute and no intrinsic size in this environment: reported
    // as unknown rather than invented.
    expect(first?.height).toBeUndefined()
  })

  it('filters placeholders, template chrome, smilies, and data URIs at any scope', () => {
    const scan = collectPageImages(page(), { selector: 'body' })
    expect(scan.images.map((image) => image.url)).not.toContain('https://www.gamemale.com/static/image/common/logo.png')
    expect(scan.images.map((image) => image.url)).not.toContain('https://www.gamemale.com/template/mwt2/extend/img/logo.png')
    expect(scan.images.map((image) => image.url)).not.toContain('https://www.gamemale.com/static/image/smiley/default/titter.gif')
    expect(scan.images.map((image) => image.url)).not.toContain('https://www.gamemale.com/uc_server/avatar.php?uid=742147&size=middle')
    expect(scan.decorativeSkipped).toBeGreaterThan(0)
  })

  it('falls through a placeholder src to a data-src address and de-duplicates repeats', () => {
    const scan = collectPageImages(page(), { selector: 'body' })
    const target = 'https://img.gamemale.com/forum/202610/02/132501trjtnpermyv7m4vj.png'
    expect(scan.images.filter((image) => image.url === target)).toHaveLength(1)
    // Whichever element won, the placeholder `src` was skipped in favour of data-src.
    const match = scan.images.find((image) => image.url === target)
    expect(['zoomfile', 'file', 'data-src']).toContain(match?.source)
  })

  it('keeps a whole-document scan complete rather than guessing from rendered size', () => {
    const scan = collectPageImages(page(), { selector: 'body' })
    // Both sidebar credit icons survive: they are real CDN URLs and only the
    // default content scope — not a size heuristic — excludes them.
    expect(scan.images.map((image) => image.url)).toContain('https://img.gamemale.com/album/201404/12/023039r465s6wuz65a5sx4.jpg')
  })

  it('honours limit and reports what was withheld', () => {
    const scan = collectPageImages(page(), { selector: 'body', limit: 1 })
    expect(scan.images).toHaveLength(1)
    expect(scan.total).toBeGreaterThan(1)
    expect(renderImageScan(scan)).toContain('raise limit')
  })

  it('returns an empty listing for a page with no content images', () => {
    const scan = collectPageImages(page('<p>no images here</p>'), {})
    expect(scan.scope).toBe('body')
    expect(scan.images).toEqual([])
    expect(renderImageScan(scan)).toContain('No content image address was found')
  })

  it('reports an unusable selector as an error instead of throwing', () => {
    expect(collectPageImages(page(), { selector: 'td[' }).error).toContain('not a valid CSS selector')
    expect(collectPageImages(page(), { selector: '.missing' }).error).toContain('No element matched selector')
  })
})

describe('browser_images rendering', () => {
  it('renders one compact line per image with dimensions, alt, and flags', () => {
    const scan = collectPageImages(page(), {})
    const lines = renderImageScan(scan).split('\n')
    expect(lines[0]).toMatch(/^Image addresses \(scope: \.pcb; 2 found, \d+ placeholder\/decorative skipped\)\.$/)
    expect(lines[1]).toBe('1. https://img.gamemale.com/forum/202610/02/131605zhuv8vy91u7czhrb.png | 372x? | lazy+placeholder')
    expect(lines[2]).toBe('2. https://img.gamemale.com/forum/202610/02/132501trjtnpermyv7m4vj.png | lazy+placeholder')
  })

  it('stays cheap: a page of images renders as short text, never DOM or base64', () => {
    const rendered = renderImageScan(collectPageImages(page(), { selector: 'body' }))
    expect(rendered).not.toContain('base64')
    expect(rendered).not.toContain('<img')
    expect(rendered.length).toBeLessThan(1_200)
  })
})
