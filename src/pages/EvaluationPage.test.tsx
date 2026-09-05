import { screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { EvaluationDatasetsPage } from '@/pages/EvaluationDatasetsPage'
import { EvaluationRunsPage } from '@/pages/EvaluationRunsPage'
import { server } from '@/test/mocks/server'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Evaluation pages', () => {
  it('lists datasets', async () => {
    renderWithProviders(<EvaluationDatasetsPage />, {
      route: '/evaluation/datasets',
    })

    expect(screen.getByText(/polling every 10s/i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('dashboard-eval')).toBeInTheDocument()
    })
  })

  it('lists evaluation runs with metric columns', async () => {
    renderWithProviders(<EvaluationRunsPage />, { route: '/evaluation/runs' })

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument()
    })
    expect(screen.getAllByText('E2E accuracy').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /results/i })).toBeInTheDocument()
  })
})
