import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ValidationResult } from '../types/validation.types';
import { ConfigService } from './config/config.service';

interface ErrorDescriptionResponse {
  success: boolean;
  description?: string;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class ValidationService {

  private validadocsApi: string;

  constructor(
    private http: HttpClient,
    private config: ConfigService
  ) {
    // Ex.: http://localhost:3000 ou URL do seu backend
    this.validadocsApi = this.config.validadocsApi;
  }

  validatePdf(file: File): Observable<ValidationResult> {
    const headers = new HttpHeaders({
      Authorization: 'Token 424B4F58517752616B7573372F6134644463584B5A43426F414A2F6B382B4B357A32546D76727A68466C414239776A4D4134736757767134614D594B50613757',
    });

    const form = new FormData();
    form.append('file', file, file.name);
    form.append('userid', localStorage.getItem('userId') || '');
    form.append('engine', localStorage.getItem('engine') || '');

    return this.http.post<ValidationResult>(
      `${this.validadocsApi}/verify`,
      form,
      { headers }
    );
  }

  /**
   * ✅ Chama o app.js na rota /errorDescription/:id
   * Essa rota usa a função getErrorDescriptionById do backend.
   */
  getErrorDescriptionById(id: string): Observable<ErrorDescriptionResponse> {
    return this.http.get<ErrorDescriptionResponse>(
      `${this.validadocsApi}/errorDescription/${id}`
    );
  }
  chamarValidacaoExterna(file: File, idDocumento: string): Observable<any> {
    const urlBackend = `${this.validadocsApi}/consultar-webhook`; 

    // Prepara o formulário para envio de arquivo
    const form = new FormData();
    form.append('file', file, file.name); // 👈 Anexa o PDF
    form.append('idDocumento', idDocumento);

    return this.http.post(urlBackend, form);
  
  }
}
