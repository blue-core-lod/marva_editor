import Keycloak from 'keycloak-js';
const keycloakAuthPath = import.meta.env.VITE_KEYCLOAK_AUTH_PATH

const keycloak = new Keycloak({
    url: keycloakAuthPath, // 'http://localhost:8081/keycloak/',
    realm: 'bluecore',
    clientId: 'bluecore_api',

});

export default keycloak;
