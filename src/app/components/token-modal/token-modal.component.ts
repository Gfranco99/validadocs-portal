import { CommonModule } from '@angular/common';
import { Component, inject, NgModule, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ModalController } from '@ionic/angular/standalone';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-token-modal',  
  imports: [
    CommonModule,
    FormsModule,   
    IonicModule     
  ],
  standalone: true,   // 👈 importante no Angular standalone
  templateUrl: './token-modal.component.html',
  styleUrls: ['./token-modal.component.scss'],
})
export class TokenModalComponent {
  token = '';
  constructor(private modalCtrl: ModalController) {}

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

