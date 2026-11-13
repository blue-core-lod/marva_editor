// BLUECORE: /marva/health for the Vite dev server (Blue Core's ./scripts/dev/run).
//
// The published image writes /marva/health at build time from the release tag
// (see Dockerfile). The dev server has no such file, so this plugin answers it
// the same way, with the newest release tag in the checkout. The Blue Core
// dashboard shows it as "Version: …".
//
// Runs in Node (loaded by vite.config.js), never in the browser.
import { execFileSync } from 'node:child_process'

export const HEALTH_PATH = '/marva/health'

/** The newest tag reachable from HEAD, or "local-dev" without Git or tags */
export function latestGitTag(cwd = process.cwd()) {
  try {
    return execFileSync('git', ['describe', '--tags', '--abbrev=0'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim() || 'local-dev'
  } catch {
    return 'local-dev'
  }
}

/** Answers GET /marva/health with Marva's version: {"status":"ok","version":…} */
export function healthHandler(version) {
  const body = JSON.stringify({ status: 'ok', version })
  return (req, res, next) => {
    if ((req.url || '').split('?')[0] !== HEALTH_PATH) return next()
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.end(body)
  }
}

/** Vite plugin: serve /marva/health from the dev server (not used by builds or tests) */
export function bluecoreDevHealth() {
  return {
    name: 'bluecore-dev-health',
    configureServer(server) {
      server.middlewares.use(healthHandler(latestGitTag(server.config.root)))
    },
  }
}
