import { Component, ElementRef, ViewChild, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ValidationService } from '../../services/validation.service';
import { ValidationResult, SignatureInfo } from '../../types/validation.types';
import {
  IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonInput, IonItem, IonLabel,
  IonList, IonNote, IonProgressBar, IonRow, IonTitle, IonToolbar, IonPopover, IonChip
} from '@ionic/angular/standalone';

import { SeloValidacaoMiniComponent } from '../../components/selo-validacao-mini.component';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { finalize } from 'rxjs/operators';
import { LoadingController } from '@ionic/angular'; 

@Component({
  selector: 'app-validate',
  templateUrl: './validate.page.html',
  styleUrls: ['./validate.page.scss'],
  standalone: true,
  imports: [IonChip, IonPopover,
    CommonModule, ReactiveFormsModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonItem, IonInput, IonNote, IonProgressBar,
    IonGrid, IonRow, IonCol, IonList, IonLabel, IonBadge, IonIcon, IonButtons,
    SeloValidacaoMiniComponent
  ]
})
export class ValidatePage implements OnDestroy {
  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;

  form: FormGroup;
  file?: File | null;
  loading = false;
  exporting = false;
  error?: string;
  result?: ValidationResult;

  private readonly LOGO_URL = 'assets/validadocs-logo.png';

  constructor(
    private fb: FormBuilder,
    private api: ValidationService,
    private router: Router,
    private loadingCtrl: LoadingController
  ) {
    this.form = this.fb.group({ file: [null] });
  }

  // ================= Navegação / limpeza =================
  goHome() {
    this.reset();
    this.router.navigateByUrl('/');
  }

  ngOnDestroy() {
    this.reset();
  }

  @HostListener('window:beforeunload')
  handleUnload() {
    this.reset();
  }

  // ================= Upload =================
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

    setTimeout(() => this.fileInput?.nativeElement && (this.fileInput.nativeElement.value = ''), 0);
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

  // ================= Validação =================
  async submit() {
  if (this.loading || !this.file) {
    if (!this.file) this.error = 'Selecione um PDF para validar.';
    return;
  }

  this.loading = true;
  this.error = undefined;
  this.result = undefined;

  // +++ cria e apresenta o overlay
  const loading = await this.loadingCtrl.create({
    message: 'Processando...',
    spinner: 'crescent'
  });
  await loading.present();

  this.api.validatePdf(this.file!).pipe(
    // +++ garante que o overlay sempre fecha
    finalize(async () => {
      this.loading = false;
      try { await loading.dismiss(); } catch {}
    })
  ).subscribe({
    next: (res: ValidationResult) => {
      const sigs = res.validaDocsReturn?.digitalSignatureValidations ?? [];

      const extrairCpf = (subject: string): string =>
        subject?.match(/:(\d{11})$/)?.[1] ?? '';

      const extrairSigner = (subject: string): string => {
        const cnPart = subject?.split(',')?.find(p => p.trim().startsWith('CN='));
        const nameWithCPF = cnPart?.split('=')[1];
        return (nameWithCPF?.split(':')[0] ?? '').trim();
      };

      const assinaturas: SignatureInfo[] = sigs.map(a => ({
        ...a,
        cpf: extrairCpf(a.endCertSubjectName),
        signerName: extrairSigner(a.endCertSubjectName),
      }));

      res.errorfindings = new Array<string>();
      res.errorfindings.push(...(res.errorMessage ? [res.errorMessage] : []));

      this.result = {
        ...res,
        validaDocsReturn: {
          ...res.validaDocsReturn,
          digitalSignatureValidations: assinaturas,
          pdfValidations: res.validaDocsReturn?.pdfValidations ?? undefined
        }
      };
    },
    error: (err) => {
      this.error = 'Falha ao validar. Tente novamente.';
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

  // ================= Helpers de UI =================
  get hasResult(): boolean { return !!this.result; }

  signatureCount(): number {
    return this.result?.validaDocsReturn?.digitalSignatureValidations?.length ?? 0;
  }

  /** "1 Assinatura encontrada" | "N Assinaturas encontradas" */
  sigMetric(): string {
    const n = this.signatureCount();
    return n === 1 ? '1 Assinatura encontrada' : `${n} Assinaturas encontradas`;
  }

  sigColor(sig: SignatureInfo): 'success' | 'danger' | 'warning' | 'medium' {
    if (sig.signatureValid) return 'success';
    if (!sig.signatureValid && !sig.signatureErrors && !!(sig as any).signatureAlerts) return 'warning';
    return 'danger';
  }

  validColor(status:boolean): 'success' | 'danger' { return status ? 'success' : 'danger'; }

  trackByName = (_: number, s: SignatureInfo) =>
    (s.endCertSubjectName ?? '') + '|' + (s.cpf ?? '');

  allValid(): boolean {
    const sigs = this.result?.validaDocsReturn?.digitalSignatureValidations ?? [];
    return sigs.length > 0 && sigs.every(s => s.signatureValid);
  }

  // -------- Normalização de acentos (corrige mojibake) --------
  normalizeAccents(v?: string): string {
    if (!v) return '—';
    const suspicious = /[ÃÂâÊ¢€™]/.test(v);
    if (!suspicious) return v;
    try {
      const bytes = Uint8Array.from(Array.from(v).map(ch => ch.charCodeAt(0) & 0xff));
      const fixed = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      return fixed;
    } catch {
      try { return decodeURIComponent(escape(v)); } catch { return v; }
    }
  }

  // ================= Tooltips (dinâmicos só p/ Status e Certificado) =================
  getStatusTooltip(): string {
    const r = this.result;
    if (!r || r.isValid !== false) return '';
    const onlyOne = this.signatureCount() === 1;
    const sigs = r.validaDocsReturn?.digitalSignatureValidations ?? [];
    const reasons: string[] = [];

    for (const s of sigs) {
      if (s.signatureValid === false) {
        const errs = (s as any)?.signatureErrors as string[] | string | undefined;
        const alts = (s as any)?.signatureAlerts as string[] | string | undefined;
        if (errs) Array.isArray(errs) ? reasons.push(...errs) : reasons.push(String(errs));
        else if (alts) Array.isArray(alts) ? reasons.push(...alts) : reasons.push(String(alts));
        else {
          if ((s as any)?.docModified)     reasons.push('O documento foi alterado após a assinatura.');
          if ((s as any)?.expired)         reasons.push('O certificado do signatário está expirado.');
          if ((s as any)?.revoked)         reasons.push('O certificado do signatário foi revogado.');
          if ((s as any)?.chainUntrusted)  reasons.push('Cadeia de certificação não é confiável.');
        }
      }
    }

    if (reasons.length) {
      const short = reasons.slice(0, 4).join(' · ');
      return onlyOne
        ? `A assinatura é inválida. Motivos: ${short}`
        : `Há pelo menos uma assinatura inválida. Motivos: ${short}`;
    }
    return onlyOne
      ? 'A assinatura é inválida.'
      : 'Há pelo menos uma assinatura inválida no documento.';
  }

  getPdfAValidTooltip(): string {
    const pv = this.result?.validaDocsReturn?.pdfValidations;
    if (!pv || pv.isValid !== false) return '';
    const base = 'O arquivo não atende integralmente aos requisitos do PDF/A.';
    const detail = pv.errorMessage || pv.alertMessage;
    const commons = 'Causas frequentes: fontes não incorporadas, transparências proibidas para o nível, uso de JavaScript/XFA, criptografia, links externos ou metadados em desacordo.';
    return [base, detail, commons].filter(Boolean).join(' ');
  }

  getPdfACompliantTooltip(): string {
    const pv = this.result?.validaDocsReturn?.pdfValidations;
    if (!pv || pv.isPDFACompliant !== false) return '';
    const lvl = pv.pdfAStandard ? ` (${pv.pdfAStandard})` : '';
    const base = `O arquivo não está conforme o nível PDF/A declarado${lvl}.`;
    const detail = pv.errorMessage || pv.alertMessage;
    const commons = 'Geralmente por elementos não permitidos no nível (ex.: transparências/objetos não suportados) ou recursos obrigatórios ausentes (ex.: incorporação de fontes/ICC).';
    return [base, detail, commons].filter(Boolean).join(' ');
  }

  getBornDigitalTooltip(): string {
    const pv = this.result?.validaDocsReturn?.pdfValidations;
    if (!pv || pv.bornDigital !== false) return '';
    const base = 'Indícios de que é uma digitalização (páginas como imagem, pouca ou nenhuma camada de texto).';
    const why  = 'Arquivos nascidos digitais preservam texto/vetores e tendem a ser mais verificáveis e acessíveis.';
    return `${base} ${why}`;
  }

  getPdfALevelTooltip(): string {
    const pv = this.result?.validaDocsReturn?.pdfValidations;
    const lvl = pv?.pdfAStandard;
    if (lvl && lvl !== 'Desconhecido') return '';
    const base = 'Não foi possível identificar o nível PDF/A.';
    const commons = 'Possíveis motivos: ausência/contradição nos metadados XMP, arquivo não é PDF/A ou perfil não declarado corretamente.';
    return `${base} ${commons}`;
  }

  /** Tooltip por certificado: por que a assinatura está inválida */
  getSignatureTooltip(s: SignatureInfo): string {
    if (!s || s.signatureValid !== false) return '';

    const msgs: string[] = [];
    const errs = (s as any)?.signatureErrors as string[] | string | undefined;
    const alts = (s as any)?.signatureAlerts as string[] | string | undefined;

    if (errs) Array.isArray(errs) ? msgs.push(...errs) : msgs.push(String(errs));
    if (alts && !errs) Array.isArray(alts) ? msgs.push(...alts) : msgs.push(String(alts));

    if ((s as any)?.docModified)      msgs.push('O documento foi alterado após a assinatura.');
    if ((s as any)?.expired)          msgs.push('O certificado do signatário está expirado.');
    if ((s as any)?.revoked)          msgs.push('O certificado do signatário foi revogado.');
    if ((s as any)?.chainUntrusted)   msgs.push('Cadeia de certificação não é confiável.');
    if ((s as any)?.timestampInvalid) msgs.push('Carimbo do tempo inválido.');
    if ((s as any)?.ocspInvalid)      msgs.push('Falha em OCSP/CRL.');

    return msgs.length ? msgs.join(' · ') : 'Falha na verificação criptográfica da assinatura.';
  }

  // ================= Nomes / formatações =================
  private extractCN(subject?: string): string {
    if (!subject) return '—';
    const re = /(?:^|[,/])\s*CN\s*=\s*([^,\/]+)/gi;
    let cn = '';
    let m: RegExpExecArray | null;
    while ((m = re.exec(subject))) cn = (m[1] || '').trim();
    return cn || subject || '—';
  }

  private stripCpfSuffix(v: string): string { return v.replace(/:\d{11}\s*$/, ''); }

  displaySubjectFull(s: SignatureInfo): string {
    return this.normalizeAccents(s?.endCertSubjectName || this.displayCN(s));
  }

  displayCN(s: SignatureInfo): string {
    const base = s.endCertSubjectName || '—';
    const name = s.isICP ? this.stripCpfSuffix(s.signerName || this.extractCN(base)) : base;
    return this.normalizeAccents(name);
  }

  // ================= Helpers PDF =================
  private brBool(v?: boolean): string { return v === undefined ? '—' : (v ? 'Sim' : 'Não'); }
  private brDate(s?: string): string {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString('pt-BR');
  }
  private authorityOf(s: SignatureInfo): string {
    return s.qualified || (s.isICP ? 'ICP-Brasil' : (s.iseGov ? 'Gov.br' : '—'));
  }

  /*** ÚNICA ALTERAÇÃO: gera nome “safe ASCII” para o download ***/
  private baseName(name?: string): string {
    // tira a extensão
    const raw = (name || 'relatorio').replace(/\.[^/.]+$/, '').trim();

    // corrige possíveis mojibake (mÃ©dico -> médico)
    const fixed = this.normalizeAccents(raw);

    // remove diacríticos e qualquer caractere não-ASCII
    const noMarks = fixed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const asciiOnly = noMarks.replace(/[^\x20-\x7E]/g, '_');

    // mantém apenas caracteres seguros
    const safe = asciiOnly
      .replace(/[^A-Za-z0-9\-_. ]+/g, '_') // limpa símbolos
      .replace(/\s+/g, ' ')               // colapsa espaços
      .replace(/_{2,}/g, '_')             // colapsa underscores
      .trim();

    return (safe || 'relatorio').slice(0, 80);
  }

  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  // ================= Exportar PDF =================
  async exportPdf() {
    if (!this.result || this.exporting) return;
    this.exporting = true;

    try {
      const r = this.result;
      const sigs = r.validaDocsReturn?.digitalSignatureValidations ?? [];
      const pdfa = r.validaDocsReturn?.pdfValidations;

      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

      // Paleta
      const BASE: [number, number, number] = [0x4E, 0x6F, 0x70];
      const lighten = (rgb: [number, number, number], p: number): [number, number, number] => ([
        Math.round(rgb[0] + (255 - rgb[0]) * p),
        Math.round(rgb[1] + (255 - rgb[1]) * p),
        Math.round(rgb[2] + (255 - rgb[2]) * p),
      ]);
      const BRAND = { dark: BASE, mid: lighten(BASE, 0.35), panel: [248, 250, 252] as [number, number, number], border: 230 };

      const M = 15;
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      let y = M;

      const addPageIfNeeded = (min = 18) => { if (y > H - M - min) { doc.addPage(); y = M; } };
      const hr = (space = 6) => { doc.setDrawColor(BRAND.border); doc.line(M, y, W - M, y); y += space; };

      // Logo + faixa
      let logoEl: HTMLImageElement | null = null;
      try { logoEl = await this.loadImage(this.LOGO_URL); } catch { logoEl = null; }

      const drawBrandRibbon = (logo: HTMLImageElement | null, fallbackText: string, bigTitle: string) => {
        const bannerW = W - 2 * M;
        const bannerH = 26;
        const radius  = 3;

        doc.setFillColor(...BRAND.dark);
        doc.roundedRect(M, y, bannerW, bannerH, radius, radius, 'F');
        doc.setTextColor(255);

        let leftContentRightX = M + 10;
        if (logo) {
          const logoH = 16;
          const logoW = (logo.width / logo.height) * logoH;
          const logoX = M + 8;
          const logoY = y + (bannerH - logoH) / 2;
          doc.addImage(logo, 'PNG', logoX, logoY, logoW, logoH);
          leftContentRightX = logoX + logoW + 8;
        } else {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
          doc.text(fallbackText, M + 10, y + 16);
          leftContentRightX = M + 10 + doc.getTextWidth(fallbackText) + 8;
        }

        doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
        const centerX = M + bannerW / 2;
        const titleW  = doc.getTextWidth(bigTitle);
        let titleX = centerX;
        const leftEdge = titleX - titleW / 2;
        if (leftEdge < leftContentRightX + 4) titleX = leftContentRightX + 4 + titleW / 2;
        doc.text(bigTitle, titleX, y + 17, { align: 'center' });

        doc.setDrawColor(...BRAND.mid); doc.setLineWidth(0.6);
        doc.line(M + 4, y + bannerH - 2, M + bannerW - 4, y + bannerH - 2);

        doc.setTextColor(0);
        y += bannerH + 8;
      };
      drawBrandRibbon(logoEl, 'ValidaDocs', 'Relatório de conformidade');

      // cabeçalho com chip
      const headerBlock = (metric: string, chipText: string, chipColorOk: boolean, fileName: string, sub: string) => {
        const padX = 6, padY = 5;
        const bannerW = W - 2 * M;
        const bannerH = 30;
        const yTop = y;

        doc.setFillColor(...BRAND.panel);
        doc.roundedRect(M, yTop, bannerW, bannerH, 2, 2, 'F');

        const y1 = yTop + padY + 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(100);
        const fileTxt = this.normalizeAccents(fileName || '—');
        doc.text(fileTxt, M + bannerW - padX, y1, { align: 'right' });
        doc.setTextColor(0);

        const y2 = yTop + bannerH - padY - 5;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        const chipPadX = 3, chipH = 8;
        const chipW = doc.getTextWidth(chipText) + chipPadX * 2;
        const chipX = M + bannerW - padX - chipW;
        const chipY = y2 - chipH + 2;

        const chipColorRgb = (chipColorOk
          ? [34, 197, 94]
          : [245, 158, 11]) as [number, number, number];
        doc.setFillColor(chipColorRgb[0], chipColorRgb[1], chipColorRgb[2]);
        doc.setTextColor(255);
        doc.roundedRect(chipX, chipY, chipW, chipH, 2, 2, 'F');
        doc.text(this.normalizeAccents(chipText), chipX + chipPadX, y2);
        doc.setTextColor(0);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
        doc.text(this.normalizeAccents(metric), M + padX, y2);

        y = yTop + bannerH + 6;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(90);
        doc.text(sub, M, y);
        doc.setTextColor(0);
        y += 6;
        hr();
      };

      const sigCount = this.signatureCount();
      const chip =
        sigCount === 0
          ? { text: 'Sem assinaturas', ok: false }
          : sigCount === 1
            ? (this.allValid()
                ? { text: 'Assinatura válida', ok: true }
                : { text: 'Assinatura com verificações', ok: false })
            : (this.allValid()
                ? { text: 'Todas válidas', ok: true }
                : { text: 'Com verificações', ok: false });

      headerBlock(
        this.sigMetric(),
        chip.text,
        chip.ok,
        this.result?.fileName || '—',
        `Validado em ${this.brDate(r.validationTime)}`
      );

      // utilitários visuais
      const kvGridTwoCols = (pairs: Array<[string, string | number]>) => {
        const colW = (W - 2 * M) / 2;
        const lineH = 5, labelGap = 4, rowGap = 4;

        let i = 0;
        while (i < pairs.length) {
          const measure = (kv?: [string, string | number]) => {
            if (!kv) return { lines: [] as string[], height: 0, label: '' };
            const [k, v] = kv;
            const text = typeof v === 'string' ? this.normalizeAccents(v) : v;
            const lines = doc.splitTextToSize(String(text ?? '—'), colW);
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
        const t = this.normalizeAccents(text);
        const width = W - 2 * M;
        doc.setFont('helvetica','normal'); doc.setFontSize(11);
        const lines = doc.splitTextToSize(t, width);
        addPageIfNeeded(lines.length * 5 + 2);
        doc.text(lines, M, y);
        y += lines.length * 5 + 2;
      };

      // Dados do documento
      section('Dados do documento');
      kvGridTwoCols([
        ['Status', r.status || '—'],
        ['Tipo do arquivo', 'PDF'],
        ['Política', r.policy ?? r.signatureType ?? '—'],
        ['Versão do software', r.softwareVersion || '—'],
      ]);
      hr();

      // PDF/A
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

      // Apontamentos (se houver)
      const findings = (r.errorfindings || []).filter(Boolean);
      if (findings.length) {
        section('Apontamentos da validação');
        findings.forEach(f => para(String(f)));
        hr();
      }

      // Assinaturas
      section('Assinaturas');
      if (sigs.length === 0) {
        para('Não foram encontradas assinaturas no documento.');
      } else {
        const s0 = sigs[0];
        doc.setFont('helvetica','bold'); doc.setFontSize(12);
        doc.text(this.displayCN(s0) ?? '—', M, y); y += 6;
        doc.setFont('helvetica','normal'); doc.setTextColor(90); doc.setFontSize(11);
        const subt = `${s0.signatureType ?? ''} ${s0.signatureLevel ?? ''}`.trim();
        if (subt) { doc.text(subt, M, y); y += 6; }
        if (s0.signatureTime) { doc.text(this.brDate(s0.signatureTime), M, y); y += 6; }
        doc.setTextColor(0);
        y += 2;

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
        }, {} as Record<number, any>);

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

        // >>> evita sobreposição do bloco seguinte
        const tableFinalY =
          (doc as any).lastAutoTable?.finalY ??
          (autoTable as any)?.previous?.finalY ?? // compatibilidade
          y;
        y = tableFinalY + 10;
        addPageIfNeeded(18);
      }

      // Observações e notas da validação (inclui textos dos tooltips)
      const notas: string[] = [];
      const statusTip = this.getStatusTooltip();
      if (this.result?.isValid === false && statusTip) notas.push(statusTip);

      const tipValid = this.getPdfAValidTooltip();
      if (tipValid) notas.push(tipValid);

      const tipCompliant = this.getPdfACompliantTooltip();
      if (tipCompliant) notas.push(tipCompliant);

      const tipBorn = this.getBornDigitalTooltip();
      if (tipBorn) notas.push(tipBorn);

      const tipLevel = this.getPdfALevelTooltip();
      if (tipLevel) notas.push(tipLevel);

      for (const s of sigs) {
        if (s.signatureValid === false) {
          const t = this.getSignatureTooltip(s);
          if (t) notas.push(`${this.displayCN(s)}: ${t}`);
        }
      }

      if (notas.length) {
        hr();
        section('Observações e notas da validação');
        notas.forEach(n => para('• ' + n));
      }

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