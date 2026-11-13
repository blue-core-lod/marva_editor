// #############################################################################
// ###################  Blue Core Header / Footer Install  ######################
// ##                                                                         ##
// ## Adds the Blue Core header and footer to Marva without changing the LC   ##
// ## components. main.js calls installBluecoreHeaderFooter(app) once, after  ##
// ## pinia is installed and before the app mounts. It:                      ##
// ##  1. adds the Blue Core preferences (Preferences > Blue Core),           ##
// ##  2. mounts the header above #app and the footer below it, as small Vue  ##
// ##     apps sharing Marva's pinia, once Marva itself has mounted,          ##
// ##  3. shrinks #app and moves the nav bar (teleported to body) down by     ##
// ##     the header and footer heights,                                      ##
// ##  4. rescales the LC views' returnPixleAsPercent(), which measures the   ##
// ##     nav pane against the whole window, to measure against the view     ##
// ##     area instead.                                                       ##
// #############################################################################

import { computed, createApp, h, watchEffect } from 'vue'
import { usePreferenceStore } from '@/stores/preference'
import { useConfigStore } from '@/stores/config'
import BluecoreHeader from '@/bluecore/views/BluecoreHeader.vue'
import BluecoreFooter from '@/bluecore/views/BluecoreFooter.vue'
import {
  addBluecorePreferences,
  returnBluecoreHeaderFooterMode,
  returnBluecoreHeaderFooterHeights,
  rescaleWindowPercentToViewArea,
} from '@/bluecore/layout'
import '@/bluecore/views/layout.css'

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

function mountBeside(appEl, position, component, pinia, props) {
  const host = document.createElement('div')
  host.className = 'bluecore-chrome-host'
  appEl.insertAdjacentElement(position, host)
  const chromeApp = createApp({ render: () => (props.value ? h(component, props.value) : null) })
  chromeApp.use(pinia)
  chromeApp.mount(host)
  return chromeApp
}

/**
* @param {object} app - the Marva Vue app, with pinia already installed
*/
export function installBluecoreHeaderFooter(app) {
  const pinia = app.config.globalProperties.$pinia
  const preferenceStore = usePreferenceStore(pinia)
  const configStore = useConfigStore(pinia)

  addBluecorePreferences(preferenceStore)

  const mode = computed(() => returnBluecoreHeaderFooterMode(preferenceStore))
  const heights = computed(() => returnBluecoreHeaderFooterHeights(mode.value))
  // the component props for header and footer, null when hidden
  const chromeProps = computed(() => (mode.value === 'hidden' ? null : { slim: mode.value === 'slim' }))
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
      mountBeside(appEl, 'beforebegin', BluecoreHeader, pinia, chromeProps)
      mountBeside(appEl, 'afterend', BluecoreFooter, pinia, chromeProps)
      watchEffect(() => {
        const { header, footer } = heights.value
        // #app is 100vh in main.css; leave room for the header and footer
        appEl.style.height = `calc(100vh - ${header + footer}px)`
        // used by layout.css to move the nav bar below the header
        document.documentElement.style.setProperty('--bluecore-header-height', `${header}px`)
      })
    },
  })
}
