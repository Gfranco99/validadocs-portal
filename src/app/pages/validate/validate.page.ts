import {
  Component, ElementRef, ViewChild, HostListener, OnDestroy, NgZone, ChangeDetectorRef, TrackByFunction, OnInit
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule, FormBuilder, FormsModule, FormGroup, FormControl, Validators
} from '@angular/forms';
import { Router } from '@angular/router';

import { ValidationService } from 'src/app/services/validation.service';
import { ValidationResult, SignatureInfo } from 'src/app/types/validation.types';
import { AuthService } from 'src/app/guard/auth.service';
import { P7sService, P7sSummary } from 'src/app/services/p7s.service';

// ✅ ADICIONADO IonSpinner AQUI
import {
  IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonInput, IonItem, IonLabel,
  IonList, IonNote, IonRow, IonTitle, IonToolbar, IonText, IonCheckbox,
  IonAccordionGroup, IonAccordion, IonModal, IonSpinner
} from '@ionic/angular/standalone';

import jsPDF from 'jspdf';
import { finalize } from 'rxjs/operators';
import { LoadingController } from '@ionic/angular';
import { TrustedRoot } from 'src/app/enum/enum';
import { ErrorModalComponent } from 'src/app/components/error-modal/error-modal.component';

import { addIcons } from 'ionicons';
import { closeOutline } from 'ionicons/icons';

type ExtSignature = SignatureInfo & {
  cpf?: string;
  signerName?: string;
  certificateStartDate?: string | number;
  certificateEndDate?: string | number;
  signingTime?: string | number;
};

@Component({
  selector: 'app-validate',
  templateUrl: './validate.page.html',
  styleUrls: ['./validate.page.scss'],
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonButton, IonItem, IonInput, IonNote,
    IonGrid, IonRow, IonCol, IonList, IonLabel, IonBadge, IonIcon, IonButtons,
    IonText, IonCheckbox,
    IonAccordionGroup, IonAccordion, IonModal,
    IonSpinner, // ✅ ADICIONADO NOS IMPORTS DO COMPONENTE
    ErrorModalComponent
  ]
})
export class ValidatePage implements OnInit, OnDestroy {

  @ViewChild('fileInput', { static: false }) fileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('p7sInput', { static: false }) p7sInput?: ElementRef<HTMLInputElement>;

  form: FormGroup<{
    file: FormControl<File | null>;
    detached: FormControl<boolean>;
    acceptPolicy: FormControl<boolean>;
    engineITI: FormControl<boolean>;
    engineSDK: FormControl<boolean>;
  }>;

  file?: File | null;
  p7sFileName?: string;

  loading = false;
  exporting = false;
  error?: string;

  // ====== VARIÁVEIS DA I.A. ======
  useAI = false;
  aiData: any = null;
  isAiModalOpen = false;
  aiLoading = false; // ✅ VARIÁVEL CRIADA
  // ==============================

  errorFullMessage: string | null = null;
  showErrorModal = false;

  result?: ValidationResult;

  // ====== Estado específico do .p7s ======
  p7sBytes?: ArrayBuffer;
  pdfBytes?: ArrayBuffer;
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
      engineITI: new FormControl<boolean>(true, { nonNullable: true }),
      engineSDK: new FormControl<boolean>(false, { nonNullable: true }),
    });
  }

  setAiModalOpen(isOpen: boolean) {
    this.isAiModalOpen = isOpen;
  }

  // ================== ERROS HTTP ==================
  private friendlyError(err: any): string {
    const defaultMsg = 'Ocorreu um erro desconhecido durante a validação.';
    if (err?.error && typeof err.error === 'string') return err.error;
    if (err?.message && typeof err.message === 'string') return err.message;
    if (err?.status === 401) {
      this.auth.logout();
      this.router.navigateByUrl('/login');
      return 'Sessão expirada. Por favor, faça login novamente.';
    }
    return defaultMsg;
  }

  ngOnInit(): void {
    addIcons({ closeOutline });

    const stored = (localStorage.getItem('engine') || 'ITI').toUpperCase();
    if (stored === 'SDK') {
      this.form.patchValue({ engineITI: false, engineSDK: true }, { emitEvent: false });
    } else {
      this.form.patchValue({ engineITI: true, engineSDK: false }, { emitEvent: false });
    }
  }

  get engine(): 'ITI' | 'SDK' {
    return this.form.controls.engineSDK.value ? 'SDK' : 'ITI';
  }

  onToggleEngine(engine: 'ITI' | 'SDK', checked: boolean): void {
    if (engine === 'ITI') {
      this.form.patchValue({ engineITI: !!checked, engineSDK: false });
      if (checked) localStorage.setItem('engine', 'ITI');
    } else {
      this.form.patchValue({ engineITI: false, engineSDK: !!checked });
      if (checked) localStorage.setItem('engine', 'SDK');
    }
  }

  get showItiNote(): boolean {
    return this.form.controls.engineITI.value === true;
  }

  get timeStamps(): any[] {
    const r: any = this.result as any;
    const candidates: any[] = [
      r?.timeStamps, r?.validaDocsReturn?.timeStamps,
      r?.validaDocsReturn?.timeStampValidations, r?.validaDocsReturn?.timestampValidations,
      r?.validaDocsReturn?.timestamps, r?.validaDocsReturn?.pdfValidations?.timeStamps
    ].filter(Array.isArray);

    if (candidates.length && candidates[0].length) return candidates[0];

    const sigs = r?.validaDocsReturn?.digitalSignatureValidations;
    if (Array.isArray(sigs) && sigs.length) {
      const merged = (sigs as any[]).reduce((acc: any[], s: any) => {
        const arr = (Array.isArray(s?.timeStamps) && s.timeStamps) ||
          (Array.isArray(s?.timestamps) && s.timestamps) ||
          (Array.isArray(s?.timeStampValidations) && s.timeStampValidations) || [];
        return acc.concat(arr);
      }, []);
      if (merged.length) return merged;
    }
    return [];
  }

  tsDate(ts: any): string | number | undefined {
    return ts?.timeStampDate ?? ts?.timestampDate ?? ts?.genTime ?? ts?.producedAt ?? ts?.signingTime ?? ts?.date;
  }

  tsSigner(ts: any): any {
    return Array.isArray(ts?.signers) ? ts.signers[0] : ts?.signer ? ts.signer : ts?.tsaInfo ? ts.tsaInfo : undefined;
  }

  formatDate(v?: string | number): string {
    if (v === undefined || v === null) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleString('pt-BR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  newValidation() {
    this.reset();
    const currentPath = this.router.url.split('?')[0];
    this.router.navigateByUrl(currentPath, { replaceUrl: true }).then(() => {
      this.cdr.detectChanges();
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { }
    });
  }

  get detached(): boolean { return this.form.controls.detached.value; }

  private applyState(fn: () => void) {
    this.zone.run(() => {
      fn();
      this.cdr.detectChanges();
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    });
  }

  goHome() { this.reset(); this.router.navigateByUrl('/'); }
  logout() { this.auth.logout(); this.reset(); this.router.navigateByUrl('/'); }

  ngOnDestroy() { this.reset(); }
  @HostListener('window:beforeunload') handleUnload() { this.reset(); }

  onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input?.files?.[0] ?? null;
    if (!f) return;
    const name = f.name.toLowerCase();
    this.errorFullMessage = null;
    this.showErrorModal = false;

    if (name.endsWith('.p7s')) {
      this.onP7sFile(f);
    } else if (f.type === 'application/pdf' || name.endsWith('.pdf')) {
      this.file = f;
      this.pdfBytes = undefined;
      this.error = undefined;
      this.result = undefined;

      this.aiData = null;
      this.isAiModalOpen = false;
      this.aiLoading = false; // Reset loading

      f.arrayBuffer().then(buf => (this.pdfBytes = buf)).catch(() => { });
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
    this.errorFullMessage = null;
    this.showErrorModal = false;
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
      this.errorFullMessage = null;
      this.showErrorModal = false;
      if (!this.p7sSummary.isSignedData) {
        this.error = 'O arquivo selecionado não é um SignedData (.p7s).';
      }
    } catch (e: any) {
      this.p7sFileName = undefined;
      this.error = e?.message || 'Falha ao processar o .p7s.';
      this.errorFullMessage = null;
      this.showErrorModal = false;
    }
  }

  async verifyP7s() {
    if (!this.p7sBytes) return;
    try {
      const res = await this.p7sService.verifyP7s(this.p7sBytes, this.pdfBytes);
      this.p7sOk = res.ok;
      this.p7sReason = res.reason;
      if (!res.ok) {
        this.error = res.reason || 'Assinatura inválida.';
        this.errorFullMessage = null;
        this.showErrorModal = false;
      }
    } catch (e: any) {
      this.p7sOk = false;
      this.p7sReason = e?.message || 'Erro durante verificação.';
      this.error = this.p7sReason;
      this.errorFullMessage = null;
      this.showErrorModal = false;
    }
  }

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
    this.errorFullMessage = null;
    this.showErrorModal = false;
    this.result = undefined;

    // ✅ Reset de estado da IA
    this.aiData = null;
    this.isAiModalOpen = false;
    
    // ✅ Se usar IA, liga o spinner
    if (this.useAI) {
      this.aiLoading = true;
    } else {
      this.aiLoading = false;
    }

    const loading = await this.loadingCtrl.create({ message: 'Processando...' });
    await loading.present();

    this.api.validatePdf(this.file!).pipe(
      finalize(async () => {
        this.loading = false;
        try { await loading.dismiss(); } catch { }
        this.cdr.detectChanges();
        requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
      })
    ).subscribe({
      next: (res: ValidationResult) => {
        const sigs = res.validaDocsReturn?.digitalSignatureValidations ?? [];
        const extrairCpf = (subject: string): string => subject?.match(/:(\d{11})$/)?.[1] ?? '';
        const extrairSigner = (subject: string): string => {
          const cnPart = subject?.split(',')?.find(p => p.trim().startsWith('CN='));
          const nameWithCPF = cnPart?.split('=')[1];
          return (nameWithCPF?.split(':')[0] ?? '').trim();
        };

        const assinaturas: ExtSignature[] = sigs.map(a => ({
          ...a,
          cpf: extrairCpf(a.endCertSubjectName),
          signerName: extrairSigner(a.endCertSubjectName),
          signingTime: (a as any).signingTime,
          certificateStartDate: (a as any).certificateStartDate ?? (a as any).validFrom ?? (a as any).notBefore,
          certificateEndDate: (a as any).certificateEndDate ?? (a as any).validTo ?? (a as any).notAfter,
        }));

        const findings: string[] = [];
        const sigAny = (res.validaDocsReturn?.digitalSignatureValidations as any[]) ?? [];
        for (const s of sigAny) {
          const alerts = s?.signatureAlerts;
          if (Array.isArray(alerts)) {
            for (const a of alerts) {
              if (a?.description) findings.push(String(a.description).trim());
            }
          } else if (alerts && typeof alerts === 'object') {
            if (alerts.description) findings.push(String(alerts.description).trim());
          } else if (typeof alerts === 'string') {
            findings.push(alerts.trim());
          }
        }
        if (!findings.length && (res as any).errorMessage) {
          findings.push(String((res as any).errorMessage).trim());
        }
        (res as any).errorfindings = Array.from(new Set(findings));

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
          this.showErrorModal = false;
        });

        // ✅ Lógica IA (Com Loading Visual)
        if (this.useAI) {
          const idParaConsultar = (res as any).id || this.file?.name || 'ID-Desconhecido';

          (this.api as any).chamarValidacaoExterna(this.file!, idParaConsultar).subscribe({
            next: (respIA: any) => {
              let conteudo = respIA?.data || respIA;
              if (typeof conteudo === 'string') {
                try { conteudo = JSON.parse(conteudo); } catch { }
              }
              this.aiData = conteudo;
              this.aiLoading = false; // ✅ Desliga loading com sucesso
              this.cdr.detectChanges();
            },
            error: () => {
              this.aiLoading = false; // ✅ Desliga loading com erro
              this.aiData = { answer: 'Não foi possível obter a análise da I.A. no momento.' };
              this.cdr.detectChanges();
            }
          });
        } else {
          this.aiLoading = false; // Garante desligado se não usar AI
        }
      },
      error: (err) => {
        this.aiLoading = false; // ✅ Desliga loading se falhar a validação principal
        this.applyState(() => {
          this.result = undefined;
          this.error = this.friendlyError(err);
          this.errorFullMessage = null;
          this.showErrorModal = false;
        });
      }
    });
  }

  // ... (Helpers do modal e UI mantidos) ...
  private getFirstAlertId(): string | null {
    const sigs = this.result?.validaDocsReturn?.digitalSignatureValidations as any[] || [];
    for (const s of sigs) {
      const alerts = s?.signatureAlerts;
      if (Array.isArray(alerts)) {
        const found = alerts.find((a: any) => a?.id);
        if (found?.id) return String(found.id);
      } else if (alerts && typeof alerts === 'object' && alerts.id) {
        return String(alerts.id);
      }
    }
    return null;
  }

  get hasDetailsLink(): boolean { return this.hasFindings; }

  openErrorDetails(): void {
    const id = this.getFirstAlertId();
    if (!id) {
      const fallback = (this.geterrorfindings() || '').trim() || this.getStatusNotes().join('\n\n').trim();
      if (!fallback) return;
      this.applyState(() => { this.errorFullMessage = fallback; this.showErrorModal = true; });
      return;
    }
    this.errorFullMessage = null;
    this.api.getErrorDescriptionById(id).subscribe({
      next: (data) => {
        const msg = (data?.description || data?.message || '').trim();
        this.applyState(() => {
          this.errorFullMessage = msg || 'Nenhuma orientação detalhada encontrada para este apontamento.';
          this.showErrorModal = true;
        });
      },
      error: () => {
        this.applyState(() => {
          this.errorFullMessage = 'Não foi possível carregar os detalhes deste apontamento no momento.';
          this.showErrorModal = true;
        });
      }
    });
  }

  closeErrorDetails(): void { this.showErrorModal = false; }

  reset() {
    this.form.reset({
      file: null, detached: false, acceptPolicy: false,
      engineITI: (localStorage.getItem('engine') || 'ITI').toUpperCase() !== 'SDK',
      engineSDK: (localStorage.getItem('engine') || 'ITI').toUpperCase() === 'SDK'
    });
    this.file = null; this.result = undefined; this.error = undefined;
    this.errorFullMessage = null; this.showErrorModal = false;

    this.aiData = null;
    this.isAiModalOpen = false;
    this.aiLoading = false; // Reset

    this.p7sBytes = undefined; this.pdfBytes = undefined;
    if (this.fileInput?.nativeElement) this.fileInput.nativeElement.value = '';
    if (this.p7sInput?.nativeElement) this.p7sInput.nativeElement.value = '';
  }

  get hasResult(): boolean { return !!this.result; }
  signatureCount(): number { return this.result?.validaDocsReturn?.digitalSignatureValidations?.length ?? 0; }

  getImgTrustedRoot(sig: SignatureInfo): string {
    const trustedRootMap: Record<TrustedRoot, string> = {
      [TrustedRoot.ICPBrasil]: 'assets/selo_validadocs_ICPBrasil.png',
      [TrustedRoot.GovBr]: 'assets/selo_validadocs_GovBr.png',
      [TrustedRoot.eNotariado]: 'assets/selo_validadocs_Enotariado.png',
      [TrustedRoot.ICPRC]: 'assets/selo_validadocs_ICPRC.png'
    };
    const root = sig.trustedRoot as TrustedRoot;
    return trustedRootMap[root] ?? 'assets/selo_validadocs_Avançada.png';
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
  trackByName: TrackByFunction<SignatureInfo> = (_: number, s: SignatureInfo) => `${s.endCertSubjectName ?? ''}|${(s as any).cpf ?? ''}`;
  allValid(): boolean {
    const sigs = this.result?.validaDocsReturn?.digitalSignatureValidations ?? [];
    return sigs.length > 0 && sigs.every((s: SignatureInfo) => s.signatureValid);
  }

  normalizeAccents(v?: string): string {
    if (!v) return '—';
    const suspicious = /[ÃÂâÊ¢€™]/.test(v);
    if (!suspicious) return v;
    try {
      const bytes = Uint8Array.from(Array.from(v).map(ch => ch.charCodeAt(0) & 0xff));
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    } catch {
      try { return decodeURIComponent(escape(v)); } catch { return v; }
    }
  }

  private collectReasonsFromField(field: any, out: string[]) {
    if (!field) return;
    const handleEntry = (entry: any) => {
      if (entry == null) return;
      if (typeof entry === 'string') {
        const txt = entry.trim(); if (txt) out.push(txt); return;
      }
      if (typeof entry === 'object') {
        const desc = (entry.description && String(entry.description).trim()) || (entry.message && String(entry.message).trim()) || (entry.id && String(entry.id).trim());
        if (desc) { out.push(desc); return; }
      }
      const fallback = String(entry).trim();
      if (fallback && fallback !== '[object Object]') out.push(fallback);
    };
    if (Array.isArray(field)) field.forEach(handleEntry); else handleEntry(field);
  }

  getStatusNotes(): string[] {
    const reasons: string[] = [];
    const sigs = this.result?.validaDocsReturn?.digitalSignatureValidations ?? [];
    for (const s of sigs as ExtSignature[]) {
      this.collectReasonsFromField((s as any)?.signatureErrors, reasons);
      this.collectReasonsFromField((s as any)?.signatureAlerts, reasons);
    }
    return Array.from(new Set(reasons));
  }

  getStatusTooltip(): string {
    const reasons = this.getStatusNotes();
    if (!reasons.length) return '';
    const short = reasons.slice(0, 4).join(' · ');
    return `${short}`;
  }

  getPdfAValidTooltip(): string {
    const pv = this.result?.validaDocsReturn?.pdfValidations;
    if (!pv || pv.isValid !== false) return '';
    return [pv.errorMessage || pv.alertMessage].filter(Boolean).join('');
  }

  getPdfACompliantTooltip(): string {
    const pv = this.result?.validaDocsReturn?.pdfValidations;
    if (!pv || pv.isPDFACompliant !== false) return '';
    return [pv.errorMessage || pv.alertMessage].filter(Boolean).join(' ');
  }

  geterrorfindings(): string {
    const findings =
      (this as any).uiFindings?.length
        ? (this as any).uiFindings as string[]
        : Array.isArray((this.result as any)?.errorfindings)
          ? ((this.result as any).errorfindings as any[])
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

  getSignatureTooltip(_: SignatureInfo): string { return ''; }

  get shortFinding(): string {
    const txt = (this.geterrorfindings() || '').trim();
    if (txt) return txt;
    const notes = this.getStatusNotes();
    return notes.length ? notes[0] : '';
  }

  get hasFindings(): boolean { return !!this.shortFinding; }

  private extractCN(subject?: string): string {
    if (!subject) return '—';
    const re = /(?:^|[,/])\s*CN\s*=\s*([^,\/]+)/gi;
    let cn = ''; let m: RegExpExecArray | null;
    while ((m = re.exec(subject))) cn = (m[1] || '').trim();
    return cn || subject || '—';
  }

  private stripCpfSuffix(v: string): string { return v.replace(/:\d{11}\s*$/, ''); }

  displayCN(s: SignatureInfo): string {
    const base = s.endCertSubjectName || '—';
    const name = (s as any).isICP ? this.stripCpfSuffix((s as any).signerName || this.extractCN(base)) : base;
    return this.normalizeAccents(name);
  }

  private brDateShort(s?: string | number): string {
    if (!s) return '—';
    const d = new Date(s);
    if (isNaN(d.getTime())) return String(s);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${pad(d.getFullYear())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private authorityOf(s: SignatureInfo): string {
    return (s as any).qualified || ((s as any).isICP ? 'ICP-Brasil' : (s as any).iseGov ? 'Gov.br' : '—');
  }

  private sigTypeLabel(s: SignatureInfo): string {
    const isICP = (s as any)?.isICP || (s as any)?.trustedRoot === 'ICP-Brasil';
    const isGov = (s as any)?.iseGov || (s as any)?.trustedRoot === 'Gov.br';
    if (isICP) return 'ICP-Brasil';
    if (isGov) return 'Gov.br';
    return 'Padrão';
  }

  private baseName(name?: string): string {
    const raw = (name || 'relatorio').replace(/\.[^/.]+$/, '').trim();
    const fixed = this.normalizeAccents(raw);
    const noMarks = fixed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const asciiOnly = noMarks.replace(/[^\x20-\x7E]/g, '_');
    return asciiOnly.replace(/[^A-Za-z0-9\-_. ]+/g, '_').replace(/\s+/g, ' ').replace(/_{2,}/g, '_').trim().slice(0, 80) || 'relatorio';
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
      const pdfValidations = r.validaDocsReturn?.pdfValidations;

      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

      // Configurações de estilo
      const BASE: [number, number, number] = [0x4E, 0x6F, 0x70];
      const lighten = (rgb: [number, number, number], p: number): [number, number, number] => ([
        Math.round(rgb[0] + (255 - rgb[0]) * p),
        Math.round(rgb[1] + (255 - rgb[1]) * p),
        Math.round(rgb[2] + (255 - rgb[2]) * p),
      ]);
      const BRAND = {
        dark: BASE, mid: lighten(BASE, 0.35), panel: [248, 250, 252] as [number, number, number], border: 230
      };

      const M = 15;
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      let y = M;

      const addPageIfNeeded = (min = 18) => { if (y > H - M - min) { doc.addPage(); y = M; } };
      const hr = (space = 6) => { doc.setDrawColor(BRAND.border); doc.line(M, y, W - M, y); y += space; };

      let logoEl: HTMLImageElement | null = null;
      try { logoEl = await this.loadImage(this.LOGO_URL); } catch { logoEl = null; }

      const drawBrandRibbon = (logo: HTMLImageElement | null) => {
        const bannerW = W - 2 * M; const bannerH = 26;
        doc.setFillColor(...BRAND.dark); doc.roundedRect(M, y, bannerW, bannerH, 3, 3, 'F');
        doc.setTextColor(255);
        if (logo) {
          const logoH = 16; const logoW = (logo.width / logo.height) * logoH;
          doc.addImage(logo, 'PNG', M + 8, y + (bannerH - logoH) / 2, logoW, logoH);
        } else {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('ValidaDocs', M + 10, y + 16);
        }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
        doc.text('Relatório de conformidade', M + bannerW / 2, y + 17, { align: 'center' });
        doc.setTextColor(0); y += bannerH + 8;
      };
      drawBrandRibbon(logoEl);

      const sigCount = sigsList.length;
      const anyInvalid = sigsList.some(s => !s.signatureValid);
      const hasTooltips = !!this.getStatusTooltip() || !!this.getPdfAValidTooltip() || !!this.getPdfACompliantTooltip() || !!this.getBornDigitalTooltip() || !!this.getPdfALevelTooltip();
      const hasFindings = (this.result?.errorfindings?.length || 0) > 0 || anyInvalid || hasTooltips;

      const chip = sigCount === 0
        ? { text: 'Sem assinaturas', ok: false }
        : hasFindings
          ? { text: 'Validação com apontamentos', ok: false }
          : { text: sigCount === 1 ? 'Assinatura válida' : 'Todas válidas', ok: true };

      const headerBlock = (metric: string, chipText: string, chipColorOk: boolean, subLines: string[]) => {
        const padX = 6, padY = 5; const bannerW = W - 2 * M; const bannerH = 30; const yTop = y;
        doc.setFillColor(...([248, 250, 252] as [number, number, number])); doc.roundedRect(M, yTop, bannerW, bannerH, 2, 2, 'F');
        const chipPadX = 3, chipH = 8; doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        const chipW = doc.getTextWidth(chipText) + chipPadX * 2;
        const chipX = M + bannerW - padX - chipW; const chipY = yTop + (bannerH - chipH) / 2;
        const chipColorRgb = (chipColorOk ? [34, 197, 94] : [245, 158, 11]) as [number, number, number];
        doc.setFillColor(chipColorRgb[0], chipColorRgb[1], chipColorRgb[2]); doc.setTextColor(255);
        doc.roundedRect(chipX, chipY, chipW, chipH, 2, 2, 'F');
        const chipTextY = chipY + chipH / 2 + 1.3; doc.text(chipText, chipX + chipPadX, chipTextY);
        doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
        doc.text(metric, M, yTop + bannerH - padY - 5);
        y = yTop + bannerH + 6;
        if (subLines?.length) {
          doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(90);
          doc.text(subLines.map(l => this.normalizeAccents(l)), M, y);
          doc.setTextColor(0); y += subLines.length * 5 + 1;
        }
        doc.setDrawColor(230); doc.line(M, y, W - M, y); y += 6;
      };

      headerBlock(
        this.sigMetric(),
        chip.text,
        chip.ok,
        [
          `Validado em ${new Date((this.result as any)?.validationTime || Date.now()).toLocaleString('pt-BR')}`,
          `Versão do software: ${(this.result as any)?.softwareVersion || '—'}`
        ]
      );

      const MARGIN = M; const WID = W;

      const section = (title: string) => { addPageIfNeeded(14); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text(title, MARGIN, y); y += 7; };

      const para = (text: string, raw = false) => {
        const t = raw ? text : this.normalizeAccents(text);
        const width = WID - 2 * MARGIN;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
        const lines = doc.splitTextToSize(t, width);
        addPageIfNeeded(lines.length * 5 + 2); doc.text(lines, MARGIN, y); y += lines.length * 5 + 2;
      };

      const kvInlineTwoCols = (pairs: Array<[string, string | number]>) => {
        const colW = (WID - 2 * MARGIN) / 2; const rowGap = 4; const labelGap = 2; const lineH = 5;
        const measurePair = (label: string, value: string | number) => {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
          const lblW = Math.min(doc.getTextWidth(this.normalizeAccents(label) + ': '), colW * 0.6);
          const valMaxW = Math.max(8, colW - lblW - labelGap);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
          const lines = doc.splitTextToSize(this.normalizeAccents(String(value ?? '—')), valMaxW);
          const h = Math.max(lineH, lines.length * lineH); return { lblW, valMaxW, lines, h };
        };
        const drawPair = (x: number, label: string, value: string | number, meas?: ReturnType<typeof measurePair>) => {
          const m = meas ?? measurePair(label, value); const labelText = this.normalizeAccents(label) + ': ';
          doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(labelText, x, y);
          doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
          if (m.lines.length) {
            doc.text(m.lines[0], x + m.lblW + labelGap, y);
            for (let i = 1; i < m.lines.length; i++) doc.text(m.lines[i], x + m.lblW + labelGap, y + i * lineH);
          }
          return m.h;
        };
        let i = 0;
        while (i < pairs.length) {
          const L = pairs[i]; const R = pairs[i + 1];
          const mL = L ? measurePair(L[0], L[1]) : { h: 0, lblW: 0, valMaxW: 0, lines: [] as string[] };
          const mR = R ? measurePair(R[0], R[1]) : { h: 0, lblW: 0, valMaxW: 0, lines: [] as string[] };
          const rowH = Math.max(mL.h, mR.h, lineH);
          addPageIfNeeded(rowH + 4);
          if (L) drawPair(MARGIN, L[0], L[1], mL); if (R) drawPair(MARGIN + colW, R[0], R[1], mR);
          y += rowH + rowGap; i += 2;
        }
      };

      const kvFullWidth = (label: string, value: string | number, raw = false) => {
        const GAP = 2; doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
        const lbl = this.normalizeAccents(label) + ': '; const lblW = doc.getTextWidth(lbl);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
        const maxW = WID - 2 * MARGIN - lblW - GAP;

        const textVal = String(value ?? '—');
        const finalText = raw ? textVal : this.normalizeAccents(textVal);

        const lines = doc.splitTextToSize(finalText, maxW);
        addPageIfNeeded(Math.max(5, lines.length * 5) + 4);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.text(lbl, MARGIN, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.text(lines, MARGIN + lblW + GAP, y);
        y += Math.max(5, lines.length * 5) + 4;
      };

      section('Dados do documento');
      const statusValue = ((this.result as any)?.status && String((this.result as any).status).trim()) || ((this.result as any)?.isValid === true ? 'OK' : (this.result as any)?.isValid === false ? 'Inválido' : '—');
      kvFullWidth('Nome do documento', (this.result as any)?.fileName || '—');
      const rowStatusPattern: Array<[string, string | number]> = [['Status', statusValue]];
      const padraoAssinatura = (((this.result as any)?.policy ?? (this.result as any)?.signatureType ?? '') as any).toString().trim();
      if (padraoAssinatura) rowStatusPattern.push(['Padrão de assinatura', padraoAssinatura]);
      kvInlineTwoCols(rowStatusPattern);
      if (pdfValidations && (pdfValidations as any).bornDigital !== undefined) kvInlineTwoCols([['Nato digital', (pdfValidations as any).bornDigital ? 'Sim' : 'Não']]);
      const pdfALabel = (this.result as any)?.validaDocsReturn?.pdfValidations?.isPDFACompliant ? 'Sim' : 'Não';
      const pdfALevel = (this.result as any)?.validaDocsReturn?.pdfValidations?.pdfAStandard || 'Desconhecido';
      kvInlineTwoCols([['PDF/A', pdfALabel], ['Nível do PDF/A', pdfALevel]]);
      hr();

      const drawAssinaturasHeader = (badgeText?: string) => {
        addPageIfNeeded(14); const yTop = y;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.text('Assinaturas', MARGIN, yTop);
        if (badgeText) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
          const textW = doc.getTextWidth(badgeText); doc.text(badgeText, W - MARGIN - textW, yTop);
        }
        y = yTop + 7;
      };
      let headerBadge = '';
      if (sigsList.length === 1) headerBadge = sigsList[0].signatureValid ? 'Válida' : 'Inválida';
      else if (sigsList.length > 1) headerBadge = sigsList.every(s => s.signatureValid) ? 'Todas válidas' : 'Com falhas';
      drawAssinaturasHeader(headerBadge);

      if (sigsList.length === 0) {
        para('Não foram encontradas assinaturas no documento.');
      } else {
        sigsList.forEach((s, idx) => {
          addPageIfNeeded(28);
          const tipoTxt = this.sigTypeLabel(s); const nome = this.displayCN(s) ?? '—';
          const tipoPar = tipoTxt && tipoTxt !== '—' ? ` (${tipoTxt})` : '';
          doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
          const maxW = W - 2 * MARGIN;
          const certTitle = `Certificado ${idx + 1}: ${nome}${tipoPar}`;
          const titleLines = doc.splitTextToSize(this.normalizeAccents(certTitle), maxW);
          doc.text(titleLines, MARGIN, y); y += Math.max(6, titleLines.length * 6);
          const subt = `${(s as any).signatureType ?? ''} ${(s as any).signatureLevel ?? ''}`.trim();
          if (subt) {
            doc.setFont('helvetica', 'normal'); doc.setTextColor(90); doc.setFontSize(11);
            const subLines = doc.splitTextToSize(this.normalizeAccents(subt), maxW);
            doc.text(subLines, MARGIN, y); y += subLines.length * 6; doc.setTextColor(0);
          }
          if ((s as any).signatureTime) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(11);
            doc.text(this.brDateShort((s as any).signatureTime), MARGIN, y); y += 6;
          }
          const certPairs: Array<[string, string | number]> = [];
          const pushIfLocal = (arr: Array<[string, string | number]>, label: string, value?: any) => {
            if (value === undefined || value === null) return;
            const txt = String(value).trim(); if (!txt || txt === '—' || txt === 'Desconhecido') return;
            arr.push([label, txt]);
          };
          pushIfLocal(certPairs, 'CPF/CNPJ', (s as any).cpf);
          pushIfLocal(certPairs, 'Assinado em', this.brDateShort((s as any).signatureTime));
          pushIfLocal(certPairs, 'Emitido em', this.brDateShort((s as any).certificateStartDate));
          pushIfLocal(certPairs, 'Válido até', this.brDateShort((s as any).certificateEndDate));
          const issuer = (s as any).rootIssuer || (s as any).issuer;
          if (issuer) pushIfLocal(certPairs, 'Emissor raiz', this.normalizeAccents(issuer));
          pushIfLocal(certPairs, 'Autoridade', this.authorityOf(s));
          if (certPairs.length) kvInlineTwoCols(certPairs);

          const tsList: any[] =
            (Array.isArray((s as any)?.timeStamps) && (s as any).timeStamps) ||
            (Array.isArray((s as any)?.timestamps) && (s as any).timestamps) ||
            (Array.isArray((s as any)?.timeStampValidations) && (s as any).timeStampValidations) || [];

          if (tsList.length) {
            addPageIfNeeded(14);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Carimbos de tempo', MARGIN, y); y += 6;
            tsList.forEach((ts) => {
              const signer = this.tsSigner(ts); const tsPairs: Array<[string, string | number]> = [];
              const pf = (arr: Array<[string, string | number]>, label: string, value?: any) => {
                if (value === undefined || value === null) return;
                const txt = String(value).trim(); if (!txt || txt === '—' || txt === 'Desconhecido') return;
                arr.push([label, txt]);
              };
              pf(tsPairs, 'Data do carimbo', this.formatDate(this.tsDate(ts)));
              if (signer?.issuer) pf(tsPairs, 'Assinante', this.normalizeAccents(signer.issuer));
              if (signer?.tsa) pf(tsPairs, 'Emissor TSA', this.normalizeAccents(signer.tsa));
              if (signer?.certificateStartDate) pf(tsPairs, 'Emitido em', this.formatDate(signer.certificateStartDate));
              if (signer?.certificateEndDate) pf(tsPairs, 'Válido até', this.formatDate(signer.certificateEndDate));
              if (tsPairs.length) kvInlineTwoCols(tsPairs);
            });
          }

          const tooltip = this.getSignatureTooltip(s as any);
          if (!(s as any).signatureValid && tooltip) { para(`Detalhes da falha: ${tooltip}`); }
          if (idx < sigsList.length - 1) hr(8);
        });
      }

      const shortMsg = (this.shortFinding || '').trim();
      const longMsg = (this.errorFullMessage || '').trim();
      if (shortMsg || longMsg) {
        hr(); section('Apontamentos e notas da validação');
        if (shortMsg) para(shortMsg);
        if (longMsg && longMsg !== shortMsg) para(longMsg);
      }

      // ✅ EXPORTAÇÃO DA I.A. NO PDF
      if (this.aiData) {
        hr();
        section('Análise de IA (Nova)');

        if (this.aiData.documentType) {
          kvFullWidth('Tipo de Documento', this.aiData.documentType, true);
        }
        if (this.aiData.summary) {
          addPageIfNeeded(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
          doc.text('Resumo do Documento:', MARGIN, y); y += 5;
          para(this.aiData.summary, true); y += 2;
        }
        if (this.aiData.signatureType) {
          kvFullWidth('Tipo de Assinatura', this.aiData.signatureType, true);
        }
        if (Array.isArray(this.aiData.signers) && this.aiData.signers.length > 0) {
          addPageIfNeeded(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
          doc.text('Signatários identificados:', MARGIN, y); y += 5; doc.setFont('helvetica', 'normal');
          this.aiData.signers.forEach((signer: string) => {
            const line = signer; const width = WID - 2 * MARGIN;
            const lines = doc.splitTextToSize(line, width);
            addPageIfNeeded(lines.length * 5); doc.text(lines, MARGIN, y); y += lines.length * 5;
          });
          y += 2;
        }
        if (this.aiData.answer) {
          addPageIfNeeded(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
          doc.text('Análise detalhada:', MARGIN, y); y += 5;
          para(this.aiData.answer, true); y += 2;
        }
        if (this.aiData.confidenceNotes) {
          addPageIfNeeded(10); doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
          doc.text('Nota:', MARGIN, y); y += 5;
          para(this.aiData.confidenceNotes, true);
        }
      }

      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(120);
        doc.text(`Gerado por ValidaDocs • ${new Date().toLocaleString('pt-BR')}`, M, H - 6);
        doc.text(`${i} / ${pageCount}`, W - M, H - 6, { align: 'right' }); doc.setTextColor(0);
      }

      const base = this.baseName((this.result as any)?.fileName);
      doc.save(`ValidaDocs_${base}.pdf`);
    } catch (e: any) {
      this.error = 'Falha ao gerar o relatório PDF: ' + (e?.message || e);
      this.errorFullMessage = null; this.showErrorModal = false; console.error('Export PDF error', e);
    } finally {
      this.exporting = false; this.cdr.detectChanges();
    }
  }
}