import { Injectable } from '@angular/core';
import * as asn1js from 'asn1js';
import { ContentInfo, SignedData, CryptoEngine } from 'pkijs';

export interface P7sSummary {
  isSignedData: boolean;
  detached: boolean;
  digestAlgo?: string;
  signers: Array<{
    commonName?: string;
    serialNumber?: string;
    issuer?: string;
    signingTime?: Date;
  }>;
}

export interface P7sVerifyResult {
  ok: boolean;
  reason?: string;
  summary: P7sSummary;
}

@Injectable({ providedIn: 'root' })
export class P7sService {
  private crypto = window.crypto;
  private engine = new CryptoEngine({
    name: 'webcrypto',
    crypto: this.crypto as any,
    subtle: (this.crypto as any).subtle,
  });

  /** Lê o arquivo para ArrayBuffer */
  async readFile(file: File): Promise<ArrayBuffer> {
    return file.arrayBuffer();
  }

  /** Extrai um resumo leve do .p7s (sem verificar a cadeia completa) */
  async summarizeP7s(p7sBytes: ArrayBuffer): Promise<P7sSummary> {
    const asn1 = asn1js.fromBER(p7sBytes);
    if (asn1.offset === -1) throw new Error('Arquivo .p7s inválido (BER/DER).');

    const contentInfo = new ContentInfo({ schema: asn1.result });

    // OID 1.2.840.113549.1.7.2 = signedData
    if (contentInfo.contentType !== '1.2.840.113549.1.7.2') {
      return { isSignedData: false, detached: false, signers: [] };
    }

    const signed = new SignedData({ schema: contentInfo.content });
    const digestAlgo = signed.digestAlgorithms?.[0]?.algorithmId;
    const detached = !signed.encapContentInfo.eContent;

    const signers = signed.signerInfos.map((si: any) => {
      // signingTime (1.2.840.113549.1.9.5)
      let signingTime: Date | undefined;
      const stAttr = si.signedAttrs?.attributes?.find((a: any) => a.type === '1.2.840.113549.1.9.5');
      const v = stAttr?.values?.[0];
      if (v?.toDate) signingTime = v.toDate();

      // issuer/serial
      let issuer: string | undefined;
      let serialNumber: string | undefined;
      const sid = si.sid;
      if (sid?.issuer && sid?.serialNumber) {
        serialNumber = sid.serialNumber?.valueBlock?.toString();
        issuer = sid.issuer?.typesAndValues
          ?.map((tv: any) => `${tv.type}=${tv.value?.valueBlock?.value ?? ''}`)
          ?.join(', ');
      }

      // Nota: extrair CN do certificado exigiria resolver a cadeia/cert; mantemos undefined aqui
      return { commonName: undefined, serialNumber, issuer, signingTime };
    });

    return { isSignedData: true, detached, digestAlgo, signers };
  }

  /**
   * Verifica a assinatura P7S.
   * - Se for detached, `contentBytes` deve conter o PDF original.
   * - Não realiza validação de cadeia (checkChain=false); foca na verificação criptográfica.
   */
  async verifyP7s(p7sBytes: ArrayBuffer, contentBytes?: ArrayBuffer): Promise<P7sVerifyResult> {
    const asn1 = asn1js.fromBER(p7sBytes);
    if (asn1.offset === -1) throw new Error('Arquivo .p7s inválido.');

    const contentInfo = new ContentInfo({ schema: asn1.result });
    if (contentInfo.contentType !== '1.2.840.113549.1.7.2') {
      return {
        ok: false,
        reason: 'Não é um SignedData (.p7s).',
        summary: { isSignedData: false, detached: false, signers: [] }
      };
    }

    const signed = new SignedData({ schema: contentInfo.content });
    const summary = await this.summarizeP7s(p7sBytes);

    const verifyParams: any = {
      signer: 0,
      extendedMode: true,
      checkChain: false, // sem validação completa de cadeia aqui
      data: summary.detached ? (contentBytes ?? new ArrayBuffer(0)) : undefined,
      cryptoEngine: this.engine
    };

    try {
      // PKI.js pode retornar boolean OU objeto dependendo da versão
      const res = await signed.verify(verifyParams);
      const ok = (typeof res === 'boolean') ? res : (res as any)?.signatureVerified === true;

      return ok
        ? { ok: true, summary }
        : { ok: false, reason: 'Assinatura não confere com o conteúdo.', summary };
    } catch (e: any) {
      return { ok: false, reason: e?.message || 'Falha na verificação.', summary };
    }
  }
}