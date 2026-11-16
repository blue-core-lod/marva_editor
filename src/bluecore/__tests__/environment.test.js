// BLUECORE: tests for the Blue Core environment configs (../environment.js)
import { describe, it, expect } from 'vitest'
import { bluecore } from '../environment.js'

describe.each(Object.entries(bluecore))('%s environment', (_name, env) => {
  it('sends validation to the util middleware, not localhost', () => {
    expect(env.validate).not.toMatch(/localhost/)
    expect(env.validate).toBe(`${env.util}validate/prod`)
  })
})
