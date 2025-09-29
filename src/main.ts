// 👇 ADICIONE ESTA LINHA AQUI
import './app/manual-bundle-includes';

import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { provideHttpClient } from '@angular/common/http';



if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),    
    provideHttpClient(),   
    provideIonicAngular(), // 👈 aqui você garante ModalController, AlertController etc
  ],
}).catch((err) => console.error(err));
