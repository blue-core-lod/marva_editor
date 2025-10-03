import { createApp } from "vue";
import { createPinia } from "pinia";
import { createI18n } from "vue-i18n";
import { createVfm } from "vue-final-modal";

import App from "./App.vue";
import router from "./router";
import i18nMessages from "./lib/i18n.js";
import FloatingVue from "floating-vue";
import Main from "./components/panels/edit/fields/Main.vue";
import keycloak from './lib/keycloak';

import "./assets/main.css";
import "vue-final-modal/style.css";
import "floating-vue/dist/style.css";

const base = import.meta.env.BASE_URL;
// const keycloakAuthPath = import.meta.env.VITE_KEYCLOAK_AUTH_PATH + "realms/bluecore "; // "http://localhost:8081/keycloak/realms/bluecore"
const keycloakAuthPath = `${window.location.origin}/keycloak/realms/bluecore`;

function cleanUrl(router) {
    router.afterEach((to) => {
        console.log("to.fullPath: ", to.fullPath)
        if (to.fullPath.includes('#state') || to.fullPath.includes('#error')) {
            history.replaceState(null, '', window.location.pathname);
        }
    });
}

function initApp(extraProps = {}) {
    const i18n = createI18n({
        locale: "en",
        messages: i18nMessages, // set locale messages
    });

    const app = createApp(App, extraProps);

    app.config.errorHandler = (err, vm, info) => {
        console.error(err, vm, info);
    };

    app.component("Main", Main);

    app.use(createPinia());
    app.use(router);
    app.use(i18n);
    app.use(FloatingVue);
    app.use(createVfm());

    app.mount("#app");
    cleanUrl(router);
}

// Check if Keycloak is available before proceeding
fetch(keycloakAuthPath, { method: "GET" })
    .then((response) => {
        if (!response.ok) throw new Error("Keycloak not reachable");
        // If alive, continue with Keycloak.init
        return keycloak.init({
            checkLoginIframe: false,
            onLoad: "check-sso",
            pkceMethod: "S256",
        });
    })
    .then((authenticated) => {
        const currentPath = window.location.pathname;

        if (authenticated) {
            if (currentPath.endsWith('/login') || currentPath.endsWith('/login/')) {
                window.location.href = base;
            } else {
                initApp();
            }
        } else {
            if (currentPath.endsWith('/login') || currentPath.endsWith('/login/')) {
                initApp();
            } else {
                window.location.href = `${base}login?kc_status=0`;
            }
        }
    })
    .catch((err) => {
        console.error("Keycloak unavailable or init failed", err);
        // Always go to login page with error flag if not already there
        if (!window.location.pathname.endsWith('/login')) {
            window.location.href = `${base}login?kc_status=1`;
        } else {
            initApp({ kcUnavailable: true });
        }
    });
