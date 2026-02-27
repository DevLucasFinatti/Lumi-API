import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PdfExtractorService } from './pdf-extractor.service';
import { Fatura, FaturaSchema } from './fatura.entity';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb+srv://lucas:5n6yRTrLpdLSktF@lumi.vqlxcpv.mongodb.net/lumi?retryWrites=true&w=majority'), 
    MongooseModule.forFeature([{ name: Fatura.name, schema: FaturaSchema }]),
  ],
  controllers: [AppController],
  providers: [AppService, PdfExtractorService],
})
export class AppModule {}