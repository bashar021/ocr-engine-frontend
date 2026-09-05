import { describe, expect, it } from 'vitest'

import { formatBytes, formatMs, formatPercent, truncateDigest } from '@/utils/format'

describe('format utils', () => {
  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2.0 KB')
    expect(formatBytes(null)).toBe('—')
  })

  it('formats percent ratios', () => {
    expect(formatPercent(0.956)).toBe('95.6%')
    expect(formatPercent(undefined)).toBe('—')
  })

  it('formats latency', () => {
    expect(formatMs(45.2)).toBe('45 ms')
    expect(formatMs(null)).toBe('—')
  })

  it('truncates digests', () => {
    expect(truncateDigest('sha256:abcdef0123456789', 12)).toBe('sha256:abcde…')
  })
})
