// #############################################################################
// ##################  Blue Core Save Dropdown Install  ########################
// ##                                                                         ##
// ## Puts the "Save" dropdown (see ../save-menu.js) in the LC nav without    ##
// ## changing Nav.vue. main.js calls installBluecoreSaveMenu(app) once,      ##
// ## after pinia is installed. It:                                           ##
// ##  1. follows the profile store's save and post actions,                  ##
// ##  2. adds a global mixin that wraps the Nav's fitNavMenu(menu) (which    ##
// ##     every nav menu passes through before it's drawn) so the save       ##
// ##     buttons are grouped first,                                          ##
// ##  3. ticks a clock every 30s so "2 min ago" stays current,              ##
// ##  4. makes LC's publish save to Blue Core's API (see ../publish.js).     ##
// #############################################################################

import { ref, watch } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { useConfigStore } from '@/stores/config'
import utilsNetwork from '@/lib/utils_network'
import { applyBluecoreResourceLinks, installBluecorePublish } from '@/bluecore/publish'
import { getBluecoreInstanceUri } from '@/bluecore/export'
import {
  SAVE_MENU_ID,
  groupSaveMenu,
  resetSaveStatus,
  returnSaveSummary,
  saveStatus,
  trackProfileStore,
} from '@/bluecore/save-menu'
import { showToast } from '@/bluecore/views/toast'
import { BluecorePublishedIcon, BluecoreUnpublishedIcon } from '@/bluecore/views/bluecore-icon'
import { createBluestoreChecker } from '@/bluecore/bluestore'
import '@/bluecore/styles/bluecore-save-menu.css'

const PATCHED = Symbol('bluecoreSaveMenu')
const TICK_MS = 30000

// read by the wrapped fitNavMenu, so the nav redraws when it changes
export const now = ref(Date.now())

/** Pops the dropdown button when one of its actions starts. */
export function pulseSaveMenu() {
  const button = document.getElementById(SAVE_MENU_ID)
  if (button && button.animate) {
    button.animate(
      [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(0.98)' }, { transform: 'scale(1)' }],
      { duration: 350, easing: 'ease' },
    )
  }
}

/**
* Global mixin: wraps a component's fitNavMenu() (only the LC Nav has one) so the save items
* are grouped before the LC code lays out the nav.
* @param {function} returnOptions - returns the groupSaveMenu options for the current state
* @return {object}
*/
export function createSaveMenuMixin(returnOptions) {
  return {
    beforeCreate() {
      const methods = this.$options.methods
      const original = methods && methods.fitNavMenu
      if (typeof original !== 'function' || original[PATCHED]) { return }
      const wrapped = function (menu, ...args) {
        return original.call(this, groupSaveMenu(menu, returnOptions()), ...args)
      }
      wrapped[PATCHED] = true
      methods.fitNavMenu = wrapped
    },
  }
}

/**
* @param {object} app - the Marva Vue app, with pinia already installed
*/
export function installBluecoreSaveMenu(app) {
  const pinia = app.config.globalProperties.$pinia
  const profileStore = useProfileStore(pinia)
  const configStore = useConfigStore(pinia)

  // publish straight to the Blue Core API, which says at once whether it worked. The open
  // record is saved as a draft first, so the edits are kept even if the publish fails (Hub
  // stubs made from the editor are published under their own eid, and aren't saved)
  installBluecorePublish(utilsNetwork, () => configStore.returnUrls, (eid) => {
    const profile = profileStore.activeProfile
    if (profile && profile.eId === eid) { return profileStore.saveRecord() }
  })
  // the publish window links to the Work and Instance Blue Core saved (this runs before the
  // window gets the result)
  profileStore.$onAction(({ name, after }) => {
    if (name === 'publishRecord') { after(applyBluecoreResourceLinks) }
  })

  // whether (and when) the open record is in the Blue Core store
  const checkBluestore = createBluestoreChecker({ status: saveStatus, returnProfile: () => profileStore.activeProfile })

  trackProfileStore(profileStore, {
    // the API has saved the record by the time the publish returns, so one check shows it
    onPublished: () => checkBluestore(),
    onRecordLoaded: (eId) => {
      resetSaveStatus(saveStatus, eId)
      checkBluestore()
    },
    onManualSave: (ok) => showToast(ok
      ? { message: 'Draft saved', detail: 'Publish to Blue Core when it is ready to share.', kind: 'success', timeout: 3000 }
      : { message: 'Draft not saved', detail: 'Your changes were not saved, try again.', kind: 'error' }),
  })

  // save and post times belong to the open record: restore its saved times when it opens.
  // Reopening the same record keeps its eId, so onRecordLoaded above covers that case
  watch(
    () => profileStore.activeProfile && profileStore.activeProfile.eId,
    (eId) => {
      resetSaveStatus(saveStatus, eId)
      if (eId) { checkBluestore() }
    },
    { immediate: true },
  )

  window.setInterval(() => { now.value = Date.now() }, TICK_MS)

  const returnOptions = () => {
    const profile = profileStore.activeProfile || {}
    return {
      status: saveStatus,
      now: now.value,
      summary: returnSaveSummary(saveStatus, {
        saved: profileStore.activeProfileSaved,
        postedAt: profileStore.activeProfilePostedTimestamp || null,
        instanceUri: getBluecoreInstanceUri(profile),
      }),
      // the Blue Core mark for Publish, with a check once published or an up arrow until then
      icons: (key, summary) => {
        if (key !== 'post') { return null }
        return summary.published ? BluecorePublishedIcon : BluecoreUnpublishedIcon
      },
      onClick: (key) => {
        if (key === 'save') { saveStatus.manualSave = true }
        pulseSaveMenu()
      },
    }
  }

  app.mixin(createSaveMenuMixin(returnOptions))
}
