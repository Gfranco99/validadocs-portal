import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'https://localhost:3000/auth'; // ajuste para sua API
  private loggedIn$ = new BehaviorSubject<boolean>(false);

  constructor(private http: HttpClient) {}

  // Faz login validando credencial no backend
  login(credential: string): Observable<boolean> {
    return this.http.post<{ valid: boolean }>(`${this.apiUrl}`, { credential })
      .pipe(
        map(res => {
          if (res.valid) {
            this.loggedIn$.next(true);
            sessionStorage.setItem('isLogged', 'true');
            return true;
          }
          return false;
        }),
        catchError(() => {
          this.loggedIn$.next(false);
          return [false];
        })
      );
  }

  // Desloga o usuário
  logout() {
    this.loggedIn$.next(false);
    sessionStorage.removeItem('isLogged');
  }

  // Verifica se já está logado
  isLoggedIn(): boolean {
    return this.loggedIn$.value || sessionStorage.getItem('isLogged') === 'true';
  }
}
