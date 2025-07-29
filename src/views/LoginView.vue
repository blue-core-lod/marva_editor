<script setup>
import keycloak from '@/lib/keycloak'

const base = import.meta.env.BASE_URL

function doLogin() {
  keycloak.login({
    redirectUri: window.location.origin + base
  })
}
</script>

<template>
  <div class="login-page">
    <h1>Bluecore Marva</h1>
    <button @click="doLogin">Click here to login</button>
  </div>
</template>

<style scoped>
.login-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  font-family: sans-serif;
}

button {
  margin-top: 20px;
  padding: 12px 24px;
  font-size: 1.1rem;
  cursor: pointer;
}
</style>
