// #############################################################################
// ###################  Blue Core Export to Catalog  ###########################
// ##                                                                         ##
// ## Sends the loaded Blue Core Instance to the user's local LSP (e.g. FOLIO)##
// ## by triggering the Blue Core API /export/ endpoint, which runs the       ##
// ## institution export DAG in Blue Core Workflows.                          ##
// #############################################################################

import { isBluecoreInstancePath } from '@/bluecore/utils'
import { returnPublishedUri } from '@/bluecore/publish'
import { recordExport, saveStatus } from '@/bluecore/save-menu'
import { showToast } from '@/bluecore/views/toast'

// Returns the Blue Core Instance URI of the active record, or null when the
// record is not in Blue Core (e.g. a new description that has not been published).
export function getBluecoreInstanceUri(activeProfile) {
  if (!activeProfile || !activeProfile.rt) return null
  for (const rt in activeProfile.rt) {
    if (!rt.endsWith(':Instance')) continue
    // a new record is stored under the Blue Core URI it was published with (see publish.js)
    const uri = returnPublishedUri(activeProfile.rt[rt].URI)
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
    title: 'Send the last published version of this Instance to your local catalog (LSP)',
    click: async () => {
      const instanceUri = getBluecoreInstanceUri(activeProfile)
      if (!instanceUri) {
        showToast({
          message: 'Export to Catalog is only for Instances loaded from Blue Core',
          detail: 'Publish this record to Blue Core, then reopen it from Blue Core to export.',
          kind: 'warning',
          timeout: 8000,
        })
        return
      }
      if (saveStatus.exporting) { return }
      if (!confirm(`Export this Instance to your catalog?\n\n${instanceUri}\n\nOnly the version last published to Blue Core is exported; publish first to include unpublished changes.`)) {
        return
      }
      saveStatus.exporting = true
      saveStatus.exportError = null
      const starting = showToast({ message: 'Starting export to catalog…', kind: 'busy', timeout: 0 })
      try {
        const result = await exportToCatalog(exportUrl, instanceUri)
        recordExport(instanceUri, result.workflow_id)
        showToast({
          message: 'Export to Catalog started',
          detail: result.workflow_id ? `Workflow ID: ${result.workflow_id}` : '',
          kind: 'success',
          timeout: 8000,
        })
      } catch (err) {
        saveStatus.exportError = err.message
        showToast({ message: 'Export to Catalog failed', detail: err.message, kind: 'error' })
      } finally {
        saveStatus.exporting = false
        starting.close()
      }
    }
  }
}
