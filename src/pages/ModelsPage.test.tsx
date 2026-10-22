import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { ModelListPage } from '@/pages/ModelListPage'
import { ModelRefsPage } from '@/pages/ModelRefsPage'
import { server } from '@/test/mocks/server'
import { renderWithProviders } from '@/test/test-utils'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('Model pages', () => {
  it('renders model list with upload action', async () => {
    renderWithProviders(<ModelListPage />, { route: '/models/list' })

    expect(screen.getByRole('button', { name: /upload model/i })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('odometer-detector')).toBeInTheDocument()
    })
  })

  it('opens create model ref modal from refs page', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModelRefsPage />, { route: '/models/refs' })

    await user.click(screen.getByRole('button', { name: /create model ref/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Create model ref')).toBeInTheDocument()
  })

  it('renders model refs table with metrics and opens metrics modal on click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ModelRefsPage />, { route: '/models/refs' })

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument()
    })

    const metricsBtn = screen.getByRole('button', { name: /metrics/i })
    expect(metricsBtn).toBeInTheDocument()
    await user.click(metricsBtn)

    await waitFor(() => {
      expect(screen.getByText(/Model Ref Metrics & Performance: v1/i)).toBeInTheDocument()
    })

    expect(screen.getByText('Total Unique Images')).toBeInTheDocument()
    expect(screen.getByText(/Failure Types/i)).toBeInTheDocument()
    expect(screen.getByText(/All Small Metrics/i)).toBeInTheDocument()
    expect(screen.getAllByText(/Evaluated Datasets/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Fail Stages Breakdown/i)).toBeInTheDocument()
  })
})
