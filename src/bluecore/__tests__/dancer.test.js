import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  pickDancerWorkspace,
  syncDancerWorkspace,
  selectedDancerWorkspaceId,
  dancerEditorMenuItems,
  DANCER_WORKSPACE_KEY,
} from '../dancer'

const workspaces = [
  { id: 'ws-cornell', name: 'Cornell' },
  { id: 'ws-bluecore', name: 'Blue Core' },
]

const bluecoreUrls = {
  dancerEnabled: true,
  dancerWorkspaceList: '/marva/dancer/api/serve/workspaces',
  dancerDefaultWorkspace: 'Blue Core',
}

// LC's configs enable the dancer but set no default workspace
const lcUrls = {
  dancerEnabled: true,
  dancerWorkspaceList: 'https://editor.id.loc.gov/marva/dancer/api/serve/workspaces',
}

function memoryStorage(initial = {}) {
  const data = { ...initial }
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => { data[key] = String(value) },
    removeItem: (key) => { delete data[key] },
    data,
  }
}

function mockFetch(body) {
  globalThis.fetch = vi.fn(async () => ({ json: async () => body }))
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete globalThis.fetch
})

describe('pickDancerWorkspace', () => {
  it('keeps a stored workspace that still exists', () => {
    expect(pickDancerWorkspace(workspaces, 'ws-cornell', 'Blue Core')).toEqual(workspaces[0])
  })

  it('falls back to the default when nothing is stored', () => {
    expect(pickDancerWorkspace(workspaces, null, 'Blue Core')).toEqual(workspaces[1])
    expect(pickDancerWorkspace(workspaces, 'null', 'Blue Core')).toEqual(workspaces[1])
  })

  it('falls back to the default when the stored workspace is gone', () => {
    expect(pickDancerWorkspace(workspaces, 'ws-deleted', 'Blue Core')).toEqual(workspaces[1])
  })

  it('returns null without a matching default or a list', () => {
    expect(pickDancerWorkspace(workspaces, null, 'marva-default')).toBeNull()
    expect(pickDancerWorkspace(null, 'ws-cornell', 'Blue Core')).toBeNull()
  })
})

describe('syncDancerWorkspace', () => {
  it('replaces a stale selection with the default', async () => {
    mockFetch({ success: true, data: workspaces })
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-deleted' })
    await syncDancerWorkspace(bluecoreUrls, storage)
    expect(storage.data[DANCER_WORKSPACE_KEY]).toBe('ws-bluecore')
  })

  it('keeps a valid selection', async () => {
    mockFetch({ success: true, data: workspaces })
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-cornell' })
    await syncDancerWorkspace(bluecoreUrls, storage)
    expect(storage.data[DANCER_WORKSPACE_KEY]).toBe('ws-cornell')
  })

  it('clears the selection when no workspace matches, so LC code uses static profiles', async () => {
    mockFetch({ success: true, data: [] })
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-deleted' })
    await syncDancerWorkspace(bluecoreUrls, storage)
    expect(storage.data[DANCER_WORKSPACE_KEY]).toBeUndefined()
  })

  it('clears the selection when the dancer is unreachable, so LC code uses static profiles', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('offline') })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-cornell' })
    await syncDancerWorkspace(bluecoreUrls, storage)
    expect(storage.data[DANCER_WORKSPACE_KEY]).toBeUndefined()
  })

  it('does nothing for LC configs', async () => {
    globalThis.fetch = vi.fn()
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-lc' })
    await syncDancerWorkspace(lcUrls, storage)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(storage.data[DANCER_WORKSPACE_KEY]).toBe('ws-lc')
  })
})

describe('selectedDancerWorkspaceId', () => {
  it('marks the default when the stored workspace is gone', () => {
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-deleted' })
    expect(selectedDancerWorkspaceId(workspaces, bluecoreUrls, storage)).toBe('ws-bluecore')
  })

  it('returns the stored ID unchanged for LC configs', () => {
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-lc' })
    expect(selectedDancerWorkspaceId(workspaces, lcUrls, storage)).toBe('ws-lc')
  })
})

describe('dancerEditorMenuItems', () => {
  it('adds a separator and a link to the editor', () => {
    const open = vi.fn()
    vi.stubGlobal('window', { open })
    const [separator, item] = dancerEditorMenuItems(bluecoreUrls)
    expect(separator).toEqual({ is: 'separator' })
    expect(item.text).toBe('Edit Templates (DCTap Dancer)')
    item.click()
    expect(open).toHaveBeenCalledWith('/marva/dancer/', '_blank')
  })

  it('adds nothing for LC configs', () => {
    expect(dancerEditorMenuItems(lcUrls)).toEqual([])
  })
})
