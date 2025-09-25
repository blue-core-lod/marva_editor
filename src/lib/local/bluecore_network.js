import keycloak from '../keycloak';

const blueCoreNetwork = {
    blueCoreOptions: async function (url, options = {}) {
        // Always ensure headers exist and don't clobber caller's headers
        options.headers = {...(options.headers || {})};
        console.log("")
        console.log("✅ ########")
        console.log("✅ url: ", url)
        console.log("✅ VITE_BLUECORE_API_PATH: ", import.meta.env.VITE_BLUECORE_API_PATH)
        console.log("✅ #########")
        console.log("")

        if (url.startsWith(import.meta.env.VITE_BLUECORE_API_PATH)) {
            await keycloak.updateToken(30);
            options.headers['Authorization'] = `Bearer ${keycloak.token}`;

            // Determine intent without overwriting caller-specified Content-Type
            const method = (options.method || 'GET').toUpperCase();
            const currentCT = String(options.headers['Content-Type'] || '').toLowerCase();

            if (method === 'GET') {
                if (!options.headers['Accept']) {
                    options.headers['Accept'] = 'application/json, */*;q=0.8'
                }
            } else {
                if (!currentCT) {
                    options.headers['Content-Type'] = 'application/rdf+xml'
                } // When posting raw RDF/XML
            }
            if (!options.mode) options.mode = 'cors';
        }
        return options;
    },
};

export default blueCoreNetwork;
