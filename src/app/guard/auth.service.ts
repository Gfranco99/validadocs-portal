import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class AuthService {
  getToken() {
      throw new Error('Method not implemented.');
  }
  private apiUrl = 'http://localhost:3000/auth'; // ajuste para sua API
  private loggedIn$ = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient) {}

  // Faz login validando credencial no backend
  login(credential: string): Observable<any> {
    return this.http
      .post<{ success: boolean; message: string; credential: any }>(
        `${this.apiUrl}`,
        { token: credential }
      )
      .pipe(
        map((res) => {
          if (res.success) {
            this.loggedIn$.next(true);
            sessionStorage.setItem('userid', res.credential?.user_id);
            sessionStorage.setItem('isLogged', 'true');
            return { valid: true, message: 'OK' };
          }
          return { valid: false, message: res.message };
        }),
        catchError((ex) => {
          this.loggedIn$.next(false);
          return [
            {
              valid: false,
              message: ex?.message || 'Erro ao conectar ao servidor.',
            },
          ] as any;
        })
      );
  }

  // Desloga o usuário
  logout() {
    this.loggedIn$.next(false);
    sessionStorage.removeItem('isLogged');
    sessionStorage.removeItem('userid');
  }

  // Verifica se já está logado
  isLoggedIn(): boolean {
    return this.loggedIn$.value || sessionStorage.getItem('isLogged') === 'true';
  }
}
