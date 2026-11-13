<script>
/**
* Blue Core site footer: logo, Contact us button, and links to the Blue Core applications.
*
* Its height comes from BLUECORE_HEADER_FOOTER_HEIGHTS (src/bluecore/layout.js), which views/install.js
* also uses to make room for it in the page layout.
*/
import BluecoreLogo from '@/bluecore/views/BluecoreLogo.vue'
import footerDivider from '@/bluecore/assets/footer-divider.svg'
import { BLUECORE_APPS, BLUECORE_CONTACT_URL } from '@/bluecore/apps'
import { returnBluecoreHeaderFooterHeights } from '@/bluecore/layout'

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
  <footer class="bluecore-footer" :class="{ 'bluecore-footer-slim': slim }">
    <BluecoreLogo class="bluecore-footer-logo" :width="slim ? 70 : 163" />

    <a class="bluecore-footer-contact" :href="contactUrl">Contact us</a>

    <div class="bluecore-footer-divider" aria-hidden="true">
      <img :src="footerDivider" alt="" />
    </div>

    <nav class="bluecore-footer-apps" aria-labelledby="bluecore-footer-apps-heading">
      <h2 id="bluecore-footer-apps-heading" class="bluecore-footer-apps-heading">APPLICATIONS</h2>
      <ul class="bluecore-footer-app-list">
        <li v-for="app in apps" :key="app.id">
          <a :href="app.href">{{ app.label }}</a>
        </li>
      </ul>
    </nav>
  </footer>
</template>

<style scoped>
.bluecore-footer {
  box-sizing: border-box;
  display: flex;
  align-items: flex-start;
  /* from src/bluecore/layout.js: 155px design height plus a 2px top border matching the header's bottom border */
  height: v-bind(heightPx);
  padding-left: 103px;
  background: #f0f4f7;
  /* Core Blue (#003caf) at 35%, same as the header's bottom border */
  border-top: 2px solid rgba(0, 60, 175, 0.35);
  border-bottom: 10px solid #003caf;
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
}

.bluecore-footer-logo {
  margin-top: 46px;
}

.bluecore-footer-contact {
  box-sizing: border-box;
  width: 181px;
  height: 36px;
  margin: 42px 0 0 54px;
  border-radius: 20px;
  background: #003caf;
  color: #ffffff;
  font-size: 20px;
  font-weight: 700;
  line-height: 36px;
  text-align: center;
  text-decoration: none;
  flex: none;
}

.bluecore-footer-contact:hover,
.bluecore-footer-contact:focus-visible {
  background: #002b80;
}

/* the Figma divider is a 58px horizontal dotted line, rotated to stand upright */
.bluecore-footer-divider {
  position: relative;
  width: 1px;
  height: 58px;
  margin: 42px 0 0 145px;
  flex: none;
}

.bluecore-footer-divider img {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(90deg);
}

.bluecore-footer-apps {
  margin: 33px 0 0 12px;
  min-width: 0;
}

.bluecore-footer-apps-heading {
  margin: 0;
  font-size: 14px;
  font-weight: 400;
  line-height: 30px;
  color: #000000;
}

.bluecore-footer-app-list {
  display: flex;
  flex-wrap: wrap;
  column-gap: 40px;
  margin: 7px 0 0;
  padding: 0;
  list-style: none;
}

.bluecore-footer-app-list a {
  font-size: 16px;
  font-weight: 300;
  line-height: 30px;
  color: #003caf;
  text-decoration: underline dotted;
  text-underline-position: from-font;
  white-space: nowrap;
}

.bluecore-footer-app-list a:hover,
.bluecore-footer-app-list a:focus-visible {
  text-decoration-style: solid;
}

/* slim: one 20px row, everything vertically centered */
.bluecore-footer-slim {
  align-items: center;
  padding: 0 12px;
  border-top-width: 1px;
  border-bottom-width: 2px;
}

.bluecore-footer-slim .bluecore-footer-logo {
  margin-top: 0;
}

.bluecore-footer-slim .bluecore-footer-contact {
  width: auto;
  height: 16px;
  margin: 0 0 0 16px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 11px;
  line-height: 16px;
}

/* show the middle of the dotted line, cut to the slim row height */
.bluecore-footer-slim .bluecore-footer-divider {
  height: 14px;
  margin: 0 0 0 20px;
  overflow: hidden;
}

.bluecore-footer-slim .bluecore-footer-apps {
  display: flex;
  align-items: center;
  margin: 0 0 0 10px;
}

.bluecore-footer-slim .bluecore-footer-apps-heading {
  margin-right: 14px;
  font-size: 11px;
  line-height: 18px;
}

.bluecore-footer-slim .bluecore-footer-app-list {
  flex-wrap: nowrap;
  column-gap: 18px;
  margin: 0;
}

.bluecore-footer-slim .bluecore-footer-app-list a {
  font-size: 12px;
  line-height: 18px;
}
</style>
