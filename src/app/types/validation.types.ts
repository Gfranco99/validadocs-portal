
export type CertAuthority = 'ICP-Brasil' | 'Gov.br' | 'Enotariado' | 'ICP-RC';
export type SignatureKind = 'Qualificada' | 'Avancada' | 'Desconhecida';

export interface CertificateInfo {
  subjectCN: string;
  issuerCN: string;
  authority: CertAuthority | 'Desconhecida';
  serial?: string;
  notBefore?: string;
  notAfter?: string;
}

export interface SignatureSummary {
  signerCN: string;
  cpf?: string;
  kind: SignatureKind;
  standard: 'PAdES' | 'XAdES' | 'CAdES' | 'Outro';
  policy?: string;
  qualifiedBy?: CertAuthority;
  time?: string;
  valid: boolean;
  cardImageUrl?: string;
}

export interface PdfaInfo {
  conforms: boolean;
  level?: string;
}

export interface ValidationResult {
  documentName: string;
  validationDate: string;
  integrityValid: boolean;
  pdfa: PdfaInfo;
  lpa: 'Sim' | 'Não' | 'Desconhecido';
  signatureType: 'PAdES' | 'XAdES' | 'CAdES' | 'Nenhuma/Desconhecida';
  signatures: SignatureSummary[];
  certificates: CertificateInfo[];
  findings: string[];
}
