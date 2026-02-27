import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Fatura, FaturaDocument } from './fatura.entity';
import { PdfExtractorService } from './pdf-extractor.service';

@Injectable()
export class AppService {
  constructor(
    @InjectModel(Fatura.name) private faturaModel: Model<Fatura>,
    private extractor: PdfExtractorService,
  ) {}

  // app.service.ts (apenas o método processSingle)
  async processSingle(file: Express.Multer.File) {
    const extracted = await this.extractor.extract(
      file.buffer,
      file.originalname,
    );

    if (!extracted)
      throw new BadRequestException(
        `Erro ao extrair dados do PDF: ${file.originalname}`,
      );

    if (!extracted.no_cliente || !extracted.mes_referencia) {
      throw new BadRequestException(
        `Campos obrigatórios não encontrados no PDF`,
      );
    }

    // Helper local: snake_case -> camelCase
    const snakeToCamel = (s: string) =>
      s.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase());

    const payload: any = Object.fromEntries(
      Object.entries(extracted).map(([k, v]) => [snakeToCamel(k), v])
    );

    // garante que arquivo esteja presente/atualizado
    payload.arquivo = file.originalname;

    // 🔎 VERIFICA SE JÁ EXISTE (agora usando camelCase)
    const existente = await this.faturaModel.findOne({
      noCliente: payload.noCliente,
      mesReferencia: payload.mesReferencia,
    });

    if (existente) {
      throw new BadRequestException(
        `Fatura já cadastrada para cliente ${payload.noCliente} no mês ${payload.mesReferencia}`,
      );
    }

    const novaFatura = new this.faturaModel(payload);

    return novaFatura.save();
  }

  async processMultiple(files: Express.Multer.File[]) {
    const results = await Promise.allSettled(
      files.map((file) => this.processSingle(file))
    );

    return results;
  }

  // =============================
  // GET ALL
  // =============================
  async getAll() {
    return this.faturaModel
      .find()
      .sort({ mesReferencia: 1 }) // ordena por mês
      .lean();
  }

  // =============================
  // DELETE ALL
  // =============================
  async deleteAll() {
    const result = await this.faturaModel.deleteMany({});
    return {
      message: 'Todas as faturas foram removidas',
      deletedCount: result.deletedCount,
    };
  }

  // =============================
  // GET BY ANO
  // =============================
  async getByAno(ano: string) {
    if (!/^\d{4}$/.test(ano)) {
      throw new BadRequestException('Ano inválido. Use formato YYYY');
    }

    return this.faturaModel
      .find({
        mesReferencia: { $regex: `/${ano}$` }, // ex: JAN/2024
      })
      .sort({ mesReferencia: 1 })
      .lean();
  }
}