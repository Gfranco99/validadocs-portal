import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonGrid, IonRow, IonCol, IonIcon
} from '@ionic/angular/standalone';

import { AuthService } from '../guard/auth.service';
import { TokenModalComponent } from '../components/token-modal/token-modal.component';
import { AlertController, ToastController, LoadingController, ModalController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonicModule, TokenModalComponent,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
    IonContent, IonGrid, IonRow, IonCol, IonIcon
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  startLogin() { this.presentLoginPrompt(); }

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

  async startValidation() {
    if (await this.authService.isLoggedIn()) {
      this.router.navigate(['/validate']);
    } else {
      this.presentTokenPrompt();
    }
  }

  // --- Login via Alert (como você já tinha) ---
  async presentLoginPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Login Administrador',
      message: 'Informe suas credenciais para continuar.',
      cssClass: 'blur-backdrop',
      backdropDismiss: false,
      inputs: [
        { name: 'email', type: 'email', placeholder: 'Digite seu Email' },
        { name: 'password', type: 'password', placeholder: 'Digite sua Senha' }
      ],
      buttons: [
        { text: 'CANCELAR', role: 'cancel', handler: () => { return; } },
        {
          text: 'VALIDAR',
          handler: (data: any) => { 
            const email = (data?.email ?? '').trim();
            const password = (data?.password ?? '').trim();
            if (!email || !password) { this.presentError('Preencha email e senha.'); return false; }
            return data;
          }
        }
      ]
    });

    await alert.present();
    const { role, data } = await alert.onDidDismiss();
    if (role === 'backdrop' || role === 'cancel' || !data) {
      return;
    }

    const loading = await this.loadingController.create({ message: 'Processando...', spinner: 'crescent' });
    await loading.present();

    try {
      // Placeholder de login (substitua pela sua chamada real)
      const response = { valid: true, message: 'Login Efetuado' };
      await loading.dismiss();
      if (response?.valid) this.router.navigate(['/validate']);
      else this.presentError(response?.message || 'Credenciais inválidas. Tente novamente.');
    } catch {
      await loading.dismiss();
      this.presentError('Erro de conexão ao tentar logar. Tente novamente.');
    }
  }

  async presentTokenPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Autorização',
      message: 'Informe a credencial para continuar.',
      cssClass: 'blur-backdrop',
      backdropDismiss: false,
      inputs: [{ name: 'token', type: 'text', placeholder: 'Credencial' }],
      buttons: [
        { text: 'CANCELAR', role: 'cancel', handler: () => { return; } }, 
        { text: 'VALIDAR', handler: (data: any) => this.handleToken((data?.token ?? '').trim()) }
      ]
    });
    await alert.present();
    // (mantenha aqui as restrições de input que você já tinha, se quiser)
  }

  private async handleToken(token: string): Promise<boolean> {
    const _token = (token ?? '').trim();
    if (!_token) return false;

    const loading = await this.loadingController.create({ message: 'Processando...', spinner: 'crescent' });
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

  async presentError(msg: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 5000, color: 'danger' });
    toast.present();
  }
}
