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
import { BLUECORE_APPS, BLUECORE_CONTACT_URL, CURRENT_APP_ID } from '@/bluecore/apps'
import { returnBluecoreHeaderFooterHeights } from '@/bluecore/layout'

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
  <header class="bluecore-header" :class="{ 'bluecore-header-slim': slim }">
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

<style scoped>
.bluecore-header {
  position: relative;
  z-index: 1000;
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  /* from src/bluecore/layout.js: 52px design height + 6px top padding - 1px thinner border */
  height: v-bind(heightPx);
  padding: 6px 62px 0 41px;
  background: #ffffff;
  /* Core Blue (#003caf) at 35% */
  border-bottom: 2px solid rgba(0, 60, 175, 0.35);
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

.bluecore-header-brand {
  display: flex;
  align-items: flex-start;
}

.bluecore-header-app-name {
  margin: 8px 0 0 37px;
  font-size: 24px;
  font-weight: 300;
  line-height: 24px;
  color: #4368ae;
  white-space: nowrap;
}

.bluecore-header-divider {
  margin-right: 26px;
}

.bluecore-header-links {
  display: flex;
  align-items: center;
  gap: 40px;
  margin-top: 11px;
}

.bluecore-link {
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  font: inherit;
  font-size: 16px;
  line-height: 24px;
  color: #003caf;
  text-decoration: underline dotted;
  text-underline-position: from-font;
  white-space: nowrap;
}

.bluecore-link:hover,
.bluecore-link:focus-visible {
  text-decoration-style: solid;
}

.bluecore-app-switcher {
  position: relative;
}

.bluecore-app-switcher-button {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bluecore-app-switcher-caret {
  display: block;
  transition: transform 0.15s ease;
}

.bluecore-app-switcher-caret.open {
  transform: rotate(180deg);
}

.bluecore-app-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 180px;
  margin: 0;
  padding: 6px 0;
  list-style: none;
  background: #ffffff;
  border: 1px solid #003caf;
  border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.bluecore-app-menu a {
  display: block;
  padding: 6px 16px;
  font-size: 16px;
  line-height: 24px;
  color: #003caf;
  text-decoration: none;
}

.bluecore-app-menu a:hover,
.bluecore-app-menu a:focus-visible {
  background: #f0f4f7;
  text-decoration: underline;
}

/* slim: one 24px row, everything vertically centered */
.bluecore-header-slim {
  align-items: center;
  padding: 0 16px 0 12px;
  border-bottom-width: 1px;
}

.bluecore-header-slim .bluecore-header-brand {
  align-items: center;
}

.bluecore-header-slim .bluecore-header-app-name {
  margin: 0 0 0 14px;
  font-size: 14px;
  line-height: 14px;
}

.bluecore-header-slim .bluecore-header-divider {
  margin-right: 12px;
}

.bluecore-header-slim .bluecore-header-links {
  gap: 20px;
  margin-top: 0;
}

.bluecore-header-slim .bluecore-link,
.bluecore-header-slim .bluecore-app-menu a {
  font-size: 13px;
  line-height: 18px;
}

.bluecore-header-slim .bluecore-app-switcher-caret {
  width: 9px;
  height: auto;
}

.bluecore-header-slim .bluecore-app-menu {
  top: calc(100% + 4px);
}
</style>
