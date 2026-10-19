import { PDFParse } from 'pdf-parse';

// Extracts plain text from a PDF buffer (pdf-parse v2 class API).
export async function extractPdfText(buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return (result.text || '').replace(/^-- \d+ of \d+ --$/gm, '').trim();
  } finally {
    await parser.destroy().catch(() => {});
  }
}
