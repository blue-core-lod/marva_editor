<script>
import {useProfileStore} from '@/stores/profile'
import {useConfigStore} from '@/stores/config'
import {mapStores, mapWritableState} from 'pinia'
import {VueFinalModal} from 'vue-final-modal'
import VueDragResize from 'vue3-drag-resize'

export default {
  components: {VueFinalModal, VueDragResize},

  data() {
    return {
      width: 0,
      height: 0,
      top: 100,
      left: 0,
      postResults: null,   // null until first attempt
      posting: false,
      showDetails: false,
      showDebug: true,     // <-- quick toggle; set to false to hide by default
      initalHeight: 550,
      initalLeft: (window.innerWidth / 2) - 450,
      _lastRawResponse: null, // for debug panel
    }
  },

  computed: {
    ...mapStores(useProfileStore, useConfigStore),
    ...mapWritableState(useProfileStore, [
      'showPostModal',
      'activeProfilePosted',
      'activeProfilePostedTimestamp',
      'activeProfile',
    ]),
    // helpful flags for template & logging
    hasResult() {
      return !!this.postResults && Object.keys(this.postResults).length > 0
    },
    isSuccess() {
      return !!this.postResults && this.postResults.status === true
    },
    isError() {
      return !!this.postResults && this.postResults.status === false
    },
  },

  watch: {
    postResults: {
      deep: true,
      handler(n) {
        // Debug when normalized result changes
        console.groupCollapsed('%c[PostModal] postResults changed', 'color:#2563eb')
        console.log('normalized:', n)
        console.log('isSuccess:', this.isSuccess, 'isError:', this.isError, 'hasResult:', this.hasResult)
        console.groupEnd()
      }
    }
  },

  methods: {
    done() {
      this.showPostModal = false
    },

    dragResize(newRect) {
      this.width = newRect.width
      this.height = newRect.height
      this.top = newRect.top
      this.left = newRect.left
      if (this.$refs.modalBody) this.$refs.modalBody.style.height = newRect.height + 'px'
    },

    async post() {
      const config = useConfigStore()

      if (!config.returnUrls.displayLCOnlyFeatures) {
        this.showPostModal = false
        alert('Sorry you cannot post in this Marva environment')
        return false
      }

      if (this.$refs.modalBody) this.$refs.modalBody.style.height = this.initalHeight + 'px'

      this.posting = true
      this.postResults = null
      this._lastRawResponse = null
      this.showDetails = false

      try {
        const raw = await this.profileStore.publishRecord()
        this._lastRawResponse = raw

        console.groupCollapsed('%c[PostModal] raw publishRecord() response', 'color:#16a34a')
        console.log(raw)
        console.groupEnd()

        const normalized = this.normalizePostResults(raw)
        console.groupCollapsed('%c[PostModal] normalized result', 'color:#16a34a')
        console.log(normalized)
        console.groupEnd()

        this.postResults = normalized
      } catch (e) {
        console.groupCollapsed('%c[PostModal] publish error caught', 'color:#dc2626')
        console.error(e)
        console.groupEnd()

        this.postResults = {
          status: false,
          postLocation: null,
          msg: e?.message || e || 'Unknown error',
          resourceLinks: [],
          raw: e,
        }
      } finally {
        this.posting = false
      }

      // log final decision flags
      console.groupCollapsed('%c[PostModal] status flags', 'color:#2563eb')
      console.log('isSuccess:', this.isSuccess)
      console.log('isError:', this.isError)
      console.log('hasResult:', this.hasResult)
      console.groupEnd()

      if (this.isSuccess) {
        this.activeProfilePosted = true
        this.activeProfilePostedTimestamp = Date.now()
      } else {
        this.activeProfilePosted = false
        this.activeProfilePostedTimestamp = false
      }
    },

    normalizePostResults(res) {
      const obj = (res && typeof res === 'object') ? res : {}

      // New minimal API (after FastAPI model trimming)
      if ('uri' in obj && 'workflow_id' in obj) {
        return {
          status: true,
          postLocation: obj.postLocation || obj.uri || null,
          resourceLinks: Array.isArray(obj.resourceLinks) ? obj.resourceLinks : [],
          raw: obj,
        }
      }

      // Legacy server shape
      if (obj.publish && obj.publish.status === 'published') {
        return {
          status: true,
          postLocation: obj.postLocation || obj.uri || null,
          resourceLinks: Array.isArray(obj.resourceLinks) ? obj.resourceLinks : [],
          raw: obj,
        }
      }

      // Legacy client wrapper
      if (typeof obj.status === 'boolean') {
        return {
          status: obj.status,
          postLocation: obj.postLocation || obj.uri || null,
          msg: obj.msg ?? '',
          resourceLinks: Array.isArray(obj.resourceLinks) ? obj.resourceLinks : [],
          raw: obj,
        }
      }

      // Fallback -> error
      return {
        status: false,
        postLocation: obj.postLocation || obj.uri || null,
        msg: obj || 'Unexpected response',
        resourceLinks: [],
        raw: obj,
      }
    },

    copyErrorToClipboard() {
      const text = this.formatMsg(this.postResults?.msg)
      navigator.clipboard.writeText(text).catch(() => {
      })
    },

    copyLocation() {
      const loc = this.postResults?.postLocation || ''
      if (!loc) return
      navigator.clipboard.writeText(loc).catch(() => {
      })
    },

    formatMsg(msg) {
      if (msg == null) return ''
      if (typeof msg !== 'string') {
        try {
          return JSON.stringify(msg, null, 2)
        } catch {
          return String(msg)
        }
      }
      try {
        return JSON.stringify(JSON.parse(msg), null, 2)
      } catch {
      }
      return msg
          .replace(/\\n|\\t/g, '')
          .replace(/\\"/g, '"')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
    },

    getLcapUrl() {
      const base = useConfigStore().returnUrls.lcap
      let bibId = null
      for (const rt in this.activeProfile.rt) {
        const type = rt.split(':').slice(-1)[0]
        const url = this.activeProfile.rt[rt].URI
        if (type === 'Instance') {
          const parts = url.split('/')
          bibId = parts[parts.length - 1]
        }
      }
      return base + (bibId ?? '')
    },
  },
}
</script>

<template>
  <VueFinalModal
      display-directive="show"
      :hide-overlay="false"
      :overlay-transition="'vfm-fade'"
      :click-to-close="false"
      :esc-to-close="false"
  >
    <VueDragResize
        :is-active="true"
        :w="900"
        :h="initalHeight"
        :x="initalLeft"
        class="login-modal modern-box"
        @resizing="dragResize"
        @dragging="dragResize"
        :sticks="['br']"
        :stickSize="22"
    >
      <div id="modal-body" ref="modalBody" @mousedown.stop @touchstart.stop>
        <!-- header -->
        <div class="header">
          <div class="title">Post to Bluecore</div>
          <div class="header-actions">
            <label class="debug-toggle">
              <input type="checkbox" v-model="showDebug"/>
              <span>Debug</span>
            </label>
            <button class="close-btn" @click="done">✕</button>
          </div>
        </div>

        <!-- loading -->
        <div v-if="posting" class="panel center">
          <div class="spinner"></div>
          <div class="panel-title">Posting… please wait</div>
        </div>

        <!-- success -->
        <div v-else-if="isSuccess" class="panel success">
          <div class="icon">✅</div>
          <div class="panel-title">Marva Posted to Bluecore Successfully</div>

          <div class="meta">
            <div v-if="postResults.raw?.workflow_id">
              <strong>Workflow ID:</strong> <code>{{ postResults.raw.workflow_id }}</code>
            </div>
            <div v-if="postResults.postLocation">
              <strong>Location:</strong> <code>{{ postResults.postLocation }}</code>
              <button class="btn ghost" @click="copyLocation">Copy</button>
            </div>
          </div>

          <div
              v-if="postResults.resourceLinks && postResults.resourceLinks.length"
              class="links"
          >
            <div class="links-title">View record:</div>
            <div class="link-list">
              <div v-for="rl in postResults.resourceLinks" :key="rl.url || rl">
                <a :href="(rl.url || rl)" target="_blank">
                  {{ rl.type ? `View ${rl.type}` : 'Open link' }} <span v-if="rl.env"></span>
                </a>
              </div>
            </div>
          </div>

          <div class="actions">
            <!--            <a class="btn primary" :href="getLcapUrl()" target="_blank">Open in LCAP</a>-->
            <button class="btn" @click="showDetails = !showDetails">
              {{ showDetails ? 'Hide' : 'Show' }} details
            </button>
            <button class="btn" @click="done">Close</button>
          </div>

          <pre v-if="showDetails" class="details">{{ formatMsg(postResults.raw) }}</pre>
        </div>

        <!-- error -->
        <div v-else-if="isError" class="panel error">
          <div class="icon">⚠️</div>
          <div class="panel-title">There was an error posting</div>
          <pre class="details">{{ formatMsg(postResults.msg) }}</pre>
          <div class="actions">
            <button class="btn" @click="copyErrorToClipboard">Copy error</button>
            <button class="btn" @click="done">Close</button>
          </div>
        </div>

        <!-- idle / default -->
        <div v-else class="panel center">
          <div class="panel-title">Ready to publish</div>
          <div class="actions">
            <button class="btn primary" @click="post">Publish now</button>
            <button class="btn" @click="done">Close</button>
          </div>
        </div>

        <!-- DEBUG BLOCK -->
        <div v-if="showDebug" class="panel debug">
          <div class="panel-title">Debug</div>
          <div class="kv"><b>hasResult:</b> <code>{{ hasResult }}</code></div>
          <div class="kv"><b>isSuccess:</b> <code>{{ isSuccess }}</code></div>
          <div class="kv"><b>isError:</b> <code>{{ isError }}</code></div>
          <div class="kv"><b>postLocation:</b> <code>{{ postResults?.postLocation }}</code></div>
          <div class="kv"><b>workflow_id (raw):</b> <code>{{ postResults?.raw?.workflow_id }}</code></div>
          <div class="kv"><b>last raw response:</b></div>
          <pre class="details">{{ formatMsg(_lastRawResponse) }}</pre>
          <div class="kv"><b>normalized:</b></div>
          <pre class="details">{{ formatMsg(postResults) }}</pre>
        </div>
      </div>
    </VueDragResize>
  </VueFinalModal>
</template>

<style scoped>
#modal-body {
  overflow-y: auto;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modern-box {
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, .1), 0 4px 6px -2px rgba(0, 0, 0, .05);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid #f0f0f0;
}

.title {
  font-weight: 700;
  font-size: 1.1rem;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.close-btn {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 10px;
  cursor: pointer;
}

.panel {
  background: #fff;
  border: 1px solid #eef2f7;
  border-radius: 12px;
  padding: 16px;
}

.panel.center {
  text-align: center;
}

.panel.success {
  border-color: #def7ec;
  background: #f0fdf4;
}

.panel.error {
  border-color: #fde2e1;
  background: #fff5f5;
}

.panel.debug {
  border-color: #e5e7eb;
  background: #f9fafb;
}

.panel-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.icon {
  font-size: 24px;
  margin-bottom: 4px;
}

.meta {
  margin: 8px 0 12px;
  display: grid;
  gap: 6px;
}

.links-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.link-list a {
  color: #2563eb;
  text-decoration: none;
}

.link-list a:hover {
  text-decoration: underline;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.btn {
  border: 1px solid #e5e7eb;
  background: #fff;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.btn.primary {
  background: #111827;
  color: #fff;
  border-color: #111827;
}

.btn.ghost {
  background: transparent;
  border: 1px dashed #cbd5e1;
  color: #111827;
}

.debug-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}

code {
  background: #f7fafc;
  padding: 2px 4px;
  border-radius: 6px;
}

.details {
  background: #0b1220;
  color: #e5e7eb;
  border-radius: 10px;
  padding: 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  overflow: auto;
  max-height: 240px;
  margin-top: 8px;
}

.spinner {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 3px solid #e5e7eb;
  border-top-color: #111827;
  animation: spin 1s linear infinite;
  margin: 0 auto 8px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.kv {
  margin: 4px 0;
}
</style>
