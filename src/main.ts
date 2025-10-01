import { enableProdMode, APP_INITIALIZER, importProvidersFrom } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from './app/app.routes';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { HttpClientModule, provideHttpClient } from '@angular/common/http';

import { ConfigService } from './app/services/config/config.service';


if (environment.production) {
  enableProdMode();
}

// 1. A factory agora retorna a Promise diretamente.
const appInitializerFactory = (configService: ConfigService) => {
  return () => configService.loadAppConfig();
};

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),    
    provideHttpClient(),   
    provideIonicAngular(), // 👈 aqui você garante ModalController, AlertController etc
    ConfigService,
    {
      provide: APP_INITIALIZER,
      useFactory: (configService: ConfigService) => () => configService.loadAppConfig(),
      deps: [ConfigService],
      multi: true,
    },
  ],
}).catch((err) => console.error(err));
