<script>
/**
* Blue Core site header: logo, app name, and Contact / Switch applications / Logout links.
*
* Its height comes from BLUECORE_HEADER_FOOTER_HEIGHTS (src/bluecore/layout.js), which views/install.js
* also uses to make room for it in the page layout.
*/
import { useConfigStore } from '@/stores/config'
import { usePreferenceStore } from '@/stores/preference'
import { mapStores } from 'pinia'
import BluecoreLogo from '@/bluecore/views/BluecoreLogo.vue'
import caretDown from '@/bluecore/assets/caret-down.svg'
import { BLUECORE_APPS, BLUECORE_CONTACT_URL, CURRENT_APP_ID } from '@/bluecore/app-links'
import { returnBluecoreHeaderFooterHeights } from '@/bluecore/layout'
import '@/bluecore/styles/bluecore-shared.css'
import '@/bluecore/styles/bluecore-header.css'

export default {
  name: 'BluecoreHeader',
  components: { BluecoreLogo },
  props: {
    // compact version that keeps more vertical space for the editor
    slim: { type: Boolean, default: false },
  },
  data() {
    return {
      caretDown,
      contactUrl: BLUECORE_CONTACT_URL,
      otherApps: BLUECORE_APPS.filter((app) => app.id !== CURRENT_APP_ID),
      appMenuOpen: false,
    }
  },
  computed: {
    ...mapStores(useConfigStore, usePreferenceStore),
    heightPx() {
      return returnBluecoreHeaderFooterHeights(this.slim ? 'slim' : 'full').header + 'px'
    },
  },
  methods: {
    logout() {
      this.preferenceStore.ssoLogout(this.configStore.returnUrls.util)
    },
    toggleAppMenu() {
      this.appMenuOpen = !this.appMenuOpen
    },
    closeAppMenu() {
      this.appMenuOpen = false
    },
    onDocumentClick(event) {
      if (this.appMenuOpen && this.$refs.appSwitcher && !this.$refs.appSwitcher.contains(event.target)) {
        this.closeAppMenu()
      }
    },
    onKeydown(event) {
      if (event.key === 'Escape' && this.appMenuOpen) {
        this.closeAppMenu()
        this.$refs.appSwitcherButton?.focus()
      }
    },
  },
  mounted() {
    document.addEventListener('click', this.onDocumentClick)
    document.addEventListener('keydown', this.onKeydown)
  },
  beforeUnmount() {
    document.removeEventListener('click', this.onDocumentClick)
    document.removeEventListener('keydown', this.onKeydown)
  },
}
</script>

<template>
  <header class="bluecore-header" :class="{ 'bluecore-header-slim': slim }" :style="{ height: heightPx }">
    <div class="bluecore-header-brand">
      <BluecoreLogo :width="slim ? 93 : 177" />
      <span class="bluecore-header-app-name"><span class="bluecore-header-divider" aria-hidden="true">|</span>MARVA</span>
    </div>

    <nav class="bluecore-header-links" aria-label="Blue Core">
      <a class="bluecore-link" :href="contactUrl">Contact</a>

      <div ref="appSwitcher" class="bluecore-app-switcher">
        <button
          ref="appSwitcherButton"
          type="button"
          class="bluecore-link bluecore-app-switcher-button"
          aria-haspopup="true"
          :aria-expanded="appMenuOpen ? 'true' : 'false'"
          aria-controls="bluecore-app-menu"
          @click="toggleAppMenu">
          Switch applications
          <img class="bluecore-app-switcher-caret" :class="{ open: appMenuOpen }" :src="caretDown" alt="" />
        </button>
        <ul v-show="appMenuOpen" id="bluecore-app-menu" class="bluecore-app-menu">
          <li v-for="app in otherApps" :key="app.id">
            <a :href="app.href" @click="closeAppMenu">{{ app.label }}</a>
          </li>
        </ul>
      </div>

      <button v-if="preferenceStore.ssoUser" type="button" class="bluecore-link" @click="logout">Logout</button>
    </nav>
  </header>
</template>
