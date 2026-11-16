<script>
/**
* Blue Core site footer: logo, Contact us button, and links to the Blue Core applications.
*
* Its height comes from BLUECORE_HEADER_FOOTER_HEIGHTS (src/bluecore/layout.js), which views/install.js
* also uses to make room for it in the page layout.
*/
import BluecoreLogo from '@/bluecore/views/BluecoreLogo.vue'
import footerDivider from '@/bluecore/assets/footer-divider.svg'
import { BLUECORE_APPS, BLUECORE_CONTACT_URL } from '@/bluecore/app-links'
import { returnBluecoreHeaderFooterHeights } from '@/bluecore/layout'
import '@/bluecore/styles/bluecore-shared.css'
import '@/bluecore/styles/bluecore-footer.css'

export default {
  name: 'BluecoreFooter',
  components: { BluecoreLogo },
  props: {
    // compact single row version that keeps more vertical space for the editor
    slim: { type: Boolean, default: false },
  },
  data() {
    return {
      apps: BLUECORE_APPS,
      contactUrl: BLUECORE_CONTACT_URL,
      footerDivider,
    }
  },
  computed: {
    heightPx() {
      return returnBluecoreHeaderFooterHeights(this.slim ? 'slim' : 'full').footer + 'px'
    },
  },
}
</script>

<template>
  <footer class="bluecore-footer" :class="{ 'bluecore-footer-slim': slim }" :style="{ height: heightPx }">
    <BluecoreLogo class="bluecore-footer-logo" :width="slim ? 70 : 163" />

    <a class="bluecore-footer-contact" :href="contactUrl">Contact us</a>

    <div class="bluecore-footer-divider" aria-hidden="true">
      <img :src="footerDivider" alt="" />
    </div>

    <nav class="bluecore-footer-apps" aria-labelledby="bluecore-footer-apps-heading">
      <h2 id="bluecore-footer-apps-heading" class="bluecore-footer-apps-heading">APPLICATIONS</h2>
      <ul class="bluecore-footer-app-list">
        <li v-for="app in apps" :key="app.id">
          <a class="bluecore-link" :href="app.href">{{ app.label }}</a>
        </li>
      </ul>
    </nav>
  </footer>
</template>
