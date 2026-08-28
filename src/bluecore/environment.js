// #############################################################################
// #################  Blue Core Environment Configs  ###########################
// ##                                                                         ##
// ## Blue Core specific environment paths and values will be utilized here.  ##
// #############################################################################
// Relative by default so it resolves against whatever host is serving the app,
// the same trick utilBase uses below. One image then works on every bluecore
// domain. Override with VITE_BLUECORE_API_PATH only if the API moves off-origin.
const apiBase = (import.meta.env.VITE_BLUECORE_API_PATH || '/api/') // Bluecore API Base Endpoint
const utilBase = (import.meta.env.VITE_KEYCLOAK_MIDDLEWARE_BASE || '/marva/util/') //default: 'http://localhost:9401/marva/util/'


export const dev = {
  ldpjs : "",  //TODO: Needs to be implemented.
  util  : utilBase,
  scriptshifter: 'https://bibframe.org/scriptshifter/',
  publish: `${apiBase}batches/upload/`, // Bluecore API Endpoint
  validate: 'http://localhost:9401/marva/util/validate/prod',
  profiles: 'https://raw.githubusercontent.com/lcnetdev/marva-profiles/refs/heads/main/marva-prod/marva-profiles.json',
  starting: 'https://raw.githubusercontent.com/lcnetdev/marva-profiles/refs/heads/main/marva-prod/marva-starting.json',
  id: 'https://id.loc.gov/',
  env : 'staging', // dev uses staging logic and not explicit dev environment
  dev: true,
  externalDev: true,
  displayLCOnlyFeatures: true,
  simpleLookupLang: 'en',
  publicEndpoints:true,
  lcap: 'https://c2vwscf01.loc.gov/cflsops/toolkit-training-lcsg/lcap-productivity/marva/bibId/',
  bfdb : 'https://preprod-8230.id.loc.gov/',
  isBibframeDotOrg: false,
  folioMLCEndpoint: 'http://localhost:9401/marva/util/folio/next-mlc/staging',
  dancerEnabled: true,
  dancerWorkspaceList: "http://localhost:9401/marva/dancer/api/serve/workspaces",
}

export const stg = {
  ldpjs : "",  //TODO: Needs to be implemented. original endpoint:'http://localhost:9401/marva/api-staging/'
  util  : utilBase,
  scriptshifter: 'https://bibframe.org/scriptshifter/',
  publish: `${apiBase}batches/upload/`, // Bluecore API Endpoint
  validate: 'http://localhost:9401/marva/util/validate/prod',
  profiles: 'https://raw.githubusercontent.com/lcnetdev/marva-profiles/refs/heads/main/marva-prod/marva-profiles.json',
  starting: 'https://raw.githubusercontent.com/lcnetdev/marva-profiles/refs/heads/main/marva-prod/marva-starting.json',
  id: 'https://id.loc.gov/',
  env : 'staging',
  dev: true,
  externalDev: true,
  displayLCOnlyFeatures: true,
  simpleLookupLang: 'en',
  publicEndpoints:true,
  lcap: 'https://c2vwscf01.loc.gov/cflsops/toolkit-training-lcsg/lcap-productivity/marva/bibId/',
  bfdb : 'https://preprod-8230.id.loc.gov/',
  isBibframeDotOrg: false,
  folioMLCEndpoint: 'http://localhost:9401/marva/util/folio/next-mlc/staging',
  dancerEnabled: true,
  dancerWorkspaceList: "http://localhost:9401/marva/dancer/api/serve/workspaces",
}

export const prod = {
  ldpjs : "",  //TODO: Needs to be implemented.
  util  : utilBase,
  scriptshifter: 'https://bibframe.org/scriptshifter/',
  publish: `${apiBase}batches/upload/`, // Bluecore API Endpoint
  validate: 'http://localhost:9401/marva/util/validate/prod',
  profiles: 'https://raw.githubusercontent.com/lcnetdev/marva-profiles/refs/heads/main/marva-prod/marva-profiles.json',
  starting: 'https://raw.githubusercontent.com/lcnetdev/marva-profiles/refs/heads/main/marva-prod/marva-starting.json',
  id: 'https://id.loc.gov/',
  env : 'production',
  dev: false,
  externalDev: false,
  displayLCOnlyFeatures: true,
  simpleLookupLang: 'en',
  publicEndpoints:true,
  lcap: 'https://c2vwscf01.loc.gov/cflsops/toolkit-training-lcsg/lcap-productivity/marva/bibId/',
  bfdb : 'https://preprod-8230.id.loc.gov/',
  isBibframeDotOrg: true,
  folioMLCEndpoint: 'http://localhost:9401/marva/util/folio/next-mlc/staging',
  dancerEnabled: true,
  dancerWorkspaceList: "http://localhost:9401/marva/dancer/api/serve/workspaces",

}

export const bluecore = { dev, stg, prod }

export default bluecore
