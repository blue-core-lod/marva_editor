// #############################################################################
// #####################  Blue Core Header / Footer Layout  #####################
// ##                                                                         ##
// ## Display modes, sizes and preferences for the Blue Core header and       ##
// ## footer. Kept out of the LC code: see views/install.js for how they are  ##
// ## added to Marva.                                                         ##
// #############################################################################

// Fixed pixel heights (borders included) for each display mode. The components use
// these for their CSS height and the layout uses them to make room, so both always
// agree, even before the components' CSS has loaded.
export const BLUECORE_HEADER_FOOTER_HEIGHTS = {
  full: { header: 57, footer: 157 },
  slim: { header: 23, footer: 23 },
  hidden: { header: 0, footer: 0 },
}

export const PREF_SLIM = '--b-bluecore-header-footer-slim'
export const PREF_HIDDEN = '--b-bluecore-header-footer-hidden'

// Added to the preference store's styleDefault (see views/install.js), so they show up
// in Preferences > Blue Core and are saved with the user's other preferences.
// Booleans, because that's a type the LC Preferences modal already renders.
export const BLUECORE_PREFERENCES = {
  [PREF_SLIM]: {
    desc: 'Use a slim Blue Core header and footer, to keep more vertical space for editing.',
    descShort: 'Slim header & footer',
    value: false,
    type: 'boolean',
    unit: null,
    group: 'Blue Core',
    range: [true, false],
  },
  [PREF_HIDDEN]: {
    desc: 'Hide the Blue Core header and footer for a full screen Marva view.',
    descShort: 'Hide header & footer',
    value: false,
    type: 'boolean',
    unit: null,
    group: 'Blue Core',
    range: [true, false],
  },
}

/**
* Adds the Blue Core preferences to the store's defaults, keeping any already there.
* Call before the preference store loads the user's saved preferences.
* @param {object} preferenceStore
*/
export function addBluecorePreferences(preferenceStore) {
  for (const [key, def] of Object.entries(BLUECORE_PREFERENCES)) {
    if (!preferenceStore.styleDefault[key]) {
      preferenceStore.styleDefault[key] = { ...def }
    }
  }
}

/**
* How the header and footer are shown, from the user's preferences. Hide wins over slim.
* @param {object} preferenceStore
* @return {string} - 'full', 'slim' or 'hidden'
*/
export function returnBluecoreHeaderFooterMode(preferenceStore) {
  const prefs = preferenceStore.styleDefault
  if (prefs[PREF_HIDDEN]?.value === true) { return 'hidden' }
  if (prefs[PREF_SLIM]?.value === true) { return 'slim' }
  return 'full'
}

/**
* @param {string} mode - 'full', 'slim' or 'hidden'
* @return {{header: number, footer: number}}
*/
export function returnBluecoreHeaderFooterHeights(mode) {
  return BLUECORE_HEADER_FOOTER_HEIGHTS[mode] || BLUECORE_HEADER_FOOTER_HEIGHTS.full
}

/**
* The LC views size their nav pane as a percent of window.innerHeight, but the view area is
* now the window minus the header, the MOTD banner and the footer. This rescales such a
* percent so it's measured against the view area instead.
* @param {number} percent - the LC value, a percent of the window height
* @param {number} windowHeight - window.innerHeight
* @param {number} takenHeight - pixels taken by the header, MOTD banner and footer
* @return {number}
*/
export function rescaleWindowPercentToViewArea(percent, windowHeight, takenHeight) {
  const viewHeight = windowHeight - takenHeight
  if (!(viewHeight > 0) || !(windowHeight > 0)) { return percent }
  return percent * windowHeight / viewHeight
}
