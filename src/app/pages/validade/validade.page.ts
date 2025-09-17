// == libs necessaria ('npm i jspdf jspdf-autotable') ==/


import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ValidationService } from '../../services/validation.service';
import { ValidationResult, SignatureInfo } from '../../types/validation.types';
import {
  IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonInput, IonItem, IonLabel,
  IonList, IonNote, IonProgressBar, IonRow, IonTitle, IonToolbar
} from '@ionic/angular/standalone';

import { SeloValidacaoMiniComponent } from '../../components/selo-validacao-mini.component';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-validate',
  templateUrl: './validade.page.html',
  styleUrls: ['./validade.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonItem, IonInput, IonNote, IonProgressBar,
    IonGrid, IonRow, IonCol, IonList, IonLabel, IonBadge, IonIcon, IonButtons,
    SeloValidacaoMiniComponent
  ]
})
export class ValidadePage {
  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;

  form: FormGroup;
  file?: File | null;
  loading = false;
  exporting = false;
  error?: string;
  result?: ValidationResult;

  constructor(private fb: FormBuilder, private api: ValidationService) {
    this.form = this.fb.group({ file: [null] });
  }

  // ===== Upload =====
  onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input?.files?.[0] ?? null;
    if (!f) return;

    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      this.file = f;
      this.error = undefined;
      this.result = undefined;
      if (!this.loading) this.submit();
    } else {
      this.file = null;
      this.result = undefined;
      this.error = 'Selecione um arquivo PDF válido.';
    }

    setTimeout(() => {
      if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
    }, 0);
  }

  onDragOver(ev: DragEvent) { ev.preventDefault(); }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0] ?? null;
    if (!f) return;

    if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
      this.file = f;
      this.error = undefined;
      this.result = undefined;
      if (!this.loading) this.submit();
    } else {
      this.file = null;
      this.result = undefined;
      this.error = 'Selecione um arquivo PDF (.pdf).';
    }
  }

  // ===== Chamada de validação =====
  submit() {
    if (this.loading || !this.file) {
      if (!this.file) this.error = 'Selecione um PDF para validar.';
      return;
    }

    this.loading = true;
    this.error = undefined;
    this.result = undefined;

    this.api.validatePdf(this.file!).subscribe({
      next: (res: ValidationResult) => {
        this.result = res;
        this.loading = false;
      },
      error: (err) => {
        this.error = 'Falha ao validar. Tente novamente.';
        this.loading = false;
        console.error(err);
      }
    });
  }

  reset() {
    this.form.reset();
    this.file = null;
    this.result = undefined;
    this.error = undefined;
    if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
  }

  // ===== Helpers de UI =====
  fileSize(f: File | null | undefined): string {
    if (!f) return '';
    const kb = f.size / 1024;
    return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(2)} MB`;
  }

  signatureCount(): number {
    return this.result?.validaDocsReturn?.digitalSignatureValidations?.length ?? 0;
  }

  sigColor(sig: SignatureInfo): 'success' | 'danger' | 'warning' | 'medium' {
    if (sig.signatureValid) return 'success';
    if (!sig.signatureValid && !sig.signatureErrors && !!sig.signatureAlerts) return 'warning';
    return 'danger';
  }

  trackByName = (_: number, s: SignatureInfo) =>
    (s.endCertSubjectName ?? '') + '|' + (s.cpf ?? '');

  allValid(): boolean {
    const sigs = this.result?.validaDocsReturn?.digitalSignatureValidations ?? [];
    return sigs.length > 0 && sigs.every(s => s.signatureValid);
  }

  // ===== Helpers para nomes (mostrar só CN em ICP-Brasil) =====
  /** Extrai o último CN=... do DN. Ex.: "CN=JOÃO SILVA:123" -> "JOÃO SILVA:123" */
  private extractCN(subject?: string): string {
    if (!subject) return '—';
    const re = /(?:^|[,/])\s*CN\s*=\s*([^,\/]+)/gi;
    let cn = '';
    let m: RegExpExecArray | null;
    while ((m = re.exec(subject))) cn = (m[1] || '').trim(); // último CN
    return cn || subject || '—';
  }

  /** Nome para exibição: se isICP, retorna apenas o CN; senão, retorna o nome original */
  displayCN(s: SignatureInfo): string {
    const base = s.endCertSubjectName || '—';
    return s.isICP ? this.extractCN(base) : base;
  }

  // ===== Helpers para o PDF =====
  private brBool(v?: boolean): string { return v === undefined ? '—' : (v ? 'Sim' : 'Não'); }

  private brDate(s?: string): string {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString('pt-BR');
  }

  private authorityOf(s: SignatureInfo): string {
    return s.qualified || (s.isICP ? 'ICP-Brasil' : (s.iseGov ? 'Gov.br' : '—'));
  }

  private baseName(name?: string): string {
    const n = (name || 'relatorio').replace(/\.[^/.]+$/, '');
    return n.replace(/[^\p{L}\p{N}\-_ ]+/gu, '_').slice(0, 80);
  }

  // corta texto para caber (com reticências)
  private fitText(doc: jsPDF, text: string, maxW: number, font = 'helvetica', style: 'normal' | 'bold' = 'normal', size = 10): string {
    doc.setFont(font, style);
    doc.setFontSize(size);
    if (doc.getTextWidth(text) <= maxW) return text;
    let t = text;
    while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
    return t + '…';
  }

  // ===== Exportar PDF =====
  async exportPdf() {
    if (!this.result || this.exporting) return;
    this.exporting = true;

    try {
      const r = this.result;
      const sigs = r.validaDocsReturn?.digitalSignatureValidations ?? [];
      const pdfa = r.validaDocsReturn?.pdfValidations;

      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

      // Paleta/estilo
      const C = {
        primary: [37, 99, 235] as [number, number, number],
        ok: [34, 197, 94] as [number, number, number],
        warn: [245, 158, 11] as [number, number, number],
        panel: [248, 250, 252] as [number, number, number],
        border: 230,
      };

      const M = 15;
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      let y = M;

      const addPageIfNeeded = (min = 18) => { if (y > H - M - min) { doc.addPage(); y = M; } };
      const hr = (space = 6) => { doc.setDrawColor(C.border); doc.line(M, y, W - M, y); y += space; };

      // ===== Cabeçalho (chip na 2ª linha à direita; arquivo isolado na 1ª)
      const headerBlock = (
        fileName: string,
        metric: string,
        chipText: string,
        chipColor: [number, number, number],
        sub: string
      ) => {
        const padX = 6, padY = 5;
        const bannerW = W - 2 * M;
        const bannerH = 34;
        const yTop = y;

        // fundo
        doc.setFillColor(...C.panel);
        doc.roundedRect(M, yTop, bannerW, bannerH, 2, 2, 'F');

        // Linha 1: título + arquivo (direita)
        const y1 = yTop + padY + 6;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(0);
        doc.text('Relatório de conformidade', M + padX, y1);

        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
        const fileMaxW = bannerW - padX * 2 - 4;
        const fileTxt = this.fitText(doc, fileName || '—', fileMaxW, 'helvetica', 'normal', 10);
        doc.text(fileTxt, M + bannerW - padX, y1, { align: 'right' });
        doc.setTextColor(0);

        // Linha 2: métrica (esq) + chip (dir)
        const y2 = yTop + bannerH - padY - 5;

        // chip (direita)
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        const chipPadX = 3, chipH = 8;
        const chipW = doc.getTextWidth(chipText) + chipPadX * 2;
        const chipX = M + bannerW - padX - chipW;
        const chipY = y2 - chipH + 2;
        doc.setFillColor(...chipColor); doc.setTextColor(255);
        doc.roundedRect(chipX, chipY, chipW, chipH, 2, 2, 'F');
        doc.text(chipText, chipX + chipPadX, y2);
        doc.setTextColor(0);

        // métrica
        const metricMaxW = (chipX - 8) - (M + padX);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
        const metricTxt = this.fitText(doc, metric, metricMaxW, 'helvetica', 'bold', 18);
        doc.text(metricTxt, M + padX, y2);

        // avança
        y = yTop + bannerH + 6;

        // sublinha
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(90);
        doc.text(sub, M, y);
        doc.setTextColor(0);
        y += 6;
        hr();
      };

      const chipText = this.allValid() ? 'Todas válidas' : 'Com verificações';
      headerBlock(
        r.fileName || '—',
        `${this.signatureCount()} assinaturas encontradas`,
        chipText,
        this.allValid() ? C.ok : C.warn,
        `Validado em ${this.brDate(r.validationTime)}`
      );

      // ==== utilitários de conteúdo
      const kvGridTwoCols = (pairs: Array<[string, string | number]>) => {
        const colW = (W - 2*M) / 2;
        const lineH = 5, labelGap = 4, rowGap = 4;

        let i = 0;
        while (i < pairs.length) {
          const measureCell = (kv?: [string, string | number]) => {
            if (!kv) return { lines: [] as string[], height: 0, label: '' };
            const [k, v] = kv;
            const lines = doc.splitTextToSize(String(v ?? '—'), colW);
            const height = labelGap + Math.max(1, lines.length) * lineH;
            return { lines, height, label: k };
          };

          const left = measureCell(pairs[i]);
          const right = measureCell(pairs[i + 1]);
          const rowH = Math.max(left.height, right.height);
          addPageIfNeeded(rowH + rowGap);

          // esquerda
          let x = M;
          doc.setFont('helvetica','bold'); doc.setFontSize(10);
          if (left.label) doc.text(left.label, x, y);
          doc.setFont('helvetica','normal'); doc.setFontSize(11);
          if (left.lines.length) doc.text(left.lines, x, y + labelGap);

          // direita
          x = M + colW;
          doc.setFont('helvetica','bold'); doc.setFontSize(10);
          if (right.label) doc.text(right.label, x, y);
          doc.setFont('helvetica','normal'); doc.setFontSize(11);
          if (right.lines.length) doc.text(right.lines, x, y + labelGap);

          y += rowH + rowGap;
          i += 2;
        }
      };

      const section = (title: string) => {
        addPageIfNeeded(14);
        doc.setFont('helvetica','bold'); doc.setFontSize(12);
        doc.setTextColor(0);
        doc.text(title, M, y);
        y += 7;
      };

      const para = (text: string) => {
        const width = W - 2*M;
        doc.setFont('helvetica','normal'); doc.setFontSize(11);
        const lines = doc.splitTextToSize(text, width);
        addPageIfNeeded(lines.length * 5 + 2);
        doc.text(lines, M, y);
        y += lines.length * 5 + 2;
      };

      // ===== Dados do documento (SEM tempo ms e SEM SHA-256)
      section('Dados do documento');
      kvGridTwoCols([
        ['Status', r.status || '—'],
        ['Tipo do arquivo', 'PDF'],
        ['Política', r.policy ?? r.signatureType ?? '—'],
        ['Versão do software', r.softwareVersion || '—'],
      ]);
      hr();

      // ===== PDF/A
      section('Conformidade PDF/A');
      kvGridTwoCols([
        ['PDF/A válido', this.brBool(pdfa?.isValid)],
        ['Padrão', pdfa?.pdfAStandard || '—'],
        ['Conformidade', pdfa?.isPDFACompliant === undefined ? '—' : (pdfa.isPDFACompliant ? 'Conforme' : 'Não conforme')],
        ['Status', pdfa?.status || '—'],
      ]);
      if (pdfa?.alertMessage) para(`Alerta: ${pdfa.alertMessage}`);
      if (pdfa?.errorMessage) para(`Erro: ${pdfa.errorMessage}`);
      hr();

      // ===== Apontamentos
      section('Apontamentos da validação');
      if (r.errorfindings?.length) {
        r.errorfindings.forEach(f => para('• ' + f));
      } else {
        doc.setTextColor(34, 197, 94);
        doc.setFont('helvetica','bold'); doc.setFontSize(11);
        doc.text('Nenhum apontamento de falha.', M, y);
        doc.setTextColor(0);
        y += 7;
      }
      hr();

      // ===== Assinaturas (resumo) — usa apenas CN para ICP-Brasil
      section('Assinaturas (resumo)');
      if (sigs[0]) {
        const s0 = sigs[0];
        doc.setFont('helvetica','bold'); doc.setFontSize(12);
        doc.text(this.displayCN(s0) ?? '—', M, y); y += 6;
        doc.setFont('helvetica','normal'); doc.setTextColor(90); doc.setFontSize(11);
        const subt = `${s0.signatureType ?? ''} ${s0.signatureLevel ?? ''}`.trim();
        if (subt) { doc.text(subt, M, y); y += 6; }
        if (s0.signatureTime) { doc.text(this.brDate(s0.signatureTime), M, y); y += 6; }
        doc.setTextColor(0);
        y += 2;
      }

      // ===== Tabela com colunas dinâmicas (Titular = CN em ICP-Brasil)
      const showCPF   = sigs.some(s => !!s.cpf);
      const showLevel = sigs.some(s => !!s.signatureLevel);
      const showTime  = sigs.some(s => !!s.signatureTime);

      const cols = [
        { key: 'name',  title: 'Titular',    width: 56, align: 'left' as const },
        ...(showCPF   ? [{ key: 'cpf',   title: 'CPF',       width: 24, align: 'left' as const }] : []),
        { key: 'type',  title: 'Padrão',     width: 22, align: 'left' as const },
        ...(showLevel ? [{ key: 'level', title: 'Nível',     width: 22, align: 'left' as const }] : []),
        { key: 'auth',  title: 'Autoridade', width: 30, align: 'left' as const },
        { key: 'valid', title: 'Válida',     width: 16, align: 'center' as const },
        ...(showTime  ? [{ key: 'time',  title: 'Data/Hora', width: 26, align: 'left' as const }] : []),
      ];

      const columnStyles = cols.reduce<Record<number, any>>((acc, c, idx) => {
        acc[idx] = { cellWidth: c.width, halign: c.align };
        return acc;
      }, {});

      autoTable(doc, {
        startY: y,
        head: [cols.map(c => c.title)],
        body: sigs.map(s => cols.map(c => {
          switch (c.key) {
            case 'name':  return this.displayCN(s);
            case 'cpf':   return s.cpf || '—';
            case 'type':  return s.signatureType ?? '—';
            case 'level': return s.signatureLevel ?? '—';
            case 'auth':  return this.authorityOf(s);
            case 'valid': return s.signatureValid ? 'Sim' : 'Não';
            case 'time':  return this.brDate(s.signatureTime);
            default:      return '—';
          }
        })),
        styles: { fontSize: 9, cellPadding: 2, lineColor: 230, lineWidth: 0.2 },
        headStyles: { fillColor: [241, 245, 249], textColor: 30, halign: 'left' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: M, right: M },
        columnStyles
      });

      // Rodapé
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFont('helvetica','normal'); doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(`Gerado por ValidaDocs • ${new Date().toLocaleString('pt-BR')}`, M, H - 6);
        doc.text(`${i} / ${pageCount}`, W - M, H - 6, { align: 'right' });
        doc.setTextColor(0);
      }

      const base = this.baseName(r.fileName);
      doc.save(`ValidaDocs_${base}.pdf`);
    } finally {
      this.exporting = false;
    }
  }
}