// BLUECORE: tests for ../header-footer-assets.js, the Vite plugin that loads the
// shared header and footer in Marva's <head>
import { describe, it, expect } from 'vitest'
import {
  HEADER_FOOTER_SCRIPT,
  HEADER_FOOTER_STYLESHEET,
  bluecoreHeaderFooterAssets,
  headerFooterTags,
} from '@/bluecore/header-footer-assets'

describe('bluecoreHeaderFooterAssets', () => {
  it('adds the stylesheet, then the script, to <head>', () => {
    const [link, script] = headerFooterTags()
    expect(link).toMatchObject({ tag: 'link', injectTo: 'head' })
    expect(link.attrs).toMatchObject({ rel: 'stylesheet', href: HEADER_FOOTER_STYLESHEET })
    expect(script).toEqual({ tag: 'script', attrs: { src: HEADER_FOOTER_SCRIPT }, injectTo: 'head' })
  })

  it('uses the paths bluecore-stack serves, not under /marva/', () => {
    expect(HEADER_FOOTER_SCRIPT).toBe('/assets/bluecore/bluecore-header-footer.js')
    expect(HEADER_FOOTER_STYLESHEET).toBe('/assets/bluecore/bluecore-header-footer.css')
  })

  it("runs after Vite's own index.html changes, so they keep those paths", () => {
    const plugin = bluecoreHeaderFooterAssets()
    expect(plugin.transformIndexHtml.order).toBe('post')
    expect(plugin.transformIndexHtml.handler()).toEqual(headerFooterTags())
  })
})
