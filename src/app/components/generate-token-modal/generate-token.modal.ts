import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
  IonItem, IonLabel, IonInput, IonToggle, IonCard, IonCardContent
} from '@ionic/angular/standalone';
import { TokenApiService, CreateTokenDto, TokenRow } from '../../services/token-api.service';
import { ModalController, ToastController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

@Component({
  standalone: true,
  selector: 'app-generate-token-modal',
  imports: [
    CommonModule, ReactiveFormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent,
    IonItem, IonLabel, IonInput, IonToggle, IonCard, IonCardContent
  ],
  template: `
  <ion-header>
    <ion-toolbar>
      <ion-title>Gerar Token</ion-title>
      <ion-buttons slot="end">
        <ion-button (click)="close()">Fechar</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>

  <ion-content class="ion-padding">
    <form [formGroup]="form" (ngSubmit)="submit()" *ngIf="!generatedToken">
      <ion-item>
        <ion-label position="stacked">Nome</ion-label>
        <ion-input formControlName="nome" type="text" required />
      </ion-item>

      <ion-item>
        <ion-label position="stacked">Email</ion-label>
        <ion-input formControlName="email" type="email" required />
      </ion-item>

      <ion-item>
        <ion-label position="stacked">Documento</ion-label>
        <ion-input formControlName="documento" maxlength="20" required />
      </ion-item>

      <ion-item>
        <ion-label position="stacked">Telefone</ion-label>
        <ion-input formControlName="telefone" maxlength="20" />
      </ion-item>

      <ion-item>
        <ion-label position="stacked">Validade (minutos)</ion-label>
        <ion-input formControlName="expires_in_minutes" type="number" min="1" step="1" />
      </ion-item>

      <ion-item>
        <ion-label>Ativo</ion-label>
        <ion-toggle formControlName="is_active" />
      </ion-item>

      <div class="actions">
        <ion-button type="submit" [disabled]="form.invalid || loading" expand="block">
          {{ loading ? 'Gerando...' : 'Gerar' }}
        </ion-button>
      </div>
    </form>

    <!-- Mostra SOMENTE o token -->
    <ion-card *ngIf="generatedToken" class="result">
      <ion-card-content>
        <div class="title">Token gerado</div>
        <div class="token mono">{{ generatedToken }}</div>
        <div class="row">
          <ion-button fill="outline" (click)="copyToken()">Copiar</ion-button>
          <ion-button (click)="finish()">Concluir</ion-button>
        </div>
      </ion-card-content>
    </ion-card>
  </ion-content>
  `,
  styles: [`
    .actions { margin-top: 12px; }
    ion-item { --inner-padding-bottom: 6px; }
    .result { margin-top: 12px; }
    .title { font-weight: 600; margin-bottom: 6px; }
    .token { font-size: 0.95rem; padding: 10px; border-radius: 8px; background: var(--ion-color-step-100); }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .row { margin-top: 10px; display: flex; gap: 8px; }
  `]
})
export class GenerateTokenModalComponent {
  private fb = inject(FormBuilder);
  private api = inject(TokenApiService);
  private modal = inject(ModalController);
  private toast = inject(ToastController);

  loading = false;
  generatedToken: string | null = null;
  lastCreatedRow?: TokenRow | any;
  lastForm?: CreateTokenDto;

  form = this.fb.group({
    nome: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    documento: ['', [Validators.required]],
    telefone: [''],
    expires_in_minutes: [60, [Validators.min(1)]],
    is_active: [true]
  });

  close() { this.modal.dismiss(); }

  async submit() {
    if (this.form.invalid || this.loading) return;
    this.loading = true;

    const dto = this.form.value as unknown as CreateTokenDto;
    this.lastForm = dto;

    try {
      const created = await firstValueFrom(this.api.createToken(dto));
      this.lastCreatedRow = created;

      // ✅ NOVO: função que extrai o token de qualquer formato (string JSON, objeto, etc.)
      this.generatedToken = this.extractToken(created);

      const t = await this.toast.create({
        message: this.generatedToken ? 'Token gerado com sucesso!' : 'Token criado.',
        duration: 1800, color: 'success'
      });
      t.present();

    } catch (e: any) {
      const msg = e?.error?.message || e?.message || 'Falha ao gerar token.';
      const t = await this.toast.create({ message: msg, duration: 3500, color: 'danger' });
      t.present();
    } finally {
      this.loading = false;
    }
  }

  // ✅ NOVO: extrai só o token, mesmo se a API devolver string JSON
  private extractToken(res: any): string {
    try {
      // se veio string, pode ser token puro OU JSON serializado
      if (typeof res === 'string') {
        const s = res.trim();
        if (s.startsWith('{') || s.startsWith('[')) {
          const obj = JSON.parse(s);
          return (
            obj?.token ??
            obj?.data?.token ??
            obj?.credential?.token ?? // <== pelo seu print
            obj?.result?.token ??
            obj?.access_token ??
            ''
          );
        }
        return s; // texto puro já é o token
      }
      // objeto JSON
      return (
        res?.token ??
        res?.data?.token ??
        res?.credential?.token ?? // <== pelo seu print
        res?.result?.token ??
        res?.access_token ??
        ''
      );
    } catch {
      return '';
    }
  }

  async copyToken() {
    if (!this.generatedToken) return;
    await navigator.clipboard?.writeText(this.generatedToken);
    const t = await this.toast.create({ message: 'Token copiado.', duration: 1200, color: 'tertiary' });
    t.present();
  }

  finish() {
    this.modal.dismiss({ created: this.lastCreatedRow, form: this.lastForm }, 'ok');
  }
}
