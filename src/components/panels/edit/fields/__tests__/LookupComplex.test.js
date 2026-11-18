// BLUECORE: marva_editor#54, a genre/form term whose thesaurus the popup can't search is added as a literal
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LookupComplex from '@/components/panels/edit/fields/LookupComplex.vue'
import { useProfileStore } from '@/stores/profile'
import { mockMonographProfile } from '@/stores/__tests__/xml/mockProfile.json'

const fs = require('fs')

const GENRE_FORM = 'http://id.loc.gov/ontologies/bibframe/genreForm'
const SOURCE = 'http://id.loc.gov/ontologies/bibframe/source'
const LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'
const OLAC = 'http://id.loc.gov/vocabulary/genreFormSchemes/olacvggt'
const componentGuid = 'bPpzvHM1sE9FpA52bQQfiK'
const sourcePath = [{ level: 0, propertyURI: GENRE_FORM }, { level: 1, propertyURI: SOURCE }]
const termPath = [{ level: 0, propertyURI: GENRE_FORM }, { level: 1, propertyURI: 'http://www.w3.org/2002/07/owl#sameAs' }]

let pt
let wrapper

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  const store = useProfileStore()
  store.profiles = JSON.parse(fs.readFileSync('public/profiles.json', 'utf8'))
  store.rtLookup = JSON.parse(fs.readFileSync('public/rtLookup.json', 'utf8'))
  const profile = JSON.parse(JSON.stringify(mockMonographProfile))
  store.activeProfile = profile
  pt = profile.rt['lc:RT:bf2:Monograph:Work'].pt['id_loc_gov_ontologies_bibframe_genreForm__genreform']
})

afterEach(() => {
  if (wrapper) wrapper.unmount()
  vi.useRealTimers()
})

function mountTermField() {
  const structure = useProfileStore().rtLookup['lc:RT:bf2:Form'].propertyTemplates
    .find((p) => p.propertyURI === 'http://www.w3.org/2002/07/owl#sameAs')
  wrapper = mount(LookupComplex, {
    props: { guid: componentGuid, structure, propertyPath: termPath, level: 1 },
    global: { stubs: { ComplexLookupModal: true, SubjectEditor: true, ActionButton: true, ValidationIcon: true, LabelDereference: true } },
    attachTo: document.body,
  })
  return wrapper.find('input')
}

async function chooseOlac() {
  await useProfileStore().setValueSimple(componentGuid, null, sourcePath, OLAC, 'OLAC video game genre terms')
}

function savedTerm() {
  const node = pt.userValue[GENRE_FORM] && pt.userValue[GENRE_FORM][0]
  return node && node[LABEL] ? node[LABEL].map((l) => l[LABEL]) : []
}

describe('LookupComplex genre/form term with a non-LC thesaurus', () => {
  it('adds the typed term as a literal on Enter', async () => {
    await chooseOlac()
    const input = mountTermField()
    await input.setValue('Video games')
    await input.trigger('keydown', { key: 'Enter' })
    await vi.runAllTimersAsync()

    expect(savedTerm()).toEqual(['Video games'])
    expect(pt.userValue[GENRE_FORM][0][SOURCE].map((s) => s['@id'])).toEqual([OLAC])
  })

  it('adds the typed term as a literal when the field loses focus', async () => {
    await chooseOlac()
    const input = mountTermField()
    await input.setValue('Video games')
    await input.trigger('blur')
    await vi.runAllTimersAsync()

    expect(savedTerm()).toEqual(['Video games'])
    expect(pt.userValue[GENRE_FORM][0][SOURCE].map((s) => s['@id'])).toEqual([OLAC])
  })

  it('does nothing on blur before anything is typed', async () => {
    await chooseOlac()
    const input = mountTermField()
    await input.trigger('blur')
    await vi.runAllTimersAsync()

    expect(savedTerm()).toEqual([])
  })

  it('does not add a literal on blur when the popup can search the thesaurus', async () => {
    const input = mountTermField()
    wrapper.vm.searchValue = 'Video games'
    await input.trigger('blur')
    await vi.runAllTimersAsync()

    expect(savedTerm()).toEqual([])
  })
})
