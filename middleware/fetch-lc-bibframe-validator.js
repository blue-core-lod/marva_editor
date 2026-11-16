// BLUECORE: downloads LC's latest BIBFRAME validator (the same check bibframe.org runs).
// Runs automatically on `npm install` / `npm ci`, so every build gets LC's newest copy.
// Stops the install if the download fails, so we never build without it.
const fs = require('fs')
const path = require('path')

const SOURCE = 'https://raw.githubusercontent.com/lcnetdev/marva-backend/main/util-service/services/bfValidationService.js'
const TARGET = path.join(__dirname, 'lc-bibframe-validator.js')

fetch(SOURCE)
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.text()
  })
  .then((code) => {
    fs.writeFileSync(TARGET, code)
    console.log(`Downloaded LC validator -> ${TARGET}`)
  })
  .catch((err) => {
    console.error(`Could not download LC validator from ${SOURCE}: ${err.message}`)
    process.exit(1)
  })
