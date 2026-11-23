// #############################################################################
// ######################  Blue Core Save Dropdown  ############################
// ##                                                                         ##
// ## Groups the save related nav buttons (Save, Validate, Post, Open in      ##
// ## LCAP, Export to Catalog) into one "Save" dropdown that shows when the   ##
// ## record was last saved, posted and exported, and whether something is   ##
// ## in progress. Kept out of the LC code: views/save-menu.js wraps the LC   ##
// ## Nav's fitNavMenu() so the LC buttons are regrouped before the nav is    ##
// ## drawn. This file holds the state and the pure menu building logic.     ##
// #############################################################################

import { reactive } from 'vue'

// LC nav buttons (and the Blue Core export button) that go in the dropdown, in this order.
// Validate has no id in the LC code, so it's matched by its text and icon.
export const SAVE_MENU_ITEMS = [
  { key: 'save', match: (item) => item.id === 'nav-save-button' },
  { key: 'validate', match: (item) => item.text === 'Validate' && item.icon === 'check' },
  { key: 'post', match: (item) => item.id === 'post-button' },
  { key: 'lcap', match: (item) => item.id === 'send-lcap' },
  { key: 'export', match: (item) => item.id === 'bluecore-export-button' },
]

// LC buttons Blue Core doesn't use, taken off the nav. "Open in LCAP" opens the record in an
// LC internal system (its URL is a loc.gov host). Add a key to hide another one.
export const HIDDEN_SAVE_ITEMS = ['lcap']

// separators go between these groups: save locally | validate & post | send elsewhere
const GROUPS = { save: 0, validate: 1, post: 1, lcap: 2, export: 2 }

export const SAVE_MENU_ID = 'bc-save-menu'

// what the dropdown calls LC's "Save" (a working draft, kept in the Marva scratchpad until it's published)
export const SAVE_LABEL = 'Save Draft'

// what the dropdown calls LC's "Post" (sends the record to the Blue Core store), and the
// words used for it in the status lines. Change them here to rename it everywhere.
export const PUBLISH_LABEL = 'Publish to Blue Core'
export const PUBLISH_WORDS = { done: 'Published', doing: 'Publishing…', short: 'publishing…', none: 'Not published' }
const EXPORT_HISTORY_KEY = 'bluecore-export-history'

/**
* @param {object} item - an LC nav menu item
* @return {string|null} - its SAVE_MENU_ITEMS key, or null if it isn't a save item
*/
export function returnSaveItemKey(item) {
  if (!item || item.is) { return null }
  const found = SAVE_MENU_ITEMS.find((entry) => entry.match(item))
  return found ? found.key : null
}

const RECORD_HISTORY_KEY = 'bluecore-record-history'
// oldest records are dropped past this, so localStorage doesn't grow forever
export const RECORD_HISTORY_LIMIT = 200

function readStorage(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || '{}') || {}
  } catch {
    return {}
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // private window or storage full: the time still shows until the page is reloaded
  }
}

function readExportHistory() {
  return readStorage(EXPORT_HISTORY_KEY)
}

/**
* Keeps the last save / post time of a record (by its Marva eId) in localStorage, so the
* dropdown still knows them after a page reload or when the record is reopened.
* @param {string} eId
* @param {object} times - { savedAt } and / or { postedAt }
*/
export function recordTimes(eId, times) {
  if (!eId) { return }
  const history = readStorage(RECORD_HISTORY_KEY)
  history[eId] = { ...history[eId], ...times, touched: Date.now() }
  const ids = Object.keys(history)
  if (ids.length > RECORD_HISTORY_LIMIT) {
    ids.sort((a, b) => (history[a].touched || 0) - (history[b].touched || 0))
    ids.slice(0, ids.length - RECORD_HISTORY_LIMIT).forEach((id) => delete history[id])
  }
  writeStorage(RECORD_HISTORY_KEY, history)
}

/**
* @param {string} eId
* @return {{savedAt: number|null, postedAt: number|null}}
*/
export function returnRecordTimes(eId) {
  const entry = (eId && readStorage(RECORD_HISTORY_KEY)[eId]) || {}
  return { savedAt: entry.savedAt || null, postedAt: entry.postedAt || null }
}

/**
* What the dropdown shows. Shared by the nav, the store tracking and export.js.
* Save and post times are for the record that's open; exports are kept per Instance URI
* (in localStorage), since an export runs on the server after the page is closed.
*/
export const saveStatus = reactive({
  // edits since the record was opened or last saved. LC's activeProfileSaved starts out false
  // for every record it loads, so on its own it would call a just opened record "unsaved".
  changed: false,
  changeCount: 0,
  saving: false,
  lastSavedAt: null,
  saveError: false,
  manualSave: false,
  posting: false,
  lastPostedAt: null,
  postError: false,
  exporting: false,
  exportError: null,
  exports: readExportHistory(),
  // the record in the Blue Core store (see bluestore.js): state is 'unknown', 'checking',
  // 'found', 'missing' or 'error'; updatedAt is its updated_at there
  bluestore: { state: 'unknown', updatedAt: null },
})

/**
* Clears the save and post state when another record is opened (or the page loads), then
* restores that record's last save / post times from localStorage. Export history is kept.
* @param {string} eId - the record now open, if any
*/
export function resetSaveStatus(status = saveStatus, eId = null) {
  const times = returnRecordTimes(eId)
  Object.assign(status, {
    changed: false, changeCount: 0,
    saving: false, lastSavedAt: times.savedAt, saveError: false, manualSave: false,
    posting: false, lastPostedAt: times.postedAt, postError: false,
    exporting: false, exportError: null,
  })
  Object.assign(status.bluestore, { state: 'unknown', updatedAt: null })
}

/**
* Records an export that the API accepted.
* @param {string} instanceUri
* @param {string} workflowId
* @param {number} at - timestamp
*/
export function recordExport(instanceUri, workflowId, at = Date.now(), status = saveStatus) {
  status.exports[instanceUri] = { at, workflowId: workflowId || null }
  writeStorage(EXPORT_HISTORY_KEY, status.exports)
}

function returnEId(store) {
  return store.activeProfile && store.activeProfile.eId
}

/**
* Follows the profile store's saveRecord() and publishRecord() actions (including autosaves)
* so the dropdown can show when they started, finished or failed.
* @param {object} profileStore
* @param {object} hooks - optional { onManualSave(ok) } called after a save the user asked for,
*   { onPublished() } after a publish the API accepted, and { onRecordLoaded(eId) } after a
*   record is (re)loaded from the backend
* @return {function} - stops tracking
*/
export const CHANGE_ACTIONS = ['dataChanged', 'undoChange', 'redoChange']

export function trackProfileStore(profileStore, hooks = {}, status = saveStatus) {
  return profileStore.$onAction(({ name, store, after, onError }) => {
    if (CHANGE_ACTIONS.includes(name)) {
      status.changed = true
      status.changeCount++
    } else if (name === 'loadRecordFromBackend') {
      // reopening a record (even the one that was open) loads its saved version, so whatever
      // was edited before is gone: start again from "no changes"
      after(() => { if (hooks.onRecordLoaded) { hooks.onRecordLoaded(returnEId(store)) } })
    } else if (name === 'saveRecord') {
      status.saving = true
      const changesAtStart = status.changeCount
      after(() => {
        const ok = store.activeProfileSaved === true
        status.saving = false
        status.saveError = !ok
        if (ok) {
          // an edit made while the save ran is still unsaved
          status.changed = status.changeCount !== changesAtStart
          status.lastSavedAt = Date.now()
          recordTimes(returnEId(store), { savedAt: status.lastSavedAt })
        }
        if (status.manualSave) {
          status.manualSave = false
          if (hooks.onManualSave) { hooks.onManualSave(ok) }
        }
      })
      onError(() => {
        status.saving = false
        status.saveError = true
        status.manualSave = false
      })
    } else if (name === 'publishRecord') {
      status.posting = true
      after((result) => {
        const ok = Boolean(result) && result.status !== false
        status.posting = false
        status.postError = !ok
        if (ok) {
          status.lastPostedAt = Date.now()
          recordTimes(returnEId(store), { postedAt: status.lastPostedAt })
          if (hooks.onPublished) { hooks.onPublished() }
        }
      })
      onError(() => {
        status.posting = false
        status.postError = true
      })
    }
  })
}

/**
* @param {number} timestamp
* @param {number} now
* @param {boolean} short - "2m" instead of "2 min ago"
* @return {string}
*/
export function formatTimeAgo(timestamp, now = Date.now(), short = false) {
  if (!timestamp) { return '' }
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000))
  if (seconds < 45) { return short ? 'now' : 'just now' }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) { return short ? `${minutes}m` : `${minutes} min ago` }
  const hours = Math.round(minutes / 60)
  if (hours < 24) { return short ? `${hours}h` : `${hours} hr ago` }
  const days = Math.round(hours / 24)
  return short ? `${days}d` : `${days} day${days === 1 ? '' : 's'} ago`
}

/**
* @param {number} timestamp
* @return {string} - e.g. "10:41 AM", or "Nov 3, 10:41 AM" if not today
*/
export function formatClockTime(timestamp, now = Date.now()) {
  if (!timestamp) { return '' }
  const date = new Date(timestamp)
  const sameDay = date.toDateString() === new Date(now).toDateString()
  const options = sameDay
    ? { hour: 'numeric', minute: '2-digit' }
    : { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
  return date.toLocaleString(undefined, options)
}

/**
* Everything the dropdown needs about the open record, in one place so it can be tested.
* @param {object} status - saveStatus
* @param {object} record - { saved, postedAt, published, instanceUri }
* @return {object}
*/
export function returnSaveSummary(status, record) {
  // sent to Blue Core from this browser (the publish request was accepted)
  const sentAt = record.postedAt || status.lastPostedAt || null
  const bluestore = status.bluestore || { state: 'unknown', updatedAt: null }
  const exported = (record.instanceUri && status.exports[record.instanceUri]) || null
  // saved by LC's flag, or nothing edited since the record was opened (or last saved)
  const saved = Boolean(record.saved) || !status.changed
  let state = saved ? 'saved' : 'unsaved'
  if (status.saveError || status.postError || status.exportError) { state = 'error' }
  if (status.saving || status.posting || status.exporting) { state = 'busy' }
  return {
    state,
    saved,
    lastSavedAt: status.lastSavedAt,
    sentAt,
    bluestore,
    // published = in the Blue Core store; the time is when it was last updated there
    published: bluestore.state === 'found',
    publishedAt: bluestore.state === 'found' ? bluestore.updatedAt : null,
    instanceUri: record.instanceUri || null,
    exported,
  }
}

const STATE_ICONS = { saved: 'cloud_done', unsaved: 'cloud_upload', busy: 'sync', error: 'error_outline' }

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

// one dropdown row: the action, with a muted status line under it
function itemHtml(label, meta, metaClass = '') {
  return `<span class="bc-save-item"><span class="bc-save-item-label">${escapeHtml(label)}</span>`
    + (meta ? `<span class="bc-save-item-meta ${metaClass}">${escapeHtml(meta)}</span>` : '')
    + '</span>'
}

/**
* The status line under each dropdown row.
* @return {{text: string, kind: string}} - kind is '', 'ok', 'warn', 'busy' or 'error'
*/
export function returnItemMeta(key, item, status, summary, now) {
  const ago = (t) => formatTimeAgo(t, now)
  switch (key) {
    case 'save':
      if (status.saving) { return { text: 'Saving draft…', kind: 'busy' } }
      if (status.saveError) { return { text: 'Last save failed, try again', kind: 'error' } }
      if (summary.saved) {
        return { text: summary.lastSavedAt ? `Draft saved ${ago(summary.lastSavedAt)}` : 'No changes since opened', kind: 'ok' }
      }
      return { text: summary.lastSavedAt ? `Unsaved changes · draft saved ${ago(summary.lastSavedAt)}` : 'Unsaved changes', kind: 'warn' }
    case 'validate':
      return { text: 'Check the record before posting', kind: '' }
    case 'post':
      if (status.posting) { return { text: PUBLISH_WORDS.doing, kind: 'busy' } }
      if (status.postError) { return { text: 'Last publish failed', kind: 'error' } }
      if (summary.published) {
        return { text: `${PUBLISH_WORDS.done} ${ago(summary.publishedAt)} (${formatClockTime(summary.publishedAt, now)})`, kind: 'ok' }
      }
      if (summary.bluestore.state === 'checking' || summary.bluestore.state === 'unknown') { return { text: 'Checking Blue Core…', kind: '' } }
      if (summary.bluestore.state === 'error') { return { text: 'Could not check Blue Core', kind: 'warn' } }
      // published, but not from this browser (which remembers the Blue Core URIs it was given)
      if (summary.sentAt) { return { text: `Sent ${ago(summary.sentAt)}, reopen from Blue Core to see its status`, kind: '' } }
      return { text: PUBLISH_WORDS.none, kind: '' }
    case 'lcap':
      return { text: 'Open this record in LCAP', kind: '' }
    case 'export':
      if (status.exporting) { return { text: 'Starting export…', kind: 'busy' } }
      if (status.exportError) { return { text: 'Last export failed', kind: 'error' } }
      if (summary.exported) {
        return { text: `Export started ${ago(summary.exported.at)} (${formatClockTime(summary.exported.at, now)})`, kind: 'ok' }
      }
      if (!summary.instanceUri) { return { text: 'Publish, then reopen from Blue Core to export', kind: '' } }
      return { text: 'Send the last published version to your catalog', kind: '' }
    default:
      return { text: item.title || '', kind: '' }
  }
}

/**
* Tooltip for the dropdown button, e.g. "Last saved: 2 min ago (10:41 AM)".
*/
export function returnSaveMenuTitle(summary, now = Date.now()) {
  const line = (label, t) => `${label}: ${t ? `${formatTimeAgo(t, now)} (${formatClockTime(t, now)})` : 'not yet'}`
  const lines = [
    summary.saved ? (summary.lastSavedAt ? 'All changes saved to the draft' : 'No changes since opened') : 'Unsaved changes',
    line('Draft last saved', summary.lastSavedAt),
    summary.published ? line('Last published', summary.publishedAt) : `${PUBLISH_WORDS.none} in Blue Core`,
  ]
  if (summary.exported) { lines.push(line('Last export', summary.exported.at)) }
  return lines.join('\n')
}

/**
* Moves the save related items of an LC nav menu into one "Save" dropdown, placed where the
* first of them was. The HIDDEN_SAVE_ITEMS are left out. Menus with fewer than two of them
* are returned as they are (without the hidden ones).
* @param {Array} menu - the LC nav items (not changed)
* @param {object} options - { status, summary, now, onClick(key, item, event),
*   icons(key, summary) - an icon (name or component) to use in place of the LC one, or null }
* @return {Array}
*/
export function groupSaveMenu(menu, { status = saveStatus, summary, now = Date.now(), onClick, icons } = {}) {
  menu = menu.filter((item) => !HIDDEN_SAVE_ITEMS.includes(returnSaveItemKey(item)))
  const found = []
  menu.forEach((item, index) => {
    const key = returnSaveItemKey(item)
    if (key) { found.push({ key, item, index }) }
  })
  if (found.length < 2) { return menu }

  const order = SAVE_MENU_ITEMS.map((entry) => entry.key)
  found.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))

  const subMenu = []
  let lastGroup = null
  for (const { key, item } of found) {
    if (lastGroup !== null && GROUPS[key] !== lastGroup) { subMenu.push({ is: 'separator' }) }
    lastGroup = GROUPS[key]
    const meta = returnItemMeta(key, item, status, summary, now)
    const label = { save: SAVE_LABEL, post: PUBLISH_LABEL }[key] || item.text
    const { text: _text, ...rest } = item
    const icon = (icons && icons(key, summary)) || item.icon
    subMenu.push({
      ...rest,
      icon,
      html: itemHtml(label, meta.text, meta.kind ? `bc-save-item-meta--${meta.kind}` : ''),
      class: [item.class, `bc-save-item-row bc-save-item-row--${key}`].filter(Boolean).join(' '),
      click: (event) => {
        if (onClick) { onClick(key, item, event) }
        if (item.click && !item.disabled) { item.click(event) }
      },
    })
  }

  const state = summary.state
  let chip = summary.saved ? 'saved' : 'unsaved'
  if (state === 'busy') {
    chip = status.saving ? 'saving…' : status.posting ? PUBLISH_WORDS.short : 'exporting…'
  } else if (state === 'error') {
    chip = 'failed'
  } else if (summary.saved && summary.lastSavedAt) {
    chip = formatTimeAgo(summary.lastSavedAt, now, true)
  }

  const dropdown = {
    id: SAVE_MENU_ID,
    icon: STATE_ICONS[state],
    html: '<span class="bc-save-menu-label">Save</span>'
      + `<span class="bc-save-menu-chip"><span class="bc-save-menu-dot"></span>${escapeHtml(chip)}</span>`,
    chevron: true,
    title: returnSaveMenuTitle(summary, now),
    class: `bc-save-menu bc-save-menu--${state}`,
    menu_class: 'bc-save-menu-list',
    menu_width: 320,
    menu: subMenu,
  }

  const first = Math.min(...found.map((f) => f.index))
  const taken = new Set(found.map((f) => f.index))
  const result = []
  menu.forEach((item, index) => {
    if (index === first) { result.push(dropdown) }
    if (!taken.has(index)) { result.push(item) }
  })
  return result
}
