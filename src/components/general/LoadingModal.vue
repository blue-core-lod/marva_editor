<script>
import { useProfileStore } from '@/stores/profile'
import { mapStores, mapState } from 'pinia'

export default {
  data() {
    return {}
  },
  computed: {
    ...mapStores(useProfileStore),
    ...mapState(useProfileStore, ['profilesLoaded']),
  },
  methods: {},
  mounted() {
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition appear>
      <div v-if="profilesLoaded == false" class="modal">
        <div class="modal-row">
          <div class="loader"></div>
          <h1>{{ $t("message.generalLoadingModalLoadingMsg") }}</h1>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
.modal {
  color: var(--c-black);
  position: fixed;
  z-index: 999;
  top: 0%;
  left: 0%;
  width: 100%;
  height: 7vmin;
  background-color: $bluecore-header;
  border: solid 1px var(--c-gray-soft);
  box-shadow: 0px 6px 7px 0px var(--c-black-mute);
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-row {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 1.5rem;
}

.modal-row h1 {
  font-size: 5vmin;
  margin: 0;
  color: $orient;
}

.loader {
  border: 8px solid #eee;
  border-top: 8px solid $orient;
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  0% { transform: rotate(0deg);}
  100% { transform: rotate(360deg);}
}

.v-enter-active,
.v-leave-active {
  transition: opacity 0.5s ease;
}
.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
