// BLUECORE: record validation for Marva's "Validate" button.
// The check runs here, bypassing LC Auth with bibframe.org
const { validateBibframe } = require('./lc-bibframe-validator')

// Takes the raw request body ({"rdfxml": "..."}) and returns the response Marva expects
function validateRecord(rawBody) {
  let rdfxml = null
  try {
    rdfxml = JSON.parse(rawBody).rdfxml
  } catch {
    // not JSON; the validator reports "No RDF/XML content provided"
  }
  return {
    status: { status: 'validated' },
    validation: validateBibframe(rdfxml)
  }
}

module.exports = { validateRecord }
