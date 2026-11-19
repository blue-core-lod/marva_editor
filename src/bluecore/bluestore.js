// #############################################################################
// ####################  Blue Core Published Status  ###########################
// ##                                                                         ##
// ## Asks the Blue Core API whether the open record's Instance / Work is in  ##
// ## the Blue Core store, and when it was last updated there (updated_at),   ##
// ## so the Save dropdown can show "Published 5 min ago" from the database   ##
// ## rather than from this browser. A new record is stored under Blue Core  ##
// ## URIs of its own, which ../publish.js remembers when it publishes it.    ##
// #############################################################################

import { asUtc } from '@/bluecore/search'
import { returnPublishedUri } from '@/bluecore/publish'

const apiBase = (import.meta.env.VITE_BLUECORE_API_PATH || '/api/').replace(/\/+$/, '')
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const RESOURCE_PATH = new RegExp(`/(instances|works)/(${UUID})(?:[/?#.]|$)`, 'i')
// the API's JSON that includes created_at / updated_at (plain JSON-LD has the graph only)
const ACCEPT = 'application/vnd.sinopia+json'

/**
* The Instances and Works of a record that could be in Blue Core: any whose URI ends in
* /instances/{uuid} or /works/{uuid}. Records loaded from Blue Core have these. A new record
* is stored under URIs Blue Core mints, so its URIs are swapped for the ones it was
* published under from this browser (see returnPublishedUri).
* @param {object} profile - the active profile
* @return {Array<{kind: string, uuid: string}>}
*/
export function returnBluestoreRefs(profile) {
  const refs = []
  if (!profile || !profile.rt) { return refs }
  for (const rt in profile.rt) {
    const match = RESOURCE_PATH.exec(returnPublishedUri((profile.rt[rt] && profile.rt[rt].URI) || ''))
    if (!match) { continue }
    const ref = { kind: match[1].toLowerCase(), uuid: match[2].toLowerCase() }
    if (!refs.some((r) => r.kind === ref.kind && r.uuid === ref.uuid)) { refs.push(ref) }
  }
  return refs
}

/**
* Looks the record up in Blue Core.
* @param {Array} refs - from returnBluestoreRefs
* @param {function} fetchFn
* @return {Promise<{state: string, updatedAt: number|null}>} - state is 'found' (updatedAt is
*   the latest updated_at of its Instance / Work), 'missing' or 'error'
*/
export async function fetchBluestoreState(refs, fetchFn = fetch) {
  let updatedAt = null
  let failed = false
  for (const { kind, uuid } of refs) {
    try {
      const response = await fetchFn(`${apiBase}/${kind}/${uuid}`, { headers: { Accept: ACCEPT } })
      if (response.status === 404) { continue }
      if (!response.ok) { failed = true; continue }
      const body = await response.json()
      const time = Date.parse(asUtc(String(body.updated_at || body.created_at || '')))
      if (Number.isFinite(time)) {
        updatedAt = Math.max(updatedAt || 0, time)
      } else {
        failed = true
      }
    } catch {
      failed = true
    }
  }
  if (updatedAt) { return { state: 'found', updatedAt } }
  return { state: failed ? 'error' : 'missing', updatedAt: null }
}

/**
* Keeps status.bluestore up to date for the open record.
* @param {object} options
* @param {object} options.status - saveStatus (uses its `bluestore` object)
* @param {function} options.returnProfile - returns the active profile
* @param {function} options.fetchFn
* @return {function} check() - a newer call cancels an older one
*/
export function createBluestoreChecker({ status, returnProfile, fetchFn = fetch }) {
  let generation = 0
  const apply = (result) => Object.assign(status.bluestore, { state: result.state, updatedAt: result.updatedAt })

  return async function check() {
    const run = ++generation
    const refs = returnBluestoreRefs(returnProfile())
    if (!refs.length) {
      apply({ state: 'missing', updatedAt: null })
      return
    }
    if (status.bluestore.state !== 'found') { status.bluestore.state = 'checking' }
    const result = await fetchBluestoreState(refs, fetchFn)
    if (run === generation) { apply(result) }
  }
}
