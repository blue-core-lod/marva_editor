<script>
/**
* Blue Core logo, built from the vector pieces of the Figma "blue-core-logo-outlines"
* component. Each piece is placed by percent so the logo scales with its width.
*/
// the icon, in three pieces
import iconTop from '@/bluecore/assets/logo/icon-top.svg'
import iconMiddle from '@/bluecore/assets/logo/icon-middle.svg'
import iconBottom from '@/bluecore/assets/logo/icon-bottom.svg'
// "Blue"
import blueB from '@/bluecore/assets/logo/blue-B.svg'
import blueL from '@/bluecore/assets/logo/blue-l.svg'
import blueU from '@/bluecore/assets/logo/blue-u.svg'
import blueE from '@/bluecore/assets/logo/blue-e.svg'
// "Core"
import coreC from '@/bluecore/assets/logo/core-C.svg'
import coreO from '@/bluecore/assets/logo/core-o.svg'
import coreR from '@/bluecore/assets/logo/core-r.svg'
import coreE from '@/bluecore/assets/logo/core-e.svg'

// [name, src, top, right, bottom, left] insets in percent, from the Figma design
const PARTS = [
  ['icon-top', iconTop, 0, 89.25, 50.01, 0],
  ['icon-middle', iconMiddle, 25, 79.84, 25, 9.41],
  ['icon-bottom', iconBottom, 50.79, 89.25, 0, 0],
  ['blue-B', blueB, 18.73, 66.13, 20.51, 25.27],
  ['blue-l', blueL, 15.38, 62.52, 20.51, 36.41],
  ['blue-u', blueU, 34.33, 52.29, 19.67, 40.37],
  ['blue-e', blueE, 33.5, 42.1, 19.68, 49.9],
  ['core-C', coreC, 17.89, 26.74, 19.68, 62.87],
  ['core-o', coreO, 33.5, 16.31, 19.67, 74.67],
  ['core-r', coreR, 33.5, 9.37, 20.51, 85.54],
  ['core-e', coreE, 33.5, 0, 19.68, 91.46],
]

export default {
  name: 'BluecoreLogo',
  props: {
    // rendered width in pixels, the height follows the logo's aspect ratio
    width: { type: Number, default: 177 },
  },
  data() {
    return {
      parts: PARTS.map(([name, src, top, right, bottom, left]) => ({
        name,
        src,
        style: { top: top + '%', right: right + '%', bottom: bottom + '%', left: left + '%' },
      })),
    }
  },
}
</script>

<template>
  <span class="bluecore-logo" role="img" aria-label="Blue Core" :style="{ width: width + 'px' }">
    <span v-for="part in parts" :key="part.name" class="bluecore-logo-part" :data-part="part.name" :style="part.style">
      <img :src="part.src" alt="" />
    </span>
  </span>
</template>

<style scoped>
.bluecore-logo {
  display: block;
  position: relative;
  overflow: hidden;
  aspect-ratio: 544.08 / 117;
  flex: none;
}
.bluecore-logo-part {
  position: absolute;
}
.bluecore-logo-part img {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  max-width: none;
}
</style>
