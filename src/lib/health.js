/**
 * Health endpoint for the Marva editor container.
 *
 * The editor is a static bundle served by nginx, so there is no application
 * server to answer a probe at runtime. Instead the payload is frozen at build
 * time into a `health` asset that nginx exposes at `/health` (see nginx.conf),
 * and the same payload is served by a dev-server middleware so `npm run dev`
 * behaves the same way.
 */

import packageJson from '../../package.json'

// Path that nginx and the dev server both answer on.
export const HEALTH_ROUTE = '/health'

// Name of the asset emitted into dist/ by the build.
export const HEALTH_ASSET_FILE_NAME = 'health'

// Version reported by the endpoint, straight out of package.json.
export const PACKAGE_VERSION = packageJson.version

/**
 * Builds the health payload.
 *
 * @param {string} [version] - Defaults to the package.json version
 * @returns {{ status: string, version: string }}
 */
export function buildHealthPayload(version = PACKAGE_VERSION) {
  return { status: 'ok', version }
}

/**
 * Serialized form of the health payload.
 *
 * @param {string} [version] - Defaults to the package.json version
 * @returns {string} JSON encoded payload
 */
export function healthResponseBody(version) {
  return JSON.stringify(buildHealthPayload(version))
}

/**
 * Vite plugin that exposes the health payload in both dev and production.
 *
 * @param {{ version?: string }} [options] - Pin the reported version; defaults to package.json
 * @returns {import('vite').Plugin}
 */
export function healthEndpointPlugin(options = {}) {
  const body = healthResponseBody(options.version)
  let isBuild = false
  let basePrefixedRoute = HEALTH_ROUTE

  return {
    name: 'marva-health-endpoint',

    configResolved(config) {
      isBuild = config.command === 'build'
      // With base '/marva/' the deployed asset also lands at /marva/health, so
      // answer that path in dev too.
      basePrefixedRoute = `${(config.base || '/').replace(/\/$/, '')}${HEALTH_ROUTE}`
    },

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0]
        if (pathname !== HEALTH_ROUTE && pathname !== basePrefixedRoute) {
          return next()
        }

        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.statusCode = 200
        res.end(body)
      })
    },

    buildStart() {
      if (!isBuild) return
      this.emitFile({
        type: 'asset',
        fileName: HEALTH_ASSET_FILE_NAME,
        source: body
      })
    }
  }
}
