// #############################################################################
// ###################  Blue Core Export to Catalog  ###########################
// ##                                                                         ##
// ## Sends the loaded Blue Core Instance to the user's local LSP (e.g. FOLIO)##
// ## by triggering the Blue Core API /export/ endpoint, which runs the       ##
// ## institution export DAG in Blue Core Workflows.                          ##
// #############################################################################

import { isBluecoreInstancePath } from '@/bluecore/utils'

// Returns the Blue Core Instance URI of the active record, or null when the
// record has not been loaded from Blue Core (e.g. a new, unposted description).
export function getBluecoreInstanceUri(activeProfile) {
  if (!activeProfile || !activeProfile.rt) return null
  for (const rt in activeProfile.rt) {
    if (!rt.endsWith(':Instance')) continue
    const uri = activeProfile.rt[rt].URI
    if (isBluecoreInstancePath(uri)) return uri
  }
  return null
}

// POSTs the Instance URI to the Blue Core API export endpoint
export async function exportToCatalog(exportUrl, instanceUri) {
  const token = window.localStorage.getItem('marva_jwt')
  const response = await fetch(exportUrl, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    },
    body: JSON.stringify({ instance_uri: instanceUri })
  })
  const content = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(content.detail ? JSON.stringify(content.detail) : `HTTP ${response.status}`)
  }
  return content
}

// Nav menu entry for "Export to Catalog"
export function bluecoreExportMenuItem(exportUrl, activeProfile) {
  return {
    text: 'Export to Catalog',
    id: 'bluecore-export-button',
    icon: 'output',
    title: 'Send the last posted version of this Instance to your local catalog (LSP)',
    click: async () => {
      const instanceUri = getBluecoreInstanceUri(activeProfile)
      if (!instanceUri) {
        alert('Export to Catalog is only available for Instances loaded from Blue Core. Post this record, then reopen it from Blue Core to export.')
        return
      }
      if (!confirm(`Export this Instance to your catalog?\n\n${instanceUri}\n\nOnly the version last posted to Blue Core is exported; post first to include unposted changes.`)) {
        return
      }
      try {
        const result = await exportToCatalog(exportUrl, instanceUri)
        alert(`Export to Catalog started.\n\nWorkflow ID: ${result.workflow_id}`)
      } catch (err) {
        alert(`Export to Catalog failed: ${err.message}`)
      }
    }
  }
}
