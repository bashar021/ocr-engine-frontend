import { fireEvent, screen, waitFor, within } from '@testing-library/react'
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
    expect(screen.getByText('Total Datasets')).toBeInTheDocument()
    expect(screen.getByText('Ready for Use')).toBeInTheDocument()
    expect(screen.getByText('Total Samples')).toBeInTheDocument()
    expect(screen.getByText('Active Pipelines')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /upload dataset/i })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('dashboard-eval')).toBeInTheDocument()
    })

    // The Evaluate button feature has been removed from this Datasets tab
    expect(screen.queryByRole('button', { name: /^evaluate$/i })).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /samples/i }).length).toBeGreaterThan(0)
  })

  it('lists evaluation runs with metric columns', async () => {
    renderWithProviders(<EvaluationRunsPage />, { route: '/evaluation/runs' })

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument()
    })
    expect(screen.getAllByText('E2E accuracy').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /results/i }).length).toBeGreaterThan(0)
    expect(screen.getAllByRole('button', { name: /metrics/i }).length).toBeGreaterThan(0)
  })

  it('opens evaluation metrics modal showing small metrics and failure type metrics with count and percentage', async () => {
    renderWithProviders(<EvaluationRunsPage />, { route: '/evaluation/runs' })

    await waitFor(() => {
      expect(screen.getByText('v1')).toBeInTheDocument()
    })

    const metricsBtn = screen.getAllByRole('button', { name: /metrics/i })[0]
    expect(metricsBtn).toBeInTheDocument()
    fireEvent.click(metricsBtn)

    await waitFor(() => {
      expect(screen.getByText('Evaluation Metrics & Failure Analysis')).toBeInTheDocument()
    })

    // Check top cards and sections
    expect(screen.getByText('Total Samples')).toBeInTheDocument()
    expect(screen.getByText('Exact Match (Acc)')).toBeInTheDocument()
    expect(screen.getByText('Detection Success')).toBeInTheDocument()

    // Check failure types tab and small metrics tabs
    expect(screen.getByText(/Failure Types/i)).toBeInTheDocument()
    expect(screen.getByText(/All Small Metrics/i)).toBeInTheDocument()
    expect(screen.getByText(/Fail Stages Breakdown/i)).toBeInTheDocument()

    // Switch to All Small Metrics tab
    fireEvent.click(screen.getByText(/All Small Metrics/i))
    await waitFor(() => {
      expect(screen.getByText('Detection Metrics')).toBeInTheDocument()
      expect(screen.getByText('Recognition Metrics')).toBeInTheDocument()
    })
  })

  it('opens Run Evaluation modal with both label and raw datasets in dropdown', async () => {
    renderWithProviders(<EvaluationRunsPage />, { route: '/evaluation/runs' })

    const runEvalBtn = screen.getByRole('button', { name: /run evaluation/i })
    expect(runEvalBtn).toBeInTheDocument()

    fireEvent.click(runEvalBtn)

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Run Evaluation')).toBeInTheDocument()
    expect(within(dialog).getByText('Dataset')).toBeInTheDocument()
    expect(within(dialog).getByText('Model / Pipeline')).toBeInTheDocument()
    expect(within(dialog).getByText('Evaluation Type')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /start evaluation/i })).toBeInTheDocument()

    // Open Dataset dropdown inside the modal and verify both Label and Raw dataset groups/items appear
    const datasetCombobox = within(dialog).getAllByRole('combobox')[0]
    fireEvent.mouseDown(datasetCombobox)

    await waitFor(() => {
      expect(screen.getByText('Label Datasets')).toBeInTheDocument()
      expect(screen.getByText('Raw Datasets')).toBeInTheDocument()
    })
    expect(screen.getByText(/raw-batch-2026 \[Raw\]/i)).toBeInTheDocument()
  })
})
