import { createApp } from "vue";
import { createPinia } from "pinia";
import { createI18n } from 'vue-i18n'

import App from "./App.vue";
import router from "./router";
import i18nMessages from "./lib/i18n.js"
import { createVfm } from 'vue-final-modal'
import FloatingVue from 'floating-vue'

import "./assets/main.css";
import 'vue-final-modal/style.css'
import 'floating-vue/dist/style.css'

import Main from "./components/panels/edit/fields/Main.vue"

import keycloak from './lib/keycloak'

keycloak.init({ onLoad: 'login-required' }).then(authenticated => {
	if (!authenticated) {
		console.warn("Not authenticated!")
		keycloak.login()
		return
	}

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

}).catch(err => {
	console.error("Keycloak init failed", err)
})
