import { Injectable } from '@angular/core';
import { Observable, of, delay } from 'rxjs';

// ----- Interfaces espelhando o BD -----
export interface DbRow {
  id: number;
  user_id: string;
  nome: string;
  email: string;
  documento: string;
  telefone: string;
  token: string;
  created_at: string;   // ISO
  expires_at: string;   // ISO
  is_active: boolean;
}

// Modelo usado pela tela (poderia usar DbRow direto, mas deixo tipado)
export interface UserTokenView {
  id: number;
  userId: string;
  nome: string;
  email: string;
  documento: string;
  telefone: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  status: 'Ativo' | 'Inativo';
}

@Injectable({ providedIn: 'root' })
export class UserTokenMockService {

  // 🔹 MOCK baseado no print do seu BD (exemplos)
  private rows: DbRow[] = [
    {
      id: 1,
      user_id: 'e5e6ee7c-e2db-4f42-962f-cb173a…',
      nome: 'Guilherme Franco',
      email: 'gfranco@integral.com.br',
      documento: '46205708831',
      telefone: '19993541251',
      token: 'abce28409feb4309ab0b82637a1557f',
      created_at: '2025-10-01T09:22:51.177-03:00',
      expires_at: '2025-10-09T09:37:51.177-03:00',
      is_active: true
    },
    {
      id: 2,
      user_id: '7e266103-9b92-47ba-a731-782b44…',
      nome: 'Guilherme Dias',
      email: 'gfranco@assinaweb.com.br',
      documento: '04446616463',
      telefone: '29993541252',
      token: '18561628996c641a6fae010abba66ee',
      created_at: '2025-06-23T09:35:35.615-03:00',
      expires_at: '2025-06-23T10:35:35.615-03:00',
      is_active: true
    },
    {
      id: 3,
      user_id: '2a2adc68-29f6-442a-9876-22be985…',
      nome: 'Guilherme Henrique',
      email: 'gfranco@albacore.com.br',
      documento: '91306640121',
      telefone: '39993541253',
      token: '8e24c49e866441cdafab01801cb13c',
      created_at: '2025-01-15T11:13:29.523-03:00',
      expires_at: '2025-01-15T11:13:29.523-03:00',
      is_active: false
    },
    // ...adicione mais conforme quiser (pode colar do seu print)
  ];

  // Converte DbRow -> modelo para tela
  private mapToView(r: DbRow): UserTokenView {
    return {
      id: r.id,
      userId: r.user_id,
      nome: r.nome,
      email: r.email,
      documento: r.documento,
      telefone: r.telefone,
      token: r.token,
      createdAt: r.created_at,
      expiresAt: r.expires_at,
      status: r.is_active ? 'Ativo' : 'Inativo'
    };
  }

  // API do mock (simula um loading de 600ms)
  list(): Observable<UserTokenView[]> {
    return of(this.rows.map(this.mapToView)).pipe(delay(600));
  }
}
