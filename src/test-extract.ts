import { readFileSync } from 'fs';
import { join } from 'path';
import { PdfExtractorService } from './pdf-extractor.service';

async function testarExtracao() {
  const extractor = new PdfExtractorService();

  // caminho seguro usando path.join (evita erro no Windows)
  const pdfPath = join(
    process.cwd(),
    'assets',
    'faturas',
    '3001116735-01-2024.pdf'
  );

  try {
    const buffer = readFileSync(pdfPath);

    const resultado = await extractor.extract(
      buffer,
      '3001116735-01-2024.pdf'
    );

    console.log('\n========== RESULTADO ==========\n');
    console.log(JSON.stringify(resultado, null, 2));
    console.log('\n===============================\n');

  } catch (err) {
    console.error('Erro na extração:', err);
  }
}

testarExtracao();