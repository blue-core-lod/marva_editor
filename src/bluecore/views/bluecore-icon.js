// #############################################################################
// #########################  Blue Core Mark Icon  #############################
// ##                                                                         ##
// ## The Blue Core mark (three linked circles, from bluecore-stack's        ##
// ## blue-core-v1.svg) as an icon for the nav menus. vue-file-toolbar-menu   ##
// ## draws an item's `icon` as a component when it's an object, so these     ##
// ## can be used anywhere a Material icon name goes.                         ##
// #############################################################################

import { defineComponent, h, markRaw } from 'vue'

// the mark's shapes, unchanged from blue-core-v1.svg (circles in brand blue, links in white)
const CIRCLES = [[51.75, 110.25], [102.94, 81], [51.75, 51.75]]
const LINKS = [
  'M51.03,81c-2.39,0-4.57-.32-6.59-.89v29.24c0,4.54,3.27,8.21,7.31,8.21s7.31-3.68,7.31-8.21v-29.25c-2.41.57-5.06.9-8.03.9Z',
  'M77.61,96.27c1.19,2.07,2.01,4.12,2.53,6.15l25.32-14.62c3.93-2.27,5.48-6.94,3.46-10.44-2.02-3.5-6.84-4.49-10.77-2.23l-25.33,14.63c1.7,1.8,3.31,3.93,4.8,6.51Z',
  'M56.33,46.05c-3.93-2.27-8.75-1.27-10.77,2.23s-.47,8.17,3.46,10.44l25.33,14.63c.71-2.37,1.75-4.84,3.23-7.41,1.19-2.07,2.57-3.8,4.06-5.27l-25.32-14.62Z',
]
// a square around the mark, with room for a status badge in the bottom right corner
const VIEW_BOX = '18 18 124 124'

/**
* @param {string} badge - null, 'check' (published) or 'up' (not published yet)
* @return {object} - a Vue component drawing the mark as an inline SVG
*/
export function createBluecoreIcon(badge = null) {
  // markRaw: menu items are passed around as props, and Vue warns if a component turns reactive
  return markRaw(defineComponent({
    name: badge ? `BluecoreIcon-${badge}` : 'BluecoreIcon',
    render() {
      const children = [
        ...CIRCLES.map(([cx, cy]) => h('circle', { cx, cy, r: 29.25, class: 'bc-icon-circle' })),
        ...LINKS.map((d) => h('path', { d, class: 'bc-icon-link' })),
      ]
      if (badge) {
        children.push(h('circle', { cx: 118, cy: 118, r: 22, class: `bc-icon-badge bc-icon-badge--${badge}` }))
        children.push(h('path', {
          d: badge === 'check' ? 'M107,118.5l7.5,7.5l14.5,-15' : 'M118,129v-21M108.5,117.5l9.5,-9.5l9.5,9.5',
          class: 'bc-icon-badge-mark',
        }))
      }
      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: VIEW_BOX,
        class: 'bc-icon',
        'aria-hidden': 'true',
        focusable: 'false',
      }, children)
    },
  }))
}

export const BluecoreIcon = createBluecoreIcon()
export const BluecorePublishedIcon = createBluecoreIcon('check')
export const BluecoreUnpublishedIcon = createBluecoreIcon('up')
