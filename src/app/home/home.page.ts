import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon, IonGrid, IonRow, IonCol
} from '@ionic/angular/standalone';
import { RouterModule, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { TokenService } from '../services/token.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonIcon, IonGrid, IonRow, IonCol, RouterModule
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  private title = inject(Title);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private tokenService = inject(TokenService);

  constructor() {
    this.title.setTitle('ValidaDocs');
  }

  // Abre o modal e configura: só números + Enter para validar
  async startValidation() {
    const alert = await this.alertCtrl.create({
      header: 'Token de acesso',
      message: 'Informe o token para continuar.',
      cssClass: 'blur-backdrop',   // fundo desfocado (via global.scss)
      backdropDismiss: false,      // não fecha clicando fora
      inputs: [
        {
          name: 'token',
          type: 'number',          // number ajuda em mobile; vamos filtrar no desktop
          placeholder: 'Seu token',
          attributes: {
            autocapitalize: 'off',
            autocorrect: 'off',
            spellcheck: false,
            inputmode: 'numeric',
            pattern: '\\d*',
            enterkeyhint: 'done',
            autocomplete: 'one-time-code',
          }
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Validar',
          handler: (data: any) => this.handleToken((data?.token ?? '').trim())
        }
      ]
    });

    await alert.present();

    // ---------- Delegação de eventos no próprio ion-alert (capturing) ----------
    const isInput = (t: EventTarget | null): t is HTMLInputElement =>
      !!t && (t as HTMLElement).tagName === 'INPUT' &&
      (t as HTMLElement).classList.contains('alert-input');

    const isCtrlKey = (k: string) =>
      ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(k) || k.length > 1;

    const clickValidar = () => {
      const btns = Array.from(alert.shadowRoot?.querySelectorAll<HTMLButtonElement>('.alert-button') || []);
      const confirm =
        btns.find(b => (b.textContent || '').trim().toLowerCase() === 'validar') ||
        (btns.length ? btns[btns.length - 1] : null);
      confirm?.click();
    };

    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        clickValidar();
        return;
      }
      if (!isInput(ev.target)) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (isCtrlKey(ev.key)) return;
      if (!/^\d$/.test(ev.key)) ev.preventDefault(); // BLOQUEIA letras/símbolos
    };

    const onBeforeInput = (ev: InputEvent) => {
      if (!isInput(ev.target)) return;
      const type = ev.inputType;
      const data = (ev as any).data ?? '';

      // Digitação direta: barra se não for dígito
      if (type === 'insertText' && data && !/^\d+$/.test(data)) {
        ev.preventDefault();
        return;
      }

      // Colagem/arrastar: força somente dígitos
      if (type === 'insertFromPaste' || type === 'insertFromDrop') {
        ev.preventDefault();
        const input = ev.target as HTMLInputElement;
        const raw =
          (type === 'insertFromPaste'
            ? (ev as any)?.clipboardData?.getData?.('text')
            : (ev as any)?.dataTransfer?.getData?.('text')) ?? '';
        const digits = String(raw).replace(/\D+/g, '');
        const s = input.selectionStart ?? input.value.length;
        const e = input.selectionEnd ?? input.value.length;
        input.setRangeText(digits, s, e, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    const onPaste = (ev: ClipboardEvent) => {
      if (!isInput(ev.target)) return;
      ev.preventDefault();
      const input = ev.target as HTMLInputElement;
      const raw = ev.clipboardData?.getData('text') ?? '';
      const digits = raw.replace(/\D+/g, '');
      const s = input.selectionStart ?? input.value.length;
      const e = input.selectionEnd ?? input.value.length;
      input.setRangeText(digits, s, e, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const onInput = (ev: Event) => {
      if (!isInput(ev.target)) return;
      const input = ev.target as HTMLInputElement;
      const digits = input.value.replace(/\D+/g, '');
      if (input.value !== digits) input.value = digits; // SANITIZA ESCAPES/IME
    };

    // Registra nos CAPTURING listeners (ficam mesmo se o input interno for trocado)
    alert.addEventListener('keydown', onKeyDown, true);
    alert.addEventListener('beforeinput', onBeforeInput as any, true);
    alert.addEventListener('paste', onPaste, true);
    alert.addEventListener('input', onInput, true);

    // Limpa tudo ao fechar o alerta
    alert.onDidDismiss().then(() => {
      alert.removeEventListener('keydown', onKeyDown, true);
      alert.removeEventListener('beforeinput', onBeforeInput as any, true);
      alert.removeEventListener('paste', onPaste, true);
      alert.removeEventListener('input', onInput, true);
    });
  }

  // Validação final do token + navegação
  private async handleToken(token: string) {
    if (!token || !/^\d+$/.test(token) || !this.tokenService.isValid(token)) {
      const t = await this.toastCtrl.create({
        message: 'Token inválido. Use apenas números.',
        duration: 2500,
        color: 'danger'
      });
      await t.present();
      return false;
    }

    this.tokenService.setToken(token);
    await this.router.navigateByUrl('/validade');
    return true;
  }
}