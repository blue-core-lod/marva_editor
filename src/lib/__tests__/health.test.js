import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  HEALTH_ASSET_FILE_NAME,
  HEALTH_ROUTE,
  PACKAGE_VERSION,
  buildHealthPayload,
  healthEndpointPlugin,
  healthResponseBody
} from '@/lib/health.js'

// Read package.json off disk rather than reusing the module's import, so the
// assertions break if the reported version ever drifts from the manifest.
const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8'))

// Minimal stand-in for a node http ServerResponse.
function fakeResponse() {
  return {
    headers: {},
    statusCode: 0,
    body: undefined,
    ended: false,
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    end(body) {
      this.body = body
      this.ended = true
    }
  }
}

// Registers the plugin against a fake dev server and hands back the middleware.
function devMiddleware(plugin, config = { command: 'serve', base: '/marva/' }) {
  plugin.configResolved(config)
  let handler
  plugin.configureServer({
    middlewares: {
      use(fn) {
        handler = fn
      }
    }
  })
  return handler
}

describe('health payload', () => {
  test('reports ok status with the supplied version', () => {
    expect(buildHealthPayload('1.2.3')).toStrictEqual({ status: 'ok', version: '1.2.3' })
  })

  test('carries no keys beyond status and version', () => {
    expect(Object.keys(buildHealthPayload('1.2.3'))).toStrictEqual(['status', 'version'])
  })

  test('falls back to the package.json version', () => {
    expect(buildHealthPayload()).toStrictEqual({ status: 'ok', version: packageJson.version })
  })

  test('PACKAGE_VERSION matches package.json', () => {
    expect(PACKAGE_VERSION).toBe(packageJson.version)
  })

  test('response body is JSON encoded', () => {
    expect(JSON.parse(healthResponseBody('1.2.3'))).toStrictEqual({ status: 'ok', version: '1.2.3' })
  })
})

describe('health endpoint vite plugin', () => {
  test('serves the payload on /health in dev', () => {
    const handler = devMiddleware(healthEndpointPlugin({ version: '1.2.3' }))
    const res = fakeResponse()
    let nextCalled = false

    handler({ url: HEALTH_ROUTE }, res, () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('application/json; charset=utf-8')
    expect(res.headers['cache-control']).toBe('no-store')
    expect(JSON.parse(res.body)).toStrictEqual({ status: 'ok', version: '1.2.3' })
  })

  test('ignores a query string on the health route', () => {
    const handler = devMiddleware(healthEndpointPlugin({ version: '1.2.3' }))
    const res = fakeResponse()

    handler({ url: `${HEALTH_ROUTE}?probe=1` }, res, () => {})

    expect(res.statusCode).toBe(200)
  })

  test('also answers the base-prefixed health route', () => {
    const handler = devMiddleware(healthEndpointPlugin({ version: '1.2.3' }))
    const res = fakeResponse()

    handler({ url: '/marva/health' }, res, () => {})

    expect(JSON.parse(res.body)).toStrictEqual({ status: 'ok', version: '1.2.3' })
  })

  test('passes every other request through untouched', () => {
    const handler = devMiddleware(healthEndpointPlugin({ version: '1.2.3' }))
    const res = fakeResponse()
    let nextCalled = false

    handler({ url: '/marva/index.html' }, res, () => {
      nextCalled = true
    })

    expect(nextCalled).toBe(true)
    expect(res.ended).toBe(false)
  })

  test('emits the health asset during a build', () => {
    const plugin = healthEndpointPlugin({ version: '1.2.3' })
    const emitted = []

    plugin.configResolved({ command: 'build', base: '/marva/' })
    plugin.buildStart.call({ emitFile: (file) => emitted.push(file) })

    expect(emitted).toHaveLength(1)
    expect(emitted[0].type).toBe('asset')
    expect(emitted[0].fileName).toBe(HEALTH_ASSET_FILE_NAME)
    expect(JSON.parse(emitted[0].source)).toStrictEqual({ status: 'ok', version: '1.2.3' })
  })

  test('emits the package.json version when none is supplied', () => {
    const plugin = healthEndpointPlugin()
    const emitted = []

    plugin.configResolved({ command: 'build', base: '/marva/' })
    plugin.buildStart.call({ emitFile: (file) => emitted.push(file) })

    expect(JSON.parse(emitted[0].source)).toStrictEqual({
      status: 'ok',
      version: packageJson.version
    })
  })

  test('emits nothing while serving', () => {
    const plugin = healthEndpointPlugin({ version: '1.2.3' })
    const emitted = []

    plugin.configResolved({ command: 'serve', base: '/marva/' })
    plugin.buildStart.call({ emitFile: (file) => emitted.push(file) })

    expect(emitted).toHaveLength(0)
  })
})
