// #############################################################################
// ######################  Blue Core Instance Search  ##########################
// ##                                                                         ##
// ## The Load page searches LC (id.loc.gov suggest2) for instances by LCCN   ##
// ## or keyword. Blue Core routes that search to the Blue Core API           ##
// ## /search/ endpoint instead and returns results in the same shape         ##
// ## utilsNetwork.searchInstanceByLCCN returns, so Load.vue works unchanged.  ##
// #############################################################################

// Base URL for Bluecore API calls
const bluecoreApiBase = (import.meta.env.VITE_BLUECORE_API_PATH || '/api/').replace(/\/+$/, '')

const PAGE_SIZE = 25

// Last-updated time of each search result, keyed by the result's idURL, so
// fetchLastSystemDate can answer without going to BFDB.
const lastUpdated = {}

// True when this environment searches the Blue Core API instead of LC
export function isBluecoreSearch(returnUrls) {
  return !!(returnUrls && returnUrls.bluecoreSearch)
}

// Stand-in for utilsNetwork.fetchLastSystemDate for Blue Core results.
// Returns the updated_at date, or undefined when the URL is not a Blue Core result.
export function bluecoreLastSystemDate(url) {
  return lastUpdated[url]
}

// Text of a JSON-LD value: "x", {"@value": "x"}, or an array of either.
function textOf(value) {
  if (value == null) return ''
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join(' ')
  if (typeof value === 'object') return textOf(value['@value'])
  return String(value).trim()
}

// The value of the first key ending in one of the names (full IRI or short term).
function prop(node, name) {
  for (const key in node) {
    if (key === name || key.endsWith('/' + name) || key.endsWith(':' + name)) return node[key]
  }
  return undefined
}

function asArray(value) {
  return value == null ? [] : Array.isArray(value) ? value : [value]
}

// Every JSON-LD node in the data (expanded list, @graph, or framed and nested),
// indexed by @id so blank-node references can be followed.
function indexNodes(data) {
  const nodes = []
  const byId = {}
  const walk = (value) => {
    if (Array.isArray(value)) return value.forEach(walk)
    if (!value || typeof value !== 'object') return
    if (value['@id'] || value['@type']) {
      nodes.push(value)
      // a bare {"@id": ...} reference must not replace the full node
      if (value['@id'] && (!byId[value['@id']] || Object.keys(value).length > 1)) byId[value['@id']] = value
    }
    for (const key in value) {
      if (key !== '@context') walk(value[key])
    }
  }
  walk(data)
  return { nodes, byId }
}

// The API stores and returns UTC times without a zone ("2026-11-11T13:39:37.97").
// JS reads a zoneless timestamp as local time, which shifts it by the browser's
// UTC offset, so mark it as UTC.
export function asUtc(timestamp) {
  return /(Z|[+-]\d{2}:?\d{2})$/i.test(timestamp) ? timestamp : timestamp + 'Z'
}

function isVariantTitle(node) {
  return asArray(node['@type'] || node.type).some((t) => /VariantTitle$/.test(String(t)))
}

// A display title for an Instance: its title proper, else a variant title,
// else any mainTitle in the data.
export function bluecoreInstanceTitle(resource) {
  const { nodes, byId } = indexNodes(resource.data)
  const instance = byId[resource.uri] || nodes[0] || {}

  const titles = asArray(prop(instance, 'title')).map((t) => (t && t['@id'] && byId[t['@id']]) || t)
  const ordered = [...titles.filter((t) => !isVariantTitle(t)), ...titles.filter(isVariantTitle)]

  for (const title of ordered) {
    const main = textOf(prop(title, 'mainTitle'))
    if (main) {
      const sub = textOf(prop(title, 'subtitle'))
      return sub ? `${main} : ${sub}` : main
    }
  }

  for (const node of nodes) {
    const main = textOf(prop(node, 'mainTitle'))
    if (main) return main
  }

  return resource.uuid || resource.uri || ''
}

// GET the Blue Core API search endpoint for instances
async function fetchInstances(searchUrl, query, scope) {
  const params = new URLSearchParams({ q: query, type: 'instances', limit: String(PAGE_SIZE) })
  if (scope) params.set('scope', scope)
  const token = window.localStorage.getItem('marva_jwt')
  const response = await fetch(`${searchUrl}?${params}`, {
    headers: {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': 'Bearer ' + token } : {})
    }
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const content = await response.json()
  return content.results || []
}

// Stand-in for utilsNetwork.searchInstanceByLCCN.
// Tries an exact identifier lookup (LCCN, ISBN, ISSN, DOI) first, then falls
// back to a keyword search so a title or author also finds instances.
export async function searchInstancesBluecore(searchUrl, query) {
  query = (query || '').trim()
  try {
    let results = await fetchInstances(searchUrl, query, 'identifier')
    if (results.length === 0) results = await fetchInstances(searchUrl, query)

    return results.map((r) => {
      // Load through the API on this origin; Marva asks it for CBD XML.
      // Absolute, because Load.vue only looks up the last-edited date for http URLs.
      const apiUrl = r.uuid ? new URL(`${bluecoreApiBase}/instances/${r.uuid}`, window.location.origin).href : r.uri
      if (r.updated_at) lastUpdated[apiUrl] = asUtc(r.updated_at)
      return {
        label: bluecoreInstanceTitle(r),
        bfdbURL: r.uri, // the instance's own page (HTML for browsers)
        linkLabel: 'BF Instance',
        dateTooltip: 'When record was loaded/edited in Bluecore',
        idURL: apiUrl,
        bfdbPackageURL: apiUrl
      }
    })
  } catch (err) {
    console.error('Bluecore search failed', err)
    return ['Error searching Blue Core']
  }
}
