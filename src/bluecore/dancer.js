// #############################################################################
// #####################  Blue Core DCTap Dancer Plugin  #######################
// ##                                                                         ##
// ## Which DCTap Dancer workspace Marva loads its profiles from, and the    ##
// ## DCTap menu's "Edit Templates" link. Upstream (LC) code calls only:     ##
// ##   - syncDancerWorkspace()      in src/stores/profile.js                ##
// ##   - selectedDancerWorkspaceId() and dancerEditorMenuItems()            ##
// ##                                in src/components/panels/nav/Nav.vue    ##
// ## Everything is a no-op unless returnUrls.dancerDefaultWorkspace is set  ##
// ## (only the Blue Core configs in src/bluecore/environment.js set it).    ##
// #############################################################################

// localStorage key LC's code reads for the selected workspace
export const DANCER_WORKSPACE_KEY = 'marva-dancerWorkspace'

/**
 * The workspace saved in localStorage when it still exists in the dancer,
 * otherwise the default workspace (matched by name), otherwise null.
 * A saved ID can go stale when the dancer's data is reset, so it is never
 * trusted without checking it against the current workspace list.
 *
 * @param {Array<{id: string, name: string}>} workspaces - from api/serve/workspaces
 * @param {string|null} storedId - localStorage marva-dancerWorkspace
 * @param {string} defaultName - e.g. 'Blue Core'
 * @return {{id: string, name: string}|null}
 */
export function pickDancerWorkspace(workspaces, storedId, defaultName) {
  if (!Array.isArray(workspaces)) return null
  const stored = storedId && storedId !== 'null' && workspaces.find(ws => ws.id === storedId)
  if (stored) return stored
  return (defaultName && workspaces.find(ws => ws.name === defaultName)) || null
}

/**
 * Hook for profile.js: run before LC's dancer code so it loads the right
 * workspace. Saves the selected workspace (if it still exists) or the default
 * one in localStorage, where LC's code reads it. When the dancer is down or
 * has no matching workspace, clears the selection so LC's code falls back to
 * its static profile URLs (the user's selection resets to the default).
 */
export async function syncDancerWorkspace(returnUrls, storage) {
  // Check before touching window: LC's unit test setup runs this in Node
  if (!returnUrls.dancerEnabled || !returnUrls.dancerDefaultWorkspace) return
  storage = storage || window.localStorage

  let workspaces = null
  try {
    const response = await fetch(returnUrls.dancerWorkspaceList)
    const body = await response.json()
    workspaces = body.success ? body.data : null
  } catch (err) {
    console.error('Error fetching dancer workspace list:', err)
  }

  const workspace = pickDancerWorkspace(workspaces, storage.getItem(DANCER_WORKSPACE_KEY), returnUrls.dancerDefaultWorkspace)
  if (workspace) {
    storage.setItem(DANCER_WORKSPACE_KEY, workspace.id)
  } else {
    storage.removeItem(DANCER_WORKSPACE_KEY)
  }
}

/**
 * Hook for Nav.vue: the workspace ID to check-mark in the DCTap menu. Applies
 * the same rule as syncDancerWorkspace() so the menu matches what was loaded,
 * even if the menu renders before the sync finishes.
 */
export function selectedDancerWorkspaceId(workspaces, returnUrls, storage) {
  const storedId = (storage || window.localStorage).getItem(DANCER_WORKSPACE_KEY)
  if (!returnUrls.dancerDefaultWorkspace) return storedId
  return pickDancerWorkspace(workspaces, storedId, returnUrls.dancerDefaultWorkspace)?.id
}

/** Hook for Nav.vue: menu items that open the DCTap Dancer editor in a new tab */
export function dancerEditorMenuItems(returnUrls) {
  if (!returnUrls.dancerDefaultWorkspace) return []
  const editorUrl = returnUrls.dancerWorkspaceList.split('api/serve/')[0]
  return [
    { is: 'separator' },
    { text: 'Edit Templates (DCTap Dancer)', icon: 'edit', click: () => window.open(editorUrl, '_blank') },
  ]
}
