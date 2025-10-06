import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { IonicModule } from '@ionic/angular';
import { ModalController, AlertController, ToastController, LoadingController } from '@ionic/angular/standalone';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../guard/auth.service';
import { TokenModalComponent } from '../components/token-modal/token-modal.component';
// IMPORTAÇÃO REMOVIDA: Não precisamos mais do LoginModalComponent

@Component({
  selector: 'app-home',
  standalone: true,
  // 1. REMOVEMOS O LoginModalComponent das imports
  imports: [IonicModule, TokenModalComponent], 
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  startLogin() {
    // Agora chama a função de Alerta de volta
    this.presentLoginPrompt(); 
  }
  private title = inject(Title);
  private router = inject(Router);

  constructor(
    private authService: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingController: LoadingController,
    private modalCtrl: ModalController
  ) {
    this.title.setTitle('ValidaDocs');
  }

  // Fluxo principal (botão "Iniciar validação")
  async startValidation() {
    if (await this.authService.isLoggedIn()) {
      this.router.navigate(['/validate']);
    } else {
      this.presentTokenPrompt(); 
    }
  }

  // ===== Modal de Token (Bottom Sheet) - Se você usa ele, mantenha-o. =====
  async presentTokenModal() {
    const modal = await this.modalCtrl.create({
      component: TokenModalComponent,
      breakpoints: [0, 0.5, 1],
      initialBreakpoint: 0.5,
      cssClass: 'custom-modal'
    });

    await modal.present();

    const { data, role } = await modal.onDidDismiss();

    if (role === 'confirm' && data) {
      this.handleToken(String(data ?? ''));
    } else if (role === 'cancel') {
      this.presentError('Autorização cancelada.');
    }
  }

  // ====================================================================
  // ===== FUNÇÃO presentLoginPrompt() - ALERTA COM EMAIL/SENHA =====
  // IGUAL À APARÊNCIA DA IMAGEM, MAS COM DOIS CAMPOS
  // ====================================================================
  async presentLoginPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Autorização', // Título igual ao da imagem
      message: 'Informe suas credenciais para continuar.',
      cssClass: 'blur-backdrop',
      backdropDismiss: false,
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Digite seu Email'
        },
        {
          name: 'password',
          type: 'password',
          placeholder: 'Digite sua Senha'
        }
      ],
      buttons: [
        { 
          text: 'CANCELAR', 
          role: 'cancel', 
          handler: () => { return; } 
        },
        {
          text: 'VALIDAR',
          handler: (data: any) => { 
            const email = (data?.email ?? '').trim();
            const password = (data?.password ?? '').trim();

            if (!email || !password) {
              this.presentError('Preencha email e senha.');
              return false; // Retorna false para manter o alert aberto
            }

            return data; // Retorna dados e fecha o alert
          }
        }
      ]
    });

    await alert.present();

    const { role, data } = await alert.onDidDismiss();

    if (role === 'backdrop' || role === 'cancel' || !data) {
      this.presentError('Autorização cancelada.'); 
      return; 
    }

    const email = data.email;
    const password = data.password;

    const loading = await this.loadingController.create({
      message: 'Processando...',
      spinner: 'crescent'
    });
    await loading.present();

    // >>> LÓGICA DE LOGIN COM ROTA DE NAVEGAÇÃO <<<
    try {
      
      // PLACEHOLDER TEMPORÁRIO (SIMULA SUCESSO)
      const response = { valid: true, message: 'Login Efetuado' }; 

      await loading.dismiss();

      if (response?.valid) {
        this.router.navigate(['/validate']); 
      } else {
        this.presentError(response?.message || 'Credenciais inválidas. Tente novamente.');
      }
      
    } catch (e) {
      await loading.dismiss();
      this.presentError('Erro de conexão ao tentar logar. Tente novamente.');
    }
  }


  // ===== Prompt por Token (Baseado em Alert, idêntico à imagem) =====
  async presentTokenPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Autorização',
      message: 'Informe a credencial para continuar.',
      cssClass: 'blur-backdrop',
      backdropDismiss: false,
      inputs: [
        {
          name: 'token',
          type: 'text',
          placeholder: 'Credencial',
        }
      ],
      buttons: [
        { text: 'CANCELAR', role: 'cancel', handler: () => { return; } }, 
        {
          text: 'VALIDAR',
          handler: (data: any) => this.handleToken((data?.token ?? '').trim())
        }
      ]
    });

    await alert.present();

    // ... (Lógica de restrições de entrada de token - mantida)

    const isInput = (t: EventTarget | null): t is HTMLInputElement =>
      !!t && (t as HTMLElement).tagName === 'INPUT' &&
      (t as HTMLElement).classList.contains('alert-input');

    const isCtrlKey = (k: string) =>
      ['Backspace','Delete','Tab','ArrowLeft','ArrowRight','Home','End'].includes(k) || k.length > 1;

    const clickValidar = () => {
      const btns = Array.from(alert.shadowRoot?.querySelectorAll<HTMLButtonElement>('.alert-button') || []);
      const confirm =
        btns.find(b => (b.textContent || '').trim().toUpperCase() === 'VALIDAR') ||
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
      if (!/^[a-zA-Z0-9]$/.test(ev.key)) ev.preventDefault();
    };

    const onBeforeInput = (ev: InputEvent) => {
      if (!isInput(ev.target)) return;
      const type = ev.inputType;
      const data = (ev as any).data ?? '';

      if (type === 'insertText' && data && !/^[a-zA-Z0-9]$/.test(data)) {
        ev.preventDefault();
        return;
      }

      if (type === 'insertFromPaste' || type === 'insertFromDrop') {
        ev.preventDefault();
        const input = ev.target as HTMLInputElement;
        const raw =
          (type === 'insertFromPaste'
            ? (ev as any)?.clipboardData?.getData?.('text')
            : (ev as any)?.dataTransfer?.getData?.('text')) ?? '';
        const clean = String(raw).replace(/[^a-zA-Z0-9]+/g, '');
        const s = input.selectionStart ?? input.value.length;
        const e = input.selectionEnd ?? input.value.length;
        input.setRangeText(clean, s, e, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    };

    const onPaste = (ev: ClipboardEvent) => {
      if (!isInput(ev.target)) return;
      ev.preventDefault();
      const input = ev.target as HTMLInputElement;
      const raw = ev.clipboardData?.getData('text') ?? '';
      const clean = raw.replace(/[^a-zA-Z0-9]+/g, '');
      const s = input.selectionStart ?? input.value.length;
      const e = input.selectionEnd ?? input.value.length;
      input.setRangeText(clean, s, e, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const onInput = (ev: Event) => {
      if (!isInput(ev.target)) return;
      const input = ev.target as HTMLInputElement;
      const clean = input.value.replace(/[^a-zA-Z0-9]+/g, '');
      if (input.value !== clean) input.value = clean; // sanitiza
    };

    alert.addEventListener('keydown', onKeyDown, true);
    alert.addEventListener('beforeinput', onBeforeInput as any, true);
    alert.addEventListener('paste', onPaste, true);
    alert.addEventListener('input', onInput, true);

    alert.onDidDismiss().then(() => {
      alert.removeEventListener('keydown', onKeyDown, true);
      alert.removeEventListener('beforeinput', onBeforeInput as any, true);
      alert.removeEventListener('paste', onPaste, true);
      alert.removeEventListener('input', onInput, true);
    });
  }

  // ===== Validação final do token + navegação =====
  private async handleToken(token: string): Promise<boolean> {
    const _token = (token ?? '').trim();
    if (!_token) {
      return false;
    }

    const loading = await this.loadingController.create({
      message: 'Processando...',
      spinner: 'crescent',
    });
    await loading.present();

    try {
      const response = await firstValueFrom(this.authService.login(_token));
      await loading.dismiss();

      if (response?.valid) {
        this.router.navigate(['/validate']);
        return true;
      } else {
        this.presentError(response?.message || 'Credencial inválida. Tente novamente.');
        return false;
      }
    } catch {
      await loading.dismiss();
      this.presentError('Erro de conexão. Tente novamente.');
      return false;
    }
  }

  // ===== Toast de erro =====
  async presentError(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 5000,
      color: 'danger'
    });
    toast.present();
  }
}