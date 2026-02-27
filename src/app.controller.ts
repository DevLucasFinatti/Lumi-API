import {
  Controller,
  Post,
  UploadedFile,
  UploadedFiles,
  UseInterceptors,
  BadRequestException,
  Get,
  Delete,
  Param,
} from '@nestjs/common';
import {
  FileInterceptor,
  FilesInterceptor,
} from '@nestjs/platform-express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // =============================
  // UPLOAD SINGLE
  // =============================
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    return this.appService.processSingle(file);
  }

  // =============================
  // UPLOAD MULTIPLE
  // =============================
  @Post('upload-many')
  @UseInterceptors(FilesInterceptor('files', 30))
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    return this.appService.processMultiple(files);
  }

   // =============================
  // GET ALL
  // =============================
  @Get('faturas')
  async getAll() {
    return this.appService.getAll();
  }

  // =============================
  // GET BY ANO
  // =============================
  @Get('faturas/ano/:ano')
  async getByAno(@Param('ano') ano: string) {
    return this.appService.getByAno(ano);
  }

  // =============================
  // DELETE ALL
  // =============================
  @Delete('faturas')
  async deleteAll() {
    return this.appService.deleteAll();
  }
}