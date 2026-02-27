import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Fatura } from './fatura.entity';
import { PdfExtractorService, FaturaExtraida } from './pdf-extractor.service';

@Injectable()
export class AppService {
  constructor(
    @InjectModel(Fatura.name) private faturaModel: Model<Fatura>,
    private extractor: PdfExtractorService,
  ) {}

  // PROCESS SINGLE PDF: extrai, valida, calcula campos derivados e salva
  async processSingle(file: Express.Multer.File): Promise<Fatura> {
    const extracted: FaturaExtraida | null = await this.extractor.extract(
      file.buffer,
      file.originalname,
    );

    if (!extracted) {
      throw new BadRequestException(`Erro ao extrair dados do PDF: ${file.originalname}`);
    }

    if (!extracted.noCliente || !extracted.mesReferencia) {
      throw new BadRequestException('Campos obrigatórios não encontrados no PDF');
    }

    const payload: any = {
      ...extracted,
      arquivo: file.originalname,
      noCliente: String(extracted.noCliente).trim(),
      mesReferencia: String(extracted.mesReferencia).toUpperCase().trim(),
    };

    const toNum = (v: any) => {
      if (v === null || v === undefined) return 0;
      if (typeof v === 'number') return v;
      const n = Number(v);
      return isNaN(n) ? 0 : n;
    };

    payload.energiaEletricaKwh = toNum(payload.energiaEletricaKwh);
    payload.energiaSceeeKwh = toNum(payload.energiaSceeeKwh);
    payload.energiaCompensadaKwh = toNum(payload.energiaCompensadaKwh ?? payload.energiaCompensadaGdiKwh ?? 0);

    payload.energiaEletricaRs = toNum(payload.energiaEletricaRs);
    payload.energiaSceeeRs = toNum(payload.energiaSceeeRs);
    payload.contribIlumPublicaRs = toNum(payload.contribIlumPublicaRs);
    payload.energiaCompensadaGdiRs = toNum(payload.energiaCompensadaGdiRs ?? payload.energiaCompensadaGdiRs);
    payload.totalAPagarRs = toNum(payload.totalAPagarRs);

    payload.consumoEnergiaEletricaKwh = payload.energiaEletricaKwh + payload.energiaSceeeKwh;
    payload.valorTotalSemGdRs = payload.energiaEletricaRs + payload.energiaSceeeRs + payload.contribIlumPublicaRs;
    payload.economiaGdRs = payload.energiaCompensadaGdiRs;
    const anoMatch = String(payload.mesReferencia).match(/\/(\d{4})$/);
    if (anoMatch) payload.ano = Number(anoMatch[1]);
    else payload.ano = null;

    const existente = await this.faturaModel.findOne({
      noCliente: payload.noCliente,
      mesReferencia: payload.mesReferencia,
    });

    if (existente) {
      throw new BadRequestException(
        `Fatura já cadastrada para cliente ${payload.noCliente} no mês ${payload.mesReferencia}`,
      );
    }

    const nova = new this.faturaModel(payload);
    return nova.save();
  }

  // PROCESS MULTIPLE: Promise.allSettled com resumo amigável
  async processMultiple(files: Express.Multer.File[]) {
    const settled = await Promise.allSettled(files.map((f) => this.processSingle(f)));
    return settled.map((s, i) => {
      const name = files[i]?.originalname || `file_${i}`;
      if (s.status === 'fulfilled') {
        return { file: name, status: 'ok', id: (s as PromiseFulfilledResult<any>).value._id };
      } else {
        const reason = (s as PromiseRejectedResult).reason;
        return { file: name, status: 'error', error: reason?.message || String(reason) };
      }
    });
  }

  // GET ALL com filtros e paginação
  async getAll(opts: { noCliente?: string; mesReferencia?: string; page: number; limit: number; }) {
    const { noCliente, mesReferencia, page, limit } = opts;
    const filter: any = {};
    if (noCliente) filter.noCliente = String(noCliente).trim();
    if (mesReferencia) filter.mesReferencia = String(mesReferencia).toUpperCase().trim();

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.faturaModel.find(filter).sort({ mesReferencia: -1 }).skip(skip).limit(limit).lean(),
      this.faturaModel.countDocuments(filter),
    ]);

    return { page, limit, total, items };
  }

  // GET by id
  async getById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');
    const f = await this.faturaModel.findById(id).lean();
    if (!f) throw new NotFoundException('Fatura não encontrada');
    return f;
  }

  // DELETE by id
  async deleteById(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('ID inválido');
    const r = await this.faturaModel.findByIdAndDelete(id);
    if (!r) throw new NotFoundException('Fatura não encontrada');
    return { message: 'Fatura removida', id };
  }

  // DELETE ALL
  async deleteAll() {
    const res = await this.faturaModel.deleteMany({});
    return { message: 'Todas as faturas foram removidas', deletedCount: res.deletedCount };
  }

  // GET BY ANO (mantive validação do formato)
  async getByAno(ano: string) {
    if (!/^\d{4}$/.test(ano)) throw new BadRequestException('Ano inválido. Use formato YYYY');

    const regex = new RegExp(`${ano}$`);
    return this.faturaModel.find({ mesReferencia: { $regex: regex } }).sort({ mesReferencia: 1 }).lean();
  }

  // DASHBOARD ENERGIA: total e série mensal (consumo vs compensada)
  async getDashboardEnergia(filters: { ano?: string; noCliente?: string }) {
    const match: any = {};
    if (filters.noCliente) match.noCliente = String(filters.noCliente);
    if (filters.ano) match.ano = Number(filters.ano);

    const agg = await this.faturaModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$mesReferencia',
          consumoKwh: { $sum: { $ifNull: ['$consumoEnergiaEletricaKwh', 0] } },
          compensadoKwh: { $sum: { $ifNull: ['$energiaCompensadaKwh', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const serieMensal = agg.map((a) => ({ mes: a._id, consumoKwh: a.consumoKwh, compensadoKwh: a.compensadoKwh }));
    const totals = serieMensal.reduce(
      (acc, cur) => {
        acc.totalConsumoKwh += cur.consumoKwh;
        acc.totalCompensadoKwh += cur.compensadoKwh;
        return acc;
      },
      { totalConsumoKwh: 0, totalCompensadoKwh: 0 },
    );

    return { ...totals, serieMensal };
  }

  // DASHBOARD FINANCEIRO: total e série mensal (valor sem GD vs economia GD)
  async getDashboardFinanceiro(filters: { ano?: string; noCliente?: string }) {
    const match: any = {};

    if (filters.noCliente) match.noCliente = String(filters.noCliente);
    if (filters.ano) {
      match.mesReferencia = { $regex: `/${filters.ano}$` };
    }

    const agg = await this.faturaModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$mesReferencia',
          valorSemGd: { $sum: { $ifNull: ['$valorTotalSemGdRs', 0] } },
          economiaGd: { $sum: { $ifNull: ['$economiaGdRs', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const serieMensal = agg.map((a) => ({
      mes: a._id,
      valorSemGd: a.valorSemGd,
      economiaGd: a.economiaGd,
    }));

    const totals = serieMensal.reduce(
      (acc, cur) => {
        acc.totalValorSemGd += cur.valorSemGd;
        acc.totalEconomiaGd += cur.economiaGd;
        return acc;
      },
      { totalValorSemGd: 0, totalEconomiaGd: 0 },
    );

    return { ...totals, serieMensal };
  }
}