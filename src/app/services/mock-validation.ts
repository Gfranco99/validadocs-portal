
import { ValidationResult } from '../types/validation.types';

export const MOCK_VALIDATION: ValidationResult = {
  documentName: 'DOCUMENTO_HERIOBO_assinado.pdf',
  validationDate: '2025-08-14T12:05:24-03:00',
  integrityValid: true,
  pdfa: { conforms: false, level: 'PDF/A-1b' },
  lpa: 'Não',
  signatureType: 'PAdES',
  findings: [
    'Erro1: Este documento possui assinatura inválida.',
    'Erro2: Existem assinaturas desencadeadas.',
    'Erro3: Este documento não está no padrão PDF/A conforme ISO19000.'
  ],
  signatures: [
    {
      signerCN: 'CN=MARCOS DONIZETE FOGAÇA',
      cpf: '***.***.***-**',
      kind: 'Qualificada',
      standard: 'PAdES',
      policy: 'ICP-Brasil',
      qualifiedBy: 'ICP-Brasil',
      time: '2025-07-10T09:25:24-03:00',
      valid: true,
      cardImageUrl: 'assets/cards/qualificada.svg'
    },
    {
      signerCN: 'CN= GUILHERME HENRIQUE DIAS FRANCO',
      cpf: '***.***.***-**',
      kind: 'Qualificada',
      standard: 'PAdES',
      policy: 'ICP-Brasil',
      qualifiedBy: 'ICP-Brasil',
      time: '2025-10-02T10:15:24-03:00',
      valid: true,
      cardImageUrl: 'assets/cards/qualificada.svg'
    }
  ],
  certificates: [
    {
      subjectCN: 'CN=MARCOS DONIZETE FOGAÇA',
      issuerCN: 'AC Raiz da ICP-Brasil',
      authority: 'ICP-Brasil',
      notBefore: '2024-09-12T00:00:00-03:00',
      notAfter: '2025-09-12T00:00:00-03:00'
    },
    {
      subjectCN: 'CN= GUILHERME HENRIQUE DIAS FRANCO',
      issuerCN: 'AC Raiz da ICP-Brasil',
      authority: 'ICP-Brasil',
      notBefore: '2024-04-29T00:00:00-03:00',
      notAfter: '2025-04-29T00:00:00-03:00'
    }
  ]
};
