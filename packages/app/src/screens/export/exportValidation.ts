import type { ExportPeriod } from '../../api/client';

export interface ExportFormState {
  period: ExportPeriod;
  customStart: string;
  customEnd: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Client-side validation only — the server re-validates everything. */
export function validateExportForm(form: ExportFormState): string | null {
  if (form.period === 'custom') {
    if (!ISO_DATE.test(form.customStart) || !ISO_DATE.test(form.customEnd)) {
      return 'Informe as datas no formato AAAA-MM-DD.';
    }
    if (form.customStart > form.customEnd) {
      return 'A data inicial precisa ser antes da data final.';
    }
  }
  return null;
}
