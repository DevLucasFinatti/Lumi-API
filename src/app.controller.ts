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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('Lumi')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // ===============================
  // UPLOAD SINGLE
  // ===============================
  @ApiOperation({ summary: 'Upload de um único PDF' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Arquivo processado com sucesso' })
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhum arquivo enviado');

    const mimetype = file.mimetype || '';
    if (!mimetype.includes('pdf')) {
      throw new BadRequestException('Apenas arquivos PDF são aceitos');
    }

    return this.appService.processSingle(file);
  }

  // ===============================
  // UPLOAD MULTIPLE
  // ===============================
  @ApiOperation({ summary: 'Upload de múltiplos PDFs' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    },
  })
  @Post('upload-many')
  @UseInterceptors(FilesInterceptor('files', 30))
  async uploadMultiple(@UploadedFiles() files: Express.Multer.File[]) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    for (const f of files) {
      if (!f.mimetype || !f.mimetype.includes('pdf')) {
        throw new BadRequestException('Todos os arquivos devem ser PDF');
      }
    }

    return this.appService.processMultiple(files);
  }

  // ===============================
  // LIST + FILTROS + PAGINAÇÃO
  // ===============================
  @ApiOperation({ summary: 'Lista faturas com filtros e paginação' })
  @ApiQuery({ name: 'noCliente', required: false })
  @ApiQuery({ name: 'mesReferencia', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @Get('invoices')
  async getAll(
    @Query('noCliente') noCliente?: string,
    @Query('mesReferencia') mesReferencia?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
  ) {
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));

    return this.appService.getAll({
      noCliente,
      mesReferencia,
      page: p,
      limit: l,
    });
  }

  // ===============================
  // GET BY ID
  // ===============================
  @ApiOperation({ summary: 'Buscar fatura por ID' })
  @ApiParam({ name: 'id', description: 'ID da fatura' })
  @Get('invoices/:id')
  async getById(@Param('id') id: string) {
    return this.appService.getById(id);
  }

  // ===============================
  // GET BY ANO
  // ===============================
  @ApiOperation({ summary: 'Buscar faturas por ano' })
  @ApiParam({ name: 'ano', description: 'Ano de referência' })
  @Get('invoices/year/:ano')
  async getByAno(@Param('ano') ano: string) {
    return this.appService.getByAno(ano);
  }

  // ===============================
  // DASHBOARD ENERGIA
  // ===============================
  @ApiOperation({ summary: 'Dashboard de energia' })
  @ApiQuery({ name: 'ano', required: false })
  @ApiQuery({ name: 'noCliente', required: false })
  @Get('dashboard/energy')
  async dashboardEnergia(
    @Query('ano') ano?: string,
    @Query('noCliente') noCliente?: string,
  ) {
    return this.appService.getDashboardEnergia({ ano, noCliente });
  }

  // ===============================
  // DASHBOARD FINANCEIRO
  // ===============================
  @ApiOperation({ summary: 'Dashboard financeiro' })
  @ApiQuery({ name: 'ano', required: false })
  @ApiQuery({ name: 'noCliente', required: false })
  @Get('dashboard/financial')
  async dashboardFinanceiro(
    @Query('ano') ano?: string,
    @Query('noCliente') noCliente?: string,
  ) {
    return this.appService.getDashboardFinanceiro({ ano, noCliente });
  }

  // ===============================
  // DELETE BY ID
  // ===============================
  @ApiOperation({ summary: 'Excluir fatura por ID' })
  @ApiParam({ name: 'id', description: 'ID da fatura' })
  @Delete('invoices/:id')
  async deleteById(@Param('id') id: string) {
    return this.appService.deleteById(id);
  }

  // ===============================
  // DELETE ALL
  // ===============================
  @ApiOperation({ summary: 'Excluir todas as faturas' })
  @Delete('invoices')
  async deleteAll() {
    return this.appService.deleteAll();
  }
}