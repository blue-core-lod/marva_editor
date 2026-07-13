// #############################################################################
// ###################  Blue Core Local Scratch Pad  ###########################
// ##                                                                         ##
// ## Marva normally saves in-progress records to the ldpjs backend           ##
// ## Blue Core has no ldpjs backend yet, so use localStorage                 ##
// #############################################################################

const KEY_PREFIX = 'bluecore:record:'

// True when no ldpjs backend is configured, i.e. use the local scratch pad instead.
export function isLocalScratchpad(returnUrls) {
  return !returnUrls || !returnUrls.ldpjs || returnUrls.ldpjs.trim() === ''
}

// Stand-in for utilsNetwork.saveRecord -- returns whether it saved.
export function saveRecordLocal(xml, eId) {
  if (!eId) return false
  try {
    window.localStorage.setItem(KEY_PREFIX + eId, xml)
    return true
  } catch (err) {
    // quota exceeded, private-mode restrictions, etc.
    console.error('Bluecore local scratch pad: could not save record', err)
    return false
  }
}

// Stand-in for utilsNetwork.loadSavedRecord -- returns the saved XML, or null.
export function loadRecordLocal(eId) {
  if (!eId) return null
  try {
    return window.localStorage.getItem(KEY_PREFIX + eId)
  } catch (err) {
    console.error('Bluecore local scratch pad: could not load record', err)
    return null
  }
}
