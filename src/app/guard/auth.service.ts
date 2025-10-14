import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ConfigService } from '../services/config/config.service';

interface LoginResponse {
  success: boolean;
  error?: string;
  access_token?: string;
}

interface TokenLoginResult {
  valid: boolean;
  message: string;
  access_token?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenKey = 'vd_auth';
  private validadocsApi: string;
  private loggedIn$ = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient, private config: ConfigService) {
    this.validadocsApi = this.config.validadocsApi;
    const hasToken = !!localStorage.getItem(this.tokenKey);
    const wasLogged = sessionStorage.getItem('isLogged') === 'true';
    this.loggedIn$.next(hasToken || wasLogged);
  }

  // ====================== LOGIN (email/senha) ======================
  login(email: string, password: string): Observable<LoginResponse> {
    const url = `${this.validadocsApi}/login`;
    const body = { email, password };

    console.log('[auth] POST', url, 'payload:', body);

    return this.http.post<LoginResponse>(url, body).pipe(
      map((res) => {
        console.log('[auth] response (login):', res);
        if (res?.success && res?.access_token) {
          this.saveToken(res.access_token);
          this.loggedIn$.next(true);
          sessionStorage.setItem('isLogged', 'true');
          return res;
        }
        throw new Error(res?.error || 'Falha na autenticação.');
      }),
      catchError((ex) => {
        const msg = ex?.error?.message || ex?.message || 'Erro ao conectar ao servidor.';
        console.error('[auth] login error:', ex);
        throw new Error(msg);
      })
    );
  }

  // ====================== LOGIN via TOKEN ==========================
  // Envia "token" e "credential" juntos para compatibilidade com o backend.
  loginWithToken(token: string): Observable<TokenLoginResult> {
    const url = `${this.validadocsApi}/auth`;
    const body = { token, credential: token };

    console.log('[auth] POST', url, 'payload:', body);

    return this.http
      .post<{ success: boolean; message?: string; access_token?: string }>(url, body)
      .pipe(
        map((res) => {
          console.log('[auth] response (loginWithToken):', res);
          if (res?.success) {
            this.loggedIn$.next(true);
            sessionStorage.setItem('isLogged', 'true');
            if (res.access_token) this.saveToken(res.access_token);
            return { valid: true, message: 'OK', access_token: res.access_token };
          }
          return { valid: false, message: res?.message ?? 'Falha na autenticação.' };
        }),
        catchError((ex) => {
          const msg = ex?.error?.message || ex?.message || 'Erro ao conectar ao servidor.';
          console.error('[auth] loginWithToken error:', ex);
          return of({ valid: false, message: msg });
        })
      );
  }

  // ====================== HELPERS =================================
  saveToken(access_token: string) {
    try {
      localStorage.setItem(this.tokenKey, access_token);
    } catch (e) {
      console.warn('[auth] saveToken failed:', e);
    }
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenKey) || this.isLoggedIn();
  }

  isLoggedIn(): boolean {
    return this.loggedIn$.value || sessionStorage.getItem('isLogged') === 'true';
  }

  logout() {
    this.loggedIn$.next(false);
    sessionStorage.removeItem('isLogged');
    sessionStorage.removeItem('userid');
    localStorage.removeItem(this.tokenKey);
  }
}
