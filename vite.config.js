import { fileURLToPath, URL } from "node:url";
import { configDefaults } from 'vitest/config'

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

import { healthEndpointPlugin } from "./src/lib/health.js";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), healthEndpointPlugin()],
  base: '/marva/',
  // build: {
  //   sourcemap: true,
  //   minify: false,
  // },  
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      'vue-i18n': 'vue-i18n/dist/vue-i18n.cjs.js',


    },
  },
  test:{
    globals: true,
    environment: "jsdom",
    globalSetup: './src/lib/vitest_globalSetup.js',    
    // setupFiles: './lib/vitest_globalSetup.js',   
    exclude:[
      ...configDefaults.exclude,
      'tests-playwright/*'
    ]


    
  }
});
