// src/app/manual-bundle-includes.ts

// Importe todos os componentes que estão sendo removidos pelo tree-shaking
import { TokenModalComponent } from './components/token-modal/token-modal.component';

// Opcional, mas garante que os imports sejam "usados" e não removidos.
export const MANUAL_COMPONENTS = [
  TokenModalComponent
];