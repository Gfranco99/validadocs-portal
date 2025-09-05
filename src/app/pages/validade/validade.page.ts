import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ValidationService } from '../../services/validation.service';
import { ValidationResult, SignatureSummary } from '../../types/validation.types';
import {
  IonBadge, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonCol, IonContent, IonGrid, IonHeader, IonIcon, IonInput, IonItem, IonLabel,
  IonList, IonNote, IonProgressBar, IonRow, IonTitle, IonToolbar
} from '@ionic/angular/standalone';

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
    IonGrid, IonRow, IonCol, IonList, IonLabel, IonBadge, IonIcon, IonButtons
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
      next: (res) => { this.result = res; this.loading = false; },
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

  // Helpers
  fileSize(f: File | null | undefined): string {
    if (!f) return '';
    const kb = f.size / 1024;
    return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(2)} MB`;
  }

  signatureCount() { return this.result?.signatures?.length ?? 0; }
  sigColor(sig: SignatureSummary) { return sig.valid ? 'success' : 'danger'; }
  allValid(): boolean { return !!this.result && this.result.signatures.every(s => s.valid); }
}