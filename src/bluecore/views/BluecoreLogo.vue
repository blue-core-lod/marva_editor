<script>
/**
* Blue Core logo, built from the vector pieces of the Figma "blue-core-logo-outlines"
* component. Each piece is placed by percent so the logo scales with its width.
*/
import part0 from '@/bluecore/assets/logo/part-0.svg'
import part1 from '@/bluecore/assets/logo/part-1.svg'
import part2 from '@/bluecore/assets/logo/part-2.svg'
import part3 from '@/bluecore/assets/logo/part-3.svg'
import part4 from '@/bluecore/assets/logo/part-4.svg'
import part5 from '@/bluecore/assets/logo/part-5.svg'
import part6 from '@/bluecore/assets/logo/part-6.svg'
import part7 from '@/bluecore/assets/logo/part-7.svg'
import part8 from '@/bluecore/assets/logo/part-8.svg'
import part9 from '@/bluecore/assets/logo/part-9.svg'
import part10 from '@/bluecore/assets/logo/part-10.svg'

// [src, top, right, bottom, left] insets in percent, from the Figma design
const PARTS = [
  [part0, 18.73, 66.13, 20.51, 25.27],
  [part1, 15.38, 62.52, 20.51, 36.41],
  [part2, 34.33, 52.29, 19.67, 40.37],
  [part3, 33.5, 42.1, 19.68, 49.9],
  [part4, 17.89, 26.74, 19.68, 62.87],
  [part5, 33.5, 16.31, 19.67, 74.67],
  [part6, 33.5, 9.37, 20.51, 85.54],
  [part7, 33.5, 0, 19.68, 91.46],
  [part8, 50.79, 89.25, 0, 0],
  [part9, 25, 79.84, 25, 9.41],
  [part10, 0, 89.25, 50.01, 0],
]

export default {
  name: 'BluecoreLogo',
  props: {
    // rendered width in pixels, the height follows the logo's aspect ratio
    width: { type: Number, default: 177 },
  },
  data() {
    return {
      parts: PARTS.map(([src, top, right, bottom, left]) => ({
        src,
        style: { top: top + '%', right: right + '%', bottom: bottom + '%', left: left + '%' },
      })),
    }
  },
}
</script>

<template>
  <span class="bluecore-logo" role="img" aria-label="Blue Core" :style="{ width: width + 'px' }">
    <span v-for="(part, i) in parts" :key="i" class="bluecore-logo-part" :style="part.style">
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
