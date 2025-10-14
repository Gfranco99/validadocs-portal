import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs'; // ✅ inclui map
import { ConfigService } from './config/config.service';

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
   
  private validadocsApi: string;

  constructor(private http: HttpClient, private config: ConfigService) {
    this.validadocsApi = this.config.validadocsApi;
  }

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
        `${this.validadocsApi}/getallcredentials`,
        { params }
      )
      .pipe(map(res => res?.credentials ?? []));
  }

  /** Cria token (envia expiresIn em minutos). */
  createToken(dto: CreateTokenDto): Observable<string | TokenRow | any> {
    return this.http.post(`${this.validadocsApi}/create`, dto, {
      responseType: 'text' as 'json',
    });
  }

  /** Revoga um token pela própria string do token. */
  revokeByToken(token: string): Observable<string | any> {
    return this.http.post(`${this.validadocsApi}/revoke`, { token }, {
      responseType: 'text' as 'json',
    });
  }

  /** Desativa (ou revoga) por ID — ajuste conforme sua API real. */
  deactivateById(id: number): Observable<string | any> {
    return this.http.patch(`${this.validadocsApi}/tokens/${id}`, { is_active: false }, {
      responseType: 'text' as 'json',
    });
  }

  /** Detalhe por ID — ajuste a rota se necessário. */
  getById(id: number): Observable<TokenRow> {
    return this.http.get<TokenRow>(`${this.validadocsApi}/credentials/${id}`);
  }

  // private authHeader(): HttpHeaders {
  //   const access = 'SEU_ACCESS_TOKEN_AQUI';
  //   return new HttpHeaders({ Authorization: `Bearer ${access}` });
  // }
}
