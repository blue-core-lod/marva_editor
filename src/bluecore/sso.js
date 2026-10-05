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

// #############################################################################
// ##  Keycloak Session Watcher  ##
// ################################
// Notices when the Keycloak SSO session ends elsewhere (e.g. logging out of
// Sinopia) using Keycloak's session status iframe, the same check keycloak-js
// runs with checkLoginIframe. The issuer, client and session id come from the JWT.
const SESSION_CHECK_INTERVAL_MS = 5000

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch (e) {
    return null
  }
}

export function watchSsoSession(onLoggedOut) {
  const claims = decodeJwt(window.localStorage.getItem('marva_jwt') || '')
  if (!claims?.iss || !claims?.azp || !claims?.sid) return

  const kcOrigin = new URL(claims.iss).origin
  const iframe = document.createElement('iframe')
  iframe.src = `${claims.iss}/protocol/openid-connect/login-status-iframe.html`
  iframe.title = 'keycloak-session-iframe'
  iframe.style.display = 'none'

  let timer = null
  const stop = () => {
    window.clearInterval(timer)
    window.removeEventListener('message', onMessage)
    iframe.remove()
  }

  function onMessage(event) {
    if (event.origin !== kcOrigin || event.source !== iframe.contentWindow) return
    if (event.data === 'changed') {
      console.warn('SSO: Keycloak session ended elsewhere')
      stop()
      onLoggedOut()
    } else if (event.data === 'error') {
      console.warn('SSO: Keycloak session check unavailable')
      stop()
    }
  }

  // Read the token each tick so refreshed tokens are used; the sid stays the same.
  const check = () => {
    const current = decodeJwt(window.localStorage.getItem('marva_jwt') || '')
    if (!current?.sid) return
    iframe.contentWindow?.postMessage(`${current.azp} ${current.sid}`, kcOrigin)
  }

  window.addEventListener('message', onMessage)
  iframe.addEventListener('load', () => {
    check()
    timer = window.setInterval(check, SESSION_CHECK_INTERVAL_MS)
  })
  document.body.appendChild(iframe)
}
