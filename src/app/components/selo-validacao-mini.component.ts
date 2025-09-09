import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-selo-mini',
  standalone: true,
  imports: [CommonModule],
  template: `
  <div class="selo-mini" [class.invalido]="status === 'INVÁLIDO'">
    <div class="sm-top">
      <span class="sm-title" title="ASSINATURA ELETRÔNICA">ASSINATURA ELETRÔNICA</span>
      <span class="sm-sub" [title]="tipo">{{ tipo || 'AVANÇADA' }}</span>
      <span class="sm-meta" *ngIf="tipoAssinatura" [title]="'Tipo: ' + tipoAssinatura">
        Tipo: {{ tipoAssinatura }}
      </span>
    </div>

    <div class="sm-middle">
      <div class="sm-left">
        <img [src]="logoSrc" alt="ValidaDocs" (error)="onImgErr($event)" />
      </div>
      <div class="sm-right">
        <span class="sm-conf">Conforme</span>
        <span class="sm-lei">{{ lei }}</span>
      </div>
    </div>

    <!-- Rodapé mostra a política da assinatura -->
    <div class="sm-bottom" [title]="politica || '—'">{{ politica || '—' }}</div>
  </div>
  `,
  styles: [`
  :host{
    /* tamanho padrão do selo (pode sobrescrever no page.scss) */
    --mini-w: 180px;  /* antes 200px */
    --mini-h: 126px;  /* antes 140px */
  }

  .selo-mini{
    --vd-dark:#496E6D; --vd-mint:#A7D0B7; --white:#fff;
    width: var(--mini-w); height: var(--mini-h);
    border-radius: 14px; overflow: hidden; box-sizing: border-box;
    background: var(--vd-dark); color: var(--white);
    box-shadow: 0 6px 16px rgba(0,0,0,.18);
    display: grid;
    grid-template-rows: 44px calc(var(--mini-h) - 44px - 24px) 24px; /* topo | meio | rodapé */
    font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
  }
  .selo-mini.invalido{ filter: grayscale(.12) brightness(.97); }

  /* TOPO */
  .sm-top{ padding:8px 8px 4px; text-align:center; line-height:1.05 }
  .sm-title{ display:block; font-weight:800; letter-spacing:.03em; font-size:10px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .sm-sub{   display:block; margin-top:2px; font-weight:800; font-size:12px; color:var(--vd-mint); white-space:nowrap; overflow:hidden; text-overflow:ellipsis }
  .sm-meta{  display:block; margin-top:2px; font-weight:600; font-size:9.5px; opacity:.95; white-space:nowrap; overflow:hidden; text-overflow:ellipsis }

  /* MEIO */
  .sm-middle{
    display:grid; grid-template-columns: 56px 1fr; gap:8px;
    align-items:center; padding: 6px 8px 8px; box-sizing:border-box;
  }
  .sm-left{ display:flex; align-items:center; justify-content:center; }
  .sm-left img{ width:50px; height:40px; object-fit:contain; display:block; }
  .sm-right{ text-align:right; line-height:1.06 }
  .sm-conf{ display:block; font-weight:700; font-size:10.5px; opacity:.95; white-space:nowrap }
  .sm-lei{  display:block; font-weight:800; font-size:12px; white-space:nowrap }

  /* RODAPÉ */
  .sm-bottom{
    background: var(--vd-mint); color: var(--vd-dark);
    display:flex; align-items:center; justify-content:center;
    font-weight:800; font-size:9.5px; padding:0 6px;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  `]
})
export class SeloValidacaoMiniComponent {
  /** AVANÇADA | SIMPLES | QUALIFICADA (ou outra) */
  @Input() tipo: string = 'AVANÇADA';
  /** PAdES, XAdES, CAdES etc. */
  @Input() tipoAssinatura: string = '';
  /** VÁLIDO | INVÁLIDO (efeito visual sutil) */
  @Input() status: 'VÁLIDO' | 'INVÁLIDO' = 'VÁLIDO';
  /** “Lei 14.063/20” */
  @Input() lei: string = 'Lei 14.063/20';
  /** Política exibida no rodapé */
  @Input() politica: string = '';
  /** Logo */
  @Input() logoSrc: string = 'assets/LOGO-AW-LOGOS-371x183-AW-VALIDADOCS.png';

  onImgErr(e: Event){ (e.target as HTMLImageElement).style.visibility = 'hidden'; }
}