import {
  Component, ElementRef, ViewChild, HostListener, OnDestroy, NgZone, ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormGroup, FormControl, Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { ValidationService } from 'src/app/services/validation.service';
import { ValidationResult, SignatureInfo } from 'src/app/types/validation.types';
import { AuthService } from 'src/app/guard/auth.service';
import { P7sService, P7sSummary } from 'src/app/services/p7s.service';

import {
  IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonInput, IonItem, IonLabel,
  IonList, IonNote, IonProgressBar, IonRow, IonTitle, IonToolbar, IonText, IonCheckbox
} from '@ionic/angular/standalone';

import jsPDF from 'jspdf';
// import autoTable from 'jspdf-autotable';
import { finalize } from 'rxjs/operators';
import { LoadingController } from '@ionic/angular';
import { TrustedRoot } from 'src/app/enum/enum';
import { TrackByFunction } from '@angular/core';

type ExtSignature = SignatureInfo & {
  cpf?: string;
  signerName?: string;
  certificateStartDate?: string | number;
  certificateEndDate?: string | number;
};

@Component({
  selector: 'app-validate',
  templateUrl: './validate.page.html',
  styleUrls: ['./validate.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonItem, IonInput, IonNote, IonProgressBar,
    IonGrid, IonRow, IonCol, IonList, IonLabel, IonBadge, IonIcon, IonButtons,
    IonText, IonCheckbox
  ]
})
export class ValidatePage implements OnDestroy {

  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('p7sInput', { static: false }) p7sInput?: ElementRef<HTMLInputElement>;

  form: FormGroup<{
    file: FormControl<File | null>;
    detached: FormControl<boolean>;
    acceptPolicy: FormControl<boolean>;
  }>;

  file?: File | null;
  p7sFileName?: string;

  loading = false;
  exporting = false;
  error?: string;
  result?: ValidationResult;

  // ====== Estado específico do .p7s ======
  p7sBytes?: ArrayBuffer;
  pdfBytes?: ArrayBuffer; // PDF original (para .p7s detached)
  p7sSummary?: P7sSummary;
  p7sOk?: boolean;
  p7sReason?: string;

  private readonly LOGO_URL = 'assets/validadocs-logo.png';

  constructor(
    private fb: FormBuilder,
    private api: ValidationService,
    private auth: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private p7sService: P7sService,
  ) {
    this.form = this.fb.group({
      file: new FormControl<File | null>(null),
      detached: new FormControl<boolean>(false, { nonNullable: true }),
      acceptPolicy: new FormControl<boolean>(false, {
        nonNullable: true,
        validators: [Validators.requiredTrue]
      }),
    });
  }

  // ===== Novo fluxo: "Nova validação" (v2.1) =====
  newValidation() {
    this.reset();
    const currentPath = this.router.url.split('?')[0];
    this.router.navigateByUrl(currentPath, { replaceUrl: true })
      .then(() => {
        this.cdr.detectChanges();
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      });
  }

  /** Atalho p/ ler o estado do checkbox no template/TS */
  get detached(): boolean {
    return this.form.controls.detached.value;
  }

  /** Aplica mudanças e força reflow do Ionic */
  private applyState(fn: () => void) {
    this.zone.run(() => {
      fn();
      this.cdr.detectChanges();
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  }

  // ================= Botões do header =================
  goHome() { this.reset(); this.router.navigateByUrl('/'); }
  logout() { this.auth.logout(); this.reset(); this.router.navigateByUrl('/'); }

  // ================= Lifecycle / limpeza =================
  ngOnDestroy() { this.reset(); }
  @HostListener('window:beforeunload') handleUnload() { this.reset(); }

  // ================= Upload (PDF OU P7S) =================
  onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input?.files?.[0] ?? null;
    if (!f) return;

    const name = f.name.toLowerCase();

    if (name.endsWith('.p7s')) {
      this.onP7sFile(f);
    } else if (f.type === 'application/pdf' || name.endsWith('.pdf')) {
      this.file = f;
      this.pdfBytes = undefined;
      this.error = undefined;
      this.result = undefined;
      f.arrayBuffer().then(buf => (this.pdfBytes = buf)).catch(() => {});
    } else {
      this.file = null;
      this.result = undefined;
      this.error = 'Selecione um arquivo PDF (.pdf) ou assinatura (.p7s).';
    }

    setTimeout(() => this.fileInput?.nativeElement && (this.fileInput.nativeElement.value = ''), 0);
  }

  onDragOver(ev: DragEvent) { ev.preventDefault(); }
  onDrop(ev: DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0] ?? null;
    if (!f) return;
    const fakeEvent = { target: { files: [f] } } as unknown as Event;
    this.onFileChange(fakeEvent);
  }

  clearFile() {
    this.file = null;
    if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
  }

  // ================== .p7s: handlers ==================
  async onP7sChange(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0];
    if (!f) return;
    await this.onP7sFile(f);
    setTimeout(() => this.p7sInput?.nativeElement && (this.p7sInput.nativeElement.value = ''), 0);
  }

  onDragOverP7s(ev: DragEvent) { ev.preventDefault(); }
  onDropP7s(ev: DragEvent) {
    ev.preventDefault();
    const f = ev.dataTransfer?.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith('.p7s')) {
      this.error = 'Selecione um arquivo de assinatura .p7s.';
      return;
    }
    this.onP7sFile(f);
  }

  private async onP7sFile(f: File) {
    try {
      this.p7sBytes = await this.p7sService.readFile(f);
      this.p7sSummary = await this.p7sService.summarizeP7s(this.p7sBytes);
      this.p7sFileName = f.name;
      this.p7sOk = undefined;
      this.p7sReason = undefined;

      if (!this.p7sSummary.isSignedData) {
        this.error = 'O arquivo selecionado não é um SignedData (.p7s).';
      }
    } catch (e: any) {
      this.p7sFileName = undefined;
      this.error = e?.message || 'Falha ao processar o .p7s.';
    }
  }

  clearP7s() {
    this.p7sBytes = undefined;
    this.pdfBytes = this.pdfBytes; // mantêm o PDF
    this.p7sSummary = undefined;
    this.p7sOk = undefined;
    this.p7sReason = undefined;
    this.p7sFileName = undefined;
    if (this.p7sInput?.nativeElement) this.p7sInput.nativeElement.value = '';
  }

  async verifyP7s() {
    if (!this.p7sBytes) return;
    try {
      const res = await this.p7sService.verifyP7s(this.p7sBytes, this.pdfBytes);
      this.p7sOk = res.ok;
      this.p7sReason = res.reason;
      if (!res.ok) this.error = res.reason || 'Assinatura inválida.';
    } catch (e: any) {
      this.p7sOk = false;
      this.p7sReason = e?.message || 'Erro durante verificação.';
      this.error = this.p7sReason;
    }
  }

  // Habilitação do botão (usado no template)
  canValidate(): boolean {
    const accepted = this.form.controls.acceptPolicy.value === true;
    if (!accepted) return false;
    const hasPdf = !!this.file;
    if (!hasPdf) return false;
    if (this.detached) return !!this.p7sBytes;
    return true;
  }

  // ================= Validação (PDF) =================
  async submit() {
    const accepted = this.form?.controls?.acceptPolicy?.value === true;
    if (!accepted) {
      this.error = 'É necessário aceitar a Política de Privacidade para validar o documento.';
      return;
    }
    if (this.loading || !this.file) {
      if (!this.file) this.error = 'Selecione um PDF para validar.';
      return;
    }
    if (this.detached && !this.p7sBytes) {
      this.error = 'Adicione o arquivo .p7s correspondente para validar.';
      return;
    }

    this.loading = true;
    this.error = undefined;
    this.result = undefined;

    const loading = await this.loadingCtrl.create({ message: 'Processando...' });
    await loading.present();

    this.api.validatePdf(this.file!).pipe(
      finalize(async () => {
        this.loading = false;
        try { await loading.dismiss(); } catch {}
        this.cdr.detectChanges();
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
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

        const assinaturas: ExtSignature[] = sigs.map(a => ({
          ...a,
          cpf: extrairCpf(a.endCertSubjectName),
          signerName: extrairSigner(a.endCertSubjectName),
          certificateStartDate:
            (a as any).certificateStartDate ??
            (a as any).validFrom ??
            (a as any).notBefore,
          certificateEndDate:
            (a as any).certificateEndDate ??
            (a as any).validTo ??
            (a as any).notAfter,
        }));

        res.errorfindings = new Array<string>();
        res.errorfindings.push(...(res.errorMessage ? [res.errorMessage] : []));

        const normalized: ValidationResult = {
          ...res,
          validaDocsReturn: {
            ...res.validaDocsReturn,
            digitalSignatureValidations: assinaturas,
            pdfValidations: res.validaDocsReturn?.pdfValidations ?? undefined
          }
        };

        this.applyState(() => {
          this.error = undefined;
          this.result = normalized;
        });
      },
      error: (err) => {
        this.applyState(() => {
          this.result = undefined;
          this.error = this.friendlyError(err);
        });
        console.error('validatePdf error', err);
      }
    });
  }

  // ================= Helpers de estado/UI =================
  reset() {
    this.form.reset({ file: null, detached: false, acceptPolicy: false });

    this.file = null;
    this.result = undefined;
    this.error = undefined;

    // limpa estado .p7s
    this.p7sBytes = undefined;
    this.pdfBytes = undefined;
    this.p7sSummary = undefined;
    this.p7sOk = undefined;
    this.p7sReason = undefined;
    this.p7sFileName = undefined;

    if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
    if (this.p7sInput?.nativeElement) this.p7sInput.nativeElement.value = '';
  }

  get hasResult(): boolean { return !!this.result; }

  signatureCount(): number {
    return this.result?.validaDocsReturn?.digitalSignatureValidations?.length ?? 0;
  }

  getImgTrustedRoot(sig: ExtSignature): string {
    const trustedRootMap: Record<TrustedRoot, string> = {
      [TrustedRoot.ICPBrasil]: 'assets/selo_validadocs_ICPBrasil.png',
      [TrustedRoot.GovBr]: 'assets/selo_validadocs_GovBr.png',
      [TrustedRoot.eNotariado]: 'assets/selo_validadocs_Enotariado.png',
      [TrustedRoot.ICPRC]: 'assets/selo_validadocs_ICPRC.png'
    };
    return trustedRootMap[sig.trustedRoot as TrustedRoot] ?? 'assets/selo_validadocs_Avançada.png';
  }

  sigMetric(): string {
    const n = this.signatureCount();
    return n === 1 ? '1 Assinatura encontrada' : `${n} Assinaturas encontradas`;
  }

  sigColor(sig: SignatureInfo): 'success' | 'danger' | 'warning' | 'medium' {
    if (sig.signatureValid) return 'success';
    if (!sig.signatureValid && !sig.signatureErrors && !!(sig as any).signatureAlerts) return 'warning';
    return 'danger';
  }

  validColor(status: boolean): 'success' | 'danger' { return status ? 'success' : 'danger'; }

  trackByName: TrackByFunction<SignatureInfo> = (_: number, s: SignatureInfo) =>
    `${s.endCertSubjectName ?? ''}|${(s as any).cpf ?? ''}`;

  allValid(): boolean {
    const sigs = this.result?.validaDocsReturn?.digitalSignatureValidations ?? [];
    return sigs.length > 0 && sigs.every((s: SignatureInfo) => s.signatureValid);
  }

  // -------- Normalização de acentos --------
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

  // ================= Tooltips =================
  getStatusTooltip(): string {
    const r = this.result;
    if (!r || r.isValid !== false) return '';
    const onlyOne = this.signatureCount() === 1;
    const sigs = r.validaDocsReturn?.digitalSignatureValidations ?? [];
    const reasons: string[] = [];

    for (const s of sigs as ExtSignature[]) {
      if (s.signatureValid === false) {
        const errs = (s as any)?.signatureErrors as string[] | string | undefined;
        const alts = (s as any)?.signatureAlerts as string[] | string | undefined;
        if (errs) Array.isArray(errs) ? reasons.push(...errs) : reasons.push(String(errs));
        else if (alts) Array.isArray(alts) ? reasons.push(...alts) : reasons.push(String(alts));
        else {
          if ((s as any)?.docModified) reasons.push('O documento foi alterado após a assinatura.');
          if ((s as any)?.expired) reasons.push('O certificado do signatário está expirado.');
          if ((s as any)?.revoked) reasons.push('O certificado do signatário foi revogado.');
          if ((s as any)?.chainUntrusted) reasons.push('Cadeia de certificação não é confiável.');
        }
      }
    }

    if (reasons.length) {
      const short = reasons.slice(0, 4).join(' · ');
      return onlyOne ? `${short}` : `${short}`;
    }
    return onlyOne ? '' : '';
  }

  getPdfAValidTooltip(): string {
    const pv = this.result?.validaDocsReturn?.pdfValidations;
    if (!pv || pv.isValid !== false) return '';
    const detail = pv.errorMessage || pv.alertMessage;
    return [detail].filter(Boolean).join('');
  }

  getPdfACompliantTooltip(): string {
    const pv = this.result?.validaDocsReturn?.pdfValidations;
    if (!pv || pv.isPDFACompliant !== false) return '';
    const detail = pv.errorMessage || pv.alertMessage;
    return [detail].filter(Boolean).join(' ');
  }

  geterrorfindings(): string {
    const findings =
      (this as any).uiFindings?.length
        ? (this as any).uiFindings as string[]
        : Array.isArray(this.result?.errorfindings)
          ? (this.result!.errorfindings as any[])
              .filter(m => m != null)
              .map(m => String(m).trim())
              .filter(m => m.length > 0)
          : [];
    return findings.join(' · ');
  }

  getBornDigitalTooltip(): string {
    const pv = this.result?.validaDocsReturn?.pdfValidations;
    if (!pv || pv.bornDigital !== false) return '';
    return '';
  }

  getPdfALevelTooltip(): string {
    const pv = this.result?.validaDocsReturn?.pdfValidations;
    const lvl = pv?.pdfAStandard;
    if (lvl && lvl !== 'Desconhecido') return '';
    return '';
  }

  getSignatureTooltip(s: SignatureInfo): string {
    if (!s || s.signatureValid !== false) return '';

    const msgs: string[] = [];
    const errs = (s as any)?.signatureErrors as string[] | string | undefined;
    const alts = (s as any)?.signatureAlerts as string[] | string | undefined;

    if (errs) Array.isArray(errs) ? msgs.push(...errs) : msgs.push(String(errs));
    if (alts && !errs) Array.isArray(alts) ? msgs.push(...alts) : msgs.push(String(alts));

    if ((s as any)?.docModified) msgs.push('O documento foi alterado após a assinatura.');
    if ((s as any)?.expired) msgs.push('O certificado do signatário está expirado.');
    if ((s as any)?.revoked) msgs.push('O certificado do signatário foi revogado.');
    if ((s as any)?.chainUntrusted) msgs.push('Cadeia de certificação não é confiável.');
    if ((s as any)?.timestampInvalid) msgs.push('Carimbo do tempo inválido.');
    if ((s as any)?.ocspInvalid) msgs.push('Falha em OCSP/CRL.');

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

  displayCN(s: SignatureInfo): string {
    const base = s.endCertSubjectName || '—';
    const name = (s as any).isICP ? this.stripCpfSuffix((s as any).signerName || this.extractCN(base)) : base;
    return this.normalizeAccents(name);
  }

  private brBool(v?: boolean): string { return v === undefined ? '—' : (v ? 'Sim' : 'Não'); }

  private brDate(s?: string | number): string {
    if (!s) return '—';
    const d = new Date(s);
    return isNaN(d.getTime()) ? String(s) : d.toLocaleString('pt-BR');
  }

  /** dd/MM/yyyy HH:mm */
  private brDateShort(s?: string | number): string {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private authorityOf(s: SignatureInfo): string {
    return (s as any).qualified || ((s as any).isICP ? 'ICP-Brasil' : (s as any).iseGov ? 'Gov.br' : '—');
  }

  private sigTypeLabel(s: SignatureInfo): string {
    if ((s as any).isICP) return 'ICP-Brasil';
    if ((s as any).iseGov) return 'Gov.br';
    return 'Padrão';
  }

  /** Nome “safe ASCII” para o download */
  private baseName(name?: string): string {
    const raw = (name || 'relatorio').replace(/\.[^/.]+$/, '').trim();
    const fixed = this.normalizeAccents(raw);
    const noMarks = fixed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const asciiOnly = noMarks.replace(/[^\x20-\x7E]/g, '_');
    const safe = asciiOnly
      .replace(/[^A-Za-z0-9\-_. ]+/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/_{2,}/g, '_')
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
      const sigsList = (r.validaDocsReturn?.digitalSignatureValidations ?? []) as ExtSignature[];
      const pdfa = r.validaDocsReturn?.pdfValidations;

      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

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

      const addPageIfNeeded = (min = 18) => {
        if (y > H - M - min) {
          doc.addPage();
          y = M;
        }
      };
      const hr = (space = 6) => { doc.setDrawColor(BRAND.border); doc.line(M, y, W - M, y); y += space; };

      // ===== Cabeçalho
      let logoEl: HTMLImageElement | null = null;
      try { logoEl = await this.loadImage(this.LOGO_URL); } catch { logoEl = null; }

      const drawBrandRibbon = (logo: HTMLImageElement | null) => {
        const bannerW = W - 2 * M;
        const bannerH = 26;

        doc.setFillColor(...BRAND.dark);
        doc.roundedRect(M, y, bannerW, bannerH, 3, 3, 'F');
        doc.setTextColor(255);

        if (logo) {
          const logoH = 16;
          const logoW = (logo.width / logo.height) * logoH;
          doc.addImage(logo, 'PNG', M + 8, y + (bannerH - logoH) / 2, logoW, logoH);
        } else {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
          doc.text('ValidaDocs', M + 10, y + 16);
        }

        doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
        doc.text('Relatório de conformidade', M + bannerW / 2, y + 17, { align: 'center' });

        doc.setTextColor(0);
        y += bannerH + 8;
      };
      drawBrandRibbon(logoEl);

      const sigCount = this.signatureCount();
      const anyInvalid = (this.result?.validaDocsReturn?.digitalSignatureValidations || []).some(s => !s.signatureValid);
      const hasTooltips =
        !!this.getStatusTooltip() ||
        !!this.getPdfAValidTooltip() ||
        !!this.getPdfACompliantTooltip() ||
        !!this.getBornDigitalTooltip() ||
        !!this.getPdfALevelTooltip();
      const hasFindings = (this.result?.errorfindings?.length || 0) > 0 || anyInvalid || hasTooltips;

      const chip =
        sigCount === 0
          ? { text: 'Sem assinaturas', ok: false }
          : hasFindings
            ? { text: 'Validação com apontamentos', ok: false }
            : { text: sigCount === 1 ? 'Assinatura válida' : 'Todas válidas', ok: true };

      const headerBlock = (
        metric: string,
        chipText: string,
        chipColorOk: boolean,
        subLines: string[]
      ) => {
        const padX = 6, padY = 5;
        const bannerW = W - 2 * M;
        const bannerH = 30;
        const yTop = y;

        doc.setFillColor(...([248, 250, 252] as [number, number, number]));
        doc.roundedRect(M, yTop, bannerW, bannerH, 2, 2, 'F');

        // chip (direita)
        const y2 = yTop + bannerH - padY - 5;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        const chipPadX = 3, chipH = 8;
        const chipW = doc.getTextWidth(chipText) + chipPadX * 2;
        const chipX = M + bannerW - padX - chipW;
        const chipY = y2 - chipH + 2;

        const chipColorRgb = (chipColorOk ? [34, 197, 94] : [245, 158, 11]) as [number, number, number];
        doc.setFillColor(chipColorRgb[0], chipColorRgb[1], chipColorRgb[2]);
        doc.setTextColor(255);
        doc.roundedRect(chipX, chipY, chipW, chipH, 2, 2, 'F');
        doc.text(chipText, chipX + chipPadX, y2);
        doc.setTextColor(0);

        // título
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
        doc.text(metric, M, y2);

        // subtítulo
        y = yTop + bannerH + 6;
        if (subLines?.length) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(90);
          doc.text(subLines.map(l => this.normalizeAccents(l)), M, y);
          doc.setTextColor(0);
          y += subLines.length * 5 + 1;
        }

        doc.setDrawColor(230);
        doc.line(M, y, W - M, y); y += 6;
      };

      headerBlock(
        this.sigMetric(),
        chip.text,
        chip.ok,
        [
          `Validado em ${this.brDate(r.validationTime)}`,
          `Versão do software: ${r.softwareVersion || '—'}`
        ]
      );

      const MARGIN = M;
      const WID = W;

      // helpers de layout
      const section = (title: string) => {
        addPageIfNeeded(14);
        doc.setFont('helvetica','bold'); doc.setFontSize(12);
        doc.text(title, MARGIN, y);
        y += 7;
      };
      const para = (text: string) => {
        const t = this.normalizeAccents(text);
        const width = WID - 2 * MARGIN;
        doc.setFont('helvetica','normal'); doc.setFontSize(11);
        const lines = doc.splitTextToSize(t, width);
        addPageIfNeeded(lines.length * 5 + 2);
        doc.text(lines, MARGIN, y);
        y += lines.length * 5 + 2;
      };
      const kvInlineTwoCols = (pairs: Array<[string, string | number]>) => {
        const colW = (WID - 2 * MARGIN) / 2;
        const rowGap = 4;
        const labelGap = 2;
        const lineH = 5;

        const measurePair = (label: string, value: string | number) => {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
          const lblW = Math.min(doc.getTextWidth(this.normalizeAccents(label) + ': '), colW * 0.6);
          const valMaxW = Math.max(8, colW - lblW - labelGap);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
          const lines = doc.splitTextToSize(this.normalizeAccents(String(value ?? '—')), valMaxW);
          const h = Math.max(lineH, lines.length * lineH);
          return { lblW, valMaxW, lines, h };
        };

        const drawPair = (x: number, label: string, value: string | number, meas?: ReturnType<typeof measurePair>) => {
          const m = meas ?? measurePair(label, value);
          const labelText = this.normalizeAccents(label) + ': ';
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
          doc.text(labelText, x, y);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
          if (m.lines.length) {
            doc.text(m.lines[0], x + m.lblW + labelGap, y);
            for (let i = 1; i < m.lines.length; i++) {
              doc.text(m.lines[i], x + m.lblW + labelGap, y + i * lineH);
            }
          }
          return m.h;
        };

        let i = 0;
        while (i < pairs.length) {
          const L = pairs[i];
          const R = pairs[i + 1];

          const mL = L ? measurePair(L[0], L[1]) : { h: 0, lblW: 0, valMaxW: 0, lines: [] as string[] };
          const mR = R ? measurePair(R[0], R[1]) : { h: 0, lblW: 0, valMaxW: 0, lines: [] as string[] };
          const rowH = Math.max(mL.h, mR.h, lineH);

          addPageIfNeeded(rowH + 4);

          if (L) drawPair(MARGIN, L[0], L[1], mL);
          if (R) drawPair(MARGIN + colW, R[0], R[1], mR);

          y += rowH + rowGap;
          i += 2;
        }
      };

      // ===== Dados do documento
      section('Dados do documento');
      const statusValue =
        (this.result?.status && String(this.result.status).trim()) ||
        (this.result?.isValid === true ? 'OK' :
          this.result?.isValid === false ? 'Inválido' : '—');

      kvInlineTwoCols([
        ['Nome do documento', this.result?.fileName || '—'],
        ['Status', statusValue],
        ['Padrão de assinatura', r.policy ?? r.signatureType ?? '—'],
      ]);
      hr();

      // ===== Conformidade PDF/A
      section('Conformidade PDF/A');
      const pdfaLabel = (v?: boolean) => v === undefined ? '—' : (v ? 'Válido' : 'Inválido');

      kvInlineTwoCols([
        ['PDF/A', pdfaLabel(pdfa?.isValid)],
        ['Conformidade', (pdfa?.isPDFACompliant === undefined) ? '—' : (pdfa.isPDFACompliant ? 'Sim' : 'Não')],
        ['Nato digital', (pdfa?.bornDigital === undefined) ? '—' : (pdfa.bornDigital ? 'Sim' : 'Não')],
        ['Nível do PDF/A', pdfa?.pdfAStandard || '—'],
      ]);
      if (pdfa?.alertMessage) para(`Alerta: ${pdfa.alertMessage}`);
      if (pdfa?.errorMessage) para(`Erro: ${pdfa.errorMessage}`);
      hr();

      // ===== Assinaturas
      section('Assinaturas');
      if (sigsList.length === 0) {
        para('Não foram encontradas assinaturas no documento.');
      } else {
        for (const s of sigsList) {
          addPageIfNeeded(28);

          const tipoTxt = this.sigTypeLabel(s);
          const nome    = this.displayCN(s) ?? '—';
          const tipoPar = tipoTxt && tipoTxt !== '—' ? ` (${tipoTxt})` : '';

          doc.setFont('helvetica','bold'); doc.setFontSize(12);
          doc.text(`${nome}${tipoPar}`, MARGIN, y);

          const badgeText = s.signatureValid ? 'Válida' : 'Inválida';
          doc.setFont('helvetica','bold');
          doc.setFontSize(11);
          const textW = doc.getTextWidth(badgeText);
          doc.text(badgeText, W - MARGIN - textW, y);
          y += 6;

          doc.setFont('helvetica','normal'); doc.setTextColor(90); doc.setFontSize(11);
          const subt = `${s.signatureType ?? ''} ${s.signatureLevel ?? ''}`.trim();
          if (subt) { doc.text(subt, MARGIN, y); y += 6; }
          if ((s as any).signatureTime) { doc.text(this.brDateShort((s as any).signatureTime), MARGIN, y); y += 6; }
          doc.setTextColor(0);

          const colW = (W - 2 * MARGIN) / 2;
          const drawKV = (x: number, label: string, value: string) => {
            doc.setFont('helvetica','bold'); doc.setFontSize(10);
            const lbl = this.normalizeAccents(label) + ': ';
            const lblW = Math.min(doc.getTextWidth(lbl), colW * 0.45);
            doc.text(lbl, x, y);
            doc.setFont('helvetica','normal'); doc.setFontSize(11);
            const lines = doc.splitTextToSize(this.normalizeAccents(value), colW - lblW - 2);
            doc.text(lines, x + lblW + 2, y);
          };

          addPageIfNeeded(12);
          drawKV(MARGIN,        'CPF',        (s as any).cpf || '—');
          drawKV(MARGIN + colW, 'Emitido em', this.brDateShort((s as any).certificateStartDate));
          y += 6;

          addPageIfNeeded(12);
          drawKV(MARGIN,        'Válido até', this.brDateShort((s as any).certificateEndDate));
          y += 6;

          const root = (s as any).rootIssuer || (s as any).issuer || '';
          if (root) {
            const value = this.normalizeAccents(root);
            const fullW = (W - 2 * MARGIN);
            const lineH = 5;

            doc.setFont('helvetica','bold');
            doc.setFontSize(10);
            const labelText = 'Emissor raiz: ';
            const labelW = doc.getTextWidth(labelText);
            const valueX = MARGIN + labelW + 2;
            const valueMaxWidth = fullW - labelW - 2;

            addPageIfNeeded(lineH);
            doc.text(labelText, MARGIN, y);

            doc.setFont('helvetica','normal');
            doc.setFontSize(11);
            const valueLines = doc.splitTextToSize(value, valueMaxWidth);

            if (valueLines.length) {
              doc.text(valueLines[0], valueX, y);
              for (let i = 1; i < valueLines.length; i++) {
                doc.text(valueLines[i], valueX, y + i * lineH);
              }
              y += Math.max(lineH + 1, valueLines.length * lineH);
            } else {
              doc.text('—', valueX, y);
              y += lineH + 1;
            }
          }

          doc.setDrawColor(240);
          doc.line(MARGIN, y, W - MARGIN, y);
          y += 6;
        }
      }

      // ===== Apontamentos
      const notas: string [] = [];
      const ef = this.geterrorfindings();
      if (ef) notas.push(ef);
      const statusTip = this.getStatusTooltip();
      if (this.result?.isValid === false && statusTip) notas.push(statusTip);

      if (notas.length) {
        hr();
        section('Apontamentos e notas da validação');
        notas.forEach(n => para('' + n));
      }

      // ===== Rodapé
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

  // ================= Erros amigáveis =================
  private friendlyError(err: any): string {
    const txt = (err?.error?.message || err?.error || err?.message || '').toString();

    if (/timeout/i.test(txt)) return 'Tempo esgotado ao validar o arquivo (15s). Tente novamente.';
    if (err?.status === 0 || /Network|Failed to fetch|CORS/i.test(txt))
      return 'Não foi possível conectar ao serviço de validação. Verifique sua conexão.';
    if (err?.status === 413) return 'Arquivo muito grande para validar.';
    if (err?.status === 415) return 'Tipo de arquivo não suportado. Selecione um PDF.';
    if (err?.error?.error) return String(err.error.error);
    if (txt) return txt;

    return 'Falha ao validar. Tente novamente.';
  }
}
