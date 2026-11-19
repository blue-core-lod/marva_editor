// #############################################################################
// #########################  Blue Core Publish  ###############################
// ##                                                                         ##
// ## Publishes a Marva record straight to the Blue Core API's Work, Instance ##
// ## and Hub routes, which save it while the request waits. So the editor    ##
// ## finds out at once whether the publish worked, and why if it didn't     ##
// ## (the batch upload hands the record to an Airflow job and can't say).   ##
// ##                                                                         ##
// ## A record is saved in this order:                                       ##
// ##  1. its Work: PUT /works/{uuid} when it's already in Blue Core, or      ##
// ##     POST /works/ when it's new. Saving a new Work also stores its       ##
// ##     Instances, under Blue Core URIs it mints for them.                  ##
// ##  2. each Instance: PUT /instances/{uuid}, or POST /instances/ if it's  ##
// ##     still new.                                                          ##
// ## A Hub is saved on its own with PUT /hubs/{uuid} or POST /hubs/.         ##
// ##                                                                         ##
// ## Blue Core gives new records URIs of its own, and keeps the one Marva    ##
// ## sent as adminMetadata derivedFrom. Those URIs are remembered here       ##
// ## (by the URI Marva uses), so the next publish updates the same record.  ##
// #############################################################################

import { rdfxmlToJsonld } from '@/bluecore/rdfxml'

const BF = 'http://id.loc.gov/ontologies/bibframe/'
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const BLUECORE_PATH = new RegExp(`/(works|instances|hubs)/(${UUID})$`, 'i')
const STORAGE_KEY = 'bluecore-published-uris'
export const PUBLISHED_URI_LIMIT = 500

// ---- the Blue Core URIs of records published from this browser ----

function readPublishedUris() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

/**
* @param {string} uri - a URI as Marva has it
* @return {string} - the Blue Core URI it was published under, or uri itself
*/
export function returnPublishedUri(uri) {
  return readPublishedUris()[uri] || uri
}

function rememberPublishedUris(mapping) {
  const stored = { ...readPublishedUris(), ...mapping }
  const keys = Object.keys(stored)
  for (const key of keys.slice(0, Math.max(0, keys.length - PUBLISHED_URI_LIMIT))) { delete stored[key] }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // storage full or blocked: the next publish still works, Blue Core finds the record by derivedFrom
  }
}

// ---- reading the record ----

const typed = (node, name) => (node['@type'] || []).includes(BF + name)
const idsOf = (value) => (Array.isArray(value) ? value : [value]).filter(Boolean).map((v) => (typeof v === 'string' ? v : v['@id']))

/** The /works|instances|hubs/{uuid} of a Blue Core URI, or null for any other URI. */
export function returnBluecoreRef(uri) {
  if (!uri || uri.includes('id.loc.gov')) { return null }
  const match = BLUECORE_PATH.exec(uri)
  return match ? { collection: match[1].toLowerCase(), uuid: match[2].toLowerCase() } : null
}

/**
* What a publish saves, in order: the record's Works then Instances, or for a Hub its Hubs.
* @param {Array<object>} nodes - the record as expanded JSON-LD
* @param {boolean} hub - publishing a Hub
* @return {Array<{collection: string, label: string, uri: string}>}
*/
export function returnResourcesToSave(nodes, hub = false) {
  const named = nodes.filter((node) => !node['@id'].startsWith('_:'))
  const resources = (collection, label, test) => named.filter(test).map((node) => ({ collection, label, uri: node['@id'] }))
  if (hub) { return resources('hubs', 'Hub', (n) => typed(n, 'Hub')) }
  return [
    ...resources('works', 'Work', (n) => typed(n, 'Work') && !typed(n, 'Hub')),
    ...resources('instances', 'Instance', (n) => typed(n, 'Instance')),
  ]
}

/** Gives the nodes new URIs: every @id found in mapping is replaced. */
export function renameUris(nodes, mapping) {
  const rename = (value) => {
    if (Array.isArray(value)) { return value.map(rename) }
    if (value && typeof value === 'object') {
      const copy = {}
      for (const key in value) {
        copy[key] = key === '@id' && mapping[value[key]] ? mapping[value[key]] : rename(value[key])
      }
      return copy
    }
    return value
  }
  return rename(nodes)
}

/** The URIs a saved record came from (its adminMetadata derivedFrom), mapped to its Blue Core URI. */
export function returnDerivedFrom(saved) {
  const mapping = {}
  const data = (saved && saved.data) || {}
  for (const admin of [].concat(data.adminMetadata || [])) {
    for (const source of idsOf(admin.derivedFrom || [])) {
      if (source && source !== saved.uri) { mapping[source] = saved.uri }
    }
  }
  return mapping
}

// ---- talking to the API ----

async function readError(response) {
  let detail = ''
  try {
    const body = await response.json()
    detail = Array.isArray(body.detail)
      ? body.detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
      : (body.detail || JSON.stringify(body))
  } catch {
    detail = response.statusText || 'no details'
  }
  return `${response.status}: ${detail}`
}

/**
* Publishes a record to Blue Core.
* @param {string} xml - the record's RDF/XML, as LC's publish() is given it
* @param {object} options
* @param {boolean} options.hub - publishing a Hub
* @param {string} options.apiBase - the Blue Core API, e.g. '/api/'
* @param {object} options.headers - the Authorization header
* @param {function} options.fetchFn
* @return {Promise<object>} - in the shape LC's publish() returns: {status: true, postLocation}
*   when it worked (plus `bluecore`, what was saved), {status: false, msg} when it didn't
*/
export async function publishToBluecore(xml, { hub = false, apiBase = '/api/', headers = {}, fetchFn = fetch } = {}) {
  const base = apiBase.replace(/\/*$/, '/')
  const saved = []
  const fail = (message) => {
    const done = saved.length ? ` Already saved: ${saved.map((s) => `${s.label} ${s.uri}`).join(', ')}.` : ''
    return { status: false, postLocation: null, msg: message + done, bluecore: saved }
  }

  let nodes
  try {
    nodes = rdfxmlToJsonld(xml)
  } catch (error) {
    return fail(error.message)
  }
  // records published before keep their Blue Core URIs, so they're updated, not added again
  const mapping = {}
  for (const resource of returnResourcesToSave(nodes, hub)) {
    const published = returnPublishedUri(resource.uri)
    if (published !== resource.uri) { mapping[resource.uri] = published }
  }
  nodes = renameUris(nodes, mapping)

  const resources = returnResourcesToSave(nodes, hub)
  if (!resources.length) { return fail(`There is no ${hub ? 'Hub' : 'Work or Instance'} in this record to publish.`) }

  const request = (method, url, body) => fetchFn(url, {
    method,
    headers: { 'Accept': 'application/vnd.sinopia+json', 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const learn = (newMapping) => {
    if (!Object.keys(newMapping).length) { return }
    Object.assign(mapping, newMapping)
    rememberPublishedUris(newMapping)
    nodes = renameUris(nodes, newMapping)
  }

  for (const resource of resources) {
    const uri = mapping[resource.uri] || resource.uri
    const ref = returnBluecoreRef(uri)
    const data = JSON.stringify(nodes)
    let response
    try {
      if (ref) {
        response = await request('PUT', `${base}${resource.collection}/${ref.uuid}`, { data })
      }
      // not in Blue Core yet (a new record, or one deleted since)
      if (!response || response.status === 404) {
        response = await request('POST', `${base}${resource.collection}/`, { data })
      }
    } catch (error) {
      return fail(`Could not reach Blue Core to save the ${resource.label}: ${error.message}`)
    }
    if (!response.ok) { return fail(`Blue Core did not save the ${resource.label} (${await readError(response)}).`) }

    const body = await response.json()
    saved.push({ label: resource.label, uri: body.uri, updatedAt: body.updated_at || null })
    learn(returnDerivedFrom(body))

    // a new Work stores its Instances too: look up the URIs Blue Core gave them,
    // so each Instance is then updated with PUT under its own URI
    if (resource.collection === 'works' && !ref) {
      for (const instanceUri of idsOf((body.data || {}).hasInstance || [])) {
        const instanceRef = returnBluecoreRef(instanceUri)
        if (!instanceRef || Object.values(mapping).includes(instanceUri)) { continue }
        try {
          const found = await request('GET', `${base}instances/${instanceRef.uuid}`)
          if (found.ok) { learn(returnDerivedFrom(await found.json())) }
        } catch {
          // the Instance is still saved below, with POST
        }
      }
    }
  }

  const main = saved.find((s) => s.label === 'Instance') || saved[0]
  return { status: true, postLocation: main ? main.uri : null, bluecore: saved }
}

/**
* Points the "View Work / View Instance" links LC's publish window shows at the records
* Blue Core saved. LC builds them from the record's own URIs (id.loc.gov, or preprod), which
* for a new record aren't where Blue Core stored it.
* @param {object} result - what profileStore.publishRecord() returned (changed in place)
* @return {object} result
*/
export function applyBluecoreResourceLinks(result) {
  const saved = (result && result.status && Array.isArray(result.bluecore)) ? result.bluecore.filter((s) => s.uri) : []
  if (saved.length) {
    result.resourceLinks = saved.map((s) => ({ type: s.label, url: s.uri, env: 'Blue Core' }))
  }
  return result
}

/**
* Makes LC's utilsNetwork.publish() publish to Blue Core, without changing LC's code: every
* LC publish (Post, Hubs, Hub stubs) calls it. It publishes to the Blue Core API that the
* `publish` url in ../bluecore/environment.js names. LC's own publish still runs when the
* environment fakes posting (devFakePosting).
* @param {object} utilsNetwork - LC's network helpers (src/lib/utils_network.js)
* @param {function} returnUrls - returns the config store's returnUrls
* @param {function} beforePublish - optional, awaited with the record's eid before it's sent
*   (saves it as a draft, so the edits are kept even if the publish fails)
*/
export function installBluecorePublish(utilsNetwork, returnUrls, beforePublish = null) {
  const lcPublish = utilsNetwork.publish
  utilsNetwork.publish = async function (xml, eid, activeProfile) {
    const urls = returnUrls() || {}
    if (urls.devFakePosting) { return lcPublish.call(this, xml, eid, activeProfile) }
    if (beforePublish) {
      try {
        await beforePublish(eid)
      } catch (error) {
        console.warn('Blue Core: the draft was not saved before publishing', error)
      }
    }
    let token = null
    try { token = window.localStorage.getItem('marva_jwt') } catch { /* signed out */ }
    return publishToBluecore(xml, {
      hub: Boolean(activeProfile && activeProfile.id === 'Hub'),
      apiBase: urls.publish,
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    })
  }
}
