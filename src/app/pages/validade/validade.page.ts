
import { Component } from '@angular/core';
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
  form: FormGroup;
  file?: File;
  loading = false;
  error?: string;
  result?: ValidationResult;

  constructor(private fb: FormBuilder, private api: ValidationService) {
    this.form = this.fb.group({ file: [null] });
    
  }

  onFileChange(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (file && file.type === 'application/pdf') {
      this.file = file;
      this.error = undefined;
    } else {
      this.file = undefined;
      this.error = 'Selecione um arquivo PDF válido.';
    }
  }

  submit() {
    if (!this.file) { this.error = 'Selecione um PDF para validar.'; return; }
    this.loading = true;
    this.error = undefined;
    this.result = undefined;
    this.api.validatePdf(this.file).subscribe({
      next: (res) => { this.result = res; this.loading = false; },
      error: (err) => { this.error = 'Falha ao validar. Tente novamente.'; this.loading = false; console.error(err); }
    });
  }

  reset() { this.form.reset(); this.file = undefined; this.result = undefined; this.error = undefined; }

  signatureCount() { return this.result?.signatures?.length ?? 0; }
  sigColor(sig: SignatureSummary) { return sig.valid ? 'success' : 'danger'; }

  allValid(): boolean { return !!this.result && this.result.signatures.every(s => s.valid); }
}
