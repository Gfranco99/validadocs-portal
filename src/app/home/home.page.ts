import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import {
  IonButton, IonContent, IonGrid, IonRow, IonCol, IonIcon
} from '@ionic/angular/standalone';

import { AuthService } from '../guard/auth.service';
// ❌ REMOVIDO: TokenModalComponent (não está sendo usado)
// import { TokenModalComponent } from '../components/token-modal/token-modal.component';
import { AlertController, ToastController, LoadingController } from '@ionic/angular/standalone';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    IonicModule
  ],
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
})
export class HomePage {
  private title = inject(Title);
  private router = inject(Router);

  constructor(
    private authService: AuthService,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private loadingController: LoadingController,
    // ❌ REMOVIDO: private modalCtrl: ModalController
  ) {
    this.title.setTitle('ValidaDocs');
  }

  startLogin() {
    this.presentLoginPrompt();
  }

  async startValidation() {
    if (this.authService.isAuthenticated()) {
      // ✅ se já autenticado, vai direto para /validate
      await this.router.navigateByUrl('/validate', { replaceUrl: true });
    } else {
      // pede token para validar
      this.presentTokenPrompt();
    }
  }

  // ---- Login via Alert (email/senha) ----
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
          text: 'ENTRAR',
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
    if (role === 'backdrop' || role === 'cancel' || !data) return;

    const loading = await this.loadingController.create({ message: 'Processando...', spinner: 'crescent' });
    await loading.present();

    try {
      await firstValueFrom(this.authService.login(data.email, data.password));
      // ✅ pós-login admin: ir para /users-tokens
      await this.router.navigateByUrl('/users-tokens', { replaceUrl: true });
    } catch (ex) {
      this.presentError('Falha no login. Verifique seus dados de acesso.');      
    } finally {
      await loading.dismiss(); // ✅ garante dismiss mesmo com erro
    }
  }

  // ---- Login via Token (para iniciar validação) ----
  async presentTokenPrompt() {
    const alert = await this.alertCtrl.create({
      header: 'Autorização',
      message: 'Informe a credencial (token).',
      cssClass: 'blur-backdrop',
      backdropDismiss: false,
      inputs: [{ name: 'token', type: 'text', placeholder: 'Token de acesso' }],
      buttons: [
        { text: 'CANCELAR', role: 'cancel', handler: () => { return; } },
        { text: 'VALIDAR', handler: (data: any) => this.handleToken((data?.token ?? '').trim()) }
      ]
    });
    await alert.present();
  }

  private async handleToken(token: string): Promise<boolean> {
    const _token = (token ?? '').trim();
    if (!_token) return false;

    const loading = await this.loadingController.create({ message: 'Processando...', spinner: 'crescent' });
    await loading.present();

    try {
      const res = await firstValueFrom(this.authService.loginWithToken(_token));
      if (res.valid) {
        // ✅ pós-login via token: ir para /validate (não /users-tokens)
        await this.router.navigateByUrl('/validate', { replaceUrl: true });
        return true;
      } else {
        this.presentError(res.message);
        return false;
      }
    } catch {
      this.presentError('Credencial inválida. Tente novamente.');
      return false;
    } finally {
      await loading.dismiss();
    }
  }

  private async presentError(msg: string) {
    const toast = await this.toastCtrl.create({ message: msg, duration: 5000, color: 'danger' });
    toast.present();
  }
}
