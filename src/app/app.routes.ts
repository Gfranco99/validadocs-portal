import { Routes } from '@angular/router';
import { TokenGuard } from './services/token.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },

  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.page').then(m => m.HomePage),
  },

  {
    path: 'validade',
    loadComponent: () =>
      import('./pages/validade/validade.page').then(m => m.ValidadePage),
    canActivate: [TokenGuard],
  },

  {
  path: 'token',
  loadComponent: () => import('./pages/token/token.page').then(m => m.TokenPage)
  },

  { path: '**', redirectTo: 'home' },
];
