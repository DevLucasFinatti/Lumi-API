import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PdfExtractorService } from './pdf-extractor.service';
import { Fatura, FaturaSchema } from './fatura.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('MONGOOSE_CONNECTION_STRING'),
      }),
    }),

    MongooseModule.forFeature([{ name: Fatura.name, schema: FaturaSchema }]),
  ],
  controllers: [AppController],
  providers: [AppService, PdfExtractorService],
})
export class AppModule {}