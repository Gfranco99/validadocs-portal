import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  standalone: true,
  selector: 'app-error-modal',
  imports: [CommonModule],
  template: `
    <div class="error-modal-backdrop" *ngIf="open" (click)="onBackdropClick()">
      <div class="error-modal-container" (click)="$event.stopPropagation()">
        <button
          type="button"
          class="error-modal-close"
          (click)="onClose()"
          aria-label="Fechar detalhes do erro"
        >
          &times;
        </button>

        <h2 class="error-modal-title">Detalhes do erro</h2>

        <div class="error-modal-body">
          <p *ngIf="message && message.trim(); else noDetails">
            {{ message }}
          </p>

          <ng-template #noDetails>
            <p>Nenhuma informação adicional de erro foi fornecida.</p>
          </ng-template>
        </div>

        <div class="error-modal-footer"></div>
      </div>
    </div>
  `,
  styles: [`
    .error-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    }

    .error-modal-container {
      background: var(--ion-card-background, var(--ion-background-color, #ffffff));
      border-radius: 12px;
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.35);
      padding: 20px 24px 16px;
      max-width: 480px;
      width: 90%;
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      color: var(--ion-text-color, #111827);
    }

    .error-modal-title {
      font-size: 1.2rem;
      font-weight: 600;
      margin: 0 0 4px;
      color: var(--ion-text-color, #111827);
    }

    .error-modal-body {
      max-height: 260px;
      overflow-y: auto;
      font-size: 0.95rem;
      line-height: 1.5;
      color: var(--ion-text-color, #111827);
      opacity: 0.87;
      padding-right: 4px;
    }

    .error-modal-body p {
      margin: 0;
      white-space: pre-wrap;
    }

    .error-modal-footer {
      margin-top: 8px;
      display: flex;
      justify-content: flex-end;
    }

    .error-modal-close {
      position: absolute;
      top: 10px;
      right: 12px;
      border: none;
      background: transparent;
      font-size: 1.4rem;
      line-height: 1;
      cursor: pointer;
      color: var(--ion-color-medium, #9aa5b1);
      padding: 0;
    }

    .error-modal-close:hover {
      color: var(--ion-color-medium-shade, #526069);
    }
  `],
})
export class ErrorModalComponent {
  @Input() open: boolean = false;
  @Input() message: string | null = null;
  @Output() closed = new EventEmitter<void>();

  onClose(): void {
    this.closed.emit();
  }

  onBackdropClick(): void {
    if (this.open) this.onClose();
  }

  @HostListener('document:keydown', ['$event'])
  onEsc(ev: KeyboardEvent): void {
    if (this.open && (ev.key === 'Escape' || ev.key === 'Esc')) {
      this.onClose();
    }
  }
}
