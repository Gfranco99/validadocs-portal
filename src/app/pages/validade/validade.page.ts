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

// Componente de selo mini (se estiver usando no HTML)
import { SeloValidacaoMiniComponent } from '../../components/selo-validacao-mini.component';

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
      if (!this.loading) this.submit(); // auto-validar
    } else {
      this.file = null;
      this.result = undefined;
      this.error = 'Selecione um arquivo PDF válido.';
    }

    // permite selecionar o mesmo arquivo novamente
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

    const toValidate = this.file!;
    this.api.validatePdf(toValidate).subscribe({
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

  // Badge de status da assinatura (inclui "warning" se houver alerta sem erro)
  sigColor(sig: SignatureInfo): 'success' | 'danger' | 'warning' | 'medium' {
    if (sig.signatureValid) return 'success';
    if (!sig.signatureValid && !sig.signatureErrors && !!sig.signatureAlerts) return 'warning';
    return 'danger';
  }

  // TrackBy pra estabilizar a lista no *ngFor
  trackByName = (_: number, s: SignatureInfo) =>
    (s.endCertSubjectName ?? '') + '|' + (s.cpf ?? '');

  allValid(): boolean {
    const sigs = this.result?.validaDocsReturn?.digitalSignatureValidations ?? [];
    return sigs.length > 0 && sigs.every(s => s.signatureValid);
  }
}