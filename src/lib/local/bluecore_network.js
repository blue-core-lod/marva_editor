import keycloak from '../keycloak';


const blueCoreNetwork = {
  blueCoreOptions: async function (url, options) {
    if (url.startsWith(import.meta.env.VITE_BLUECORE_API_URL)) {
      await keycloak.updateToken(30);

      if (!options.headers) options.headers = {};
      options.headers['Authorization'] = `Bearer ${keycloak.token}`;
      options.headers['Content-Type'] = 'application/rdf-xml';
    } else {
      return options;
    }
  },
}

export default blueCoreNetwork;