export const NS_BF_SOURCE = 'http://id.loc.gov/ontologies/bibframe/source'
export const NS_RDF_LABEL = 'http://www.w3.org/2000/01/rdf-schema#label'

export const BCLUP_BASE = (import.meta.env.VITE_BCLUP_BASE || 'https://lookup.ld4l.org/authorities/search/linked_data')

export const BCLUP_PROCESSOR = 'bclupAPI'
export const BCLUP_GETTY_MODE = 'BCLUP_GETTY'
export const BCLUP_HOMOSAURUS_MODE = 'BCLUP_HOMOSAURUS'
export const BCLUP_SEARCH_MODES = [BCLUP_GETTY_MODE, BCLUP_HOMOSAURUS_MODE]

export const BCLUP_SOURCE = [
  {
    label: 'Art & architecture thesaurus',
    prefix: 'vocab.getty.edu/aat',
    uri: 'http://id.loc.gov/vocabulary/subjectSchemes/aat'
  },
  {
    label: 'Getty thesaurus of geographic names',
    prefix: 'vocab.getty.edu/tgn',
    uri: 'http://id.loc.gov/vocabulary/subjectSchemes/tgn'
  },
  {
    label: 'Union list of artist names',
    prefix: 'vocab.getty.edu/ulan',
    uri: 'http://id.loc.gov/vocabulary/subjectSchemes/ulan'
  },
  {
    label: 'Homosaurus: an international LGBTQ linked data vocabulary',
    prefix: 'homosaurus.org',
    uri: 'http://id.loc.gov/vocabulary/subjectSchemes/homoit'
  }
]
