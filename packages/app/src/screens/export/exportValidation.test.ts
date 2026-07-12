import { describe, expect, it } from 'vitest';
import { validateExportForm } from './exportValidation';

const base = { period: 'current' as const, customStart: '', customEnd: '' };

describe('validateExportForm', () => {
  it('accepts a valid current-period request', () => {
    expect(validateExportForm(base)).toBeNull();
  });

  it('requires well-formed dates for a custom period', () => {
    expect(validateExportForm({ ...base, period: 'custom', customStart: '2026-01-01', customEnd: '2026-02-01' })).toBeNull();
    expect(validateExportForm({ ...base, period: 'custom', customStart: '01/01/2026', customEnd: '2026-02-01' })).not.toBeNull();
    expect(validateExportForm({ ...base, period: 'custom', customStart: '', customEnd: '' })).not.toBeNull();
  });

  it('rejects a custom range where the start date is after the end date', () => {
    expect(
      validateExportForm({ ...base, period: 'custom', customStart: '2026-03-01', customEnd: '2026-01-01' }),
    ).not.toBeNull();
  });
});
