/* ============================================================================
 * INÍCIO DO COMPONENTE: LoginModalComponent (standalone, estilo "cartão")
 * Descrição: Modal com formulário reativo de e-mail + senha, layout igual ao print.
 * ========================================================================== */
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule, ModalController } from '@ionic/angular';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login-modal',
  standalone: true,
  imports: [CommonModule, IonicModule, ReactiveFormsModule],
  template: `
  <!-- ===================== INÍCIO: HEADER ===================== -->
  <ion-header>
    <ion-toolbar>
      <ion-title>Informe suas credenciais</ion-title>
      <ion-buttons slot="end">
        <ion-button (click)="onCancel()" fill="clear">Fechar</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-header>
  <!-- ====================== FIM: HEADER ======================= -->

  <!-- ===================== INÍCIO: CONTENT ==================== -->
  <ion-content class="ion-padding">
    <form [formGroup]="form" (ngSubmit)="onConfirm()" novalidate>
      <!-- INÍCIO: Campo E-mail -->
      <div class="field">
        <label class="label">E-mail</label>
        <ion-input
          formControlName="email"
          type="email"
          inputmode="email"
          autocomplete="email"
          placeholder="seu@email.com"
          class="boxed">
        </ion-input>
        <ion-note *ngIf="form.controls.email.touched && form.controls.email.invalid" color="danger" class="hint">
          Informe um e-mail válido.
        </ion-note>
      </div>
      <!-- FIM: Campo E-mail -->

      <!-- INÍCIO: Campo Senha -->
      <div class="field">
        <label class="label">Senha</label>
        <div class="pwd-row">
          <ion-input
            formControlName="password"
            [type]="showPwd() ? 'text' : 'password'"
            autocomplete="current-password"
            placeholder="Sua senha"
            class="boxed flex-1">
          </ion-input>
          <ion-button fill="clear" size="small" (click)="toggleShowPwd()" type="button" class="pwd-toggle">
            {{ showPwd() ? 'Ocultar' : 'Mostrar' }}
          </ion-button>
        </div>
        <ion-note *ngIf="form.controls.password.touched && form.controls.password.invalid" color="danger" class="hint">
          A senha deve ter ao menos 6 caracteres.
        </ion-note>
      </div>
      <!-- FIM: Campo Senha -->
    </form>
  </ion-content>
  <!-- ====================== FIM: CONTENT ====================== -->

  <!-- ===================== INÍCIO: FOOTER ===================== -->
  <ion-footer class="footer-actions">
    <ion-toolbar>
      <ion-buttons slot="end">
        <ion-button color="medium" (click)="onCancel()" type="button">Cancelar</ion-button>
        <ion-button color="primary" (click)="onConfirm()" [disabled]="form.invalid" type="submit">Entrar</ion-button>
      </ion-buttons>
    </ion-toolbar>
  </ion-footer>
  <!-- ====================== FIM: FOOTER ======================= -->
  `,
  styles: [`
    /* ===================== INÍCIO: ESTILOS ===================== */
    :host { display: block; }

    /* Espaçamentos do formulário */
    .field { margin-bottom: 14px; }
    .label {
      display: block;
      font-size: 0.9rem;
      margin-bottom: 6px;
      color: var(--ion-color-step-700, #2b2b2b);
    }
    .hint { margin-top: 6px; display: block; }

    /* Linha com botão "Mostrar/Ocultar" */
    .pwd-row { display: flex; gap: 8px; align-items: center; }
    .flex-1 { flex: 1 1 auto; }

    /* Aparência "caixa" dos inputs (igual ao print) */
    .boxed {
      /* variables do IonInput */
      --padding-start: 10px;
      --padding-end: 10px;
      --padding-top: 8px;
      --padding-bottom: 8px;
      --background: #fff;
      --color: var(--ion-color-step-850, #1e1e1e);

      /* borda "retângulo" */
      border: 1px solid rgba(0,0,0,0.2);
      border-radius: 4px;
      box-shadow: none;
      height: 44px;
      display: flex;
      align-items: center;
    }

    /* Foco com cor do tema primário */
    .boxed:focus-within {
      border-color: var(--ion-color-primary);
      outline: 2px solid color-mix(in srgb, var(--ion-color-primary) 25%, transparent);
      outline-offset: 0;
    }

    /* Footer com ações alinhadas à direita */
    .footer-actions ion-toolbar {
      --background: #fff;
      border-top: 1px solid rgba(0,0,0,0.06);
    }
    /* ====================== FIM: ESTILOS ====================== */
  `]
})
export class LoginModalComponent {
  /* ---------------- INÍCIO: Injeções/estado interno ----------- */
  private modalCtrl = inject(ModalController);
  private fb = inject(FormBuilder);

  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  showPwd = signal(false);
  toggleShowPwd() { this.showPwd.update(v => !v); }
  /* ------------------ FIM: Injeções/estado interno ------------ */

  /* ------------------ INÍCIO: Ações do modal ------------------ */
  async onCancel() { await this.modalCtrl.dismiss(null, 'cancel'); }
  async onConfirm() {
    if (this.form.invalid) return;
    await this.modalCtrl.dismiss(this.form.value, 'confirm'); // {email, password}
  }
  /* ------------------- FIM: Ações do modal -------------------- */
}
/* ============================================================================
 * FIM DO COMPONENTE: LoginModalComponent
 * ========================================================================== */
