import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
    url: 'http://localhost:8081/keycloak/',
    realm: 'bluecore',
    clientId: 'bluecore_api',

});

export default keycloak;
