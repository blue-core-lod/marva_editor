// #############################################################################
// ###################  Blue Core Header / Footer Install  ######################
// ##                                                                         ##
// ## Adds the Blue Core header and footer to Marva without changing the LC   ##
// ## components. They are the <bluecore-header> / <bluecore-footer> elements ##
// ## served by bluecore-stack (HEADER_FOOTER_SCRIPT), the same ones the      ##
// ## Marva login page and the DCTap Dancer use, so there is one copy for     ##
// ## every Blue Core app. main.js calls installBluecoreHeaderFooter(app)     ##
// ## once, after pinia is installed and before the app mounts. It:          ##
// ##  1. adds the Blue Core preferences (Preferences > Blue Core),           ##
// ##  2. once Marva has mounted, loads the stack's script and puts the       ##
// ##     header above #app and the footer below it, following the slim and  ##
// ##     hide preferences, with Logout for a signed-in user,                 ##
// ##  3. shrinks #app and moves the nav bar (teleported to body) down by     ##
// ##     the header and footer heights,                                      ##
// ##  4. rescales the LC views' returnPixleAsPercent(), which measures the   ##
// ##     nav pane against the whole window, to measure against the view     ##
// ##     area instead.                                                       ##
// ## Without the stack (e.g. Marva on its own) the script isn't there, and   ##
// ## Marva shows no header or footer and takes the whole window.            ##
// #############################################################################

import { computed, ref, watchEffect } from 'vue'
import { usePreferenceStore } from '@/stores/preference'
import { useConfigStore } from '@/stores/config'
import {
  addBluecorePreferences,
  returnBluecoreHeaderFooterMode,
  returnBluecoreHeaderFooterHeights,
  rescaleWindowPercentToViewArea,
} from '@/bluecore/layout'
import '@/bluecore/styles/bluecore-layout.css'

// served by bluecore-stack (nginx/assets/bluecore/), on the same host as Marva
export const HEADER_FOOTER_SCRIPT = '/assets/bluecore/bluecore-header-footer.js'

const PATCHED = Symbol('bluecoreRescaled')

/**
* Global mixin: wraps a component's returnPixleAsPercent() (the LC views define it, or get it
* from a mixin) so its result is rescaled to the view area. Changing the merged options in
* beforeCreate works because Vue reads `methods` from them after beforeCreate runs.
* @param {function} takenHeight - returns the pixels taken by header, MOTD banner and footer
* @return {object}
*/
export function createRescaleMixin(takenHeight) {
  return {
    beforeCreate() {
      const methods = this.$options.methods
      const original = methods && methods.returnPixleAsPercent
      if (typeof original !== 'function' || original[PATCHED]) { return }
      const rescaled = function (...args) {
        return rescaleWindowPercentToViewArea(original.apply(this, args), window.innerHeight, takenHeight())
      }
      rescaled[PATCHED] = true
      methods.returnPixleAsPercent = rescaled
    },
  }
}

/**
* Loads the stack's header / footer script once.
* @param {string} src
* @return {Promise<boolean>} - true once the elements are defined, false if the script failed to load
*/
export function loadHeaderFooterScript(src = HEADER_FOOTER_SCRIPT) {
  if (window.customElements && window.customElements.get('bluecore-header')) {
    return Promise.resolve(true)
  }
  return new Promise((resolve) => {
    const script = document.createElement('script')
    script.src = src
    script.addEventListener('load', () => resolve(true))
    script.addEventListener('error', () => {
      console.warn(`Blue Core header and footer not loaded (${src})`)
      resolve(false)
    })
    document.head.appendChild(script)
  })
}

/**
* @param {object} app - the Marva Vue app, with pinia already installed
*/
export function installBluecoreHeaderFooter(app) {
  const pinia = app.config.globalProperties.$pinia
  const preferenceStore = usePreferenceStore(pinia)
  const configStore = useConfigStore(pinia)

  addBluecorePreferences(preferenceStore)

  // no room is kept for the header and footer until the stack's script has loaded
  const loaded = ref(false)
  const mode = computed(() => (loaded.value ? returnBluecoreHeaderFooterMode(preferenceStore) : 'hidden'))
  const heights = computed(() => returnBluecoreHeaderFooterHeights(mode.value))
  const takenHeight = () => heights.value.header + heights.value.footer + (configStore.motdHeight || 0)

  app.mixin(createRescaleMixin(takenHeight))

  // header and footer go in once Marva has mounted (it doesn't when redirecting to SSO)
  let installed = false
  app.mixin({
    mounted() {
      if (installed || this.$root !== this) { return }
      const appEl = this.$el && this.$el.parentElement && this.$el.parentElement.id === 'app'
        ? this.$el.parentElement
        : document.getElementById('app')
      if (!appEl) { return }
      installed = true

      watchEffect(() => {
        const { header, footer } = heights.value
        // #app is 100vh in main.css; leave room for the header and footer
        appEl.style.height = `calc(100vh - ${header + footer}px)`
        // used by styles/bluecore-layout.css to move the nav bar below the header
        document.documentElement.style.setProperty('--bluecore-header-height', `${header}px`)
      })

      loadHeaderFooterScript().then((ok) => {
        if (!ok) { return }
        const header = document.createElement('bluecore-header')
        header.setAttribute('app-name', 'MARVA')
        header.setAttribute('current-app', 'marva')
        header.addEventListener('bluecore-logout', () => {
          preferenceStore.ssoLogout(configStore.returnUrls.util)
        })
        const footer = document.createElement('bluecore-footer')

        watchEffect(() => {
          if (mode.value === 'hidden') {
            header.remove()
            footer.remove()
            return
          }
          const slim = mode.value === 'slim'
          header.toggleAttribute('slim', slim)
          footer.toggleAttribute('slim', slim)
          header.toggleAttribute('logout', Boolean(preferenceStore.ssoUser))
          if (!header.isConnected) { appEl.before(header) }
          if (!footer.isConnected) { appEl.after(footer) }
        })
        loaded.value = true
      })
    },
  })
}
