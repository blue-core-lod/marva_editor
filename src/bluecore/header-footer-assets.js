// BLUECORE: loads the shared Blue Core header and footer (from bluecore-stack) in
// Marva's <head>, so they're ready when Marva first draws instead of popping in
// after the page loads.
//
// A Vite plugin, not plain tags in index.html: Vite would rewrite these paths
// to /marva/assets/..., but they're served by bluecore-stack at /assets/...
// This adds them after Vite's own rewriting, in dev and in the build.
// Without the stack they're missing, and Marva shows no header or footer
// (see views/install.js).
//
// Runs in Node (loaded by vite.config.js); install.js reuses the paths.

export const HEADER_FOOTER_SCRIPT = '/assets/bluecore/bluecore-header-footer.js'
export const HEADER_FOOTER_STYLESHEET = '/assets/bluecore/bluecore-header-footer.css'

/** The <head> tags: the stylesheet first, then the script (no defer) */
export function headerFooterTags() {
  return [
    {
      tag: 'link',
      attrs: { rel: 'stylesheet', href: HEADER_FOOTER_STYLESHEET, 'data-bluecore-header-footer': true },
      injectTo: 'head',
    },
    { tag: 'script', attrs: { src: HEADER_FOOTER_SCRIPT }, injectTo: 'head' },
  ]
}

export function bluecoreHeaderFooterAssets() {
  return {
    name: 'bluecore-header-footer-assets',
    transformIndexHtml: { order: 'post', handler: () => headerFooterTags() },
  }
}
