// #############################################################################
// #####################  Blue Core Application Links  #########################
// ##                                                                         ##
// ## The Blue Core apps shown in the header "Switch applications" menu and   ##
// ## the footer. Paths are relative so they resolve against whichever Blue   ##
// ## Core host is serving Marva (same routes as the bluecore-stack landing   ##
// ## page, see bluecore-stack/nginx/index.html).                             ##
// #############################################################################

export const BLUECORE_CONTACT_URL = 'mailto:contact@bluecore.info'

export const BLUECORE_APPS = [
  { id: 'search', label: 'Search', href: '/api/search' },
  { id: 'marva', label: 'Marva', href: '/marva/' },
  { id: 'sinopia', label: 'Sinopia', href: '/sinopia/' },
  { id: 'toolbox', label: 'Graph Toolbox', href: '/toolbox/' },
  { id: 'api', label: 'API', href: '/api/docs' },
  { id: 'keycloak', label: 'Keycloak', href: '/keycloak/' },
  { id: 'workflows', label: 'Workflows', href: '/workflows/' },
]

// the app this is, left out of the header "Switch applications" menu
export const CURRENT_APP_ID = 'marva'
