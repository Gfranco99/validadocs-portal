import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface ErrorMappingResponse {
  idErro: string;
  shortMsgPTBR?: string;
  shortMsgENUS?: string;
  userInstructionsPTBR?: string;
  userInstructionsENUS?: string;
}

/** Estrutura pronta para o front */
export interface ErrorMessagesPTBR {
  shortMsg: string;
  instructions: string;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorMappingService {

  private baseUrl = 'https://homol2.validadocs.com.br/api/ErrorsMapping';

  constructor(private http: HttpClient) {}

  /** 
   * 🔹 Busca bruta da API retornando tudo
   * Ex.: /id/ForbiddenSignedAttributePresent
   */
  getErrorById(errorId: string): Observable<ErrorMappingResponse> {
    return this.http.get<ErrorMappingResponse>(`${this.baseUrl}/id/${errorId}`);
  }

  /**
   * 🔹 Retorna somente o que o front precisa exibir:
   *    - shortMsgPTBR
   *    - userInstructionsPTBR
   *
   * Já garantindo que NUNCA vem undefined.
   */
  getMessagesPTBR(errorId: string): Observable<ErrorMessagesPTBR> {
    return this.http
      .get<ErrorMappingResponse>(`${this.baseUrl}/id/${errorId}`)
      .pipe(
        map(res => ({
          shortMsg: res.shortMsgPTBR?.trim() || '',
          instructions: res.userInstructionsPTBR?.trim() || ''
        })),
        catchError(() =>
          of({
            shortMsg: '',
            instructions: ''
          } as ErrorMessagesPTBR)
        )
      );
  }
}
