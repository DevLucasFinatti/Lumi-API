// pdf-extractor.service.ts
import { Injectable } from '@nestjs/common';
// use require para evitar problemas ESM/CJS em alguns setups
const pdfjsLib: any = require('pdfjs-dist/legacy/build/pdf.js');

export interface FaturaExtraida {
  arquivo: string;
  noCliente: string | null;
  mesReferencia: string | null;
  classe: string | null;
  subclasse: string | null;
  modalidadeTarifaria: string | null;
  bandeiraTarifaria: string | null;
  dataLeituraAnterior: string | null;
  dataLeituraAtual: string | null;
  numDias: number;
  dataLeituraProxima: string | null;

  // energias (numéricas)
  energiaEletricaKwh: number;
  energiaSceeeKwh: number;
  consumoEnergiaEletricaKwh: number;
  energiaCompensadaKwh: number;

  // valores (numéricos)
  energiaCompensadaGdiRs: number;
  energiaEletricaRs: number;
  energiaSceeeRs: number;
  contribIlumPublicaRs: number;
  valorTotalSemGdRs: number;
  economiaGdRs: number;
  totalAPagarRs: number;

  // extras (opcional)
  rawText?: string;
  rawExtraction?: any;
}

@Injectable()
export class PdfExtractorService {
  private DEBUG = false; // true para logs completos

  private log(...args: any[]) {
    if (this.DEBUG) console.log(...args);
  }

  private async extractTextWithPdfjs(buffer: Buffer): Promise<string> {
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const doc = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((it: any) => it.str).join(' ');
      fullText += pageText + '\n';
    }

    return fullText.replace(/\r/g, '');
  }

  private parseBrNumber(value: string | number | null | undefined): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;
    let s = String(value).trim();
    s = s.replace(/\./g, '').replace(',', '.');
    s = s.replace(/[^0-9\-.]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  async extract(buffer: Buffer, originalName: string): Promise<FaturaExtraida | null> {
    let fullText = '';
    try {
      fullText = await this.extractTextWithPdfjs(buffer);
    } catch (err) {
      console.error(`Erro ao ler PDF ${originalName}:`, err);
      return null;
    }

    this.log('==== TEXTO EXTRAÍDO (início) ====');
    this.log(this.DEBUG ? fullText : fullText.slice(0, 800));
    this.log('==== TEXTO EXTRAÍDO (fim) ====');

    const data: any = {
      arquivo: originalName,
      no_cliente: null,
      mes_referencia: null,
      classe: null,
      subclasse: null,
      modalidade_tarifaria: null,
      bandeira_tarifaria: null,
      data_leitura_anterior: null,
      data_leitura_atual: null,
      num_dias: 0,
      data_leitura_proxima: null,

      energia_eletrica_kwh: 0,
      energia_eletrica_rs: 0,
      energia_sceee_kwh: 0,
      energia_sceee_rs: 0,
      energia_compensada_gdi_kwh: 0,
      energia_compensada_gdi_rs: 0,
      contrib_ilum_publica_rs: 0,
      total_a_pagar_rs: 0,
    };

    // Nº do Cliente
    const matchCliente = fullText.match(/N[º°o]?\s*DO CLIENTE[\s\S]*?(\d{6,14})/i);
    if (matchCliente) data.no_cliente = matchCliente[1].trim();
    if (!data.no_cliente) return null;

    // Mês referência
    const matchMes = fullText.match(/Referente a[\s\S]*?([A-Z]{3}\/\d{4})/i);
    if (matchMes) data.mes_referencia = matchMes[1].toUpperCase();

    // Classe / Subclasse / Modalidade
    const classeBlockMatch = fullText.match(/Classe\s+Subclasse\s+Modalidade\s+Tarifária([\s\S]{0,400})/i);
    if (classeBlockMatch) {
      const bloco = classeBlockMatch[1].replace(/\s+/g, ' ').trim();
      const classeMatch = bloco.match(/\b(Residencial|Comercial|Industrial|Rural)\b/i);
      if (classeMatch) data.classe = classeMatch[1];
      const modalidadeMatch = bloco.match(/\bConvencional\s*B\d+\b/i);
      if (modalidadeMatch) data.modalidade_tarifaria = modalidadeMatch[0].trim();
      if (data.classe && data.modalidade_tarifaria) {
        const start = bloco.toLowerCase().indexOf(data.classe.toLowerCase()) + data.classe.length;
        const end = bloco.toLowerCase().indexOf(data.modalidade_tarifaria.toLowerCase());
        if (end > start) {
          data.subclasse = bloco.substring(start, end).trim().replace(/\b(Anterior|Atual|Nº|Próxima|Número|Dias)\b/gi, '').trim();
        }
      }
      const tipoMatch = bloco.match(/\b(Monofásico|Bifásico|Trifásico)\b/i);
      if (tipoMatch && data.classe && !/\b(Monofásico|Bifásico|Trifásico)\b/i.test(data.classe)) {
        data.classe = `${data.classe} ${tipoMatch[1]}`;
      }
    }

    // Datas de leitura
    const matchDatas = fullText.match(/Datas de Leitura[\s\S]*?(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(\d{1,3})\s+(\d{2}\/\d{2})/i);
    if (matchDatas) {
      data.data_leitura_anterior = matchDatas[1];
      data.data_leitura_atual = matchDatas[2];
      data.num_dias = parseInt(matchDatas[3], 10) || 0;
      data.data_leitura_proxima = matchDatas[4];
    }

    // Bandeira
    const matchBandeira = fullText.match(/Band\.\s*(\w+)/i) || fullText.match(/Bandeira\s*[:\-]?\s*(\w+)/i);
    if (matchBandeira) data.bandeira_tarifaria = matchBandeira[1].charAt(0).toUpperCase() + matchBandeira[1].slice(1).toLowerCase();

    // Energia Elétrica
    let matchEl = fullText.match(/Energia Elétrica[\s\S]{0,120}?([\d\.,]{1,12})[\s\S]{0,30}?([\d\.,]{1,12})/i);
    if (matchEl) {
      data.energia_eletrica_kwh = this.parseBrNumber(matchEl[1]);
      data.energia_eletrica_rs = this.parseBrNumber(matchEl[2]);
    }

    // Energia SCEE
    let matchScee = fullText.match(/Energia\s+SCEE[\s\S]{0,120}?([\d\.,]{1,12})[\s\S]{0,30}?([\d\.,]{1,12})/i);
    if (matchScee) {
      data.energia_sceee_kwh = this.parseBrNumber(matchScee[1]);
      data.energia_sceee_rs = this.parseBrNumber(matchScee[2]);
    }

    // Energia compensada GD I
    let matchGd = fullText.match(/Energia compensada[\s\S]{0,120}?([\d\.,]{1,12})[\s\S]{0,30}?(-?[\d\.,]{1,12})/i);
    if (matchGd) {
      data.energia_compensada_gdi_kwh = this.parseBrNumber(matchGd[1]);
      data.energia_compensada_gdi_rs = this.parseBrNumber(matchGd[2]);
    }

    // Contribuição Ilum Pública
    const matchContrib = fullText.match(/(Contrib Ilum Publica|Ilum Publica)[\s\S]{0,30}?([\d\.,\-]{1,12})/i);
    if (matchContrib) data.contrib_ilum_publica_rs = this.parseBrNumber(matchContrib[2]);

    // Total a pagar
    const matchTotal = fullText.match(/TOTAL\s+([\d\.,\-]+)/i) ||
                       fullText.match(/Valor a pagar.*?([\d\.,\-]{1,12})/i) ||
                       fullText.match(/Vencimento[\s\S]{0,80}?([\d\.,\-]{1,12})/i);
    if (matchTotal) data.total_a_pagar_rs = this.parseBrNumber(matchTotal[1]);

    // Derivados
    const energiaEletricaKwh = this.parseBrNumber(data.energia_eletrica_kwh);
    const energiaSceeeKwh = this.parseBrNumber(data.energia_sceee_kwh);
    const energiaCompensadaKwh = this.parseBrNumber(data.energia_compensada_gdi_kwh);

    const energiaEletricaRs = this.parseBrNumber(data.energia_eletrica_rs);
    const energiaSceeeRs = this.parseBrNumber(data.energia_sceee_rs);
    const contribIlumPublicaRs = this.parseBrNumber(data.contrib_ilum_publica_rs);
    const energiaCompensadaGdiRs = this.parseBrNumber(data.energia_compensada_gdi_rs);
    const totalAPagarRs = this.parseBrNumber(data.total_a_pagar_rs);

    const consumoEnergiaEletricaKwh = energiaEletricaKwh + energiaSceeeKwh;
    const valorTotalSemGdRs = energiaEletricaRs + energiaSceeeRs + contribIlumPublicaRs;
    const economiaGdRs = energiaCompensadaGdiRs;

    const result: FaturaExtraida = {
      arquivo: data.arquivo,
      noCliente: data.no_cliente,
      mesReferencia: data.mes_referencia,
      classe: data.classe,
      subclasse: data.subclasse,
      modalidadeTarifaria: data.modalidade_tarifaria,
      bandeiraTarifaria: data.bandeira_tarifaria,
      dataLeituraAnterior: data.data_leitura_anterior,
      dataLeituraAtual: data.data_leitura_atual,
      numDias: data.num_dias,
      dataLeituraProxima: data.data_leitura_proxima,

      energiaEletricaKwh,
      energiaSceeeKwh,
      consumoEnergiaEletricaKwh,
      energiaCompensadaKwh,

      energiaCompensadaGdiRs,
      energiaEletricaRs,
      energiaSceeeRs,
      contribIlumPublicaRs,
      valorTotalSemGdRs,
      economiaGdRs,
      totalAPagarRs,

      rawText: this.DEBUG ? fullText : undefined,
      rawExtraction: { ...data },
    };

    this.log('RESULT NUMÉRICO', result);
    return result;
  }
}