// BLUECORE: tests for publishing to the Blue Core API (../publish.js).
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  applyBluecoreResourceLinks,
  installBluecorePublish,
  isLoadedFromOutside,
  parseRecord,
  publishToBluecore,
  renameUris,
  returnBluecoreRef,
  returnDerivedFrom,
  returnPublishedUri,
  returnRequestBody,
  returnResourcesToSave,
} from '@/bluecore/publish'

const BF = 'http://id.loc.gov/ontologies/bibframe/'
const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const LC_WORK = 'http://id.loc.gov/resources/works/11111111-1111-4111-8111-111111111111'
const LC_INSTANCE = 'http://id.loc.gov/resources/instances/22222222-2222-4222-8222-222222222222'
// the placeholder URIs Marva gives a record made in Marva
const NEW_WORK = 'http://id.loc.gov/resources/works/e1795181630835'
const NEW_INSTANCE = 'http://id.loc.gov/resources/instances/e1795181630835'
const BC_WORK = 'https://bcld.info/works/33333333-3333-4333-8333-333333333333'
const BC_INSTANCE = 'https://bcld.info/instances/44444444-4444-4444-8444-444444444444'
const BC_HUB = 'https://bcld.info/hubs/55555555-5555-4555-8555-555555555555'

const rdf = (body) => `<rdf:RDF xmlns:rdf="${RDF}" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:bf="${BF}">${body}</rdf:RDF>`
const record = (work, instance) => rdf(`
  <bf:Work rdf:about="${work}">
    <bf:title><bf:Title><bf:mainTitle>A title</bf:mainTitle></bf:Title></bf:title>
    <bf:hasInstance rdf:resource="${instance}"/>
  </bf:Work>
  <bf:Instance rdf:about="${instance}">
    <bf:instanceOf rdf:resource="${work}"/>
  </bf:Instance>`)

const response = (body, status = 200) => Promise.resolve({
  status, ok: status < 400, statusText: 'Error', json: () => Promise.resolve(body),
})
const saved = (uri, derivedFrom, extra = {}) => ({
  uri, updated_at: '2026-11-19T10:00:00', data: { adminMetadata: [{ derivedFrom: [{ '@id': derivedFrom }] }], ...extra },
})
// a fake API: route(method, url, body) returns the response
const api = (route) => vi.fn((url, options) => route(options.method, url, options.body || null))
// the RDF/XML a call sent
const sent = (fetchFn, i) => fetchFn.mock.calls[i][1].body

beforeEach(() => window.localStorage.clear())

describe('reading a record to publish', () => {
  it('saves Works before Instances, and Hubs on their own', () => {
    const doc = parseRecord(record(LC_WORK, LC_INSTANCE))
    expect(returnResourcesToSave(doc)).toEqual([
      { collection: 'works', label: 'Work', uri: LC_WORK },
      { collection: 'instances', label: 'Instance', uri: LC_INSTANCE },
    ])
    const hub = parseRecord(rdf(`<bf:Hub rdf:about="${BC_HUB}"><rdf:type rdf:resource="${BF}Work"/></bf:Hub>`))
    expect(returnResourcesToSave(hub)).toEqual([])
    expect(returnResourcesToSave(hub, true)).toEqual([{ collection: 'hubs', label: 'Hub', uri: BC_HUB }])
  })

  it('tells records loaded from outside Blue Core from ones made in Marva or loaded from Blue Core', () => {
    const loaded = (from) => ({ log: [{ action: 'loadInstance', from }] })
    expect(isLoadedFromOutside(loaded('https://id.loc.gov/resources/instances/12618072.html'))).toBe(true)
    expect(isLoadedFromOutside(loaded(`${BC_INSTANCE}`))).toBe(false)
    expect(isLoadedFromOutside(loaded('44444444-4444-4444-8444-444444444444'))).toBe(false)
    expect(isLoadedFromOutside({ log: [{ action: 'createWorkInstance' }] })).toBe(false)
    expect(isLoadedFromOutside({ id: 'Hub' })).toBe(false)
    expect(isLoadedFromOutside(null)).toBe(false)
  })

  it('sends a new record with an empty URI, without the other new records', () => {
    const doc = parseRecord(rdf(`
      <bf:Work rdf:about="${NEW_WORK}">
        <bf:hasInstance><bf:Instance rdf:about="${NEW_INSTANCE}"><bf:instanceOf rdf:resource="${NEW_WORK}"/></bf:Instance></bf:hasInstance>
        <bf:language rdf:resource="http://id.loc.gov/vocabulary/languages/eng"/>
      </bf:Work>`))
    const unsaved = new Set([NEW_WORK, NEW_INSTANCE])
    const work = returnRequestBody(doc, NEW_WORK, unsaved)
    expect(work).not.toContain('e1795181630835')
    expect(work).not.toContain('hasInstance')
    expect(work).toContain('<bf:Work rdf:about="">')
    expect(work).toContain('languages/eng')
    // the record itself is left as it was
    expect(new XMLSerializer().serializeToString(doc)).toContain(NEW_INSTANCE)
    // once the Work is saved, the Instance goes with a link to it
    expect(returnRequestBody(renameUris(doc, { [NEW_WORK]: BC_WORK }), NEW_INSTANCE, new Set([NEW_INSTANCE])))
      .toContain(`<bf:Instance rdf:about=""><bf:instanceOf rdf:resource="${BC_WORK}"/>`)
  })

  it('tells Blue Core URIs from others', () => {
    expect(returnBluecoreRef(BC_WORK)).toEqual({ collection: 'works', uuid: '33333333-3333-4333-8333-333333333333' })
    expect(returnBluecoreRef(LC_WORK)).toBeNull()
    expect(returnBluecoreRef('https://bcld.info/works/not-a-uuid')).toBeNull()
  })

  it('renames URIs anywhere in the record, and reads derivedFrom', () => {
    const doc = renameUris(parseRecord(record(LC_WORK, LC_INSTANCE)), { [LC_WORK]: BC_WORK })
    const xml = new XMLSerializer().serializeToString(doc)
    expect(xml).not.toContain(LC_WORK)
    expect(xml).toContain(`<bf:Work rdf:about="${BC_WORK}">`)
    expect(xml).toContain(`<bf:instanceOf rdf:resource="${BC_WORK}"/>`)
    expect(returnDerivedFrom(saved(BC_WORK, LC_WORK))).toEqual({ [LC_WORK]: BC_WORK })
    expect(returnDerivedFrom({ uri: BC_WORK, data: { adminMetadata: { derivedFrom: LC_WORK } } })).toEqual({ [LC_WORK]: BC_WORK })
  })
})

describe('publishToBluecore', () => {
  it('saves a record made in Marva as Sinopia does: POSTs the Work, then its Instance, with no URIs', async () => {
    const fetchFn = api((method, url) => {
      if (method === 'POST' && url === '/api/works/') { return response(saved(BC_WORK, null), 201) }
      if (method === 'POST' && url === '/api/instances/') { return response(saved(BC_INSTANCE, null), 201) }
      return response({ detail: 'unexpected' }, 500)
    })
    const result = await publishToBluecore(record(NEW_WORK, NEW_INSTANCE), { fetchFn })

    expect(fetchFn.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual(['POST /api/works/', 'POST /api/instances/'])
    // no placeholder URI is sent, so Blue Core records no derivedFrom
    expect(sent(fetchFn, 0)).not.toContain('e1795181630835')
    expect(sent(fetchFn, 0)).toContain('<bf:Work rdf:about="">')
    expect(sent(fetchFn, 0)).not.toContain('bf:Instance')
    expect(sent(fetchFn, 1)).not.toContain('e1795181630835')
    expect(sent(fetchFn, 1)).toContain('<bf:Instance rdf:about="">')
    expect(sent(fetchFn, 1)).toContain(`<bf:instanceOf rdf:resource="${BC_WORK}"/>`)
    expect(result).toMatchObject({ status: true, postLocation: BC_INSTANCE })
    expect(returnPublishedUri(NEW_WORK)).toBe(BC_WORK)
    expect(returnPublishedUri(NEW_INSTANCE)).toBe(BC_INSTANCE)

    // published again, it updates the same records
    const again = api((method, url) => response(saved(url.includes('/works/') ? BC_WORK : BC_INSTANCE, null)))
    await publishToBluecore(record(NEW_WORK, NEW_INSTANCE), { fetchFn: again })
    expect(again.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual([
      'PUT /api/works/33333333-3333-4333-8333-333333333333',
      'PUT /api/instances/44444444-4444-4444-8444-444444444444',
    ])
  })

  it('adds a new Instance to a Work already in Blue Core', async () => {
    const fetchFn = api((method, url) => response(saved(url.includes('/works/') ? BC_WORK : BC_INSTANCE, null), method === 'POST' ? 201 : 200))
    await publishToBluecore(record(BC_WORK, NEW_INSTANCE), { fetchFn })
    expect(fetchFn.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual([
      'PUT /api/works/33333333-3333-4333-8333-333333333333',
      'POST /api/instances/',
    ])
    expect(sent(fetchFn, 0)).not.toContain('e1795181630835')
    expect(sent(fetchFn, 1)).toContain('<bf:Instance rdf:about="">')
  })

  it('ingests a record loaded from outside: POSTs the Work, finds its Instance, then PUTs the Instance', async () => {
    const fetchFn = api((method, url) => {
      if (method === 'POST' && url === '/api/works/') { return response(saved(BC_WORK, LC_WORK, { hasInstance: [BC_INSTANCE] }), 201) }
      // the Instance's JSON-LD
      if (method === 'GET') { return response({ '@id': BC_INSTANCE, adminMetadata: [{ derivedFrom: { '@id': LC_INSTANCE } }] }) }
      if (method === 'PUT') { return response(saved(BC_INSTANCE, LC_INSTANCE)) }
      return response({ detail: 'unexpected' }, 500)
    })
    const result = await publishToBluecore(record(LC_WORK, LC_INSTANCE), { fetchFn, ingest: true, headers: { Authorization: 'Bearer t' } })

    expect(fetchFn.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual([
      'POST /api/works/',
      'GET /api/instances/44444444-4444-4444-8444-444444444444',
      'PUT /api/instances/44444444-4444-4444-8444-444444444444',
    ])
    // the record is sent as RDF/XML
    expect(fetchFn.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer t', 'Content-Type': 'application/rdf+xml' })
    expect(sent(fetchFn, 0)).toContain('<bf:mainTitle>A title</bf:mainTitle>')
    expect(fetchFn.mock.calls[1][1].headers).toEqual({ Accept: 'application/ld+json', Authorization: 'Bearer t' })
    // the Instance is sent with the Blue Core URIs
    expect(sent(fetchFn, 2)).not.toContain('id.loc.gov/resources')
    expect(sent(fetchFn, 2)).toContain(`rdf:about="${BC_INSTANCE}"`)
    expect(result).toEqual({
      status: true,
      postLocation: BC_INSTANCE,
      bluecore: [
        { label: 'Work', uri: BC_WORK, updatedAt: '2026-11-19T10:00:00' },
        { label: 'Instance', uri: BC_INSTANCE, updatedAt: '2026-11-19T10:00:00' },
      ],
    })
    // and remembered, so the next publish updates the same record
    expect(returnPublishedUri(LC_WORK)).toBe(BC_WORK)
    expect(returnPublishedUri(LC_INSTANCE)).toBe(BC_INSTANCE)
  })

  it('updates a record already in Blue Core, or one published before from this browser', async () => {
    const fetchFn = api((method, url) => response(saved(url.includes('/works/') ? BC_WORK : BC_INSTANCE, null)))
    await publishToBluecore(record(BC_WORK, BC_INSTANCE), { fetchFn })
    window.localStorage.setItem('bluecore-published-uris', JSON.stringify({ [LC_WORK]: BC_WORK, [LC_INSTANCE]: BC_INSTANCE }))
    await publishToBluecore(record(LC_WORK, LC_INSTANCE), { fetchFn })

    const calls = fetchFn.mock.calls.map(([url, o]) => `${o.method} ${url}`)
    expect(calls).toEqual([
      'PUT /api/works/33333333-3333-4333-8333-333333333333',
      'PUT /api/instances/44444444-4444-4444-8444-444444444444',
      'PUT /api/works/33333333-3333-4333-8333-333333333333',
      'PUT /api/instances/44444444-4444-4444-8444-444444444444',
    ])
    expect(sent(fetchFn, 3)).not.toContain(LC_WORK)
  })

  it('POSTs when a Blue Core URI is not in Blue Core', async () => {
    const fetchFn = api((method) => (method === 'PUT' ? response({ detail: 'Work not found' }, 404) : response(saved(BC_WORK, null), 201)))
    const result = await publishToBluecore(rdf(`<bf:Work rdf:about="${BC_WORK}"/>`), { fetchFn })
    expect(fetchFn.mock.calls.map(([url, o]) => `${o.method} ${url}`)).toEqual(['PUT /api/works/33333333-3333-4333-8333-333333333333', 'POST /api/works/'])
    expect(result.status).toBe(true)
  })

  it('publishes a Hub to /hubs/', async () => {
    const fetchFn = api(() => response(saved(BC_HUB, null)))
    const result = await publishToBluecore(rdf(`<bf:Hub rdf:about="${BC_HUB}"/>`), { fetchFn, hub: true })
    expect(fetchFn.mock.calls[0][0]).toBe('/api/hubs/55555555-5555-4555-8555-555555555555')
    expect(result.postLocation).toBe(BC_HUB)
  })

  it('says why Blue Core did not save it, and what was already saved', async () => {
    const fetchFn = api((method, url) => (url.includes('/works/')
      ? response(saved(BC_WORK, null))
      : response({ detail: [{ msg: 'Field required' }] }, 422)))
    const result = await publishToBluecore(record(BC_WORK, BC_INSTANCE), { fetchFn })
    expect(result.status).toBe(false)
    expect(result.msg).toBe(`Blue Core did not save the Instance (422: Field required). Already saved: Work ${BC_WORK}.`)
  })

  it('reports errors without JSON, an unreachable API, bad XML and empty records', async () => {
    const html = vi.fn(() => Promise.resolve({ status: 500, ok: false, statusText: 'Internal Server Error', json: () => Promise.reject(new Error('not json')) }))
    expect((await publishToBluecore(record(BC_WORK, BC_INSTANCE), { fetchFn: html })).msg).toBe('Blue Core did not save the Work (500: Internal Server Error).')

    const offline = vi.fn(() => Promise.reject(new Error('Failed to fetch')))
    expect((await publishToBluecore(record(BC_WORK, BC_INSTANCE), { fetchFn: offline })).msg).toBe('Could not reach Blue Core to save the Work: Failed to fetch')

    expect((await publishToBluecore('<rdf:RDF', { fetchFn: offline })).msg).toMatch(/could not be read/)
    expect((await publishToBluecore(rdf(''), { fetchFn: offline })).msg).toBe('There is no Work or Instance in this record to publish.')
  })
})

describe('installBluecorePublish', () => {
  it('replaces LC publish, sending to the publish url', async () => {
    const lcPublish = vi.fn(() => ({ status: true, lc: true }))
    const utilsNetwork = { publish: lcPublish }
    let urls = { publish: '/bc-api/' }
    installBluecorePublish(utilsNetwork, () => urls)

    const fetchFn = vi.fn(() => response(saved(BC_HUB, null)))
    vi.stubGlobal('fetch', fetchFn)
    window.localStorage.setItem('marva_jwt', 'token')
    try {
      const result = await utilsNetwork.publish(rdf(`<bf:Hub rdf:about="${BC_HUB}"/>`), 'e1', { id: 'Hub' })
      expect(result.status).toBe(true)
      expect(fetchFn.mock.calls[0][0]).toBe('/bc-api/hubs/55555555-5555-4555-8555-555555555555')
      expect(fetchFn.mock.calls[0][1].headers.Authorization).toBe('Bearer token')
      expect(lcPublish).not.toHaveBeenCalled()

      // LC's own publish where posting is faked
      urls = { publish: '/bc-api/', devFakePosting: true }
      expect(await utilsNetwork.publish('<x/>', 'e1', {})).toEqual({ status: true, lc: true })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('saves the draft before publishing, and publishes even if that save fails', async () => {
    const order = []
    const fetchFn = vi.fn(() => { order.push('publish'); return response(saved(BC_HUB, null)) })
    vi.stubGlobal('fetch', fetchFn)
    try {
      const lcPublish = vi.fn(() => ({ status: true }))
      const utilsNetwork = { publish: lcPublish }
      const beforePublish = vi.fn(async (eid) => { order.push(`save ${eid}`) })
      let urls = { publish: '/api/' }
      installBluecorePublish(utilsNetwork, () => urls, beforePublish)

      await utilsNetwork.publish(rdf(`<bf:Hub rdf:about="${BC_HUB}"/>`), 'e1', { id: 'Hub' })
      expect(order).toEqual(['save e1', 'publish'])

      beforePublish.mockRejectedValueOnce(new Error('storage full'))
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect((await utilsNetwork.publish(rdf(`<bf:Hub rdf:about="${BC_HUB}"/>`), 'e1', { id: 'Hub' })).status).toBe(true)

      // LC's own publish is left alone
      urls = { publish: '/api/', devFakePosting: true }
      beforePublish.mockClear()
      await utilsNetwork.publish('<x/>', 'e1', {})
      expect(beforePublish).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    }
  })
})

describe('applyBluecoreResourceLinks', () => {
  it('links the publish window to the Work and Instance Blue Core saved', () => {
    const result = {
      status: true,
      bluecore: [{ label: 'Work', uri: BC_WORK }, { label: 'Instance', uri: BC_INSTANCE }],
      resourceLinks: [{ type: 'Work', url: 'https://preprod-8080.id.loc.gov/resources/works/1', env: 'staging' }],
    }
    expect(applyBluecoreResourceLinks(result).resourceLinks).toEqual([
      { type: 'Work', url: BC_WORK, env: 'Blue Core' },
      { type: 'Instance', url: BC_INSTANCE, env: 'Blue Core' },
    ])
  })

  it("keeps LC's links when nothing was published to Blue Core", () => {
    const links = [{ type: 'Work', url: 'https://id.loc.gov/resources/works/1', env: 'production' }]
    expect(applyBluecoreResourceLinks({ status: true, resourceLinks: links }).resourceLinks).toBe(links)
    expect(applyBluecoreResourceLinks({ status: false, bluecore: [{ label: 'Work', uri: BC_WORK }], resourceLinks: [] }).resourceLinks).toEqual([])
    expect(applyBluecoreResourceLinks(undefined)).toBeUndefined()
  })
})
