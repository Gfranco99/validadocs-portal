
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { EMPTY, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ValidationResult } from '../types/validation.types';
import { MOCK_VALIDATION } from './mock-validation';

@Injectable({ providedIn: 'root' })
export class ValidationService {
  constructor(private http: HttpClient) {}
  //constructor() {}

  validatePdf(file: File): Observable<ValidationResult> {
    if (environment.apiBase === 'mock') {
      return of(MOCK_VALIDATION).pipe(delay(400));
    }
    //return EMPTY as Observable<ValidationResult>;

    const headers = new HttpHeaders({
      Authorization: 'Token 424B4F58517752616B7573372F6134644463584B5A43426F414A2F6B382B4B357A32546D76727A68466C414239776A4D4134736757767134614D594B50613757',
      // 'Content-Type' deve ser omitido para FormData (será definido automaticamente pelo browser)
    });

    const form = new FormData();
    form.append('file', file, file.name);
    //return this.http.post<ValidationResult>(`${environment.apiBase}/api/VerifyPDF`, form, {headers});
    return this.http.post<ValidationResult>(`${environment.apiBase}`, form, {headers});
  }
}
