
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { ValidationResult } from '../types/validation.types';
import { MOCK_VALIDATION } from './mock-validation';

@Injectable({ providedIn: 'root' })
export class ValidationService {
  // constructor(private http: HttpClient) {}
  constructor() {}

  validatePdf(file: File): Observable<ValidationResult> {
    if (environment.apiBase === 'mock') {
      return of(MOCK_VALIDATION).pipe(delay(400));
    }
    return EMPTY as Observable<ValidationResult>;

    // const form = new FormData();
    // form.append('file', file, file.name);
    // return this.http.post<ValidationResult>(`${environment.apiBase}/validate`, form);
  }
}
