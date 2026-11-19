// #############################################################################
// #####################  Blue Core RDF/XML to JSON-LD  ########################
// ##                                                                         ##
// ## Marva builds its records as RDF/XML, and the Blue Core API's Work,      ##
// ## Instance and Hub routes read JSON-LD. This turns the RDF/XML Marva      ##
// ## writes into expanded JSON-LD (full URIs, no @context) with the          ##
// ## browser's own XML parser, so no RDF library is needed. It covers what   ##
// ## Marva writes: rdf:about / rdf:nodeID, rdf:resource, rdf:datatype,       ##
// ## xml:lang and rdf:parseType Resource, Literal and Collection.            ##
// #############################################################################

const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
const XML = 'http://www.w3.org/XML/1998/namespace'

const fullName = (el) => (el.namespaceURI || '') + el.localName
const rdfAttr = (el, name) => (el.hasAttributeNS(RDF, name) ? el.getAttributeNS(RDF, name) : null)
const elementsOf = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 1)

/**
* @param {string} xml - RDF/XML, e.g. <rdf:RDF><bf:Work rdf:about="…">…</bf:Work></rdf:RDF>
* @return {Array<object>} - expanded JSON-LD: one node object per subject
*/
export function rdfxmlToJsonld(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const error = doc.getElementsByTagName('parsererror')[0]
  if (error) { throw new Error(`The record's RDF/XML could not be read: ${error.textContent}`) }

  const nodes = new Map()
  let blankCount = 0
  const newBlank = () => `_:bc${blankCount++}`

  const nodeFor = (id) => {
    if (!nodes.has(id)) { nodes.set(id, { '@id': id }) }
    return nodes.get(id)
  }
  const add = (id, predicate, value) => {
    const node = nodeFor(id)
    if (predicate === '@type') {
      node['@type'] = node['@type'] || []
      if (!node['@type'].includes(value)) { node['@type'].push(value) }
      return
    }
    node[predicate] = node[predicate] || []
    node[predicate].push(value)
  }
  // xml:lang applies to everything inside the element that sets it
  const languageOf = (el) => {
    for (let e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (e.hasAttributeNS(XML, 'lang')) { return e.getAttributeNS(XML, 'lang') || null }
    }
    return null
  }

  // a node element (<bf:Work rdf:about="…">): returns its subject id
  const readNode = (el) => {
    const about = rdfAttr(el, 'about')
    const nodeId = rdfAttr(el, 'nodeID')
    const id = about ? about : (nodeId ? `_:${nodeId}` : newBlank())
    nodeFor(id)
    if (fullName(el) !== RDF + 'Description') { add(id, '@type', fullName(el)) }
    readAttributeProperties(el, id)
    elementsOf(el).forEach((property) => readProperty(property, id))
    return id
  }

  // plain attributes on an element are literal properties of its subject
  const readAttributeProperties = (el, id) => {
    for (const attr of Array.from(el.attributes)) {
      if (!attr.namespaceURI || attr.namespaceURI === RDF || attr.namespaceURI === XML) { continue }
      if (attr.namespaceURI === 'http://www.w3.org/2000/xmlns/') { continue }
      add(id, attr.namespaceURI + attr.localName, literal(attr.value, null, languageOf(el)))
    }
  }

  // a property element (<bf:title>…</bf:title>) of the subject id
  const readProperty = (el, id) => {
    const predicate = fullName(el)
    const resource = rdfAttr(el, 'resource')
    const nodeId = rdfAttr(el, 'nodeID')
    const parseType = rdfAttr(el, 'parseType')
    const children = elementsOf(el)

    if (predicate === RDF + 'type' && resource) { return add(id, '@type', resource) }
    if (resource !== null || nodeId !== null) {
      const object = resource !== null ? resource : `_:${nodeId}`
      add(id, predicate, { '@id': object })
      readAttributeProperties(el, object)
      return
    }
    if (parseType === 'Resource') {
      const object = newBlank()
      nodeFor(object)
      children.forEach((property) => readProperty(property, object))
      return add(id, predicate, { '@id': object })
    }
    if (parseType === 'Literal') {
      const markup = Array.from(el.childNodes).map((n) => new XMLSerializer().serializeToString(n)).join('')
      return add(id, predicate, { '@value': markup, '@type': RDF + 'XMLLiteral' })
    }
    if (parseType === 'Collection') {
      return add(id, predicate, { '@list': children.map((child) => ({ '@id': readNode(child) })) })
    }
    if (children.length) {
      children.forEach((child) => add(id, predicate, { '@id': readNode(child) }))
      return
    }
    add(id, predicate, literal(el.textContent, rdfAttr(el, 'datatype'), languageOf(el)))
  }

  const root = doc.documentElement
  const top = fullName(root) === RDF + 'RDF' ? elementsOf(root) : [root]
  top.forEach(readNode)
  return Array.from(nodes.values())
}

function literal(value, datatype, language) {
  if (datatype) { return { '@value': value, '@type': datatype } }
  if (language) { return { '@value': value, '@language': language } }
  return { '@value': value }
}
