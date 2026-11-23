// #############################################################################
// ##########################  Blue Core Toasts  ###############################
// ##                                                                         ##
// ## Small notices in the top right corner ("Saved", "Export started"), in   ##
// ## place of alert() pop ups that stop the user's work. Plain DOM so they   ##
// ## work from anywhere (stores, menu clicks) without an LC component.       ##
// #############################################################################

import '@/bluecore/styles/bluecore-save-menu.css'

const CONTAINER_ID = 'bc-toasts'
const ICONS = { success: 'check_circle', info: 'info', warning: 'warning_amber', error: 'error_outline', busy: 'sync' }

function returnContainer() {
  let container = document.getElementById(CONTAINER_ID)
  if (!container) {
    container = document.createElement('div')
    container.id = CONTAINER_ID
    container.setAttribute('role', 'status')
    container.setAttribute('aria-live', 'polite')
    document.body.appendChild(container)
  }
  return container
}

/**
* Shows a toast. Text is set with textContent, so server messages can't inject HTML.
* @param {object} options
* @param {string} options.message - the main line
* @param {string} options.detail - optional second line (e.g. a workflow id)
* @param {string} options.kind - 'success', 'info', 'warning', 'error' or 'busy'
* @param {number} options.timeout - ms before it closes itself, 0 to keep it open
* @return {{el: HTMLElement, close: function}}
*/
export function showToast({ message, detail = '', kind = 'info', timeout } = {}) {
  const el = document.createElement('div')
  el.className = `bc-toast bc-toast--${kind}`

  const icon = document.createElement('span')
  icon.className = 'material-icons bc-toast-icon'
  icon.setAttribute('aria-hidden', 'true')
  icon.textContent = ICONS[kind] || ICONS.info

  const body = document.createElement('div')
  body.className = 'bc-toast-body'
  const title = document.createElement('div')
  title.className = 'bc-toast-message'
  title.textContent = message
  body.appendChild(title)
  if (detail) {
    const sub = document.createElement('div')
    sub.className = 'bc-toast-detail'
    sub.textContent = detail
    body.appendChild(sub)
  }

  const closeButton = document.createElement('button')
  closeButton.type = 'button'
  closeButton.className = 'bc-toast-close material-icons'
  closeButton.setAttribute('aria-label', 'Dismiss')
  closeButton.textContent = 'close'

  el.append(icon, body, closeButton)

  let timer = null
  const close = () => {
    window.clearTimeout(timer)
    if (!el.isConnected) { return }
    el.classList.add('bc-toast--leaving')
    window.setTimeout(() => el.remove(), 200)
  }
  closeButton.addEventListener('click', close)

  returnContainer().appendChild(el)
  const ms = timeout !== undefined ? timeout : (kind === 'error' ? 10000 : 5000)
  if (ms > 0) { timer = window.setTimeout(close, ms) }
  return { el, close }
}
