import { createApp } from "vue";
import { createPinia } from "pinia";
import { createI18n } from 'vue-i18n';

import App from "./App.vue";
import router from "./router";
import i18nMessages from "./lib/i18n.js";
import { createVfm } from 'vue-final-modal';
import FloatingVue from 'floating-vue';

import "./assets/main.css";
import 'vue-final-modal/style.css';
import 'floating-vue/dist/style.css';

import Main from "./components/panels/edit/fields/Main.vue";
import keycloak from './lib/keycloak';

const base = import.meta.env.BASE_URL

function initApp() {
	const i18n = createI18n({
		locale: 'en',
		messages: i18nMessages, // set locale messages
	});

	const app = createApp(App)

	app.config.errorHandler = (err, vm, info) => {
		console.error(err, vm, info)
	}

	app.component('Main', Main)

	app.use(createPinia())
	app.use(router)
	app.use(i18n)
	app.use(FloatingVue)
	app.use(createVfm())

	app.mount("#app")
}

// Use `check-sso` and `pkceMethod` so Keycloak can restore session on reload
keycloak.init({
	checkLoginIframe: false,
	onLoad: 'check-sso',
	pkceMethod: 'S256',
}).then(authenticated => {
	const currentPath = window.location.pathname

	if (authenticated) {
		// Already logged in
		if (currentPath.endsWith('/login') || currentPath.endsWith('/login/')) {
			window.location.href = base // go to root if stuck on /login
		} else {
			initApp()
		}
	} else {
		// Not authenticated
		if (currentPath.endsWith('/login') || currentPath.endsWith('/login/')) {
			initApp()
		} else {
			window.location.href = `${base}login`
		}
	}
}).catch(err => {
	console.error("Keycloak init failed", err)
})
