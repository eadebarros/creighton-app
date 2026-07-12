import { describe, expect, it } from 'vitest';
import { renderCreightonPdf } from '../src/services/pdfRenderer.js';
import type { ExportCycle, ExportData, ExportDay } from '../src/services/pdfRenderer.js';

function day(overrides: Partial<ExportDay> = {}): ExportDay {
  return {
    date: '2026-01-01',
    dayNumber: 1,
    rawCode: '0',
    bleedingType: 'NONE',
    computedState: 'INFERTILE_ALTERNATING',
    peakRelation: 'NOT_APPLICABLE',
    pibActive: false,
    intercourse: false,
    observationCount: 1,
    ...overrides,
  };
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function buildData(cycles: ExportCycle[]): ExportData {
  return {
    cycles,
    summary: {
      userEmail: 'teste@example.com',
      generatedAt: '2026-06-01',
      periodLabel: 'Ciclo atual',
      ruleEngineVersions: [{ version: '0.1.0', from: '2026-01-01', to: null }],
      voidedObservationCount: 2,
    },
  };
}

describe('renderCreightonPdf', () => {
  it('generates a valid PDF buffer for a Regular full cycle, with peak/intercourse markers', async () => {
    const start = '2026-02-01';
    const days: ExportDay[] = [
      day({ date: addDays(start, 0), dayNumber: 1, bleedingType: 'H', computedState: 'FERTILE' }),
      day({ date: addDays(start, 1), dayNumber: 2, bleedingType: 'H', computedState: 'FERTILE' }),
      ...Array.from({ length: 8 }, (_, i) =>
        day({ date: addDays(start, 2 + i), dayNumber: 3 + i, rawCode: i === 3 ? '10C' : '0' }),
      ),
      day({
        date: addDays(start, 10),
        dayNumber: 11,
        rawCode: '10C',
        computedState: 'FERTILE',
        peakRelation: 'P',
        intercourse: true,
      }),
      day({ date: addDays(start, 11), dayNumber: 12, computedState: 'FERTILE', peakRelation: 'P1' }),
      ...Array.from({ length: 15 }, (_, i) =>
        day({
          date: addDays(start, 12 + i),
          dayNumber: 13 + i,
          computedState: 'INFERTILE_ABSOLUTE',
          peakRelation: 'P4_PLUS',
        }),
      ),
    ];
    const cycle: ExportCycle = {
      cycleNumber: 1,
      startDate: start,
      endDate: addDays(start, 26),
      isActive: false,
      variantMode: 'REGULAR',
      confirmedPeakDay: addDays(start, 10),
      days,
    };

    const buffer = await renderCreightonPdf(buildData([cycle]), 'senhaSegura123');
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('generates a valid PDF buffer for a Lactação cycle with an active PIB day and a multi-observation day', async () => {
    const start = '2026-03-01';
    const days: ExportDay[] = [
      ...Array.from({ length: 18 }, (_, i) => day({ date: addDays(start, i), dayNumber: i + 1 })),
      day({
        date: addDays(start, 18),
        dayNumber: 19,
        computedState: 'INFERTILE_ALTERNATING',
        pibActive: true,
        observationCount: 2,
      }),
    ];
    const cycle: ExportCycle = {
      cycleNumber: 1,
      startDate: start,
      endDate: null,
      isActive: true,
      variantMode: 'LACTATION',
      confirmedPeakDay: null,
      days,
    };

    const buffer = await renderCreightonPdf(buildData([cycle]), 'senhaSegura123');
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('annotates a closed cycle with no confirmed peak, without throwing', async () => {
    const start = '2026-04-01';
    const cycle: ExportCycle = {
      cycleNumber: 1,
      startDate: start,
      endDate: addDays(start, 40),
      isActive: false,
      variantMode: 'MENOPAUSE',
      confirmedPeakDay: null,
      days: Array.from({ length: 41 }, (_, i) => day({ date: addDays(start, i), dayNumber: i + 1 })),
    };

    const buffer = await renderCreightonPdf(buildData([cycle]), 'senhaSegura123');
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('renders multiple cycles, each its own page, plus the summary page', async () => {
    const cycles: ExportCycle[] = [1, 2, 3].map((n) => ({
      cycleNumber: n,
      startDate: `2026-0${n}-01`,
      endDate: `2026-0${n}-28`,
      isActive: false,
      variantMode: 'REGULAR',
      confirmedPeakDay: `2026-0${n}-14`,
      days: Array.from({ length: 28 }, (_, i) => day({ date: `2026-0${n}-01`, dayNumber: i + 1 })),
    }));

    const buffer = await renderCreightonPdf(buildData(cycles), 'senhaSegura123');
    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
