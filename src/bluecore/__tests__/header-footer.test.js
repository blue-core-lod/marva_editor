// BLUECORE: tests for the Blue Core header and footer, their preferences, and how they are
// added to Marva without changing the LC components (../views/install.js)
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createApp, defineComponent, h, nextTick } from 'vue'
import BluecoreHeader from '@/bluecore/views/BluecoreHeader.vue'
import BluecoreFooter from '@/bluecore/views/BluecoreFooter.vue'
import { BLUECORE_APPS, BLUECORE_CONTACT_URL, CURRENT_APP_ID } from '@/bluecore/apps'
import {
  BLUECORE_HEADER_FOOTER_HEIGHTS,
  PREF_HIDDEN,
  PREF_SLIM,
  addBluecorePreferences,
  rescaleWindowPercentToViewArea,
  returnBluecoreHeaderFooterHeights,
  returnBluecoreHeaderFooterMode,
} from '@/bluecore/layout'
import { createRescaleMixin, installBluecoreHeaderFooter } from '@/bluecore/views/install'
import { useConfigStore } from '@/stores/config'
import { usePreferenceStore } from '@/stores/preference'

let pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
})

function mountWithPinia(component, props = {}) {
  return mount(component, { props, global: { plugins: [pinia] }, attachTo: document.body })
}

describe('BluecoreHeader', () => {
  it('shows the app name and a contact link', () => {
    const wrapper = mountWithPinia(BluecoreHeader)
    expect(wrapper.find('.bluecore-header-app-name').text()).toContain('MARVA')
    expect(wrapper.find(`a[href="${BLUECORE_CONTACT_URL}"]`).text()).toBe('Contact')
    wrapper.unmount()
  })

  it('opens the app menu with every app except Marva, and closes it on Escape', async () => {
    const wrapper = mountWithPinia(BluecoreHeader)
    const button = wrapper.find('.bluecore-app-switcher-button')
    const menu = wrapper.find('#bluecore-app-menu')
    expect(menu.isVisible()).toBe(false)

    await button.trigger('click')
    expect(menu.isVisible()).toBe(true)
    expect(button.attributes('aria-expanded')).toBe('true')
    const labels = menu.findAll('a').map((a) => a.text())
    expect(labels).toEqual(BLUECORE_APPS.filter((a) => a.id !== CURRENT_APP_ID).map((a) => a.label))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()
    expect(menu.isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('closes the app menu on a click outside it', async () => {
    const wrapper = mountWithPinia(BluecoreHeader)
    await wrapper.find('.bluecore-app-switcher-button').trigger('click')
    document.body.click()
    await nextTick()
    expect(wrapper.find('#bluecore-app-menu').isVisible()).toBe(false)
    wrapper.unmount()
  })

  it('only shows Logout for a signed in user, and logs out through the util service', async () => {
    const wrapper = mountWithPinia(BluecoreHeader)
    const preferenceStore = usePreferenceStore()
    const configStore = useConfigStore()
    const findLogout = () => wrapper.findAll('button').find((b) => b.text() === 'Logout')
    expect(findLogout()).toBeUndefined()

    preferenceStore.ssoUser = { name: 'Test User' }
    await nextTick()
    const logoutSpy = vi.spyOn(preferenceStore, 'ssoLogout').mockImplementation(() => {})
    await findLogout().trigger('click')
    expect(logoutSpy).toHaveBeenCalledWith(configStore.returnUrls.util)
    wrapper.unmount()
  })
})

describe('BluecoreFooter', () => {
  it('links to every Blue Core app and the contact address', () => {
    const wrapper = mountWithPinia(BluecoreFooter)
    const links = wrapper.findAll('.bluecore-footer-app-list a')
    expect(links.map((a) => [a.text(), a.attributes('href')])).toEqual(BLUECORE_APPS.map((a) => [a.label, a.href]))
    expect(wrapper.find('.bluecore-footer-contact').attributes('href')).toBe(BLUECORE_CONTACT_URL)
    wrapper.unmount()
  })
})

describe('slim versions', () => {
  it('header and footer add their slim class only when slim is set', () => {
    for (const component of [BluecoreHeader, BluecoreFooter]) {
      const full = mountWithPinia(component)
      const slim = mountWithPinia(component, { slim: true })
      expect(full.classes().some((c) => c.endsWith('-slim'))).toBe(false)
      expect(slim.classes().some((c) => c.endsWith('-slim'))).toBe(true)
      full.unmount()
      slim.unmount()
    }
  })

  it('sizes header and footer from the shared layout heights for each mode', () => {
    for (const mode of ['full', 'slim']) {
      const heights = returnBluecoreHeaderFooterHeights(mode)
      const header = mountWithPinia(BluecoreHeader, { slim: mode === 'slim' })
      const footer = mountWithPinia(BluecoreFooter, { slim: mode === 'slim' })
      // heightPx is what v-bind() in each component's <style> uses for its CSS height
      expect(header.vm.heightPx).toBe(`${heights.header}px`)
      expect(footer.vm.heightPx).toBe(`${heights.footer}px`)
      header.unmount()
      footer.unmount()
    }
  })
})

describe('layout helpers', () => {
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

  it('puts the header above #app and the footer below, and makes room for them', async () => {
    await installAndMount()
    expect(appEl.previousElementSibling.querySelector('.bluecore-header')).not.toBeNull()
    expect(appEl.nextElementSibling.querySelector('.bluecore-footer')).not.toBeNull()
    const { header, footer } = BLUECORE_HEADER_FOOTER_HEIGHTS.full
    expect(appEl.style.height).toBe(`calc(100vh - ${header + footer}px)`)
    expect(document.documentElement.style.getPropertyValue('--bluecore-header-height')).toBe(`${header}px`)
  })

  it('follows the slim and hide preferences', async () => {
    const preferenceStore = await installAndMount()

    preferenceStore.setValue(PREF_SLIM, true)
    await nextTick()
    expect(document.querySelector('.bluecore-header-slim')).not.toBeNull()
    expect(document.querySelector('.bluecore-footer-slim')).not.toBeNull()
    const slim = BLUECORE_HEADER_FOOTER_HEIGHTS.slim
    expect(appEl.style.height).toBe(`calc(100vh - ${slim.header + slim.footer}px)`)

    preferenceStore.setValue(PREF_HIDDEN, true)
    await nextTick()
    expect(document.querySelector('.bluecore-header')).toBeNull()
    expect(document.querySelector('.bluecore-footer')).toBeNull()
    expect(appEl.style.height).toBe('calc(100vh - 0px)')
    expect(document.documentElement.style.getPropertyValue('--bluecore-header-height')).toBe('0px')
  })

  it('adds the Blue Core preferences before the app loads saved ones', async () => {
    const preferenceStore = await installAndMount()
    expect(preferenceStore.styleDefault[PREF_SLIM]).toBeDefined()
    expect(preferenceStore.styleDefault[PREF_HIDDEN]).toBeDefined()
  })
})
