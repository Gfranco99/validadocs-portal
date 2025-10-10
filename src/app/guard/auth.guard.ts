import { Injectable } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree {
    if (this.auth.isAuthenticated?.() ?? this.auth.isLoggedIn?.()) {
      return true;
    }
    // manda para /home carregando o returnUrl que o usuário tentou acessar
    return this.router.createUrlTree(['/home'], { queryParams: { returnUrl: state.url } });
  }
}