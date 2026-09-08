import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  exploreSamples,
  getExplorerSample,
  getSettings,
  setLifecycle,
  setQualityTag,
} from '@/api/explorer'
import { server } from '@/test/mocks/server'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('explorer api', () => {
  it('lists samples with task filter', async () => {
    const result = await exploreSamples({
      task_key: 'odometer',
      source: 'databank',
      limit: 10,
    })
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.filename).toBe('1-887512.jpg')
    expect(result.lifecycle_states).toContain('review_required')
    expect(result.quality_tags).toContain('good')
  })

  it('gets sample detail', async () => {
    const detail = await getExplorerSample('databank', 'sample-1')
    expect(detail.filename).toBe('1-887512.jpg')
    expect(detail.predictions).toHaveLength(1)
    expect(detail.predictions[0]?.kind).toBe('upload')
  })

  it('patches lifecycle and quality tag', async () => {
    const lifecycle = await setLifecycle('ds-1', 'sample-1', 'verified')
    expect(lifecycle.lifecycle_state).toBe('verified')

    const quality = await setQualityTag('ds-1', 'sample-1', 'blur')
    expect(quality.quality_tag).toBe('blur')
  })

  it('loads platform settings', async () => {
    const settings = await getSettings()
    expect(settings.workers.training_worker_enabled).toBe(true)
    expect(settings.training_gates.min_exact_match).toBe(0.95)
    expect(settings.note).toMatch(/env-driven/i)
  })
})
