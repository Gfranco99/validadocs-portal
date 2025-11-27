export type CertAuthority = 'ICP-Brasil' | 'Gov.br' | 'Enotariado' | 'ICP-RC' | 'Desconhecida';
export type SignatureKind = 'Qualificada' | 'Avancada' | 'Desconhecida';
export type SignatureStandard = 'PAdES' | 'XAdES' | 'CAdES' | 'Outro';

export interface SignatureAlertEntry {
  id?: string | null;
  description?: string | null;
  message?: string | null;
}

export interface CertPathIssueEntry {
  id?: string | null;
  description?: string | null;
  message?: string | null;
}

export interface CertificateInfo {
  subjectCN: string;
  issuerCN: string;
  authority: CertAuthority | 'Desconhecida';
  serial?: string;
  notBefore?: string;
  notAfter?: string;
}

export interface ValidaDocsReturn {
  digitalSignatureValidations: SignatureInfo[]; 
  pdfValidations: PdfaInfo;
}

export interface SignatureInfo {
  signatureValid: boolean;
  signatureErrors?: any;
  signatureErrorsDetailed?: any;
  signatureAlerts?: SignatureAlertEntry[] | null;
  endCertSubjectName: string;

  certificateStartDate?: string | null;
  certificateEndDate?: string | null;

  isICP: boolean;
  iseGov: boolean;

  rootIssuer: string;
  signatureType?: string | null;
  policy?: string | null;
  policyURI?: string | null;
  signatureLevel?: string | null;
  trustedRoot: string;
  timeStamps?: any;

  signerName?: string;
  cpf?: string;
  cardImageUrl?: string;
  signatureTime?: string;
  qualified?: CertAuthority;
  certPathValid?: boolean;
  certPathErrors?: CertPathIssueEntry[] | string | null;
  certPathAlerts?: CertPathIssueEntry[] | string | null;
}

export interface PdfaInfo {
  status?: string;
  isValid?: boolean;
  bornDigital?: boolean;
  isPDFACompliant?: boolean;
  pdfAStandard?: string | null;
  errorMessage?: string | null;
  alertMessage?: string | null;
}

export interface ValidationResult {
  status?: string;
  isValid: boolean;
  lpaValid?: boolean;

  softwareVersion?: string;
  errorMessage?: string | null;
  signatureType?: string | null;
  fileName?: string;
  elapsedTime?: number;
  validationTime?: string;

  policy?: string | null;

  validaDocsReturn: ValidaDocsReturn;

  certificates?: CertificateInfo[];
  errorfindings?: string[];
}
