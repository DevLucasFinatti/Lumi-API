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

  @Prop()
  energiaEletricaKwh: string;

  @Prop()
  energiaSceeeKwh: string;

  @Prop()
  consumoEnergiaEletricaKwh: string;

  @Prop()
  energiaCompensadaKwh: string;

  @Prop()
  energiaCompensadaGdiRs: string;

  @Prop()
  energiaEletricaRs: string;

  @Prop()
  energiaSceeeRs: string;

  @Prop()
  contribIlumPublicaRs: string;

  @Prop()
  valorTotalSemGdRs: string;

  @Prop()
  economiaGdRs: string;

  @Prop()
  totalAPagarRs: string;
}

export const FaturaSchema = SchemaFactory.createForClass(Fatura);

// 🔥 ÍNDICE ÚNICO (proteção real no banco)
FaturaSchema.index(
  { noCliente: 1, mesReferencia: 1 },
  { unique: true }
);