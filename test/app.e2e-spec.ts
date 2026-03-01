// test/app.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as path from 'path';
import { AppModule } from '../src/app.module';

jest.setTimeout(120000); // aumentar timeout caso o processamento demore

describe('Lumi API (e2e) - Swagger-like integration tests', () => {
  let app: INestApplication;
  const serverUrl = 'http://localhost:3000'; // ajusta se seu app usar outra porta

  // caminhos tal como você informou (Windows) — use forward slashes para compatibilidade
  const pdf1 = path.resolve('C:/Users/lucas/Downloads/Lumi/lumi-api/assets/faturas/3001116735-01-2024.pdf');
  const pdf2 = path.resolve('C:/Users/lucas/Downloads/Lumi/lumi-api/assets/faturas/3001116735-02-2024.pdf');

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /upload -> should accept single PDF and respond 201 / processed result', async () => {
    const res = await request(app.getHttpServer())
      .post('/upload')
      .attach('file', pdf1)
      .expect(res => {
        // o controller retorna o retorno do appService.processSingle
        if (![200, 201].includes(res.status)) {
          throw new Error(`Status inesperado: ${res.status} - ${JSON.stringify(res.body)}`);
        }
      });

    // opcional: inspeciona a resposta
    expect(res.body).toBeDefined();
  });

  it('POST /upload-many -> should accept multiple PDFs', async () => {
    const res = await request(app.getHttpServer())
      .post('/upload-many')
      .attach('files', pdf1)
      .attach('files', pdf2)
      .expect(res => {
        if (![200, 201].includes(res.status)) {
          throw new Error(`Status inesperado: ${res.status} - ${JSON.stringify(res.body)}`);
        }
      });

    expect(res.body).toBeDefined();
  });

  it('GET /invoices -> should return list (and allow fetching an ID)', async () => {
    const list = await request(app.getHttpServer())
      .get('/invoices')
      .query({ page: 1, limit: 50 })
      .expect(200);

    expect(list.body).toBeDefined();

    // se houver items, pega o primeiro id e chama GET /invoices/:id
    const items = Array.isArray(list.body) ? list.body : (list.body.items || []);
    if (items && items.length > 0) {
      const firstId = items[0]._id || items[0].id || items[0].uuid || items[0].invoiceId;
      if (firstId) {
        const byId = await request(app.getHttpServer()).get(`/invoices/${firstId}`).expect(200);
        expect(byId.body).toBeDefined();
      }
    }
  });

  it('GET /invoices/year/:ano -> simple check', async () => {
    const year = '2024';
    await request(app.getHttpServer()).get(`/invoices/year/${year}`).expect(200);
  });

  it('DELETE /invoices (deleteAll) -> call and expect 200/204', async () => {
    // cuidado: esse teste apaga tudo. Remova ou comente se não quiser deletar.
    const res = await request(app.getHttpServer()).delete('/invoices');
    if (![200, 204].includes(res.status)) {
      // some implementations may return 200 with body
      throw new Error(`Delete all returned unexpected status ${res.status}`);
    }
  });
});