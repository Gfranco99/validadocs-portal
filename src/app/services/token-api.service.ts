import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs'; // ✅ inclui map

/** ===== Tipos ===== */

export interface CreateTokenDto {
  nome: string;
  email: string;
  documento: string;
  telefone: string;
  expiresIn?: number;
  is_active?: boolean;
}

export interface TokenRow {
  id: number;
  user_id: string;
  nome: string;
  email: string;
  documento: string;
  telefone: string;
  token: string;
  created_at: string;
  expires_at?: string | null;
  expiresIn?: number;
  is_active?: boolean;
}

/** ===== Serviço ===== */
@Injectable({ providedIn: 'root' })
export class TokenApiService {
  // ✅ ajuste: base do backend em uso
  private readonly base = 'http://localhost:3000';

  constructor(private http: HttpClient) {}

  /**
   * Lista tokens/credenciais do backend.
   * ✅ ajuste: GET com query params + mapeia { success, credentials }.
   */
  listTokens(opts?: {
    q?: string;
    status?: 'Ativo' | 'Inativo';
    period?: '7d' | '30d' | '90d';
  }): Observable<TokenRow[]> {
    let params = new HttpParams();
    if (opts?.q) params = params.set('q', opts.q);
    if (opts?.status) params = params.set('status', opts.status);
    if (opts?.period) params = params.set('period', opts.period);

    return this.http
      .post<{ success: boolean; credentials: TokenRow[] }>(
        `${this.base}/getallcredentials`,
        { params }
      )
      .pipe(map(res => res?.credentials ?? []));
  }

  /** Cria token (envia expiresIn em minutos). */
  createToken(dto: CreateTokenDto): Observable<string | TokenRow | any> {
    return this.http.post(`${this.base}/create`, dto, {
      responseType: 'text' as 'json',
    });
  }

  /** Revoga um token pela própria string do token. */
  revokeByToken(token: string): Observable<string | any> {
    return this.http.post(`${this.base}/revoke`, { token }, {
      responseType: 'text' as 'json',
    });
  }

  /** Desativa (ou revoga) por ID — ajuste conforme sua API real. */
  deactivateById(id: number): Observable<string | any> {
    return this.http.patch(`${this.base}/tokens/${id}`, { is_active: false }, {
      responseType: 'text' as 'json',
    });
  }

  /** Detalhe por ID — ajuste a rota se necessário. */
  getById(id: number): Observable<TokenRow> {
    return this.http.get<TokenRow>(`${this.base}/credentials/${id}`);
  }

  // private authHeader(): HttpHeaders {
  //   const access = 'SEU_ACCESS_TOKEN_AQUI';
  //   return new HttpHeaders({ Authorization: `Bearer ${access}` });
  // }
}
