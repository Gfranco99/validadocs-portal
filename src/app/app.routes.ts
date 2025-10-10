import { Routes } from '@angular/router';
import { AuthGuard } from './guard/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },

  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.page').then((m) => m.HomePage),
  },

  {
    path: 'users-tokens',
    loadComponent: () =>
      import('./pages/users-tokens/users-tokens.page').then((m) => m.UsersTokensPage),
    canActivate: [AuthGuard],
  },

  {
    path: 'validate',
    loadComponent: () =>
      import('./pages/validate/validate.page').then((m) => m.ValidatePage),
    canActivate: [AuthGuard],
  },

  // fallback
  {
    path: '**',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];