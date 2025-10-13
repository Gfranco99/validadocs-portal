import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

/** DTO de criação: usa expiresIn (minutos) e telefone como string */
export interface CreateTokenDto {
  nome: string;
  email: string;
  documento: string;
  telefone: string;     // ✅ ajustado para string
  expiresIn?: number;   // ✅ trocado para expiresIn (minutos)
  is_active?: boolean;
}

/** Modelo que seu backend pode retornar */
export interface TokenRow {
  id: number;
  user_id: string;
  nome: string;
  email: string;
  documento: string;
  telefone: string;      // ✅ ajustado para string
  token: string;
  created_at: string;
  expires_at?: string;   // ✅ costuma vir como ISO; mantive opcional
  is_active?: boolean;   // ✅ opcional, se o backend enviar
}

@Injectable({ providedIn: 'root' })
export class TokenApiService {
  private readonly base = 'http://62.171.128.216:3000';   // ✅ base única

  constructor(private http: HttpClient) {}

  /**
   * Cria token: envia exatamente expiresIn (minutos).
   * responseType 'text' permite a API responder com string pura (apenas o token)
   * ou JSON (objeto com token/credential etc.).
   */
  createToken(dto: CreateTokenDto): Observable<string | TokenRow | any> {
    return this.http.post(`${this.base}/create`, dto, {
      responseType: 'text' as 'json',
      // withCredentials: true, // habilite se a API usar cookies de sessão
      // headers: this.authHeader(), // habilite se precisar de Authorization
    });
  }

  /**
   * Revoga token pela string do token (se o backend expõe /revoke).
   */
  revokeByToken(token: string): Observable<string | any> {
    return this.http.post(`${this.base}/revoke`, { token }, {
      responseType: 'text' as 'json',
      // withCredentials: true,
      // headers: this.authHeader(),
    });
  }

  /**
   * Desativa token por ID (se o backend usa /tokens/:id).
   */
  deactivateById(id: number): Observable<string | any> {
    return this.http.patch(`${this.base}/tokens/${id}`, { is_active: false }, {
      responseType: 'text' as 'json',
      // withCredentials: true,
      // headers: this.authHeader(),
    });
  }

  // Se precisar Authorization:
  // private authHeader(): HttpHeaders {
  //   const access = 'SEU_ACCESS_TOKEN_AQUI';
  //   return new HttpHeaders({ Authorization: `Bearer ${access}` });
  // }
}
