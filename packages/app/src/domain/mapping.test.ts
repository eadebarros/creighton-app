import { describe, expect, it } from 'vitest';
import { answersToEntryInput, entryInputToRowValues, rowToEntryInput } from './mapping';
import type { DailyEntryRow } from './mapping';

describe('rowToEntryInput', () => {
  it('maps a full row (mucus + shiny + intercourse) to DailyEntryInput', () => {
    const row: DailyEntryRow = {
      id: 'e1',
      cycle_id: 'c1',
      date: '2026-01-10',
      bleeding_type: 'NONE',
      mucus_sensation: 'WET',
      mucus_stretch: 'ELASTIC',
      mucus_color: 'CLEAR',
      shiny_reflex: null,
      raw_code: '10C',
      intercourse: 1,
      entered_at: '2026-01-10T08:00:00Z',
    };
    expect(rowToEntryInput(row)).toEqual({
      date: '2026-01-10',
      bleedingType: 'NONE',
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
      shinyReflex: undefined,
      intercourse: true,
    });
  });

  it('maps a dry row with shiny_reflex=1 and no mucus color/intercourse', () => {
    const row: DailyEntryRow = {
      id: 'e2',
      cycle_id: 'c1',
      date: '2026-01-02',
      bleeding_type: 'NONE',
      mucus_sensation: 'DRY',
      mucus_stretch: 'NONE',
      mucus_color: null,
      shiny_reflex: 1,
      raw_code: '4',
      intercourse: 0,
      entered_at: '2026-01-02T08:00:00Z',
    };
    expect(rowToEntryInput(row)).toEqual({
      date: '2026-01-02',
      bleedingType: 'NONE',
      mucusSensation: 'DRY',
      mucusStretch: 'NONE',
      mucusColor: undefined,
      shinyReflex: true,
      intercourse: false,
    });
  });
});

describe('answersToEntryInput', () => {
  it('defaults mucusStretch to NONE when the mucus branch was skipped (Seco)', () => {
    expect(
      answersToEntryInput(
        { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false },
        '2026-01-01',
      ),
    ).toEqual({
      date: '2026-01-01',
      bleedingType: 'NONE',
      mucusSensation: 'DRY',
      mucusStretch: 'NONE',
      mucusColor: undefined,
      shinyReflex: undefined,
      intercourse: false,
    });
  });

  it('carries mucus color/stretch through when the mucus branch was taken', () => {
    expect(
      answersToEntryInput(
        {
          bleedingType: 'NONE',
          mucusSensation: 'WET',
          mucusColor: 'RED',
          mucusStretch: 'TACKY',
          intercourse: true,
        },
        '2026-01-05',
      ),
    ).toMatchObject({ mucusColor: 'RED', mucusStretch: 'TACKY', intercourse: true });
  });
});

describe('entryInputToRowValues', () => {
  it('converts booleans/undefined to SQLite-friendly 0/1/null', () => {
    expect(
      entryInputToRowValues(
        {
          date: '2026-01-01',
          bleedingType: 'NONE',
          mucusSensation: 'DRY',
          mucusStretch: 'NONE',
          intercourse: false,
        },
        '0',
      ),
    ).toEqual({
      bleeding_type: 'NONE',
      mucus_sensation: 'DRY',
      mucus_stretch: 'NONE',
      mucus_color: null,
      shiny_reflex: null,
      raw_code: '0',
      intercourse: 0,
    });
  });

  it('round-trips through rowToEntryInput for a full mucus+intercourse day', () => {
    const entry = {
      date: '2026-01-11',
      bleedingType: 'NONE' as const,
      mucusSensation: 'WET' as const,
      mucusStretch: 'ELASTIC' as const,
      mucusColor: 'CLEAR' as const,
      shinyReflex: false,
      intercourse: true,
    };
    const rowValues = entryInputToRowValues(entry, '10C');
    const row: DailyEntryRow = {
      id: 'e1',
      cycle_id: 'c1',
      date: entry.date,
      entered_at: '2026-01-11T08:00:00Z',
      ...rowValues,
    };
    expect(rowToEntryInput(row)).toEqual(entry);
  });
});
