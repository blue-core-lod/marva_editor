// BLUECORE: checks that LC's downloaded validator still works the way Marva needs.
// Runs during the Docker build (npm test), so if an LC update breaks it,
// the build fails instead of the Validate button breaking on stage.
// Checks behavior only, not exact message wording, so LC rewording a message is fine.
const { test } = require('node:test')
const assert = require('node:assert')

const RDF = 'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:bf="http://id.loc.gov/ontologies/bibframe/"'
const body = (rdfxml) => JSON.stringify({ rdfxml })
const LEVELS = ['ERROR', 'WARNING', 'INFO', 'SUCCESS'] // the levels Marva knows how to show

test('LC validator loads and has the function we call', () => {
  // Fails if LC renames it or starts needing a package we don't install
  const { validateBibframe } = require('./lc-bibframe-validator')
  assert.strictEqual(typeof validateBibframe, 'function')
})

test('returns results in the shape Marva expects', () => {
  const { validateRecord } = require('./validate-handler')
  const result = validateRecord(body(`<rdf:RDF ${RDF}><bf:Instance rdf:about="http://example.org/i1"/></rdf:RDF>`))
  assert.deepStrictEqual(result.status, { status: 'validated' })
  assert.ok(Array.isArray(result.validation) && result.validation.length > 0)
  for (const msg of result.validation) {
    assert.ok(LEVELS.includes(msg.level), `unknown level: ${msg.level}`)
    assert.strictEqual(typeof msg.message, 'string')
  }
})

test('still flags an Instance with no title', () => {
  const { validateRecord } = require('./validate-handler')
  const { validation } = validateRecord(body(`<rdf:RDF ${RDF}><bf:Instance rdf:about="http://example.org/i1"/></rdf:RDF>`))
  assert.ok(validation.some((m) => /title/i.test(m.message)), 'expected a missing-title message')
})

test('bad input comes back as an ERROR message, not a crash', () => {
  const { validateRecord } = require('./validate-handler')
  for (const input of ['not json', '{}', body('<oops/>')]) {
    assert.strictEqual(validateRecord(input).validation[0].level, 'ERROR')
  }
})
