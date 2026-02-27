import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type FaturaDocument = Fatura & Document;

@Schema({ collection: 'faturas', timestamps: true })
export class Fatura {
  @Prop({ required: true })
  arquivo: string;

  @Prop({ required: true })
  noCliente: string;

  @Prop({ required: true })
  mesReferencia: string;

  @Prop()
  classe: string;

  @Prop()
  subclasse: string;

  @Prop()
  modalidadeTarifaria: string;

  @Prop()
  bandeiraTarifaria: string;

  @Prop()
  dataLeituraAnterior: string;

  @Prop()
  dataLeituraAtual: string;

  @Prop()
  numDias: number;

  @Prop()
  dataLeituraProxima: string;

  // =============================
  // ENERGIAS (NUMÉRICOS)
  // =============================
  @Prop({ type: Number, default: 0 })
  energiaEletricaKwh: number;

  @Prop({ type: Number, default: 0 })
  energiaSceeeKwh: number;

  @Prop({ type: Number, default: 0 })
  consumoEnergiaEletricaKwh: number;

  @Prop({ type: Number, default: 0 })
  energiaCompensadaKwh: number;

  // =============================
  // VALORES (NUMÉRICOS)
  // =============================
  @Prop({ type: Number, default: 0 })
  energiaCompensadaGdiRs: number;

  @Prop({ type: Number, default: 0 })
  energiaEletricaRs: number;

  @Prop({ type: Number, default: 0 })
  energiaSceeeRs: number;

  @Prop({ type: Number, default: 0 })
  contribIlumPublicaRs: number;

  @Prop({ type: Number, default: 0 })
  valorTotalSemGdRs: number;

  @Prop({ type: Number, default: 0 })
  economiaGdRs: number;

  @Prop({ type: Number, default: 0 })
  totalAPagarRs: number;
}

export const FaturaSchema = SchemaFactory.createForClass(Fatura);

// 🔥 ÍNDICE ÚNICO (proteção real no banco)
FaturaSchema.index(
  { noCliente: 1, mesReferencia: 1 },
  { unique: true },
);