// #############################################################################
// #########################  Blue Core Publish  ###############################
// ##                                                                         ##
// ## Publishes a Marva record straight to the Blue Core API's Work, Instance ##
// ## and Hub routes, which save it while the request waits. So the editor    ##
// ## finds out at once whether the publish worked, and why if it didn't     ##
// ## (the batch upload hands the record to an Airflow job and can't say).   ##
// ## The record is sent as the RDF/XML Marva builds (application/rdf+xml),   ##
// ## which the API reads back into JSON-LD, as it does for batch uploads.    ##
// ##                                                                         ##
// ## A record is saved in this order:                                       ##
// ##  1. its Work: PUT /works/{uuid} when it's already in Blue Core, or      ##
// ##     POST /works/ when it's new.                                         ##
// ##  2. each Instance: PUT /instances/{uuid}, or POST /instances/.          ##
// ## A Hub is saved on its own with PUT /hubs/{uuid} or POST /hubs/.         ##
// ##                                                                         ##
// ## A record made in Marva is new, and is sent the way Sinopia sends one:   ##
// ## on its own, with no URI (rdf:about="", the API's "the resource being   ##
// ## created"), so Blue Core mints its URI and records no adminMetadata     ##
// ## derivedFrom (Marva's placeholder URI, e.g.                             ##
// ## id.loc.gov/resources/works/e1795…, is no source). Its new Instances    ##
// ## follow, each pointing at the Work's new URI with bf:instanceOf.        ##
// ## A record Marva loaded from outside Blue Core (id.loc.gov, say) is an    ##
// ## ingest instead: it keeps its URIs, which Blue Core records as          ##
// ## derivedFrom, and saving its Work stores its Instances too.             ##
// ##                                                                         ##
// ## The Blue Core URIs given to new records are remembered here (by the     ##
// ## URI Marva uses), so the next publish updates the same record.          ##
// #############################################################################

const BF = 'http://id.loc.gov/ontologies/bibframe/'
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}'
const BLUECORE_PATH = new RegExp(`/(works|instances|hubs)/(${UUID})$`, 'i')
const BLUECORE_RECORD = new RegExp(`/(works|instances|hubs)/${UUID}`, 'i')
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

/**
* Stores Marva URI -> Blue Core URI mappings. Each one is moved to the end of the list, so the
* records used most recently are the last to be dropped when the list is trimmed.
*/
function rememberPublishedUris(mapping) {
  const stored = readPublishedUris()
  for (const [key, value] of Object.entries(mapping)) {
    delete stored[key]
    stored[key] = value
  }
  const keys = Object.keys(stored)
  for (const key of keys.slice(0, Math.max(0, keys.length - PUBLISHED_URI_LIMIT))) { delete stored[key] }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    // storage full or blocked: the record was saved, but the next publish can't tell it's the same one
  }
}

// ---- reading the record ----

const idsOf = (value) => (Array.isArray(value) ? value : [value]).filter(Boolean).map((v) => (typeof v === 'string' ? v : v['@id']))
const rdfAttr = (el, name) => (el.hasAttributeNS(RDF, name) ? el.getAttributeNS(RDF, name) : null)

/** The /works|instances|hubs/{uuid} of a Blue Core URI, or null for any other URI. */
export function returnBluecoreRef(uri) {
  if (!uri || uri.includes('id.loc.gov')) { return null }
  const match = BLUECORE_PATH.exec(uri)
  return match ? { collection: match[1].toLowerCase(), uuid: match[2].toLowerCase() } : null
}

/**
* Reads the record's RDF/XML.
* @param {string} xml
* @return {Document}
*/
export function parseRecord(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const error = doc.getElementsByTagName('parsererror')[0]
  if (error) { throw new Error(`The record's RDF/XML could not be read: ${error.textContent}`) }
  return doc
}

/**
* Each top-level resource with a URI (rdf:about) in the record, with its types. Only the
* children of rdf:RDF are the record: a Work or Instance nested deeper (a related Work under
* bf:relation, another format under bf:otherPhysicalFormat) is a link, not a record to save,
* as in Marva's own export (src/lib/utils_export.js, the BF2MARC package).
*/
function returnNamedResources(doc) {
  const types = new Map()
  for (const el of doc.documentElement.children) {
    const uri = rdfAttr(el, 'about')
    if (!uri) { continue }
    if (!types.has(uri)) { types.set(uri, new Set()) }
    types.get(uri).add((el.namespaceURI || '') + el.localName)
    for (const child of el.children) {
      if (child.namespaceURI === RDF && child.localName === 'type' && rdfAttr(child, 'resource')) {
        types.get(uri).add(rdfAttr(child, 'resource'))
      }
    }
  }
  return types
}

/**
* What a publish saves, in order: the record's Works then Instances, or for a Hub its Hubs.
* @param {Document} doc - the record's RDF/XML (see parseRecord)
* @param {boolean} hub - publishing a Hub
* @return {Array<{collection: string, label: string, uri: string}>}
*/
export function returnResourcesToSave(doc, hub = false) {
  const named = [...returnNamedResources(doc)]
  const resources = (collection, label, test) => named
    .filter(([, types]) => test((name) => types.has(BF + name)))
    .map(([uri]) => ({ collection, label, uri }))
  if (hub) { return resources('hubs', 'Hub', (is) => is('Hub')) }
  return [
    ...resources('works', 'Work', (is) => is('Work') && !is('Hub')),
    ...resources('instances', 'Instance', (is) => is('Instance')),
  ]
}

/** Gives the record new URIs: every rdf:about and rdf:resource found in mapping is replaced (in place). */
export function renameUris(doc, mapping) {
  for (const el of doc.getElementsByTagName('*')) {
    for (const name of ['about', 'resource']) {
      const uri = rdfAttr(el, name)
      if (uri && mapping[uri]) { el.setAttributeNS(RDF, `rdf:${name}`, mapping[uri]) }
    }
  }
  return doc
}

/**
* Whether Marva loaded the record from outside Blue Core (from id.loc.gov, say), so publishing it
* ingests it from there. A record made in Marva, or loaded from Blue Core, wasn't.
* @param {object} profile - the record (Marva's activeProfile)
*/
export function isLoadedFromOutside(profile) {
  const load = ((profile && profile.log) || []).find((entry) => entry && entry.action === 'loadInstance' && entry.from)
  const from = load ? String(load.from) : ''
  return /^https?:\/\//i.test(from) && (from.includes('id.loc.gov') || !BLUECORE_RECORD.test(from))
}

/**
* The RDF/XML one request sends: the record without the new records not saved yet (their
* descriptions, and the links to them). When uri is one of the new records, it's the one being
* created, so it's sent with an empty URI, which the API takes as the resource being created.
* @param {Document} doc - the record (left unchanged)
* @param {string} uri - the resource this request saves
* @param {Set<string>} unsaved - the new records not saved yet
* @return {string}
*/
export function returnRequestBody(doc, uri, unsaved) {
  const copy = doc.cloneNode(true)
  const leaveOut = (u) => unsaved.has(u) && u !== uri
  for (const el of Array.from(copy.getElementsByTagName('*'))) {
    if (!copy.contains(el)) { continue } // inside one left out already
    const about = rdfAttr(el, 'about')
    const resource = rdfAttr(el, 'resource')
    if (leaveOut(resource)) { el.remove(); continue }
    if (leaveOut(about)) {
      // and the property that held it, unless it holds more
      const holder = el.parentNode
      el.remove()
      if (holder !== copy.documentElement && holder.children.length === 0) { holder.remove() }
      continue
    }
    if (unsaved.has(uri) && about === uri) { el.setAttributeNS(RDF, 'rdf:about', '') }
    if (unsaved.has(uri) && resource === uri) { el.setAttributeNS(RDF, 'rdf:resource', '') }
  }
  return new XMLSerializer().serializeToString(copy)
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
* @param {boolean} options.ingest - the record was loaded from outside Blue Core
*   (isLoadedFromOutside): keep its URIs, as its source
* @param {string} options.apiBase - the Blue Core API, e.g. '/api/'
* @param {object} options.headers - the Authorization header
* @param {function} options.fetchFn
* @return {Promise<object>} - in the shape LC's publish() returns: {status: true, postLocation}
*   when it worked (plus `bluecore`, what was saved), {status: false, msg} when it didn't
*/
export async function publishToBluecore(xml, { hub = false, ingest = false, apiBase = '/api/', headers = {}, fetchFn = fetch } = {}) {
  const base = apiBase.replace(/\/*$/, '/')
  const saved = []
  const fail = (message) => {
    const done = saved.length ? ` Already saved: ${saved.map((s) => `${s.label} ${s.uri}`).join(', ')}.` : ''
    return { status: false, postLocation: null, msg: message + done, bluecore: saved }
  }

  let doc
  try {
    doc = parseRecord(xml)
  } catch (error) {
    return fail(error.message)
  }
  // records published before keep their Blue Core URIs, so they're updated, not added again
  const mapping = {}
  const marvaUris = {} // Blue Core URI -> the URI Marva has
  for (const resource of returnResourcesToSave(doc, hub)) {
    const published = returnPublishedUri(resource.uri)
    if (published !== resource.uri) {
      mapping[resource.uri] = published
      marvaUris[published] = resource.uri
    }
  }
  renameUris(doc, mapping)

  const resources = returnResourcesToSave(doc, hub)
  if (!resources.length) { return fail(`There is no ${hub ? 'Hub' : 'Work or Instance'} in this record to publish.`) }
  // the records made in Marva: not in Blue Core yet, and not from anywhere else
  const unsaved = new Set(ingest ? [] : resources.map((r) => r.uri).filter((uri) => !returnBluecoreRef(uri)))

  const request = (method, url, body) => fetchFn(url, {
    method,
    // a save replies with the record ({uri, data, updated_at}); a lookup asks for its JSON-LD
    headers: { ...(body === undefined ? { 'Accept': 'application/ld+json' } : { 'Content-Type': 'application/rdf+xml' }), ...headers },
    body,
  })
  const learn = (newMapping) => {
    if (!Object.keys(newMapping).length) { return }
    Object.assign(mapping, newMapping)
    rememberPublishedUris(newMapping)
    renameUris(doc, newMapping)
  }

  for (const resource of resources) {
    const uri = mapping[resource.uri] || resource.uri
    const ref = returnBluecoreRef(uri)
    const isNew = unsaved.has(uri)
    const data = returnRequestBody(doc, uri, unsaved)
    let response
    try {
      if (ref) {
        response = await request('PUT', `${base}${resource.collection}/${ref.uuid}`, data)
      }
      // not in Blue Core yet (a new record, or one deleted since)
      if (!response || response.status === 404) {
        response = await request('POST', `${base}${resource.collection}/`, data)
      }
    } catch (error) {
      return fail(`Could not reach Blue Core to save the ${resource.label}: ${error.message}`)
    }
    if (!response.ok) { return fail(`Blue Core did not save the ${resource.label} (${await readError(response)}).`) }

    const body = await response.json()
    saved.push({ label: resource.label, uri: body.uri, updatedAt: body.updated_at || null })
    // keep the record's Blue Core URI near the end of the stored list, so it isn't dropped while in use
    const marvaUri = marvaUris[resource.uri] || resource.uri
    if (!isNew && marvaUri !== body.uri) { rememberPublishedUris({ [marvaUri]: body.uri }) }
    if (isNew) {
      unsaved.delete(uri)
      learn({ [uri]: body.uri })
      continue
    }
    learn(returnDerivedFrom(body))

    // an ingested Work stores its Instances too: look up the URIs Blue Core gave them,
    // so each Instance is then updated with PUT under its own URI. This also runs when the
    // Work is already in Blue Core (a publish tried again after a failed lookup), as long as
    // the record has an Instance with no Blue Core URI yet.
    const current = (r) => mapping[r.uri] || r.uri
    const instancesWithoutUri = resources.filter((r) => r.collection === 'instances'
      && !returnBluecoreRef(current(r)) && !unsaved.has(current(r)))
    if (resource.collection === 'works' && instancesWithoutUri.length) {
      const known = new Set(resources.map(current))
      for (const instanceUri of idsOf((body.data || {}).hasInstance || [])) {
        const instanceRef = returnBluecoreRef(instanceUri)
        if (!instanceRef || known.has(instanceUri) || Object.values(mapping).includes(instanceUri)) { continue }
        // without its Blue Core URI the Instance would be POSTed again as a second copy, so stop here
        const lookupFailed = (why) => fail(`Blue Core saved the Work, but could not look up its Instance ${instanceUri} (${why}), so the Instance was not saved. Publish again to finish.`)
        let jsonld
        try {
          const found = await request('GET', `${base}instances/${instanceRef.uuid}`)
          if (!found.ok) { return lookupFailed(await readError(found)) }
          jsonld = await found.json()
        } catch (error) {
          return lookupFailed(error.message)
        }
        learn(returnDerivedFrom({ uri: jsonld['@id'], data: jsonld }))
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
      ingest: isLoadedFromOutside(activeProfile),
      apiBase: urls.publish,
      headers: token ? { 'Authorization': 'Bearer ' + token } : {},
    })
  }
}
