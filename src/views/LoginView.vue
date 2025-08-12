<script setup>
import { useRoute } from 'vue-router'
import keycloak from '@/lib/keycloak'

const base = import.meta.env.BASE_URL
const route = useRoute()
const kcUnavailable = route.query.kc_status === '1'

function doLogin() {
  keycloak.login({
    redirectUri: window.location.origin + base
  })
}
</script>

<template>
  <div class="marva-bg">
    <header class="marva-header">
      <img src="@/assets/bluecore-small.png" alt="Blue Core Logo" class="marva-header-logo" />
      <span class="marva-header-title">| MARVA</span>
    </header>

    <!-- OUTER BLUE MAT for the card -->
    <div class="marva-mat">
      <div class="marva-card">
        <section class="marva-news">
          <div class="marva-news-title">Latest news</div>
          <div class="marva-version"><strong>Bluecore Marva Version Highlights</strong></div>
          <ul>
            <li>Core authentication powered by Keycloak SSO</li>
            <li>UI/UX aligned with Blue Core platform</li>
            <li>Feedback welcome via GitHub or support channels</li>
          </ul>
        </section>
        <section class="marva-login">
          <div class="marva-login-card">
            <div class="login-title">Login to Marva Editor</div>
            <button class="marva-login-btn" @click="doLogin" :disabled="kcUnavailable">
              Login
            </button>
            <div v-if="kcUnavailable" class="error-banner">
              <strong>Authentication service is unavailable.</strong><br>
              Please try again later or contact support.
            </div>
          </div>
        </section>
      </div>
    </div>

    <!-- ABOUT section below the blue mat/card -->
    <section class="marva-about">
      <div class="about-title">
        A modern Bibframe editor from the Library of Congress
      </div>
      <div style="font-size: 1rem; margin-bottom: 0.8rem;">
        <strong>Marva</strong> is a Bibframe RDF/XML editor developed at the Library of Congress,
        designed to create and edit linked data records for libraries.
        While primarily intended for LC workflows, Marva can be used to edit and manage arbitrary Bibframe records from any institution.
      </div>

      <div class="about-meta">
        Marva is an open-source Vue 3 application (<a href="https://github.com/lcnetdev/marva-quartz" target="_blank" rel="noopener">GitHub</a>) that supports modern cataloging workflows at LC and beyond.<br>
        To learn more or get started, visit the project repository or consult the documentation.
      </div>
    </section>
  </div>
</template>


<style scoped lang="scss">
@use "sass:color";

.marva-bg {
  background: #e9eef6;
  min-height: 100vh;
  font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
}

/* Header */
.marva-header {
  display: flex;
  align-items: center;
  padding: 2rem;

  .marva-header-logo {
    height: 36px;
    width: auto;
    margin-right: 0.5rem;
  }
  .marva-header-title {
    font-size: 2rem;
    font-weight: bold;
    color: #232323;
  }
}

/* OUTER COLORED MAT */
.marva-mat {
  background: #b9cbe1;
  border-radius: 0;
  width: 100%;
  padding: 3.3rem 0 3.7rem 0;   /* plenty of vertical "mat" space */
  margin: 0 auto 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* FLOATING CARD */
.marva-card {
  background: #f7fafd;
  border-radius: 11px;
  box-shadow: 0 4px 16px 0 rgba(40, 50, 100, 0.13);
  display: flex;
  flex-direction: row;
  align-items: stretch;
  justify-content: space-between;
  padding: 2.5rem 3rem;
  width: 930px;
  max-width: 96vw;
  min-width: 700px;
}

/* Card columns */
.marva-news {
  flex: 2;
  padding-right: 2.5rem;
  color: #183653;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.marva-news-title {
  font-size: 1.45rem;
  font-weight: 500;
  margin-bottom: 0.3rem;
  color: #25395d;
}
.marva-version {
  font-size: 1.08rem;
  margin-bottom: 0.6rem;
  color: #294b6d;
  font-weight: 600;
}
.marva-news ul {
  margin: 0 0 0 1.1rem;
  padding: 0;
  font-size: 1.07rem;
  line-height: 1.7;
  color: #1f3148;
  list-style: disc;
}

/* LOGIN */
.marva-login {
  flex: 1.1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.marva-login-card {
  background: #fff;
  border-radius: 9px;
  box-shadow: 0 2px 8px rgba(40,60,120,0.10);
  padding: 2.2rem 2.4rem;
  min-width: 260px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-title {
  font-size: 1.09rem;
  font-weight: 500;
  color: #263b58;
  margin-bottom: 1.1rem;
}
.marva-login-btn {
  background-color: #2264af;
  color: #fff;
  font-weight: 600;
  border: none;
  border-radius: 5px;
  font-size: 1.13rem;
  padding: 0.95rem 2.5rem;
  margin-bottom: 1.3rem;
  margin-top: 0.5rem;
  cursor: pointer;
  transition: background-color 0.16s;

  &:hover {
    background-color: color.adjust(#2264af, $lightness: -7%);
  }
  &:disabled {
    background-color: #7fa5cf;
    cursor: not-allowed;
  }
}

.error-banner {
  background: #ffdce0;
  color: #990000;
  border-radius: 6px;
  padding: 10px 0;
  font-size: 1rem;
  margin: 0.5rem 0 0 0;
  text-align: center;
}

/* ===== ABOUT SECTION (below the mat/card) ===== */
.marva-about {
  background: none;
  margin: 3.5rem auto 0 auto;
  max-width: 940px;
  padding: 1.2rem 2rem 1.7rem 2rem;
  font-size: 1.17rem;
  color: #1a2741;

  .about-title {
    font-size: 1.6rem;
    font-weight: 500;
    margin-bottom: 0.7rem;
    color: #253354;
  }
  ul {
    margin-left: 1.3rem;
    color: #264069;
    font-size: 1.05rem;
    margin-bottom: 0.6rem;
    line-height: 1.6;
  }
  .about-meta {
    color: #6c7895;
    font-size: 0.97rem;
    margin-top: 1.1rem;
  }
}

/* Responsive: allow card/mat to scale down for smaller screens */
@media (max-width: 1100px) {
  .marva-card {
    width: 98vw;
    min-width: 0;
    flex-direction: column;
    padding: 2.2rem 1.5rem;
  }
  .marva-news {
    padding-right: 0;
    margin-bottom: 2.2rem;
  }
  .marva-mat {
    padding: 2.5rem 0;
  }
}

@media (max-width: 750px) {
  .marva-card {
    width: 100vw;
    padding: 1.1rem 0.4rem;
    border-radius: 0;
  }
  .marva-about {
    padding: 0.7rem 0.4rem 1.2rem 0.4rem;
  }
}



</style>
