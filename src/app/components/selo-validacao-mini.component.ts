import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

// Tamanhos disponíveis do selo
type Size = 'sm' | 'md' | 'lg';

// Mesma ideia do seu CertAuthority (com fallback)
export type Authority = 'ICP-Brasil' | 'Gov.br' | 'Enotariado' | 'ICP-RC' | 'Desconhecida';

@Component({
  selector: 'app-selo-validacao-mini',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="selo-mini"
         [ngClass]="['size-' + size, valid ? 'ok' : 'fail']"
         role="img"
         [attr.aria-label]="altText"
         [attr.title]="altText">
      <img [src]="iconSrc" class="selo-img" [alt]="altText" />
      <span class="selo-chip" [ngClass]="valid ? 'chip-ok' : 'chip-fail'">
        {{ valid ? 'Válida' : 'Inválida' }}
      </span>
    </div>
  `,
  styles: [`
    .selo-mini {
      display: inline-flex;
      align-items: center;
      gap: .5rem;
      padding: .35rem .5rem;
      border-radius: 999px;
      background: #fff;
      border: 1px solid #E5E7EB; /* neutral-200 */
      box-shadow: 0 1px 2px rgba(0,0,0,.04);
      max-width: 100%;
    }
    .selo-img { display:block; height:100%; width:auto; object-fit:contain; }
    .size-sm .selo-img { max-height: 20px; }
    .size-md .selo-img { max-height: 28px; }
    .size-lg .selo-img { max-height: 36px; }

    .selo-chip {
      font-size: .75rem;
      line-height: 1;
      padding: .35rem .5rem;
      border-radius: 999px;
      font-weight: 600;
      white-space: nowrap;
    }
    .chip-ok  { background:#ECFDF5; color:#065F46; border:1px solid #A7F3D0; }
    .chip-fail{ background:#FEF2F2; color:#7F1D1D; border:1px solid #FECACA; }

    .ok   { border-color:#A7F3D0; }
    .fail { border-color:#FECACA; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SeloValidacaoMiniComponent {
  /** Estado da assinatura */
  @Input() valid: boolean = true;

  /** Tamanho do selo */
  @Input() size: Size = 'md';

  /**
   * Forma recomendada: passar a autoridade diretamente.
   * Ex.: [authority]="s.qualified ?? 'Desconhecida'"
   */
  @Input() authority: Authority = 'Desconhecida';

  /**
   * Compatibilidade (opcional): se você já usa booleans no HTML,
   * pode continuar usando. Se "authority" vier setado, ela tem prioridade.
   */
  @Input() isICP: boolean = false;
  @Input() isEGov: boolean = false;       // ligue como [isEGov]="s.iseGov"
  @Input() isEnotariado: boolean = false; // ligue como [isEnotariado]="s.qualified === 'Enotariado'"

  /** Caminhos dos ícones (pode sobrescrever via Input) */
  @Input() icpSrc        = 'assets/selo_validadocs_ICPBrasil.png';
  @Input() egovSrc       = 'assets/selo_validadocs_govbr.png';
  @Input() enotariadoSrc = 'assets/selo_validadocs_enotariado.png';
  @Input() icprcSrc      = 'assets/selo_validadocs_icprc.png';
  @Input() genericSrc    = 'assets/selo_validadocs_generico.png';

  /** Resolve a autoridade efetiva (authority > booleans) */
  private get resolvedAuthority(): Authority {
    if (this.authority && this.authority !== 'Desconhecida') return this.authority;

    if (this.isEnotariado) return 'Enotariado';
    if (this.isICP)        return 'ICP-Brasil';
    if (this.isEGov)       return 'Gov.br';

    // Se quiser mapear ICP-RC por alguma regra, faça aqui
    return 'Desconhecida';
  }

  /** Ícone conforme a autoridade */
  get iconSrc(): string {
    switch (this.resolvedAuthority) {
      case 'Enotariado': return this.enotariadoSrc;
      case 'ICP-Brasil': return this.icpSrc;
      case 'Gov.br':     return this.egovSrc;
      case 'ICP-RC':     return this.icprcSrc;
      default:           return this.genericSrc;
    }
  }

  /** Texto acessível */
  get altText(): string {
    return `Selo ${this.resolvedAuthority} - ${this.valid ? 'assinatura válida' : 'assinatura inválida'}`;
  }
}