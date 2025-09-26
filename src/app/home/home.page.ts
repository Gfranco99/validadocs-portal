import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon, IonGrid, IonRow, IonCol
} from '@ionic/angular/standalone';
import { RouterModule, Router } from '@angular/router';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../guard/auth.service';

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
  private loadingController = inject(LoadingController);
   
  
  constructor(
    private authService: AuthService,
  ) {
    this.title.setTitle('ValidaDocs');
  }

  // Abre o modal
  async startValidation() {

    //Verifica usuário logado
    if(await this.authService.isLoggedIn()) {
      this.router.navigate(['/validate']); // rota protegida          
    }  
    else {
      this.presentTokenPrompt();
    }           
  }


  // Prompt para inserir token
  async presentTokenPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Autorização',
      message: 'Informe o token para continuar.',
      cssClass: 'blur-backdrop',   // fundo desfocado (via global.scss)
      backdropDismiss: false,      // não fecha clicando fora
      inputs: [
        {
          name: 'token',
          type: 'text',          // number ajuda em mobile; vamos filtrar no desktop
          placeholder: 'Seu token',
          // attributes: {
          //   autocapitalize: 'off',
          //   autocorrect: 'off',
          //   spellcheck: false,
          //   //inputmode: 'numeric',
          //   //pattern: '\\d*',
          //   enterkeyhint: 'done',
          //   autocomplete: 'one-time-code',
          // }
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
      if (!/^[a-zA-Z0-9]$/.test(ev.key)) ev.preventDefault(); 
    };

    const onBeforeInput = (ev: InputEvent) => {
      if (!isInput(ev.target)) return;
      const type = ev.inputType;
      const data = (ev as any).data ?? '';

      // Digitação direta: barra se não for dígito
      if (type === 'insertText' && data && !/^[a-zA-Z0-9]$/.test(data)) {
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
        const digits = String(raw).replace(/[^a-zA-Z0-9]+/g, '');
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
      const digits = raw.replace(/[^a-zA-Z0-9]+/g, '');
      const s = input.selectionStart ?? input.value.length;
      const e = input.selectionEnd ?? input.value.length;
      input.setRangeText(digits, s, e, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const onInput = (ev: Event) => {
      if (!isInput(ev.target)) return;
      const input = ev.target as HTMLInputElement;
      const digits = input.value.replace(/[^a-zA-Z0-9]+/g, '');
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
    // token vazio → não fecha
    const _token = (token ?? '').trim();
          if (!token) {            
            // token vazio → não fecha
            return false;
          }

    // Mostra loading enquanto valida
    const loading = await this.loadingController.create({
      message: 'Processando...',
      spinner: 'crescent', // ou 'dots', 'lines', etc.
      duration: 3000 // opcional
    });
    await loading.present();

    // Chama o serviço de autenticação
    const response = await this.authService.login(token).toPromise();
    
    await loading.dismiss();

    // Verifica o resultado
    if (response.valid) {
      // sucesso → fecha o alert
      this.router.navigate(['/validate']); // rota protegida
      return true;
    } else {
      // falha → mostra mensagem e mantém aberto
      this.presentError(response.message || 'Credencial inválida. Tente novamente.');      
      return false;
    }
  }


  // método auxiliar para mostrar mensagem de erro no próprio Alert
  async presentError(msg: string) {
    const toast = await this.toastCtrl.create({
      message: msg,
      duration: 5000,
      color: 'danger'
    });
    toast.present();
  }
}