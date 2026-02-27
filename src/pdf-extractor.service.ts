import { Injectable } from '@nestjs/common';
// use require para evitar problemas ESM/CJS em alguns setups
const pdfjsLib: any = require('pdfjs-dist/legacy/build/pdf.js');

export interface FaturaExtraida {
  arquivo: string;
  no_cliente: string | null;
  mes_referencia: string | null;
  classe: string | null;
  subclasse: string | null;
  modalidade_tarifaria: string | null;
  bandeira_tarifaria: string | null;
  data_leitura_anterior: string | null;
  data_leitura_atual: string | null;
  num_dias: number;
  data_leitura_proxima: string | null;
  energia_eletrica_kwh: string;
  energia_sceee_kwh: string;
  consumo_energia_eletrica_kwh: string;
  energia_compensada_kwh: string;
  energia_compensada_gdi_rs: string;
  energia_eletrica_rs: string;
  energia_sceee_rs: string;
  contrib_ilum_publica_rs: string;
  valor_total_sem_gd_rs: string;
  economia_gd_rs: string;
  total_a_pagar_rs: string;
}

@Injectable()
export class PdfExtractorService {
  // Ative para ver o texto e logs
  private DEBUG = false;

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
      fullText += pageText + '\n\n';
    }

    // normalize CR like in python version
    fullText = fullText.replace(/\r/g, '');
    return fullText;
  }

  private parseBrNumber(value: string | null | undefined): number {
    if (!value) return 0;
    let s = String(value).trim();
    s = s.replace(/\./g, '').replace(',', '.');
    s = s.replace(/[^\d\-.]/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  private formatBrCurrency(val: number): string {
    if (!val) return 'R$ 0,00';
    const sign = val < 0 ? '-' : '';
    const absVal = Math.abs(val);
    const s = absVal
      .toFixed(2)
      .replace('.', ',')
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `R$ ${sign}${s}`;
  }

  /**
   * Função principal — replica a lógica do seu script Python,
   * com extração de texto via pdfjs e regexs idênticas/compatíveis.
   */
  async extract(buffer: Buffer, originalName: string): Promise<FaturaExtraida | null> {
    let fullText = '';

    try {
      fullText = await this.extractTextWithPdfjs(buffer);
    } catch (err) {
      console.error(`Erro ao ler PDF ${originalName}:`, err);
      return null;
    }

    this.log('\n===== TEXTO EXTRAÍDO (início) =====\n');
    this.log(fullText.slice(0, 2000));
    this.log('\n===== TEXTO EXTRAÍDO (fim) =====\n');

    // data object (mesma forma do Python)
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
      energia_eletrica_kwh: 0.0,
      energia_eletrica_rs: 0.0,
      energia_sceee_kwh: 0.0,
      energia_sceee_rs: 0.0,
      energia_compensada_gdi_kwh: 0.0,
      energia_compensada_gdi_rs: 0.0,
      contrib_ilum_publica_rs: 0.0,
      total_a_pagar_rs: 0.0,
    };

    // ----------------------------
    // Nº do Cliente (igual Python)
    // ----------------------------
    const matchCliente = fullText.match(/N[º°o]?\s*DO CLIENTE[\s\S]*?(\d{7,12})/i);
    if (matchCliente) data.no_cliente = matchCliente[1];

    // se não tem cliente, retorna null (mesma regra)
    if (!data.no_cliente) return null;

    // ----------------------------
    // Mês referência
    // ----------------------------
    const matchMes = fullText.match(/Referente a[\s\S]*?([A-Z]{3}\/\d{4})/i);
    if (matchMes) data.mes_referencia = matchMes[1].toUpperCase();

    // ----------------------------
    // EXTRAI BLOCO CLASSE / SUBCLASSE / MODALIDADE
    // ----------------------------
    // vamos localizar o bloco entre o cabeçalho e "Informações Técnicas" (se existir)
    let bloco = '';
    const headerIndex = fullText.search(/Classe\s+Subclasse\s+Modalidade\s+Tarifária/i);
    if (headerIndex >= 0) {
      // tenta encontrar "Informações Técnicas" mais adiante
      const infoTechIndex = fullText.search(/Informações\s+Técnicas/i);
      if (infoTechIndex > headerIndex) {
        bloco = fullText.substring(headerIndex, infoTechIndex);
      } else {
        // fallback: pega 300 caracteres após o cabeçalho
        bloco = fullText.substring(headerIndex, Math.min(fullText.length, headerIndex + 400));
      }
    }

    if (bloco) {
      // reduz múltiplos espaços e quebras para um espaço só (como no python + split)
      const blocoClean = bloco.replace(/\s+/g, ' ').trim();

      // Regex direta, single-line (essa não quebra o TS)
      const linhaRegex = /(Residencial|Comercial|Industrial|Rural)\s+(Residencial|Comercial|Industrial|Rural)\s+(Convencional\s+B\d)/i;
      const linhaMatch = blocoClean.match(linhaRegex);

      if (linhaMatch) {
        const classeBase = linhaMatch[1];
        const subclasseVal = linhaMatch[2];
        const modalidade = linhaMatch[3];

        // procura por tipo (Bifásico / Monofásico / Trifásico) em todo o bloco
        const tipoMatch = blocoClean.match(/(Monofásico|Bifásico|Trifásico)/i);
        data.classe = tipoMatch ? `${classeBase} ${tipoMatch[1]}` : classeBase;
        data.subclasse = subclasseVal;
        data.modalidade_tarifaria = modalidade;
      } else {
        // fallback extra: às vezes o texto é "Comercial Comercial Convencional B3 Anterior Atual..."
        // tentamos pegar a primeira ocorrência de "Comercial" seguida de outra "Comercial" e "Convencional B3"
        const fallbackRegex = /(Residencial|Comercial|Industrial|Rural)\s+(Residencial|Comercial|Industrial|Rural)\s+(Convencional\s*B\d?)/i;
        const fallbackMatch = blocoClean.match(fallbackRegex);
        if (fallbackMatch) {
          const classeBase = fallbackMatch[1];
          const subclasseVal = fallbackMatch[2];
          const modalidade = fallbackMatch[3].replace(/\s+/g, ' ').trim();
          const tipoMatch = blocoClean.match(/(Monofásico|Bifásico|Trifásico)/i);
          data.classe = tipoMatch ? `${classeBase} ${tipoMatch[1]}` : classeBase;
          data.subclasse = subclasseVal;
          data.modalidade_tarifaria = modalidade;
        }
      }
    }

    // Se ainda não encontrou subclasse, tenta captura direta e curta (não capture bloco gigante)
    if (!data.subclasse) {
      // procura a primeira linha após "Classe Subclasse" (se houver)
      const afterHeaderMatch = fullText.match(/Classe\s+Subclasse[\s\S]*?\n([^\n]+)/i);
      if (afterHeaderMatch) {
        // pega só a primeira palavra dessa linha como subclasse provável
        const firstWord = afterHeaderMatch[1].trim().split(/\s+/)[0];
        // valida se é um valor plausível
        if (/^(Residencial|Comercial|Industrial|Rural)$/i.test(firstWord)) {
          data.subclasse = firstWord;
        }
      }
    }

    // ----------------------------
    // Datas de leitura (igual Python: DOTALL)
    // ----------------------------
    const matchDatas = fullText.match(
      /Datas de Leitura[\s\S]*?(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(\d+)\s+(\d{2}\/\d{2})/i
    );
    if (matchDatas) {
      data.data_leitura_anterior = matchDatas[1];
      data.data_leitura_atual = matchDatas[2];
      data.num_dias = parseInt(matchDatas[3]) || 0;
      data.data_leitura_proxima = matchDatas[4];
    } else {
      // fallback: busca a sequência simples de 4 valores (mais solta)
      const fallbackDates = fullText.match(/(\d{2}\/\d{2})\s+(\d{2}\/\d{2})\s+(\d{1,3})\s+(\d{2}\/\d{2})/);
      if (fallbackDates) {
        data.data_leitura_anterior = fallbackDates[1];
        data.data_leitura_atual = fallbackDates[2];
        data.num_dias = parseInt(fallbackDates[3]) || 0;
        data.data_leitura_proxima = fallbackDates[4];
      }
    }

    // ----------------------------
    // Bandeira (aceita 'Band.' ou 'Bandeira')
    // ----------------------------
    const matchBandeira = fullText.match(/Band\.\s*(\w+)/i) || fullText.match(/Bandeira\s*[:\-]?\s*(\w+)/i);
    if (matchBandeira) {
      data.bandeira_tarifaria = matchBandeira[1].charAt(0).toUpperCase() + matchBandeira[1].slice(1).toLowerCase();
    }

    // ----------------------------
    // Energia Elétrica
    // ----------------------------
    const matchEl = fullText.match(/Energia Elétrica\s+kWh\s+([\d\.,]+)\s+[\d\.,]+\s+([\d\.,]+)/i);
    if (matchEl) {
      data.energia_eletrica_kwh = this.parseBrNumber(matchEl[1]);
      data.energia_eletrica_rs = this.parseBrNumber(matchEl[2]);
    } else {
      // fallback mais solto
      const fallbackEl = fullText.match(/Energia Elétrica[\s\S]{0,120}?([\d\.,]{1,12})[\s\S]{0,30}?([\d\.,]{1,12})/i);
      if (fallbackEl) {
        data.energia_eletrica_kwh = this.parseBrNumber(fallbackEl[1]);
        data.energia_eletrica_rs = this.parseBrNumber(fallbackEl[2]);
      }
    }

    // ----------------------------
    // Energia SCEE
    // ----------------------------
    const matchScee = fullText.match(/Energia\s+SCEE(?:E)?\s*s?[/\s]*ICMS\s+kWh\s+([\d\.,]+)\s+[\d\.,]+\s+([\d\.,]+)/i);
    if (matchScee) {
      data.energia_sceee_kwh = this.parseBrNumber(matchScee[1]);
      data.energia_sceee_rs = this.parseBrNumber(matchScee[2]);
    } else {
      const fallbackScee = fullText.match(/Energia\s+SCEE[\s\S]{0,120}?([\d\.,]{1,12})[\s\S]{0,30}?([\d\.,]{1,12})/i);
      if (fallbackScee) {
        data.energia_sceee_kwh = this.parseBrNumber(fallbackScee[1]);
        data.energia_sceee_rs = this.parseBrNumber(fallbackScee[2]);
      }
    }

    // ----------------------------
    // Energia compensada GD I
    // ----------------------------
    const matchGd = fullText.match(/Energia compensada GD I\s+kWh\s+([\d\.,]+)\s+[\d\.,]+\s+(-?[\d\.,]+)/i);
    if (matchGd) {
      data.energia_compensada_gdi_kwh = this.parseBrNumber(matchGd[1]);
      data.energia_compensada_gdi_rs = this.parseBrNumber(matchGd[2]);
    } else {
      const fallbackGd = fullText.match(/Energia compensada[\s\S]{0,120}?([\d\.,]{1,12})[\s\S]{0,30}?(-?[\d\.,]{1,12})/i);
      if (fallbackGd) {
        data.energia_compensada_gdi_kwh = this.parseBrNumber(fallbackGd[1]);
        data.energia_compensada_gdi_rs = this.parseBrNumber(fallbackGd[2]);
      }
    }

    // ----------------------------
    // Contribuição Ilum Publica
    // ----------------------------
    const matchContrib = fullText.match(/Contrib Ilum Publica Municipal\s+([\d\.,]+)/i);
    if (matchContrib) {
      data.contrib_ilum_publica_rs = this.parseBrNumber(matchContrib[1]);
    } else {
      const fallbackContrib = fullText.match(/(Contrib Ilum Publica|Ilum Publica)[\s\S]{0,30}?([\d\.,]{1,12})/i);
      if (fallbackContrib) data.contrib_ilum_publica_rs = this.parseBrNumber(fallbackContrib[2]);
    }

    // ----------------------------
    // Total a pagar
    // ----------------------------
    const matchTotal = fullText.match(/TOTAL\s+([\d\.,]+)/i);
    if (matchTotal) {
      data.total_a_pagar_rs = this.parseBrNumber(matchTotal[1]);
    } else {
      const fallbackTotal = fullText.match(/Valor a pagar.*?([\d\.,]{1,12})/i) || fullText.match(/Vencimento[\s\S]{0,80}?([\d\.,]{1,12})/i);
      if (fallbackTotal) data.total_a_pagar_rs = this.parseBrNumber(fallbackTotal[1]);
    }

    // ----------------------------
    // cálculos finais (igual python)
    // ----------------------------
    const consumo_energia_eletrica_kwh = data.energia_eletrica_kwh + data.energia_sceee_kwh;
    const energia_compensada_kwh = data.energia_compensada_gdi_kwh;
    const valor_total_sem_gd_rs = data.energia_eletrica_rs + data.energia_sceee_rs + data.contrib_ilum_publica_rs;
    const economia_gd_rs = data.energia_compensada_gdi_rs;

    // formata saída exatamente como Python final
    const result: FaturaExtraida = {
      arquivo: data.arquivo,
      no_cliente: data.no_cliente,
      mes_referencia: data.mes_referencia,
      classe: data.classe,
      subclasse: data.subclasse,
      modalidade_tarifaria: data.modalidade_tarifaria,
      bandeira_tarifaria: data.bandeira_tarifaria,
      data_leitura_anterior: data.data_leitura_anterior,
      data_leitura_atual: data.data_leitura_atual,
      num_dias: data.num_dias,
      data_leitura_proxima: data.data_leitura_proxima,
      energia_eletrica_kwh: data.energia_eletrica_kwh,
      energia_sceee_kwh: data.energia_sceee_kwh,
      consumo_energia_eletrica_kwh: consumo_energia_eletrica_kwh,
      energia_compensada_kwh: energia_compensada_kwh,
      energia_compensada_gdi_rs: this.formatBrCurrency(data.energia_compensada_gdi_rs),
      energia_eletrica_rs: this.formatBrCurrency(data.energia_eletrica_rs),
      energia_sceee_rs: this.formatBrCurrency(data.energia_sceee_rs),
      contrib_ilum_publica_rs: this.formatBrCurrency(data.contrib_ilum_publica_rs),
      valor_total_sem_gd_rs: this.formatBrCurrency(valor_total_sem_gd_rs),
      economia_gd_rs: this.formatBrCurrency(economia_gd_rs),
      total_a_pagar_rs: this.formatBrCurrency(data.total_a_pagar_rs),
    };

    this.log('RAW DATA', data);
    this.log('RESULT', result);
    console.log(result)
    return result;
  }
}