import type { CaptureAnswers } from '../domain/mapping';
import { addDays, today } from '../domain/dateMath';
import { recordEntry } from './entryRepository';
import type { SqlExecutor } from './executor';

/**
 * __DEV__-only fixture: a synthetic ~20-day cycle ending today, exercising
 * all four chart phases (Menstruação/Infértil/Fértil/Pós-Ápice) so the chart
 * screen has something real to render before all 5 capture screens exist.
 * Mirrors the shape of rules-engine's fullCycle.test.ts fixture, compressed
 * to 20 days. Not a clinical validation fixture — purely a UI smoke test.
 */
const FIXTURE_OFFSETS: [number, CaptureAnswers][] = [
  [0, { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false }],
  [1, { bleedingType: 'H', mucusSensation: 'DRY', intercourse: false }],
  [2, { bleedingType: 'M', mucusSensation: 'DRY', intercourse: false }],
  [3, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [4, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [5, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: true }],
  [6, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [7, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [8, { bleedingType: 'NONE', mucusSensation: 'WET', intercourse: false }],
  [9, { bleedingType: 'NONE', mucusSensation: 'WET', mucusStretch: 'TACKY', mucusColor: 'CLOUDY', intercourse: false }],
  [
    10,
    {
      bleedingType: 'NONE',
      mucusSensation: 'WET',
      mucusStretch: 'ELASTIC',
      mucusColor: 'CLEAR',
      intercourse: false,
    },
  ],
  [11, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [12, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: true }],
  [13, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [14, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [15, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [16, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [17, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [18, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
  [19, { bleedingType: 'NONE', mucusSensation: 'DRY', intercourse: false }],
];

export async function seedFakeCycle(db: SqlExecutor, newId: () => string): Promise<void> {
  const start = addDays(today(), -(FIXTURE_OFFSETS.length - 1));
  for (const [offset, answers] of FIXTURE_OFFSETS) {
    await recordEntry(db, answers, addDays(start, offset), newId);
  }
}
