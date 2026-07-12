import type { ExportPeriod } from '../../api/client';

export interface ExportFormState {
  period: ExportPeriod;
  customStart: string;
  customEnd: string;
  password: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Client-side validation only — the server re-validates everything (Seção 5 da SPEC 02, mínimo 6 caracteres, sem exigir complexidade alta). */
export function validateExportForm(form: ExportFormState): string | null {
  if (form.password.length < 6) {
    return 'A senha precisa ter pelo menos 6 caracteres.';
  }
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
