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
    <div class="login-card">
      <div class="brand">
        <img src="@/assets/bluecore-small.png" alt="Bluecore Logo" class="logo" />
        <span class="brand-text"><strong>Marva</strong></span>
      </div>
      <button class="login-button" @click="doLogin">Log In with Keycloak</button>
    </div>
  </div>
</template>

<style scoped lang="scss">
// Assumes SCSS color variables are globally available

.login-page {
  background-color: $bluecore-bkgrd;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
}

.login-card {
  background-color: $bluecore-header;
  border-radius: 12px;
  padding: 2rem 3rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  text-align: center;
  width: 100%;
  max-width: 400px;
}

.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-bottom: 2rem;
}

.logo {
  height: 36px;
  width: auto;
}

.brand-text {
  font-size: 1.6rem;
  color: $orient;
  font-weight: bold;
}

.login-button {
  background-color: $orient;
  color: $spring-wood;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  border: none;
  border-radius: 6px;
  transition: background-color 0.2s ease;
  cursor: pointer;

  &:hover {
    background-color: darken($orient, 8%);
  }
}
</style>
