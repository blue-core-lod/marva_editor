// #############################################################################
// ###################  Blue Core Local Scratch Pad  ###########################
// ##                                                                         ##
// ## Marva normally saves in-progress records to the ldpjs backend           ##
// ## Blue Core has no ldpjs backend yet, so use localStorage                 ##
// #############################################################################

const KEY_PREFIX = 'bluecore:record:'
// Companion key holding the last-saved unix time (seconds) for a record.
const TS_PREFIX = 'bluecore:ts:'

// lclocal namespace used by the void:DatasetDescription metadata block that
// utils_export embeds in every saved record (see utils_export.buildXML). This is
// the same metadata the ldpjs backend parses to build the myrecords/allrecords
// responses, so it can read it right back out of localStorage.
const LCLOCAL_NS = 'http://id.loc.gov/ontologies/lclocal/'

// True when no ldpjs backend is configured, i.e. use the local scratch pad instead.
export function isLocalScratchpad(returnUrls) {
  return !returnUrls || !returnUrls.ldpjs || returnUrls.ldpjs.trim() === ''
}

// Stand-in for utilsNetwork.saveRecord -- returns whether it saved.
export function saveRecordLocal(xml, eId) {
  if (!eId) return false
  try {
    window.localStorage.setItem(KEY_PREFIX + eId, xml)
    // remember when this record was last saved so the Records list can show
    // "last edited" and sort by recency the way the backend does
    window.localStorage.setItem(TS_PREFIX + eId, String(Math.floor(Date.now() / 1000)))
    return true
  } catch (err) {
    // quota exceeded, private-mode restrictions, etc.
    console.error('Bluecore local scratch pad: could not save record', err)
    return false
  }
}

// Stand-in for utilsNetwork.loadSavedRecord -- returns the saved XML, or null.
export function loadRecordLocal(eId) {
  if (!eId) return null
  try {
    return window.localStorage.getItem(KEY_PREFIX + eId)
  } catch (err) {
    console.error('Bluecore local scratch pad: could not load record', err)
    return null
  }
}

// Pull one lclocal:<name> text value out of the void:DatasetDescription block.
function readMeta(dataset, name) {
  if (!dataset) return ''
  let el = dataset.getElementsByTagNameNS(LCLOCAL_NS, name)[0]
  return el ? (el.textContent || '').trim() : ''
}

// Pull every lclocal:<name> text value (repeatable fields) into an array.
function readMetaAll(dataset, name) {
  if (!dataset) return []
  let out = []
  for (let el of dataset.getElementsByTagNameNS(LCLOCAL_NS, name)) {
    let v = (el.textContent || '').trim()
    if (v) out.push(v)
  }
  return out
}

// Parse a stored record's XML into the same shape utilsNetwork.searchSavedRecords
// returns for a backend record.
function parseRecord(eId, xml) {
  let record = {
    eid: eId,
    title: '',
    contributor: '',
    lccn: '',
    user: '',
    status: 'unposted',
    typeid: '',
    rstused: [],
    externalid: [],
    timestamp: 0,
    time: '',
  }

  try {
    let doc = new DOMParser().parseFromString(xml, 'application/xml')
    let dataset = doc.getElementsByTagNameNS('http://rdfs.org/ns/void#', 'DatasetDescription')[0]

    record.title = readMeta(dataset, 'title')
    record.contributor = readMeta(dataset, 'contributor')
    record.lccn = readMeta(dataset, 'lccn')
    record.user = readMeta(dataset, 'user')
    record.status = readMeta(dataset, 'status') || 'unposted'
    record.typeid = readMeta(dataset, 'typeid')
    record.rstused = readMetaAll(dataset, 'rtsused')
    record.externalid = readMetaAll(dataset, 'externalid')
    // eid lives in the metadata too, but the storage key is authoritative
    record.eid = readMeta(dataset, 'eid') || eId
  } catch (err) {
    console.error('Bluecore local scratch pad: could not parse saved record', eId, err)
  }

  // timestamp/time are not part of the record XML -- take them from the
  // companion save-time entry, falling back to "now".
  let ts = parseInt(window.localStorage.getItem(TS_PREFIX + eId), 10)
  if (isNaN(ts)) ts = Math.floor(Date.now() / 1000)
  record.timestamp = ts
  record.time = new Date(ts * 1000).toISOString()

  return record
}

// Reopen a posted record as a fresh, unposted working copy.
//
// In native Marva, "Load from BFDB" pulls the published resource into a brand new
// editing session with a new working id, so the original posted record is left
// untouched and the edits become a new draft. There is no BFDB here, so replicate
// that: clone the saved XML under a new eid with its status reset to "unposted",
// leave the original entry alone, and return the eid to open. If the record was
// not actually posted (or anything goes wrong) just return the original eid so it
// continues editing in place.
export function reopenPostedRecordLocal(eId) {
  let xml = loadRecordLocal(eId)
  if (!xml) return eId
  try {
    let doc = new DOMParser().parseFromString(xml, 'application/xml')
    let dataset = doc.getElementsByTagNameNS('http://rdfs.org/ns/void#', 'DatasetDescription')[0]
    let statusEl = dataset ? dataset.getElementsByTagNameNS(LCLOCAL_NS, 'status')[0] : null

    // only fork records that were actually posted; otherwise keep the same draft
    if (!statusEl || (statusEl.textContent || '').trim() !== 'published') return eId

    let newEid = 'e' + Date.now().toString()

    let eidEl = dataset.getElementsByTagNameNS(LCLOCAL_NS, 'eid')[0]
    if (eidEl) eidEl.textContent = newEid
    statusEl.textContent = 'unposted'

    let newXml = new XMLSerializer().serializeToString(doc)
    if (!saveRecordLocal(newXml, newEid)) return eId
    return newEid
  } catch (err) {
    console.error('Bluecore local scratch pad: could not fork posted record', eId, err)
    return eId
  }
}

// Stand-in for utilsNetwork.searchSavedRecords -- lists the locally saved
// records (optionally filtered by a search string), newest first.
export function searchSavedRecordsLocal(search) {
  let records = []
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      let key = window.localStorage.key(i)
      if (!key || !key.startsWith(KEY_PREFIX)) continue
      let eId = key.slice(KEY_PREFIX.length)
      let xml = window.localStorage.getItem(key)
      if (!xml) continue
      records.push(parseRecord(eId, xml))
    }
  } catch (err) {
    console.error('Bluecore local scratch pad: could not list saved records', err)
    return []
  }

  if (search) {
    let needle = String(search).trim().toLowerCase()
    records = records.filter(r =>
      (r.title && r.title.toLowerCase().includes(needle)) ||
      (r.lccn && r.lccn.toLowerCase().includes(needle)) ||
      (r.eid && r.eid.toLowerCase().includes(needle)) ||
      (r.contributor && r.contributor.toLowerCase().includes(needle))
    )
  }

  records.sort((a, b) => b.timestamp - a.timestamp)
  return records
}
