// @vitest-environment node
// BLUECORE: tests for /marva/health on the dev server (../dev-health.js)
import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { healthHandler, latestGitTag, HEALTH_PATH } from '../dev-health.js'

function fakeResponse() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v }, end: vi.fn() }
}

describe('healthHandler', () => {
  it('answers /marva/health with the version', () => {
    const res = fakeResponse()
    const next = vi.fn()
    healthHandler('v0.4.04')({ url: `${HEALTH_PATH}?t=1` }, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({ status: 'ok', version: 'v0.4.04' })
  })

  it('passes every other request on', () => {
    const res = fakeResponse()
    const next = vi.fn()
    healthHandler('v0.4.04')({ url: '/marva/health/extra' }, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.end).not.toHaveBeenCalled()
  })
})

describe('latestGitTag', () => {
  it('is "local-dev" outside a Git checkout', () => {
    const dir = mkdtempSync(join(tmpdir(), 'marva-version-'))
    try {
      expect(latestGitTag(dir)).toBe('local-dev')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
