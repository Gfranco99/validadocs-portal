import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ConfigService } from '../services/config/config.service';

interface LoginResponse {
  access_token: string;               // campo do token
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

  // ===========================================================================
  //  [ANTIGA] pega do back
  // ---------------------------------------------------------------------------
  // login(email: string, password: string): Observable<LoginResponse> {
  //   return this.http
  //     .post<LoginResponse>(`${this.validadocsApi}/auth/login`, { email, password })
  //     .pipe(
  //       map((res) => {
  //         this.saveToken(res.access_token);
  //         this.loggedIn$.next(true);
  //         sessionStorage.setItem('isLogged', 'true');
  //         return res;
  //       }),
  //       catchError((ex) => {
  //         const msg = ex?.error?.message || ex?.message || 'Erro ao conectar ao servidor.';
  //         throw new Error(msg);
  //       })
  //     );
  // }

  //  [NOVA]
  // --------------------------------------------------------------------------------------------
  login(email: string, password: string): Observable<LoginResponse> {
    // 👉 Se o backend espera username/senha:
    // const body = { username: email, password };
    // 👉 Se o backend espera email/senha (default abaixo):
    const body = { email, password };

    return this.http
      .post<LoginResponse>(`${this.validadocsApi}/auth`, body /*, { withCredentials: true }*/)
      .pipe(
        map((res) => {
          // salva token e flags de sessão
          this.saveToken(res.access_token);
          this.loggedIn$.next(true);
          sessionStorage.setItem('isLogged', 'true');
          return res;
        }),
        catchError((ex) => {
          const msg = ex?.error?.message || ex?.message || 'Erro ao conectar ao servidor.';
          throw new Error(msg);
        })
      );
  }
  // ===========================================================================

  // Login via token -> retorna { valid, message, access_token? }
  loginWithToken(token: string): Observable<TokenLoginResult> {
    return this.http
      .post<{ success: boolean; message?: string; access_token?: string; credential?: any }>(
        `${this.validadocsApi}/auth`,
        { token }
      )
      .pipe(
        map((res) => {
          if (res.success) {
            this.loggedIn$.next(true);
            sessionStorage.setItem('isLogged', 'true');
            if (res.access_token) this.saveToken(res.access_token);
            return { valid: true, message: 'OK', access_token: res.access_token };
          }
          return { valid: false, message: res.message ?? 'Falha na autenticação.' };
        }),
        catchError((ex) =>
          of({
            valid: false,
            message: ex?.error?.message || ex?.message || 'Erro ao conectar ao servidor.',
          })
        )
      );
  }

  saveToken(access_token: string) {
    localStorage.setItem(this.tokenKey, access_token);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenKey) || this.isLoggedIn();
  }

  logout() {
    this.loggedIn$.next(false);
    sessionStorage.removeItem('isLogged');
    sessionStorage.removeItem('userid');
    localStorage.removeItem(this.tokenKey);
  }

  isLoggedIn(): boolean {
    return this.loggedIn$.value || sessionStorage.getItem('isLogged') === 'true';
  }
}
