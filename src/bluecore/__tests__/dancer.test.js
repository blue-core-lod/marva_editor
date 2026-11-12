import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  pickDancerWorkspace,
  syncDancerWorkspace,
  selectedDancerWorkspaceId,
  dancerEditorMenuItems,
  DANCER_WORKSPACE_KEY,
} from '../dancer'
import bluecore from '../environment'

const workspaces = [
  { id: 'ws-cornell', name: 'Cornell' },
  { id: 'ws-bluecore', name: 'Blue Core' },
]

// The real Blue Core config, so the tests break if environment.js drifts
const bluecoreUrls = bluecore.prod

// The hooks are no-ops until a default workspace is configured
const { dancerDefaultWorkspace, ...noDefaultUrls } = bluecoreUrls

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

  it('does nothing without a default workspace', async () => {
    globalThis.fetch = vi.fn()
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-cornell' })
    await syncDancerWorkspace(noDefaultUrls, storage)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(storage.data[DANCER_WORKSPACE_KEY]).toBe('ws-cornell')
  })

  it('does nothing when the dancer is disabled', async () => {
    globalThis.fetch = vi.fn()
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-cornell' })
    await syncDancerWorkspace({ ...bluecoreUrls, dancerEnabled: false }, storage)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(storage.data[DANCER_WORKSPACE_KEY]).toBe('ws-cornell')
  })
})

describe('selectedDancerWorkspaceId', () => {
  it('marks the default when the stored workspace is gone', () => {
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-deleted' })
    expect(selectedDancerWorkspaceId(workspaces, bluecoreUrls, storage)).toBe('ws-bluecore')
  })

  it('returns the stored ID unchanged without a default workspace', () => {
    const storage = memoryStorage({ [DANCER_WORKSPACE_KEY]: 'ws-deleted' })
    expect(selectedDancerWorkspaceId(workspaces, noDefaultUrls, storage)).toBe('ws-deleted')
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

  it('adds nothing without a default workspace', () => {
    expect(dancerEditorMenuItems(noDefaultUrls)).toEqual([])
  })
})
