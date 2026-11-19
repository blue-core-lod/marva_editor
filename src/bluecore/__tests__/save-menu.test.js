// BLUECORE: tests for the Save dropdown (../save-menu.js), how ../views/save-menu.js adds it to
// the LC nav without changing Nav.vue, and the toasts (../views/toast.js).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, defineStore, setActivePinia } from 'pinia'
import { createApp, defineComponent, h, nextTick, reactive } from 'vue'
import {
  SAVE_MENU_ID,
  formatTimeAgo,
  groupSaveMenu,
  PUBLISH_LABEL,
  RECORD_HISTORY_LIMIT,
  recordExport,
  recordTimes,
  resetSaveStatus,
  returnRecordTimes,
  returnSaveMenuTitle,
  returnItemMeta,
  returnSaveItemKey,
  returnSaveSummary,
  trackProfileStore,
} from '@/bluecore/save-menu'
import { createSaveMenuMixin } from '@/bluecore/views/save-menu'
import { showToast } from '@/bluecore/views/toast'
import { BluecorePublishedIcon, BluecoreUnpublishedIcon } from '@/bluecore/views/bluecore-icon'
import { mount } from '@vue/test-utils'
import { createBluestoreChecker, fetchBluestoreState, returnBluestoreRefs } from '@/bluecore/bluestore'

const NOW = new Date('2026-11-17T15:00:00').getTime()
const MIN = 60 * 1000

function newStatus(overrides = {}) {
  return reactive({
    changed: true, changeCount: 0,
    saving: false, lastSavedAt: null, saveError: false, manualSave: false,
    posting: false, lastPostedAt: null, postError: false,
    exporting: false, exportError: null, exports: {},
    bluestore: { state: 'missing', updatedAt: null },
    ...overrides,
  })
}

// the save related items, as the LC Nav builds them
function lcMenu() {
  return [
    { icon: 'home', class: 'panel-size-preset-button nav-home-button' },
    { text: 'Menu', menu: [] },
    { is: 'separator' },
    { text: 'Save', id: 'nav-save-button', icon: 'turned_in_not', hotkey: 'ctrl+s', class: 'save-not-saved', click: vi.fn() },
    { text: 'Record', icon: 'radio_button_checked' },
    { text: 'Validate', icon: 'check', click: vi.fn() },
    { text: 'Post', id: 'post-button', icon: 'sailing', click: vi.fn() },
    { text: 'Open in LCAP', id: 'send-lcap', icon: 'open_in_new', click: vi.fn() },
    { text: 'Export to Catalog', id: 'bluecore-export-button', icon: 'output', click: vi.fn() },
    { text: 'Monograph', class: 'current-profile' },
    { is: 'spacer' },
  ]
}

function summaryFor(status, record = {}) {
  return returnSaveSummary(status, { saved: false, postedAt: null, instanceUri: null, ...record })
}

describe('returnSaveItemKey', () => {
  it('finds the LC save buttons and the Blue Core export button', () => {
    const keys = lcMenu().map(returnSaveItemKey)
    expect(keys).toEqual([null, null, null, 'save', null, 'validate', 'post', 'lcap', 'export', null, null])
  })
})

describe('formatTimeAgo', () => {
  it('gives short and long relative times', () => {
    expect(formatTimeAgo(null, NOW)).toBe('')
    expect(formatTimeAgo(NOW - 10 * 1000, NOW)).toBe('just now')
    expect(formatTimeAgo(NOW - 10 * 1000, NOW, true)).toBe('now')
    expect(formatTimeAgo(NOW - 2 * MIN, NOW)).toBe('2 min ago')
    expect(formatTimeAgo(NOW - 2 * MIN, NOW, true)).toBe('2m')
    expect(formatTimeAgo(NOW - 90 * MIN, NOW)).toBe('2 hr ago')
    expect(formatTimeAgo(NOW - 24 * 60 * MIN, NOW)).toBe('1 day ago')
  })
})

describe('returnSaveSummary', () => {
  it('is busy while anything runs, then error, then saved or unsaved', () => {
    expect(summaryFor(newStatus(), { saved: true }).state).toBe('saved')
    expect(summaryFor(newStatus(), { saved: false }).state).toBe('unsaved')
    expect(summaryFor(newStatus({ postError: true }), { saved: true }).state).toBe('error')
    expect(summaryFor(newStatus({ postError: true, exporting: true }), { saved: true }).state).toBe('busy')
  })

  it('uses the LC posted timestamp and the export history for the open Instance', () => {
    const status = newStatus({ lastPostedAt: 1, exports: { 'http://bc/instances/1': { at: 5, workflowId: 'w' } } })
    const summary = summaryFor(status, { postedAt: 2, instanceUri: 'http://bc/instances/1' })
    expect(summary.sentAt).toBe(2)
    expect(summary.exported).toEqual({ at: 5, workflowId: 'w' })
    expect(summaryFor(status, { instanceUri: 'http://bc/instances/2' }).exported).toBeNull()
  })
})

describe('returnItemMeta', () => {
  it('describes save, post and export state', () => {
    const status = newStatus({ lastSavedAt: NOW - 3 * MIN })
    const saved = summaryFor(status, { saved: true })
    expect(returnItemMeta('save', {}, status, saved, NOW)).toEqual({ text: 'Draft saved 3 min ago', kind: 'ok' })
    const unsaved = summaryFor(status, { saved: false })
    expect(returnItemMeta('save', {}, status, unsaved, NOW)).toEqual({ text: 'Unsaved changes · draft saved 3 min ago', kind: 'warn' })
    expect(returnItemMeta('save', {}, newStatus({ saving: true }), unsaved, NOW).kind).toBe('busy')
    expect(returnItemMeta('post', {}, status, unsaved, NOW).text).toBe('Not published')
    expect(returnItemMeta('post', {}, status, summaryFor(status, { postedAt: NOW - 5 * MIN }), NOW).text)
      .toBe('Sent 5 min ago, reopen from Blue Core to see its status')
    expect(returnItemMeta('export', {}, status, unsaved, NOW).text).toBe('Publish, then reopen from Blue Core to export')
    expect(returnItemMeta('export', {}, newStatus({ exportError: 'boom' }), unsaved, NOW).kind).toBe('error')
  })
})

describe('groupSaveMenu', () => {
  it('moves the save items into one dropdown where the first one was', () => {
    const status = newStatus()
    const menu = lcMenu()
    const grouped = groupSaveMenu(menu, { status, summary: summaryFor(status), now: NOW })

    expect(grouped.map((m) => m.id || m.text || m.is || m.icon)).toEqual(
      ['home', 'Menu', 'separator', SAVE_MENU_ID, 'Record', 'Monograph', 'spacer'],
    )
    const dropdown = grouped[3]
    expect(dropdown.class).toBe('bc-save-menu bc-save-menu--unsaved')
    expect(dropdown.html).toContain('unsaved')
    // Open in LCAP is hidden
    expect(dropdown.menu.map((m) => m.id || m.is || m.icon)).toEqual(
      ['nav-save-button', 'separator', 'check', 'post-button', 'separator', 'bluecore-export-button'],
    )
    // keeps the LC hotkey, id and class, and adds a status line
    const save = dropdown.menu[0]
    expect(save.hotkey).toBe('ctrl+s')
    expect(save.class).toContain('save-not-saved')
    expect(save.html).toContain('Unsaved changes')
    expect(save.text).toBeUndefined()
    expect(save.html).toContain('Save Draft')
    // the LC menu itself isn't changed
    expect(menu).toHaveLength(11)
  })

  it('calls the LC click and the onClick hook', () => {
    const status = newStatus()
    const menu = lcMenu()
    const onClick = vi.fn()
    const grouped = groupSaveMenu(menu, { status, summary: summaryFor(status), now: NOW, onClick })
    grouped[3].menu[0].click('event')
    expect(onClick).toHaveBeenCalledWith('save', menu[3], 'event')
    expect(menu[3].click).toHaveBeenCalledWith('event')
  })

  it('shows the time since the last save on the button', () => {
    const status = newStatus({ lastSavedAt: NOW - 4 * MIN })
    const grouped = groupSaveMenu(lcMenu(), { status, summary: summaryFor(status, { saved: true }), now: NOW })
    expect(grouped[3].html).toContain('4m')
    expect(grouped[3].icon).toBe('cloud_done')
    expect(grouped[3].title).toMatch(/Draft last saved: 4 min ago/)
  })

  it('leaves the menu alone with fewer than two save items', () => {
    const status = newStatus()
    const menu = [{ text: 'Save', id: 'nav-save-button' }, { is: 'spacer' }]
    expect(groupSaveMenu(menu, { status, summary: summaryFor(status), now: NOW })).toEqual(menu)
  })

  it('escapes text that goes into the html', () => {
    const status = newStatus()
    const menu = [
      { text: 'Save', id: 'nav-save-button' },
      { text: '<b>Export</b>', id: 'bluecore-export-button' },
    ]
    const grouped = groupSaveMenu(menu, { status, summary: summaryFor(status), now: NOW })
    expect(grouped[0].menu[2].html).toContain('&lt;b&gt;Export&lt;/b&gt;')
  })

  it('hides Open in LCAP even when nothing is grouped', () => {
    const status = newStatus()
    const menu = [{ text: 'Save', id: 'nav-save-button' }, { text: 'Open in LCAP', id: 'send-lcap' }, { is: 'spacer' }]
    const result = groupSaveMenu(menu, { status, summary: summaryFor(status), now: NOW })
    expect(result.map((m) => m.id || m.is)).toEqual(['nav-save-button', 'spacer'])
  })

  it('calls LC Post "Publish to Blue Core" and uses the icon given for it', () => {
    const status = newStatus()
    const Icon = { render: () => null }
    const icons = (key) => (key === 'post' ? Icon : null)
    const grouped = groupSaveMenu(lcMenu(), { status, summary: summaryFor(status), now: NOW, icons })
    const rows = grouped[3].menu.filter((m) => !m.is)
    const post = rows.find((m) => m.id === 'post-button')
    expect(post.html).toContain(PUBLISH_LABEL)
    expect(post.icon).toBe(Icon)
    // the other rows keep their LC icons
    expect(rows.find((m) => m.id === 'bluecore-export-button').icon).toBe('output')
  })
})

describe('trackProfileStore', () => {
  const useFakeProfileStore = defineStore('fakeProfile', {
    state: () => ({ activeProfileSaved: false }),
    actions: {
      async saveRecord(ok = true) { this.activeProfileSaved = ok },
      async publishRecord(ok = true) { return { status: ok } },
      async failingSave() { throw new Error('x') },
    },
  })

  beforeEach(() => setActivePinia(createPinia()))

  it('follows saves, including a failed one, and calls back after a manual save', async () => {
    const store = useFakeProfileStore()
    const status = newStatus({ manualSave: true })
    const onManualSave = vi.fn()
    trackProfileStore(store, { onManualSave }, status)

    const saving = store.saveRecord(true)
    expect(status.saving).toBe(true)
    await saving
    expect(status.saving).toBe(false)
    expect(status.lastSavedAt).toBeGreaterThan(0)
    expect(onManualSave).toHaveBeenCalledWith(true)
    expect(status.manualSave).toBe(false)

    await store.saveRecord(false)
    expect(status.saveError).toBe(true)
    expect(onManualSave).toHaveBeenCalledTimes(1) // autosaves don't toast
  })

  it('follows posts', async () => {
    const store = useFakeProfileStore()
    const status = newStatus()
    trackProfileStore(store, {}, status)
    const posting = store.publishRecord(true)
    expect(status.posting).toBe(true)
    await posting
    expect(status.lastPostedAt).toBeGreaterThan(0)
    await store.publishRecord(false)
    expect(status.postError).toBe(true)
  })

  it('resetSaveStatus keeps the export history', () => {
    const status = newStatus({ lastSavedAt: 1, postError: true })
    recordExport('http://bc/instances/1', 'wf-1', 10, status)
    resetSaveStatus(status)
    expect(status.lastSavedAt).toBeNull()
    expect(status.postError).toBe(false)
    expect(status.exports['http://bc/instances/1']).toEqual({ at: 10, workflowId: 'wf-1' })
  })
})

describe('unsaved changes', () => {
  const useEditStore = defineStore('fakeEdit', {
    state: () => ({ activeProfileSaved: false, activeProfile: { eId: 'e1' } }),
    actions: {
      dataChanged() { this.activeProfileSaved = false },
      async saveRecord() { this.activeProfileSaved = true },
    },
  })

  beforeEach(() => setActivePinia(createPinia()))

  it('a just opened record is not unsaved, even though LC says activeProfileSaved is false', async () => {
    const store = useEditStore()
    const status = newStatus()
    resetSaveStatus(status, 'e1')
    trackProfileStore(store, {}, status)
    expect(summaryFor(status, { saved: store.activeProfileSaved }).state).toBe('saved')

    store.dataChanged()
    expect(summaryFor(status, { saved: store.activeProfileSaved }).state).toBe('unsaved')

    await store.saveRecord()
    expect(summaryFor(status, { saved: store.activeProfileSaved }).state).toBe('saved')
  })

  it('reopening the same record (same eId) clears its unsaved changes', async () => {
    const useReopenStore = defineStore('fakeReopen', {
      state: () => ({ activeProfileSaved: false, activeProfile: { eId: 'e1' } }),
      actions: {
        dataChanged() { this.activeProfileSaved = false },
        async loadRecordFromBackend(eId) { this.activeProfile = { eId } },
      },
    })
    const store = useReopenStore()
    const status = newStatus()
    resetSaveStatus(status, 'e1')
    const onRecordLoaded = vi.fn((eId) => resetSaveStatus(status, eId))
    trackProfileStore(store, { onRecordLoaded }, status)

    store.dataChanged()
    expect(summaryFor(status, { saved: store.activeProfileSaved }).state).toBe('unsaved')
    await store.loadRecordFromBackend('e1')
    expect(onRecordLoaded).toHaveBeenCalledWith('e1')
    expect(summaryFor(status, { saved: store.activeProfileSaved }).state).toBe('saved')
  })

  it('an edit made while a save runs stays unsaved', async () => {
    const store = useEditStore()
    const status = newStatus()
    resetSaveStatus(status, 'e1')
    trackProfileStore(store, {}, status)
    store.dataChanged()
    const saving = store.saveRecord()
    store.dataChanged()
    await saving
    expect(status.changed).toBe(true)
  })

  it('shows "No changes since opened" when there is no save time', () => {
    const status = newStatus({ changed: false })
    expect(returnItemMeta('save', {}, status, summaryFor(status), NOW).text).toBe('No changes since opened')
  })
})

describe('record times in localStorage', () => {
  const useRecordStore = defineStore('fakeRecord', {
    state: () => ({ activeProfileSaved: false, activeProfile: { eId: 'e1' } }),
    actions: {
      async saveRecord() { this.activeProfileSaved = true },
      async publishRecord() { return { status: true } },
    },
  })

  beforeEach(() => {
    window.localStorage.clear()
    setActivePinia(createPinia())
  })

  it('keeps save and post times per record across a reload', async () => {
    const store = useRecordStore()
    const status = newStatus()
    trackProfileStore(store, {}, status)
    await store.saveRecord()
    await store.publishRecord()
    const saved = status.lastSavedAt
    const posted = status.lastPostedAt

    // a "reload": fresh state, then the record opens again
    const reloaded = newStatus()
    resetSaveStatus(reloaded, 'e1')
    expect(reloaded.lastSavedAt).toBe(saved)
    expect(reloaded.lastPostedAt).toBe(posted)

    // another record has its own times
    resetSaveStatus(reloaded, 'e2')
    expect(reloaded.lastSavedAt).toBeNull()
    expect(reloaded.lastPostedAt).toBeNull()
  })

  it('merges save and post times and ignores records without an eId', () => {
    recordTimes('e1', { savedAt: 1 })
    recordTimes('e1', { postedAt: 2 })
    recordTimes(undefined, { savedAt: 3 })
    expect(returnRecordTimes('e1')).toEqual({ savedAt: 1, postedAt: 2 })
    expect(returnRecordTimes(undefined)).toEqual({ savedAt: null, postedAt: null })
  })

  it('drops the oldest records past the limit', () => {
    for (let i = 0; i <= RECORD_HISTORY_LIMIT; i++) { recordTimes(`e${i}`, { savedAt: i + 1 }) }
    expect(returnRecordTimes('e0').savedAt).toBeNull()
    expect(returnRecordTimes(`e${RECORD_HISTORY_LIMIT}`).savedAt).toBe(RECORD_HISTORY_LIMIT + 1)
  })
})

describe('createSaveMenuMixin', () => {
  it('groups the menu passed to fitNavMenu, without changing the LC component', async () => {
    const status = newStatus()
    const seen = []
    const Nav = defineComponent({
      methods: {
        fitNavMenu(menu) { seen.push(menu); return menu },
      },
      mounted() { this.fitNavMenu(lcMenu()) },
      render: () => h('div'),
    })
    const Other = defineComponent({ render: () => h('span') })
    const el = document.createElement('div')
    const app = createApp({ render: () => [h(Nav), h(Other)] })
    app.mixin(createSaveMenuMixin(() => ({ status, summary: summaryFor(status), now: NOW })))
    app.mount(el)
    await nextTick()
    expect(seen).toHaveLength(1)
    expect(seen[0].some((m) => m.id === SAVE_MENU_ID)).toBe(true)
    app.unmount()
  })
})

describe('showToast', () => {
  afterEach(() => {
    vi.useRealTimers()
    document.getElementById('bc-toasts')?.remove()
  })

  it('adds a toast with plain text that closes itself', () => {
    vi.useFakeTimers()
    const { el } = showToast({ message: '<img src=x>', detail: 'Workflow ID: 1', kind: 'success', timeout: 1000 })
    expect(document.getElementById('bc-toasts').contains(el)).toBe(true)
    expect(el.querySelector('img')).toBeNull()
    expect(el.textContent).toContain('<img src=x>')
    expect(el.textContent).toContain('Workflow ID: 1')
    vi.advanceTimersByTime(1300)
    expect(el.isConnected).toBe(false)
  })

  it('stays open with timeout 0 until closed', () => {
    vi.useFakeTimers()
    const toast = showToast({ message: 'Exporting', kind: 'busy', timeout: 0 })
    vi.advanceTimersByTime(60000)
    expect(toast.el.isConnected).toBe(true)
    toast.el.querySelector('.bc-toast-close').click()
    vi.advanceTimersByTime(300)
    expect(toast.el.isConnected).toBe(false)
  })
})

describe('Blue Core mark icon', () => {
  it('draws the three circle mark, with a check badge once published', () => {
    const published = mount(BluecorePublishedIcon)
    expect(published.findAll('.bc-icon-circle')).toHaveLength(3)
    expect(published.find('.bc-icon-badge--check').exists()).toBe(true)
    const unpublished = mount(BluecoreUnpublishedIcon)
    expect(unpublished.find('.bc-icon-badge--up').exists()).toBe(true)
  })
})

describe('published status from the Blue Core store', () => {
  const found = newStatus({ bluestore: { state: 'found', updatedAt: NOW - 5 * MIN } })

  it('shows the Blue Core updated_at time, not the time it was sent from this browser', () => {
    const summary = summaryFor(found, { postedAt: NOW - 90 * MIN })
    expect(summary.published).toBe(true)
    expect(summary.publishedAt).toBe(NOW - 5 * MIN)
    expect(returnItemMeta('post', {}, found, summary, NOW).text).toMatch(/^Published 5 min ago \(/)
    expect(returnSaveMenuTitle(summary, NOW)).toMatch(/Last published: 5 min ago/)
  })

  it('says "Not published" when Blue Core does not have it', () => {
    const status = newStatus()
    const summary = summaryFor(status)
    expect(returnItemMeta('post', {}, status, summary, NOW).text).toBe('Not published')
    expect(returnSaveMenuTitle(summary, NOW)).toMatch(/Not published in Blue Core/)
  })

  it('says it is checking or could not check', () => {
    const meta = (bluestore) => {
      const status = newStatus({ bluestore: { updatedAt: null, ...bluestore } })
      return returnItemMeta('post', {}, status, summaryFor(status), NOW)
    }
    expect(meta({ state: 'checking' }).text).toBe('Checking Blue Core…')
    expect(meta({ state: 'error' }).text).toBe('Could not check Blue Core')
  })
})

describe('bluestore lookups', () => {
  const INSTANCE = '1b4e28ba-2fa1-41d2-883f-0016d3cca427'
  const WORK = '6fa459ea-ee8a-4ca4-894e-db77e160355e'
  const profile = {
    rt: {
      'lc:RT:bf2:Monograph:Work': { URI: `https://bcld.info/works/${WORK}` },
      'lc:RT:bf2:Monograph:Instance': { URI: `http://id.loc.gov/resources/instances/${INSTANCE.toUpperCase()}` },
      'lc:RT:bf2:Monograph:Item': { URI: 'http://id.loc.gov/resources/items/12345' },
    },
  }
  const json = (body, status = 200) => Promise.resolve({ status, ok: status < 400, json: () => Promise.resolve(body) })

  it('finds the Instance and Work UUIDs of a record', () => {
    expect(returnBluestoreRefs(profile)).toEqual([{ kind: 'works', uuid: WORK }, { kind: 'instances', uuid: INSTANCE }])
    expect(returnBluestoreRefs({ rt: { x: { URI: 'http://id.loc.gov/resources/instances/23882742' } } })).toEqual([])
    expect(returnBluestoreRefs(null)).toEqual([])
  })

  it('uses the latest updated_at of the Instance and Work, read as UTC', async () => {
    const fetchFn = vi.fn((url) => json({ updated_at: url.includes('/works/') ? '2026-11-17T14:00:00.123456' : '2026-11-17T15:30:00' }))
    const result = await fetchBluestoreState(returnBluestoreRefs(profile), fetchFn)
    expect(result).toEqual({ state: 'found', updatedAt: Date.parse('2026-11-17T15:30:00Z') })
    expect(fetchFn).toHaveBeenCalledWith(`/api/instances/${INSTANCE}`, { headers: { Accept: 'application/vnd.sinopia+json' } })
  })

  it('is missing on 404, and an error when the API fails', async () => {
    const refs = returnBluestoreRefs(profile)
    expect(await fetchBluestoreState(refs, () => json({}, 404))).toEqual({ state: 'missing', updatedAt: null })
    expect(await fetchBluestoreState(refs, () => json({}, 500))).toEqual({ state: 'error', updatedAt: null })
    expect(await fetchBluestoreState(refs, () => Promise.reject(new Error('offline')))).toEqual({ state: 'error', updatedAt: null })
  })

  it('finds a new record by the Blue Core URIs it was published under', async () => {
    const newInstance = '9b2c7d4e-1f3a-4c5b-8d6e-7f8091a2b3c4'
    window.localStorage.setItem('bluecore-published-uris', JSON.stringify({
      [`http://id.loc.gov/resources/instances/${INSTANCE.toUpperCase()}`]: `https://bcld.info/instances/${newInstance}`,
    }))
    try {
      expect(returnBluestoreRefs(profile)).toEqual([{ kind: 'works', uuid: WORK }, { kind: 'instances', uuid: newInstance }])
    } finally {
      window.localStorage.removeItem('bluecore-published-uris')
    }
  })

  it('checks once, then shows the stored time', async () => {
    const status = newStatus({ bluestore: { state: 'missing', updatedAt: null } })
    const fetchFn = vi.fn(() => json({ updated_at: '2026-11-17T15:00:00' }))
    await createBluestoreChecker({ status, returnProfile: () => profile, fetchFn })()
    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(status.bluestore).toEqual({ state: 'found', updatedAt: Date.parse('2026-11-17T15:00:00Z') })
  })

  it('a record with nothing to look up is not published, and a newer check wins', async () => {
    const status = newStatus({ bluestore: { state: 'unknown', updatedAt: null } })
    await createBluestoreChecker({ status, returnProfile: () => ({ rt: {} }), fetchFn: vi.fn() })()
    expect(status.bluestore.state).toBe('missing')

    let release
    const slow = new Promise((resolve) => { release = resolve })
    const fetchFn = vi.fn()
      .mockImplementationOnce(() => slow.then(() => json({ updated_at: '2026-01-01T00:00:00' })))
      .mockImplementation(() => json({}, 404))
    const check = createBluestoreChecker({ status, returnProfile: () => profile, fetchFn })
    const first = check()
    await check()
    release()
    await first
    expect(status.bluestore.state).toBe('missing')
  })
})
