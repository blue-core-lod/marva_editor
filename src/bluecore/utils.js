// #############################################################################
// ###################  Blue Core Utility Functions  ###########################
// ##                                                                         ##
// ## Blue Core specific utility functions will be used  here.                ##
// #############################################################################

import short from 'short-uuid'
import { BCLUP_BASE, BCLUP_GETTY_MODE, BCLUP_HOMOSAURUS_MODE, BCLUP_SEARCH_MODES, BCLUP_SOURCE, NS_BF_SOURCE, NS_RDF_LABEL } from '@/bluecore/constants';

// Base URL for Bluecore API calls
const bluecoreApiBase = import.meta.env.VITE_BLUECORE_API_PATH.replace(/\/+$/, '')
// UUID matcher used for UUID input
const uuidOnlyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i


// Splits an input URL string into [path, querySuffix]
function splitPathAndQuery(input) {
  const value = input.trim()
  const queryIndex = value.indexOf('?')
  return queryIndex === -1 ? [value, ''] : [value.slice(0, queryIndex), value.slice(queryIndex)]
}

// Return true when input is just a UUID
export function isBluecoreUuidInput(input) {
  if (typeof input !== 'string') return false
  const [path] = splitPathAndQuery(input)
  return uuidOnlyPattern.test(path)
}

// Return True when URL path is /instances/{UUID}
export function isBluecoreInstancePath(input) {
  if (typeof input !== 'string') return false
  const [path] = splitPathAndQuery(input)
  const normalizedPath = path.replace(/\/+$/, '')
  const lastSegment = normalizedPath.split('/').pop()
  return /\/instances\//i.test(normalizedPath) && uuidOnlyPattern.test(lastSegment)
}

// Normalizes UUID-only input to native /instances/{UUID}
export function resolveBluecoreCbdUrl(input) {
  if (typeof input !== 'string') return input
  const [path, query] = splitPathAndQuery(input)
  return uuidOnlyPattern.test(path) ? `${bluecoreApiBase}/instances/${path}${query}` : `${path}${query}`
}

// Extracts a `resource` target to auto-load from a route query object or a raw
// query string, e.g. a Bluecore redirect like
// /marva/?resource=http://localhost:3000/instances/{UUID}.
// Returns the resolved CBD URL ready to load, or null when no resource is present.
function returnBluecoreAutoLoadResource(query) {
  let resource = null
  if (query && typeof query === 'object') {
    resource = query.resource || null
  } else if (typeof query === 'string') {
    const params = new URLSearchParams(query.startsWith('?') ? query : `?${query}`)
    resource = params.get('resource')
  }
  if (!resource || typeof resource !== 'string') return null
  // Accepts a full instance URL or a bare UUID; resolveBluecoreCbdUrl normalizes both.
  return resolveBluecoreCbdUrl(resource.trim())
}

// Auto-loads an instance passed via `?resource=` (e.g. a Bluecore redirect)
export function startBluecoreResourceAutoLoad(loadViewModel, intervalMs = 600) {
  const interval = setInterval(() => {
    const resourceUrl = returnBluecoreAutoLoadResource(loadViewModel.$route && loadViewModel.$route.query)
    if (!resourceUrl) {
      clearInterval(interval)
      return
    }
    // wait until profiles are ready and a default profile is known, then load
    if (loadViewModel.defaultProfile && loadViewModel.startingPointsFiltered && loadViewModel.startingPointsFiltered.length > 0) {
      loadViewModel.urlToLoad = resourceUrl
      loadViewModel.urlToLoadIsHttp = true
      loadViewModel.loadUrl(loadViewModel.defaultProfile)
      clearInterval(interval)
    }
  }, intervalMs)
  return interval
}

// Merges request options while combining headers
export function addBluecoreHeaders(baseOptions = {}, overrideOptions = {}) {
  return { ...baseOptions, ...overrideOptions, headers: { ...(baseOptions.headers || {}), ...(overrideOptions.headers || {}) }}
}

// True when the scratch-pad (ldpjs) backend is not configured for this environment.
// Bluecore has no ldpjs backend yet...
// so skip the save instead of firing a failed request and alerting the user.
export function isLdpjsDisabled(returnUrls) {
  return !returnUrls || !returnUrls.ldpjs || returnUrls.ldpjs.trim() === ''
}

// Applies Bluecore URL normalization
export function applyBluecoreLookupRequest(url, options = {}) {
  const resolvedUrl = resolveBluecoreCbdUrl(url)
  const isInstancePath = isBluecoreInstancePath(resolvedUrl)
  const requestOptions = isInstancePath ? addBluecoreHeaders(options, { headers: { Accept: 'application/cbd+xml, application/json, */*;q=0.8' } }) : options

  return { url: resolvedUrl, options: requestOptions, cbd: isInstancePath }
}

export function generateBclupResultEntry(hit, length) {
  return {
    collections: [],
    label: hit.label,
    suggestLabel: hit.label,
    uri: hit.uri,
    literal: false,
    depreciated: false,
    extra: {
      rdftypes: ['Topic'],
      type: 'madsrdf:Topic',
      variantLabels: [],
      relateds: [],
      hasEarlierEstablishedForms: [],
      hasLaterEstablishedForms: [],
      broaders: [],
      collections: [],
    },
    total: length,
    bclup: true,
    undifferentiated: false,
    subdivision: false,
    count: 0,
  }
}

export function generateSuggestLabelPostfix(mode, gettySearchType = '') {
  if (mode == BCLUP_GETTY_MODE) {
    return ' [Getty ' + gettySearchType.toUpperCase() + ']'
  } else if (mode == BCLUP_HOMOSAURUS_MODE) {
    return ' [Homosaurus]'
  }
  return ''
}

export function isBclupMode(mode) {
  return BCLUP_SEARCH_MODES.includes(mode)
}

export function isBclupSource(uri) {
  if (!uri || typeof uri !== 'string') return false
  for (const source of BCLUP_SOURCE) {
    if (uri.indexOf(source.prefix) > -1) {
      return true
    }
  }
  return false
}

export function buildEmptySubjectSearchResults() {
  return {
    names: [],
    subjectsSimple: [],
    subjectsComplex: [],
    subjectsChildren: [],
    subjectsChildrenComplex: [],
    hierarchicalGeographic: [],
    exact: [],
    entities: [],
    bclup: [],
  }
}

async function fetchBclupHits(searchVal, mode, gettySearchType = 'aat') {
  const encodedSearchVal = encodeURIComponent(searchVal)
  const urlsByMode = {
    [BCLUP_GETTY_MODE]: BCLUP_BASE + '/getty_direct/' + gettySearchType + '?q=' + encodedSearchVal,
    [BCLUP_HOMOSAURUS_MODE]: BCLUP_BASE + '/homosaurus_direct?q=' + encodedSearchVal,
  }

  const targetUrl = urlsByMode[mode]
  if (!targetUrl) return []

  try {
    const response = await fetch(targetUrl, { method: 'GET' })
    if (!response.ok) return []

    const payload = await response.json()
    if (!Array.isArray(payload)) return []

    const hits = payload
      .filter((hit) => hit && typeof hit.label == 'string' && typeof hit.uri == 'string')
      .slice(0, 10)

    const count = hits.length
    const mapped = hits.map((hit) => {
      const result = generateBclupResultEntry(hit, count)
      result.suggestLabel = result.label + generateSuggestLabelPostfix(mode, gettySearchType)
      return result
    })

    if (searchVal && searchVal.length > 0) {
      mapped.push({ label: searchVal, uri: null, literal: true, extra: '' })
    }

    return mapped
  } catch (error) {
    return []
  }
}

export async function subjectSearchWithBclup(utilsNetwork, searchVal, complexVal, complexSub, mode, gettySearchType = 'aat') {
  if (!isBclupMode(mode)) {
    const results = await utilsNetwork.subjectSearch(searchVal, complexVal, complexSub, mode)
    if (!Object.prototype.hasOwnProperty.call(results, 'bclup')) {
      results.bclup = []
    }
    return results
  }

  const results = buildEmptySubjectSearchResults()
  results.bclup = await fetchBclupHits(searchVal, mode, gettySearchType)
  return results
}

// Change source from lc if user clicked bcl-up entry
export function handleBclupSource(h, currentUserValuePos) {
  for (const source of BCLUP_SOURCE) {
    if (h['uri'] && h['uri'].indexOf(source['prefix']) > -1) {
      currentUserValuePos[NS_BF_SOURCE] = [
        {
          "@guid": short.generate(),
          "@type": "http://id.loc.gov/ontologies/bibframe/Source",
          "@id": source['uri'],
          [NS_RDF_LABEL]: [
            {
              "@guid": short.generate(),
              [NS_RDF_LABEL]: source['label']
            }
          ]
        }
    ]
      return true
    }
  }
  return false
}
