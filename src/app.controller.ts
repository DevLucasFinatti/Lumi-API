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
  Query,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // UPLOAD SINGLE
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    const mimetype = file.mimetype || '';
    if (!mimetype.includes('pdf')) throw new BadRequestException('Apenas arquivos PDF são aceitos');

    return this.appService.processSingle(file);
  }

  // UPLOAD MULTIPLE
  @Post('upload-many')
  @UseInterceptors(FilesInterceptor('files', 30))
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) throw new BadRequestException('Nenhum arquivo enviado');

    for (const f of files) {
      if (!f.mimetype || !f.mimetype.includes('pdf')) {
        throw new BadRequestException('Todos os arquivos devem ser PDF');
      }
    }

    return this.appService.processMultiple(files);
  }

  // LIST + FILTROS + PAGINAÇÃO
  @Get('invoices')
  async getAll(
    @Query('noCliente') noCliente?: string,
    @Query('mesReferencia') mesReferencia?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
    return this.appService.getAll({ noCliente, mesReferencia, page: p, limit: l });
  }

  // GET BY ID
  @Get('invoices/:id')
  async getById(@Param('id') id: string) {
    return this.appService.getById(id);
  }

  // GET BY ANO
  @Get('invoices/year/:ano')
  async getByAno(@Param('ano') ano: string) {
    return this.appService.getByAno(ano);
  }

  // DASHBOARD ENERGIA
  @Get('dashboard/energy')
  async dashboardEnergia(
    @Query('ano') ano?: string,
    @Query('noCliente') noCliente?: string,
  ) {
    return this.appService.getDashboardEnergia({ ano, noCliente });
  }

  // DASHBOARD FINANCEIRO
  @Get('dashboard/financial')
  async dashboardFinanceiro(
    @Query('ano') ano?: string,
    @Query('noCliente') noCliente?: string,
  ) {
    return this.appService.getDashboardFinanceiro({ ano, noCliente });
  }

  // DELETE BY ID
  @Delete('invoices/:id')
  async deleteById(@Param('id') id: string) {
    return this.appService.deleteById(id);
  }

  // DELETE ALL
  @Delete('invoices')
  async deleteAll() {
    return this.appService.deleteAll();
  }
}