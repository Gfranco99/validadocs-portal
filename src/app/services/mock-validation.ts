
import { ValidationResult } from '../types/validation.types';

export const MOCK_VALIDATION: ValidationResult = {
  fileName: 'DOCUMENTO_HERIOBO_assinado.pdf',
  validationTime: '2025-08-14T12:05:24-03:00',
  isValid: true,
  status: '',
  softwareVersion: '',
  //signaturePolicy: '',
  elapsedTime: 0,  
  signatureType: 'PAdES',
  policy: 'string',
  errorMessage: '',
  errorfindings: [
    'Erro1: Este documento possui assinatura inválida.',
    'Erro2: Existem assinaturas desencadeadas.',
    'Erro3: Este documento não está no padrão PDF/A conforme ISO19000.'
  ],
  validaDocsReturn: {
    digitalSignatureValidations: [
      {
        endCertSubjectName: 'CN=MARCOS DONIZETE FOGAÇA',
        signerName:'',
        cpf: '***.***.***-**',
        signatureLevel: 'Qualificada',
        signatureType: 'PAdES',
        qualified: 'ICP-Brasil',
        signatureTime: '2025-07-10T09:25:24-03:00',
        signatureValid: true,
        cardImageUrl: 'assets/cards/qualificada.svg',
        isICP: true,
        iseGov: false,
        signatureErrors: '',
        signatureAlerts: '',
        certPathValid: true,
        certPathErrors: '',
        certPathAlerts: '',
        rootIssuer: ''
      },
      {
        endCertSubjectName: 'CN= GUILHERME HENRIQUE DIAS FRANCO',
        signerName:'',
        cpf: '***.***.***-**',
        signatureLevel: 'Qualificada',
        signatureType: 'PAdES',
        qualified: 'ICP-Brasil',
        signatureTime: '2025-10-02T10:15:24-03:00',
        signatureValid: true,
        cardImageUrl: 'assets/cards/qualificada.svg',
        isICP: true,
        iseGov: false,
        signatureErrors: '',
        signatureAlerts: '',
        certPathValid: true,
        certPathErrors: '',
        certPathAlerts: '',
        rootIssuer: ''
      }
    ], 
    pdfValidations: {
      isValid: false,
      pdfAStandard: 'PDF/A-1b',
      status: "OK",
      bornDigital: true,
      isPDFACompliant: true,
      errorMessage: '',
      alertMessage: '',
    },
  },  
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
