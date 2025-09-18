import { Component, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon, IonGrid, IonRow, IonCol
} from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

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
  constructor() {
    this.title.setTitle('ValidaDocs'); // título da aba
  }
}