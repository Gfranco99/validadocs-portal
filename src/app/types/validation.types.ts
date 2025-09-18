
export type CertAuthority = 'ICP-Brasil' | 'Gov.br' | 'Enotariado' | 'ICP-RC';
export type SignatureKind = 'Qualificada' | 'Avancada' | 'Desconhecida';
export type SignatureStandard = 'PAdES' | 'XAdES' | 'CAdES' | 'Outro';

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
  endCertSubjectName: string;
  signerName: string;
  cpf: string;
  signatureLevel: SignatureKind;
  signatureType: SignatureStandard;  
  qualified?: CertAuthority;
  signatureTime?: string;
  signatureValid: boolean;
  cardImageUrl?: string;
  isICP: boolean;
	iseGov: boolean;
  signatureErrors: string;
	signatureAlerts: string;
  certPathValid: true;
	certPathErrors: string;
	certPathAlerts: string;
  rootIssuer: string;
  certificateStartDate?: string;
  certificateEndDate?: string;
  policyURI?: string;

}

export interface PdfaInfo {
  isValid: boolean;
  pdfAStandard: string;
  status: string;	
	bornDigital: boolean;
	isPDFACompliant: boolean;
	errorMessage: string;
  alertMessage: string;
}

export interface ValidationResult {
  fileName: string;
  validationTime: string;
  isValid: boolean;  
  signatureType: SignatureStandard;
  status: string;
  softwareVersion: string;
  policy: string; 
  elapsedTime: number;
  errorMessage: string;

  validaDocsReturn: ValidaDocsReturn;
  certificates: CertificateInfo[];
  errorfindings: string[];
}
