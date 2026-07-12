import PDFDocument from 'pdfkit';
import { stateToToken } from '@creighton/rules-engine';
import type {
  BleedingType,
  FertilityColorToken,
  FertilityState,
  PeakRelation,
  VariantMode,
} from '@creighton/rules-engine';

export interface ExportDay {
  date: string;
  dayNumber: number;
  rawCode: string;
  bleedingType: BleedingType;
  computedState: FertilityState;
  peakRelation: PeakRelation;
  pibActive: boolean;
  intercourse: boolean;
  observationCount: number;
}

export interface ExportCycle {
  cycleNumber: number;
  startDate: string;
  endDate: string | null;
  isActive: boolean;
  variantMode: VariantMode;
  confirmedPeakDay: string | null;
  /** Adendo 02 — authoritative resolution, replaces the old isActive/confirmedPeakDay proxy. */
  peakResolution: 'PENDING' | 'CONFIRMED' | 'UNCONFIRMED_CLOSED';
  days: ExportDay[];
}

export interface RuleEngineVersionPeriod {
  version: string;
  from: string;
  to: string | null;
}

export interface ExportSummary {
  userEmail: string;
  generatedAt: string;
  periodLabel: string;
  ruleEngineVersions: RuleEngineVersionPeriod[];
  voidedObservationCount: number;
}

export interface ExportData {
  cycles: ExportCycle[];
  summary: ExportSummary;
}

const TOKEN_HEX: Record<FertilityColorToken, string> = {
  RED: '#E02424',
  GREEN: '#16A34A',
  WHITE: '#FFFFFF',
  YELLOW: '#EAB308',
};

const VARIANT_LABEL: Record<VariantMode, string> = {
  REGULAR: 'Regular',
  LACTATION: 'Lactação',
  MENOPAUSE: 'Pré-menopausa',
  BIP: 'BIP',
};

const INK = '#2B2A28';
const INK_MUTED = '#6B6862';
const LINE = '#D8D3C7';

function peakLabelFor(peakRelation: PeakRelation): string | null {
  switch (peakRelation) {
    case 'P':
      return 'P';
    case 'P1':
      return 'P+1';
    case 'P2':
      return 'P+2';
    case 'P3':
      return 'P+3';
    default:
      return null;
  }
}

const PAGE_MARGIN = 40;
const COLUMN_WIDTH = 34;
const SQUARE_SIZE = 26;
const ROW_HEIGHT = 70;

function renderCyclePage(doc: PDFKit.PDFDocument, cycle: ExportCycle): void {
  doc.addPage({ layout: 'landscape', size: 'A4', margin: PAGE_MARGIN });

  doc
    .font('Helvetica-Bold')
    .fontSize(14)
    .fillColor(INK)
    .text(`Ciclo ${cycle.cycleNumber}`, PAGE_MARGIN, PAGE_MARGIN);

  const period = cycle.endDate ? `${cycle.startDate} — ${cycle.endDate}` : `${cycle.startDate} — em andamento`;
  doc
    .font('Helvetica')
    .fontSize(10)
    .fillColor(INK_MUTED)
    .text(`${period}  ·  Variante: ${VARIANT_LABEL[cycle.variantMode]}`, PAGE_MARGIN, PAGE_MARGIN + 20);

  if (cycle.peakResolution === 'UNCONFIRMED_CLOSED') {
    doc.fillColor(INK).font('Helvetica-Bold').text('Ápice não confirmado neste ciclo', PAGE_MARGIN, PAGE_MARGIN + 36);
  }

  const usableWidth = doc.page.width - PAGE_MARGIN * 2;
  const columnsPerRow = Math.max(1, Math.floor(usableWidth / COLUMN_WIDTH));

  const gridTop = PAGE_MARGIN + 60;

  cycle.days.forEach((day, i) => {
    const rowIndex = Math.floor(i / columnsPerRow);
    const colIndex = i % columnsPerRow;
    const x = PAGE_MARGIN + colIndex * COLUMN_WIDTH;
    const y = gridTop + rowIndex * ROW_HEIGHT;

    const peakLabel = peakLabelFor(day.peakRelation);
    if (peakLabel) {
      doc.font('Helvetica-Bold').fontSize(7).fillColor(INK_MUTED).text(peakLabel, x, y, { width: SQUARE_SIZE, align: 'center' });
    }

    const token = stateToToken({ bleedingType: day.bleedingType, computedState: day.computedState, pibActive: day.pibActive });
    const squareY = y + 10;
    doc
      .rect(x, squareY, SQUARE_SIZE, SQUARE_SIZE)
      .fillAndStroke(TOKEN_HEX[token], LINE);

    if (day.intercourse) {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(token === 'WHITE' ? INK : '#FFFFFF').text('I', x, squareY + 8, {
        width: SQUARE_SIZE,
        align: 'center',
      });
    }

    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor(INK_MUTED)
      .text(day.rawCode || '—', x, squareY + SQUARE_SIZE + 2, { width: SQUARE_SIZE, align: 'center' });

    doc
      .font('Helvetica')
      .fontSize(6)
      .fillColor(INK_MUTED)
      .text(String(day.dayNumber) + (day.observationCount > 1 ? '*' : ''), x, squareY + SQUARE_SIZE + 12, {
        width: SQUARE_SIZE,
        align: 'center',
      });
  });

  const hasMultiObservationDay = cycle.days.some((d) => d.observationCount > 1);
  if (hasMultiObservationDay) {
    const rows = Math.ceil(cycle.days.length / columnsPerRow);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(INK_MUTED)
      .text('* 2+ observações neste dia — selo mostra o pico consolidado.', PAGE_MARGIN, gridTop + rows * ROW_HEIGHT + 10);
  }
}

function renderSummaryPage(doc: PDFKit.PDFDocument, summary: ExportSummary): void {
  doc.addPage({ layout: 'landscape', size: 'A4', margin: PAGE_MARGIN });

  doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text('Resumo técnico', PAGE_MARGIN, PAGE_MARGIN);

  let y = PAGE_MARGIN + 30;
  const line = (label: string, value: string) => {
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(label, PAGE_MARGIN, y, { continued: true });
    doc.font('Helvetica').fillColor(INK_MUTED).text(`  ${value}`);
    y += 20;
  };

  line('Conta:', summary.userEmail);
  line('Período exportado:', summary.periodLabel);
  line('Data de geração:', summary.generatedAt);

  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('Versão do motor de regras vigente no período:', PAGE_MARGIN, y);
  y += 18;
  for (const v of summary.ruleEngineVersions) {
    const range = v.to ? `${v.from} — ${v.to}` : `${v.from} — atual`;
    doc.font('Helvetica').fontSize(9).fillColor(INK_MUTED).text(`${v.version}  (${range})`, PAGE_MARGIN + 12, y);
    y += 16;
  }

  y += 10;
  line('Observações anuladas no período:', String(summary.voidedObservationCount));

  y += 20;
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(INK_MUTED)
    .text(
      'Este documento é uma ferramenta de acompanhamento e não substitui orientação médica ou de instrutora certificada do Método Creighton. As interpretações aqui apresentadas são calculadas automaticamente e devem ser revisadas por um profissional qualificado.',
      PAGE_MARGIN,
      y,
      { width: doc.page.width - PAGE_MARGIN * 2 },
    );
}

/**
 * SPEC 02 — renders the classic Creighton chart (one landscape page per
 * cycle) + a technical summary page, entirely in memory (never touches
 * disk, so "no residual file" holds by construction). No password
 * protection (Edu, 12/07 — reverses SPEC 02 Seção 4 item 1: password
 * requirement removed).
 */
export async function renderCreightonPdf(data: ExportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const cycle of data.cycles) {
      renderCyclePage(doc, cycle);
    }
    renderSummaryPage(doc, data.summary);
    doc.end();
  });
}
