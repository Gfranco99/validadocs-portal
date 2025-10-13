import { Component, inject } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-token-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-title>Autorização</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="cancel()">Cancelar</ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding blur-backdrop">
      <ion-item>
        <ion-label position="stacked">Token</ion-label>
        <ion-input [(ngModel)]="token" placeholder="Seu token" maxlength="20" inputmode="text"></ion-input>
      </ion-item>

      <ion-button expand="block" color="primary" (click)="confirm()">Validar</ion-button>
    </ion-content>
  `,
  styles: [`
    .blur-backdrop {
      backdrop-filter: blur(8px);
      --background: rgba(255, 255, 255, 0.85);
    }
  `]
})
export class TokenModalComponent {
  token = '';
  private modalCtrl = inject(ModalController);

  cancel() {
    this.modalCtrl.dismiss(null, 'cancel');
  }

  confirm() {
    const cleanToken = this.token.trim();
    if (!cleanToken || !/^[a-zA-Z0-9]+$/.test(cleanToken)) {
      return;
    }
    this.modalCtrl.dismiss(cleanToken, 'confirm');
  }
}
