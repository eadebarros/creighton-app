import { randomUUID } from 'node:crypto';
import type { EntryPayload } from '../src/validation/entries.js';

export function buildEntry(cycleId: string, date: string, overrides: Partial<EntryPayload> = {}): EntryPayload {
  return {
    id: randomUUID(),
    cycle: {
      id: cycleId,
      startDate: date,
      endDate: null,
      isActive: true,
      variantModeSnapshot: 'REGULAR',
    },
    date,
    bleedingType: 'NONE',
    mucusSensation: 'DRY',
    mucusStretch: 'NONE',
    mucusColor: null,
    shinyReflex: null,
    intercourse: false,
    enteredAt: new Date(`${date}T20:00:00.000Z`).toISOString(),
    entrySource: 'USER',
    ...overrides,
  };
}
