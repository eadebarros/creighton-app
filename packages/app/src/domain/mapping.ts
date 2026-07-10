import type {
  BleedingType,
  DailyEntryInput,
  MucusColor,
  MucusSensation,
  MucusStretch,
} from '@creighton/rules-engine';

/** Shape of a daily_entries row as SQLite stores it (booleans as 0/1, optionals as null). */
export interface DailyEntryRow {
  id: string;
  cycle_id: string;
  date: string;
  bleeding_type: BleedingType;
  mucus_sensation: MucusSensation;
  mucus_stretch: MucusStretch;
  mucus_color: MucusColor | null;
  shiny_reflex: number | null;
  raw_code: string;
  intercourse: number;
  entered_at: string;
}

/** Answers collected by the capture flow, complete by the time Confirmation saves them. */
export interface CaptureAnswers {
  bleedingType: BleedingType;
  mucusSensation: MucusSensation;
  shinyReflex?: boolean;
  mucusColor?: MucusColor;
  mucusStretch?: MucusStretch;
  intercourse: boolean;
}

/** DB row -> the rules-engine's input shape (never re-derive raw_code from a row; it's cached separately). */
export function rowToEntryInput(row: DailyEntryRow): DailyEntryInput {
  return {
    date: row.date,
    bleedingType: row.bleeding_type,
    mucusSensation: row.mucus_sensation,
    mucusStretch: row.mucus_stretch,
    mucusColor: row.mucus_color ?? undefined,
    shinyReflex: row.shiny_reflex === null ? undefined : row.shiny_reflex === 1,
    intercourse: row.intercourse === 1,
  };
}

/** Capture-flow answers -> the rules-engine's input shape (used for deriveRawCode at save time). */
export function answersToEntryInput(answers: CaptureAnswers, date: string): DailyEntryInput {
  return {
    date,
    bleedingType: answers.bleedingType,
    mucusSensation: answers.mucusSensation,
    mucusStretch: answers.mucusStretch ?? 'NONE',
    mucusColor: answers.mucusColor,
    shinyReflex: answers.shinyReflex,
    intercourse: answers.intercourse,
  };
}

/** DailyEntryInput (+ the fields a row needs beyond it) -> SQLite-bindable column values. */
export function entryInputToRowValues(
  entry: DailyEntryInput,
  rawCode: string,
): {
  bleeding_type: BleedingType;
  mucus_sensation: MucusSensation;
  mucus_stretch: MucusStretch;
  mucus_color: MucusColor | null;
  shiny_reflex: number | null;
  raw_code: string;
  intercourse: number;
} {
  return {
    bleeding_type: entry.bleedingType,
    mucus_sensation: entry.mucusSensation,
    mucus_stretch: entry.mucusStretch,
    mucus_color: entry.mucusColor ?? null,
    shiny_reflex: entry.shinyReflex === undefined ? null : entry.shinyReflex ? 1 : 0,
    raw_code: rawCode,
    intercourse: entry.intercourse ? 1 : 0,
  };
}
