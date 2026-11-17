// BLUECORE: tests for the Blue Core header and footer preferences and layout, and for how
// ../views/install.js adds bluecore-stack's <bluecore-header> / <bluecore-footer> elements to
// Marva without changing the LC components. The elements themselves are tested in
// bluecore-stack (tests/ui/marva/test_login_page.py).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h, nextTick } from 'vue'
import {
  BLUECORE_HEADER_FOOTER_HEIGHTS,
  PREF_HIDDEN,
  PREF_SLIM,
  addBluecorePreferences,
  rescaleWindowPercentToViewArea,
  returnBluecoreHeaderFooterHeights,
  returnBluecoreHeaderFooterMode,
} from '@/bluecore/layout'
import {
  HEADER_FOOTER_SCRIPT,
  createRescaleMixin,
  installBluecoreHeaderFooter,
  loadHeaderFooterScript,
} from '@/bluecore/views/install'
import { useConfigStore } from '@/stores/config'
import { usePreferenceStore } from '@/stores/preference'

let pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

afterEach(() => {
  document.head.querySelectorAll('script').forEach((script) => script.remove())
})

// jsdom doesn't fetch scripts, so the tests fire the script's load or error event themselves
function findScript() {
  return document.head.querySelector(`script[src="${HEADER_FOOTER_SCRIPT}"]`)
}

async function finishLoading(eventName = 'load') {
  findScript().dispatchEvent(new Event(eventName))
  // let the load promise resolve and the watchers run
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe('loadHeaderFooterScript', () => {
  it('adds the stack script and resolves true once it loads', async () => {
    const result = loadHeaderFooterScript()
    expect(findScript()).not.toBeNull()
    findScript().dispatchEvent(new Event('load'))
    await expect(result).resolves.toBe(true)
  })

  it('resolves false when the script is not there (Marva without the stack)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = loadHeaderFooterScript()
    findScript().dispatchEvent(new Event('error'))
    await expect(result).resolves.toBe(false)
    warn.mockRestore()
  })
})

describe('layout helpers', () => {
  it('gives the same heights as the stack draws the header and footer at', () => {
    // bluecore-stack nginx/assets/bluecore/bluecore-header-footer.js SIZES
    expect(returnBluecoreHeaderFooterHeights('full')).toEqual({ header: 57, footer: 157 })
    expect(returnBluecoreHeaderFooterHeights('slim')).toEqual({ header: 23, footer: 23 })
  })

  it('gives no height when hidden, and full heights for an unknown mode', () => {
    expect(returnBluecoreHeaderFooterHeights('hidden')).toEqual({ header: 0, footer: 0 })
    expect(returnBluecoreHeaderFooterHeights('tiny')).toEqual(BLUECORE_HEADER_FOOTER_HEIGHTS.full)
  })

  it('adds the Blue Core preferences once, keeping a saved value', () => {
    const preferenceStore = usePreferenceStore()
    addBluecorePreferences(preferenceStore)
    expect(preferenceStore.styleDefault[PREF_SLIM]).toMatchObject({ type: 'boolean', value: false, group: 'Blue Core' })
    expect(preferenceStore.styleDefault[PREF_HIDDEN]).toMatchObject({ type: 'boolean', value: false, group: 'Blue Core' })

    preferenceStore.styleDefault[PREF_SLIM].value = true
    addBluecorePreferences(preferenceStore)
    expect(preferenceStore.styleDefault[PREF_SLIM].value).toBe(true)
  })

  it('works out the mode from the preferences, hide winning over slim', () => {
    const preferenceStore = usePreferenceStore()
    addBluecorePreferences(preferenceStore)
    expect(returnBluecoreHeaderFooterMode(preferenceStore)).toBe('full')
    preferenceStore.setValue(PREF_SLIM, true)
    expect(returnBluecoreHeaderFooterMode(preferenceStore)).toBe('slim')
    preferenceStore.setValue(PREF_HIDDEN, true)
    expect(returnBluecoreHeaderFooterMode(preferenceStore)).toBe('hidden')
  })

  it('keeps saved Blue Core preferences when the LC store loads saved prefs', () => {
    const preferenceStore = usePreferenceStore()
    addBluecorePreferences(preferenceStore)
    const saved = JSON.parse(JSON.stringify({ styleDefault: preferenceStore.styleDefault, panelDisplay: preferenceStore.panelDisplay }))
    saved.styleDefault[PREF_HIDDEN].value = true
    preferenceStore.loadPreferences(saved)
    expect(returnBluecoreHeaderFooterMode(preferenceStore)).toBe('hidden')
  })

  it('rescales a percent of the window to a percent of the view area', () => {
    // 35px of a 1000px window is 3.5%; of the 800px left after 200px of header/footer it is 4.375%
    expect(rescaleWindowPercentToViewArea(3.5, 1000, 200)).toBeCloseTo(4.375)
    expect(rescaleWindowPercentToViewArea(3.5, 1000, 0)).toBe(3.5)
    // nothing sensible to scale to, leave it alone
    expect(rescaleWindowPercentToViewArea(3.5, 1000, 1000)).toBe(3.5)
  })
})

describe('createRescaleMixin', () => {
  // like the LC views: returnPixleAsPercent measures against window.innerHeight
  const lcMethod = function (pixles) { return pixles / window.innerHeight * 100 }

  function mountWithRescale(component, taken) {
    const mixin = createRescaleMixin(() => taken)
    return mount(component, { global: { mixins: [mixin] } })
  }

  it("rescales a view's own returnPixleAsPercent to the view area", () => {
    const View = defineComponent({ methods: { returnPixleAsPercent: lcMethod }, render: () => h('div') })
    const wrapper = mountWithRescale(View, 200)
    expect(wrapper.vm.returnPixleAsPercent(35)).toBeCloseTo(35 / (window.innerHeight - 200) * 100)
  })

  it('rescales one that comes from a mixin, and keeps extra logic such as copy mode', () => {
    const navMixin = { methods: { returnPixleAsPercent(pixles) { return pixles / window.innerHeight * (this.copyMode ? 200 : 100) } } }
    const View = defineComponent({ mixins: [navMixin], data: () => ({ copyMode: true }), render: () => h('div') })
    const wrapper = mountWithRescale(View, 200)
    expect(wrapper.vm.returnPixleAsPercent(35)).toBeCloseTo(35 / (window.innerHeight - 200) * 200)
  })

  it('only wraps once, however many times the component is created', () => {
    const View = defineComponent({ methods: { returnPixleAsPercent: lcMethod }, render: () => h('div') })
    mountWithRescale(View, 200)
    const wrapper = mountWithRescale(View, 200)
    expect(wrapper.vm.returnPixleAsPercent(35)).toBeCloseTo(35 / (window.innerHeight - 200) * 100)
  })

  it('leaves components without returnPixleAsPercent alone', () => {
    const Other = defineComponent({ methods: { hello: () => 'hi' }, render: () => h('div') })
    expect(mountWithRescale(Other, 200).vm.hello()).toBe('hi')
  })
})

describe('installBluecoreHeaderFooter', () => {
  let appEl
  let app

  beforeEach(() => {
    appEl = document.createElement('div')
    appEl.id = 'app'
    document.body.appendChild(appEl)
  })

  afterEach(() => {
    app?.unmount()
    document.body.innerHTML = ''
    document.documentElement.style.removeProperty('--bluecore-header-height')
  })

  async function installAndMount() {
    app = createApp({ render: () => h('div', { class: 'marva' }) })
    app.use(pinia)
    installBluecoreHeaderFooter(app)
    app.mount(appEl)
    await nextTick()
    return usePreferenceStore(pinia)
  }

  const header = () => document.querySelector('bluecore-header')
  const footer = () => document.querySelector('bluecore-footer')

  it('keeps no room for them until the stack script has loaded', async () => {
    await installAndMount()
    expect(findScript()).not.toBeNull()
    expect(header()).toBeNull()
    expect(appEl.style.height).toBe('calc(100vh - 0px)')
  })

  it('puts the header above #app and the footer below once loaded, and makes room for them', async () => {
    await installAndMount()
    await finishLoading()
    expect(appEl.previousElementSibling).toBe(header())
    expect(appEl.nextElementSibling).toBe(footer())
    expect(header().getAttribute('app-name')).toBe('MARVA')
    expect(header().getAttribute('current-app')).toBe('marva')
    const { header: headerHeight, footer: footerHeight } = BLUECORE_HEADER_FOOTER_HEIGHTS.full
    expect(appEl.style.height).toBe(`calc(100vh - ${headerHeight + footerHeight}px)`)
    expect(document.documentElement.style.getPropertyValue('--bluecore-header-height')).toBe(`${headerHeight}px`)
  })

  it('shows neither, and takes the whole window, when the script fails to load', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await installAndMount()
    await finishLoading('error')
    expect(header()).toBeNull()
    expect(footer()).toBeNull()
    expect(appEl.style.height).toBe('calc(100vh - 0px)')
    warn.mockRestore()
  })

  it('follows the slim and hide preferences', async () => {
    const preferenceStore = await installAndMount()
    await finishLoading()
    expect(header().hasAttribute('slim')).toBe(false)

    preferenceStore.setValue(PREF_SLIM, true)
    await nextTick()
    expect(header().hasAttribute('slim')).toBe(true)
    expect(footer().hasAttribute('slim')).toBe(true)
    const slim = BLUECORE_HEADER_FOOTER_HEIGHTS.slim
    expect(appEl.style.height).toBe(`calc(100vh - ${slim.header + slim.footer}px)`)

    preferenceStore.setValue(PREF_HIDDEN, true)
    await nextTick()
    expect(header()).toBeNull()
    expect(footer()).toBeNull()
    expect(appEl.style.height).toBe('calc(100vh - 0px)')

    preferenceStore.setValue(PREF_HIDDEN, false)
    await nextTick()
    expect(appEl.previousElementSibling).toBe(header())
    expect(appEl.nextElementSibling).toBe(footer())
  })

  it('only offers Logout to a signed in user, and logs out through the util service', async () => {
    const preferenceStore = await installAndMount()
    await finishLoading()
    expect(header().hasAttribute('logout')).toBe(false)

    preferenceStore.ssoUser = { name: 'Test User' }
    await nextTick()
    expect(header().hasAttribute('logout')).toBe(true)

    const logoutSpy = vi.spyOn(preferenceStore, 'ssoLogout').mockImplementation(() => {})
    header().dispatchEvent(new CustomEvent('bluecore-logout', { bubbles: true }))
    expect(logoutSpy).toHaveBeenCalledWith(useConfigStore(pinia).returnUrls.util)
  })

  it('adds the Blue Core preferences before the app loads saved ones', async () => {
    const preferenceStore = await installAndMount()
    expect(preferenceStore.styleDefault[PREF_SLIM]).toBeDefined()
    expect(preferenceStore.styleDefault[PREF_HIDDEN]).toBeDefined()
  })
})
