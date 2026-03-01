# ⚡ Lumi API

API desenvolvida com **NestJS** para gerenciamento de faturas de
energia, dashboards analíticos e upload de PDFs para processamento
automatizado.

------------------------------------------------------------------------

## 🚀 Tecnologias

-   NestJS
-   TypeScript
-   Swagger
-   Multer (upload de arquivos)
-   CORS habilitado
-   Processamento de PDFs

------------------------------------------------------------------------

## 📦 Instalação

``` bash
npm install
```

------------------------------------------------------------------------

## ▶️ Executando o projeto

``` bash
npm run start:dev
```

A API estará disponível em:

http://localhost:3001

------------------------------------------------------------------------

## 📚 Documentação (Swagger)

A documentação interativa está disponível em:

http://localhost:3001/docs

Lá você pode:

-   Testar uploads
-   Executar filtros
-   Consultar dashboards
-   Validar parâmetros

------------------------------------------------------------------------

## 🔐 CORS

CORS habilitado para:

http://localhost:3000

Configure em `main.ts` se necessário.

------------------------------------------------------------------------

# 📂 Endpoints

## 📤 Upload

### Upload único

POST /upload\
- multipart/form-data\
- Campo: `file`\
- Tipo: PDF

### Upload múltiplo

POST /upload-many\
- Até 30 arquivos\
- Campo: `files[]`\
- Todos devem ser PDF

------------------------------------------------------------------------

## 📄 Faturas

### Listar faturas

GET /invoices

Query Params:

-   noCliente (opcional)
-   mesReferencia (opcional)
-   page (opcional)
-   limit (opcional)

Exemplo: /invoices?page=1&limit=50

------------------------------------------------------------------------

### Buscar por ID

GET /invoices/:id

### Buscar por Ano

GET /invoices/year/:ano

------------------------------------------------------------------------

## 📊 Dashboards

### Dashboard de Energia

GET /dashboard/energy\
Query: - ano (opcional) - noCliente (opcional)

### Dashboard Financeiro

GET /dashboard/financial\
Query: - ano (opcional) - noCliente (opcional)

------------------------------------------------------------------------

## 🗑 Exclusões

### Deletar por ID

DELETE /invoices/:id

### Deletar todas

DELETE /invoices

------------------------------------------------------------------------

# ⚙️ Variáveis de Ambiente

Crie um arquivo `.env`:

PORT=3001

------------------------------------------------------------------------

# 🏗 Estrutura do Projeto

    src/
     ├── app.controller.ts
     ├── app.service.ts
     ├── app.module.ts
     ├── main.ts

------------------------------------------------------------------------

# 🧠 Regras de Negócio

-   Apenas arquivos PDF são aceitos
-   Paginação limitada a 500 registros por requisição
-   Filtros opcionais por cliente e mês
-   Dashboards agregam dados por ano e cliente

------------------------------------------------------------------------

# 👨‍💻 Autor

Desenvolvido por **Lucas Finatti** 🚀
