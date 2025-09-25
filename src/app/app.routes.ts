import { Routes } from '@angular/router';
import { AuthGuard } from './guard/auth.guard';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
  {
    path: 'validate',
    loadComponent: () => import('./pages/validate/validate.page').then( m => m.ValidatePage),
    canActivate: [AuthGuard] // 🚨 guard aplicado
  }
];
