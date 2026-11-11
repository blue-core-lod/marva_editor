import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  isBluecoreSearch,
  bluecoreInstanceTitle,
  searchInstancesBluecore,
  bluecoreLastSystemDate,
  asUtc
} from '@/bluecore/search'

const BF = 'http://id.loc.gov/ontologies/bibframe/'
const URI = 'https://bcld.info/instances/75d831b9-e0d6-40f0-abb3-e9130622eb8a'
const UUID = '75d831b9-e0d6-40f0-abb3-e9130622eb8a'

// Expanded JSON-LD, the way older Blue Core records are stored
const expanded = [
  {
    '@id': URI,
    '@type': [BF + 'Instance'],
    [BF + 'title']: [{ '@id': '_:t1' }, { '@id': '_:t2' }]
  },
  {
    '@id': '_:t1',
    '@type': [BF + 'VariantTitle'],
    [BF + 'mainTitle']: [{ '@value': 'Variant name' }]
  },
  {
    '@id': '_:t2',
    '@type': [BF + 'Title'],
    [BF + 'mainTitle']: [{ '@value': 'HBR guide' }],
    [BF + 'subtitle']: [{ '@value': 'for managers' }]
  }
]

// Framed JSON-LD with short terms
const framed = {
  '@context': 'https://example.org/context.json',
  '@id': URI,
  '@type': 'Instance',
  title: [{ '@type': 'Title', mainTitle: 'Framed title' }]
}

function mockFetch(...pages) {
  const fetchMock = vi.fn()
  for (const page of pages) {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ results: page, total: page.length, links: {} }) })
  }
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('isBluecoreSearch', () => {
  it('is true only when a bluecoreSearch URL is configured', () => {
    expect(isBluecoreSearch({ bluecoreSearch: '/api/search/' })).toBe(true)
    expect(isBluecoreSearch({ id: 'https://id.loc.gov/' })).toBe(false)
    expect(isBluecoreSearch(undefined)).toBe(false)
  })
})

describe('bluecoreInstanceTitle', () => {
  it('prefers the title proper over a variant, with its subtitle', () => {
    expect(bluecoreInstanceTitle({ uri: URI, data: expanded })).toBe('HBR guide : for managers')
  })

  it('reads framed data with short terms', () => {
    expect(bluecoreInstanceTitle({ uri: URI, data: framed })).toBe('Framed title')
  })

  it('falls back to the uuid when there is no title', () => {
    expect(bluecoreInstanceTitle({ uri: URI, uuid: UUID, data: [{ '@id': URI }] })).toBe(UUID)
  })
})

describe('searchInstancesBluecore', () => {
  beforeEach(() => { window.localStorage.clear() })
  afterEach(() => { vi.unstubAllGlobals() })

  const hit = { uri: URI, uuid: UUID, data: expanded, type: 'instances', updated_at: '2026-11-01T10:00:00' }

  it('looks up identifiers first and maps results to the Load page shape', async () => {
    const fetchMock = mockFetch([hit])
    const results = await searchInstancesBluecore('/api/search/', ' 2023540784 ')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = new URL(fetchMock.mock.calls[0][0], 'http://localhost')
    expect(url.pathname).toBe('/api/search/')
    expect(url.searchParams.get('q')).toBe('2023540784')
    expect(url.searchParams.get('type')).toBe('instances')
    expect(url.searchParams.get('scope')).toBe('identifier')

    const apiUrl = `${window.location.origin}/api/instances/${UUID}`
    expect(results).toEqual([{
      lccn: '2023540784',
      label: 'HBR guide : for managers',
      bfdbURL: URI,
      linkLabel: 'BF Instance',
      dateTooltip: 'When record was loaded/edited in Bluecore',
      idURL: apiUrl,
      bfdbPackageURL: apiUrl
    }])
    expect(bluecoreLastSystemDate(apiUrl)).toBe('2026-11-01T10:00:00Z')
  })

  it('falls back to a keyword search when no identifier matches', async () => {
    const fetchMock = mockFetch([], [hit])
    const results = await searchInstancesBluecore('/api/search/', 'hbr guide')

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const url = new URL(fetchMock.mock.calls[1][0], 'http://localhost')
    expect(url.searchParams.get('scope')).toBeNull()
    expect(results).toHaveLength(1)
  })

  it('sends the Marva JWT when there is one', async () => {
    window.localStorage.setItem('marva_jwt', 'abc')
    const fetchMock = mockFetch([hit])
    await searchInstancesBluecore('/api/search/', '2023540784')
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer abc')
  })

  it('returns an error entry when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await searchInstancesBluecore('/api/search/', 'x')).toEqual(['Error searching Blue Core'])
  })
})

describe('bluecoreLastSystemDate', () => {
  it('is undefined for URLs that are not Blue Core results', () => {
    expect(bluecoreLastSystemDate('https://id.loc.gov/resources/instances/123')).toBeUndefined()
  })
})

describe('asUtc', () => {
  it('marks zoneless API timestamps as UTC', () => {
    expect(asUtc('2026-11-11T13:39:37.975006')).toBe('2026-11-11T13:39:37.975006Z')
    expect(new Date(asUtc('2026-11-11T13:39:37')).toISOString()).toBe('2026-11-11T13:39:37.000Z')
  })

  it('leaves timestamps that already have a zone alone', () => {
    expect(asUtc('2026-11-11T13:39:37Z')).toBe('2026-11-11T13:39:37Z')
    expect(asUtc('2026-11-11T08:39:37-05:00')).toBe('2026-11-11T08:39:37-05:00')
    expect(asUtc('2026-11-11T13:39:37+0000')).toBe('2026-11-11T13:39:37+0000')
  })
})
