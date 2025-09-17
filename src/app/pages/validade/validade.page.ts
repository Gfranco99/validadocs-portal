// == libs necessárias:  npm i jspdf jspdf-autotable

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

  /** Coloque o PNG do logo em src/assets/validadocs-logo.png (ou ajuste o caminho) */
  private readonly LOGO_URL = 'assets/validadocs-logo.png';

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
  private extractCN(subject?: string): string {
    if (!subject) return '—';
    const re = /(?:^|[,/])\s*CN\s*=\s*([^,\/]+)/gi;
    let cn = '';
    let m: RegExpExecArray | null;
    while ((m = re.exec(subject))) cn = (m[1] || '').trim(); // usa o último CN
    return cn || subject || '—';
  }

  displayCN(s: SignatureInfo): string {
    const base = s.endCertSubjectName || '—';
    return s.isICP ? this.extractCN(base) : base;
  }

  // ===== Helpers PDF =====
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

  /** Carrega imagem do assets e resolve quando estiver pronta */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // ===== Exportar PDF (com selo + LOGO no topo, título centralizado) =====
  async exportPdf() {
    if (!this.result || this.exporting) return;
    this.exporting = true;

    try {
      const r = this.result;
      const sigs = r.validaDocsReturn?.digitalSignatureValidations ?? [];
      const pdfa = r.validaDocsReturn?.pdfValidations;

      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

      // === Paleta com o tom solicitado (#4E6F70)
      const BASE: [number, number, number] = [0x4E, 0x6F, 0x70];
      const lighten = (rgb: [number, number, number], p: number): [number, number, number] => ([
        Math.round(rgb[0] + (255 - rgb[0]) * p),
        Math.round(rgb[1] + (255 - rgb[1]) * p),
        Math.round(rgb[2] + (255 - rgb[2]) * p),
      ]);

      const BRAND = {
        dark:  BASE,                    // faixa principal
        mid:   lighten(BASE, 0.35),     // linha de brilho
        panel: [248, 250, 252] as [number, number, number],
        border: 230
      };

      const M = 15;
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      let y = M;

      const addPageIfNeeded = (min = 18) => { if (y > H - M - min) { doc.addPage(); y = M; } };
      const hr = (space = 6) => { doc.setDrawColor(BRAND.border); doc.line(M, y, W - M, y); y += space; };

      // Carrega o LOGO (se falhar, usa fallback texto)
      let logoEl: HTMLImageElement | null = null;
      try { logoEl = await this.loadImage(this.LOGO_URL); } catch { logoEl = null; }

      // ===== Selo ValidaDocs (topo) com LOGO à esquerda e TÍTULO CENTRALIZADO
      const drawBrandRibbon = (logo: HTMLImageElement | null, fallbackText: string, bigTitle: string) => {
        const bannerW = W - 2 * M;
        const bannerH = 26;
        const radius  = 3;

        doc.setFillColor(...BRAND.dark);
        doc.roundedRect(M, y, bannerW, bannerH, radius, radius, 'F');

        doc.setTextColor(255);

        // Logo (ou texto de fallback) à esquerda
        let leftContentRightX = M + 10;
        if (logo) {
          const logoH = 16;
          const logoW = (logo.width / logo.height) * logoH;
          const logoX = M + 8;
          const logoY = y + (bannerH - logoH) / 2;
          doc.addImage(logo, 'PNG', logoX, logoY, logoW, logoH);
          leftContentRightX = logoX + logoW + 8;
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text(fallbackText, M + 10, y + 16);
          leftContentRightX = M + 10 + doc.getTextWidth(fallbackText) + 8;
        }

        // Título CENTRALIZADO (ajusta para não encostar no logo)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        const centerX = M + bannerW / 2;
        const titleW  = doc.getTextWidth(bigTitle);
        let titleX = centerX;                    // centro do banner
        const leftEdge = titleX - titleW / 2;    // borda esquerda do texto
        if (leftEdge < leftContentRightX + 4) {  // empurra se colidir com o logo
          titleX = leftContentRightX + 4 + titleW / 2;
        }
        doc.text(bigTitle, titleX, y + 17, { align: 'center' });

        // linha inferior de realce
        doc.setDrawColor(...BRAND.mid);
        doc.setLineWidth(0.6);
        doc.line(M + 4, y + bannerH - 2, M + bannerW - 4, y + bannerH - 2);

        doc.setTextColor(0);
        y += bannerH + 8;
      };

      drawBrandRibbon(logoEl, 'ValidaDocs', 'Relatório de conformidade');

      // ===== Header com arquivo/contagem/chip
      const headerBlock = (metric: string, chipText: string, chipOk: boolean, fileName: string, sub: string) => {
        const padX = 6, padY = 5;
        const bannerW = W - 2 * M;
        const bannerH = 30;
        const yTop = y;

        doc.setFillColor(...BRAND.panel);
        doc.roundedRect(M, yTop, bannerW, bannerH, 2, 2, 'F');

        // Linha 1: nome do arquivo (direita)
        const y1 = yTop + padY + 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
        const fileTxt = fileName || '—';
        doc.text(fileTxt, M + bannerW - padX, y1, { align: 'right' });
        doc.setTextColor(0);

        // Linha 2: métrica (esq) + chip (dir)
        const y2 = yTop + bannerH - padY - 5;

        // Chip
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        const chipPadX = 3, chipH = 8;
        const chipW = doc.getTextWidth(chipText) + chipPadX * 2;
        const chipX = M + bannerW - padX - chipW;
        const chipY = y2 - chipH + 2;
        const chipColor = chipOk ? [34, 197, 94] : [245, 158, 11];
        doc.setFillColor(chipColor[0], chipColor[1], chipColor[2]);
        doc.setTextColor(255);
        doc.roundedRect(chipX, chipY, chipW, chipH, 2, 2, 'F');
        doc.text(chipText, chipX + chipPadX, y2);
        doc.setTextColor(0);

        // Métrica
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
        doc.text(metric, M + padX, y2);

        // sublinha
        y = yTop + bannerH + 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(90);
        doc.text(sub, M, y);
        doc.setTextColor(0);
        y += 6;
        hr();
      };

      const chipText = this.allValid() ? 'Todas válidas' : 'Com verificações';
      headerBlock(
        `${this.signatureCount()} assinaturas encontradas`,
        chipText,
        this.allValid(),
        r.fileName || '—',
        `Validado em ${this.brDate(r.validationTime)}`
      );

      // ==== utilitários de conteúdo
      const kvGridTwoCols = (pairs: Array<[string, string | number]>) => {
        const colW = (W - 2 * M) / 2;
        const lineH = 5, labelGap = 4, rowGap = 4;

        let i = 0;
        while (i < pairs.length) {
          const measure = (kv?: [string, string | number]) => {
            if (!kv) return { lines: [] as string[], height: 0, label: '' };
            const [k, v] = kv;
            const lines = doc.splitTextToSize(String(v ?? '—'), colW);
            const height = labelGap + Math.max(1, lines.length) * lineH;
            return { lines, height, label: k };
          };

          const L = measure(pairs[i]);
          const R = measure(pairs[i + 1]);
          const rowH = Math.max(L.height, R.height);
          addPageIfNeeded(rowH + rowGap);

          // esquerda
          let x = M;
          doc.setFont('helvetica','bold'); doc.setFontSize(10);
          if (L.label) doc.text(L.label, x, y);
          doc.setFont('helvetica','normal'); doc.setFontSize(11);
          if (L.lines.length) doc.text(L.lines, x, y + labelGap);

          // direita
          x = M + colW;
          doc.setFont('helvetica','bold'); doc.setFontSize(10);
          if (R.label) doc.text(R.label, x, y);
          doc.setFont('helvetica','normal'); doc.setFontSize(11);
          if (R.lines.length) doc.text(R.lines, x, y + labelGap);

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
        const width = W - 2 * M;
        doc.setFont('helvetica','normal'); doc.setFontSize(11);
        const lines = doc.splitTextToSize(text, width);
        addPageIfNeeded(lines.length * 5 + 2);
        doc.text(lines, M, y);
        y += lines.length * 5 + 2;
      };

      // ===== Dados do documento (SEM Tempo ms / SEM hash)
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

      // ===== Assinaturas (resumo) — usa CN em ICP-Brasil
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

      // ===== Tabela dinâmica (Titular = CN se ICP)
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
        styles: { fontSize: 9, cellPadding: 2, lineColor: BRAND.border, lineWidth: 0.2 },
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