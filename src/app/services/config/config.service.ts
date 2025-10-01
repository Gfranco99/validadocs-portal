import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, firstValueFrom, of } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface AppConfig {
  validadocsApi: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private appConfig?: AppConfig;

  constructor(private http: HttpClient) { }

  loadAppConfig(): Promise<void> {
    return firstValueFrom(
      // 1. Tenta buscar o arquivo de configuração externo (cenário Docker)
      this.http.get<AppConfig>('/assets/config/config.json').pipe(
        catchError((error: HttpErrorResponse) => {
          // 2. Se falhar (404), assume que estamos em ambiente local (ionic serve)
          console.warn(
            `Could not load /assets/config/config.json. ` +
            `Falling back to environment.ts file. This is expected in local development.`
          );
          // 3. Usa a URL do arquivo 'environment' correspondente
          this.appConfig = {
            validadocsApi: environment.validadocsApi
          };
          // Retorna um observable vazio para que a cadeia do Promise continue
          return of(undefined);
        })
      )
    ).then(configFromFile => {
      // 4. Se o arquivo foi carregado com sucesso, usa essa configuração
      if (configFromFile) {
        this.appConfig = configFromFile;
      }
    });
  }

  get validadocsApi(): string {
    if (!this.appConfig) {
      throw new Error('A configuração não foi carregada. Verifique o APP_INITIALIZER.');
    }
    return this.appConfig.validadocsApi;
  }
}