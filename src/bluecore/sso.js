// #############################################################################
// #####################  Blue Core SSO Pre-Mount Check  #######################
// ##                                                                         ##
// ## Sends logged-out users straight to the Keycloak login before the Vue    ##
// ## app mounts, so Marva doesn't briefly render before the redirect.        ##
// #############################################################################

import { useConfigStore } from '@/stores/config'
import { usePreferenceStore } from '@/stores/preference'
import { isBluecoreMarva } from '@/bluecore/utils'

// Same checks as preferenceStore.handleSsoToken(), without its side effects
function hasValidJwt() {
  if (new URLSearchParams(window.location.search).get('token')) return true
  const token = window.localStorage.getItem('marva_jwt')
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return !(payload.exp && payload.exp * 1000 < Date.now())
  } catch (e) {
    return false
  }
}

function isBluecoreHost(href) {
  return isBluecoreMarva(href) || (href.startsWith('http://localhost') && href.includes('localhost/marva/'))
}

// Returns true when the page is redirecting to SSO (caller should skip mounting)
export function redirectToSsoIfLoggedOut() {
  if (typeof window === 'undefined' || !isBluecoreHost(window.location.href)) return false
  const returnUrls = useConfigStore().returnUrls
  if (returnUrls.disableSSO || hasValidJwt()) return false
  usePreferenceStore().ssoLogin(returnUrls.util)
  return true
}
